"""
═══════════════════════════════════════════════════════════════════════════════
COS Financial Lakehouse — Bronze to Silver ETL (AWS Glue 4.0)

Job: Bronze_to_Silver_ETL
Purpose: Read Bronze Iceberg tables, cleanse, standardize, deduplicate,
         derive fiscal year, perform incremental MERGE INTO Silver.

Glue Configuration:
  - Glue version: 4.0
  - Worker type: G.1X
  - Number of workers: 2
  - Job parameters:
      --CATALOG       glue_catalog
      --BRONZE_DB     cos_bronze
      --SILVER_DB     cos_silver
      --PROCESS_DATE  2025-05-08  (optional, defaults to today)
  - IAM Role: cos-financial-lakehouse-glue-etl-role
  - Job bookmark: enabled (incremental processing)

Processing Logic:
  - Reads only new/changed records from Bronze (via ingestion_date filter)
  - Deduplicates by natural key (latest last_update_date wins)
  - Derives fiscal year from period_name (COS fiscal: Jul-Jun)
  - Calculates expenditure metrics
  - MERGE INTO Silver (upsert: update if exists, insert if new)
═══════════════════════════════════════════════════════════════════════════════
"""

import sys
import logging
from datetime import datetime, timedelta
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from awsglue.context import GlueContext
from awsglue.job import Job
from pyspark.context import SparkContext
from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.window import Window

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

args = getResolvedOptions(sys.argv, ['JOB_NAME', 'CATALOG', 'BRONZE_DB', 'SILVER_DB'])

JOB_NAME = args['JOB_NAME']
CATALOG = args['CATALOG']
BRONZE_DB = args['BRONZE_DB']
SILVER_DB = args['SILVER_DB']

# Optional: process specific date (for backfill), otherwise process latest
PROCESS_DATE = args.get('PROCESS_DATE', datetime.now().strftime("%Y-%m-%d"))

# ─────────────────────────────────────────────────────────────────────────────
# LOGGING
# ─────────────────────────────────────────────────────────────────────────────

logger = logging.getLogger(JOB_NAME)
logger.setLevel(logging.INFO)
handler = logging.StreamHandler(sys.stdout)
handler.setFormatter(logging.Formatter(
    '%(asctime)s [%(name)s] %(levelname)s: %(message)s'
))
logger.addHandler(handler)

# ─────────────────────────────────────────────────────────────────────────────
# SPARK + ICEBERG SESSION
# ─────────────────────────────────────────────────────────────────────────────

sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(JOB_NAME, args)

# Iceberg extensions for MERGE INTO support
spark.conf.set("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions")
spark.conf.set(f"spark.sql.catalog.{CATALOG}", "org.apache.iceberg.spark.SparkCatalog")
spark.conf.set(f"spark.sql.catalog.{CATALOG}.catalog-impl", "org.apache.iceberg.aws.glue.GlueCatalog")
spark.conf.set(f"spark.sql.catalog.{CATALOG}.io-impl", "org.apache.iceberg.aws.s3.S3FileIO")

logger.info(f"Job started: {JOB_NAME}")
logger.info(f"Process date: {PROCESS_DATE}")
logger.info(f"Bronze DB: {BRONZE_DB}, Silver DB: {SILVER_DB}")

# ─────────────────────────────────────────────────────────────────────────────
# TRANSFORMATION FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def read_bronze_incremental(table_name, process_date):
    """
    Read new records from Bronze (incremental via ingestion_date).
    Job bookmarks track what's already been processed.
    """
    full_table = f"{CATALOG}.{BRONZE_DB}.{table_name}"
    logger.info(f"  Reading incremental from: {full_table}")
    logger.info(f"  Filter: ingestion_date >= {process_date}")

    df = spark.read.format("iceberg").load(full_table) \
        .filter(col("ingestion_date") >= process_date)

    count = df.count()
    logger.info(f"  Found {count} new/changed records")
    return df, count


def deduplicate(df, key_columns, order_column="last_update_date"):
    """
    Deduplicate by natural key — keep latest record.
    Uses ROW_NUMBER window function.
    """
    window = Window.partitionBy(*key_columns).orderBy(col(order_column).desc())

    deduped = df \
        .withColumn("_rn", row_number().over(window)) \
        .filter(col("_rn") == 1) \
        .drop("_rn")

    before_count = df.count()
    after_count = deduped.count()
    dupes_removed = before_count - after_count

    logger.info(f"  Deduplication: {before_count} → {after_count} ({dupes_removed} duplicates removed)")
    return deduped


def cleanse_budget_control(df):
    """
    Cleanse and standardize budget_control records:
    - Trim string fields
    - Standardize period_name format
    - Replace NULLs with 0 for numeric fields
    - Validate period_name format
    """
    logger.info("  Applying cleansing rules...")

    cleaned = df \
        .withColumn("period_name", upper(trim(col("period_name")))) \
        .withColumn("budget_name", trim(col("budget_name"))) \
        .withColumn("actual_amount", coalesce(col("actual_amount"), lit(0.0))) \
        .withColumn("encumbrance_amount", coalesce(col("encumbrance_amount"), lit(0.0))) \
        .withColumn("commitment_amount", coalesce(col("commitment_amount"), lit(0.0))) \
        .withColumn("obligation_amount", coalesce(col("obligation_amount"), lit(0.0))) \
        .withColumn("funds_available", coalesce(col("funds_available"), lit(0.0)))

    # Filter out records with invalid period_name format
    valid_periods = cleaned.filter(
        col("period_name").rlike("^[A-Z]{3}-\\d{4}$")
    )

    invalid_count = cleaned.count() - valid_periods.count()
    if invalid_count > 0:
        logger.warning(f"  Removed {invalid_count} records with invalid period_name")

    return valid_periods


