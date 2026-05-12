# ═══════════════════════════════════════════════════════════════════════
# COS Financial Lakehouse — PySpark ETL Jobs
# End-to-end: Bronze → Silver → Gold with Iceberg
# ═══════════════════════════════════════════════════════════════════════

from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.window import Window
from pyspark.sql.types import *
from datetime import datetime, timedelta
import sys

# ─────────────────────────────────────────────────────────────────────
# SPARK SESSION WITH ICEBERG
# ─────────────────────────────────────────────────────────────────────

def create_spark_session():
    """Create Spark session with Iceberg + AWS Glue Catalog."""
    return SparkSession.builder \
        .appName("COS-Financial-Lakehouse") \
        .config("spark.sql.catalog.glue_catalog", "org.apache.iceberg.spark.SparkCatalog") \
        .config("spark.sql.catalog.glue_catalog.warehouse", "s3://cos-financial-lakehouse/") \
        .config("spark.sql.catalog.glue_catalog.catalog-impl", "org.apache.iceberg.aws.glue.GlueCatalog") \
        .config("spark.sql.catalog.glue_catalog.io-impl", "org.apache.iceberg.aws.s3.S3FileIO") \
        .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions") \
        .config("spark.sql.iceberg.handle-timestamp-without-timezone", "true") \
        .getOrCreate()


# ─────────────────────────────────────────────────────────────────────
# JOB 1: BRONZE INGESTION (Append-only)
# ─────────────────────────────────────────────────────────────────────

def ingest_bronze(spark, source_path, table_name, ingestion_date):
    """
    Append raw BICC extract to Bronze layer.
    No transformations — preserves exact Oracle output.
    """
    print(f"[Bronze] Ingesting {source_path} → {table_name}")

    # Read raw extract (CSV or Parquet from BICC)
    raw_df = spark.read \
        .option("header", "true") \
        .option("inferSchema", "true") \
        .csv(source_path)

    # Add ingestion metadata
    bronze_df = raw_df \
        .withColumn("bicc_extract_id", lit(f"BICC_{ingestion_date}")) \
        .withColumn("ingestion_timestamp", current_timestamp()) \
        .withColumn("ingestion_date", lit(ingestion_date))

    # Append to Iceberg table
    bronze_df.writeTo(f"glue_catalog.cos_bronze.{table_name}") \
        .append()

    count = bronze_df.count()
    print(f"[Bronze] ✓ Ingested {count} records into {table_name}")
    return count


# ─────────────────────────────────────────────────────────────────────
# JOB 2: SILVER MERGE (Dedup + Upsert)
# ─────────────────────────────────────────────────────────────────────

def merge_silver_budget_control(spark, ingestion_date):
    """
    MERGE Bronze → Silver for budget_control.
    SCD Type 1: Overwrite with latest values.
    Key: (code_combination_id, period_name)
    """
    print(f"[Silver] Merging budget_control for {ingestion_date}")

    # Read today's Bronze data
    bronze_df = spark.read.format("iceberg") \
        .load("glue_catalog.cos_bronze.budget_control") \
        .filter(col("ingestion_date") == ingestion_date)

    # Deduplicate: keep latest per natural key
    window = Window.partitionBy("code_combination_id", "period_name") \
        .orderBy(col("last_update_date").desc())

    deduped = bronze_df \
        .withColumn("rn", row_number().over(window)) \
        .filter(col("rn") == 1) \
        .drop("rn")

    # Add derived columns
    source = deduped \
        .withColumn("funds_available",
            col("budget_amount") - col("actual_amount") - col("encumbrance_amount")) \
        .withColumn("fiscal_year",
            when(substring("period_name", 1, 3).isin("JUL","AUG","SEP","OCT","NOV","DEC"),
                 substring("period_name", 5, 4).cast("int") + 1)
            .otherwise(substring("period_name", 5, 4).cast("int"))) \
        .withColumn("dw_update_date", current_timestamp())

    # Register as temp view for MERGE
    source.createOrReplaceTempView("budget_source")

    # Execute MERGE
    spark.sql("""
        MERGE INTO glue_catalog.cos_silver.budget_control_clean AS target
        USING budget_source AS source
        ON target.code_combination_id = source.code_combination_id
           AND target.period_name = source.period_name

        WHEN MATCHED AND source.last_update_date > target.last_update_date THEN
            UPDATE SET
                budget_amount      = source.budget_amount,
                actual_amount      = source.actual_amount,
                encumbrance_amount = source.encumbrance_amount,
                commitment_amount  = source.commitment_amount,
                obligation_amount  = source.obligation_amount,
                funds_available    = source.funds_available,
                last_update_date   = source.last_update_date,
                dw_update_date     = source.dw_update_date

        WHEN NOT MATCHED THEN
            INSERT (
                code_combination_id, period_name, budget_amount, actual_amount,
                encumbrance_amount, commitment_amount, obligation_amount,
                expenditure_amount, funds_available, last_update_date,
                dw_insert_date, dw_update_date, fiscal_year
            )
            VALUES (
                source.code_combination_id, source.period_name, source.budget_amount,
                source.actual_amount, source.encumbrance_amount, source.commitment_amount,
                source.obligation_amount, 0, source.funds_available,
                source.last_update_date, current_timestamp(), source.dw_update_date,
                source.fiscal_year
            )
    """)

    print(f"[Silver] ✓ budget_control merge complete")


