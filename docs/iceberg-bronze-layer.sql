-- ═══════════════════════════════════════════════════════════════════════
-- COS Financial Lakehouse — BRONZE LAYER
-- Raw append-only ingestion from Oracle Fusion 25D BICC extracts
-- No transformations — full history preserved
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- 1. CREATE BRONZE TABLES (Athena / Glue Catalog)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE cos_bronze.gl_balances (
    ledger_id               BIGINT,
    code_combination_id     BIGINT,
    period_name             STRING,
    currency_code           STRING,
    actual_flag             STRING,
    begin_balance_dr        DECIMAL(18,2),
    begin_balance_cr        DECIMAL(18,2),
    period_net_dr           DECIMAL(18,2),
    period_net_cr           DECIMAL(18,2),
    last_update_date        TIMESTAMP,
    creation_date           TIMESTAMP,
    -- Ingestion metadata
    bicc_extract_id         STRING,
    ingestion_timestamp     TIMESTAMP
)
PARTITIONED BY (ingestion_date STRING)
LOCATION 's3://cos-financial-lakehouse/bronze/gl_balances/'
TBLPROPERTIES (
    'table_type'            = 'ICEBERG',
    'format-version'        = '2',
    'write.format.default'  = 'parquet',
    'write.parquet.compression-codec' = 'snappy'
);

CREATE TABLE cos_bronze.budget_control (
    code_combination_id     BIGINT,
    period_name             STRING,
    budget_name             STRING,
    budget_amount           DECIMAL(18,2),
    actual_amount           DECIMAL(18,2),
    encumbrance_amount      DECIMAL(18,2),
    commitment_amount       DECIMAL(18,2),
    obligation_amount       DECIMAL(18,2),
    funds_available         DECIMAL(18,2),
    last_update_date        TIMESTAMP,
    creation_date           TIMESTAMP,
    -- Ingestion metadata
    bicc_extract_id         STRING,
    ingestion_timestamp     TIMESTAMP
)
PARTITIONED BY (ingestion_date STRING)
LOCATION 's3://cos-financial-lakehouse/bronze/budget_control/'
TBLPROPERTIES (
    'table_type'            = 'ICEBERG',
    'format-version'        = '2',
    'write.format.default'  = 'parquet',
    'write.parquet.compression-codec' = 'snappy'
);

CREATE TABLE cos_bronze.ap_invoices (
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
    creation_date           TIMESTAMP,
    -- Ingestion metadata
    bicc_extract_id         STRING,
    ingestion_timestamp     TIMESTAMP
)
PARTITIONED BY (ingestion_date STRING)
LOCATION 's3://cos-financial-lakehouse/bronze/ap_invoices/'
TBLPROPERTIES (
    'table_type'            = 'ICEBERG',
    'format-version'        = '2',
    'write.format.default'  = 'parquet',
    'write.parquet.compression-codec' = 'snappy'
);

CREATE TABLE cos_bronze.po_headers (
    po_header_id            BIGINT,
    po_number               STRING,
    vendor_id               BIGINT,
    total_amount            DECIMAL(18,2),
    amount_received         DECIMAL(18,2),
    amount_billed           DECIMAL(18,2),
    closed_code             STRING,
    code_combination_id     BIGINT,
    period_name             STRING,
    last_update_date        TIMESTAMP,
    creation_date           TIMESTAMP,
    -- Ingestion metadata
    bicc_extract_id         STRING,
    ingestion_timestamp     TIMESTAMP
)
PARTITIONED BY (ingestion_date STRING)
LOCATION 's3://cos-financial-lakehouse/bronze/po_headers/'
TBLPROPERTIES (
    'table_type'            = 'ICEBERG',
    'format-version'        = '2',
    'write.format.default'  = 'parquet',
    'write.parquet.compression-codec' = 'snappy'
);


-- ─────────────────────────────────────────────────────────────────────
-- 2. BRONZE INGESTION — Append-only INSERT (daily BICC load)
-- ─────────────────────────────────────────────────────────────────────

-- Example: Load today's BICC extract into Bronze
-- This is append-only — we NEVER update or delete in Bronze

INSERT INTO cos_bronze.gl_balances
SELECT
    ledger_id,
    code_combination_id,
    period_name,
    currency_code,
    actual_flag,
    begin_balance_dr,
    begin_balance_cr,
    period_net_dr,
    period_net_cr,
    last_update_date,
    creation_date,
    '${BICC_EXTRACT_ID}'        AS bicc_extract_id,
    CURRENT_TIMESTAMP           AS ingestion_timestamp,
    '${CURRENT_DATE}'           AS ingestion_date
FROM staging.bicc_gl_balances_raw;

INSERT INTO cos_bronze.budget_control
SELECT
    code_combination_id,
    period_name,
    budget_name,
    budget_amount,
    actual_amount,
    encumbrance_amount,
    commitment_amount,
    obligation_amount,
    funds_available,
    last_update_date,
    creation_date,
    '${BICC_EXTRACT_ID}'        AS bicc_extract_id,
    CURRENT_TIMESTAMP           AS ingestion_timestamp,
    '${CURRENT_DATE}'           AS ingestion_date
FROM staging.bicc_budget_control_raw;

INSERT INTO cos_bronze.ap_invoices
SELECT
    invoice_id,
    invoice_number,
    vendor_id,
    invoice_amount,
    amount_paid,
    payment_status_flag,
    invoice_date,
    code_combination_id,
    po_header_id,
    period_name,
    last_update_date,
    creation_date,
    '${BICC_EXTRACT_ID}'        AS bicc_extract_id,
    CURRENT_TIMESTAMP           AS ingestion_timestamp,
    '${CURRENT_DATE}'           AS ingestion_date
FROM staging.bicc_ap_invoices_raw;


-- ─────────────────────────────────────────────────────────────────────
-- 3. VERIFY BRONZE INGESTION
-- ─────────────────────────────────────────────────────────────────────

-- Check latest ingestion
SELECT
    ingestion_date,
    COUNT(*) AS record_count,
    MAX(ingestion_timestamp) AS latest_load
FROM cos_bronze.gl_balances
GROUP BY ingestion_date
ORDER BY ingestion_date DESC
LIMIT 5;

-- Check snapshot created
SELECT * FROM cos_bronze.gl_balances.snapshots
ORDER BY committed_at DESC LIMIT 3;
