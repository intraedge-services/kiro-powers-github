# Apache Iceberg Architecture — COS Financial Lakehouse

## End-to-End Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                    COS FINANCIAL LAKEHOUSE — AWS ICEBERG                           │
│                                                                                   │
│  ┌─────────────────┐                                                             │
│  │ ORACLE FUSION   │                                                             │
│  │ 25D             │                                                             │
│  │ ─────────────── │                                                             │
│  │ GL Balances     │                                                             │
│  │ AP Invoices     │──── BICC (PVO Extracts) ────┐                               │
│  │ PO Headers      │                             │                               │
│  │ Budget Control  │                             ▼                               │
│  └─────────────────┘                   ┌─────────────────┐                       │
│                                        │   AWS S3         │                       │
│                                        │   Landing Zone   │                       │
│                                        └────────┬────────┘                       │
│                                                 │                                │
│         ┌───────────────────────────────────────┼──────────────────────┐         │
│         │                                       │                      │         │
│         ▼                                       ▼                      ▼         │
│  ┌──────────────┐                      ┌──────────────┐      ┌──────────────┐   │
│  │   BRONZE     │                      │    SILVER    │      │     GOLD     │   │
│  │──────────────│                      │──────────────│      │──────────────│   │
│  │ Raw Append   │ ──── Glue ETL ────▶  │ Clean/Dedup  │ ───▶ │ Star Schema  │   │
│  │ No Transform │                      │ MERGE/Upsert │      │ Kimball      │   │
│  │ Full History │                      │ SCD Type 1/2 │      │ Optimized    │   │
│  │              │                      │              │      │              │   │
│  │ Iceberg v2   │                      │ Iceberg v2   │      │ Iceberg v2   │   │
│  │ Parquet      │                      │ Parquet      │      │ Parquet      │   │
│  └──────────────┘                      └──────────────┘      └──────┬───────┘   │
│                                                                      │           │
│         ┌────────────────────────────────────────────────────────────┘           │
│         │                                                                        │
│         ▼                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐       │
│  │                        QUERY LAYER                                    │       │
│  │                                                                       │       │
│  │  ┌──────────┐    ┌──────────────┐    ┌───────────────────┐          │       │
│  │  │  ATHENA  │    │  REDSHIFT    │    │    POWER BI       │          │       │
│  │  │  (SQL)   │    │  SPECTRUM    │    │  (DirectQuery)    │          │       │
│  │  └──────────┘    └──────────────┘    └───────────────────┘          │       │
│  └──────────────────────────────────────────────────────────────────────┘       │
│                                                                                   │
│  ┌──────────────────────────────────────────────────────────────────────┐       │
│  │                     GOVERNANCE & CATALOG                              │       │
│  │                                                                       │       │
│  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐           │       │
│  │  │  AWS GLUE    │    │    LAKE      │    │  CLOUDWATCH  │           │       │
│  │  │  CATALOG     │    │  FORMATION   │    │  MONITORING  │           │       │
│  │  └──────────────┘    └──────────────┘    └──────────────┘           │       │
│  └──────────────────────────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## S3 Folder Structure

```
s3://cos-financial-lakehouse/
├── bronze/
│   ├── gl_balances/
│   │   ├── metadata/
│   │   │   └── v1.metadata.json
│   │   └── data/
│   │       ├── ingestion_date=2025-05-01/
│   │       │   └── 00001-abc123.parquet
│   │       └── ingestion_date=2025-05-02/
│   │           └── 00002-def456.parquet
│   ├── ap_invoices/
│   ├── po_headers/
│   └── budget_control/
├── silver/
│   ├── gl_balances_clean/
│   ├── ap_invoices_clean/
│   ├── po_distributions_clean/
│   └── budget_control_clean/
├── gold/
│   ├── dim_coa/
│   ├── dim_period/
│   ├── dim_supplier/
│   ├── dim_ledger/
│   ├── fact_budgetary_control/
│   ├── fact_gl_actuals/
│   ├── fact_ap_invoices/
│   └── fact_purchase_orders/
└── maintenance/
    ├── logs/
    └── checkpoints/
```

---

