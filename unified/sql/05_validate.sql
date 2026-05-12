-- ═══════════════════════════════════════════════════════════════════════
-- COS UNIFIED LAKEHOUSE — VALIDATION & ANALYTICS QUERIES
-- Run in Athena | Database: cos_gold
-- ═══════════════════════════════════════════════════════════════════════

-- 1. ROW COUNTS
SELECT 'bronze' AS layer, COUNT(*) AS rows FROM cos_bronze.budget_control
UNION ALL SELECT 'silver', COUNT(*) FROM cos_silver.budget_control_clean
UNION ALL SELECT 'gold_fact', COUNT(*) FROM cos_gold.fact_budgetary_control
UNION ALL SELECT 'dim_coa', COUNT(*) FROM cos_gold.dim_coa
UNION ALL SELECT 'dim_period', COUNT(*) FROM cos_gold.dim_period
UNION ALL SELECT 'dim_supplier', COUNT(*) FROM cos_gold.dim_supplier;

-- 2. EXECUTIVE KPIs
SELECT
    ROUND(SUM(budget_amount)/1000000000, 2) AS total_budget_billions,
    ROUND(SUM(actual_amount)/1000000000, 2) AS total_actual_billions,
    ROUND(SUM(funds_available)/1000000000, 2) AS available_billions,
    ROUND(SUM(actual_amount)/SUM(budget_amount)*100, 1) AS burn_rate_pct
FROM cos_gold.fact_budgetary_control;

-- 3. BUDGET BY DEPARTMENT
SELECT
    dc.department_description,
    dc.fund_description,
    ROUND(SUM(f.budget_amount)/1000000, 1) AS budget_M,
    ROUND(SUM(f.actual_amount)/1000000, 1) AS actual_M,
    ROUND(SUM(f.funds_available)/1000000, 1) AS available_M,
    ROUND(SUM(f.actual_amount)/SUM(f.budget_amount)*100, 1) AS burn_pct,
    CASE
        WHEN SUM(f.actual_amount)/SUM(f.budget_amount) >= 0.85 THEN 'CRITICAL'
        WHEN SUM(f.actual_amount)/SUM(f.budget_amount) >= 0.70 THEN 'WARNING'
        ELSE 'ON TRACK'
    END AS status
FROM cos_gold.fact_budgetary_control f
JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
GROUP BY dc.department_description, dc.fund_description
ORDER BY burn_pct DESC;

-- 4. FUNDS AVAILABLE ANALYSIS
SELECT
    dc.department_description,
    ROUND(SUM(f.funds_available)/1000000, 1) AS available_M,
    CASE
        WHEN SUM(f.funds_available) < 0 THEN 'OVER BUDGET'
        WHEN SUM(f.funds_available)/SUM(f.budget_amount) < 0.05 THEN 'CRITICAL'
        WHEN SUM(f.funds_available)/SUM(f.budget_amount) < 0.15 THEN 'LOW'
        ELSE 'HEALTHY'
    END AS funds_status
FROM cos_gold.fact_budgetary_control f
JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
GROUP BY dc.department_description
ORDER BY available_M ASC;

-- 5. QUARTERLY TREND
SELECT
    dp.fiscal_quarter,
    ROUND(SUM(f.budget_amount)/1000000, 0) AS budget_M,
    ROUND(SUM(f.actual_amount)/1000000, 0) AS actual_M,
    ROUND(SUM(f.encumbrance_amount)/1000000, 0) AS encumbrance_M
FROM cos_gold.fact_budgetary_control f
JOIN cos_gold.dim_period dp ON dp.period_key = f.period_key
GROUP BY dp.fiscal_quarter
ORDER BY dp.fiscal_quarter;

-- 6. MONTHLY SPEND TREND
SELECT
    dp.calendar_month_name,
    dp.fiscal_month,
    ROUND(SUM(f.actual_amount)/1000000, 1) AS spend_M,
    COUNT(*) AS line_items
FROM cos_gold.fact_budgetary_control f
JOIN cos_gold.dim_period dp ON dp.period_key = f.period_key
GROUP BY dp.calendar_month_name, dp.fiscal_month
ORDER BY dp.fiscal_month;

-- 7. FUND COMPARISON
SELECT
    dc.fund_description,
    COUNT(DISTINCT dc.department_description) AS departments,
    ROUND(SUM(f.budget_amount)/1000000, 0) AS budget_M,
    ROUND(SUM(f.actual_amount)/1000000, 0) AS actual_M,
    ROUND(SUM(f.actual_amount)/SUM(f.budget_amount)*100, 1) AS utilization
FROM cos_gold.fact_budgetary_control f
JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
GROUP BY dc.fund_description
ORDER BY budget_M DESC;

-- 8. OVER-BUDGET DEPARTMENTS (negative funds_available)
SELECT
    dc.department_description,
    dp.period_name,
    f.budget_amount,
    f.actual_amount,
    f.funds_available
FROM cos_gold.fact_budgetary_control f
JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
JOIN cos_gold.dim_period dp ON dp.period_key = f.period_key
WHERE f.funds_available < 0
ORDER BY f.funds_available ASC;

-- 9. ICEBERG TIME TRAVEL (snapshot history)
SELECT * FROM cos_gold."fact_budgetary_control$iceberg_history"
ORDER BY made_current_at DESC;

-- 10. ICEBERG FILES (data file inventory)
SELECT * FROM cos_gold."fact_budgetary_control$files"
ORDER BY file_size_in_bytes DESC;
