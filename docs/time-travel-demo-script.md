# COS Data Pipeline — Time Travel & Compaction Demo Script

## Audience
Team presentation for COS stakeholders and data engineers.

---

## Part 1: Understanding Snapshots

**Talking Point:** "Every time we load data from Oracle Fusion via BICC, Iceberg creates a snapshot — a point-in-time photograph of the entire table. We never lose history."

```sql
-- List all snapshots for the budgetary control fact table
SELECT
    snapshot_id,
    committed_at,
    operation,
    summary['added-data-files'] AS files_added,
    summary['total-records']    AS total_records
FROM gold.fact_budgetary_control.snapshots
ORDER BY committed_at DESC
LIMIT 10;
```

**Expected Output:**
| snapshot_id | committed_at | operation | files_added | total_records |
|---|---|---|---|---|
| 7892345678 | 2025-05-08 06:00:00 | append | 3 | 192 |
| 7891234567 | 2025-05-07 06:00:00 | overwrite | 16 | 189 |
| 7890123456 | 2025-05-06 06:00:00 | append | 2 | 185 |

---

## Part 2: Time Travel — Query the Past

**Talking Point:** "Let's say Finance asks: 'What was the total budget BEFORE yesterday's BICC load updated the numbers?' We can answer that instantly — no restore, no backup, just a query."

### Query by Snapshot ID

```sql
-- See budget status BEFORE the May 8 update
SELECT
    dc.fund_description,
    dc.department_description,
    SUM(f.budget_amount)      AS total_budget,
    SUM(f.actual_amount)      AS total_actual,
    SUM(f.funds_available)    AS available
FROM gold.fact_budgetary_control
    FOR VERSION AS OF 7891234567  -- snapshot from May 7
    AS f
JOIN gold.dim_coa dc ON dc.coa_key = f.coa_key
GROUP BY dc.fund_description, dc.department_description
ORDER BY total_budget DESC;
```

### Query by Timestamp

```sql
-- See budget status as of a specific date/time
SELECT
    SUM(budget_amount) AS total_budget,
    SUM(actual_amount) AS total_actual,
    SUM(funds_available) AS available
FROM gold.fact_budgetary_control
    FOR TIMESTAMP AS OF TIMESTAMP '2025-05-07 00:00:00';
```

**Talking Point:** "The $2.1B total budget — we can see exactly what it looked like at any point in time. If someone asks 'did the budget change between Monday and Wednesday?' — one query, instant answer."

---

## Part 3: Before/After Comparison

**Talking Point:** "Here's the real power — comparing two points in time side by side."

```sql
-- Compare budget state: before vs after the latest load
WITH before_load AS (
    SELECT
        coa_key,
        budget_amount,
        actual_amount,
        funds_available
    FROM gold.fact_budgetary_control
        FOR VERSION AS OF 7891234567  -- before
),
after_load AS (
    SELECT
        coa_key,
        budget_amount,
        actual_amount,
        funds_available
    FROM gold.fact_budgetary_control  -- current (latest snapshot)
)
SELECT
    dc.department_description,
    b.budget_amount   AS budget_before,
    a.budget_amount   AS budget_after,
    a.budget_amount - b.budget_amount AS budget_change,
    b.actual_amount   AS actual_before,
    a.actual_amount   AS actual_after,
    a.actual_amount - b.actual_amount AS actual_change
FROM before_load b
JOIN after_load a ON a.coa_key = b.coa_key
JOIN gold.dim_coa dc ON dc.coa_key = a.coa_key
WHERE a.budget_amount != b.budget_amount
   OR a.actual_amount != b.actual_amount
ORDER BY ABS(a.actual_amount - b.actual_amount) DESC
LIMIT 20;
```

---

## Part 4: Compaction Demo

**Talking Point:** "BICC sends us small incremental files every day. Over time, that means hundreds of tiny files which slows down queries. Compaction merges them into fewer, larger files — same data, faster reads."

### Before Compaction — Check File Count

```sql
-- See how many data files exist
SELECT
    file_path,
    file_size_in_bytes,
    record_count
FROM gold.fact_budgetary_control.files
ORDER BY file_size_in_bytes ASC
LIMIT 20;

-- Summary
SELECT
    COUNT(*)                          AS total_files,
    SUM(file_size_in_bytes) / 1024 / 1024 AS total_size_mb,
    AVG(file_size_in_bytes) / 1024 / 1024 AS avg_file_size_mb,
    MIN(file_size_in_bytes) / 1024 / 1024 AS smallest_file_mb
FROM gold.fact_budgetary_control.files;
```

**Expected:** Many small files (< 64MB each) from daily incremental loads.

### Run Compaction

```sql
CALL gold.system.rewrite_data_files(
    table    => 'gold.fact_budgetary_control',
    strategy => 'binpack',
    options  => map(
        'target-file-size-bytes', '268435456',
        'min-file-size-bytes',    '67108864'
    )
);
```

### After Compaction — Verify

```sql
-- Same query — now fewer, larger files
SELECT
    COUNT(*)                          AS total_files,
    SUM(file_size_in_bytes) / 1024 / 1024 AS total_size_mb,
    AVG(file_size_in_bytes) / 1024 / 1024 AS avg_file_size_mb,
    MIN(file_size_in_bytes) / 1024 / 1024 AS smallest_file_mb
FROM gold.fact_budgetary_control.files;
```

**Talking Point:** "Same data, same query results — but now Redshift Spectrum reads 4 files instead of 47. That's a 10x improvement in scan time."

---

## Part 5: Maintenance Schedule (Recommended)

| Task | Frequency | When | Impact |
|---|---|---|---|
| Snapshot Expiration | Daily | 2:00 AM after BICC load | Frees S3 storage |
| Data File Compaction | Daily | 3:00 AM after expiration | Faster queries |
| Orphan File Removal | Weekly | Sunday 4:00 AM | Removes leaked files |
| Manifest Rewrite | Weekly | Sunday 4:30 AM | Faster query planning |

---

## Key Takeaways for the Team

1. **Zero-downtime auditing** — Query any historical state without restoring backups
2. **Cost optimization** — Snapshot expiration + orphan removal reduces S3 spend
3. **Query performance** — Compaction keeps Redshift Spectrum fast despite daily loads
4. **No data loss risk** — Compaction and maintenance never delete current data
5. **Oracle 26A ready** — Schema evolution adds columns without table recreation
