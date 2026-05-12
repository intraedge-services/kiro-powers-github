# COS Unified Financial Lakehouse

## Architecture

```
Oracle Fusion 25D (PVOs)
    │
    ▼ BICC Extract
┌─────────────────────────────────────────────────────┐
│  AWS S3 + Apache Iceberg (Medallion Architecture)    │
│                                                      │
│  BRONZE ──────▶ SILVER ──────▶ GOLD                 │
│  (Raw BICC)    (Clean/Dedup)   (Star Schema)        │
│  108 rows      108 rows        108 fact + dims      │
└─────────────────────────────────────────────────────┘
    │
    ▼ Athena Engine v3
┌─────────────────────────────────────────────────────┐
│  Analytics: Budget vs Actual, Dept Ranking,          │
│  Funds Available, Time Travel, Snapshots             │
└─────────────────────────────────────────────────────┘
    │
    ▼ ODBC DirectQuery
┌─────────────────────────────────────────────────────┐
│  Power BI Executive Dashboard                        │
└─────────────────────────────────────────────────────┘
```

## Quick Start

### Step 1: Infrastructure (one-time)
```bash
cd infrastructure
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your tag_owner
terraform init && terraform apply
```

### Step 2: Data Pipeline (CloudShell or local)
```bash
./unified/deploy.sh
```

That's it. All 3 layers populated with 108+ queryable records.

### Step 3: AI-DLC Issue Tracking (optional)
```bash
export GITHUB_TOKEN=your_token
node dist/demo.js -- sample-stories/cos-unified-project.md
```

## What Gets Created

| Layer | Table | Rows | Description |
|---|---|---|---|
| Bronze | budget_control | 108 | Raw Oracle Fusion BICC extract |
| Silver | budget_control_clean | 108 | Deduplicated, fiscal year derived |
| Gold | dim_coa | 10 | Chart of Accounts (9 depts, 5 funds) |
| Gold | dim_period | 12 | FY2025 fiscal calendar |
| Gold | dim_supplier | 5 | Vendor master |
| Gold | fact_budgetary_control | 108 | Star schema fact (joined) |

## SQL Files (run in order)

| File | Purpose |
|---|---|
| `sql/01_create_tables.sql` | Athena-native Iceberg DDL |
| `sql/02_load_bronze.sql` | 108 rows raw financial data |
| `sql/03_bronze_to_silver.sql` | Dedup + enrich + fiscal year |
| `sql/04_silver_to_gold.sql` | Dimensions + fact table |
| `sql/05_validate.sql` | 10 analytics queries |

## Key Fixes (from previous issues)

- ✅ Only `'table_type' = 'ICEBERG'` in TBLPROPERTIES (no Spark properties)
- ✅ All numeric columns use `double` (no decimal type mismatch)
- ✅ All string columns use `string` (no varchar)
- ✅ AWS CLI execution (no boto3 credential issues)
- ✅ Data automatically loaded into Iceberg tables (not just S3)
- ✅ 108 rows across 9 departments × 12 months
