# Iceberg Partitioning Strategy — COS Financial Lakehouse

## Partitioning Recommendations

| Table | Partition Column | Strategy | Rationale |
|---|---|---|---|
| fact_budgetary_control | fiscal_year | Identity | Queries always filter by fiscal year; 2-3 active years |
| fact_gl_actuals | fiscal_year | Identity | Same as above; period_name within year for pruning |
| fact_ap_invoices | months(invoice_date) | Hidden | Monthly granularity; auto-prunes on date filters |
| fact_purchase_orders | fiscal_year | Identity | PO lifecycle spans months within a fiscal year |
| dim_coa | bucket(16, code_combination_id) | Bucket | Even distribution; no natural time partition |
| dim_supplier | bucket(8, vendor_id) | Bucket | Small table; bucket for parallel reads |
| Bronze tables | ingestion_date | Identity | Append-only; partition by load date |

---

## Hidden Partitioning (Iceberg-Native)

Unlike Hive, Iceberg supports hidden partitions — the partition column is derived from a source column without requiring users to know the partition structure.

```sql
-- Create table with hidden monthly partition on invoice_date
CREATE TABLE cos_gold.fact_ap_invoices (
    ap_key              BIGINT,
    coa_key             BIGINT,
    period_key          BIGINT,
    supplier_key        BIGINT,
    invoice_id          BIGINT,
    invoice_number      STRING,
    invoice_amount      DECIMAL(18,2),
    amount_paid         DECIMAL(18,2),
    payment_status_flag STRING,
    po_header_id        BIGINT,
    invoice_date        DATE,
    dw_load_date        TIMESTAMP
)
PARTITIONED BY (months(invoice_date))
LOCATION 's3://cos-financial-lakehouse/gold/fact_ap_invoices/'
TBLPROPERTIES (
    'table_type'       = 'ICEBERG',
    'format-version'   = '2'
);
```

**User query (no partition awareness needed):**
```sql
-- Iceberg automatically prunes to only scan relevant monthly partitions
SELECT * FROM cos_gold.fact_ap_invoices
WHERE invoice_date BETWEEN DATE '2025-01-01' AND DATE '2025-03-31';
-- Only scans 3 monthly partitions, not the entire table
```

---

## Partition Evolution

Change partition strategy without rewriting existing data:

```sql
-- Original: partitioned by fiscal_year
-- New requirement: also partition by department for large departments

-- Step 1: Evolve partition spec (no data rewrite!)
ALTER TABLE cos_gold.fact_budgetary_control
SET PARTITION SPEC (fiscal_year, bucket(8, coa_key));

-- What happens:
-- • Existing data files keep their original partition layout
-- • NEW data files use the new partition spec
-- • Queries still work across both layouts (Iceberg handles it)
-- • Over time, compaction will reorganize old files into new layout
```

**Before evolution:**
```
data/
├── fiscal_year=2024/
│   ├── file-001.parquet (all departments mixed)
│   └── file-002.parquet
└── fiscal_year=2025/
    └── file-003.parquet
```

**After evolution (new writes):**
```
data/
├── fiscal_year=2024/                    ← old layout preserved
│   ├── file-001.parquet
│   └── file-002.parquet
├── fiscal_year=2025/coa_key_bucket=0/   ← new layout
│   └── file-004.parquet
└── fiscal_year=2025/coa_key_bucket=1/
    └── file-005.parquet
```

---

## Partition Pruning — How It Works

```
Query: SELECT * FROM fact_budgetary_control WHERE fiscal_year = 2025

┌─────────────────────────────────────────────────────────────┐
│ Step 1: Read metadata.json                                   │
│         → current snapshot → manifest list                   │
│                                                              │
│ Step 2: Read manifest list                                   │
│         → filter manifests by partition range                │
│         → SKIP manifests where fiscal_year != 2025           │
│                                                              │
│ Step 3: Read relevant manifest files                         │
│         → get data file paths for fiscal_year=2025           │
│         → use column statistics for further pruning          │
│                                                              │
│ Step 4: Read only matching Parquet files                     │
│         → predicate pushdown into row groups                 │
└─────────────────────────────────────────────────────────────┘

Result: Instead of scanning 500 files, scan only 12 files
        → 95% I/O reduction
```

---

## Recommended Partition Sizing

| Metric | Target | Rationale |
|---|---|---|
| Files per partition | 10-100 | Too few = large files; too many = metadata overhead |
| File size | 128-512 MB | Optimal for S3 GET throughput and Athena/Spectrum |
| Partition count | < 10,000 total | Metadata scalability limit |
| Records per file | 500K - 5M | Balance between parallelism and overhead |

---

## COS-Specific Partition Design

### fact_budgetary_control
```
Partition: fiscal_year (identity)
Reasoning:
  - COS fiscal year: Jul-Jun
  - Active years: current + 1 prior = 2 partitions queried
  - ~192 records per year (16 CCIDs × 12 periods)
  - Small table → single partition per year is optimal
  - Power BI always filters by fiscal year first
```

### fact_gl_actuals
```
Partition: fiscal_year (identity)
Reasoning:
  - Journal lines accumulate: ~50K per year
  - Fiscal year filter eliminates 80%+ of data
  - Period_name used as secondary filter (column stats handle this)
  - Sort within partition by period_name for better pruning
```

### fact_ap_invoices
```
Partition: months(invoice_date) (hidden)
Reasoning:
  - Invoices have natural date distribution
  - Monthly partition = ~2K-5K records per partition
  - Hidden partition means users query by date naturally
  - Supports both "last 30 days" and "fiscal year" queries efficiently
```

---

## Sort Order (Within Partitions)

```sql
-- Optimize file layout for common query patterns
ALTER TABLE cos_gold.fact_budgetary_control
WRITE ORDERED BY coa_key, period_key;

-- This ensures:
-- 1. Records for same CCID are co-located in same row group
-- 2. Queries filtering by department (via coa_key) skip row groups
-- 3. Joins with dim_coa are more cache-friendly
```
