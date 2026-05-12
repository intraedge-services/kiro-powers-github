-- ═══════════════════════════════════════════════════════════════════════
-- COS UNIFIED LAKEHOUSE — BRONZE → SILVER
-- Deduplication + Fiscal Year Derivation + Metric Enrichment
-- Database: cos_silver
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO cos_silver.budget_control_clean
SELECT
    code_combination_id,
    period_name,
    budget_amount,
    actual_amount,
    encumbrance_amount,
    commitment_amount,
    obligation_amount,
    actual_amount AS expenditure_amount,
    budget_amount - actual_amount - encumbrance_amount AS funds_available,
    last_update_date,
    CURRENT_TIMESTAMP AS dw_insert_date,
    CURRENT_TIMESTAMP AS dw_update_date,
    CASE
        WHEN SUBSTR(period_name, 1, 3) IN ('JUL','AUG','SEP','OCT','NOV','DEC')
        THEN CAST(SUBSTR(period_name, 5, 4) AS INT) + 1
        ELSE CAST(SUBSTR(period_name, 5, 4) AS INT)
    END AS fiscal_year
FROM (
    SELECT *,
        ROW_NUMBER() OVER (
            PARTITION BY code_combination_id, period_name
            ORDER BY last_update_date DESC
        ) AS rn
    FROM cos_bronze.budget_control
)
WHERE rn = 1;

-- VERIFY
SELECT COUNT(*) AS silver_rows FROM cos_silver.budget_control_clean;

SELECT fiscal_year, COUNT(*) AS records, 
       ROUND(SUM(budget_amount)/1000000, 1) AS budget_millions
FROM cos_silver.budget_control_clean
GROUP BY fiscal_year;