def merge_silver_gl_balances(spark, ingestion_date):
    """MERGE Bronze → Silver for GL balances."""
    print(f"[Silver] Merging gl_balances for {ingestion_date}")

    bronze_df = spark.read.format("iceberg") \
        .load("glue_catalog.cos_bronze.gl_balances") \
        .filter(col("ingestion_date") == ingestion_date)

    window = Window.partitionBy("ledger_id", "code_combination_id", "period_name") \
        .orderBy(col("last_update_date").desc())

    source = bronze_df \
        .withColumn("rn", row_number().over(window)) \
        .filter(col("rn") == 1) \
        .drop("rn") \
        .withColumn("net_amount", col("period_net_dr") - col("period_net_cr")) \
        .withColumn("fiscal_year",
            when(substring("period_name", 1, 3).isin("JUL","AUG","SEP","OCT","NOV","DEC"),
                 substring("period_name", 5, 4).cast("int") + 1)
            .otherwise(substring("period_name", 5, 4).cast("int"))) \
        .withColumn("dw_update_date", current_timestamp())

    source.createOrReplaceTempView("gl_source")

    spark.sql("""
        MERGE INTO glue_catalog.cos_silver.gl_balances_clean AS target
        USING gl_source AS source
        ON target.ledger_id = source.ledger_id
           AND target.code_combination_id = source.code_combination_id
           AND target.period_name = source.period_name
        WHEN MATCHED AND source.last_update_date > target.last_update_date THEN
            UPDATE SET *
        WHEN NOT MATCHED THEN
            INSERT *
    """)

    print(f"[Silver] ✓ gl_balances merge complete")


# ─────────────────────────────────────────────────────────────────────
# JOB 3: GOLD LAYER REFRESH (Star Schema)
# ─────────────────────────────────────────────────────────────────────

def refresh_gold_fact_budgetary_control(spark):
    """Refresh Gold fact table from Silver."""
    print("[Gold] Refreshing fact_budgetary_control")

    spark.sql("""
        MERGE INTO glue_catalog.cos_gold.fact_budgetary_control AS target
        USING (
            SELECT
                dc.coa_key,
                dp.period_key,
                s.code_combination_id,
                s.budget_amount,
                s.actual_amount,
                s.encumbrance_amount,
                s.commitment_amount,
                s.obligation_amount,
                s.funds_available,
                s.fiscal_year
            FROM glue_catalog.cos_silver.budget_control_clean s
            JOIN glue_catalog.cos_gold.dim_coa dc
                ON dc.code_combination_id = s.code_combination_id
                AND dc.is_current = true
            JOIN glue_catalog.cos_gold.dim_period dp
                ON dp.period_name = s.period_name
            WHERE s.dw_update_date >= current_timestamp() - INTERVAL 1 DAY
        ) AS source
        ON target.coa_key = source.coa_key
           AND target.period_key = source.period_key

        WHEN MATCHED THEN UPDATE SET
            budget_amount      = source.budget_amount,
            actual_amount      = source.actual_amount,
            encumbrance_amount = source.encumbrance_amount,
            commitment_amount  = source.commitment_amount,
            obligation_amount  = source.obligation_amount,
            funds_available    = source.funds_available,
            dw_load_date       = current_timestamp()

        WHEN NOT MATCHED THEN INSERT (
            coa_key, period_key, code_combination_id,
            budget_amount, actual_amount, encumbrance_amount,
            commitment_amount, obligation_amount, funds_available,
            fiscal_year, dw_load_date
        ) VALUES (
            source.coa_key, source.period_key, source.code_combination_id,
            source.budget_amount, source.actual_amount, source.encumbrance_amount,
            source.commitment_amount, source.obligation_amount, source.funds_available,
            source.fiscal_year, current_timestamp()
        )
    """)

    print("[Gold] ✓ fact_budgetary_control refresh complete")


# ─────────────────────────────────────────────────────────────────────
# JOB 4: ICEBERG MAINTENANCE
# ─────────────────────────────────────────────────────────────────────

