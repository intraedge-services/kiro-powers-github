-- ═══════════════════════════════════════════════════════════════════════
-- COS Financial Lakehouse — SILVER LAYER
-- Cleansed, deduplicated, standardized data
-- MERGE/Upsert processing with SCD Type 1 and Type 2
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. CREATE SILVER TABLES
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE cos_silver.budget_control_clean (
    code_combination_id     BIGINT,
    period_name             STRING,
    budget_amount           DECIMAL(18,2),
    actual_amount           DECIMAL(18,2),
    encumbrance_amount      DECIMAL(18,2),
    commitment_amount       DECIMAL(18,2),
    obligation_amount       DECIMAL(18,2),
    expenditure_amount      DECIMAL(18,2),
    funds_available         DECIMAL(18,2),
    last_update_date        TIMESTAMP,
    dw_insert_date          TIMESTAMP,
    dw_update_date          TIMESTAMP
)
PARTITIONED BY (fiscal_year INT)
LOCATION 's3://cos-financial-lakehouse/silver/budget_control_clean/'
TBLPROPERTIES (
    'table_type'            = 'ICEBERG',
    'format-version'        = '2',
    'write.format.default'  = 'parquet',
    'write.delete.mode'     = 'merge-on-read',
    'write.update.mode'     = 'merge-on-read',
    'write.merge.mode'      = 'merge-on-read'
);

CREATE TABLE cos_silver.gl_balances_clean (
    ledger_id               BIGINT,
    code_combination_id     BIGINT,
    period_name             STRING,
    currency_code           STRING,
    begin_balance_dr        DECIMAL(18,2),
    begin_balance_cr        DECIMAL(18,2),
    period_net_dr           DECIMAL(18,2),
    period_net_cr           DECIMAL(18,2),
    net_amount              DECIMAL(18,2),  -- derived: (DR - CR)
    last_update_date        TIMESTAMP,
    dw_insert_date          TIMESTAMP,
    dw_update_date          TIMESTAMP
)
PARTITIONED BY (fiscal_year INT)
LOCATION 's3://cos-financial-lakehouse/silver/gl_balances_clean/'
TBLPROPERTIES (
    'table_type'            = 'ICEBERG',
    'format-version'        = '2',
    'write.format.default'  = 'parquet',
    'write.delete.mode'     = 'merge-on-read',
    'write.update.mode'     = 'merge-on-read',
    'write.merge.mode'      = 'merge-on-read'
);

CREATE TABLE cos_silver.ap_invoices_clean (
    invoice_id              BIGINT,
    invoice_number          STRING,
    vendor_id               BIGINT,
    invoice_amount          DECIMAL(18,2),
    amount_paid             DECIMAL(18,2),
    payment_status_flag     STRING,
    invoice_date            DATE,
    code_combination_id     BIGINT,
    po_header_id            BIGINT,
    period_name             STRING,
    last_update_date        TIMESTAMP,
    dw_insert_date          TIMESTAMP,
    dw_update_date          TIMESTAMP
)
PARTITIONED BY (fiscal_year INT)
LOCATION 's3://cos-financial-lakehouse/silver/ap_invoices_clean/'
TBLPROPERTIES (
    'table_type'            = 'ICEBERG',
    'format-version'        = '2',
    'write.format.default'  = 'parquet',
    'write.delete.mode'     = 'merge-on-read',
    'write.update.mode'     = 'merge-on-read',
    'write.merge.mode'      = 'merge-on-read'
);


-- ─────────────────────────────────────────────────────────────────────
-- 2. MERGE/UPSERT — SCD Type 1 (Overwrite with latest)
-- ─────────────────────────────────────────────────────────────────────

-- Budget Control: MERGE on (code_combination_id + period_name)
-- SCD Type 1: Always keep latest values

MERGE INTO cos_silver.budget_control_clean AS target
USING (
    -- Deduplicate Bronze: take latest record per key
    SELECT *
    FROM (
        SELECT
            code_combination_id,
            period_name,
            budget_amount,
            actual_amount,
            encumbrance_amount,
            commitment_amount,
            obligation_amount,
            budget_amount - actual_amount - encumbrance_amount AS funds_available,
            last_update_date,
            -- Derive fiscal year from period_name (e.g., 'JUL-2024' → 2025)
            CASE
                WHEN SUBSTRING(period_name, 1, 3) IN ('JUL','AUG','SEP','OCT','NOV','DEC')
                THEN CAST(SUBSTRING(period_name, 5, 4) AS INT) + 1
                ELSE CAST(SUBSTRING(period_name, 5, 4) AS INT)
            END AS fiscal_year,
            ROW_NUMBER() OVER (
                PARTITION BY code_combination_id, period_name
                ORDER BY last_update_date DESC
            ) AS rn
        FROM cos_bronze.budget_control
        WHERE ingestion_date = '${CURRENT_DATE}'
    )
    WHERE rn = 1
) AS source
ON target.code_combination_id = source.code_combination_id
   AND target.period_name = source.period_name

