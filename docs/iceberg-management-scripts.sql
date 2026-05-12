-- ═══════════════════════════════════════════════════════════════════════
-- COS Data Pipeline — Iceberg Deep Dive Management Scripts
-- Gold Layer: Apache Iceberg v2 on AWS (Glue Catalog + S3 + Redshift Spectrum)
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. UPGRADE GOLD LAYER TABLES TO ICEBERG v2
-- ─────────────────────────────────────────────────────────────────────

-- Set Iceberg v2 table properties on all Gold Layer tables
-- Run via AWS Glue/Spark or Athena (Iceberg connector)

ALTER TABLE gold.dim_coa SET TBLPROPERTIES (
    'format-version'          = '2',
    'write.distribution-mode' = 'hash',
    'write.delete.mode'       = 'merge-on-read',
    'write.update.mode'       = 'merge-on-read',
    'write.merge.mode'        = 'merge-on-read',
    'commit.retry.num-retries'= '4',
    'commit.retry.min-wait-ms'= '100'
);

ALTER TABLE gold.dim_period SET TBLPROPERTIES (
    'format-version'          = '2',
    'write.distribution-mode' = 'hash',
    'write.delete.mode'       = 'merge-on-read',
    'write.update.mode'       = 'merge-on-read',
    'commit.retry.num-retries'= '4',
    'commit.retry.min-wait-ms'= '100'
);

ALTER TABLE gold.dim_supplier SET TBLPROPERTIES (
    'format-version'          = '2',
    'write.distribution-mode' = 'hash',
    'write.delete.mode'       = 'merge-on-read',
    'write.update.mode'       = 'merge-on-read',
    'commit.retry.num-retries'= '4',
    'commit.retry.min-wait-ms'= '100'
);

ALTER TABLE gold.fact_budgetary_control SET TBLPROPERTIES (
    'format-version'          = '2',
    'write.distribution-mode' = 'hash',
    'write.delete.mode'       = 'merge-on-read',
    'write.update.mode'       = 'merge-on-read',
    'write.merge.mode'        = 'merge-on-read',
    'commit.retry.num-retries'= '4',
    'commit.retry.min-wait-ms'= '100',
    'write.target-file-size-bytes' = '268435456'  -- 256MB target
);

ALTER TABLE gold.fact_gl_actuals SET TBLPROPERTIES (
    'format-version'          = '2',
    'write.distribution-mode' = 'hash',
    'write.delete.mode'       = 'merge-on-read',
    'write.update.mode'       = 'merge-on-read',
    'write.merge.mode'        = 'merge-on-read',
    'commit.retry.num-retries'= '4',
    'write.target-file-size-bytes' = '268435456'
);

ALTER TABLE gold.fact_ap_invoices SET TBLPROPERTIES (
    'format-version'          = '2',
    'write.distribution-mode' = 'hash',
    'write.delete.mode'       = 'merge-on-read',
    'write.update.mode'       = 'merge-on-read',
    'write.merge.mode'        = 'merge-on-read',
    'commit.retry.num-retries'= '4',
    'write.target-file-size-bytes' = '268435456'
);

ALTER TABLE gold.fact_purchase_orders SET TBLPROPERTIES (
    'format-version'          = '2',
    'write.distribution-mode' = 'hash',
    'write.delete.mode'       = 'merge-on-read',
    'write.update.mode'       = 'merge-on-read',
    'write.merge.mode'        = 'merge-on-read',
    'commit.retry.num-retries'= '4',
    'write.target-file-size-bytes' = '268435456'
);


-- ─────────────────────────────────────────────────────────────────────
-- 2. SNAPSHOT RETENTION — Expire snapshots older than 7 days
-- ─────────────────────────────────────────────────────────────────────

-- Expire old snapshots (frees S3 storage for superseded data files)
-- Run daily via AWS Glue scheduled job or Step Functions

CALL gold.system.expire_snapshots(
    table => 'gold.fact_budgetary_control',
    older_than => TIMESTAMP '${CURRENT_DATE - INTERVAL 7 DAYS}',
    retain_last => 3
);

CALL gold.system.expire_snapshots(
    table => 'gold.fact_gl_actuals',
    older_than => TIMESTAMP '${CURRENT_DATE - INTERVAL 7 DAYS}',
    retain_last => 3
);

CALL gold.system.expire_snapshots(
    table => 'gold.fact_ap_invoices',
    older_than => TIMESTAMP '${CURRENT_DATE - INTERVAL 7 DAYS}',
    retain_last => 3
);

CALL gold.system.expire_snapshots(
    table => 'gold.fact_purchase_orders',
    older_than => TIMESTAMP '${CURRENT_DATE - INTERVAL 7 DAYS}',
    retain_last => 3
);

