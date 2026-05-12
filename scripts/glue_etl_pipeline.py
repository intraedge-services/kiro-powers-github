#!/usr/bin/env python3
"""
COS Financial Lakehouse — AWS Glue ETL Pipeline (PySpark + Iceberg)
Production-grade Bronze → Silver → Gold pipeline for AWS Glue.

Deploy as AWS Glue Job with:
  - Glue version: 4.0
  - Worker type: G.1X
  - Number of workers: 2
  - Job parameters:
      --INGESTION_DATE: 2025-05-08
      --BUCKET: cos-financial-lakehouse-demo

This script:
  1. Reads raw CSV from Bronze S3 path
  2. Deduplicates and enriches → writes to Silver Iceberg table
  3. Joins with dimensions → writes to Gold Iceberg fact table
  4. Logs metrics for monitoring
"""

import sys
from datetime import datetime
from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.window import Window
from pyspark.sql.types import *

# ─────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────

# For Glue, use: from awsglue.utils import getResolvedOptions
# args = getResolvedOptions(sys.argv, ['JOB_NAME', 'INGESTION_DATE', 'BUCKET'])

INGESTION_DATE = sys.argv[1] if len(sys.argv) > 1 else datetime.now().strftime("%Y-%m-%d")
BUCKET = "cos-financial-lakehouse-demo"
CATALOG = "glue_catalog"

# ─────────────────────────────────────────────────────────────────────
# SPARK SESSION
# ─────────────────────────────────────────────────────────────────────

spark = SparkSession.builder \
    .appName("COS-Lakehouse-ETL") \
    .config(f"spark.sql.catalog.{CATALOG}", "org.apache.iceberg.spark.SparkCatalog") \
    .config(f"spark.sql.catalog.{CATALOG}.warehouse", f"s3://{BUCKET}/") \
    .config(f"spark.sql.catalog.{CATALOG}.catalog-impl", "org.apache.iceberg.aws.glue.GlueCatalog") \
    .config(f"spark.sql.catalog.{CATALOG}.io-impl", "org.apache.iceberg.aws.s3.S3FileIO") \
    .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions") \
    .config("spark.sql.iceberg.handle-timestamp-without-timezone", "true") \
    .getOrCreate()

print(f"{'='*60}")
print(f"  COS Lakehouse ETL — {INGESTION_DATE}")
print(f"{'='*60}")


# ═══════════════════════════════════════════════════════════════════════
# STEP 1: BRONZE — Read raw CSV and append to Iceberg
# ═══════════════════════════════════════════════════════════════════════

print("\n[1/3] BRONZE: Ingesting raw data...")

# Read CSV from S3 landing zone
bronze_path = f"s3://{BUCKET}/bronze/budget_control/ingestion_date={INGESTION_DATE}/"

try:
    raw_df = spark.read \
        .option("header", "true") \
        .option("inferSchema", "true") \
        .csv(bronze_path)

    # Add ingestion metadata
    bronze_df = raw_df \
        .withColumn("bicc_extract_id", lit(f"BICC_{INGESTION_DATE.replace('-', '')}")) \
        .withColumn("ingestion_timestamp", current_timestamp()) \
        .withColumn("ingestion_date", lit(INGESTION_DATE))

    # Append to Bronze Iceberg table
    bronze_df.writeTo(f"{CATALOG}.cos_bronze.budget_control").append()

    bronze_count = bronze_df.count()
    print(f"  ✅ Bronze: {bronze_count} rows appended")

except Exception as e:
    print(f"  ⚠️  No new CSV found for {INGESTION_DATE}: {e}")
    print("  Using existing Bronze data for Silver/Gold refresh...")
    bronze_count = 0


# ═══════════════════════════════════════════════════════════════════════
# STEP 2: SILVER — Deduplicate + Enrich + MERGE
# ═══════════════════════════════════════════════════════════════════════

print("\n[2/3] SILVER: Dedup + Enrich + MERGE...")

# Read all Bronze data (or just today's for incremental)
bronze_full = spark.read.format("iceberg") \
    .load(f"{CATALOG}.cos_bronze.budget_control")

# Filter to today's ingestion for incremental processing
if bronze_count > 0:
    bronze_incremental = bronze_full.filter(col("ingestion_date") == INGESTION_DATE)
else:
    bronze_incremental = bronze_full

# Deduplicate: keep latest record per natural key
window = Window.partitionBy("code_combination_id", "period_name") \
    .orderBy(col("last_update_date").desc())