WHEN MATCHED AND source.last_update_date > target.last_update_date THEN
    UPDATE SET
        budget_amount       = source.budget_amount,
        actual_amount       = source.actual_amount,
        encumbrance_amount  = source.encumbrance_amount,
        commitment_amount   = source.commitment_amount,
        obligation_amount   = source.obligation_amount,
        funds_available     = source.funds_available,
        last_update_date    = source.last_update_date,
        dw_update_date      = CURRENT_TIMESTAMP

WHEN NOT MATCHED THEN
    INSERT (
        code_combination_id, period_name, budget_amount, actual_amount,
        encumbrance_amount, commitment_amount, obligation_amount,
        expenditure_amount, funds_available, last_update_date,
        dw_insert_date, dw_update_date, fiscal_year
    )
    VALUES (
        source.code_combination_id, source.period_name, source.budget_amount,
        source.actual_amount, source.encumbrance_amount, source.commitment_amount,
        source.obligation_amount, 0, source.funds_available,
        source.last_update_date, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
        source.fiscal_year
    );


-- GL Balances: MERGE on (ledger_id + code_combination_id + period_name)

MERGE INTO cos_silver.gl_balances_clean AS target
USING (
    SELECT *
    FROM (
        SELECT
            ledger_id,
            code_combination_id,
            period_name,
            currency_code,
            begin_balance_dr,
            begin_balance_cr,
            period_net_dr,
            period_net_cr,
            (period_net_dr - period_net_cr) AS net_amount,
            last_update_date,
            CASE
                WHEN SUBSTRING(period_name, 1, 3) IN ('JUL','AUG','SEP','OCT','NOV','DEC')
                THEN CAST(SUBSTRING(period_name, 5, 4) AS INT) + 1
                ELSE CAST(SUBSTRING(period_name, 5, 4) AS INT)
            END AS fiscal_year,
            ROW_NUMBER() OVER (
                PARTITION BY ledger_id, code_combination_id, period_name
                ORDER BY last_update_date DESC
            ) AS rn
        FROM cos_bronze.gl_balances
        WHERE ingestion_date = '${CURRENT_DATE}'
    )
    WHERE rn = 1
) AS source
ON target.ledger_id = source.ledger_id
   AND target.code_combination_id = source.code_combination_id
   AND target.period_name = source.period_name

WHEN MATCHED AND source.last_update_date > target.last_update_date THEN
    UPDATE SET
        begin_balance_dr    = source.begin_balance_dr,
        begin_balance_cr    = source.begin_balance_cr,
        period_net_dr       = source.period_net_dr,
        period_net_cr       = source.period_net_cr,
        net_amount          = source.net_amount,
        last_update_date    = source.last_update_date,
        dw_update_date      = CURRENT_TIMESTAMP

WHEN NOT MATCHED THEN
    INSERT (
        ledger_id, code_combination_id, period_name, currency_code,
        begin_balance_dr, begin_balance_cr, period_net_dr, period_net_cr,
        net_amount, last_update_date, dw_insert_date, dw_update_date, fiscal_year
    )
    VALUES (
        source.ledger_id, source.code_combination_id, source.period_name,
        source.currency_code, source.begin_balance_dr, source.begin_balance_cr,
        source.period_net_dr, source.period_net_cr, source.net_amount,
        source.last_update_date, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP,
        source.fiscal_year
    );


-- AP Invoices: MERGE on invoice_id

MERGE INTO cos_silver.ap_invoices_clean AS target
USING (
    SELECT *
    FROM (
        SELECT
            invoice_id, invoice_number, vendor_id, invoice_amount,
            amount_paid, payment_status_flag, invoice_date,
            code_combination_id, po_header_id, period_name,
            last_update_date,
            CASE
                WHEN SUBSTRING(period_name, 1, 3) IN ('JUL','AUG','SEP','OCT','NOV','DEC')
                THEN CAST(SUBSTRING(period_name, 5, 4) AS INT) + 1
                ELSE CAST(SUBSTRING(period_name, 5, 4) AS INT)
            END AS fiscal_year,
            ROW_NUMBER() OVER (
                PARTITION BY invoice_id
                ORDER BY last_update_date DESC
            ) AS rn
        FROM cos_bronze.ap_invoices
        WHERE ingestion_date = '${CURRENT_DATE}'
    )
    WHERE rn = 1
) AS source
ON target.invoice_id = source.invoice_id

