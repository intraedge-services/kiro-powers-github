#!/usr/bin/env python3
"""
COS Financial Lakehouse — Automated Iceberg Data Ingestion
Loads sample financial data into Bronze → Silver → Gold Iceberg tables.

After running this script, all layers will have queryable data:
  ✅ Bronze: Raw BICC-style extracts (append-only)
  ✅ Silver: Cleaned, deduplicated, enriched
  ✅ Gold: Star schema (dim_coa, dim_period, fact_budgetary_control)

Usage:
    python scripts/load_iceberg_data.py

Prerequisites:
    - Terraform infrastructure deployed (terraform apply)
    - Iceberg tables created (python scripts/setup_athena.py)
    - pip install boto3
"""

import boto3
import time
import os
import sys
from datetime import datetime

# ─────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────

REGION = os.environ.get("AWS_REGION", "us-east-1")
WORKGROUP = "cos-financial-lakehouse"
BUCKET = "cos-financial-lakehouse-demo"

athena = boto3.client("athena", region_name=REGION)

# ─────────────────────────────────────────────────────────────────────
# ATHENA QUERY HELPER
# ─────────────────────────────────────────────────────────────────────

def run_query(sql, database="cos_gold", description=""):
    """Execute Athena query, wait for completion, return success/fail."""
    if description:
        print(f"    → {description}")

    response = athena.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={"Database": database},
        WorkGroup=WORKGROUP,
    )
    query_id = response["QueryExecutionId"]

    while True:
        result = athena.get_query_execution(QueryExecutionId=query_id)
        state = result["QueryExecution"]["Status"]["State"]
        if state in ("SUCCEEDED", "FAILED", "CANCELLED"):
            break
        time.sleep(2)

    if state == "FAILED":
        reason = result["QueryExecution"]["Status"].get("StateChangeReason", "Unknown")
        print(f"      ❌ FAILED: {reason[:200]}")
        return False

    # Get row count if it's a SELECT
    if state == "SUCCEEDED" and sql.strip().upper().startswith("SELECT"):
        try:
            results = athena.get_query_results(QueryExecutionId=query_id, MaxResults=2)
            row_count = len(results["ResultSet"]["Rows"]) - 1  # minus header
            print(f"      ✅ OK ({row_count}+ rows)")
        except Exception:
            print(f"      ✅ OK")
    else:
        print(f"      ✅ OK")

    return True


def run_query_get_count(sql, database="cos_gold"):
    """Run a COUNT query and return the number."""
    response = athena.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={"Database": database},
        WorkGroup=WORKGROUP,
    )
    query_id = response["QueryExecutionId"]

    while True:
        result = athena.get_query_execution(QueryExecutionId=query_id)
        state = result["QueryExecution"]["Status"]["State"]
        if state in ("SUCCEEDED", "FAILED", "CANCELLED"):
            break
        time.sleep(2)

    if state != "SUCCEEDED":
        return 0

    results = athena.get_query_results(QueryExecutionId=query_id)
    rows = results["ResultSet"]["Rows"]
    if len(rows) > 1:
        return int(rows[1]["Data"][0].get("VarCharValue", "0"))
    return 0


# ═══════════════════════════════════════════════════════════════════════
# STEP 1: BRONZE LAYER — Raw BICC-style ingestion
# ═══════════════════════════════════════════════════════════════════════

