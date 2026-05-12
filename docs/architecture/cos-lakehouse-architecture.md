# COS Financial Lakehouse — Enterprise Architecture

## 1. High-Level Executive Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                              │
│                    COS FINANCIAL LAKEHOUSE — EXECUTIVE VIEW                                   │
│                                                                                              │
│  ┌───────────────┐         ┌─────────────────────────────────────────────┐                  │
│  │               │         │              AWS CLOUD                       │                  │
│  │  ORACLE       │         │                                              │                  │
│  │  FUSION       │  BICC   │   ┌─────────┐   ┌─────────┐   ┌─────────┐ │   ┌───────────┐  │
│  │  ERP          │────────▶│   │ BRONZE  │──▶│ SILVER  │──▶│  GOLD   │ │──▶│  ATHENA   │  │
│  │               │         │   │ (Raw)   │   │ (Clean) │   │ (Star)  │ │   │ Analytics │  │
│  │  $2.1B Budget │         │   └─────────┘   └─────────┘   └─────────┘ │   └─────┬─────┘  │
│  │  GL, AP, PO   │         │                                              │         │        │
│  └───────────────┘         │         Apache Iceberg on S3                 │         ▼        │
│                             └─────────────────────────────────────────────┘   ┌───────────┐  │
│                                                                               │ POWER BI  │  │
│                                                                               │ Dashboard │  │
│                                                                               └───────────┘  │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

**Key Message for Executives:**
Oracle Fusion financial data flows automatically through three quality layers into a reporting-ready star schema. Athena provides instant SQL analytics. Power BI delivers executive dashboards. All built on open-standard Apache Iceberg — no vendor lock-in.

---

