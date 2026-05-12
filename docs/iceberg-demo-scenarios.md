# End-to-End Demo Scenarios — COS Iceberg Lakehouse

## Demo Flow Overview

```
Oracle Fusion 25D → BICC Extract → S3 Landing → Bronze (append)
    → Silver (MERGE/dedup) → Gold (star schema) → Power BI Dashboard
```

---

## Scenario 1: Budget vs Actual Reporting

### Executive Explanation
"We extract financial data from Oracle Fusion daily. The data flows through three layers — raw, cleaned, and reporting-ready. Power BI connects to the final Gold layer and shows real-time budget status for all $2.1B across every department."

### Technical Flow

```sql
-- 1. Data arrives in Bronze (raw BICC extract)
INSERT INTO cos_bronze.budget_control
VALUES (1001, 'MAY-2025', 'COS_BUDGET', 125000000, 87500000, 12000000, ...);

-- 2. Silver layer deduplicates and merges
MERGE INTO cos_silver.budget_control_clean AS target
USING (SELECT * FROM cos_bronze.budget_control WHERE ingestion_date = '2025-05-08') AS source
ON target.code_combination_id = source.code_combination_id
   AND target.period_name = source.period_name
WHEN MATCHED THEN UPDATE SET actual_amount = source.actual_amount ...
WHEN NOT MATCHED THEN INSERT ...;

-- 3. Gold layer serves Power BI
SELECT
    dc.department_description,
    dp.period_name,
    f.budget_amount,
    f.actual_amount,
    f.funds_available,
    ROUND((f.actual_amount + f.encumbrance_amount) / f.budget_amount * 100, 1) AS burn_rate_pct
FROM cos_gold.fact_budgetary_control f
JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
JOIN cos_gold.dim_period dp ON dp.period_key = f.period_key
WHERE dp.fiscal_year = 2025
ORDER BY burn_rate_pct DESC;
```

### Expected Output
| Department | Period | Budget | Actual | Available | Burn Rate |
|---|---|---|---|---|---|
| Police | MAY-2025 | $125M | $87.5M | $25.5M | 79.6% 🟡 |
| Fire | MAY-2025 | $98M | $72.1M | $18.9M | 80.7% 🟡 |
| Public Works | MAY-2025 | $67M | $41.2M | $20.8M | 68.9% 🟢 |

---

## Scenario 2: Time Travel — Historical Budget Query

### Executive Explanation
"Finance asked: 'What was the Police department budget status BEFORE last week's adjustment?' With Iceberg, we answer that in one query — no backups, no restores, instant."

### Technical Flow

```sql
-- Step 1: Find the snapshot from before the adjustment
SELECT snapshot_id, committed_at, operation
FROM cos_gold.fact_budgetary_control.snapshots
ORDER BY committed_at DESC LIMIT 5;

-- Result:
-- | 789234 | 2025-05-08 06:00 | append    | ← after adjustment
-- | 789123 | 2025-05-07 06:00 | overwrite | ← BEFORE adjustment
-- | 789012 | 2025-05-06 06:00 | append    |

-- Step 2: Query the state BEFORE the adjustment
SELECT
    dc.department_description,
    f.budget_amount,
    f.actual_amount,
    f.funds_available
FROM cos_gold.fact_budgetary_control
    FOR VERSION AS OF 789123 AS f
JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
WHERE dc.department_description = 'Police';

-- Step 3: Compare with current state
SELECT
    'Before' AS state, f.budget_amount, f.actual_amount
FROM cos_gold.fact_budgetary_control FOR VERSION AS OF 789123 AS f
JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
WHERE dc.department_description = 'Police'
UNION ALL
SELECT
    'After', f.budget_amount, f.actual_amount
FROM cos_gold.fact_budgetary_control f
JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
WHERE dc.department_description = 'Police';
```

### Talking Point
"The $2.1B total budget — we can see exactly what it looked like at any point in time. This is built into the storage layer, not an application feature. Zero additional cost."

---

## Scenario 3: Snapshot Rollback

### Executive Explanation
"A bad data load corrupted yesterday's numbers. Instead of spending hours debugging, we roll back to the last known good state in 30 seconds."

### Technical Flow

```sql
-- Step 1: Identify the bad snapshot
SELECT snapshot_id, committed_at, operation,
       summary['added-records'] AS added,
       summary['deleted-records'] AS deleted
FROM cos_gold.fact_budgetary_control.snapshots
ORDER BY committed_at DESC LIMIT 5;

-- Step 2: Rollback to last known good snapshot
CALL glue_catalog.system.rollback_to_snapshot(
    table       => 'cos_gold.fact_budgetary_control',
    snapshot_id => 789123  -- the good snapshot
);

-- Step 3: Verify
SELECT COUNT(*), SUM(budget_amount) AS total_budget
FROM cos_gold.fact_budgetary_control;
-- Should show pre-corruption values

-- Step 4: The bad data files still exist (for forensics)
-- but are no longer referenced by the current snapshot
```

