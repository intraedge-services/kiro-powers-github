#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# COS Financial Lakehouse — Glue ETL Deployment (One-Click)
#
# Deploys:
#   1. Uploads ETL scripts to S3
#   2. Creates IAM role (if not exists)
#   3. Creates 3 Glue jobs (Iceberg + Glue 4.0)
#   4. Creates Glue workflow with triggers
#   5. Validates deployment
#
# Usage:
#   chmod +x glue-jobs/deploy-glue.sh
#   ./glue-jobs/deploy-glue.sh
#
# Works in: AWS CloudShell, local terminal, GitHub Actions (OIDC)
# No hardcoded credentials — uses IAM role chain or environment credentials
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION (edit these for your environment)
# ─────────────────────────────────────────────────────────────────────────────

REGION="${AWS_REGION:-us-east-1}"
BUCKET="cos-financial-lakehouse-demo"
SCRIPTS_PREFIX="glue-scripts"
GLUE_ROLE_NAME="cos-financial-lakehouse-glue-etl-role"
WORKFLOW_NAME="COS-Lakehouse-Pipeline"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Job names
JOB_BRONZE="COS-UCM-to-Bronze-ETL"
JOB_SILVER="COS-Bronze-to-Silver-ETL"
JOB_GOLD="COS-Silver-to-Gold-ETL"

# Mandatory org tags
TAG_PROJECT="${TAG_PROJECT:-cos-financial-lakehouse}"
TAG_OWNER="${TAG_OWNER:-$(aws sts get-caller-identity --query 'Arn' --output text 2>/dev/null | cut -d'/' -f2 || echo 'unknown')}"
TAG_ENV="${TAG_ENV:-dev}"
TAG_CLIENT="${TAG_CLIENT:-COS}"
TAG_RETAIN="${TAG_RETAIN:-false}"

TAGS="{\"project\":\"${TAG_PROJECT}\",\"owner\":\"${TAG_OWNER}\",\"env\":\"${TAG_ENV}\",\"client\":\"${TAG_CLIENT}\",\"retain\":\"${TAG_RETAIN}\"}"

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  COS GLUE ETL — AUTOMATED DEPLOYMENT"
echo "═══════════════════════════════════════════════════════════════════"
echo "  Region:   $REGION"
echo "  Bucket:   $BUCKET"
echo "  Role:     $GLUE_ROLE_NAME"
echo "  Owner:    $TAG_OWNER"
echo "  Time:     $(date '+%Y-%m-%d %H:%M:%S')"
echo "═══════════════════════════════════════════════════════════════════"

# ─────────────────────────────────────────────────────────────────────────────
# PRE-FLIGHT CHECKS
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "📋 Pre-flight checks..."

# Verify AWS credentials
ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text --region "$REGION" 2>&1)
if [ $? -ne 0 ]; then
    echo "  ❌ AWS credentials not configured."
    echo "     For CloudShell: credentials are automatic"
    echo "     For local: run 'aws configure' or export AWS_PROFILE"
    echo "     For GitHub Actions: configure OIDC role"
    exit 1
fi
echo "  ✅ AWS Account: $ACCOUNT_ID"

# Verify S3 bucket exists
aws s3api head-bucket --bucket "$BUCKET" --region "$REGION" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "  ❌ S3 bucket '$BUCKET' not found. Run Terraform first."
    exit 1
fi
echo "  ✅ S3 bucket exists"

# Verify Glue ETL scripts exist locally
for script in ucm_to_bronze_etl.py bronze_to_silver_etl.py silver_to_gold_etl.py; do
    if [ ! -f "$SCRIPT_DIR/$script" ]; then
        echo "  ❌ Script not found: $SCRIPT_DIR/$script"
        exit 1
    fi
done
echo "  ✅ ETL scripts found"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 1: Upload ETL scripts to S3
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  📤 STEP 1: Upload ETL scripts to S3"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for script in ucm_to_bronze_etl.py bronze_to_silver_etl.py silver_to_gold_etl.py; do
    echo "  → Uploading $script"
    aws s3 cp "$SCRIPT_DIR/$script" "s3://$BUCKET/$SCRIPTS_PREFIX/$script" \
        --region "$REGION" \
        --quiet
    echo "    ✅ s3://$BUCKET/$SCRIPTS_PREFIX/$script"
done

