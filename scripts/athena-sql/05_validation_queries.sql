-- ═══════════════════════════════════════════════════════════════════════
-- COS Financial Lakehouse — VALIDATION QUERIES
-- Run these to verify the lakehouse is fully operational
-- Run in Athena Query Editor | Database: cos_gold
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. ROW COUNTS — Verify all layers populated
-- ─────────────────────────────────────────────────────────────────────

SELECT 'cos_bronze.budget_control' AS table_name, COUNT(*) AS row_count FROM cos_bronze.budget_control
UNION ALL
SELECT 'cos_silver.budget_control_clean', COUNT(*) FROM cos_silver.budget_control_clean
UNION ALL
SELECT 'cos_gold.dim_coa', COUNT(*) FROM cos_gold.dim_coa
UNION ALL
SELECT 'cos_gold.dim_period', COUNT(*) FROM cos_gold.dim_period
UNION ALL
SELECT 'cos_gold.dim_supplier', COUNT(*) FROM cos_gold.dim_supplier
UNION ALL
SELECT 'cos_gold.fact_budgetary_control', COUNT(*) FROM cos_gold.fact_budgetary_control;

-- ─────────────────────────────────────────────────────────────────────
-- 2. EXECUTIVE KPIs — Total Budget Overview
-- ─────────────────────────────────────────────────────────────────────

SELECT
    SUM(budget_amount) AS total_budget,
    SUM(actual_amount) AS total_actual,
    SUM(encumbrance_amount) AS total_encumbrance,
    SUM(funds_available) AS total_available,
    ROUND(SUM(actual_amount) / SUM(budget_amount) * 100, 1) AS burn_rate_pct
FROM cos_gold.fact_budgetary_control;

-- ─────────────────────────────────────────────────────────────────────
-- 3. BUDGET BY DEPARTMENT — Top spenders
-- ─────────────────────────────────────────────────────────────────────

SELECT
    dc.department_description,
    dc.fund_description,
    SUM(f.budget_amount) AS total_budget,
    SUM(f.actual_amount) AS total_actual,
    SUM(f.funds_available) AS available,
    ROUND(SUM(f.actual_amount) / SUM(f.budget_amount) * 100, 1) AS burn_rate_pct,
    CASE
        WHEN SUM(f.actual_amount) / SUM(f.budget_amount) >= 0.85 THEN 'CRITICAL'
        WHEN SUM(f.actual_amount) / SUM(f.budget_amount) >= 0.70 THEN 'WARNING'
        ELSE 'ON TRACK'
    END AS status
FROM cos_gold.fact_budgetary_control f
JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
GROUP BY dc.department_description, dc.fund_description
ORDER BY burn_rate_pct DESC;

-- ─────────────────────────────────────────────────────────────────────
-- 4. AVAILABLE FUNDS ANALYSIS — Departments at risk
-- ─────────────────────────────────────────────────────────────────────

SELECT
    dc.department_description,
    SUM(f.budget_amount) AS budget,
    SUM(f.funds_available) AS available,
    ROUND(SUM(f.funds_available) / SUM(f.budget_amount) * 100, 1) AS pct_remaining,
    CASE
        WHEN SUM(f.funds_available) < 0 THEN 'OVER BUDGET'
        WHEN SUM(f.funds_available) / SUM(f.budget_amount) < 0.10 THEN 'CRITICAL'
        WHEN SUM(f.funds_available) / SUM(f.budget_amount) < 0.20 THEN 'LOW'
        ELSE 'HEALTHY'
    END AS funds_status
FROM cos_gold.fact_budgetary_control f
JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
GROUP BY dc.department_description
ORDER BY pct_remaining ASC;

-- ─────────────────────────────────────────────────────────────────────
-- 5. MONTHLY TREND — Budget vs Actual over time
-- ─────────────────────────────────────────────────────────────────────

SELECT
    dp.period_name,
    dp.fiscal_month,
    dp.calendar_month_name,
    SUM(f.budget_amount) AS budget,
    SUM(f.actual_amount) AS actual,
    SUM(f.encumbrance_amount) AS encumbrance,
    SUM(f.funds_available) AS available
FROM cos_gold.fact_budgetary_control f
JOIN cos_gold.dim_period dp ON dp.period_key = f.period_key
GROUP BY dp.period_name, dp.fiscal_month, dp.calendar_month_name
ORDER BY dp.fiscal_month;

-- ─────────────────────────────────────────────────────────────────────
-- 6. FUND ANALYSIS — Cross-fund comparison
-- ─────────────────────────────────────────────────────────────────────

SELECT
    dc.fund_description,
    COUNT(DISTINCT dc.department_description) AS departments,
    SUM(f.budget_amount) AS total_budget,
    SUM(f.actual_amount) AS total_actual,
    SUM(f.encumbrance_amount) AS total_encumbrance,
    ROUND(SUM(f.actual_amount) / SUM(f.budget_amount) * 100, 1) AS utilization_pct
FROM cos_gold.fact_budgetary_control f
JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
GROUP BY dc.fund_description
ORDER BY total_budget DESC;

-- ─────────────────────────────────────────────────────────────────────
-- 7. ACCOUNT TYPE ANALYSIS — Spend by category
-- ─────────────────────────────────────────────────────────────────────

SELECT
    dc.account_description,
    COUNT(*) AS line_items,
    SUM(f.budget_amount) AS budget,
    SUM(f.actual_amount) AS actual,
    ROUND(SUM(f.actual_amount) / SUM(f.budget_amount) * 100, 1) AS spend_pct
FROM cos_gold.fact_budgetary_control f
JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
GROUP BY dc.account_description
ORDER BY actual DESC;

-- ─────────────────────────────────────────────────────────────────────
-- 8. ICEBERG TIME TRAVEL — Snapshot history
-- ─────────────────────────────────────────────────────────────────────

-- View all snapshots (shows each INSERT as a separate snapshot)
SELECT * FROM cos_gold.fact_budgetary_control$iceberg_history
ORDER BY made_current_at DESC;

-- Time travel: query at a specific timestamp
-- (Replace timestamp with one from snapshot history above)
-- SELECT * FROM cos_gold.fact_budgetary_control
-- FOR TIMESTAMP AS OF TIMESTAMP '2025-05-08 12:00:00';

-- ─────────────────────────────────────────────────────────────────────
-- 9. ICEBERG METADATA — Table health
-- ─────────────────────────────────────────────────────────────────────

-- View data files
SELECT * FROM cos_gold."fact_budgetary_control$files"
ORDER BY file_size_in_bytes DESC;

-- View snapshots
SELECT * FROM cos_gold."fact_budgetary_control$snapshots"
ORDER BY committed_at DESC;

-- ─────────────────────────────────────────────────────────────────────
-- 10. SCHEMA EVOLUTION DEMO
-- ─────────────────────────────────────────────────────────────────────

-- Add a new column without recreating the table:
-- ALTER TABLE cos_gold.fact_budgetary_control ADD COLUMNS (budget_revision int);

-- Existing rows will show NULL for the new column
-- New inserts can populate it
-- No data rewrite required — this is Iceberg's key advantage