### Key Point
"Rollback is a metadata-only operation. No data is copied or moved. It simply changes which snapshot the table points to. Takes < 1 second regardless of table size."

---

## Scenario 4: Incremental Data Ingestion

### Executive Explanation
"Every morning at 5 AM, Oracle Fusion sends us only the records that changed since yesterday. We process just those changes — not the entire dataset. This keeps our pipeline fast and cost-efficient."

### Technical Flow

```sql
-- Step 1: BICC sends incremental extract (only changed records)
-- Oracle provides LastUpdateDate > last_extract_timestamp

-- Step 2: Bronze — append raw extract (3 new/changed records today)
INSERT INTO cos_bronze.budget_control
SELECT *, '2025-05-08' AS ingestion_date
FROM staging.bicc_daily_extract;
-- Creates new snapshot with 3 added files

-- Step 3: Silver — MERGE only changed records
MERGE INTO cos_silver.budget_control_clean AS target
USING (
    SELECT * FROM cos_bronze.budget_control
    WHERE ingestion_date = '2025-05-08'
) AS source
ON target.code_combination_id = source.code_combination_id
   AND target.period_name = source.period_name
WHEN MATCHED AND source.last_update_date > target.last_update_date
    THEN UPDATE SET ...
WHEN NOT MATCHED THEN INSERT ...;

-- Step 4: Verify incremental processing
SELECT
    committed_at,
    operation,
    summary['added-records'] AS new_records,
    summary['changed-records'] AS updated_records
FROM cos_silver.budget_control_clean.snapshots
ORDER BY committed_at DESC LIMIT 1;
-- Shows: 2 new records, 1 updated record (not full table rewrite)
```

### Cost Benefit
"Full table: 192 records × 365 days = 70K records processed/year. Incremental: ~3 records/day × 365 = 1,095 records processed/year. That's a 98% reduction in compute cost."

---

## Scenario 5: Compaction Optimization

### Executive Explanation
"After 30 days of daily loads, we have 120 tiny files. Queries slow down because Athena has to open each file separately. Compaction merges them into 4 optimal files — same data, 10x faster queries."

### Technical Flow

```sql
-- Step 1: Check current state (before compaction)
SELECT
    COUNT(*) AS file_count,
    AVG(file_size_in_bytes)/1024/1024 AS avg_mb,
    MIN(file_size_in_bytes)/1024/1024 AS min_mb
FROM cos_gold.fact_budgetary_control.files;
-- Result: 120 files, avg 2.1 MB, min 0.3 MB ← BAD

-- Step 2: Run compaction
CALL glue_catalog.system.rewrite_data_files(
    table => 'cos_gold.fact_budgetary_control',
    strategy => 'binpack',
    options => map('target-file-size-bytes', '268435456')
);

-- Step 3: Check after compaction
SELECT
    COUNT(*) AS file_count,
    AVG(file_size_in_bytes)/1024/1024 AS avg_mb,
    MIN(file_size_in_bytes)/1024/1024 AS min_mb
FROM cos_gold.fact_budgetary_control.files;
-- Result: 4 files, avg 63 MB, min 48 MB ← OPTIMAL

-- Step 4: Query performance comparison
-- Before: Athena scans 120 files → 8.2 seconds
-- After:  Athena scans 4 files   → 0.9 seconds
```

### Visual
```
BEFORE COMPACTION:                    AFTER COMPACTION:
┌───┐┌───┐┌───┐┌───┐┌───┐...×120    ┌─────────────────┐┌─────────────────┐
│2MB││3MB││1MB││2MB││4MB│            │     128 MB      ││     128 MB      │
└───┘└───┘└───┘└───┘└───┘            └─────────────────┘└─────────────────┘
                                      ┌─────────────────┐┌───────┐
Query: 8.2s (120 S3 GETs)            │     128 MB      ││ 48 MB │
                                      └─────────────────┘└───────┘
                                      Query: 0.9s (4 S3 GETs)
```

---

## Executive Summary Talking Points

1. **Data freshness:** Oracle Fusion data available in Power BI within 1 hour of BICC extract
2. **Cost efficiency:** Incremental processing reduces compute by 98% vs full reload
3. **Auditability:** Time travel provides instant point-in-time reporting for any historical date
4. **Resilience:** Rollback recovers from bad loads in < 1 second
5. **Performance:** Compaction keeps queries under 1 second for $2.1B budget analysis
6. **Scalability:** Iceberg handles petabyte-scale without architecture changes
7. **Governance:** Lake Formation provides column-level security and audit trails
