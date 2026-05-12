#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# COS Financial Lakehouse — Full Environment Setup
# Runs Terraform + uploads sample data + creates tables
#
# Prerequisites:
#   - AWS CLI configured (aws configure)
#   - Terraform installed (v1.5+)
#   - Python 3.9+ with boto3
#
# Usage:
#   chmod +x scripts/setup.sh
#   ./scripts/setup.sh
# ═══════════════════════════════════════════════════════════════════════

set -e

echo "════════════════════════════════════════════════════════════"
echo "  COS Financial Lakehouse — Automated Setup"
echo "════════════════════════════════════════════════════════════"
echo ""

# ─────────────────────────────────────────────────────────────────────
# Step 1: Verify prerequisites
# ─────────────────────────────────────────────────────────────────────
echo "📋 Step 1: Checking prerequisites..."

command -v aws >/dev/null 2>&1 || { echo "❌ AWS CLI not found. Install: https://aws.amazon.com/cli/"; exit 1; }
command -v terraform >/dev/null 2>&1 || { echo "❌ Terraform not found. Install: https://terraform.io/downloads"; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "❌ Python 3 not found."; exit 1; }

# Verify AWS credentials
aws sts get-caller-identity >/dev/null 2>&1 || { echo "❌ AWS credentials not configured. Run: aws configure"; exit 1; }

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region || echo "us-east-1")
echo "  ✅ AWS Account: $AWS_ACCOUNT"
echo "  ✅ AWS Region: $AWS_REGION"
echo ""

# ─────────────────────────────────────────────────────────────────────
# Step 2: Terraform — Provision infrastructure
# ─────────────────────────────────────────────────────────────────────
echo "📋 Step 2: Provisioning infrastructure with Terraform..."
echo ""

cd infrastructure

terraform init -input=false
terraform plan -out=tfplan
terraform apply -auto-approve tfplan

cd ..

echo ""
echo "  ✅ Infrastructure provisioned"
echo ""

# ─────────────────────────────────────────────────────────────────────
# Step 3: Upload sample data
# ─────────────────────────────────────────────────────────────────────
echo "📋 Step 3: Uploading sample financial data..."
echo ""

pip3 install boto3 --quiet 2>/dev/null
python3 scripts/upload_sample_data.py

echo ""

# ─────────────────────────────────────────────────────────────────────
# Step 4: Create Iceberg tables via Athena
# ─────────────────────────────────────────────────────────────────────
echo "📋 Step 4: Creating Iceberg tables in Athena..."
echo ""

python3 scripts/setup_athena.py

echo ""

# ─────────────────────────────────────────────────────────────────────
# Step 5: Load data into Iceberg tables (Bronze → Silver → Gold)
# ─────────────────────────────────────────────────────────────────────
echo "📋 Step 5: Loading data into Iceberg tables..."
echo ""

python3 scripts/load_iceberg_data.py

echo ""

# ─────────────────────────────────────────────────────────────────────
# Step 6: Verify setup
# ─────────────────────────────────────────────────────────────────────
echo "📋 Step 6: Verifying environment..."
echo ""

# Check S3 bucket
aws s3 ls s3://cos-financial-lakehouse-demo/ --summarize >/dev/null 2>&1 && echo "  ✅ S3 bucket accessible"

# Check Glue databases
aws glue get-database --name cos_bronze >/dev/null 2>&1 && echo "  ✅ Glue database: cos_bronze"
aws glue get-database --name cos_silver >/dev/null 2>&1 && echo "  ✅ Glue database: cos_silver"
aws glue get-database --name cos_gold >/dev/null 2>&1 && echo "  ✅ Glue database: cos_gold"

# Check Athena workgroup
aws athena get-work-group --work-group cos-financial-lakehouse >/dev/null 2>&1 && echo "  ✅ Athena workgroup: cos-financial-lakehouse"

echo ""
echo "════════════════════════════════════════════════════════════"
echo "  ✅ COS Financial Lakehouse — Setup Complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "  Resources created:"
echo "    • S3 Bucket: cos-financial-lakehouse-demo"
echo "    • Glue Databases: cos_bronze, cos_silver, cos_gold"
echo "    • Athena Workgroup: cos-financial-lakehouse"
echo "    • IAM Roles: glue-etl, athena-query, lambda-monitoring"
echo "    • Iceberg Tables: 8 tables across 3 layers"
echo "    • Sample Data: 192+ financial records"
echo ""
echo "  Next steps:"
echo "    1. Open Athena console → select workgroup 'cos-financial-lakehouse'"
echo "    2. Run: SELECT * FROM cos_gold.fact_budgetary_control LIMIT 10;"
echo "    3. Try time travel: docs/time-travel-demo-script.md"
echo "    4. Run pipeline: python3 scripts/iceberg_pipeline.py"
echo ""
