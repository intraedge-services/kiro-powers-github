"""
═══════════════════════════════════════════════════════════════════════════════
COS Financial Lakehouse — UCM to Bronze ETL (AWS Glue 4.0)

Job: UCM_to_Bronze_ETL
Purpose: Read Oracle BICC CSV extracts from UCM/S3 landing zone,
         validate schema, quarantine bad records, write Iceberg Bronze tables.

Glue Configuration:
  - Glue version: 4.0
  - Worker type: G.1X
  - Number of workers: 2
  - Job parameters:
      --LANDING_PATH    s3://cos-financial-lakehouse-demo/landing/
      --BRONZE_PATH     s3://cos-financial-lakehouse-demo/bronze/
      --QUARANTINE_PATH s3://cos-financial-lakehouse-demo/quarantine/
      --CATALOG         glue_catalog
      --DATABASE        cos_bronze
  - IAM Role: cos-financial-lakehouse-glue-etl-role

Iceberg Integration:
  - Writes to Glue Catalog registered Iceberg tables
  - Append-only (no updates in Bronze)
  - Partitioned by ingestion_date
═══════════════════════════════════════════════════════════════════════════════
"""

import sys
import logging
from datetime import datetime
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from awsglue.context import GlueContext
from awsglue.job import Job
from pyspark.context import SparkContext
from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.types import *

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

args = getResolvedOptions(sys.argv, [
    'JOB_NAME',
    'LANDING_PATH',
    'BRONZE_PATH',
    'QUARANTINE_PATH',
    'CATALOG',
    'DATABASE'
])

JOB_NAME = args['JOB_NAME']
LANDING_PATH = args['LANDING_PATH']
BRONZE_PATH = args['BRONZE_PATH']
QUARANTINE_PATH = args['QUARANTINE_PATH']
CATALOG = args['CATALOG']
DATABASE = args['DATABASE']
INGESTION_DATE = datetime.now().strftime("%Y-%m-%d")
INGESTION_TS = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

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

# Configure Iceberg catalog
spark.conf.set(f"spark.sql.catalog.{CATALOG}", "org.apache.iceberg.spark.SparkCatalog")
spark.conf.set(f"spark.sql.catalog.{CATALOG}.warehouse", BRONZE_PATH)
spark.conf.set(f"spark.sql.catalog.{CATALOG}.catalog-impl", "org.apache.iceberg.aws.glue.GlueCatalog")
spark.conf.set(f"spark.sql.catalog.{CATALOG}.io-impl", "org.apache.iceberg.aws.s3.S3FileIO")

logger.info(f"Job started: {JOB_NAME}")
logger.info(f"Landing path: {LANDING_PATH}")
logger.info(f"Ingestion date: {INGESTION_DATE}")

# ─────────────────────────────────────────────────────────────────────────────
# EXPECTED SCHEMAS (Oracle Fusion PVO structure)
# ─────────────────────────────────────────────────────────────────────────────

BUDGET_CONTROL_SCHEMA = StructType([
    StructField("CodeCombinationId", LongType(), False),
    StructField("PeriodName", StringType(), False),
    StructField("BudgetName", StringType(), True),
    StructField("BudgetAmount", DoubleType(), False),
    StructField("ActualAmount", DoubleType(), True),
    StructField("EncumbranceAmount", DoubleType(), True),
    StructField("CommitmentAmount", DoubleType(), True),
    StructField("ObligationAmount", DoubleType(), True),
    StructField("FundsAvailable", DoubleType(), True),
    StructField("LastUpdateDate", StringType(), True),
])

COA_SCHEMA = StructType([
    StructField("CodeCombinationId", LongType(), False),
    StructField("Segment1", StringType(), True),  # Fund
    StructField("Segment1Description", StringType(), True),
    StructField("Segment2", StringType(), True),  # Department
    StructField("Segment2Description", StringType(), True),
    StructField("Segment3", StringType(), True),  # Account
    StructField("Segment3Description", StringType(), True),
    StructField("AccountType", StringType(), True),
    StructField("EnabledFlag", StringType(), True),
])

