#!/usr/bin/env python3
"""
COS Financial Lakehouse — Iceberg Pipeline Demo
Demonstrates: ingestion, time travel, snapshots, schema evolution, compaction.

Usage:
    python scripts/iceberg_pipeline.py

This script uses Athena to execute Iceberg operations.
For PySpark/Glue version, see docs/iceberg-pyspark-jobs.py
"""

import boto3
import time
import os
import json
from datetime import datetime

# ─────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────

REGION = os.environ.get("AWS_REGION", "us-east-1")
WORKGROUP = "cos-financial-lakehouse"
BUCKET = "cos-financial-lakehouse-demo"

athena = boto3.client("athena", region_name=REGION)


def run_query(sql, database="cos_gold", show_results=False):
    """Execute Athena query and optionally display results."""
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
        time.sleep(1)

    if state == "FAILED":
        reason = result["QueryExecution"]["Status"].get("StateChangeReason", "")
        print(f"    ❌ Query failed: {reason}")
        return None

    if show_results:
        results = athena.get_query_results(QueryExecutionId=query_id)
        rows = results["ResultSet"]["Rows"]
        if rows:
            # Print header
            header = [col.get("VarCharValue", "") for col in rows[0]["Data"]]
            print(f"    {'  |  '.join(header)}")
            print(f"    {'─' * 60}")
            # Print data rows (max 10)
            for row in rows[1:11]:
                values = [col.get("VarCharValue", "") for col in row["Data"]]
                print(f"    {'  |  '.join(values)}")
            if len(rows) > 11:
                print(f"    ... ({len(rows) - 1} total rows)")
        return rows

    return True