def run_maintenance(spark):
    """Run all Iceberg maintenance operations."""
    print("[Maintenance] Starting Iceberg maintenance")

    tables = [
        "glue_catalog.cos_gold.fact_budgetary_control",
        "glue_catalog.cos_gold.fact_gl_actuals",
        "glue_catalog.cos_gold.fact_ap_invoices",
        "glue_catalog.cos_gold.fact_purchase_orders"
    ]

    expire_ts = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")

    for table in tables:
        print(f"  Maintaining: {table}")

        # Expire old snapshots
        spark.sql(f"""
            CALL glue_catalog.system.expire_snapshots(
                table => '{table}',
                older_than => TIMESTAMP '{expire_ts}',
                retain_last => 3
            )
        """)
        print(f"    ✓ Snapshots expired")

        # Compact small files
        spark.sql(f"""
            CALL glue_catalog.system.rewrite_data_files(
                table => '{table}',
                strategy => 'binpack',
                options => map(
                    'target-file-size-bytes', '268435456',
                    'min-file-size-bytes', '67108864'
                )
            )
        """)
        print(f"    ✓ Files compacted")

        # Remove orphan files
        orphan_ts = (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d %H:%M:%S")
        spark.sql(f"""
            CALL glue_catalog.system.remove_orphan_files(
                table => '{table}',
                older_than => TIMESTAMP '{orphan_ts}'
            )
        """)
        print(f"    ✓ Orphans removed")

        # Rewrite manifests
        spark.sql(f"""
            CALL glue_catalog.system.rewrite_manifests('{table}')
        """)
        print(f"    ✓ Manifests rewritten")

    print("[Maintenance] ✓ All maintenance complete")


# ─────────────────────────────────────────────────────────────────────
# JOB 5: TIME TRAVEL DEMO
# ─────────────────────────────────────────────────────────────────────

def demo_time_travel(spark):
    """Demonstrate Iceberg time travel capabilities."""
    print("\n[Demo] Time Travel Demonstration")
    print("=" * 60)

    # List snapshots
    snapshots = spark.sql("""
        SELECT snapshot_id, committed_at, operation,
               summary['added-records'] AS added,
               summary['total-records'] AS total
        FROM glue_catalog.cos_gold.fact_budgetary_control.snapshots
        ORDER BY committed_at DESC
        LIMIT 5
    """)
    print("\nAvailable Snapshots:")
    snapshots.show(truncate=False)

    # Get two snapshot IDs for comparison
    snapshot_rows = snapshots.collect()
    if len(snapshot_rows) >= 2:
        current_id = snapshot_rows[0]['snapshot_id']
        previous_id = snapshot_rows[1]['snapshot_id']

        print(f"\nComparing snapshot {previous_id} (before) vs {current_id} (after):")

        # Query at previous snapshot
        spark.sql(f"""
            SELECT
                SUM(budget_amount) AS total_budget,
                SUM(actual_amount) AS total_actual,
                SUM(funds_available) AS total_available
            FROM glue_catalog.cos_gold.fact_budgetary_control
            VERSION AS OF {previous_id}
        """).show()

        # Query at current snapshot
        spark.sql("""
            SELECT
                SUM(budget_amount) AS total_budget,
                SUM(actual_amount) AS total_actual,
                SUM(funds_available) AS total_available
            FROM glue_catalog.cos_gold.fact_budgetary_control
        """).show()

    print("[Demo] ✓ Time travel demo complete")


# ─────────────────────────────────────────────────────────────────────
# MAIN ORCHESTRATOR
# ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    spark = create_spark_session()
    ingestion_date = datetime.now().strftime("%Y-%m-%d")

    print(f"\n{'='*60}")
    print(f"  COS Financial Lakehouse — Daily Pipeline")
    print(f"  Date: {ingestion_date}")
    print(f"{'='*60}\n")

    # Bronze: Ingest raw data
    ingest_bronze(spark, "s3://cos-bicc-landing/budget_control/", "budget_control", ingestion_date)
    ingest_bronze(spark, "s3://cos-bicc-landing/gl_balances/", "gl_balances", ingestion_date)

    # Silver: Merge/Upsert
    merge_silver_budget_control(spark, ingestion_date)
    merge_silver_gl_balances(spark, ingestion_date)

    # Gold: Refresh star schema
    refresh_gold_fact_budgetary_control(spark)

    # Maintenance (run if scheduled)
    if "--maintenance" in sys.argv:
        run_maintenance(spark)

    # Demo (run if requested)
    if "--demo" in sys.argv:
        demo_time_travel(spark)

    print(f"\n{'='*60}")
    print(f"  Pipeline complete ✓")
    print(f"{'='*60}\n")

    spark.stop()
