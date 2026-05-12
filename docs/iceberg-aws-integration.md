# AWS Integration — Iceberg on AWS for COS Lakehouse

## Architecture: Query Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         QUERY FLOW                                        │
│                                                                          │
│  ┌──────────┐     ┌──────────────┐     ┌──────────────┐                │
│  │ POWER BI │────▶│   ATHENA     │────▶│  GLUE CATALOG│                │
│  │(ODBC/    │     │  (Query      │     │  (metadata   │                │
│  │ Direct)  │     │   Engine)    │     │   location)  │                │
│  └──────────┘     └──────┬───────┘     └──────┬───────┘                │
│                          │                     │                         │
│                          │  ┌──────────────────┘                         │
│                          │  │ Read metadata.json                         │
│                          │  ▼                                            │
│                          │  ┌──────────────┐                             │
│                          │  │ S3: metadata │                             │
│                          │  │ (JSON + Avro)│                             │
│                          │  └──────┬───────┘                             │
│                          │         │ Manifest pruning                    │
│                          │         ▼                                     │
│                          │  ┌──────────────┐                             │
│                          └─▶│ S3: data     │                             │
│                             │ (Parquet)    │                             │
│                             └──────────────┘                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 1. AWS Glue Catalog Setup

### Create Databases

```sql
-- Via Athena or AWS CLI
CREATE DATABASE IF NOT EXISTS cos_bronze
LOCATION 's3://cos-financial-lakehouse/bronze/';

CREATE DATABASE IF NOT EXISTS cos_silver
LOCATION 's3://cos-financial-lakehouse/silver/';

CREATE DATABASE IF NOT EXISTS cos_gold
LOCATION 's3://cos-financial-lakehouse/gold/';
```

### Register Iceberg Tables in Glue

```sql
-- Athena CREATE TABLE with Iceberg
CREATE TABLE cos_gold.fact_budgetary_control (
    bc_key              BIGINT,
    coa_key             BIGINT,
    period_key          BIGINT,
    code_combination_id BIGINT,
    budget_amount       DECIMAL(18,2),
    actual_amount       DECIMAL(18,2),
    encumbrance_amount  DECIMAL(18,2),
    funds_available     DECIMAL(18,2),
    dw_load_date        TIMESTAMP
)
PARTITIONED BY (fiscal_year INT)
LOCATION 's3://cos-financial-lakehouse/gold/fact_budgetary_control/'
TBLPROPERTIES (
    'table_type' = 'ICEBERG',
    'format-version' = '2',
    'write.format.default' = 'parquet',
    'write.parquet.compression-codec' = 'zstd'
);
```

### Glue Catalog Properties (via AWS CLI)

```bash
# Register existing Iceberg table in Glue
aws glue create-table \
  --database-name cos_gold \
  --table-input '{
    "Name": "fact_budgetary_control",
    "StorageDescriptor": {
      "Location": "s3://cos-financial-lakehouse/gold/fact_budgetary_control/",
      "InputFormat": "org.apache.iceberg.mr.hive.HiveIcebergInputFormat",
      "OutputFormat": "org.apache.iceberg.mr.hive.HiveIcebergOutputFormat",
      "SerdeInfo": {
        "SerializationLibrary": "org.apache.iceberg.mr.hive.HiveIcebergSerDe"
      }
    },
    "TableType": "EXTERNAL_TABLE",
    "Parameters": {
      "table_type": "ICEBERG",
      "metadata_location": "s3://cos-financial-lakehouse/gold/fact_budgetary_control/metadata/v1.metadata.json"
    }
  }'
```

---

## 2. Athena Querying

### Basic Queries

```sql
-- Standard SQL — Athena handles Iceberg transparently
SELECT
    dc.department_description,
    SUM(f.budget_amount) AS total_budget,
    SUM(f.actual_amount) AS total_actual,
    SUM(f.funds_available) AS available
FROM cos_gold.fact_budgetary_control f
JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
WHERE f.fiscal_year = 2025
GROUP BY dc.department_description
ORDER BY total_budget DESC;
```

### Time Travel via Athena