def main():
    print("\n" + "═" * 70)
    print("  COS FINANCIAL LAKEHOUSE — ICEBERG PIPELINE DEMO")
    print(f"  Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("═" * 70)

    # ─────────────────────────────────────────────────────────────────
    # DEMO 1: Insert sample data into Gold layer
    # ─────────────────────────────────────────────────────────────────
    print("\n\n📋 DEMO 1: Load data into fact_budgetary_control")
    print("─" * 50)

    insert_sql = """
    INSERT INTO cos_gold.fact_budgetary_control
    VALUES
        (1, 1, 1, 1001, 125000000.00, 87500000.00, 12000000.00, 7200000.00, 4800000.00, 87500000.00, 25500000.00, current_timestamp, 2025),
        (2, 2, 1, 1002, 45000000.00, 31500000.00, 5400000.00, 3240000.00, 2160000.00, 31500000.00, 8100000.00, current_timestamp, 2025),
        (3, 3, 1, 1003, 98000000.00, 72100000.00, 9800000.00, 5880000.00, 3920000.00, 72100000.00, 16100000.00, current_timestamp, 2025),
        (4, 4, 1, 1004, 32000000.00, 22400000.00, 4800000.00, 2880000.00, 1920000.00, 22400000.00, 4800000.00, current_timestamp, 2025),
        (5, 5, 1, 1005, 67000000.00, 41200000.00, 6700000.00, 4020000.00, 2680000.00, 41200000.00, 19100000.00, current_timestamp, 2025)
    """
    run_query(insert_sql)
    print("  ✅ Inserted 5 budget records (Snapshot 1 created)")

    # ─────────────────────────────────────────────────────────────────
    # DEMO 2: View snapshots
    # ─────────────────────────────────────────────────────────────────
    print("\n\n📋 DEMO 2: View Iceberg Snapshots")
    print("─" * 50)

    run_query("""
        SELECT snapshot_id, committed_at, operation,
               summary['added-records'] AS added_records
        FROM cos_gold.fact_budgetary_control.snapshots
        ORDER BY committed_at DESC
    """, show_results=True)

    # ─────────────────────────────────────────────────────────────────
    # DEMO 3: Update data (creates new snapshot)
    # ─────────────────────────────────────────────────────────────────
    print("\n\n📋 DEMO 3: Update budget (simulating BICC refresh)")
    print("─" * 50)

    run_query("""
        UPDATE cos_gold.fact_budgetary_control
        SET actual_amount = 92000000.00,
            funds_available = 125000000.00 - 92000000.00 - 12000000.00,
            dw_load_date = current_timestamp
        WHERE code_combination_id = 1001
    """)
    print("  ✅ Updated Police dept actual (Snapshot 2 created)")

    # ─────────────────────────────────────────────────────────────────
    # DEMO 4: Time Travel — query previous state
    # ─────────────────────────────────────────────────────────────────
    print("\n\n📋 DEMO 4: Time Travel — Compare Before vs After")
    print("─" * 50)

    # Get snapshot IDs
    snapshots = run_query("""
        SELECT snapshot_id, committed_at
        FROM cos_gold.fact_budgetary_control.snapshots
        ORDER BY committed_at ASC
    """, show_results=True)

    if snapshots and len(snapshots) > 1:
        first_snapshot = snapshots[1]["Data"][0].get("VarCharValue", "")
        if first_snapshot:
            print(f"\n  Querying state at snapshot {first_snapshot}:")
            run_query(f"""
                SELECT code_combination_id, budget_amount, actual_amount, funds_available
                FROM cos_gold.fact_budgetary_control
                FOR VERSION AS OF {first_snapshot}
                WHERE code_combination_id = 1001
            """, show_results=True)

    print("\n  Current state:")
    run_query("""
        SELECT code_combination_id, budget_amount, actual_amount, funds_available
        FROM cos_gold.fact_budgetary_control
        WHERE code_combination_id = 1001
    """, show_results=True)

    # ─────────────────────────────────────────────────────────────────
    # DEMO 5: Schema Evolution
    # ─────────────────────────────────────────────────────────────────
    print("\n\n📋 DEMO 5: Schema Evolution — Add column without recreation")
    print("─" * 50)

    run_query("""
        ALTER TABLE cos_gold.fact_budgetary_control
        ADD COLUMNS (budget_revision_number INT)
    """)
    print("  ✅ Added column 'budget_revision_number' (no data rewrite)")
    print("  Existing rows show NULL for new column — no backfill needed")

    # ─────────────────────────────────────────────────────────────────
    # DEMO 6: MERGE/Upsert
    # ─────────────────────────────────────────────────────────────────
    print("\n\n📋 DEMO 6: MERGE — Incremental upsert")
    print("─" * 50)

    run_query("""
        MERGE INTO cos_gold.fact_budgetary_control AS target
        USING (
            SELECT 1 AS bc_key, 1 AS coa_key, 1 AS period_key, 1001 AS code_combination_id,
                   130000000.00 AS budget_amount, 92000000.00 AS actual_amount,
                   12000000.00 AS encumbrance_amount, 7200000.00 AS commitment_amount,
                   4800000.00 AS obligation_amount, 92000000.00 AS expenditure_amount,
                   26000000.00 AS funds_available, current_timestamp AS dw_load_date,
                   2025 AS fiscal_year, 1 AS budget_revision_number
        ) AS source
        ON target.code_combination_id = source.code_combination_id
           AND target.fiscal_year = source.fiscal_year
        WHEN MATCHED THEN UPDATE SET
            budget_amount = source.budget_amount,
            funds_available = source.funds_available,
            budget_revision_number = source.budget_revision_number,
            dw_load_date = source.dw_load_date
        WHEN NOT MATCHED THEN INSERT VALUES (
            source.bc_key, source.coa_key, source.period_key, source.code_combination_id,
            source.budget_amount, source.actual_amount, source.encumbrance_amount,
            source.commitment_amount, source.obligation_amount, source.expenditure_amount,
            source.funds_available, source.dw_load_date, source.fiscal_year,
            source.budget_revision_number
        )
    """)
    print("  ✅ MERGE complete — budget revised to $130M for Police")

    # ─────────────────────────────────────────────────────────────────
    # DEMO 7: Final state
    # ─────────────────────────────────────────────────────────────────
    print("\n\n📋 DEMO 7: Final Table State")
    print("─" * 50)

    run_query("""
        SELECT code_combination_id, budget_amount, actual_amount,
               funds_available, budget_revision_number
        FROM cos_gold.fact_budgetary_control
        ORDER BY code_combination_id
    """, show_results=True)

    # Summary
    print("\n\n" + "═" * 70)
    print("  ✅ DEMO COMPLETE")
    print("═" * 70)
    print("""
  Demonstrated:
    1. ✅ Data insertion (append)
    2. ✅ Snapshot creation & listing
    3. ✅ Data update (merge-on-read)
    4. ✅ Time travel (query historical state)
    5. ✅ Schema evolution (add column)
    6. ✅ MERGE/Upsert (incremental load)

  For maintenance operations (compaction, cleanup):
    → Use PySpark via Glue: docs/iceberg-pyspark-jobs.py
    → Maintenance runbook: docs/iceberg-maintenance-runbook.md
    """)


if __name__ == "__main__":
    main()
