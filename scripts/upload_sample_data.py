#!/usr/bin/env python3
"""
COS Financial Lakehouse — Upload Sample Data to S3
Generates realistic financial sample datasets and uploads to Bronze layer.

Usage:
    python scripts/upload_sample_data.py

Prerequisites:
    pip install boto3 pandas
    AWS credentials configured (aws configure)
"""

import boto3
import json
import csv
import io
import os
from datetime import datetime

# ─────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────

BUCKET_NAME = "cos-financial-lakehouse-demo"
REGION = "us-east-1"

# Mandatory org tags (must match your terraform.tfvars)
MANDATORY_TAGS = {
    "project": "cos-financial-lakehouse",
    "owner": os.environ.get("TAG_OWNER", "narmatha"),
    "env": os.environ.get("TAG_ENV", "dev"),
    "client": "City of Scottsdale",
    "retain": "false",
}

s3 = boto3.client("s3", region_name=REGION)

# ─────────────────────────────────────────────────────────────────────
# SAMPLE DATA: dim_coa (Chart of Accounts)
# ─────────────────────────────────────────────────────────────────────

DIM_COA = [
    {"code_combination_id": 1001, "fund": "100", "fund_description": "General Fund", "department": "4100", "department_description": "Police", "account": "5100", "account_description": "Salaries & Wages", "account_type": "E", "enabled_flag": "Y"},
    {"code_combination_id": 1002, "fund": "100", "fund_description": "General Fund", "department": "4100", "department_description": "Police", "account": "5200", "account_description": "Professional Services", "account_type": "E", "enabled_flag": "Y"},
    {"code_combination_id": 1003, "fund": "100", "fund_description": "General Fund", "department": "4200", "department_description": "Fire", "account": "5100", "account_description": "Salaries & Wages", "account_type": "E", "enabled_flag": "Y"},
    {"code_combination_id": 1004, "fund": "100", "fund_description": "General Fund", "department": "4200", "department_description": "Fire", "account": "5200", "account_description": "Professional Services", "account_type": "E", "enabled_flag": "Y"},
    {"code_combination_id": 1005, "fund": "100", "fund_description": "General Fund", "department": "4300", "department_description": "Public Works", "account": "5100", "account_description": "Salaries & Wages", "account_type": "E", "enabled_flag": "Y"},
    {"code_combination_id": 1006, "fund": "100", "fund_description": "General Fund", "department": "4300", "department_description": "Public Works", "account": "5300", "account_description": "Materials & Supplies", "account_type": "E", "enabled_flag": "Y"},
    {"code_combination_id": 1007, "fund": "100", "fund_description": "General Fund", "department": "4400", "department_description": "Parks & Rec", "account": "5100", "account_description": "Salaries & Wages", "account_type": "E", "enabled_flag": "Y"},
    {"code_combination_id": 1008, "fund": "100", "fund_description": "General Fund", "department": "4400", "department_description": "Parks & Rec", "account": "5400", "account_description": "Contracted Services", "account_type": "E", "enabled_flag": "Y"},
    {"code_combination_id": 1009, "fund": "100", "fund_description": "General Fund", "department": "4500", "department_description": "Community Dev", "account": "5100", "account_description": "Salaries & Wages", "account_type": "E", "enabled_flag": "Y"},
    {"code_combination_id": 1010, "fund": "100", "fund_description": "General Fund", "department": "4500", "department_description": "Community Dev", "account": "5200", "account_description": "Professional Services", "account_type": "E", "enabled_flag": "Y"},
    {"code_combination_id": 1011, "fund": "200", "fund_description": "Water Fund", "department": "4600", "department_description": "Water Resources", "account": "5100", "account_description": "Salaries & Wages", "account_type": "E", "enabled_flag": "Y"},
    {"code_combination_id": 1012, "fund": "200", "fund_description": "Water Fund", "department": "4600", "department_description": "Water Resources", "account": "5500", "account_description": "Utilities", "account_type": "E", "enabled_flag": "Y"},
    {"code_combination_id": 1013, "fund": "300", "fund_description": "Wastewater Fund", "department": "4700", "department_description": "Transportation", "account": "5100", "account_description": "Salaries & Wages", "account_type": "E", "enabled_flag": "Y"},
    {"code_combination_id": 1014, "fund": "400", "fund_description": "Transit Fund", "department": "4800", "department_description": "Library", "account": "5100", "account_description": "Salaries & Wages", "account_type": "E", "enabled_flag": "Y"},
    {"code_combination_id": 1015, "fund": "500", "fund_description": "Airport Fund", "department": "4900", "department_description": "Information Tech", "account": "5600", "account_description": "Technology Services", "account_type": "E", "enabled_flag": "Y"},
    {"code_combination_id": 1016, "fund": "100", "fund_description": "General Fund", "department": "5000", "department_description": "City Manager", "account": "5100", "account_description": "Salaries & Wages", "account_type": "E", "enabled_flag": "Y"},
]