## 2. Detailed Technical Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                           │
│  ╔═══════════════╗                                                                                       │
│  ║  SOURCE       ║                                                                                       │
│  ╠═══════════════╣                                                                                       │
│  ║               ║                                                                                       │
│  ║ Oracle Fusion ║                                                                                       │
│  ║ Cloud 25D     ║                                                                                       │
│  ║               ║                                                                                       │
│  ║ ┌───────────┐ ║         ┌──────────────────────────────────────────────────────────────────────────┐  │
│  ║ │ BICC      │ ║         │                    AWS ACCOUNT (160357565307)                             │  │
│  ║ │ Extracts  │─╫────────▶│                                                                          │  │
│  ║ │ (PVOs)    │ ║   CSV   │  ┌────────────────────────────────────────────────────────────────────┐  │  │
│  ║ └───────────┘ ║         │  │              AMAZON S3 (cos-financial-lakehouse-demo)               │  │  │
│  ║               ║         │  │                                                                     │  │  │
│  ║ ┌───────────┐ ║         │  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐           │  │  │
│  ║ │ UCM       │ ║         │  │  │   /landing/  │   │   /bronze/   │   │   /silver/   │           │  │  │
│  ║ │ Staging   │─╫────────▶│  │  │   (CSV raw)  │   │  (Iceberg)   │   │  (Iceberg)   │           │  │  │
│  ║ └───────────┘ ║         │  │  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘           │  │  │
│  ║               ║         │  │         │                   │                   │                   │  │  │
│  ╚═══════════════╝         │  │         │                   │                   │                   │  │  │
│                             │  │         │    ┌──────────────┐    ┌──────────────┐                   │  │  │
│                             │  │         │    │   /gold/     │    │ /quarantine/ │                   │  │  │
│                             │  │         │    │  (Iceberg)   │    │ (bad records)│                   │  │  │
│                             │  │         │    └──────┬───────┘    └──────────────┘                   │  │  │
│                             │  │         │           │                                               │  │  │
│                             │  └─────────┼───────────┼───────────────────────────────────────────────┘  │  │
│                             │            │           │                                                   │  │
│  ╔═══════════════════════════════════════╪═══════════╪═══════════════════════════════════════════════╗   │  │
│  ║           AWS GLUE ETL LAYER          │           │                                              ║   │  │
│  ╠═══════════════════════════════════════╪═══════════╪══════════════════════════════════════════════╣   │  │
│  ║                                       │           │                                              ║   │  │
│  ║  ┌─────────────────────────────────┐  │           │                                              ║   │  │
│  ║  │    🔄 COS-Lakehouse-Pipeline    │  │           │                                              ║   │  │
│  ║  │    (AWS Glue Workflow)          │  │           │                                              ║   │  │
│  ║  └─────────────────────────────────┘  │           │                                              ║   │  │
│  ║           │                            │           │                                              ║   │  │
│  ║           ▼                            │           │                                              ║   │  │
│  ║  ┌─────────────────┐                  │           │                                              ║   │  │
│  ║  │ ⏰ TRIGGER:     │                  │           │                                              ║   │  │
│  ║  │ Daily 6 AM UTC  │                  │           │                                              ║   │  │
│  ║  └────────┬────────┘                  │           │                                              ║   │  │
│  ║           │                            │           │                                              ║   │  │
│  ║           ▼                            ▼           │                                              ║   │  │
│  ║  ┌─────────────────────────┐   ┌──────────┐      │                                              ║   │  │
│  ║  │  UCM_to_Bronze_ETL     │──▶│  BRONZE  │      │                                              ║   │  │
│  ║  │  ─────────────────────  │   │  Iceberg │      │                                              ║   │  │
│  ║  │  • Schema validation    │   │  Tables  │      │                                              ║   │  │
│  ║  │  • Quarantine bad rows  │   └──────────┘      │                                              ║   │  │
│  ║  │  • Append-only write    │                      │                                              ║   │  │
│  ║  │  • Job bookmark         │                      │                                              ║   │  │
│  ║  └────────┬────────────────┘                      │                                              ║   │  │
│  ║           │ SUCCESS                               │                                              ║   │  │
│  ║           ▼                                       │                                              ║   │  │
│  ║  ┌─────────────────┐                             │                                              ║   │  │
│  ║  │ ⚡ TRIGGER:     │                             │                                              ║   │  │
│  ║  │ Conditional     │                             │                                              ║   │  │
│  ║  └────────┬────────┘                             │                                              ║   │  │
│  ║           │                                       │                                              ║   │  │
│  ║           ▼                            ┌──────────┘                                              ║   │  │
│  ║  ┌─────────────────────────┐   ┌──────▼───┐                                                     ║   │  │
│  ║  │  Bronze_to_Silver_ETL   │──▶│  SILVER  │                                                     ║   │  │
│  ║  │  ─────────────────────  │   │  Iceberg │                                                     ║   │  │
│  ║  │  • Deduplication        │   │  Tables  │                                                     ║   │  │
│  ║  │  • Fiscal year derive   │   └──────────┘                                                     ║   │  │
│  ║  │  • MERGE INTO (CDC)     │                                                                     ║   │  │
│  ║  │  • Metric calculation   │                                                                     ║   │  │
│  ║  └────────┬────────────────┘                                                                     ║   │  │
│  ║           │ SUCCESS                                                                              ║   │  │
│  ║           ▼                                                                                      ║   │  │
│  ║  ┌─────────────────┐                                                                            ║   │  │
│  ║  │ ⚡ TRIGGER:     │                                                                            ║   │  │
│  ║  │ Conditional     │                                                                            ║   │  │
│  ║  └────────┬────────┘                                                                            ║   │  │
│  ║           │                                                                                      ║   │  │
│  ║           ▼                            ┌──────────┐                                              ║   │  │
│  ║  ┌─────────────────────────┐   ┌──────▼───┐      │                                              ║   │  │
│  ║  │  Silver_to_Gold_ETL     │──▶│   GOLD   │      │                                              ║   │  │
│  ║  │  ─────────────────────  │   │  Iceberg │      │                                              ║   │  │
│  ║  │  • Build dim_coa        │   │  Tables  │      │                                              ║   │  │
│  ║  │  • Build dim_period     │   │          │      │                                              ║   │  │
│  ║  │  • MERGE fact table     │   │ Star     │      │                                              ║   │  │
│  ║  │  • Generate KPIs        │   │ Schema   │      │                                              ║   │  │
│  ║  └─────────────────────────┘   └──────────┘      │                                              ║   │  │
│  ║                                                    │                                              ║   │  │
│  ╚════════════════════════════════════════════════════╪══════════════════════════════════════════════╝   │  │
│                                                       │                                                  │  │
│  ╔════════════════════════════════════════════════════╪══════════════════════════════════════════════╗   │  │
│  ║           METADATA & GOVERNANCE                    │                                              ║   │  │
│  ╠════════════════════════════════════════════════════╪══════════════════════════════════════════════╣   │  │
│  ║                                                    │                                              ║   │  │
│  ║  ┌──────────────────────┐          ┌──────────────▼──────────────┐                               ║   │  │
│  ║  │   AWS GLUE CATALOG   │◀────────▶│      AMAZON ATHENA          │                               ║   │  │
│  ║  │   ────────────────── │          │      ──────────────          │                               ║   │  │
│  ║  │   • cos_bronze DB    │ metadata │      • Iceberg queries       │                               ║   │  │
│  ║  │   • cos_silver DB    │◀────────▶│      • Time travel           │                               ║   │  │
│  ║  │   • cos_gold DB      │          │      • Snapshot history      │                               ║   │  │
│  ║  │   • Table schemas    │          │      • KPI analytics         │                               ║   │  │
│  ║  │   • Iceberg metadata │          │      • Engine v3             │                               ║   │  │
│  ║  └──────────────────────┘          └──────────────┬──────────────┘                               ║   │  │
│  ║                                                    │                                              ║   │  │
│  ╚════════════════════════════════════════════════════╪══════════════════════════════════════════════╝   │  │
│                                                       │                                                  │  │
│  ╔════════════════════════════════════════════════════╪══════════════════════════════════════════════╗   │  │
│  ║           SECURITY & DEVOPS                        │                                              ║   │  │
│  ╠════════════════════════════════════════════════════╪══════════════════════════════════════════════╣   │  │
│  ║                                                    │                                              ║   │  │
│  ║  ┌──────────────┐  ┌──────────────┐  ┌───────────▼────────────┐                                 ║   │  │
│  ║  │  IAM ROLE    │  │  GITHUB      │  │     POWER BI           │                                 ║   │  │
│  ║  │  ──────────  │  │  ACTIONS     │  │     ──────────         │                                 ║   │  │
│  ║  │  cos-lake-   │  │  ──────────  │  │     • DirectQuery      │                                 ║   │  │
│  ║  │  house-glue- │  │  • OIDC auth │  │     • ODBC via Athena  │                                 ║   │  │
│  ║  │  etl-role    │  │  • deploy.sh │  │     • Executive KPIs   │                                 ║   │  │
│  ║  │              │  │  • CI/CD     │  │     • Dept dashboards  │                                 ║   │  │
│  ║  └──────────────┘  └──────────────┘  └────────────────────────┘                                 ║   │  │
│  ║                                                                                                   ║   │  │
│  ╚═══════════════════════════════════════════════════════════════════════════════════════════════════╝   │  │
│                                                                                                           │  │
│  └────────────────────────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                                           │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Responsibilities

