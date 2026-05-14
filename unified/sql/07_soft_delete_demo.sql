-- ═══════════════════════════════════════════════════════════════════════════════
-- COS FINANCIAL LAKEHOUSE — SOFT DELETE & LOGICAL DELETE DEMO
-- Enterprise Finance: Why We Never Hard Delete
--
-- Run sequentially in Athena | Database: cos_gold
-- Workgroup: cos-financial-lakehouse
-- ═══════════════════════════════════════════════════════════════════════════════


-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 1: ADD SOFT DELETE COLUMNS TO ALL DIMENSIONS
-- ═════════════════════════════════════════════════════════════════════════════
-- TALKING POINT: "Finance systems never hard-delete records. We use logical
-- deletes — marking records inactive while preserving full history for
-- compliance, audit, and rollback."

-- Add soft delete framework to dim_supplier
ALTER TABLE cos_gold.dim_supplier ADD COLUMNS (
    is_active boolean,
    is_deleted boolean,
    effective_start_date date,
    effective_end_date date,
    deactivation_reason string,
    last_updated_timestamp timestamp
);

-- Add soft delete framework to dim_coa
ALTER TABLE cos_gold.dim_coa ADD COLUMNS (
    is_active boolean,
    is_deleted boolean,
    effective_start_date date,
    effective_end_date date,
    retirement_reason string,
    last_updated_timestamp timestamp
);


-- ═════════════════════════════════════════════════════════════════════════════
-- STEP 2: SET ALL EXISTING RECORDS AS ACTIVE
-- ═════════════════════════════════════════════════════════════════════════════

UPDATE cos_gold.dim_supplier
SET is_active = true,
    is_deleted = false,
    effective_start_date = DATE '2024-07-01',
    effective_end_date = DATE '9999-12-31',
    last_updated_timestamp = CURRENT_TIMESTAMP;

UPDATE cos_gold.dim_coa
SET is_active = true,
    is_deleted = false,
    effective_start_date = DATE '2024-07-01',
    effective_end_date = DATE '9999-12-31',
    last_updated_timestamp = CURRENT_TIMESTAMP;

-- VERIFY: All suppliers active
SELECT supplier_name, is_active, is_deleted, effective_start_date
FROM cos_gold.dim_supplier;


-- ═════════════════════════════════════════════════════════════════════════════
-- SCENARIO A: SUPPLIER IS ACTIVE (Current State)
-- ═════════════════════════════════════════════════════════════════════════════
-- TALKING POINT: "Right now, all 5 suppliers are active. Grainger Industrial
-- has been supplying materials since FY2025 started."

SELECT
    supplier_name,
    supplier_status,
    is_active,
    effective_start_date,
    effective_end_date
FROM cos_gold.dim_supplier
WHERE supplier_name = 'Grainger Industrial';
-- Result: is_active = true, effective_end_date = 9999-12-31


-- ═════════════════════════════════════════════════════════════════════════════
-- SCENARIO B: SUPPLIER DEACTIVATED (Logical Delete)
-- ═════════════════════════════════════════════════════════════════════════════
-- TALKING POINT: "Grainger Industrial lost their contract. In Oracle Fusion,
-- the supplier is deactivated — not deleted. Our pipeline receives this as
-- a status change and marks the record inactive."

-- Simulate: Oracle sends supplier deactivation via BICC
UPDATE cos_gold.dim_supplier
SET is_active = false,
    is_deleted = true,
    supplier_status = 'Inactive',
    effective_end_date = DATE '2025-05-14',
    deactivation_reason = 'Contract terminated - non-compliance',
    last_updated_timestamp = CURRENT_TIMESTAMP
WHERE supplier_name = 'Grainger Industrial';

-- VERIFY: Supplier is now logically deleted
SELECT
    supplier_name,
    supplier_status,
    is_active,
    is_deleted,
    effective_end_date,
    deactivation_reason
FROM cos_gold.dim_supplier
WHERE supplier_name = 'Grainger Industrial';
-- Result: is_active = false, is_deleted = true, reason = 'Contract terminated'


-- ═════════════════════════════════════════════════════════════════════════════
-- SCENARIO C: QUERY CURRENT STATE — Supplier Inactive
-- ═════════════════════════════════════════════════════════════════════════════
-- TALKING POINT: "Current reports only show active suppliers. Grainger no
-- longer appears in active supplier lists — but the record still EXISTS."

-- Active suppliers only (what Power BI dashboard shows)
SELECT supplier_name, supplier_status, payment_terms
FROM cos_gold.dim_supplier
WHERE is_active = true;
-- Grainger is NOT in this list

-- All suppliers including inactive (for audit)
SELECT supplier_name, supplier_status, is_active, deactivation_reason
FROM cos_gold.dim_supplier;
-- Grainger IS here with full deactivation history


