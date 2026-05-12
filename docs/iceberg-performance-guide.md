# Performance Optimization — COS Iceberg Lakehouse

## Enterprise Best Practices

### 1. File Sizing

| Metric | Recommendation | COS Setting |
|---|---|---|
| Target file size | 128-512 MB | 256 MB |
| Min file size (compaction trigger) | 64 MB | 64 MB |
| Max file size | 512 MB | 512 MB |
| Parquet row group size | 128 MB | Default |
| Compression | Zstd (30% smaller than Snappy) | Zstd for Gold, Snappy for Bronze |

```sql
-- Set optimal file size properties
ALTER TABLE cos_gold.fact_budgetary_control SET TBLPROPERTIES (
    'write.target-file-size-bytes' = '268435456',    -- 256 MB
    'write.parquet.row-group-size-bytes' = '134217728', -- 128 MB
    'write.parquet.compression-codec' = 'zstd'
);
```

### 2. Compaction Frequency

| Table | Load Frequency | Compaction Schedule | Rationale |
|---|---|---|---|
| fact_budgetary_control | Daily | Daily (after load) | Small daily files accumulate fast |
| fact_gl_actuals | Daily | Daily | High volume journal lines |
| fact_ap_invoices | Daily | Every 3 days | Lower volume, less urgency |
| dim_coa | Weekly | Weekly | Rarely changes |
| dim_supplier | Weekly | Weekly | SCD Type 2 creates few new files |

### 3. Partition Strategy Summary

```
OPTIMAL PARTITION DESIGN:
═══════════════════════════════════════════════════════════

fact_budgetary_control:
  Partition: fiscal_year (identity)
  Sort order: coa_key, period_key
  Rationale: 2-3 active years; always filtered by year

fact_gl_actuals:
  Partition: months(period_start_date) (hidden)
  Sort order: code_combination_id
  Rationale: Monthly granularity matches reporting cadence

fact_ap_invoices:
  Partition: months(invoice_date) (hidden)
  Sort order: vendor_id, code_combination_id
  Rationale: Date-range queries are primary access pattern

dim_coa:
  Partition: NONE (small table, < 1000 rows)
  Rationale: Full scan is faster than partition overhead
```

### 4. Query Optimization

#### Use Partition Pruning
```sql
-- GOOD: Athena prunes to single partition
SELECT * FROM cos_gold.fact_budgetary_control
WHERE fiscal_year = 2025;
-- Scans: 1 partition (~256 MB)

-- BAD: Full table scan
SELECT * FROM cos_gold.fact_budgetary_control
WHERE budget_amount > 1000000;
-- Scans: ALL partitions (~2 GB)
```

#### Use Column Projection
```sql
-- GOOD: Only reads 3 columns from Parquet
SELECT coa_key, budget_amount, actual_amount
FROM cos_gold.fact_budgetary_control
WHERE fiscal_year = 2025;

-- BAD: Reads all columns
SELECT *
FROM cos_gold.fact_budgetary_control
WHERE fiscal_year = 2025;
```

#### Use Predicate Pushdown
```sql
-- GOOD: Iceberg uses column statistics to skip row groups
SELECT * FROM cos_gold.fact_budgetary_control
WHERE coa_key = 1001 AND fiscal_year = 2025;
-- Iceberg checks min/max bounds in manifest → skips files where coa_key range doesn't include 1001

-- GOOD: Range predicates also benefit
SELECT * FROM cos_gold.fact_ap_invoices
WHERE invoice_date BETWEEN DATE '2025-01-01' AND DATE '2025-03-31';
-- Hidden partition pruning + row group statistics
```

### 5. Metadata Optimization

```sql
-- Rewrite manifests to consolidate (reduces planning time)
CALL glue_catalog.system.rewrite_manifests('cos_gold.fact_budgetary_control');

-- Before: 47 manifest files → 2.1s planning time
-- After:  4 manifest files  → 0.2s planning time
```

### 6. Caching

| Layer | Cache Strategy | Implementation |
|---|---|---|
| Athena | Result cache (5 min TTL) | Automatic for identical queries |
| Power BI | Import mode for dims | Scheduled refresh every 4 hours |
| Power BI | DirectQuery for facts | Real-time, no cache |
| S3 | CloudFront (optional) | Only for static reference data |

```
Power BI Optimization:
  dim_coa:      Import mode (small, rarely changes)
  dim_period:   Import mode (12 rows, never changes)
  dim_supplier: Import mode (< 100 rows)
  fact_*:       DirectQuery via Athena (always fresh)
```

---

## Before/After Performance Comparison

### Scenario: Monthly Budget Report (all departments, FY2025)

| Metric | Before Optimization | After Optimization | Improvement |
|---|---|---|---|
| Files scanned | 120 | 4 | 30x fewer |
| Data scanned | 2.4 GB | 256 MB | 9x less |
| Query time | 8.2s | 0.9s | 9x faster |
| Athena cost | $0.012 | $0.001 | 12x cheaper |
| Planning time | 2.1s | 0.2s | 10x faster |

### Scenario: Single Department Drill-Down

| Metric | Before | After (with sort order) | Improvement |
|---|---|---|---|
| Files scanned | 4 | 1 | 4x fewer |
| Row groups read | 16 | 2 | 8x fewer |
| Data scanned | 256 MB | 32 MB | 8x less |
| Query time | 0.9s | 0.15s | 6x faster |

---

## Real-World Recommendations for COS

1. **Run compaction immediately after BICC load** — don't let small files accumulate
2. **Use sort-order compaction on coa_key** — most queries filter by department (via coa_key join)
3. **Keep snapshot retention at 7 days** — balances time-travel needs vs storage cost
4. **Use Zstd compression for Gold** — 30% smaller files, negligible CPU overhead on modern hardware
5. **Monitor avg file size daily** — if it drops below 64MB, compaction is overdue
6. **Partition by fiscal_year, not period_name** — 12 partitions/year is too many for this data volume
7. **Don't partition dim tables** — they're too small; partition overhead exceeds benefit
