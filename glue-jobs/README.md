# AWS Glue ETL Jobs — COS Financial Lakehouse

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     AWS GLUE ETL WORKFLOW                                 │
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  │  UCM / S3    │     │   BRONZE     │     │   SILVER     │            │
│  │  Landing     │────▶│  Iceberg     │────▶│  Iceberg     │            │
│  │  (CSV)       │     │  (Raw)       │     │  (Clean)     │            │
│  └──────────────┘     └──────────────┘     └──────────────┘            │
│        │                     │                     │                     │
│        │ UCM_to_Bronze_ETL   │ Bronze_to_Silver    │ Silver_to_Gold     │
│        │ (validate+append)   │ (dedup+MERGE)       │ (dim+fact MERGE)   │
│        │                     │                     │                     │
│        ▼                     ▼                     ▼                     │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  │ QUARANTINE   │     │  Iceberg     │     │    GOLD      │            │
│  │ (bad records)│     │  Snapshots   │     │  Star Schema │            │
│  └──────────────┘     └──────────────┘     └──────────────┘            │
│                                                    │                     │
│                                                    ▼                     │
│                                             ┌──────────────┐            │
│                                             │   ATHENA     │            │
│                                             │  + Power BI  │            │
│                                             └──────────────┘            │
└─────────────────────────────────────────────────────────────────────────┘
```

## Jobs

| Job | Input | Output | Pattern |
|---|---|---|---|
| `ucm_to_bronze_etl.py` | S3 landing CSVs | Bronze Iceberg tables | Validate → Quarantine → Append |
| `bronze_to_silver_etl.py` | Bronze Iceberg | Silver Iceberg | Dedup → Cleanse → MERGE INTO |
| `silver_to_gold_etl.py` | Silver Iceberg | Gold Iceberg | Dim build → Fact MERGE → KPIs |

## Deployment Steps

### 1. Upload scripts to S3

```bash
aws s3 cp glue-jobs/ucm_to_bronze_etl.py s3://cos-financial-lakehouse-demo/glue-scripts/
aws s3 cp glue-jobs/bronze_to_silver_etl.py s3://cos-financial-lakehouse-demo/glue-scripts/
aws s3 cp glue-jobs/silver_to_gold_etl.py s3://cos-financial-lakehouse-demo/glue-scripts/
```

### 2. Create Glue Jobs via AWS CLI

```bash
# Job 1: UCM to Bronze
aws glue create-job \
  --name "COS-UCM-to-Bronze-ETL" \
  --role "cos-financial-lakehouse-glue-etl-role" \
  --command '{
    "Name": "glueetl",
    "ScriptLocation": "s3://cos-financial-lakehouse-demo/glue-scripts/ucm_to_bronze_etl.py",
    "PythonVersion": "3"
  }' \
  --glue-version "4.0" \
  --number-of-workers 2 \
  --worker-type "G.1X" \
  --default-arguments '{
    "--LANDING_PATH": "s3://cos-financial-lakehouse-demo/landing/",
    "--BRONZE_PATH": "s3://cos-financial-lakehouse-demo/bronze/",
    "--QUARANTINE_PATH": "s3://cos-financial-lakehouse-demo/quarantine/",
    "--CATALOG": "glue_catalog",
    "--DATABASE": "cos_bronze",
    "--enable-job-bookmarks": "true",
    "--datalake-formats": "iceberg",
    "--conf": "spark.sql.extensions=org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions"
  }'

# Job 2: Bronze to Silver
aws glue create-job \
  --name "COS-Bronze-to-Silver-ETL" \
  --role "cos-financial-lakehouse-glue-etl-role" \
  --command '{
    "Name": "glueetl",
    "ScriptLocation": "s3://cos-financial-lakehouse-demo/glue-scripts/bronze_to_silver_etl.py",
    "PythonVersion": "3"
  }' \
  --glue-version "4.0" \
  --number-of-workers 2 \
  --worker-type "G.1X" \
  --default-arguments '{
    "--CATALOG": "glue_catalog",
    "--BRONZE_DB": "cos_bronze",
    "--SILVER_DB": "cos_silver",
    "--enable-job-bookmarks": "true",
    "--datalake-formats": "iceberg",
    "--conf": "spark.sql.extensions=org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions"
  }'

