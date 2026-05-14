-- ═══════════════════════════════════════════════════════════════════════════════
-- COS FINANCIAL LAKEHOUSE — ADVANCED ICEBERG ENTERPRISE DEMO
-- Manager-Level Demonstration: Why Iceberg > Raw Parquet
--
-- Run each section sequentially in Athena Query Editor
-- Database: cos_gold | Workgroup: cos-financial-lakehouse
--
-- DEMO FLOW:
--   1. Baseline state (current budget data)
--   2. Simulate incorrect budget update (bad data load)
--   3. Time travel to recover previous state
--   4. Schema evolution (Oracle Fusion 26A adds new columns)
--   5. Incremental MERGE (daily CDC from Oracle)
--   6. Snapshot version control & audit
--   7. Enterprise scenarios (compliance, audit, concurrent updates)
-- ═══════════════════════════════════════════════════════════════════════════════


-- ═════════════════════════════════════════════════════════════════════════════
-- DEMO 1: BASELINE — Current State
-- ═════════════════════════════════════════════════════════════════════════════
-- TALKING POINT: "Here's our current $2.1B budget status across all departments.
-- This is the Gold layer — the single source of truth for Power BI."

-- Executive KPI: Total budget overview
SELECT
    ROUND(SUM(budget_amount)/1e9, 2) AS total_budget_B,
    ROUND(SUM(actual_amount)/1e9, 2) AS total_actual_B,
    ROUND(SUM(funds_available)/1e9, 2) AS available_B,
    ROUND(SUM(actual_amount)/SUM(budget_amount)*100, 1) AS burn_rate_pct
FROM cos_gold.fact_budgetary_control;

-- Department ranking (before any changes)
SELECT
    dc.department_description,
    ROUND(SUM(f.budget_amount)/1e6, 1) AS budget_M,
    ROUND(SUM(f.actual_amount)/1e6, 1) AS actual_M,
    ROUND(SUM(f.funds_available)/1e6, 1) AS available_M
FROM cos_gold.fact_budgetary_control f
JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
GROUP BY dc.department_description
ORDER BY budget_M DESC;