# ─────────────────────────────────────────────────────────────────────────────
# STEP 2: Create/Verify IAM Role
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔐 STEP 2: IAM Role"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ROLE_ARN=$(aws iam get-role --role-name "$GLUE_ROLE_NAME" --query 'Role.Arn' --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$ROLE_ARN" = "NOT_FOUND" ]; then
    echo "  → Creating IAM role: $GLUE_ROLE_NAME"

    # Trust policy for Glue
    TRUST_POLICY='{
        "Version": "2012-10-17",
        "Statement": [{
            "Effect": "Allow",
            "Principal": {"Service": "glue.amazonaws.com"},
            "Action": "sts:AssumeRole"
        }]
    }'

    aws iam create-role \
        --role-name "$GLUE_ROLE_NAME" \
        --assume-role-policy-document "$TRUST_POLICY" \
        --tags "Key=project,Value=$TAG_PROJECT" "Key=owner,Value=$TAG_OWNER" "Key=env,Value=$TAG_ENV" "Key=client,Value=$TAG_CLIENT" "Key=retain,Value=$TAG_RETAIN" \
        --region "$REGION" \
        --output text --query 'Role.Arn'

    # Attach managed policy
    aws iam attach-role-policy \
        --role-name "$GLUE_ROLE_NAME" \
        --policy-arn "arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole"

    # Inline policy for S3 + Glue Catalog
    INLINE_POLICY="{
        \"Version\": \"2012-10-17\",
        \"Statement\": [
            {
                \"Effect\": \"Allow\",
                \"Action\": [\"s3:GetObject\", \"s3:PutObject\", \"s3:DeleteObject\", \"s3:ListBucket\"],
                \"Resource\": [\"arn:aws:s3:::$BUCKET\", \"arn:aws:s3:::$BUCKET/*\"]
            },
            {
                \"Effect\": \"Allow\",
                \"Action\": [\"glue:*Database*\", \"glue:*Table*\", \"glue:*Partition*\", \"glue:GetUserDefinedFunction*\"],
                \"Resource\": [\"*\"]
            },
            {
                \"Effect\": \"Allow\",
                \"Action\": [\"logs:CreateLogGroup\", \"logs:CreateLogStream\", \"logs:PutLogEvents\"],
                \"Resource\": [\"arn:aws:logs:*:*:*\"]
            }
        ]
    }"

    aws iam put-role-policy \
        --role-name "$GLUE_ROLE_NAME" \
        --policy-name "cos-lakehouse-etl-access" \
        --policy-document "$INLINE_POLICY"

    # Wait for role propagation
    echo "  → Waiting 10s for IAM propagation..."
    sleep 10

    ROLE_ARN=$(aws iam get-role --role-name "$GLUE_ROLE_NAME" --query 'Role.Arn' --output text)
    echo "  ✅ Role created: $ROLE_ARN"
else
    echo "  ✅ Role exists: $ROLE_ARN"
fi

# ─────────────────────────────────────────────────────────────────────────────
# STEP 3: Create Glue Jobs
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ⚙️  STEP 3: Create Glue Jobs"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

create_glue_job() {
    local job_name="$1"
    local script_name="$2"
    local extra_args="$3"

    echo "  → Creating job: $job_name"

    # Delete if exists (idempotent)
    aws glue delete-job --job-name "$job_name" --region "$REGION" 2>/dev/null || true

    aws glue create-job \
        --name "$job_name" \
        --role "$ROLE_ARN" \
        --command "{
            \"Name\": \"glueetl\",
            \"ScriptLocation\": \"s3://$BUCKET/$SCRIPTS_PREFIX/$script_name\",
            \"PythonVersion\": \"3\"
        }" \
        --glue-version "4.0" \
        --number-of-workers 2 \
        --worker-type "G.1X" \
        --default-arguments "{
            \"--enable-job-bookmarks\": \"true\",
            \"--datalake-formats\": \"iceberg\",
            \"--conf\": \"spark.sql.extensions=org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions\",
            $extra_args
        }" \
        --tags "$TAGS" \
        --region "$REGION" \
        --output text --query 'Name' > /dev/null

    echo "    ✅ $job_name created"
}

# Job 1: UCM to Bronze
create_glue_job "$JOB_BRONZE" "ucm_to_bronze_etl.py" \
    "\"--LANDING_PATH\": \"s3://$BUCKET/landing/\", \"--BRONZE_PATH\": \"s3://$BUCKET/bronze/\", \"--QUARANTINE_PATH\": \"s3://$BUCKET/quarantine/\", \"--CATALOG\": \"glue_catalog\", \"--DATABASE\": \"cos_bronze\""

# Job 2: Bronze to Silver
create_glue_job "$JOB_SILVER" "bronze_to_silver_etl.py" \
    "\"--CATALOG\": \"glue_catalog\", \"--BRONZE_DB\": \"cos_bronze\", \"--SILVER_DB\": \"cos_silver\""

# Job 3: Silver to Gold
create_glue_job "$JOB_GOLD" "silver_to_gold_etl.py" \
    "\"--CATALOG\": \"glue_catalog\", \"--SILVER_DB\": \"cos_silver\", \"--GOLD_DB\": \"cos_gold\""

# ─────────────────────────────────────────────────────────────────────────────
# STEP 4: Create Workflow + Triggers
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  🔗 STEP 4: Create Workflow & Triggers"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Delete existing workflow (idempotent)
aws glue delete-workflow --name "$WORKFLOW_NAME" --region "$REGION" 2>/dev/null || true
sleep 2

