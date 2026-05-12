# ═══════════════════════════════════════════════════════════════════════
# COS Financial Lakehouse — Terraform Provider Configuration
# ═══════════════════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      project = var.tag_project
      owner   = var.tag_owner
      env     = var.tag_env
      client  = var.tag_client
      retain  = var.tag_retain
    }
  }
}