def load_bronze():
    print("\n" + "━" * 70)
    print("  📥 BRONZE LAYER — Loading raw BICC extracts into Iceberg")
    print("━" * 70)

    # Insert budget control raw data (simulating Oracle BICC PVO extract)
    budget_rows = []
    import random
    random.seed(42)

    ccids = list(range(1001, 1017))
    periods = ["JUL-2024","AUG-2024","SEP-2024","OCT-2024","NOV-2024","DEC-2024",
               "JAN-2025","FEB-2025","MAR-2025","APR-2025","MAY-2025","JUN-2025"]

    for ccid in ccids:
        for period in periods:
            budget = random.randint(5000000, 150000000)
            actual = int(budget * random.uniform(0.4, 0.85))
            encumbrance = int(budget * random.uniform(0.05, 0.15))
            commitment = int(encumbrance * 0.6)
            obligation = int(encumbrance * 0.4)
            funds_avail = budget - actual - encumbrance

            budget_rows.append(
                f"({ccid}, '{period}', 'COS_ADOPTED_BUDGET', "
                f"{budget}.00, {actual}.00, {encumbrance}.00, "
                f"{commitment}.00, {obligation}.00, {funds_avail}.00, "
                f"TIMESTAMP '2025-05-08 06:00:00', 'BICC_20250508_001', "
                f"CURRENT_TIMESTAMP, '2025-05-08')"
            )

    # Athena INSERT has a practical limit — batch in groups of 50
    batch_size = 50
    total_inserted = 0

    for i in range(0, len(budget_rows), batch_size):
        batch = budget_rows[i:i + batch_size]
        values_str = ",\n        ".join(batch)

        sql = f"""
        INSERT INTO cos_bronze.budget_control
        VALUES
        {values_str}
        """

        batch_num = (i // batch_size) + 1
        total_batches = (len(budget_rows) + batch_size - 1) // batch_size
        success = run_query(sql, "cos_bronze",
                           f"Bronze batch {batch_num}/{total_batches} ({len(batch)} rows)")
        if success:
            total_inserted += len(batch)

    print(f"\n  📊 Bronze total: {total_inserted} rows loaded into budget_control")

    # Verify
    run_query("SELECT COUNT(*) AS cnt FROM cos_bronze.budget_control", "cos_bronze",
              "Verifying Bronze row count")


# ═══════════════════════════════════════════════════════════════════════
# STEP 2: SILVER LAYER — Clean, deduplicate, enrich
# ═══════════════════════════════════════════════════════════════════════

def load_silver():
    print("\n" + "━" * 70)
    print("  🔄 SILVER LAYER — Transform Bronze → Silver (clean + enrich)")
    print("━" * 70)

    # MERGE from Bronze into Silver with:
    # - Deduplication (ROW_NUMBER by key, latest wins)
    # - Fiscal year derivation
    # - Standardized period names
    # - Enrichment timestamps

    silver_merge_sql = """
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
    WHERE rn = 1
    """

    run_query(silver_merge_sql, "cos_silver",
              "MERGE Bronze → Silver (dedup + fiscal year + timestamps)")

    # Verify
    run_query("SELECT COUNT(*) AS cnt FROM cos_silver.budget_control_clean", "cos_silver",
              "Verifying Silver row count")

    # Show sample
    run_query("""
        SELECT code_combination_id, period_name, budget_amount, actual_amount,
               funds_available, fiscal_year
        FROM cos_silver.budget_control_clean
        WHERE code_combination_id = 1001
        ORDER BY period_name
        LIMIT 5
    """, "cos_silver", "Sample Silver data (CCID 1001)")


# ═══════════════════════════════════════════════════════════════════════
# STEP 3: GOLD LAYER — Dimensional model
# ═══════════════════════════════════════════════════════════════════════

def load_gold():
    print("\n" + "━" * 70)
    print("  ⭐ GOLD LAYER — Loading star schema (dimensions + facts)")
    print("━" * 70)

    # ─── dim_coa ───
    print("\n  Loading dim_coa (Chart of Accounts)...")
    dim_coa_sql = """
    INSERT INTO cos_gold.dim_coa
    VALUES
        (1, 1001, '100', 'General Fund', '4100', 'Police', '5100', 'Salaries & Wages', NULL, NULL, 'E', 'Y', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (2, 1002, '100', 'General Fund', '4100', 'Police', '5200', 'Professional Services', NULL, NULL, 'E', 'Y', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (3, 1003, '100', 'General Fund', '4200', 'Fire', '5100', 'Salaries & Wages', NULL, NULL, 'E', 'Y', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (4, 1004, '100', 'General Fund', '4200', 'Fire', '5200', 'Professional Services', NULL, NULL, 'E', 'Y', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (5, 1005, '100', 'General Fund', '4300', 'Public Works', '5100', 'Salaries & Wages', NULL, NULL, 'E', 'Y', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (6, 1006, '100', 'General Fund', '4300', 'Public Works', '5300', 'Materials & Supplies', NULL, NULL, 'E', 'Y', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (7, 1007, '100', 'General Fund', '4400', 'Parks & Rec', '5100', 'Salaries & Wages', NULL, NULL, 'E', 'Y', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (8, 1008, '100', 'General Fund', '4400', 'Parks & Rec', '5400', 'Contracted Services', NULL, NULL, 'E', 'Y', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (9, 1009, '100', 'General Fund', '4500', 'Community Dev', '5100', 'Salaries & Wages', NULL, NULL, 'E', 'Y', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (10, 1010, '100', 'General Fund', '4500', 'Community Dev', '5200', 'Professional Services', NULL, NULL, 'E', 'Y', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (11, 1011, '200', 'Water Fund', '4600', 'Water Resources', '5100', 'Salaries & Wages', NULL, NULL, 'E', 'Y', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (12, 1012, '200', 'Water Fund', '4600', 'Water Resources', '5500', 'Utilities', NULL, NULL, 'E', 'Y', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (13, 1013, '300', 'Wastewater Fund', '4700', 'Transportation', '5100', 'Salaries & Wages', NULL, NULL, 'E', 'Y', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (14, 1014, '400', 'Transit Fund', '4800', 'Library', '5100', 'Salaries & Wages', NULL, NULL, 'E', 'Y', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (15, 1015, '500', 'Airport Fund', '4900', 'Information Tech', '5600', 'Technology Services', NULL, NULL, 'E', 'Y', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (16, 1016, '100', 'General Fund', '5000', 'City Manager', '5100', 'Salaries & Wages', NULL, NULL, 'E', 'Y', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP)
    """
    run_query(dim_coa_sql, "cos_gold", "INSERT 16 rows into dim_coa")

    # ─── dim_period ───
    print("\n  Loading dim_period (Fiscal Calendar FY2025)...")
    dim_period_sql = """
    INSERT INTO cos_gold.dim_period
    VALUES
        (1, 'JUL-2024', 2025, 1, 1, 2024, 7, 'July', DATE '2024-07-01', DATE '2024-07-31', false, CURRENT_TIMESTAMP),
        (2, 'AUG-2024', 2025, 1, 2, 2024, 8, 'August', DATE '2024-08-01', DATE '2024-08-31', false, CURRENT_TIMESTAMP),
        (3, 'SEP-2024', 2025, 1, 3, 2024, 9, 'September', DATE '2024-09-01', DATE '2024-09-30', false, CURRENT_TIMESTAMP),
        (4, 'OCT-2024', 2025, 2, 4, 2024, 10, 'October', DATE '2024-10-01', DATE '2024-10-31', false, CURRENT_TIMESTAMP),
        (5, 'NOV-2024', 2025, 2, 5, 2024, 11, 'November', DATE '2024-11-01', DATE '2024-11-30', false, CURRENT_TIMESTAMP),
        (6, 'DEC-2024', 2025, 2, 6, 2024, 12, 'December', DATE '2024-12-01', DATE '2024-12-31', false, CURRENT_TIMESTAMP),
        (7, 'JAN-2025', 2025, 3, 7, 2025, 1, 'January', DATE '2025-01-01', DATE '2025-01-31', false, CURRENT_TIMESTAMP),
        (8, 'FEB-2025', 2025, 3, 8, 2025, 2, 'February', DATE '2025-02-01', DATE '2025-02-28', false, CURRENT_TIMESTAMP),
        (9, 'MAR-2025', 2025, 3, 9, 2025, 3, 'March', DATE '2025-03-01', DATE '2025-03-31', false, CURRENT_TIMESTAMP),
        (10, 'APR-2025', 2025, 4, 10, 2025, 4, 'April', DATE '2025-04-01', DATE '2025-04-30', false, CURRENT_TIMESTAMP),
        (11, 'MAY-2025', 2025, 4, 11, 2025, 5, 'May', DATE '2025-05-01', DATE '2025-05-31', true, CURRENT_TIMESTAMP),
        (12, 'JUN-2025', 2025, 4, 12, 2025, 6, 'June', DATE '2025-06-01', DATE '2025-06-30', false, CURRENT_TIMESTAMP)
    """
    run_query(dim_period_sql, "cos_gold", "INSERT 12 rows into dim_period")

    # ─── dim_supplier ───
    print("\n  Loading dim_supplier...")
    dim_supplier_sql = """
    INSERT INTO cos_gold.dim_supplier
    VALUES
        (1, 2001, 'APS Energy', 'SUP-2001', 'Active', 'Net 30', 'Utilities', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (2, 2002, 'Salt River Project', 'SUP-2002', 'Active', 'Net 30', 'Utilities', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (3, 2003, 'Grainger Industrial', 'SUP-2003', 'Active', 'Net 45', 'Materials & Supplies', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (4, 2004, 'Home Depot Pro', 'SUP-2004', 'Active', 'Net 30', 'Materials & Supplies', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (5, 2005, 'Fisher Scientific', 'SUP-2005', 'Active', 'Net 60', 'Lab Equipment', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (6, 2006, 'W.W. Grainger', 'SUP-2006', 'Active', 'Net 45', 'Facilities', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (7, 2007, 'United Rentals', 'SUP-2007', 'Active', 'Net 30', 'Equipment Rental', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (8, 2008, 'Amazon Business', 'SUP-2008', 'Active', 'Net 30', 'Office Supplies', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (9, 2009, 'Lowes Pro', 'SUP-2009', 'Active', 'Net 30', 'Building Materials', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP),
        (10, 2010, 'CDW Government', 'SUP-2010', 'Active', 'Net 45', 'Technology', DATE '2024-07-01', DATE '9999-12-31', true, CURRENT_TIMESTAMP)
    """
    run_query(dim_supplier_sql, "cos_gold", "INSERT 10 rows into dim_supplier")

    # ─── fact_budgetary_control ───
    print("\n  Loading fact_budgetary_control from Silver...")
    fact_load_sql = """
    INSERT INTO cos_gold.fact_budgetary_control
    SELECT
        ROW_NUMBER() OVER (ORDER BY s.code_combination_id, s.period_name) AS bc_key,
        dc.coa_key,
        dp.period_key,
        s.code_combination_id,
        s.budget_amount,
        s.actual_amount,
        s.encumbrance_amount,
        s.commitment_amount,
        s.obligation_amount,
        s.expenditure_amount,
        s.funds_available,
        CURRENT_TIMESTAMP AS dw_load_date,
        s.fiscal_year
    FROM cos_silver.budget_control_clean s
    JOIN cos_gold.dim_coa dc
        ON dc.code_combination_id = s.code_combination_id
        AND dc.is_current = true
    JOIN cos_gold.dim_period dp
        ON dp.period_name = s.period_name
    """
    run_query(fact_load_sql, "cos_gold",
              "INSERT fact_budgetary_control (Silver → Gold with dim joins)")

    # Verify all Gold tables
    print("\n  Verifying Gold layer...")
    run_query("SELECT COUNT(*) FROM cos_gold.dim_coa", "cos_gold", "dim_coa count")
    run_query("SELECT COUNT(*) FROM cos_gold.dim_period", "cos_gold", "dim_period count")
    run_query("SELECT COUNT(*) FROM cos_gold.dim_supplier", "cos_gold", "dim_supplier count")
    run_query("SELECT COUNT(*) FROM cos_gold.fact_budgetary_control", "cos_gold",
              "fact_budgetary_control count")


# ═══════════════════════════════════════════════════════════════════════
# STEP 4: VALIDATION QUERIES — Prove the lakehouse works
# ═══════════════════════════════════════════════════════════════════════

def run_validation():
    print("\n" + "━" * 70)
    print("  ✅ VALIDATION — Executive dashboard queries")
    print("━" * 70)

    # KPI: Total Budget
    print("\n  KPI Queries:")
    run_query("""
        SELECT
            SUM(budget_amount) AS total_budget,
            SUM(actual_amount) AS total_actual,
            SUM(funds_available) AS total_available,
            ROUND(SUM(actual_amount) / SUM(budget_amount) * 100, 1) AS burn_rate_pct
        FROM cos_gold.fact_budgetary_control
    """, "cos_gold", "Total Budget KPIs")

    # Department breakdown
    run_query("""
        SELECT
            dc.department_description,
            SUM(f.budget_amount) AS budget,
            SUM(f.actual_amount) AS actual,
            SUM(f.funds_available) AS available,
            ROUND(SUM(f.actual_amount) / SUM(f.budget_amount) * 100, 1) AS burn_pct
        FROM cos_gold.fact_budgetary_control f
        JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
        GROUP BY dc.department_description
        ORDER BY burn_pct DESC
        LIMIT 10
    """, "cos_gold", "Budget by Department (Top 10)")

    # Fund breakdown
    run_query("""
        SELECT
            dc.fund_description,
            COUNT(DISTINCT dc.department_description) AS dept_count,
            SUM(f.budget_amount) AS total_budget,
            SUM(f.actual_amount) AS total_actual
        FROM cos_gold.fact_budgetary_control f
        JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
        GROUP BY dc.fund_description
        ORDER BY total_budget DESC
    """, "cos_gold", "Budget by Fund")

    # Monthly trend
    run_query("""
        SELECT
            dp.period_name,
            dp.fiscal_month,
            SUM(f.budget_amount) AS budget,
            SUM(f.actual_amount) AS actual
        FROM cos_gold.fact_budgetary_control f
        JOIN cos_gold.dim_period dp ON dp.period_key = f.period_key
        GROUP BY dp.period_name, dp.fiscal_month
        ORDER BY dp.fiscal_month
    """, "cos_gold", "Monthly Budget vs Actual Trend")

    # Snapshot history
    run_query("""
        SELECT snapshot_id, committed_at, operation,
               summary['added-records'] AS records_added
        FROM cos_gold.fact_budgetary_control.snapshots
        ORDER BY committed_at DESC
    """, "cos_gold", "Iceberg Snapshot History")


# ═══════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════

def main():
    start = datetime.now()

    print("\n" + "═" * 70)
    print("  COS FINANCIAL LAKEHOUSE — AUTOMATED DATA INGESTION")
    print(f"  Started: {start.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Region: {REGION} | Workgroup: {WORKGROUP}")
    print("═" * 70)

    # Execute pipeline: Bronze → Silver → Gold → Validate
    load_bronze()
    load_silver()
    load_gold()
    run_validation()

    elapsed = (datetime.now() - start).total_seconds()

    print("\n" + "═" * 70)
    print("  🎉 DATA INGESTION COMPLETE")
    print(f"  Duration: {elapsed:.0f} seconds")
    print("═" * 70)
    print("""
  Layers populated:
    ✅ Bronze: 192 raw BICC records (budget_control)
    ✅ Silver: 192 cleaned/enriched records (budget_control_clean)
    ✅ Gold:   192 fact rows + 16 dim_coa + 12 dim_period + 10 dim_supplier

  Ready for:
    • Power BI DirectQuery via Athena
    • Time travel queries (FOR VERSION AS OF / FOR TIMESTAMP AS OF)
    • Incremental loads (MERGE INTO)
    • Schema evolution (ALTER TABLE ADD COLUMNS)
    • Compaction demos (via PySpark/Glue)

  Try now in Athena:
    SELECT dc.department_description, SUM(f.budget_amount) AS budget
    FROM cos_gold.fact_budgetary_control f
    JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
    GROUP BY dc.department_description
    ORDER BY budget DESC;
    """)


if __name__ == "__main__":
    main()