## Iceberg Metadata Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ICEBERG TABLE STRUCTURE                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    CATALOG (AWS Glue)                      │   │
│  │  Points to → current metadata.json location               │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              METADATA LAYER (metadata.json)               │   │
│  │  ─────────────────────────────────────────────────────── │   │
│  │  • Table schema (column names, types, IDs)                │   │
│  │  • Partition spec                                         │   │
│  │  • Current snapshot pointer                               │   │
│  │  • Snapshot history (list of all snapshots)               │   │
│  │  • Table properties                                       │   │
│  │  • Format version (v2)                                    │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              SNAPSHOT (immutable)                          │   │
│  │  ─────────────────────────────────────────────────────── │   │
│  │  • snapshot_id: 7892345678                                │   │
│  │  • timestamp: 2025-05-08T06:00:00Z                        │   │
│  │  • operation: append / overwrite / delete                 │   │
│  │  • manifest_list: → snap-7892345678.avro                  │   │
│  │  • summary: {added-files: 3, total-records: 192}          │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              MANIFEST LIST (snap-xxx.avro)                 │   │
│  │  ─────────────────────────────────────────────────────── │   │
│  │  Lists all manifest files for this snapshot               │   │
│  │  • manifest-1.avro (partition: fiscal_year=2025)          │   │
│  │  • manifest-2.avro (partition: fiscal_year=2024)          │   │
│  │  Each entry has: added/deleted file counts, partition range│   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              MANIFEST FILES (manifest-x.avro)             │   │
│  │  ─────────────────────────────────────────────────────── │   │
│  │  Lists individual data files with:                        │   │
│  │  • file_path: s3://bucket/gold/fact_bc/data/00001.parquet │   │
│  │  • file_size_bytes: 268435456                             │   │
│  │  • record_count: 50000                                    │   │
│  │  • column_sizes: {col1: 1024, col2: 2048, ...}           │   │
│  │  • value_counts, null_counts                              │   │
│  │  • lower_bounds, upper_bounds (for pruning)               │   │
│  └──────────────────────────┬───────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              DATA FILES (Parquet)                          │   │
│  │  ─────────────────────────────────────────────────────── │   │
│  │  • Columnar format                                        │   │
│  │  • Snappy compression                                     │   │
│  │  • Row groups with statistics                             │   │
│  │  • Target size: 256MB                                     │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Transaction Log & Versioning

```
Timeline of Table Changes:
═══════════════════════════════════════════════════════════════════

v1 (metadata-v1.json)
  └─ Snapshot 1: Initial load (192 records, 16 files)
       └─ manifest-list-1.avro
            └─ manifest-1.avro → [file-001.parquet ... file-016.parquet]

v2 (metadata-v2.json)  ← BICC daily load
  └─ Snapshot 2: Append (3 new records)
       └─ manifest-list-2.avro
            ├─ manifest-1.avro → [file-001.parquet ... file-016.parquet]  (reused)
            └─ manifest-2.avro → [file-017.parquet]  (new)

v3 (metadata-v3.json)  ← MERGE/Upsert in Silver
  └─ Snapshot 3: Overwrite (updated 5 records)
       └─ manifest-list-3.avro
            ├─ manifest-1.avro → [file-001...file-014.parquet]  (2 files removed)
            └─ manifest-3.avro → [file-018.parquet]  (rewritten rows)

v4 (metadata-v4.json)  ← Compaction
  └─ Snapshot 4: Replace (same data, fewer files)
       └─ manifest-list-4.avro
            └─ manifest-4.avro → [file-019.parquet, file-020.parquet]  (compacted)
```

**Key Insight:** Each metadata version points to exactly one snapshot. The catalog (AWS Glue) always points to the latest metadata file. Time travel works by reading older metadata versions.

---

## Catalog Integration (AWS Glue)

```
AWS Glue Data Catalog
├── Database: cos_bronze
│   ├── Table: gl_balances        → s3://cos-lakehouse/bronze/gl_balances/
│   ├── Table: ap_invoices        → s3://cos-lakehouse/bronze/ap_invoices/
│   ├── Table: po_headers         → s3://cos-lakehouse/bronze/po_headers/
│   └── Table: budget_control     → s3://cos-lakehouse/bronze/budget_control/
│
├── Database: cos_silver
│   ├── Table: gl_balances_clean  → s3://cos-lakehouse/silver/gl_balances_clean/
│   ├── Table: ap_invoices_clean  → s3://cos-lakehouse/silver/ap_invoices_clean/
│   └── Table: budget_ctrl_clean  → s3://cos-lakehouse/silver/budget_control_clean/
│
└── Database: cos_gold
    ├── Table: dim_coa            → s3://cos-lakehouse/gold/dim_coa/
    ├── Table: dim_period         → s3://cos-lakehouse/gold/dim_period/
    ├── Table: dim_supplier       → s3://cos-lakehouse/gold/dim_supplier/
    ├── Table: dim_ledger         → s3://cos-lakehouse/gold/dim_ledger/
    ├── Table: fact_budgetary_control → s3://cos-lakehouse/gold/fact_budgetary_control/
    ├── Table: fact_gl_actuals    → s3://cos-lakehouse/gold/fact_gl_actuals/
    ├── Table: fact_ap_invoices   → s3://cos-lakehouse/gold/fact_ap_invoices/
    └── Table: fact_purchase_orders → s3://cos-lakehouse/gold/fact_purchase_orders/
```

Each Glue table entry stores:
- `metadata_location`: S3 path to current `metadata.json`
- `table_type`: `ICEBERG`
- `classification`: `parquet`
