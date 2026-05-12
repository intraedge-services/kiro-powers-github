#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# COS Financial Lakehouse — CloudShell Setup (No boto3 dependency)
# Runs entirely via AWS CLI — works in CloudShell without credential issues
#
# Usage (in AWS CloudShell):
#   chmod +x setup_cloudshell.sh
#   ./setup_cloudshell.sh
#
# Prerequisites:
#   - AWS CloudShell (credentials are automatic)
#   - S3 bucket: cos-financial-lakehouse-demo (created by Terraform)
#   - Glue databases: cos_bronze, cos_silver, cos_gold (created by Terraform)
#   - Athena workgroup: cos-financial-lakehouse
# ═══════════════════════════════════════════════════════════════════════

set -e

WORKGROUP="cos-financial-lakehouse"
DATABASE="cos_gold"
REGION="${AWS_REGION:-us-east-1}"
OUTPUT_LOCATION="s3://cos-athena-results-demo/results/"

echo "════════════════════════════════════════════════════════════"
echo "  COS Financial Lakehouse — Athena Data Load"
echo "  Region: $REGION"
echo "  Workgroup: $WORKGROUP"
echo "════════════════════════════════════════════════════════════"

# ─────────────────────────────────────────────────────────────────────
# Helper: Run Athena query via AWS CLI and wait for completion
# ─────────────────────────────────────────────────────────────────────

run_athena() {
    local sql="$1"
    local db="${2:-$DATABASE}"
    local desc="${3:-Running query}"

    echo "  → $desc"

    # Start query
    QUERY_ID=$(aws athena start-query-execution \
        --query-string "$sql" \
        --query-execution-context "Database=$db" \
        --work-group "$WORKGROUP" \
        --region "$REGION" \
        --output text \
        --query 'QueryExecutionId')

    # Wait for completion
    while true; do
        STATE=$(aws athena get-query-execution \
            --query-execution-id "$QUERY_ID" \
            --region "$REGION" \
            --output text \
            --query 'QueryExecution.Status.State')

        if [ "$STATE" = "SUCCEEDED" ]; then
            echo "    ✅ Done"
            return 0
        elif [ "$STATE" = "FAILED" ]; then
            REASON=$(aws athena get-query-execution \
                --query-execution-id "$QUERY_ID" \
                --region "$REGION" \
                --output text \
                --query 'QueryExecution.Status.StateChangeReason')
            echo "    ❌ Failed: $REASON"
            return 1
        fi
        sleep 2
    done
}

# ─────────────────────────────────────────────────────────────────────
# Step 1: Create Iceberg tables
# ─────────────────────────────────────────────────────────────────────

echo ""
echo "📋 Step 1: Creating Iceberg tables..."

run_athena "CREATE TABLE IF NOT EXISTS cos_bronze.budget_control (code_combination_id bigint, period_name string, budget_name string, budget_amount double, actual_amount double, encumbrance_amount double, commitment_amount double, obligation_amount double, funds_available double, last_update_date timestamp, bicc_extract_id string, ingestion_timestamp timestamp, ingestion_date string) LOCATION 's3://cos-financial-lakehouse-demo/bronze/budget_control/' TBLPROPERTIES ('table_type' = 'ICEBERG')" "cos_bronze" "Creating Bronze table"

run_athena "CREATE TABLE IF NOT EXISTS cos_silver.budget_control_clean (code_combination_id bigint, period_name string, budget_amount double, actual_amount double, encumbrance_amount double, commitment_amount double, obligation_amount double, expenditure_amount double, funds_available double, last_update_date timestamp, dw_insert_date timestamp, dw_update_date timestamp, fiscal_year int) LOCATION 's3://cos-financial-lakehouse-demo/silver/budget_control_clean/' TBLPROPERTIES ('table_type' = 'ICEBERG')" "cos_silver" "Creating Silver table"

run_athena "CREATE TABLE IF NOT EXISTS cos_gold.dim_coa (coa_key bigint, code_combination_id bigint, fund string, fund_description string, department string, department_description string, account string, account_description string, account_type string, enabled_flag string, is_current boolean, dw_load_date timestamp) LOCATION 's3://cos-financial-lakehouse-demo/gold/dim_coa/' TBLPROPERTIES ('table_type' = 'ICEBERG')" "cos_gold" "Creating dim_coa"

run_athena "CREATE TABLE IF NOT EXISTS cos_gold.dim_period (period_key bigint, period_name string, fiscal_year int, fiscal_quarter int, fiscal_month int, calendar_year int, calendar_month int, calendar_month_name string, period_start_date date, period_end_date date, is_current_period boolean, dw_load_date timestamp) LOCATION 's3://cos-financial-lakehouse-demo/gold/dim_period/' TBLPROPERTIES ('table_type' = 'ICEBERG')" "cos_gold" "Creating dim_period"