| Component | Service | Responsibility |
|---|---|---|
| Oracle Fusion 25D | Source ERP | Financial master data (GL, AP, PO, Budget) |
| BICC | Extraction | PVO-based incremental extracts to CSV |
| UCM | Staging | Temporary file staging before S3 transfer |
| Amazon S3 | Storage | Physical data lake storage (Parquet via Iceberg) |
| Apache Iceberg | Table Format | ACID transactions, time travel, schema evolution |
| AWS Glue Catalog | Metadata | Table registry, schema management, partition tracking |
| AWS Glue ETL | Processing | PySpark jobs for Bronze/Silver/Gold transformations |
| Glue Workflow | Orchestration | Sequential job execution with conditional triggers |
| Amazon Athena | Analytics | SQL querying over Iceberg tables (Engine v3) |
| Power BI | Visualization | Executive dashboards via Athena ODBC DirectQuery |
| IAM | Security | Role-based access, least-privilege, no credentials in code |
| GitHub Actions | CI/CD | OIDC-based automated deployment of Glue jobs |

---

## 4. End-to-End Workflow

```
DAILY PIPELINE (6:00 AM UTC)
═══════════════════════════════════════════════════════════════════

06:00  ⏰ Scheduled Trigger fires
       │
06:01  ▼ UCM_to_Bronze_ETL starts
       │  • Reads CSV from s3://bucket/landing/
       │  • Validates schema against Oracle PVO structure
       │  • Quarantines invalid records → s3://bucket/quarantine/
       │  • Appends valid records to Bronze Iceberg table
       │  • Creates new Iceberg snapshot
       │  • Commits job bookmark (tracks processed files)
       │
06:05  ✅ Bronze job SUCCEEDED
       │
       ▼ Conditional trigger fires
       │
06:06  ▼ Bronze_to_Silver_ETL starts
       │  • Reads new records from Bronze (incremental via bookmark)
       │  • Deduplicates by (code_combination_id, period_name)
       │  • Derives fiscal year from period_name
       │  • Calculates expenditure metrics
       │  • MERGE INTO Silver table (update existing, insert new)
       │  • Creates new Iceberg snapshot
       │
06:12  ✅ Silver job SUCCEEDED
       │
       ▼ Conditional trigger fires
       │
06:13  ▼ Silver_to_Gold_ETL starts
       │  • Refreshes dim_coa (SCD Type 2 via MERGE)
       │  • Refreshes dim_period (Type 1)
       │  • Joins Silver with dimensions
       │  • MERGE INTO fact_budgetary_control
       │  • Generates executive KPIs (logged)
       │  • Creates new Iceberg snapshot
       │
06:20  ✅ Gold job SUCCEEDED
       │
06:20  📊 Data available in Athena + Power BI
```