# Job 3: Silver to Gold
aws glue create-job \
  --name "COS-Silver-to-Gold-ETL" \
  --role "cos-financial-lakehouse-glue-etl-role" \
  --command '{
    "Name": "glueetl",
    "ScriptLocation": "s3://cos-financial-lakehouse-demo/glue-scripts/silver_to_gold_etl.py",
    "PythonVersion": "3"
  }' \
  --glue-version "4.0" \
  --number-of-workers 2 \
  --worker-type "G.1X" \
  --default-arguments '{
    "--CATALOG": "glue_catalog",
    "--SILVER_DB": "cos_silver",
    "--GOLD_DB": "cos_gold",
    "--enable-job-bookmarks": "true",
    "--datalake-formats": "iceberg",
    "--conf": "spark.sql.extensions=org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions"
  }'
```

### 3. Create Workflow (orchestration)

```bash
aws glue create-workflow --name "COS-Lakehouse-Pipeline"

# Add triggers
aws glue create-trigger \
  --name "Start-Bronze-Load" \
  --type SCHEDULED \
  --schedule "cron(0 6 * * ? *)" \
  --workflow-name "COS-Lakehouse-Pipeline" \
  --actions '[{"JobName": "COS-UCM-to-Bronze-ETL"}]'

aws glue create-trigger \
  --name "Bronze-Complete-Start-Silver" \
  --type CONDITIONAL \
  --workflow-name "COS-Lakehouse-Pipeline" \
  --predicate '{"Conditions": [{"LogicalOperator": "EQUALS", "JobName": "COS-UCM-to-Bronze-ETL", "State": "SUCCEEDED"}]}' \
  --actions '[{"JobName": "COS-Bronze-to-Silver-ETL"}]'

aws glue create-trigger \
  --name "Silver-Complete-Start-Gold" \
  --type CONDITIONAL \
  --workflow-name "COS-Lakehouse-Pipeline" \
  --predicate '{"Conditions": [{"LogicalOperator": "EQUALS", "JobName": "COS-Bronze-to-Silver-ETL", "State": "SUCCEEDED"}]}' \
  --actions '[{"JobName": "COS-Silver-to-Gold-ETL"}]'
```

### 4. Run manually (for testing)

```bash
aws glue start-job-run --job-name "COS-UCM-to-Bronze-ETL"
aws glue start-job-run --job-name "COS-Bronze-to-Silver-ETL"
aws glue start-job-run --job-name "COS-Silver-to-Gold-ETL"
```

## IAM Role Requirements

The Glue ETL role (`cos-financial-lakehouse-glue-etl-role`) needs:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject", "s3:ListBucket"],
      "Resource": ["arn:aws:s3:::cos-financial-lakehouse-demo", "arn:aws:s3:::cos-financial-lakehouse-demo/*"]
    },
    {
      "Effect": "Allow",
      "Action": ["glue:*Database*", "glue:*Table*", "glue:*Partition*"],
      "Resource": ["*"]
    },
    {
      "Effect": "Allow",
      "Action": ["logs:*"],
      "Resource": ["arn:aws:logs:*:*:*"]
    }
  ]
}
```

Plus the managed policy: `AWSGlueServiceRole`

## Key Design Decisions

| Decision | Rationale |
|---|---|
| MERGE INTO (not overwrite) | Supports incremental CDC; only updates changed records |
| Job bookmarks enabled | Prevents reprocessing already-ingested files |
| Quarantine zone | Bad records don't block pipeline; available for investigation |
| SCD Type 2 for dim_coa | Department names/structures change over fiscal years |
| Partitioned by fiscal_year | Matches Power BI query patterns; enables partition pruning |
| `--datalake-formats iceberg` | Required Glue 4.0 flag for Iceberg support |
| Separate jobs (not one monolith) | Independent retry, monitoring, and scaling per layer |
