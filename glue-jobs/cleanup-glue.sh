#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# COS Financial Lakehouse — Glue ETL Cleanup
# Removes all Glue jobs, workflow, triggers, and S3 scripts
#
# Usage:
#   chmod +x glue-jobs/cleanup-glue.sh
#   ./glue-jobs/cleanup-glue.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -uo pipefail

REGION="${AWS_REGION:-us-east-1}"
BUCKET="cos-financial-lakehouse-demo"
SCRIPTS_PREFIX="glue-scripts"
WORKFLOW_NAME="COS-Lakehouse-Pipeline"

echo ""
echo "⚠️  This will DELETE all COS Glue ETL resources:"
echo "    • Glue jobs"
echo "    • Glue workflow + triggers"
echo "    • S3 ETL scripts"
echo ""
read -p "Confirm deletion (type 'yes'): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Deleting triggers..."
for trigger in "COS-Daily-Bronze-Load" "COS-Bronze-Complete-Start-Silver" "COS-Silver-Complete-Start-Gold"; do
    aws glue delete-trigger --name "$trigger" --region "$REGION" 2>/dev/null && echo "  ✅ $trigger" || echo "  ⏭️  $trigger (not found)"
done

echo ""
echo "Deleting workflow..."
aws glue delete-workflow --name "$WORKFLOW_NAME" --region "$REGION" 2>/dev/null && echo "  ✅ $WORKFLOW_NAME" || echo "  ⏭️  Not found"

echo ""
echo "Deleting jobs..."
for job in "COS-UCM-to-Bronze-ETL" "COS-Bronze-to-Silver-ETL" "COS-Silver-to-Gold-ETL"; do
    aws glue delete-job --job-name "$job" --region "$REGION" 2>/dev/null && echo "  ✅ $job" || echo "  ⏭️  $job (not found)"
done

echo ""
echo "Removing S3 scripts..."
aws s3 rm "s3://$BUCKET/$SCRIPTS_PREFIX/" --recursive --region "$REGION" 2>/dev/null
echo "  ✅ s3://$BUCKET/$SCRIPTS_PREFIX/ cleared"

echo ""
echo "✅ Cleanup complete."
echo ""
echo "Note: IAM role '$GLUE_ROLE_NAME' was NOT deleted (may be shared)."
echo "To delete it: aws iam delete-role --role-name cos-financial-lakehouse-glue-etl-role"
