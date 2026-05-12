-- ═══════════════════════════════════════════════════════════════════════
-- COS Financial Lakehouse — Create Iceberg Tables in Athena
-- Run these in the Athena console using workgroup: cos-financial-lakehouse
-- ═══════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────
-- GOLD LAYER — Dimension Tables
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE cos_gold.dim_coa (
    coa_key                 BIGINT,
    code_combination_id     BIGINT,
    fund                    STRING,
    fund_description        STRING,
    department              STRING,
    department_description  STRING,
    account                 STRING,
    account_description     STRING,
    project                 STRING,
    program_grant           STRING,
    account_type            STRING,
    enabled_flag            STRING,
    effective_start_date    DATE,
    effective_end_date      DATE,
    is_current              BOOLEAN,
    dw_load_date            TIMESTAMP
)
LOCATION 's3://cos-financial-lakehouse-demo/gold/dim_coa/'
TBLPROPERTIES (
    'table_type'       = 'ICEBERG',
    'format-version'   = '2',
    'write.format.default' = 'parquet',
    'write.parquet.compression-codec' = 'zstd'
);

CREATE TABLE cos_gold.dim_period (
    period_key              BIGINT,
    period_name             STRING,
    fiscal_year             INT,
    fiscal_quarter          INT,
    fiscal_month            INT,
    calendar_year           INT,
    calendar_month          INT,
    calendar_month_name     STRING,
    period_start_date       DATE,
    period_end_date         DATE,
    is_current_period       BOOLEAN,
    dw_load_date            TIMESTAMP
)
LOCATION 's3://cos-financial-lakehouse-demo/gold/dim_period/'
TBLPROPERTIES (
    'table_type'       = 'ICEBERG',
    'format-version'   = '2',
    'write.format.default' = 'parquet'
);

CREATE TABLE cos_gold.dim_supplier (
    supplier_key            BIGINT,
    vendor_id               BIGINT,
    supplier_name           STRING,
    supplier_number         STRING,
    supplier_status         STRING,
    payment_terms           STRING,
    commodity_category      STRING,
    effective_start_date    DATE,
    effective_end_date      DATE,
    is_current              BOOLEAN,
    dw_load_date            TIMESTAMP
)
LOCATION 's3://cos-financial-lakehouse-demo/gold/dim_supplier/'
TBLPROPERTIES (
    'table_type'       = 'ICEBERG',
    'format-version'   = '2',
    'write.format.default' = 'parquet'
);

CREATE TABLE cos_gold.dim_ledger (
    ledger_key              BIGINT,
    ledger_id               BIGINT,
    ledger_name             STRING,
    currency_code           STRING,
    chart_of_accounts_id    BIGINT,
    is_current              BOOLEAN,
    dw_load_date            TIMESTAMP
)
LOCATION 's3://cos-financial-lakehouse-demo/gold/dim_ledger/'
TBLPROPERTIES (
    'table_type'       = 'ICEBERG',
    'format-version'   = '2',
    'write.format.default' = 'parquet'
);

-- ─────────────────────────────────────────────────────────────────────
-- GOLD LAYER — Fact Tables (Partitioned)
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE cos_gold.fact_budgetary_control (
    bc_key                  BIGINT,
    coa_key                 BIGINT,
    period_key              BIGINT,
    code_combination_id     BIGINT,
    budget_amount           DECIMAL(18,2),
    actual_amount           DECIMAL(18,2),
    encumbrance_amount      DECIMAL(18,2),
    commitment_amount       DECIMAL(18,2),
    obligation_amount       DECIMAL(18,2),
    expenditure_amount      DECIMAL(18,2),
    funds_available         DECIMAL(18,2),
    dw_load_date            TIMESTAMP
)
PARTITIONED BY (fiscal_year INT)
LOCATION 's3://cos-financial-lakehouse-demo/gold/fact_budgetary_control/'
TBLPROPERTIES (
    'table_type'                    = 'ICEBERG',
    'format-version'                = '2',
    'write.format.default'          = 'parquet',
    'write.parquet.compression-codec' = 'zstd',
    'write.distribution-mode'       = 'hash',
    'write.delete.mode'             = 'merge-on-read',
    'write.update.mode'             = 'merge-on-read',
    'write.merge.mode'              = 'merge-on-read',
    'write.target-file-size-bytes'  = '268435456',
    'commit.retry.num-retries'      = '4'
);

