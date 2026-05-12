# ═══════════════════════════════════════════════════════════════════════
# COS Financial Lakehouse — Main Infrastructure
# Creates: S3, Glue Catalog, Athena, IAM roles
# ═══════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────
# 1. S3 BUCKETS
# ─────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "lakehouse" {
  bucket = var.bucket_name
}

resource "aws_s3_bucket_versioning" "lakehouse" {
  bucket = aws_s3_bucket.lakehouse.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "lakehouse" {
  bucket = aws_s3_bucket.lakehouse.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket" "athena_results" {
  bucket = var.athena_results_bucket
}

# Create medallion folder structure
resource "aws_s3_object" "bronze_folder" {
  bucket  = aws_s3_bucket.lakehouse.id
  key     = "bronze/"
  content = ""
}

resource "aws_s3_object" "silver_folder" {
  bucket  = aws_s3_bucket.lakehouse.id
  key     = "silver/"
  content = ""
}

resource "aws_s3_object" "gold_folder" {
  bucket  = aws_s3_bucket.lakehouse.id
  key     = "gold/"
  content = ""
}

resource "aws_s3_object" "bronze_subfolders" {
  for_each = toset([
    "bronze/budget_control/",
    "bronze/gl_balances/",
    "bronze/ap_invoices/",
    "bronze/po_headers/",
  ])
  bucket  = aws_s3_bucket.lakehouse.id
  key     = each.value
  content = ""
}

resource "aws_s3_object" "silver_subfolders" {
  for_each = toset([
    "silver/budget_control_clean/",
    "silver/gl_balances_clean/",
    "silver/ap_invoices_clean/",
    "silver/po_distributions_clean/",
  ])
  bucket  = aws_s3_bucket.lakehouse.id
  key     = each.value
  content = ""
}

resource "aws_s3_object" "gold_subfolders" {
  for_each = toset([
    "gold/dim_coa/",
    "gold/dim_period/",
    "gold/dim_supplier/",
    "gold/dim_ledger/",
    "gold/fact_budgetary_control/",
    "gold/fact_gl_actuals/",
    "gold/fact_ap_invoices/",
    "gold/fact_purchase_orders/",
  ])
  bucket  = aws_s3_bucket.lakehouse.id
  key     = each.value
  content = ""
}

resource "aws_s3_object" "maintenance_folder" {
  bucket  = aws_s3_bucket.lakehouse.id
  key     = "maintenance/logs/"
  content = ""
}

# ─────────────────────────────────────────────────────────────────────
# 2. AWS GLUE CATALOG DATABASES
# ─────────────────────────────────────────────────────────────────────

resource "aws_glue_catalog_database" "bronze" {
  name        = var.glue_database_bronze
  description = "COS Bronze Layer — Raw BICC extracts (append-only)"

  location_uri = "s3://${var.bucket_name}/bronze/"
}

resource "aws_glue_catalog_database" "silver" {
  name        = var.glue_database_silver
  description = "COS Silver Layer — Cleaned, deduplicated, MERGE/Upsert"

  location_uri = "s3://${var.bucket_name}/silver/"
}

resource "aws_glue_catalog_database" "gold" {
  name        = var.glue_database_gold
  description = "COS Gold Layer — Kimball Star Schema for Power BI"

  location_uri = "s3://${var.bucket_name}/gold/"
}

# ─────────────────────────────────────────────────────────────────────
# 3. ATHENA WORKGROUP
# ─────────────────────────────────────────────────────────────────────

resource "aws_athena_workgroup" "cos_lakehouse" {
  name        = "cos-financial-lakehouse"
  description = "COS Financial Lakehouse — Iceberg queries"
  state       = "ENABLED"

  configuration {
    enforce_workgroup_configuration = true

    result_configuration {
      output_location = "s3://${var.athena_results_bucket}/results/"

      encryption_configuration {
        encryption_option = "SSE_S3"
      }
    }

    engine_version {
      selected_engine_version = "Athena engine version 3"
    }
  }
}

# ─────────────────────────────────────────────────────────────────────
# 4. IAM ROLES
# ─────────────────────────────────────────────────────────────────────

# Glue ETL Role
resource "aws_iam_role" "glue_etl" {
  name = "${var.project_name}-glue-etl-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "glue.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "glue_etl_policy" {
  name = "${var.project_name}-glue-etl-policy"
  role = aws_iam_role.glue_etl.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.lakehouse.arn,
          "${aws_s3_bucket.lakehouse.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "glue:*Database*",
          "glue:*Table*",
          "glue:*Partition*",
          "glue:GetUserDefinedFunction*"
        ]
        Resource = ["*"]
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = ["arn:aws:logs:*:*:*"]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "glue_service" {
  role       = aws_iam_role.glue_etl.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSGlueServiceRole"
}

# Athena Query Role
resource "aws_iam_role" "athena_query" {
  name = "${var.project_name}-athena-query-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "athena.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "athena_query_policy" {
  name = "${var.project_name}-athena-query-policy"
  role = aws_iam_role.athena_query.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = [
          aws_s3_bucket.lakehouse.arn,
          "${aws_s3_bucket.lakehouse.arn}/*",
          aws_s3_bucket.athena_results.arn,
          "${aws_s3_bucket.athena_results.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = [
          "${aws_s3_bucket.athena_results.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "glue:GetDatabase*",
          "glue:GetTable*",
          "glue:GetPartition*"
        ]
        Resource = ["*"]
      }
    ]
  })
}

# Lambda Monitoring Role
resource "aws_iam_role" "lambda_monitoring" {
  name = "${var.project_name}-lambda-monitoring-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_basic" {
  role       = aws_iam_role.lambda_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "lambda_monitoring_policy" {
  name = "${var.project_name}-lambda-monitoring-policy"
  role = aws_iam_role.lambda_monitoring.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "athena:StartQueryExecution",
          "athena:GetQueryExecution",
          "athena:GetQueryResults"
        ]
        Resource = ["*"]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.athena_results.arn,
          "${aws_s3_bucket.athena_results.arn}/*"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["cloudwatch:PutMetricData"]
        Resource = ["*"]
      },
      {
        Effect = "Allow"
        Action = [
          "glue:GetTable*",
          "glue:GetDatabase*"
        ]
        Resource = ["*"]
      }
    ]
  })
}
