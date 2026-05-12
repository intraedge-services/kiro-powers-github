#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════
# COS Financial Lakehouse — Teardown (destroy all resources)
#
# ⚠️  WARNING: This will DELETE all resources and data!
#
# Usage:
#   chmod +x scripts/teardown.sh
#   ./scripts/teardown.sh
# ═══════════════════════════════════════════════════════════════════════

set -e

echo "⚠️  WARNING: This will destroy ALL COS Lakehouse resources!"
echo "   - S3 buckets and all data"
echo "   - Glue databases and tables"
echo "   - Athena workgroup"
echo "   - IAM roles"
echo ""
read -p "Are you sure? (type 'yes' to confirm): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Emptying S3 buckets..."
aws s3 rm s3://cos-financial-lakehouse-demo --recursive 2>/dev/null || true
aws s3 rm s3://cos-athena-results-demo --recursive 2>/dev/null || true

echo "Running terraform destroy..."
cd infrastructure
terraform destroy -auto-approve
cd ..

echo ""
echo "✅ All resources destroyed."