run_athena "CREATE TABLE IF NOT EXISTS cos_gold.dim_supplier (supplier_key bigint, vendor_id bigint, supplier_name string, supplier_status string, payment_terms string, commodity_category string, is_current boolean, dw_load_date timestamp) LOCATION 's3://cos-financial-lakehouse-demo/gold/dim_supplier/' TBLPROPERTIES ('table_type' = 'ICEBERG')" "cos_gold" "Creating dim_supplier"

run_athena "CREATE TABLE IF NOT EXISTS cos_gold.fact_budgetary_control (bc_key bigint, coa_key bigint, period_key bigint, code_combination_id bigint, budget_amount double, actual_amount double, encumbrance_amount double, commitment_amount double, obligation_amount double, expenditure_amount double, funds_available double, fiscal_year int, dw_load_date timestamp) LOCATION 's3://cos-financial-lakehouse-demo/gold/fact_budgetary_control/' TBLPROPERTIES ('table_type' = 'ICEBERG')" "cos_gold" "Creating fact_budgetary_control"

# ─────────────────────────────────────────────────────────────────────
# Step 2: Load Bronze data
# ─────────────────────────────────────────────────────────────────────

echo ""
echo "📋 Step 2: Loading Bronze layer (BICC extract simulation)..."

run_athena "INSERT INTO cos_bronze.budget_control VALUES (1001,'JUL-2024','COS_ADOPTED',125000000,10200000,1500000,900000,600000,113300000,TIMESTAMP '2025-05-08 06:00:00','BICC_20250508',CURRENT_TIMESTAMP,'2025-05-08'),(1001,'OCT-2024','COS_ADOPTED',125000000,43500000,5100000,3060000,2040000,76400000,TIMESTAMP '2025-05-08 06:00:00','BICC_20250508',CURRENT_TIMESTAMP,'2025-05-08'),(1001,'JAN-2025','COS_ADOPTED',125000000,72400000,8200000,4920000,3280000,44400000,TIMESTAMP '2025-05-08 06:00:00','BICC_20250508',CURRENT_TIMESTAMP,'2025-05-08'),(1001,'APR-2025','COS_ADOPTED',125000000,91200000,10800000,6480000,4320000,23000000,TIMESTAMP '2025-05-08 06:00:00','BICC_20250508',CURRENT_TIMESTAMP,'2025-05-08'),(1003,'JUL-2024','COS_ADOPTED',98000000,8100000,1200000,720000,480000,88700000,TIMESTAMP '2025-05-08 06:00:00','BICC_20250508',CURRENT_TIMESTAMP,'2025-05-08'),(1003,'OCT-2024','COS_ADOPTED',98000000,32700000,4800000,2880000,1920000,60500000,TIMESTAMP '2025-05-08 06:00:00','BICC_20250508',CURRENT_TIMESTAMP,'2025-05-08'),(1003,'JAN-2025','COS_ADOPTED',98000000,55200000,7800000,4680000,3120000,35000000,TIMESTAMP '2025-05-08 06:00:00','BICC_20250508',CURRENT_TIMESTAMP,'2025-05-08'),(1003,'APR-2025','COS_ADOPTED',98000000,73500000,9600000,5760000,3840000,14900000,TIMESTAMP '2025-05-08 06:00:00','BICC_20250508',CURRENT_TIMESTAMP,'2025-05-08'),(1005,'JAN-2025','COS_ADOPTED',67000000,38500000,5600000,3360000,2240000,22900000,TIMESTAMP '2025-05-08 06:00:00','BICC_20250508',CURRENT_TIMESTAMP,'2025-05-08'),(1005,'APR-2025','COS_ADOPTED',67000000,55000000,8000000,4800000,3200000,4000000,TIMESTAMP '2025-05-08 06:00:00','BICC_20250508',CURRENT_TIMESTAMP,'2025-05-08'),(1007,'JAN-2025','COS_ADOPTED',42000000,24500000,3500000,2100000,1400000,14000000,TIMESTAMP '2025-05-08 06:00:00','BICC_20250508',CURRENT_TIMESTAMP,'2025-05-08'),(1007,'APR-2025','COS_ADOPTED',42000000,35000000,5000000,3000000,2000000,2000000,TIMESTAMP '2025-05-08 06:00:00','BICC_20250508',CURRENT_TIMESTAMP,'2025-05-08'),(1011,'JAN-2025','COS_ADOPTED',55000000,28600000,4125000,2475000,1650000,22275000,TIMESTAMP '2025-05-08 06:00:00','BICC_20250508',CURRENT_TIMESTAMP,'2025-05-08'),(1015,'JAN-2025','COS_ADOPTED',62000000,32200000,4650000,2790000,1860000,25150000,TIMESTAMP '2025-05-08 06:00:00','BICC_20250508',CURRENT_TIMESTAMP,'2025-05-08')" "cos_bronze" "Loading 14 Bronze records"

# ─────────────────────────────────────────────────────────────────────
# Step 3: Transform Bronze → Silver
# ─────────────────────────────────────────────────────────────────────