---

## 5. Deployment Workflow

```
DEVELOPER WORKFLOW
═══════════════════════════════════════════════════════════════════

Developer pushes to main branch
       │
       ▼
GitHub Actions triggered (.github/workflows/deploy-glue.yml)
       │
       ├── Step 1: OIDC authentication (no secrets stored)
       │           aws-actions/configure-aws-credentials@v4
       │           role-to-assume: arn:aws:iam::160357565307:role/github-oidc-role
       │
       ├── Step 2: Upload ETL scripts to S3
       │           aws s3 cp glue-jobs/*.py s3://bucket/glue-scripts/
       │
       ├── Step 3: Create/Update Glue jobs (idempotent)
       │           aws glue create-job (delete-if-exists first)
       │
       ├── Step 4: Create/Update workflow + triggers
       │           aws glue create-workflow
       │           aws glue create-trigger (scheduled + conditional)
       │
       └── Step 5: Validate deployment
                   aws glue get-job (verify all 3 exist)
                   aws glue get-workflow (verify pipeline)

MANUAL DEPLOYMENT (CloudShell):
       ./glue-jobs/deploy-glue.sh
       (Same steps, uses CloudShell IAM credentials)
```

---

## 6. Iceberg Table Lifecycle

```
ICEBERG TABLE LIFECYCLE
═══════════════════════════════════════════════════════════════════

CREATE TABLE (Athena DDL)
  │
  ▼
┌─────────────────────────────────────────────────────────────┐
│  metadata-v0.json                                            │
│  └── snapshot-0 (empty table)                                │
│       └── manifest-list-0.avro (empty)                       │
└─────────────────────────────────────────────────────────────┘
  │
  │ INSERT INTO (Bronze load)
  ▼
┌─────────────────────────────────────────────────────────────┐
│  metadata-v1.json                                            │
│  └── snapshot-1 (112 records)                                │
│       └── manifest-list-1.avro                               │
│            └── manifest-1.avro                               │
│                 └── data-file-001.parquet (112 rows)          │
└─────────────────────────────────────────────────────────────┘
  │
  │ MERGE INTO (Silver incremental update)
  ▼
┌─────────────────────────────────────────────────────────────┐
│  metadata-v2.json                                            │
│  └── snapshot-2 (112 records, 5 updated)                     │
│       └── manifest-list-2.avro                               │
│            ├── manifest-1.avro (reused, unchanged files)     │
│            └── manifest-2.avro (new/rewritten files)         │
│                 └── data-file-002.parquet (updated rows)      │
└─────────────────────────────────────────────────────────────┘
  │
  │ TIME TRAVEL: Query snapshot-1
  │ SELECT * FROM table FOR VERSION AS OF snapshot-1
  │ (reads metadata-v1 → manifest-list-1 → data-file-001)
  │
  │ SCHEMA EVOLUTION: ALTER TABLE ADD COLUMNS
  ▼
┌─────────────────────────────────────────────────────────────┐
│  metadata-v3.json (new schema, same data files)              │
│  └── snapshot-2 (unchanged — schema is metadata-only)        │
│       └── (same manifests and data files)                    │
│  New column shows NULL for existing rows                     │
└─────────────────────────────────────────────────────────────┘
  │
  │ MAINTENANCE: expire_snapshots + rewrite_data_files
  ▼
┌─────────────────────────────────────────────────────────────┐
│  metadata-v4.json                                            │
│  └── snapshot-3 (compacted: fewer, larger files)             │
│       └── manifest-list-3.avro                               │
│            └── manifest-3.avro                               │
│                 └── data-file-003.parquet (256MB optimized)   │
│                                                              │
│  Old snapshots expired → old data files eligible for delete  │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Data Flow Summary

| Stage | Input | Process | Output | Iceberg Operation |
|---|---|---|---|---|
| Landing | Oracle BICC CSV | File transfer | S3 CSV files | — |
| Bronze | S3 CSV | Validate + append | Iceberg table | APPEND |
| Silver | Bronze Iceberg | Dedup + enrich | Iceberg table | MERGE INTO |
| Gold | Silver Iceberg | Dim + fact build | Iceberg star schema | MERGE INTO |
| Analytics | Gold Iceberg | SQL queries | KPIs, reports | SELECT (read-only) |
| Maintenance | All layers | Compact + expire | Optimized files | REWRITE + EXPIRE |
