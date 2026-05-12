# Iceberg Maintenance Runbook — COS Financial Lakehouse

## Maintenance Schedule

| Task | Frequency | Window | Impact | Priority |
|---|---|---|---|---|
| Snapshot Expiration | Daily | 02:00-02:30 | Frees S3 storage | High |
| Data File Compaction | Daily | 03:00-04:00 | Improves query speed | High |
| Orphan File Removal | Weekly | Sun 04:00 | Removes leaked files | Medium |
| Manifest Rewrite | Weekly | Sun 04:30 | Faster planning | Medium |
| Partition Stats Update | Weekly | Sun 05:00 | Better pruning | Low |

---

## 1. Snapshot Expiration

**Why:** Each BICC load creates a new snapshot. Without cleanup, snapshot metadata grows indefinitely, and old data files consume S3 storage.

**When required:** When snapshot count exceeds 50 per table, or S3 costs increase unexpectedly.

**Performance impact:** Reduces metadata read time; frees S3 storage.

```sql
-- Expire snapshots older than 7 days, always keep at least 3
CALL glue_catalog.system.expire_snapshots(
    table       => 'cos_gold.fact_budgetary_control',
    older_than  => TIMESTAMP '2025-05-01 00:00:00',
    retain_last => 3
);

-- Check what was cleaned
SELECT
    COUNT(*) AS remaining_snapshots,
    MIN(committed_at) AS oldest_snapshot,
    MAX(committed_at) AS newest_snapshot
FROM cos_gold.fact_budgetary_control.snapshots;
```

**Storage savings estimate:**
- Each snapshot retains ~256MB of superseded data files
- 30 days × 4 tables = ~30GB freed per monthly cleanup cycle

---

## 2. Data File Compaction

**Why:** Daily BICC incremental loads create small files (1-10MB each). Athena/Spectrum perform best with 128-512MB files.

**When required:** When average file size drops below 64MB, or query latency increases.

**Performance impact:** 5-10x query speed improvement after compaction.

```sql
-- Binpack strategy: merge small files into target size
CALL glue_catalog.system.rewrite_data_files(
    table    => 'cos_gold.fact_budgetary_control',
    strategy => 'binpack',
    options  => map(
        'target-file-size-bytes',    '268435456',  -- 256 MB
        'min-file-size-bytes',       '67108864',   -- 64 MB threshold
        'max-file-size-bytes',       '536870912',  -- 512 MB max
        'partial-progress.enabled',  'true',       -- commit progress incrementally
        'partial-progress.max-commits', '10'
    )
);
```

**Sort-order compaction** (for frequently filtered columns):
```sql
-- Rewrite with sort order for better pruning
CALL glue_catalog.system.rewrite_data_files(
    table    => 'cos_gold.fact_budgetary_control',
    strategy => 'sort',
    options  => map(
        'target-file-size-bytes', '268435456',
        'rewrite-all', 'true'
    ),
    sort_order => 'coa_key ASC, period_key ASC'
);
```

**Before/After metrics:**
```sql
-- Check file statistics
SELECT
    COUNT(*) AS file_count,
    SUM(file_size_in_bytes) / 1024 / 1024 AS total_mb,
    AVG(file_size_in_bytes) / 1024 / 1024 AS avg_file_mb,
    MIN(file_size_in_bytes) / 1024 / 1024 AS min_file_mb,
    MAX(file_size_in_bytes) / 1024 / 1024 AS max_file_mb
FROM cos_gold.fact_budgetary_control.files;
```

---

## 3. Orphan File Removal

**Why:** Failed writes, aborted transactions, or expired snapshots can leave unreferenced data files in S3.

**When required:** Weekly, or when S3 bucket size exceeds expected data volume.

**Safety:** Only removes files older than 3 days to avoid race conditions with in-progress writes.

```sql
-- Remove orphan files (unreferenced by any snapshot)
CALL glue_catalog.system.remove_orphan_files(
    table      => 'cos_gold.fact_budgetary_control',
    older_than => TIMESTAMP '2025-05-05 00:00:00',
    dry_run    => true  -- Preview first!
);

-- If preview looks safe, run for real
CALL glue_catalog.system.remove_orphan_files(
    table      => 'cos_gold.fact_budgetary_control',
    older_than => TIMESTAMP '2025-05-05 00:00:00'
);
```