def derive_fiscal_year(df):
    """
    Derive COS fiscal year from period_name.
    COS fiscal year: Jul-Jun (JUL-2024 = FY2025)
    """
    return df.withColumn("fiscal_year",
        when(
            substring("period_name", 1, 3).isin("JUL", "AUG", "SEP", "OCT", "NOV", "DEC"),
            substring("period_name", 5, 4).cast("int") + 1
        ).otherwise(
            substring("period_name", 5, 4).cast("int")
        )
    )


def calculate_metrics(df):
    """Calculate derived expenditure metrics."""
    return df \
        .withColumn("expenditure_amount", col("actual_amount")) \
        .withColumn("funds_available",
            col("budget_amount") - col("actual_amount") - col("encumbrance_amount")) \
        .withColumn("burn_rate",
            when(col("budget_amount") > 0,
                 round((col("actual_amount") + col("encumbrance_amount")) / col("budget_amount"), 4))
            .otherwise(lit(0.0)))


def add_silver_metadata(df):
    """Add Silver layer audit columns."""
    now = current_timestamp()
    return df \
        .withColumn("dw_insert_date", now) \
        .withColumn("dw_update_date", now)


def merge_into_silver(source_df, target_table, key_columns):
    """
    MERGE INTO Silver Iceberg table (CDC/Upsert pattern).
    - Matched + newer → UPDATE
    - Not matched → INSERT
    """
    full_table = f"{CATALOG}.{SILVER_DB}.{target_table}"
    logger.info(f"  MERGE INTO: {full_table}")

    # Register source as temp view
    source_df.createOrReplaceTempView("_silver_source")

    # Build ON clause
    on_clause = " AND ".join([f"target.{k} = source.{k}" for k in key_columns])

    # Build UPDATE SET clause (all non-key columns)
    all_cols = [c for c in source_df.columns if c not in key_columns]
    update_set = ", ".join([f"target.{c} = source.{c}" for c in all_cols])

    # Build INSERT columns and values
    insert_cols = ", ".join(source_df.columns)
    insert_vals = ", ".join([f"source.{c}" for c in source_df.columns])

    merge_sql = f"""
        MERGE INTO {full_table} AS target
        USING _silver_source AS source
        ON {on_clause}
        WHEN MATCHED AND source.last_update_date > target.last_update_date THEN
            UPDATE SET {update_set}
        WHEN NOT MATCHED THEN
            INSERT ({insert_cols}) VALUES ({insert_vals})
    """

    spark.sql(merge_sql)

    # Get final count
    final_count = spark.read.format("iceberg").load(full_table).count()
    logger.info(f"  ✅ MERGE complete. Silver table now has {final_count} rows")
    return final_count


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ETL PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

def main():
    logger.info("=" * 70)
    logger.info("  BRONZE TO SILVER ETL — Starting")
    logger.info("=" * 70)

    # ─── Process budget_control ───
    logger.info("\n" + "─" * 50)
    logger.info("Processing: budget_control")
    logger.info("─" * 50)

    # Step 1: Read incremental from Bronze
    bronze_df, new_count = read_bronze_incremental("budget_control", PROCESS_DATE)

    if new_count == 0:
        logger.info("  No new records to process. Exiting.")
        job.commit()
        return

    # Step 2: Deduplicate (key: code_combination_id + period_name)
    deduped_df = deduplicate(bronze_df, ["code_combination_id", "period_name"])

    # Step 3: Cleanse and standardize
    cleaned_df = cleanse_budget_control(deduped_df)

    # Step 4: Derive fiscal year
    fiscal_df = derive_fiscal_year(cleaned_df)

    # Step 5: Calculate metrics
    metrics_df = calculate_metrics(fiscal_df)

    # Step 6: Add Silver metadata
    silver_df = add_silver_metadata(metrics_df)

    # Step 7: Select final Silver columns
    final_df = silver_df.select(
        "code_combination_id",
        "period_name",
        "budget_amount",
        "actual_amount",
        "encumbrance_amount",
        "commitment_amount",
        "obligation_amount",
        "expenditure_amount",
        "funds_available",
        col("last_update_date").cast("timestamp").alias("last_update_date"),
        "dw_insert_date",
        "dw_update_date",
        "fiscal_year"
    )

    # Step 8: MERGE into Silver
    merge_into_silver(
        final_df,
        "budget_control_clean",
        ["code_combination_id", "period_name"]
    )

    # Summary
    logger.info(f"\n{'=' * 70}")
    logger.info(f"  BRONZE TO SILVER ETL — Complete")
    logger.info(f"{'=' * 70}")
    logger.info(f"  Records processed: {new_count}")
    logger.info(f"  After dedup: {final_df.count()}")
    logger.info(f"  Process date: {PROCESS_DATE}")

    job.commit()
    logger.info("  Job bookmark committed")


if __name__ == "__main__":
    main()