-- ═════════════════════════════════════════════════════════════════════════════
-- SCENARIO D: TIME TRAVEL — See Supplier When It Was Still Active
-- ═════════════════════════════════════════════════════════════════════════════
-- TALKING POINT: "The auditor asks: 'Was Grainger active when we issued
-- PO-2025-003 in January?' With Iceberg time travel, we answer instantly."

-- View snapshot history (shows when the deactivation happened)
SELECT * FROM cos_gold."dim_supplier$snapshots"
ORDER BY committed_at DESC;

-- Query the state BEFORE deactivation (use timestamp before the UPDATE)
-- Replace with actual timestamp from snapshot history above:
-- SELECT supplier_name, supplier_status, is_active
-- FROM cos_gold.dim_supplier
-- FOR TIMESTAMP AS OF TIMESTAMP '2026-05-14 13:00:00'
-- WHERE supplier_name = 'Grainger Industrial';
-- Result: is_active = true (supplier was active at that time!)


-- ═════════════════════════════════════════════════════════════════════════════
-- SCENARIO E: DEPARTMENT CLOSURE (COA Retirement)
-- ═════════════════════════════════════════════════════════════════════════════
-- TALKING POINT: "The City Manager's office is being restructured. The old
-- department code is retired — but all historical budget data must remain
-- queryable for 7 years per compliance requirements."

-- Retire the City Manager department (CCID 1016)
UPDATE cos_gold.dim_coa
SET is_active = false,
    is_deleted = true,
    effective_end_date = DATE '2025-05-14',
    retirement_reason = 'Department restructured into Executive Office',
    last_updated_timestamp = CURRENT_TIMESTAMP
WHERE code_combination_id = 1016;

-- Current active departments (for reporting)
SELECT department_description, fund_description, is_active
FROM cos_gold.dim_coa
WHERE is_active = true;
-- City Manager NOT in this list

-- Historical query (all departments including retired)
SELECT department_description, is_active, retirement_reason, effective_end_date
FROM cos_gold.dim_coa
ORDER BY is_active DESC, department_description;


-- ═════════════════════════════════════════════════════════════════════════════
-- SCENARIO F: BUDGET ROLLBACK (Undo Incorrect Deactivation)
-- ═════════════════════════════════════════════════════════════════════════════
-- TALKING POINT: "Oops — Grainger's deactivation was a mistake. The contract
-- was actually renewed. We can reactivate without losing the audit trail."

-- Reactivate Grainger (undo the logical delete)
UPDATE cos_gold.dim_supplier
SET is_active = true,
    is_deleted = false,
    supplier_status = 'Active',
    effective_end_date = DATE '9999-12-31',
    deactivation_reason = 'REACTIVATED: Contract renewed 2025-05-14',
    last_updated_timestamp = CURRENT_TIMESTAMP
WHERE supplier_name = 'Grainger Industrial';

-- VERIFY: Supplier is back
SELECT supplier_name, supplier_status, is_active, deactivation_reason
FROM cos_gold.dim_supplier
WHERE supplier_name = 'Grainger Industrial';
-- Result: is_active = true, reason shows full history of deactivation + reactivation


-- ═════════════════════════════════════════════════════════════════════════════
-- SCENARIO G: HISTORICAL AUDIT REPORT
-- ═════════════════════════════════════════════════════════════════════════════
-- TALKING POINT: "Generate a compliance report showing all supplier status
-- changes. The snapshot history IS the audit trail."

-- Full audit trail via snapshots
SELECT * FROM cos_gold."dim_supplier$snapshots"
ORDER BY committed_at DESC;

-- Each snapshot represents a state change:
-- Snapshot 1: All suppliers active (initial load)
-- Snapshot 2: Grainger deactivated
-- Snapshot 3: Grainger reactivated
-- Auditors can query ANY of these states using FOR TIMESTAMP AS OF


-- ═════════════════════════════════════════════════════════════════════════════
-- VALIDATION: PROVE NOTHING WAS LOST
-- ═════════════════════════════════════════════════════════════════════════════

-- Count all records (active + inactive)
SELECT
    'dim_supplier' AS table_name,
    COUNT(*) AS total_records,
    SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) AS active,
    SUM(CASE WHEN is_active = false THEN 1 ELSE 0 END) AS inactive
FROM cos_gold.dim_supplier
UNION ALL
SELECT
    'dim_coa',
    COUNT(*),
    SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END),
    SUM(CASE WHEN is_active = false THEN 1 ELSE 0 END)
FROM cos_gold.dim_coa;

-- Fact table still joins with ALL dimension records (active and inactive)
-- Historical reports work because we never deleted anything
SELECT
    dc.department_description,
    dc.is_active AS dept_active,
    ROUND(SUM(f.budget_amount)/1e6, 1) AS budget_M
FROM cos_gold.fact_budgetary_control f
JOIN cos_gold.dim_coa dc ON dc.coa_key = f.coa_key
GROUP BY dc.department_description, dc.is_active
ORDER BY budget_M DESC;