# Create workflow
echo "  → Creating workflow: $WORKFLOW_NAME"
aws glue create-workflow \
    --name "$WORKFLOW_NAME" \
    --description "COS Financial Lakehouse: Bronze → Silver → Gold" \
    --tags "$TAGS" \
    --region "$REGION" > /dev/null
echo "    ✅ Workflow created"

# Trigger 1: Scheduled start (daily 6 AM UTC)
echo "  → Creating trigger: Daily-Bronze-Load"
aws glue create-trigger \
    --name "COS-Daily-Bronze-Load" \
    --type "SCHEDULED" \
    --schedule "cron(0 6 * * ? *)" \
    --workflow-name "$WORKFLOW_NAME" \
    --actions "[{\"JobName\": \"$JOB_BRONZE\"}]" \
    --start-on-creation \
    --tags "$TAGS" \
    --region "$REGION" > /dev/null
echo "    ✅ Scheduled trigger (daily 6 AM UTC)"

# Trigger 2: Bronze success → start Silver
echo "  → Creating trigger: Bronze-to-Silver"
aws glue create-trigger \
    --name "COS-Bronze-Complete-Start-Silver" \
    --type "CONDITIONAL" \
    --workflow-name "$WORKFLOW_NAME" \
    --predicate "{\"Conditions\": [{\"LogicalOperator\": \"EQUALS\", \"JobName\": \"$JOB_BRONZE\", \"State\": \"SUCCEEDED\"}]}" \
    --actions "[{\"JobName\": \"$JOB_SILVER\"}]" \
    --start-on-creation \
    --tags "$TAGS" \
    --region "$REGION" > /dev/null
echo "    ✅ Conditional trigger (Bronze → Silver)"

# Trigger 3: Silver success → start Gold
echo "  → Creating trigger: Silver-to-Gold"
aws glue create-trigger \
    --name "COS-Silver-Complete-Start-Gold" \
    --type "CONDITIONAL" \
    --workflow-name "$WORKFLOW_NAME" \
    --predicate "{\"Conditions\": [{\"LogicalOperator\": \"EQUALS\", \"JobName\": \"$JOB_SILVER\", \"State\": \"SUCCEEDED\"}]}" \
    --actions "[{\"JobName\": \"$JOB_GOLD\"}]" \
    --start-on-creation \
    --tags "$TAGS" \
    --region "$REGION" > /dev/null
echo "    ✅ Conditional trigger (Silver → Gold)"

# ─────────────────────────────────────────────────────────────────────────────
# STEP 5: Validation
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ STEP 5: Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "  S3 Scripts:"
aws s3 ls "s3://$BUCKET/$SCRIPTS_PREFIX/" --region "$REGION" 2>/dev/null | while read -r line; do
    echo "    $line"
done

echo ""
echo "  Glue Jobs:"
for job in "$JOB_BRONZE" "$JOB_SILVER" "$JOB_GOLD"; do
    STATUS=$(aws glue get-job --job-name "$job" --region "$REGION" --query 'Job.Name' --output text 2>/dev/null || echo "NOT_FOUND")
    if [ "$STATUS" != "NOT_FOUND" ]; then
        echo "    ✅ $job"
    else
        echo "    ❌ $job (not found)"
    fi
done

echo ""
echo "  Workflow:"
WF_STATUS=$(aws glue get-workflow --name "$WORKFLOW_NAME" --region "$REGION" --query 'Workflow.Name' --output text 2>/dev/null || echo "NOT_FOUND")
if [ "$WF_STATUS" != "NOT_FOUND" ]; then
    echo "    ✅ $WORKFLOW_NAME"
else
    echo "    ❌ $WORKFLOW_NAME (not found)"
fi

echo ""
echo "  Triggers:"
for trigger in "COS-Daily-Bronze-Load" "COS-Bronze-Complete-Start-Silver" "COS-Silver-Complete-Start-Gold"; do
    T_STATUS=$(aws glue get-trigger --name "$trigger" --region "$REGION" --query 'Trigger.State' --output text 2>/dev/null || echo "NOT_FOUND")
    echo "    $trigger: $T_STATUS"
done

# ─────────────────────────────────────────────────────────────────────────────
# SUMMARY
# ─────────────────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "  🎉 GLUE ETL DEPLOYMENT COMPLETE"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "  Deployed:"
echo "    • 3 ETL scripts → s3://$BUCKET/$SCRIPTS_PREFIX/"
echo "    • 3 Glue jobs (Glue 4.0 + Iceberg)"
echo "    • 1 Workflow with 3 triggers (daily 6 AM UTC)"
echo "    • IAM role: $GLUE_ROLE_NAME"
echo ""
echo "  Run manually:"
echo "    aws glue start-job-run --job-name $JOB_BRONZE"
echo ""
echo "  Run full pipeline:"
echo "    aws glue start-workflow-run --name $WORKFLOW_NAME"
echo ""
echo "  Monitor:"
echo "    aws glue get-workflow-run --name $WORKFLOW_NAME --run-id <id>"
echo ""