# ─────────────────────────────────────────────────────────────────────
# SAMPLE DATA: dim_period (FY2025: Jul 2024 – Jun 2025)
# ─────────────────────────────────────────────────────────────────────

DIM_PERIOD = [
    {"period_name": "JUL-2024", "fiscal_year": 2025, "fiscal_quarter": 1, "fiscal_month": 1, "calendar_month_name": "July"},
    {"period_name": "AUG-2024", "fiscal_year": 2025, "fiscal_quarter": 1, "fiscal_month": 2, "calendar_month_name": "August"},
    {"period_name": "SEP-2024", "fiscal_year": 2025, "fiscal_quarter": 1, "fiscal_month": 3, "calendar_month_name": "September"},
    {"period_name": "OCT-2024", "fiscal_year": 2025, "fiscal_quarter": 2, "fiscal_month": 4, "calendar_month_name": "October"},
    {"period_name": "NOV-2024", "fiscal_year": 2025, "fiscal_quarter": 2, "fiscal_month": 5, "calendar_month_name": "November"},
    {"period_name": "DEC-2024", "fiscal_year": 2025, "fiscal_quarter": 2, "fiscal_month": 6, "calendar_month_name": "December"},
    {"period_name": "JAN-2025", "fiscal_year": 2025, "fiscal_quarter": 3, "fiscal_month": 7, "calendar_month_name": "January"},
    {"period_name": "FEB-2025", "fiscal_year": 2025, "fiscal_quarter": 3, "fiscal_month": 8, "calendar_month_name": "February"},
    {"period_name": "MAR-2025", "fiscal_year": 2025, "fiscal_quarter": 3, "fiscal_month": 9, "calendar_month_name": "March"},
    {"period_name": "APR-2025", "fiscal_year": 2025, "fiscal_quarter": 4, "fiscal_month": 10, "calendar_month_name": "April"},
    {"period_name": "MAY-2025", "fiscal_year": 2025, "fiscal_quarter": 4, "fiscal_month": 11, "calendar_month_name": "May"},
    {"period_name": "JUN-2025", "fiscal_year": 2025, "fiscal_quarter": 4, "fiscal_month": 12, "calendar_month_name": "June"},
]

# ─────────────────────────────────────────────────────────────────────
# SAMPLE DATA: dim_supplier
# ─────────────────────────────────────────────────────────────────────

DIM_SUPPLIER = [
    {"vendor_id": 2001, "supplier_name": "APS Energy", "supplier_status": "Active", "payment_terms": "Net 30", "commodity_category": "Utilities"},
    {"vendor_id": 2002, "supplier_name": "Salt River Project", "supplier_status": "Active", "payment_terms": "Net 30", "commodity_category": "Utilities"},
    {"vendor_id": 2003, "supplier_name": "Grainger Industrial", "supplier_status": "Active", "payment_terms": "Net 45", "commodity_category": "Materials & Supplies"},
    {"vendor_id": 2004, "supplier_name": "Home Depot Pro", "supplier_status": "Active", "payment_terms": "Net 30", "commodity_category": "Materials & Supplies"},
    {"vendor_id": 2005, "supplier_name": "Fisher Scientific", "supplier_status": "Active", "payment_terms": "Net 60", "commodity_category": "Lab Equipment"},
    {"vendor_id": 2006, "supplier_name": "W.W. Grainger", "supplier_status": "Active", "payment_terms": "Net 45", "commodity_category": "Facilities"},
    {"vendor_id": 2007, "supplier_name": "United Rentals", "supplier_status": "Active", "payment_terms": "Net 30", "commodity_category": "Equipment Rental"},
    {"vendor_id": 2008, "supplier_name": "Amazon Business", "supplier_status": "Active", "payment_terms": "Net 30", "commodity_category": "Office Supplies"},
    {"vendor_id": 2009, "supplier_name": "Lowes Pro", "supplier_status": "Active", "payment_terms": "Net 30", "commodity_category": "Building Materials"},
    {"vendor_id": 2010, "supplier_name": "CDW Government", "supplier_status": "Active", "payment_terms": "Net 45", "commodity_category": "Technology"},
]

# ─────────────────────────────────────────────────────────────────────
# SAMPLE DATA: fact_budgetary_control
# ─────────────────────────────────────────────────────────────────────

import random
random.seed(42)

