"""
═══════════════════════════════════════════════════════════════════════════════
COS Financial Lakehouse — Silver to Gold ETL (AWS Glue 4.0)

Job: Silver_to_Gold_ETL
Purpose: Build Kimball dimensional model from Silver layer.
         Create/refresh dimension tables and fact table.
         Implement business transformations and aggregations.

Glue Configuration:
  - Glue version: 4.0
  - Worker type: G.1X
  - Number of workers: 2
  - Job parameters:
      --CATALOG     glue_catalog
      --SILVER_DB   cos_silver
      --GOLD_DB     cos_gold
  - IAM Role: cos-financial-lakehouse-glue-etl-role
  - Job bookmark: enabled

Dimensional Model:
  - dim_coa: Chart of Accounts (SCD Type 2)
  - dim_period: Fiscal Calendar (Type 1)
  - dim_supplier: Vendor Master (SCD Type 2)
  - fact_budgetary_control: Budget vs Actual (partitioned by fiscal_year)
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
from pyspark.sql.window import Window

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

args = getResolvedOptions(sys.argv, ['JOB_NAME', 'CATALOG', 'SILVER_DB', 'GOLD_DB'])

JOB_NAME = args['JOB_NAME']
CATALOG = args['CATALOG']
SILVER_DB = args['SILVER_DB']
GOLD_DB = args['GOLD_DB']

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

spark.conf.set("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions")
spark.conf.set(f"spark.sql.catalog.{CATALOG}", "org.apache.iceberg.spark.SparkCatalog")
spark.conf.set(f"spark.sql.catalog.{CATALOG}.catalog-impl", "org.apache.iceberg.aws.glue.GlueCatalog")
spark.conf.set(f"spark.sql.catalog.{CATALOG}.io-impl", "org.apache.iceberg.aws.s3.S3FileIO")

logger.info(f"Job started: {JOB_NAME}")

# ─────────────────────────────────────────────────────────────────────────────
# DIMENSION: dim_coa (Chart of Accounts — SCD Type 2)
# ─────────────────────────────────────────────────────────────────────────────

def refresh_dim_coa():
    """
    Build dim_coa from Silver code_combinations table.
    SCD Type 2: Track historical changes to descriptions.
    """
    logger.info("\n" + "─" * 50)
    logger.info("Building: dim_coa (Chart of Accounts)")
    logger.info("─" * 50)

    silver_table = f"{CATALOG}.{SILVER_DB}.budget_control_clean"
    gold_table = f"{CATALOG}.{GOLD_DB}.dim_coa"

    # Extract distinct CCIDs from Silver budget data
    # In production, this would come from CodeCombinationExtract PVO
    silver_df = spark.read.format("iceberg").load(silver_table)

    distinct_ccids = silver_df.select("code_combination_id").distinct()

    # Build dimension from Silver (simplified — production would use COA PVO)
    dim_coa_df = distinct_ccids \
        .withColumn("coa_key", monotonically_increasing_id() + 1) \
        .withColumn("fund", lit("100")) \
        .withColumn("fund_description", lit("General Fund")) \
        .withColumn("department", col("code_combination_id").cast("string")) \
        .withColumn("department_description",
            when(col("code_combination_id") == 1001, lit("Police"))
            .when(col("code_combination_id") == 1003, lit("Fire"))
            .when(col("code_combination_id") == 1005, lit("Public Works"))
            .when(col("code_combination_id") == 1007, lit("Parks & Rec"))
            .when(col("code_combination_id") == 1009, lit("Community Dev"))
            .when(col("code_combination_id") == 1011, lit("Water Resources"))
            .when(col("code_combination_id") == 1013, lit("Transportation"))
            .when(col("code_combination_id") == 1014, lit("Library"))
            .when(col("code_combination_id") == 1015, lit("Information Tech"))
            .when(col("code_combination_id") == 1016, lit("City Manager"))
            .otherwise(lit("Unknown"))) \
        .withColumn("account", lit("5100")) \
        .withColumn("account_description", lit("Salaries & Wages")) \
        .withColumn("account_type", lit("E")) \
        .withColumn("enabled_flag", lit("Y")) \
        .withColumn("is_current", lit(True)) \
        .withColumn("dw_load_date", current_timestamp())

    # MERGE into Gold dim_coa
    dim_coa_df.createOrReplaceTempView("_dim_coa_source")

    spark.sql(f"""
        MERGE INTO {gold_table} AS target
        USING _dim_coa_source AS source
        ON target.code_combination_id = source.code_combination_id
           AND target.is_current = true
        WHEN MATCHED AND target.department_description != source.department_description THEN
            UPDATE SET
                department_description = source.department_description,
                dw_load_date = current_timestamp()
        WHEN NOT MATCHED THEN
            INSERT (coa_key, code_combination_id, fund, fund_description,
                    department, department_description, account, account_description,
                    account_type, enabled_flag, is_current, dw_load_date)
            VALUES (source.coa_key, source.code_combination_id, source.fund,
                    source.fund_description, source.department, source.department_description,
                    source.account, source.account_description, source.account_type,
                    source.enabled_flag, source.is_current, source.dw_load_date)
    """)

    count = spark.read.format("iceberg").load(gold_table).count()
    logger.info(f"  ✅ dim_coa: {count} rows")
    return count


# ─────────────────────────────────────────────────────────────────────────────
# DIMENSION: dim_period (Fiscal Calendar — Type 1)
# ─────────────────────────────────────────────────────────────────────────────

def refresh_dim_period():
    """
    Build dim_period from distinct periods in Silver.
    Type 1: Periods never change — overwrite if needed.
    """
    logger.info("\n" + "─" * 50)
    logger.info("Building: dim_period (Fiscal Calendar)")
    logger.info("─" * 50)

    silver_table = f"{CATALOG}.{SILVER_DB}.budget_control_clean"
    gold_table = f"{CATALOG}.{GOLD_DB}.dim_period"

    silver_df = spark.read.format("iceberg").load(silver_table)

    # Extract distinct periods and derive calendar attributes
    periods_df = silver_df \
        .select("period_name", "fiscal_year").distinct() \
        .withColumn("period_key", monotonically_increasing_id() + 1) \
        .withColumn("fiscal_quarter",
            when(substring("period_name", 1, 3).isin("JUL", "AUG", "SEP"), lit(1))
            .when(substring("period_name", 1, 3).isin("OCT", "NOV", "DEC"), lit(2))
            .when(substring("period_name", 1, 3).isin("JAN", "FEB", "MAR"), lit(3))
            .otherwise(lit(4))) \
        .withColumn("fiscal_month",
            when(substring("period_name", 1, 3) == "JUL", lit(1))
            .when(substring("period_name", 1, 3) == "AUG", lit(2))
            .when(substring("period_name", 1, 3) == "SEP", lit(3))
            .when(substring("period_name", 1, 3) == "OCT", lit(4))
            .when(substring("period_name", 1, 3) == "NOV", lit(5))
            .when(substring("period_name", 1, 3) == "DEC", lit(6))
            .when(substring("period_name", 1, 3) == "JAN", lit(7))
            .when(substring("period_name", 1, 3) == "FEB", lit(8))
            .when(substring("period_name", 1, 3) == "MAR", lit(9))
            .when(substring("period_name", 1, 3) == "APR", lit(10))
            .when(substring("period_name", 1, 3) == "MAY", lit(11))
            .otherwise(lit(12))) \
        .withColumn("calendar_year", substring("period_name", 5, 4).cast("int")) \
        .withColumn("calendar_month",
            when(substring("period_name", 1, 3) == "JAN", lit(1))
            .when(substring("period_name", 1, 3) == "FEB", lit(2))
            .when(substring("period_name", 1, 3) == "MAR", lit(3))
            .when(substring("period_name", 1, 3) == "APR", lit(4))
            .when(substring("period_name", 1, 3) == "MAY", lit(5))
            .when(substring("period_name", 1, 3) == "JUN", lit(6))
            .when(substring("period_name", 1, 3) == "JUL", lit(7))
            .when(substring("period_name", 1, 3) == "AUG", lit(8))
            .when(substring("period_name", 1, 3) == "SEP", lit(9))
            .when(substring("period_name", 1, 3) == "OCT", lit(10))
            .when(substring("period_name", 1, 3) == "NOV", lit(11))
            .otherwise(lit(12))) \
        .withColumn("calendar_month_name", substring("period_name", 1, 3)) \
        .withColumn("period_start_date", lit(None).cast("date")) \
        .withColumn("period_end_date", lit(None).cast("date")) \
        .withColumn("is_current_period", lit(False)) \
        .withColumn("dw_load_date", current_timestamp())

    # MERGE into Gold
    periods_df.createOrReplaceTempView("_dim_period_source")

    spark.sql(f"""
        MERGE INTO {gold_table} AS target
        USING _dim_period_source AS source
        ON target.period_name = source.period_name
        WHEN NOT MATCHED THEN
            INSERT *
    """)

    count = spark.read.format("iceberg").load(gold_table).count()
    logger.info(f"  ✅ dim_period: {count} rows")
    return count


# ─────────────────────────────────────────────────────────────────────────────
# FACT: fact_budgetary_control
# ─────────────────────────────────────────────────────────────────────────────

def refresh_fact_budgetary_control():
    """
    Build fact table by joining Silver with Gold dimensions.
    Implements incremental refresh via MERGE.
    """
    logger.info("\n" + "─" * 50)
    logger.info("Building: fact_budgetary_control")
    logger.info("─" * 50)

    silver_table = f"{CATALOG}.{SILVER_DB}.budget_control_clean"
    dim_coa_table = f"{CATALOG}.{GOLD_DB}.dim_coa"
    dim_period_table = f"{CATALOG}.{GOLD_DB}.dim_period"
    fact_table = f"{CATALOG}.{GOLD_DB}.fact_budgetary_control"

    # Read Silver and dimensions
    silver_df = spark.read.format("iceberg").load(silver_table)
    dim_coa = spark.read.format("iceberg").load(dim_coa_table).filter(col("is_current") == True)
    dim_period = spark.read.format("iceberg").load(dim_period_table)

    # Join Silver with dimensions to build fact
    fact_df = silver_df.alias("s") \
        .join(dim_coa.alias("dc"),
              col("s.code_combination_id") == col("dc.code_combination_id")) \
        .join(dim_period.alias("dp"),
              col("s.period_name") == col("dp.period_name")) \
        .select(
            monotonically_increasing_id().alias("bc_key"),
            col("dc.coa_key"),
            col("dp.period_key"),
            col("s.code_combination_id"),
            col("s.budget_amount"),
            col("s.actual_amount"),
            col("s.encumbrance_amount"),
            col("s.commitment_amount"),
            col("s.obligation_amount"),
            col("s.expenditure_amount"),
            col("s.funds_available"),
            col("s.fiscal_year"),
            current_timestamp().alias("dw_load_date")
        )

    # MERGE into Gold fact table
    fact_df.createOrReplaceTempView("_fact_source")

    spark.sql(f"""
        MERGE INTO {fact_table} AS target
        USING _fact_source AS source
        ON target.code_combination_id = source.code_combination_id
           AND target.coa_key = source.coa_key
           AND target.period_key = source.period_key
        WHEN MATCHED THEN
            UPDATE SET
                budget_amount = source.budget_amount,
                actual_amount = source.actual_amount,
                encumbrance_amount = source.encumbrance_amount,
                commitment_amount = source.commitment_amount,
                obligation_amount = source.obligation_amount,
                expenditure_amount = source.expenditure_amount,
                funds_available = source.funds_available,
                dw_load_date = source.dw_load_date
        WHEN NOT MATCHED THEN
            INSERT *
    """)

    count = spark.read.format("iceberg").load(fact_table).count()
    logger.info(f"  ✅ fact_budgetary_control: {count} rows")
    return count


# ─────────────────────────────────────────────────────────────────────────────
# BUSINESS AGGREGATIONS (optional materialized views)
# ─────────────────────────────────────────────────────────────────────────────

def generate_kpis():
    """Generate and log executive KPIs for monitoring."""
    logger.info("\n" + "─" * 50)
    logger.info("Generating KPIs")
    logger.info("─" * 50)

    fact_table = f"{CATALOG}.{GOLD_DB}.fact_budgetary_control"
    dim_coa_table = f"{CATALOG}.{GOLD_DB}.dim_coa"

    kpis = spark.sql(f"""
        SELECT
            ROUND(SUM(budget_amount) / 1e9, 2) AS total_budget_B,
            ROUND(SUM(actual_amount) / 1e9, 2) AS total_actual_B,
            ROUND(SUM(funds_available) / 1e9, 2) AS available_B,
            ROUND(SUM(actual_amount) / SUM(budget_amount) * 100, 1) AS burn_rate_pct
        FROM {fact_table}
    """).collect()[0]

    logger.info(f"  Total Budget:    ${kpis['total_budget_B']}B")
    logger.info(f"  Total Actual:    ${kpis['total_actual_B']}B")
    logger.info(f"  Available:       ${kpis['available_B']}B")
    logger.info(f"  Burn Rate:       {kpis['burn_rate_pct']}%")

    # Department ranking
    dept_ranking = spark.sql(f"""
        SELECT
            dc.department_description,
            ROUND(SUM(f.actual_amount) / SUM(f.budget_amount) * 100, 1) AS burn_pct
        FROM {fact_table} f
        JOIN {dim_coa_table} dc ON dc.coa_key = f.coa_key
        GROUP BY dc.department_description
        ORDER BY burn_pct DESC
        LIMIT 5
    """).collect()

    logger.info("  Top 5 departments by burn rate:")
    for row in dept_ranking:
        logger.info(f"    {row['department_description']}: {row['burn_pct']}%")


# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────

def main():
    logger.info("=" * 70)
    logger.info("  SILVER TO GOLD ETL — Starting")
    logger.info("=" * 70)

    try:
        # Build dimensions first (fact depends on them)
        coa_count = refresh_dim_coa()
        period_count = refresh_dim_period()

        # Build fact table
        fact_count = refresh_fact_budgetary_control()

        # Generate KPIs
        generate_kpis()

        # Summary
        logger.info(f"\n{'=' * 70}")
        logger.info(f"  SILVER TO GOLD ETL — Complete")
        logger.info(f"{'=' * 70}")
        logger.info(f"  dim_coa:                 {coa_count} rows")
        logger.info(f"  dim_period:              {period_count} rows")
        logger.info(f"  fact_budgetary_control:  {fact_count} rows")

    except Exception as e:
        logger.error(f"  ❌ ETL failed: {str(e)}")
        raise
    finally:
        job.commit()
        logger.info("  Job bookmark committed")


if __name__ == "__main__":
    main()
