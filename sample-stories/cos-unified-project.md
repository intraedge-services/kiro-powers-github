# Epic: Infrastructure Provisioning

## Story: Deploy AWS Lakehouse Infrastructure

As a data engineer, I want automated AWS infrastructure provisioning for the Iceberg lakehouse.

### Acceptance Criteria

- S3 bucket created with bronze/silver/gold folder structure
- Glue Catalog databases created (cos_bronze, cos_silver, cos_gold)
- Athena workgroup configured with Engine v3
- IAM roles provisioned for Glue ETL and Athena
- Mandatory org tags applied to all resources
- Terraform state stored securely

## Story: Create Iceberg Tables in Athena

As a data engineer, I want Iceberg tables registered in Glue Catalog via Athena DDL.

### Acceptance Criteria

- Bronze table created with raw BICC schema
- Silver table created with enriched schema
- Gold dimension tables created (dim_coa, dim_period, dim_supplier)
- Gold fact table created (fact_budgetary_control)
- All tables use only Athena-compatible TBLPROPERTIES
- Tables visible in Athena Query Editor

# Epic: Bronze Layer Ingestion

## Story: Load Oracle Fusion BICC Extract to Bronze

As a data engineer, I want raw Oracle Fusion PVO data loaded into the Bronze Iceberg table.

### Acceptance Criteria

- 100+ rows of realistic BudgetaryControlBalanceExtract data loaded
- Data includes all 9 departments across 12 fiscal periods
- BICC extract metadata preserved (extract_id, ingestion_timestamp)
- Append-only pattern maintained
- Iceberg snapshot created on each load
- Data queryable via Athena immediately after load

## Story: Simulate Incremental BICC Load

As a data engineer, I want to demonstrate incremental data loading from Oracle Fusion.

### Acceptance Criteria

- Second batch of records loaded with updated actuals
- New snapshot created (visible in iceberg_history)
- Time travel query shows before/after state
- No data loss from previous load

# Epic: Silver Layer Transformation

## Story: Transform Bronze to Silver with Deduplication

As a data engineer, I want Bronze data cleaned and deduplicated in the Silver layer.

### Acceptance Criteria

- Duplicate records removed (latest by last_update_date wins)
- Fiscal year derived from period_name (COS fiscal: Jul-Jun)
- Expenditure metrics calculated
- Funds available recalculated
- DW timestamps added (insert_date, update_date)
- Row count matches expected after dedup

## Story: Validate Silver Data Quality

As a data analyst, I want Silver layer data validated for completeness and accuracy.

### Acceptance Criteria

- All CCIDs from Bronze present in Silver
- Fiscal year correctly derived (JUL-2024 → FY2025)
- No NULL values in required fields
- Budget - Actual - Encumbrance = Funds Available (verified)

# Epic: Gold Layer Star Schema

## Story: Load Dimension Tables

As a BI developer, I want dimension tables populated for Power BI consumption.

### Acceptance Criteria

- dim_coa loaded with 10 departments across 5 funds
- dim_period loaded with 12 months (FY2025)
- dim_supplier loaded with 5 vendors
- CCID mapping verified (joins work correctly)
- is_current flag set for SCD tracking

## Story: Load Fact Table from Silver

As a BI developer, I want the fact table populated by joining Silver with dimensions.

### Acceptance Criteria

- fact_budgetary_control populated via Silver JOIN dim_coa JOIN dim_period
- Surrogate keys (coa_key, period_key) correctly assigned
- All Silver records with matching dimensions appear in Gold
- Budget totals match between Silver and Gold layers
- Data queryable for Power BI DirectQuery

# Epic: Analytics and Reporting

## Story: Executive Budget Dashboard Queries

As a finance director, I want budget vs actual analytics queryable in Athena.

### Acceptance Criteria

- Total budget KPI query returns correct billions figure
- Department burn rate ranking works
- Over-budget departments identified (negative funds_available)
- Quarterly trend aggregation works
- Fund-level comparison works

## Story: Iceberg Time Travel Demo

As a data architect, I want to demonstrate Iceberg time travel for audit purposes.

### Acceptance Criteria

- Snapshot history visible via $iceberg_history
- Point-in-time query returns historical state
- Before/after comparison demonstrates data lineage
- File inventory visible via $files metadata table

# Epic: AI-DLC Integration

## Story: Track Pipeline Tasks via GitHub Issues

As a project manager, I want pipeline deployment tracked as GitHub issues.

### Acceptance Criteria

- Each epic creates a GitHub milestone
- Each story creates a GitHub issue with acceptance criteria
- Issues labeled with user-story tag
- Progress visible in GitHub Projects board
- Status updates automated via AI-DLC tool

## Story: Map Stories to Pipeline Stages

As a lead architect, I want stories mapped to Bronze/Silver/Gold pipeline stages.

### Acceptance Criteria

- Infrastructure stories map to Terraform deployment
- Bronze stories map to ingestion pipeline
- Silver stories map to transformation pipeline
- Gold stories map to dimensional model loading
- Analytics stories map to validation queries
