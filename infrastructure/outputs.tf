# ═══════════════════════════════════════════════════════════════════════
# COS Financial Lakehouse — Outputs
# ═══════════════════════════════════════════════════════════════════════

output "lakehouse_bucket_name" {
  description = "S3 bucket name for the data lakehouse"
  value       = aws_s3_bucket.lakehouse.id
}

output "lakehouse_bucket_arn" {
  description = "S3 bucket ARN"
  value       = aws_s3_bucket.lakehouse.arn
}

output "athena_workgroup" {
  description = "Athena workgroup name"
  value       = aws_athena_workgroup.cos_lakehouse.name
}

output "athena_results_location" {
  description = "S3 location for Athena query results"
  value       = "s3://${var.athena_results_bucket}/results/"
}

output "glue_database_bronze" {
  description = "Glue database for Bronze layer"
  value       = aws_glue_catalog_database.bronze.name
}

output "glue_database_silver" {
  description = "Glue database for Silver layer"
  value       = aws_glue_catalog_database.silver.name
}

output "glue_database_gold" {
  description = "Glue database for Gold layer"
  value       = aws_glue_catalog_database.gold.name
}

output "glue_etl_role_arn" {
  description = "IAM role ARN for Glue ETL jobs"
  value       = aws_iam_role.glue_etl.arn
}

output "athena_query_role_arn" {
  description = "IAM role ARN for Athena queries"
  value       = aws_iam_role.athena_query.arn
}

output "lambda_monitoring_role_arn" {
  description = "IAM role ARN for Lambda monitoring"
  value       = aws_iam_role.lambda_monitoring.arn
}

output "quickstart_instructions" {
  description = "Next steps after terraform apply"
  value       = <<-EOT

    ✅ Infrastructure provisioned successfully!

    Next steps:
    1. Upload sample data:    python scripts/upload_sample_data.py
    2. Create Iceberg tables: Run SQL in scripts/create_gold_tables.sql via Athena
    3. Run pipeline:          python scripts/iceberg_pipeline.py
    4. Demo time travel:      Run queries from docs/time-travel-demo-script.md

    Resources created:
    • S3 Bucket: ${var.bucket_name}
    • Glue Databases: ${var.glue_database_bronze}, ${var.glue_database_silver}, ${var.glue_database_gold}
    • Athena Workgroup: cos-financial-lakehouse
    • IAM Roles: glue-etl, athena-query, lambda-monitoring

  EOT
}