FACT_BUDGET = []
for coa in DIM_COA:
    for period in DIM_PERIOD:
        budget = random.randint(5000000, 150000000)
        actual = int(budget * random.uniform(0.4, 0.85))
        encumbrance = int(budget * random.uniform(0.05, 0.15))
        FACT_BUDGET.append({
            "code_combination_id": coa["code_combination_id"],
            "period_name": period["period_name"],
            "budget_amount": budget,
            "actual_amount": actual,
            "encumbrance_amount": encumbrance,
            "commitment_amount": int(encumbrance * 0.6),
            "obligation_amount": int(encumbrance * 0.4),
            "expenditure_amount": actual,
            "funds_available": budget - actual - encumbrance,
            "last_update_date": "2025-05-08T06:00:00",
        })


# ─────────────────────────────────────────────────────────────────────
# UPLOAD FUNCTIONS
# ─────────────────────────────────────────────────────────────────────

def upload_csv(data, s3_key):
    """Convert list of dicts to CSV and upload to S3 with mandatory tags."""
    if not data:
        return

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=data[0].keys())
    writer.writeheader()
    writer.writerows(data)

    tag_string = "&".join(f"{k}={v}" for k, v in MANDATORY_TAGS.items())

    s3.put_object(
        Bucket=BUCKET_NAME,
        Key=s3_key,
        Body=output.getvalue().encode("utf-8"),
        ContentType="text/csv",
        Tagging=tag_string
    )
    print(f"  ✅ Uploaded {len(data)} rows → s3://{BUCKET_NAME}/{s3_key}")


def upload_json(data, s3_key):
    """Upload JSON data to S3 with mandatory tags."""
    tag_string = "&".join(f"{k}={v}" for k, v in MANDATORY_TAGS.items())

    s3.put_object(
        Bucket=BUCKET_NAME,
        Key=s3_key,
        Body=json.dumps(data, indent=2).encode("utf-8"),
        ContentType="application/json",
        Tagging=tag_string
    )
    print(f"  ✅ Uploaded → s3://{BUCKET_NAME}/{s3_key}")


# ─────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────

def main():
    today = datetime.now().strftime("%Y-%m-%d")

    print("=" * 60)
    print("  COS Financial Lakehouse — Sample Data Upload")
    print(f"  Bucket: {BUCKET_NAME}")
    print(f"  Date: {today}")
    print("=" * 60)

    # Upload dimension data (Gold layer reference)
    print("\n📋 Uploading dimension data...")
    upload_csv(DIM_COA, "gold/dim_coa/dim_coa.csv")
    upload_csv(DIM_PERIOD, "gold/dim_period/dim_period.csv")
    upload_csv(DIM_SUPPLIER, "gold/dim_supplier/dim_supplier.csv")

    # Upload fact data to Bronze (simulating BICC extract)
    print("\n📋 Uploading Bronze layer (BICC extract simulation)...")
    upload_csv(FACT_BUDGET, f"bronze/budget_control/ingestion_date={today}/extract.csv")

    # Upload a second day's extract (for incremental demo)
    # Modify a few records to simulate changes
    day2_budget = FACT_BUDGET[:5]  # Take first 5 records
    for row in day2_budget:
        row["actual_amount"] = int(row["actual_amount"] * 1.05)  # 5% increase
        row["funds_available"] = row["budget_amount"] - row["actual_amount"] - row["encumbrance_amount"]
        row["last_update_date"] = "2025-05-09T06:00:00"
    upload_csv(day2_budget, f"bronze/budget_control/ingestion_date=2025-05-09/extract.csv")

    # Upload metadata config
    print("\n📋 Uploading configuration...")
    config = {
        "project": "COS Financial Lakehouse",
        "version": "1.0.0",
        "created": today,
        "layers": ["bronze", "silver", "gold"],
        "tables": {
            "dimensions": ["dim_coa", "dim_period", "dim_supplier", "dim_ledger"],
            "facts": ["fact_budgetary_control", "fact_gl_actuals", "fact_ap_invoices", "fact_purchase_orders"]
        },
        "iceberg_version": "2",
        "partition_strategy": {
            "fact_budgetary_control": "fiscal_year",
            "fact_gl_actuals": "months(period_start_date)",
            "fact_ap_invoices": "months(invoice_date)"
        }
    }
    upload_json(config, "maintenance/config.json")

    print("\n" + "=" * 60)
    print("  ✅ Sample data upload complete!")
    print(f"  Total records: {len(DIM_COA) + len(DIM_PERIOD) + len(DIM_SUPPLIER) + len(FACT_BUDGET) + len(day2_budget)}")
    print("=" * 60)
    print("\n  Next: Run Iceberg table creation SQL in Athena")
    print("  File: scripts/create_gold_tables.sql\n")


if __name__ == "__main__":
    main()
