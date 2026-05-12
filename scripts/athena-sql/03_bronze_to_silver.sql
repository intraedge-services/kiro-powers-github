-- ═══════════════════════════════════════════════════════════════════════
-- COS Financial Lakehouse — BRONZE → SILVER Transformation
-- Deduplicates, enriches, derives fiscal year, calculates metrics
-- Run in Athena Query Editor | Database: cos_silver
-- ═══════════════════════════════════════════════════════════════════════

-- Transform and load: deduplicate by (ccid + period), derive fiscal year
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

-- VERIFY: Should match Bronze count (after dedup)
SELECT COUNT(*) AS silver_row_count FROM cos_silver.budget_control_clean;

-- Sample verification: check fiscal year derivation
SELECT
    period_name,
    fiscal_year,
    code_combination_id,
    budget_amount,
    actual_amount,
    funds_available
FROM cos_silver.budget_control_clean
WHERE code_combination_id = 1001
ORDER BY period_name
LIMIT 12;