CREATE TABLE cos_gold.fact_gl_actuals (
    gl_key                  BIGINT,
    coa_key                 BIGINT,
    period_key              BIGINT,
    supplier_key            BIGINT,
    code_combination_id     BIGINT,
    acctd_amount            DECIMAL(18,2),
    journal_source          STRING,
    journal_category        STRING,
    dw_load_date            TIMESTAMP
)
PARTITIONED BY (fiscal_year INT)
LOCATION 's3://cos-financial-lakehouse-demo/gold/fact_gl_actuals/'
TBLPROPERTIES (
    'table_type'                    = 'ICEBERG',
    'format-version'                = '2',
    'write.format.default'          = 'parquet',
    'write.parquet.compression-codec' = 'zstd',
    'write.distribution-mode'       = 'hash',
    'write.delete.mode'             = 'merge-on-read',
    'write.update.mode'             = 'merge-on-read',
    'write.target-file-size-bytes'  = '268435456'
);

CREATE TABLE cos_gold.fact_ap_invoices (
    ap_key                  BIGINT,
    coa_key                 BIGINT,
    period_key              BIGINT,
    supplier_key            BIGINT,
    invoice_id              BIGINT,
    invoice_number          STRING,
    invoice_amount          DECIMAL(18,2),
    amount_paid             DECIMAL(18,2),
    payment_status_flag     STRING,
    po_header_id            BIGINT,
    invoice_date            DATE,
    dw_load_date            TIMESTAMP
)
PARTITIONED BY (months(invoice_date))
LOCATION 's3://cos-financial-lakehouse-demo/gold/fact_ap_invoices/'
TBLPROPERTIES (
    'table_type'                    = 'ICEBERG',
    'format-version'                = '2',
    'write.format.default'          = 'parquet',
    'write.parquet.compression-codec' = 'zstd',
    'write.distribution-mode'       = 'hash',
    'write.delete.mode'             = 'merge-on-read',
    'write.update.mode'             = 'merge-on-read',
    'write.target-file-size-bytes'  = '268435456'
);

-- ─────────────────────────────────────────────────────────────────────
-- BRONZE LAYER — Raw ingestion tables
-- ─────────────────────────────────────────────────────────────────────

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
    bicc_extract_id         STRING,
    ingestion_timestamp     TIMESTAMP
)
PARTITIONED BY (ingestion_date STRING)
LOCATION 's3://cos-financial-lakehouse-demo/bronze/budget_control/'
TBLPROPERTIES (
    'table_type'       = 'ICEBERG',
    'format-version'   = '2',
    'write.format.default' = 'parquet'
);

-- ─────────────────────────────────────────────────────────────────────
-- SILVER LAYER — Cleaned/merged tables
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
LOCATION 's3://cos-financial-lakehouse-demo/silver/budget_control_clean/'
TBLPROPERTIES (
    'table_type'       = 'ICEBERG',
    'format-version'   = '2',
    'write.format.default' = 'parquet',
    'write.delete.mode' = 'merge-on-read',
    'write.update.mode' = 'merge-on-read',
    'write.merge.mode'  = 'merge-on-read'
);

-- ─────────────────────────────────────────────────────────────────────
-- SCHEMA EVOLUTION DEMO (26A Future-Proofing)
-- ─────────────────────────────────────────────────────────────────────

-- Add new columns without table recreation:
-- ALTER TABLE cos_gold.dim_coa ADD COLUMNS (activity_code STRING, activity_description STRING);
-- ALTER TABLE cos_gold.dim_coa ADD COLUMNS (sub_account STRING);

-- ─────────────────────────────────────────────────────────────────────
-- VERIFY TABLES CREATED
-- ─────────────────────────────────────────────────────────────────────

-- SHOW TABLES IN cos_gold;
-- SHOW TABLES IN cos_silver;
-- SHOW TABLES IN cos_bronze;
-- DESCRIBE cos_gold.fact_budgetary_control;