CALL gold.system.expire_snapshots(
    table => 'gold.dim_coa',
    older_than => TIMESTAMP '${CURRENT_DATE - INTERVAL 7 DAYS}',
    retain_last => 3
);

CALL gold.system.expire_snapshots(
    table => 'gold.dim_supplier',
    older_than => TIMESTAMP '${CURRENT_DATE - INTERVAL 7 DAYS}',
    retain_last => 3
);


-- ─────────────────────────────────────────────────────────────────────
-- 3. DATA FILE COMPACTION — Merge small files from incremental loads
-- ─────────────────────────────────────────────────────────────────────

-- Rewrite data files: merges small Parquet files into ~256MB optimized files
-- Run after each BICC load cycle completes

CALL gold.system.rewrite_data_files(
    table          => 'gold.fact_budgetary_control',
    strategy       => 'binpack',
    options        => map(
        'target-file-size-bytes', '268435456',   -- 256 MB
        'min-file-size-bytes',    '67108864',    -- 64 MB (files smaller than this get compacted)
        'max-file-size-bytes',    '536870912'    -- 512 MB max
    )
);

CALL gold.system.rewrite_data_files(
    table          => 'gold.fact_gl_actuals',
    strategy       => 'binpack',
    options        => map(
        'target-file-size-bytes', '268435456',
        'min-file-size-bytes',    '67108864',
        'max-file-size-bytes',    '536870912'
    )
);

CALL gold.system.rewrite_data_files(
    table          => 'gold.fact_ap_invoices',
    strategy       => 'binpack',
    options        => map(
        'target-file-size-bytes', '268435456',
        'min-file-size-bytes',    '67108864',
        'max-file-size-bytes',    '536870912'
    )
);

CALL gold.system.rewrite_data_files(
    table          => 'gold.fact_purchase_orders',
    strategy       => 'binpack',
    options        => map(
        'target-file-size-bytes', '268435456',
        'min-file-size-bytes',    '67108864',
        'max-file-size-bytes',    '536870912'
    )
);


-- ─────────────────────────────────────────────────────────────────────
-- 4. METADATA CLEANUP — Remove orphan files and rewrite manifests
-- ─────────────────────────────────────────────────────────────────────

-- Remove orphan files: data files not referenced by any snapshot
-- Safety: only removes files older than 3 days (avoids race conditions)

CALL gold.system.remove_orphan_files(
    table     => 'gold.fact_budgetary_control',
    older_than => TIMESTAMP '${CURRENT_DATE - INTERVAL 3 DAYS}'
);

CALL gold.system.remove_orphan_files(
    table     => 'gold.fact_gl_actuals',
    older_than => TIMESTAMP '${CURRENT_DATE - INTERVAL 3 DAYS}'
);

CALL gold.system.remove_orphan_files(
    table     => 'gold.fact_ap_invoices',
    older_than => TIMESTAMP '${CURRENT_DATE - INTERVAL 3 DAYS}'
);

CALL gold.system.remove_orphan_files(
    table     => 'gold.fact_purchase_orders',
    older_than => TIMESTAMP '${CURRENT_DATE - INTERVAL 3 DAYS}'
);

-- Rewrite manifest files: consolidates metadata for faster query planning
CALL gold.system.rewrite_manifests(
    table => 'gold.fact_budgetary_control'
);

CALL gold.system.rewrite_manifests(
    table => 'gold.fact_gl_actuals'
);

CALL gold.system.rewrite_manifests(
    table => 'gold.fact_ap_invoices'
);

CALL gold.system.rewrite_manifests(
    table => 'gold.fact_purchase_orders'
);


-- ─────────────────────────────────────────────────────────────────────
-- 5. SCHEMA EVOLUTION — Add new segment to dim_coa (26A Future-Proofing)
-- ─────────────────────────────────────────────────────────────────────

-- Iceberg schema evolution: add column without table recreation
-- Existing queries continue to work; historical rows show NULL for new column

ALTER TABLE gold.dim_coa ADD COLUMN activity_code VARCHAR(30);
ALTER TABLE gold.dim_coa ADD COLUMN activity_description VARCHAR(100);
ALTER TABLE gold.dim_coa ADD COLUMN sub_account VARCHAR(30);

-- Verify schema evolution
SELECT * FROM gold.dim_coa.snapshots ORDER BY committed_at DESC LIMIT 5;

-- Note: No backfill required. New BICC extracts from Oracle 26A will
-- populate these columns going forward. Historical rows remain NULL.
-- This is Iceberg's key advantage over Hive/Parquet-only approaches.