```sql
-- Query at specific timestamp
SELECT * FROM cos_gold.fact_budgetary_control
FOR TIMESTAMP AS OF TIMESTAMP '2025-05-01 00:00:00';

-- Query at specific snapshot
SELECT * FROM cos_gold.fact_budgetary_control
FOR VERSION AS OF 7891234567;
```

### MERGE via Athena (Iceberg v2)

```sql
-- Athena supports MERGE INTO for Iceberg v2 tables
MERGE INTO cos_gold.fact_budgetary_control AS target
USING cos_silver.budget_control_clean AS source
ON target.code_combination_id = source.code_combination_id
   AND target.period_key = source.period_key
WHEN MATCHED THEN UPDATE SET
    budget_amount = source.budget_amount,
    actual_amount = source.actual_amount
WHEN NOT MATCHED THEN INSERT VALUES (...);
```

---

## 3. AWS Glue ETL Jobs (PySpark)

### Bronze → Silver Job

```python
# glue_job_bronze_to_silver.py
import sys
from awsglue.transforms import *
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from awsglue.context import GlueContext
from pyspark.sql import SparkSession
from pyspark.sql.functions import *
from pyspark.sql.window import Window

args = getResolvedOptions(sys.argv, ['JOB_NAME', 'INGESTION_DATE'])

spark = SparkSession.builder \
    .config("spark.sql.catalog.glue_catalog", "org.apache.iceberg.spark.SparkCatalog") \
    .config("spark.sql.catalog.glue_catalog.warehouse", "s3://cos-financial-lakehouse/") \
    .config("spark.sql.catalog.glue_catalog.catalog-impl", "org.apache.iceberg.aws.glue.GlueCatalog") \
    .config("spark.sql.catalog.glue_catalog.io-impl", "org.apache.iceberg.aws.s3.S3FileIO") \
    .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions") \
    .getOrCreate()

ingestion_date = args['INGESTION_DATE']

# Read from Bronze
bronze_df = spark.read \
    .format("iceberg") \
    .load("glue_catalog.cos_bronze.budget_control") \
    .filter(col("ingestion_date") == ingestion_date)

# Deduplicate: keep latest per key
window = Window.partitionBy("code_combination_id", "period_name") \
    .orderBy(col("last_update_date").desc())

deduped_df = bronze_df \
    .withColumn("rn", row_number().over(window)) \
    .filter(col("rn") == 1) \
    .drop("rn")

# Add derived columns
silver_df = deduped_df \
    .withColumn("funds_available",
        col("budget_amount") - col("actual_amount") - col("encumbrance_amount")) \
    .withColumn("fiscal_year",
        when(substring("period_name", 1, 3).isin("JUL","AUG","SEP","OCT","NOV","DEC"),
             substring("period_name", 5, 4).cast("int") + 1)
        .otherwise(substring("period_name", 5, 4).cast("int"))) \
    .withColumn("dw_update_date", current_timestamp())

# MERGE into Silver (Iceberg)
silver_df.createOrReplaceTempView("source_data")

spark.sql("""
    MERGE INTO glue_catalog.cos_silver.budget_control_clean AS target
    USING source_data AS source
    ON target.code_combination_id = source.code_combination_id
       AND target.period_name = source.period_name
    WHEN MATCHED AND source.last_update_date > target.last_update_date THEN
        UPDATE SET *
    WHEN NOT MATCHED THEN
        INSERT *
""")

print(f"Silver merge complete for {ingestion_date}")
```

### Maintenance Job