**S3 lifecycle policy (belt and suspenders):**
```json
{
  "Rules": [{
    "ID": "CleanupOrphanIcebergFiles",
    "Status": "Enabled",
    "Filter": {"Prefix": "gold/"},
    "NoncurrentVersionExpiration": {"NoncurrentDays": 30}
  }]
}
```

---

## 4. Manifest Rewrite

**Why:** Over time, manifest files accumulate small entries. Rewriting consolidates them for faster query planning.

**When required:** When query planning time exceeds 2 seconds, or manifest count exceeds 100 per table.

```sql
-- Rewrite manifests to consolidate
CALL glue_catalog.system.rewrite_manifests(
    table => 'cos_gold.fact_budgetary_control'
);

-- Verify manifest count
SELECT
    COUNT(*) AS manifest_count,
    SUM(added_data_files_count) AS total_data_files
FROM cos_gold.fact_budgetary_control.manifests;
```

---

## 5. Vacuum (Combined Cleanup)

Full maintenance sequence for a single table:

```sql
-- Step 1: Expire old snapshots
CALL glue_catalog.system.expire_snapshots(
    table => 'cos_gold.fact_budgetary_control',
    older_than => TIMESTAMP '${7_DAYS_AGO}',
    retain_last => 3
);

-- Step 2: Remove orphan files (after expiration)
CALL glue_catalog.system.remove_orphan_files(
    table => 'cos_gold.fact_budgetary_control',
    older_than => TIMESTAMP '${3_DAYS_AGO}'
);

-- Step 3: Compact data files
CALL glue_catalog.system.rewrite_data_files(
    table => 'cos_gold.fact_budgetary_control',
    strategy => 'binpack',
    options => map('target-file-size-bytes', '268435456')
);

-- Step 4: Rewrite manifests
CALL glue_catalog.system.rewrite_manifests(
    table => 'cos_gold.fact_budgetary_control'
);
```

---

## 6. Monitoring Queries

### Snapshot Growth
```sql
SELECT
    DATE(committed_at) AS snapshot_date,
    COUNT(*) AS snapshots_created,
    SUM(CAST(summary['added-records'] AS BIGINT)) AS records_added
FROM cos_gold.fact_budgetary_control.snapshots
GROUP BY DATE(committed_at)
ORDER BY snapshot_date DESC
LIMIT 14;
```

### File Size Distribution
```sql
SELECT
    CASE
        WHEN file_size_in_bytes < 67108864 THEN '< 64MB (needs compaction)'
        WHEN file_size_in_bytes < 268435456 THEN '64-256MB (acceptable)'
        WHEN file_size_in_bytes < 536870912 THEN '256-512MB (optimal)'
        ELSE '> 512MB (oversized)'
    END AS size_bucket,
    COUNT(*) AS file_count,
    SUM(file_size_in_bytes) / 1024 / 1024 / 1024 AS total_gb
FROM cos_gold.fact_budgetary_control.files
GROUP BY 1
ORDER BY 1;
```

### Table Health Summary
```sql
SELECT
    'fact_budgetary_control' AS table_name,
    (SELECT COUNT(*) FROM cos_gold.fact_budgetary_control.snapshots) AS snapshot_count,
    (SELECT COUNT(*) FROM cos_gold.fact_budgetary_control.files) AS file_count,
    (SELECT SUM(file_size_in_bytes)/1024/1024 FROM cos_gold.fact_budgetary_control.files) AS total_mb,
    (SELECT AVG(file_size_in_bytes)/1024/1024 FROM cos_gold.fact_budgetary_control.files) AS avg_file_mb;
```

---

## 7. Alerting Thresholds

| Metric | Warning | Critical | Action |
|---|---|---|---|
| Snapshot count | > 30 | > 100 | Run expire_snapshots |
| Avg file size | < 64MB | < 16MB | Run compaction |
| File count | > 500 | > 2000 | Run compaction |
| Orphan file size | > 1GB | > 10GB | Run remove_orphan_files |
| Manifest count | > 50 | > 200 | Run rewrite_manifests |
