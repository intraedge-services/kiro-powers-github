#!/usr/bin/env python3
"""
COS Financial Lakehouse — Create Iceberg Tables via Athena
Reads SQL from create_gold_tables.sql and executes each statement.

Usage:
    python scripts/setup_athena.py
"""

import boto3
import time
import os

# ─────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────

REGION = os.environ.get("AWS_REGION", "us-east-1")
WORKGROUP = "cos-financial-lakehouse"
OUTPUT_LOCATION = "s3://cos-athena-results-demo/results/"

athena = boto3.client("athena", region_name=REGION)


def run_query(sql, database="cos_gold"):
    """Execute a single Athena query and wait for completion."""
    response = athena.start_query_execution(
        QueryString=sql,
        QueryExecutionContext={"Database": database},
        WorkGroup=WORKGROUP,
    )

    query_id = response["QueryExecutionId"]

    # Wait for completion
    while True:
        result = athena.get_query_execution(QueryExecutionId=query_id)
        state = result["QueryExecution"]["Status"]["State"]

        if state in ("SUCCEEDED", "FAILED", "CANCELLED"):
            break
        time.sleep(1)

    if state == "FAILED":
        reason = result["QueryExecution"]["Status"].get("StateChangeReason", "Unknown")
        print(f"    ❌ FAILED: {reason}")
        return False

    return True


def parse_sql_file(filepath):
    """Parse SQL file into individual statements, skipping comments."""
    with open(filepath, "r") as f:
        content = f.read()

    # Remove single-line comments
    lines = []
    for line in content.split("\n"):
        stripped = line.strip()
        if stripped.startswith("--") or stripped == "":
            continue
        lines.append(line)

    # Split by semicolons
    full_text = "\n".join(lines)
    statements = [s.strip() for s in full_text.split(";") if s.strip()]

    return statements


def main():
    print("  Creating Iceberg tables via Athena...")
    print(f"  Workgroup: {WORKGROUP}")
    print(f"  Region: {REGION}")
    print("")

    sql_file = os.path.join(os.path.dirname(__file__), "create_gold_tables.sql")
    statements = parse_sql_file(sql_file)

    success = 0
    failed = 0

    for i, sql in enumerate(statements, 1):
        # Determine which database to use
        if "cos_bronze." in sql:
            db = "cos_bronze"
        elif "cos_silver." in sql:
            db = "cos_silver"
        else:
            db = "cos_gold"

        # Get table name for display
        table_name = "unknown"
        if "CREATE TABLE" in sql.upper():
            parts = sql.split("CREATE TABLE")[1].strip().split("(")[0].strip()
            table_name = parts

        print(f"  [{i}/{len(statements)}] Creating: {table_name}")

        if run_query(sql, db):
            success += 1
            print(f"    ✅ Created")
        else:
            failed += 1

    print(f"\n  Results: {success} created, {failed} failed")


if __name__ == "__main__":
    main()