-- Record the current snapshot (we'll come back to this)
SELECT * FROM cos_gold."fact_budgetary_control$iceberg_history"
ORDER BY made_current_at DESC
LIMIT 3;


-- ═════════════════════════════════════════════════════════════════════════════
-- DEMO 2: SIMULATE INCORRECT BUDGET UPDATE
-- ═════════════════════════════════════════════════════════════════════════════
-- TALKING POINT: "A bad BICC extract just loaded incorrect budget numbers.
-- The Police department budget was accidentally doubled. In a raw Parquet
-- system, this would require a full restore from backup. With Iceberg,
-- we can recover in seconds."

-- Simulate bad data: accidentally double Police budget
UPDATE cos_gold.fact_budgetary_control
SET budget_amount = budget_amount * 2,
    funds_available = (budget_amount * 2) - actual_amount - encumbrance_amount,
    dw_load_date = CURRENT_TIMESTAMP
WHERE code_combination_id = 1001;

-- Verify the damage — Police budget is now wrong
SELECT
    dc.department_description,
    ROUND(SUM(f.budget_amount)/1e6, 1) AS budget_M,
    ROUND(SUM(f.actual_amount)/1e6, 1) AS actual_M
FROM cos_gold.fact_budgetary_control f
JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
WHERE dc.department_description = 'Police'
GROUP BY dc.department_description;
-- Shows: budget_M is now DOUBLED (incorrect!)

-- Total budget is now inflated
SELECT ROUND(SUM(budget_amount)/1e9, 2) AS inflated_budget_B
FROM cos_gold.fact_budgetary_control;


-- ═════════════════════════════════════════════════════════════════════════════
-- DEMO 3: TIME TRAVEL — RECOVER PREVIOUS STATE
-- ═════════════════════════════════════════════════════════════════════════════
-- TALKING POINT: "Watch this. I can query the table as it was BEFORE the bad
-- update — without restoring anything. This is Iceberg time travel."

-- Step 1: See all snapshots (the bad update created a new one)
SELECT * FROM cos_gold."fact_budgetary_control$iceberg_history"
ORDER BY made_current_at DESC;
-- You'll see: latest snapshot = the bad update
--             previous snapshot = the correct state

-- Step 2: Query the PREVIOUS (correct) state using timestamp
-- Replace the timestamp below with the made_current_at from the SECOND row above
-- SELECT ROUND(SUM(budget_amount)/1e9, 2) AS correct_budget_B
-- FROM cos_gold.fact_budgetary_control
-- FOR TIMESTAMP AS OF TIMESTAMP '2025-05-12 12:00:00';

-- Step 3: Compare bad vs good side by side
-- (Use the snapshot_id from $iceberg_history for the previous good state)
-- SELECT 'CURRENT (BAD)' AS state, ROUND(SUM(budget_amount)/1e9, 2) AS budget_B
-- FROM cos_gold.fact_budgetary_control
-- UNION ALL
-- SELECT 'PREVIOUS (GOOD)', ROUND(SUM(budget_amount)/1e9, 2)
-- FROM cos_gold.fact_budgetary_control
-- FOR TIMESTAMP AS OF TIMESTAMP '<previous_timestamp>';

-- Step 4: Fix the data — restore correct values
-- In production, you'd MERGE from the previous snapshot or re-run the pipeline
UPDATE cos_gold.fact_budgetary_control
SET budget_amount = budget_amount / 2,
    funds_available = (budget_amount / 2) - actual_amount - encumbrance_amount,
    dw_load_date = CURRENT_TIMESTAMP
WHERE code_combination_id = 1001;

-- Verify recovery
SELECT ROUND(SUM(budget_amount)/1e9, 2) AS recovered_budget_B
FROM cos_gold.fact_budgetary_control;

-- TALKING POINT: "With raw Parquet, that recovery would take hours of
-- restoring from backup. With Iceberg, we queried the correct state
-- instantly and fixed it in seconds. Zero downtime."


-- ═════════════════════════════════════════════════════════════════════════════
-- DEMO 4: SCHEMA EVOLUTION — Oracle Fusion 26A Adds New Columns
-- ═════════════════════════════════════════════════════════════════════════════
-- TALKING POINT: "Oracle Fusion 26A is adding new segments to the Chart of
-- Accounts. With raw Parquet, we'd need to recreate every table and reload
-- all data. With Iceberg, we just add the column — zero downtime, zero
-- data movement."

-- Step 1: Add new columns (simulating Oracle 26A schema change)
ALTER TABLE cos_gold.fact_budgetary_control ADD COLUMNS (
    budget_revision_number int,
    approved_by string,
    revision_date timestamp
);

-- Step 2: Verify — old data still works perfectly (new columns show NULL)
SELECT
    code_combination_id,
    budget_amount,
    actual_amount,
    budget_revision_number,
    approved_by,
    revision_date
FROM cos_gold.fact_budgetary_control
WHERE code_combination_id = 1001
LIMIT 3;
-- Shows: budget_revision_number = NULL, approved_by = NULL (expected!)

-- Step 3: New data can populate the new columns
UPDATE cos_gold.fact_budgetary_control
SET budget_revision_number = 1,
    approved_by = 'CFO_Office',
    revision_date = CURRENT_TIMESTAMP
WHERE code_combination_id = 1001
  AND fiscal_year = 2025;

-- Step 4: Verify mixed state (old rows NULL, new rows populated)
SELECT
    code_combination_id,
    budget_amount,
    budget_revision_number,
    approved_by
FROM cos_gold.fact_budgetary_control
ORDER BY code_combination_id
LIMIT 10;

-- Step 5: Add column to dimension table too
ALTER TABLE cos_gold.dim_coa ADD COLUMNS (
    activity_code string,
    sub_account string
);

-- TALKING POINT: "No pipeline broke. No data was rewritten. Old queries
-- still work. New columns are available immediately. This is why Iceberg
-- is essential for Oracle Fusion environments where schema changes happen
-- every quarterly update."


-- ═════════════════════════════════════════════════════════════════════════════
-- DEMO 5: INCREMENTAL MERGE — Daily Oracle Fusion CDC
-- ═════════════════════════════════════════════════════════════════════════════
-- TALKING POINT: "Every morning, Oracle sends us only the records that
-- changed. We don't reload the entire table — we MERGE just the changes.
-- This is 98% more efficient than full reload."

-- Simulate daily incremental: Police got a budget increase + new actuals
MERGE INTO cos_gold.fact_budgetary_control AS target
USING (
    SELECT
        1 AS bc_key,
        1 AS coa_key,
        7 AS period_key,
        1001 AS code_combination_id,
        135000000.0 AS budget_amount,
        78000000.0 AS actual_amount,
        9500000.0 AS encumbrance_amount,
        5700000.0 AS commitment_amount,
        3800000.0 AS obligation_amount,
        78000000.0 AS expenditure_amount,
        47500000.0 AS funds_available,
        2025 AS fiscal_year,
        CURRENT_TIMESTAMP AS dw_load_date,
        2 AS budget_revision_number,
        'Budget_Committee' AS approved_by,
        CURRENT_TIMESTAMP AS revision_date
) AS source
ON target.code_combination_id = source.code_combination_id
   AND target.period_key = source.period_key
   AND target.fiscal_year = source.fiscal_year
WHEN MATCHED THEN UPDATE SET
    budget_amount = source.budget_amount,
    actual_amount = source.actual_amount,
    encumbrance_amount = source.encumbrance_amount,
    funds_available = source.funds_available,
    budget_revision_number = source.budget_revision_number,
    approved_by = source.approved_by,
    revision_date = source.revision_date,
    dw_load_date = source.dw_load_date
WHEN NOT MATCHED THEN INSERT (
    bc_key, coa_key, period_key, code_combination_id,
    budget_amount, actual_amount, encumbrance_amount,
    commitment_amount, obligation_amount, expenditure_amount,
    funds_available, fiscal_year, dw_load_date,
    budget_revision_number, approved_by, revision_date
) VALUES (
    source.bc_key, source.coa_key, source.period_key, source.code_combination_id,
    source.budget_amount, source.actual_amount, source.encumbrance_amount,
    source.commitment_amount, source.obligation_amount, source.expenditure_amount,
    source.funds_available, source.fiscal_year, source.dw_load_date,
    source.budget_revision_number, source.approved_by, source.revision_date
);

-- Verify the merge worked
SELECT
    code_combination_id,
    ROUND(budget_amount/1e6, 1) AS budget_M,
    ROUND(actual_amount/1e6, 1) AS actual_M,
    budget_revision_number,
    approved_by
FROM cos_gold.fact_budgetary_control
WHERE code_combination_id = 1001 AND period_key = 7;
-- Shows: budget = $135M (revised up from $125M), revision = 2

-- TALKING POINT: "Only 1 record was updated. The other 100+ records were
-- untouched. With raw Parquet, we'd have to rewrite the entire table
-- even for a single record change."


-- ═════════════════════════════════════════════════════════════════════════════
-- DEMO 6: SNAPSHOT VERSION CONTROL & AUDIT
-- ═════════════════════════════════════════════════════════════════════════════
-- TALKING POINT: "Every change creates an immutable snapshot. We have a
-- complete audit trail of every modification — who changed what, when."

-- View complete snapshot history
SELECT * FROM cos_gold."fact_budgetary_control$iceberg_history"
ORDER BY made_current_at DESC;

-- View snapshot details (records added/removed per snapshot)
SELECT * FROM cos_gold."fact_budgetary_control$snapshots"
ORDER BY committed_at DESC;

-- View physical data files
SELECT
    file_path,
    record_count,
    file_size_in_bytes
FROM cos_gold."fact_budgetary_control$files"
ORDER BY file_size_in_bytes DESC;

-- TALKING POINT: "This is your audit trail. Every INSERT, UPDATE, MERGE
-- is tracked as a snapshot. Auditors can see exactly what the data looked
-- like at any point in time. This is impossible with raw Parquet."


-- ═════════════════════════════════════════════════════════════════════════════
-- DEMO 7: ENTERPRISE SCENARIOS
-- ═════════════════════════════════════════════════════════════════════════════

-- ─── Scenario A: Compliance Audit ───
-- "The auditor asks: What was the Police budget on March 1st?"
-- SELECT budget_amount FROM cos_gold.fact_budgetary_control
-- FOR TIMESTAMP AS OF TIMESTAMP '2025-03-01 00:00:00'
-- WHERE code_combination_id = 1001;

-- ─── Scenario B: Historical Finance Reporting ───
-- "Generate Q2 report as it was at quarter-end (Dec 31)"
-- SELECT dc.department_description, SUM(f.budget_amount), SUM(f.actual_amount)
-- FROM cos_gold.fact_budgetary_control
-- FOR TIMESTAMP AS OF TIMESTAMP '2024-12-31 23:59:59' AS f
-- JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
-- GROUP BY dc.department_description;

-- ─── Scenario C: Concurrent ETL Safety ───
-- TALKING POINT: "Two Glue jobs writing to the same table won't corrupt
-- data. Iceberg uses optimistic concurrency — if there's a conflict,
-- the second writer retries automatically."

-- ─── Scenario D: Schema Drift Detection ───
-- "Oracle Fusion 26A added a column we didn't expect. Our pipeline
-- doesn't break — the new column just shows NULL until we handle it."
-- (Already demonstrated in Demo 4)


-- ═════════════════════════════════════════════════════════════════════════════
-- DEMO 8: WHY ICEBERG > RAW PARQUET (Summary Comparison)
-- ═════════════════════════════════════════════════════════════════════════════
-- TALKING POINT: "Let me summarize why we chose Iceberg over raw Parquet."

-- This query ONLY works because it's Iceberg:
-- 1. Time travel
SELECT 'Time Travel' AS feature, 'Query any historical state instantly' AS benefit;
-- 2. MERGE INTO
SELECT 'MERGE INTO' AS feature, 'Update single records without full table rewrite' AS benefit;
-- 3. Schema evolution
SELECT 'Schema Evolution' AS feature, 'Add columns without recreating tables or pipelines' AS benefit;
-- 4. Snapshot audit
SELECT 'Snapshot Audit' AS feature, 'Complete change history for compliance' AS benefit;
-- 5. ACID transactions
SELECT 'ACID Transactions' AS feature, 'No partial writes, no data corruption' AS benefit;
-- 6. Partition evolution
SELECT 'Partition Evolution' AS feature, 'Change partition strategy without rewriting data' AS benefit;

-- NONE of these work with raw Parquet on S3.
-- With raw Parquet you get:
--   ❌ No time travel (data is overwritten)
--   ❌ No MERGE (must rewrite entire table)
--   ❌ No schema evolution (must recreate table)
--   ❌ No audit trail (no snapshots)
--   ❌ No ACID (partial writes corrupt data)
--   ❌ No partition evolution (must rewrite all data)