SUPPLIER_SCHEMA = StructType([
    StructField("VendorId", LongType(), False),
    StructField("SupplierName", StringType(), True),
    StructField("SupplierStatus", StringType(), True),
    StructField("PaymentTerms", StringType(), True),
    StructField("CommodityCategory", StringType(), True),
])

# Map of PVO extract files to their schemas and target tables
PVO_CONFIGS = {
    "BudgetaryControlBalanceExtract": {
        "schema": BUDGET_CONTROL_SCHEMA,
        "target_table": "budget_control",
        "key_column": "CodeCombinationId",
    },
    "CodeCombinationExtract": {
        "schema": COA_SCHEMA,
        "target_table": "code_combinations",
        "key_column": "CodeCombinationId",
    },
    "SupplierExtract": {
        "schema": SUPPLIER_SCHEMA,
        "target_table": "suppliers",
        "key_column": "VendorId",
    },
}

# ─────────────────────────────────────────────────────────────────────────────
# FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

def read_landing_csv(path, expected_schema):
    """Read CSV from landing zone with schema validation."""
    logger.info(f"Reading CSV from: {path}")

    try:
        df = spark.read \
            .option("header", "true") \
            .option("inferSchema", "false") \
            .schema(expected_schema) \
            .option("mode", "PERMISSIVE") \
            .option("columnNameOfCorruptRecord", "_corrupt_record") \
            .csv(path)

        total = df.count()
        logger.info(f"  Read {total} records from landing")
        return df, total

    except Exception as e:
        logger.error(f"  Failed to read CSV: {str(e)}")
        raise


def validate_records(df, key_column):
    """
    Validate records: separate good from bad.
    Bad records: NULL key column, invalid data types.
    Returns: (good_df, bad_df)
    """
    # Good records: key column is not null
    good_df = df.filter(col(key_column).isNotNull())

    # Bad records: key column is null or corrupt
    bad_df = df.filter(col(key_column).isNull())

    good_count = good_df.count()
    bad_count = bad_df.count()

    logger.info(f"  Validation: {good_count} good, {bad_count} quarantined")

    return good_df, bad_df


def quarantine_records(bad_df, pvo_name):
    """Write bad records to quarantine zone for investigation."""
    if bad_df.count() == 0:
        logger.info(f"  No records to quarantine for {pvo_name}")
        return

    quarantine_path = f"{QUARANTINE_PATH}{pvo_name}/date={INGESTION_DATE}/"
    logger.info(f"  Writing quarantine records to: {quarantine_path}")

    bad_df.withColumn("quarantine_reason", lit("NULL_KEY_COLUMN")) \
        .withColumn("quarantine_date", lit(INGESTION_DATE)) \
        .write \
        .mode("append") \
        .parquet(quarantine_path)


def standardize_columns(df, pvo_name):
    """Standardize Oracle PVO column names to snake_case for Bronze."""
    if pvo_name == "BudgetaryControlBalanceExtract":
        return df \
            .withColumnRenamed("CodeCombinationId", "code_combination_id") \
            .withColumnRenamed("PeriodName", "period_name") \
            .withColumnRenamed("BudgetName", "budget_name") \
            .withColumnRenamed("BudgetAmount", "budget_amount") \
            .withColumnRenamed("ActualAmount", "actual_amount") \
            .withColumnRenamed("EncumbranceAmount", "encumbrance_amount") \
            .withColumnRenamed("CommitmentAmount", "commitment_amount") \
            .withColumnRenamed("ObligationAmount", "obligation_amount") \
            .withColumnRenamed("FundsAvailable", "funds_available") \
            .withColumnRenamed("LastUpdateDate", "last_update_date")

    elif pvo_name == "CodeCombinationExtract":
        return df \
            .withColumnRenamed("CodeCombinationId", "code_combination_id") \
            .withColumnRenamed("Segment1", "fund") \
            .withColumnRenamed("Segment1Description", "fund_description") \
            .withColumnRenamed("Segment2", "department") \
            .withColumnRenamed("Segment2Description", "department_description") \
            .withColumnRenamed("Segment3", "account") \
            .withColumnRenamed("Segment3Description", "account_description") \
            .withColumnRenamed("AccountType", "account_type") \
            .withColumnRenamed("EnabledFlag", "enabled_flag")

    elif pvo_name == "SupplierExtract":
        return df \
            .withColumnRenamed("VendorId", "vendor_id") \
            .withColumnRenamed("SupplierName", "supplier_name") \
            .withColumnRenamed("SupplierStatus", "supplier_status") \
            .withColumnRenamed("PaymentTerms", "payment_terms") \
            .withColumnRenamed("CommodityCategory", "commodity_category")

    return df


