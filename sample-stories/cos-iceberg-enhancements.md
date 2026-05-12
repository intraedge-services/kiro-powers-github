# Epic: Iceberg Deep Dive Management

## Story: Upgrade Gold Layer Tables to Iceberg v2

As a data architect, I want to upgrade all Gold Layer tables to Iceberg v2 format with optimized table properties.

### Acceptance Criteria

- All Gold Layer tables use Iceberg format-version 2
- Write distribution mode set to hash for optimal file layout
- Merge-on-read enabled for delete operations
- Commit retry configured for concurrent write safety
- Table properties documented in DDL scripts

## Story: Implement Snapshot Retention Policy

As a data engineer, I want automated snapshot expiration to optimize S3 storage costs.

### Acceptance Criteria

- Snapshots older than 7 days are expired automatically
- Retention policy SQL commands are generated and tested
- S3 cost reduction is measurable after implementation
- Scheduled maintenance job runs daily

## Story: Implement Data File Compaction

As a data engineer, I want to compact small files from incremental BICC loads into larger query-optimized files.

### Acceptance Criteria

- Rewrite data files command merges small Parquet files
- Target file size is 256MB for optimal Redshift Spectrum performance
- Compaction runs after each BICC load cycle completes
- File count reduction is logged and measurable

## Story: Implement Metadata Cleanup

As a data engineer, I want to remove orphan files and rewrite manifests to keep metadata lean.

### Acceptance Criteria

- Orphan file removal command identifies and deletes unreferenced data files
- Manifest list rewrite consolidates metadata
- Cleanup runs weekly as scheduled maintenance
- Storage savings are logged

# Epic: Time Travel and Auditability

## Story: Create Point-in-Time Query Templates

As a data analyst, I want to query fact_budgetary_control at a specific snapshot to see historical budget state.

### Acceptance Criteria

- SQL template supports query by Snapshot ID
- SQL template supports query by Timestamp
- Demo shows $2.1B budget status before and after a specific update
- Template is parameterized and reusable across all fact tables

## Story: Create Time Travel Demo Script

As a lead architect, I want a demo script to explain Time Travel and Compaction to my team.

### Acceptance Criteria

- Script walks through snapshot listing
- Script demonstrates before/after query comparison
- Script shows compaction impact on file count
- Script includes talking points for team presentation

# Epic: Power BI Drill-Through Enhancement

## Story: Map CCID and Project ID Across All Fact Tables

As a BI developer, I want CodeCombinationId and Project_Id correctly mapped across all Fact tables for drill-through.

### Acceptance Criteria

- CCID joins verified between all fact tables and dim_coa
- Project_Id linkage validated in fact_budgetary_control and fact_purchase_orders
- Power BI relationship model updated with correct cardinality
- Cross-filter direction set appropriately for drill-through

## Story: Design Detail Page Drill-Through Blueprint

As a BI developer, I want a Detail Page where clicking an Executive KPI navigates to row-level PO and Invoice data.

### Acceptance Criteria

- Drill-through page shows PO Number and Invoice Description from Silver Layer
- Over-budget Departments KPI triggers navigation to detail
- Detail page includes Account, Supplier, Amount, and Status columns
- Back button returns user to Executive Summary
- Conditional formatting highlights over-budget rows

## Story: Update Power BI Relationship Map

As a BI developer, I want an updated relationship map reflecting all drill-through paths and new joins.

### Acceptance Criteria

- Relationship diagram includes Silver Layer tables for drill-through
- All join keys documented with cardinality
- Cross-filter directions specified
- Diagram exported as documentation artifact

# Epic: 26A Future-Proofing

## Story: Implement Schema Evolution for dim_coa

As a data architect, I want to add new segments to dim_coa without recreating the table using Iceberg schema evolution.

### Acceptance Criteria

- ALTER TABLE ADD COLUMN demonstrated for new segment
- Existing queries continue to work without modification
- Historical data shows NULL for new column (no backfill required)
- Schema evolution documented with Oracle 26A context
- Partition evolution strategy documented if applicable
