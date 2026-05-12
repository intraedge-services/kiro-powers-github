-- ═══════════════════════════════════════════════════════════════════════
-- COS UNIFIED LAKEHOUSE — TABLE CREATION
-- Athena Engine v3 | Iceberg | No Spark properties
-- Run each CREATE TABLE individually in Athena Query Editor
-- ═══════════════════════════════════════════════════════════════════════

-- BRONZE: Raw Oracle Fusion BICC extract
CREATE TABLE cos_bronze.budget_control (
    code_combination_id   bigint,
    period_name           string,
    budget_name           string,
    budget_amount         double,
    actual_amount         double,
    encumbrance_amount    double,
    commitment_amount     double,
    obligation_amount     double,
    funds_available       double,
    last_update_date      timestamp,
    bicc_extract_id       string,
    ingestion_timestamp   timestamp,
    ingestion_date        string
)
LOCATION 's3://cos-financial-lakehouse-demo/bronze/budget_control/'
TBLPROPERTIES ('table_type' = 'ICEBERG');

-- SILVER: Cleaned and enriched
CREATE TABLE cos_silver.budget_control_clean (
    code_combination_id   bigint,
    period_name           string,
    budget_amount         double,
    actual_amount         double,
    encumbrance_amount    double,
    commitment_amount     double,
    obligation_amount     double,
    expenditure_amount    double,
    funds_available       double,
    last_update_date      timestamp,
    dw_insert_date        timestamp,
    dw_update_date        timestamp,
    fiscal_year           int
)
LOCATION 's3://cos-financial-lakehouse-demo/silver/budget_control_clean/'
TBLPROPERTIES ('table_type' = 'ICEBERG');

-- GOLD: dim_coa
CREATE TABLE cos_gold.dim_coa (
    coa_key                 bigint,
    code_combination_id     bigint,
    fund                    string,
    fund_description        string,
    department              string,
    department_description  string,
    account                 string,
    account_description     string,
    account_type            string,
    enabled_flag            string,
    is_current              boolean,
    dw_load_date            timestamp
)
LOCATION 's3://cos-financial-lakehouse-demo/gold/dim_coa/'
TBLPROPERTIES ('table_type' = 'ICEBERG');

-- GOLD: dim_period
CREATE TABLE cos_gold.dim_period (
    period_key            bigint,
    period_name           string,
    fiscal_year           int,
    fiscal_quarter        int,
    fiscal_month          int,
    calendar_year         int,
    calendar_month        int,
    calendar_month_name   string,
    period_start_date     date,
    period_end_date       date,
    is_current_period     boolean,
    dw_load_date          timestamp
)
LOCATION 's3://cos-financial-lakehouse-demo/gold/dim_period/'
TBLPROPERTIES ('table_type' = 'ICEBERG');

-- GOLD: dim_supplier
CREATE TABLE cos_gold.dim_supplier (
    supplier_key          bigint,
    vendor_id             bigint,
    supplier_name         string,
    supplier_status       string,
    payment_terms         string,
    commodity_category    string,
    is_current            boolean,
    dw_load_date          timestamp
)
LOCATION 's3://cos-financial-lakehouse-demo/gold/dim_supplier/'
TBLPROPERTIES ('table_type' = 'ICEBERG');

-- GOLD: fact_budgetary_control
CREATE TABLE cos_gold.fact_budgetary_control (
    bc_key                bigint,
    coa_key               bigint,
    period_key            bigint,
    code_combination_id   bigint,
    budget_amount         double,
    actual_amount         double,
    encumbrance_amount    double,
    commitment_amount     double,
    obligation_amount     double,
    expenditure_amount    double,
    funds_available       double,
    fiscal_year           int,
    dw_load_date          timestamp
)
LOCATION 's3://cos-financial-lakehouse-demo/gold/fact_budgetary_control/'
TBLPROPERTIES ('table_type' = 'ICEBERG');
