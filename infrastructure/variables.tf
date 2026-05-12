# ═══════════════════════════════════════════════════════════════════════
# COS Financial Lakehouse — Variables
# ═══════════════════════════════════════════════════════════════════════

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "project_name" {
  description = "Project name used in resource naming"
  type        = string
  default     = "cos-financial-lakehouse"
}

variable "bucket_name" {
  description = "S3 bucket name for the data lakehouse"
  type        = string
  default     = "cos-financial-lakehouse-demo"
}

variable "athena_results_bucket" {
  description = "S3 bucket for Athena query results"
  type        = string
  default     = "cos-athena-results-demo"
}

variable "glue_database_bronze" {
  description = "Glue database name for Bronze layer"
  type        = string
  default     = "cos_bronze"
}

variable "glue_database_silver" {
  description = "Glue database name for Silver layer"
  type        = string
  default     = "cos_silver"
}

variable "glue_database_gold" {
  description = "Glue database name for Gold layer"
  type        = string
  default     = "cos_gold"
}

# ─────────────────────────────────────────────────────────────────────
# MANDATORY ORGANIZATION TAGS
# These are required by org policy — resource creation will be DENIED
# if these tags are missing.
# ─────────────────────────────────────────────────────────────────────

variable "tag_project" {
  description = "Mandatory tag: project name"
  type        = string
  default     = "cos-financial-lakehouse"
}

variable "tag_owner" {
  description = "Mandatory tag: resource owner (your name or team)"
  type        = string
}

variable "tag_env" {
  description = "Mandatory tag: environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "tag_client" {
  description = "Mandatory tag: client name"
  type        = string
  default     = "City of Scottsdale"
}

variable "tag_retain" {
  description = "Mandatory tag: whether to retain resource (true/false)"
  type        = string
  default     = "false"

  validation {
    condition     = contains(["true", "false"], var.tag_retain)
    error_message = "tag_retain must be 'true' or 'false'."
  }
}