WHEN MATCHED AND source.last_update_date > target.last_update_date THEN
    UPDATE SET
        invoice_amount      = source.invoice_amount,
        amount_paid         = source.amount_paid,
        payment_status_flag = source.payment_status_flag,
        last_update_date    = source.last_update_date,
        dw_update_date      = CURRENT_TIMESTAMP

WHEN NOT MATCHED THEN
    INSERT (
        invoice_id, invoice_number, vendor_id, invoice_amount, amount_paid,
        payment_status_flag, invoice_date, code_combination_id, po_header_id,
        period_name, last_update_date, dw_insert_date, dw_update_date, fiscal_year
    )
    VALUES (
        source.invoice_id, source.invoice_number, source.vendor_id,
        source.invoice_amount, source.amount_paid, source.payment_status_flag,
        source.invoice_date, source.code_combination_id, source.po_header_id,
        source.period_name, source.last_update_date,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, source.fiscal_year
    );


-- ─────────────────────────────────────────────────────────────────────
-- 3. SCD TYPE 2 — Supplier Dimension (tracks historical changes)
-- ─────────────────────────────────────────────────────────────────────

-- Close existing record and insert new version when status/terms change

MERGE INTO cos_silver.supplier_master AS target
USING (
    SELECT DISTINCT
        vendor_id,
        supplier_name,
        supplier_status,
        payment_terms,
        commodity_category,
        last_update_date
    FROM cos_bronze.ap_invoices
    WHERE ingestion_date = '${CURRENT_DATE}'
) AS source
ON target.vendor_id = source.vendor_id
   AND target.is_current = TRUE

-- Status or terms changed → close old record
WHEN MATCHED
    AND (target.supplier_status != source.supplier_status
         OR target.payment_terms != source.payment_terms)
THEN UPDATE SET
    is_current          = FALSE,
    effective_end_date  = CURRENT_DATE,
    dw_update_date      = CURRENT_TIMESTAMP

-- No change → just update timestamp
WHEN MATCHED THEN UPDATE SET
    dw_update_date      = CURRENT_TIMESTAMP

-- New supplier
WHEN NOT MATCHED THEN INSERT (
    vendor_id, supplier_name, supplier_status, payment_terms,
    commodity_category, effective_start_date, effective_end_date,
    is_current, dw_insert_date, dw_update_date
)
VALUES (
    source.vendor_id, source.supplier_name, source.supplier_status,
    source.payment_terms, source.commodity_category,
    CURRENT_DATE, DATE '9999-12-31', TRUE,
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
);

-- Insert new version for changed suppliers
INSERT INTO cos_silver.supplier_master
SELECT
    s.vendor_id,
    s.supplier_name,
    s.supplier_status,
    s.payment_terms,
    s.commodity_category,
    CURRENT_DATE        AS effective_start_date,
    DATE '9999-12-31'   AS effective_end_date,
    TRUE                AS is_current,
    CURRENT_TIMESTAMP   AS dw_insert_date,
    CURRENT_TIMESTAMP   AS dw_update_date
FROM cos_bronze.ap_invoices s
JOIN cos_silver.supplier_master t
    ON t.vendor_id = s.vendor_id
    AND t.is_current = FALSE
    AND t.effective_end_date = CURRENT_DATE
WHERE s.ingestion_date = '${CURRENT_DATE}';


-- ─────────────────────────────────────────────────────────────────────
-- 4. VERIFY SILVER PROCESSING
-- ─────────────────────────────────────────────────────────────────────

-- Check merge results
SELECT
    'budget_control' AS table_name,
    COUNT(*) AS total_records,
    SUM(CASE WHEN dw_update_date = dw_insert_date THEN 1 ELSE 0 END) AS new_records,
    SUM(CASE WHEN dw_update_date > dw_insert_date THEN 1 ELSE 0 END) AS updated_records
FROM cos_silver.budget_control_clean

UNION ALL

SELECT
    'gl_balances',
    COUNT(*),
    SUM(CASE WHEN dw_update_date = dw_insert_date THEN 1 ELSE 0 END),
    SUM(CASE WHEN dw_update_date > dw_insert_date THEN 1 ELSE 0 END)
FROM cos_silver.gl_balances_clean

UNION ALL

SELECT
    'ap_invoices',
    COUNT(*),
    SUM(CASE WHEN dw_update_date = dw_insert_date THEN 1 ELSE 0 END),
    SUM(CASE WHEN dw_update_date > dw_insert_date THEN 1 ELSE 0 END)
FROM cos_silver.ap_invoices_clean;