deduped = bronze_incremental \
    .withColumn("rn", row_number().over(window)) \
    .filter(col("rn") == 1) \
    .drop("rn")

# Enrich: derive fiscal year, calculate metrics
silver_df = deduped \
    .withColumn("expenditure_amount", col("actual_amount")) \
    .withColumn("funds_available",
        col("budget_amount") - col("actual_amount") - col("encumbrance_amount")) \
    .withColumn("fiscal_year",
        when(substring("period_name", 1, 3).isin("JUL","AUG","SEP","OCT","NOV","DEC"),
             substring("period_name", 5, 4).cast("int") + 1)
        .otherwise(substring("period_name", 5, 4).cast("int"))) \
    .withColumn("dw_insert_date", current_timestamp()) \
    .withColumn("dw_update_date", current_timestamp()) \
    .select(
        "code_combination_id", "period_name", "budget_amount", "actual_amount",
        "encumbrance_amount", "commitment_amount", "obligation_amount",
        "expenditure_amount", "funds_available", "last_update_date",
        "dw_insert_date", "dw_update_date", "fiscal_year"
    )

# MERGE into Silver Iceberg table
silver_df.createOrReplaceTempView("silver_source")

spark.sql(f"""
    MERGE INTO {CATALOG}.cos_silver.budget_control_clean AS target
    USING silver_source AS source
    ON target.code_combination_id = source.code_combination_id
       AND target.period_name = source.period_name

    WHEN MATCHED AND source.last_update_date > target.last_update_date THEN
        UPDATE SET
            budget_amount      = source.budget_amount,
            actual_amount      = source.actual_amount,
            encumbrance_amount = source.encumbrance_amount,
            commitment_amount  = source.commitment_amount,
            obligation_amount  = source.obligation_amount,
            expenditure_amount = source.expenditure_amount,
            funds_available    = source.funds_available,
            last_update_date   = source.last_update_date,
            dw_update_date     = current_timestamp()

    WHEN NOT MATCHED THEN INSERT *
""")

silver_count = spark.read.format("iceberg") \
    .load(f"{CATALOG}.cos_silver.budget_control_clean").count()
print(f"  ✅ Silver: {silver_count} total rows (after MERGE)")


# ═══════════════════════════════════════════════════════════════════════
# STEP 3: GOLD — Join with dimensions, load fact table
# ═══════════════════════════════════════════════════════════════════════

print("\n[3/3] GOLD: Star schema refresh...")

# Read Silver and dimensions
silver = spark.read.format("iceberg").load(f"{CATALOG}.cos_silver.budget_control_clean")
dim_coa = spark.read.format("iceberg").load(f"{CATALOG}.cos_gold.dim_coa")
dim_period = spark.read.format("iceberg").load(f"{CATALOG}.cos_gold.dim_period")

# Join Silver with dimensions
gold_df = silver.alias("s") \
    .join(dim_coa.filter(col("is_current") == True).alias("dc"),
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
        current_timestamp().alias("dw_load_date"),
        col("s.fiscal_year")
    )

# Overwrite Gold fact (full refresh for simplicity; use MERGE for incremental)
gold_df.writeTo(f"{CATALOG}.cos_gold.fact_budgetary_control") \
    .overwritePartitions()

gold_count = gold_df.count()
print(f"  ✅ Gold: {gold_count} fact rows loaded")


# ═══════════════════════════════════════════════════════════════════════
# METRICS & SUMMARY
# ═══════════════════════════════════════════════════════════════════════

print(f"\n{'='*60}")
print(f"  ETL COMPLETE — {INGESTION_DATE}")
print(f"{'='*60}")
print(f"  Bronze: {bronze_count} new rows ingested")
print(f"  Silver: {silver_count} total rows (deduplicated)")
print(f"  Gold:   {gold_count} fact rows (star schema)")
print(f"  Snapshots created: 3 (one per layer)")
print(f"{'='*60}\n")

# Verify with a sample query
print("  Sample query — Budget by Department:")
spark.sql(f"""
    SELECT
        dc.department_description,
        SUM(f.budget_amount) AS total_budget,
        SUM(f.actual_amount) AS total_actual,
        ROUND(SUM(f.actual_amount) / SUM(f.budget_amount) * 100, 1) AS burn_pct
    FROM {CATALOG}.cos_gold.fact_budgetary_control f
    JOIN {CATALOG}.cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
    GROUP BY dc.department_description
    ORDER BY total_budget DESC
    LIMIT 5
""").show(truncate=False)

spark.stop()