```python
# glue_job_iceberg_maintenance.py
import sys
from pyspark.sql import SparkSession
from datetime import datetime, timedelta

spark = SparkSession.builder \
    .config("spark.sql.catalog.glue_catalog", "org.apache.iceberg.spark.SparkCatalog") \
    .config("spark.sql.catalog.glue_catalog.catalog-impl", "org.apache.iceberg.aws.glue.GlueCatalog") \
    .config("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions") \
    .getOrCreate()

tables = [
    "glue_catalog.cos_gold.fact_budgetary_control",
    "glue_catalog.cos_gold.fact_gl_actuals",
    "glue_catalog.cos_gold.fact_ap_invoices",
    "glue_catalog.cos_gold.fact_purchase_orders"
]

expire_before = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")

for table in tables:
    print(f"Maintaining: {table}")

    # Expire old snapshots
    spark.sql(f"""
        CALL glue_catalog.system.expire_snapshots(
            table => '{table}',
            older_than => TIMESTAMP '{expire_before}',
            retain_last => 3
        )
    """)

    # Compact small files
    spark.sql(f"""
        CALL glue_catalog.system.rewrite_data_files(
            table => '{table}',
            strategy => 'binpack',
            options => map('target-file-size-bytes', '268435456')
        )
    """)

    # Rewrite manifests
    spark.sql(f"""
        CALL glue_catalog.system.rewrite_manifests('{table}')
    """)

    print(f"  ✓ {table} maintenance complete")

print("All maintenance complete")
```

---

## 4. Redshift Spectrum Integration

```sql
-- Create external schema pointing to Glue Catalog
CREATE EXTERNAL SCHEMA cos_gold_spectrum
FROM DATA CATALOG
DATABASE 'cos_gold'
IAM_ROLE 'arn:aws:iam::123456789:role/RedshiftSpectrumRole'
CREATE EXTERNAL DATABASE IF NOT EXISTS;

-- Query Iceberg tables via Spectrum
SELECT
    dc.department_description,
    SUM(f.budget_amount) AS budget,
    SUM(f.actual_amount) AS actual
FROM cos_gold_spectrum.fact_budgetary_control f
JOIN cos_gold_spectrum.dim_coa dc ON dc.coa_key = f.coa_key
GROUP BY dc.department_description;
```

---

## 5. Lake Formation Security

```
┌─────────────────────────────────────────────────────────────┐
│                  LAKE FORMATION PERMISSIONS                   │
│                                                              │
│  Role: cos-data-engineer                                     │
│  ├── cos_bronze: ALL (read/write/create)                     │
│  ├── cos_silver: ALL (read/write/create)                     │
│  └── cos_gold:   ALL (read/write/create)                     │
│                                                              │
│  Role: cos-analyst                                           │
│  ├── cos_bronze: DENIED                                      │
│  ├── cos_silver: SELECT only                                 │
│  └── cos_gold:   SELECT only                                 │
│                                                              │
│  Role: cos-powerbi-service                                   │
│  ├── cos_bronze: DENIED                                      │
│  ├── cos_silver: DENIED                                      │
│  └── cos_gold:   SELECT only (specific tables)               │
│                                                              │
│  Column-Level Security:                                      │
│  └── dim_supplier.payment_terms: DENIED for cos-analyst      │
└─────────────────────────────────────────────────────────────┘
```

```bash
# Grant Lake Formation permissions
aws lakeformation grant-permissions \
  --principal '{"DataLakePrincipalIdentifier": "arn:aws:iam::123456789:role/cos-powerbi-service"}' \
  --resource '{"Table": {"DatabaseName": "cos_gold", "Name": "fact_budgetary_control"}}' \
  --permissions '["SELECT"]'
```

---

## 6. EMR / Spark Integration

```bash
# Launch EMR cluster with Iceberg support
aws emr create-cluster \
  --name "COS-Iceberg-Processing" \
  --release-label emr-6.15.0 \
  --applications Name=Spark Name=Hive \
  --configurations '[
    {
      "Classification": "spark-defaults",
      "Properties": {
        "spark.sql.catalog.glue_catalog": "org.apache.iceberg.spark.SparkCatalog",
        "spark.sql.catalog.glue_catalog.catalog-impl": "org.apache.iceberg.aws.glue.GlueCatalog",
        "spark.sql.catalog.glue_catalog.warehouse": "s3://cos-financial-lakehouse/",
        "spark.sql.extensions": "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions",
        "spark.jars.packages": "org.apache.iceberg:iceberg-spark-runtime-3.4_2.12:1.5.0"
      }
    }
  ]' \
  --instance-type m5.xlarge \
  --instance-count 3
```