def add_ingestion_metadata(df):
    """Add Bronze layer metadata columns."""
    return df \
        .withColumn("bicc_extract_id", lit(f"BICC_{INGESTION_DATE.replace('-', '')}")) \
        .withColumn("ingestion_timestamp", lit(INGESTION_TS).cast("timestamp")) \
        .withColumn("ingestion_date", lit(INGESTION_DATE))


def write_to_bronze_iceberg(df, table_name):
    """Append data to Bronze Iceberg table via Glue Catalog."""
    full_table = f"{CATALOG}.{DATABASE}.{table_name}"
    logger.info(f"  Writing to Iceberg table: {full_table}")

    row_count = df.count()

    df.writeTo(full_table).append()

    logger.info(f"  ✅ Appended {row_count} rows to {full_table}")
    return row_count


# ─────────────────────────────────────────────────────────────────────────────
# MAIN ETL PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

def main():
    logger.info("=" * 70)
    logger.info("  UCM TO BRONZE ETL — Starting")
    logger.info("=" * 70)

    total_ingested = 0
    total_quarantined = 0
    processed_pvos = []

    for pvo_name, config in PVO_CONFIGS.items():
        landing_path = f"{LANDING_PATH}{pvo_name}/"
        logger.info(f"\n{'─' * 50}")
        logger.info(f"Processing PVO: {pvo_name}")
        logger.info(f"{'─' * 50}")

        try:
            # Check if landing data exists
            try:
                df_check = spark.read.csv(landing_path, header=True)
                if df_check.count() == 0:
                    logger.info(f"  No data found in {landing_path} — skipping")
                    continue
            except Exception:
                logger.info(f"  No files found at {landing_path} — skipping")
                continue

            # Step 1: Read with schema enforcement
            raw_df, raw_count = read_landing_csv(landing_path, config["schema"])

            # Step 2: Validate records
            good_df, bad_df = validate_records(raw_df, config["key_column"])

            # Step 3: Quarantine bad records
            quarantine_records(bad_df, pvo_name)
            total_quarantined += bad_df.count()

            # Step 4: Standardize column names
            standardized_df = standardize_columns(good_df, pvo_name)

            # Step 5: Add ingestion metadata
            bronze_df = add_ingestion_metadata(standardized_df)

            # Step 6: Write to Bronze Iceberg table
            rows_written = write_to_bronze_iceberg(bronze_df, config["target_table"])
            total_ingested += rows_written
            processed_pvos.append(pvo_name)

        except Exception as e:
            logger.error(f"  ❌ Failed processing {pvo_name}: {str(e)}")
            # Continue with other PVOs — don't fail entire job
            continue

    # Summary
    logger.info(f"\n{'=' * 70}")
    logger.info(f"  UCM TO BRONZE ETL — Complete")
    logger.info(f"{'=' * 70}")
    logger.info(f"  PVOs processed: {len(processed_pvos)}")
    logger.info(f"  Total ingested: {total_ingested} rows")
    logger.info(f"  Total quarantined: {total_quarantined} rows")
    logger.info(f"  Ingestion date: {INGESTION_DATE}")

    # Commit job bookmark for incremental processing
    job.commit()
    logger.info("  Job bookmark committed")


if __name__ == "__main__":
    main()