echo ""
echo "📋 Step 3: Transforming Bronze → Silver..."

run_athena "INSERT INTO cos_silver.budget_control_clean SELECT code_combination_id, period_name, budget_amount, actual_amount, encumbrance_amount, commitment_amount, obligation_amount, actual_amount AS expenditure_amount, budget_amount - actual_amount - encumbrance_amount AS funds_available, last_update_date, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CASE WHEN SUBSTR(period_name,1,3) IN ('JUL','AUG','SEP','OCT','NOV','DEC') THEN CAST(SUBSTR(period_name,5,4) AS INT)+1 ELSE CAST(SUBSTR(period_name,5,4) AS INT) END AS fiscal_year FROM (SELECT *, ROW_NUMBER() OVER (PARTITION BY code_combination_id, period_name ORDER BY last_update_date DESC) AS rn FROM cos_bronze.budget_control) WHERE rn = 1" "cos_silver" "Bronze → Silver (dedup + enrich)"

# ─────────────────────────────────────────────────────────────────────
# Step 4: Load Gold dimensions + fact
# ─────────────────────────────────────────────────────────────────────

echo ""
echo "📋 Step 4: Loading Gold layer..."

run_athena "INSERT INTO cos_gold.dim_coa VALUES (1,1001,'100','General Fund','4100','Police','5100','Salaries & Wages','E','Y',true,CURRENT_TIMESTAMP),(3,1003,'100','General Fund','4200','Fire','5100','Salaries & Wages','E','Y',true,CURRENT_TIMESTAMP),(5,1005,'100','General Fund','4300','Public Works','5100','Salaries & Wages','E','Y',true,CURRENT_TIMESTAMP),(7,1007,'100','General Fund','4400','Parks & Rec','5100','Salaries & Wages','E','Y',true,CURRENT_TIMESTAMP),(11,1011,'200','Water Fund','4600','Water Resources','5100','Salaries & Wages','E','Y',true,CURRENT_TIMESTAMP),(15,1015,'500','Airport Fund','4900','Information Tech','5600','Technology Services','E','Y',true,CURRENT_TIMESTAMP)" "cos_gold" "Loading dim_coa (6 rows)"

run_athena "INSERT INTO cos_gold.dim_period VALUES (1,'JUL-2024',2025,1,1,2024,7,'July',DATE '2024-07-01',DATE '2024-07-31',false,CURRENT_TIMESTAMP),(4,'OCT-2024',2025,2,4,2024,10,'October',DATE '2024-10-01',DATE '2024-10-31',false,CURRENT_TIMESTAMP),(7,'JAN-2025',2025,3,7,2025,1,'January',DATE '2025-01-01',DATE '2025-01-31',false,CURRENT_TIMESTAMP),(10,'APR-2025',2025,4,10,2025,4,'April',DATE '2025-04-01',DATE '2025-04-30',false,CURRENT_TIMESTAMP)" "cos_gold" "Loading dim_period (4 rows)"

run_athena "INSERT INTO cos_gold.fact_budgetary_control SELECT ROW_NUMBER() OVER (ORDER BY s.code_combination_id, s.period_name), dc.coa_key, dp.period_key, s.code_combination_id, s.budget_amount, s.actual_amount, s.encumbrance_amount, s.commitment_amount, s.obligation_amount, s.expenditure_amount, s.funds_available, s.fiscal_year, CURRENT_TIMESTAMP FROM cos_silver.budget_control_clean s JOIN cos_gold.dim_coa dc ON dc.code_combination_id = s.code_combination_id AND dc.is_current = true JOIN cos_gold.dim_period dp ON dp.period_name = s.period_name" "cos_gold" "Loading fact_budgetary_control (Silver → Gold)"

# ─────────────────────────────────────────────────────────────────────
# Step 5: Validate
# ─────────────────────────────────────────────────────────────────────

echo ""
echo "📋 Step 5: Validating..."

run_athena "SELECT 'bronze' AS layer, COUNT(*) AS rows FROM cos_bronze.budget_control UNION ALL SELECT 'silver', COUNT(*) FROM cos_silver.budget_control_clean UNION ALL SELECT 'gold_fact', COUNT(*) FROM cos_gold.fact_budgetary_control UNION ALL SELECT 'gold_dim_coa', COUNT(*) FROM cos_gold.dim_coa UNION ALL SELECT 'gold_dim_period', COUNT(*) FROM cos_gold.dim_period" "cos_gold" "Row counts across all layers"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ✅ LAKEHOUSE SETUP COMPLETE!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "  Open Athena Query Editor and run:"
echo ""
echo "  SELECT dc.department_description,"
echo "         SUM(f.budget_amount) AS budget,"
echo "         SUM(f.actual_amount) AS actual"
echo "  FROM cos_gold.fact_budgetary_control f"
echo "  JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key"
echo "  GROUP BY dc.department_description"
echo "  ORDER BY budget DESC;"
echo ""
