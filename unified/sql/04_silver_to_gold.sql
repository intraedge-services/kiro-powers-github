-- ═══════════════════════════════════════════════════════════════════════
-- COS UNIFIED LAKEHOUSE — SILVER → GOLD (Star Schema)
-- Database: cos_gold
-- ═══════════════════════════════════════════════════════════════════════

-- dim_coa: Chart of Accounts (9 departments)
INSERT INTO cos_gold.dim_coa VALUES
(1,1001,'100','General Fund','4100','Police','5100','Salaries & Wages','E','Y',true,CURRENT_TIMESTAMP),
(2,1002,'100','General Fund','4100','Police','5200','Professional Services','E','Y',true,CURRENT_TIMESTAMP),
(3,1003,'100','General Fund','4200','Fire','5100','Salaries & Wages','E','Y',true,CURRENT_TIMESTAMP),
(4,1004,'100','General Fund','4200','Fire','5200','Professional Services','E','Y',true,CURRENT_TIMESTAMP),
(5,1005,'100','General Fund','4300','Public Works','5100','Salaries & Wages','E','Y',true,CURRENT_TIMESTAMP),
(6,1007,'100','General Fund','4400','Parks & Rec','5100','Salaries & Wages','E','Y',true,CURRENT_TIMESTAMP),
(7,1009,'100','General Fund','4500','Community Dev','5100','Salaries & Wages','E','Y',true,CURRENT_TIMESTAMP),
(8,1011,'200','Water Fund','4600','Water Resources','5100','Salaries & Wages','E','Y',true,CURRENT_TIMESTAMP),
(9,1013,'300','Wastewater Fund','4700','Transportation','5100','Salaries & Wages','E','Y',true,CURRENT_TIMESTAMP),
(10,1014,'400','Transit Fund','4800','Library','5100','Salaries & Wages','E','Y',true,CURRENT_TIMESTAMP),
(11,1015,'500','Airport Fund','4900','Information Tech','5600','Technology Services','E','Y',true,CURRENT_TIMESTAMP),
(12,1016,'100','General Fund','5000','City Manager','5100','Salaries & Wages','E','Y',true,CURRENT_TIMESTAMP);

-- dim_period: FY2025 (12 months)
INSERT INTO cos_gold.dim_period VALUES
(1,'JUL-2024',2025,1,1,2024,7,'July',DATE '2024-07-01',DATE '2024-07-31',false,CURRENT_TIMESTAMP),
(2,'AUG-2024',2025,1,2,2024,8,'August',DATE '2024-08-01',DATE '2024-08-31',false,CURRENT_TIMESTAMP),
(3,'SEP-2024',2025,1,3,2024,9,'September',DATE '2024-09-01',DATE '2024-09-30',false,CURRENT_TIMESTAMP),
(4,'OCT-2024',2025,2,4,2024,10,'October',DATE '2024-10-01',DATE '2024-10-31',false,CURRENT_TIMESTAMP),
(5,'NOV-2024',2025,2,5,2024,11,'November',DATE '2024-11-01',DATE '2024-11-30',false,CURRENT_TIMESTAMP),
(6,'DEC-2024',2025,2,6,2024,12,'December',DATE '2024-12-01',DATE '2024-12-31',false,CURRENT_TIMESTAMP),
(7,'JAN-2025',2025,3,7,2025,1,'January',DATE '2025-01-01',DATE '2025-01-31',false,CURRENT_TIMESTAMP),
(8,'FEB-2025',2025,3,8,2025,2,'February',DATE '2025-02-01',DATE '2025-02-28',false,CURRENT_TIMESTAMP),
(9,'MAR-2025',2025,3,9,2025,3,'March',DATE '2025-03-01',DATE '2025-03-31',false,CURRENT_TIMESTAMP),
(10,'APR-2025',2025,4,10,2025,4,'April',DATE '2025-04-01',DATE '2025-04-30',true,CURRENT_TIMESTAMP),
(11,'MAY-2025',2025,4,11,2025,5,'May',DATE '2025-05-01',DATE '2025-05-31',false,CURRENT_TIMESTAMP),
(12,'JUN-2025',2025,4,12,2025,6,'June',DATE '2025-06-01',DATE '2025-06-30',false,CURRENT_TIMESTAMP);

-- dim_supplier
INSERT INTO cos_gold.dim_supplier VALUES
(1,2001,'APS Energy','Active','Net 30','Utilities',true,CURRENT_TIMESTAMP),
(2,2002,'Salt River Project','Active','Net 30','Utilities',true,CURRENT_TIMESTAMP),
(3,2003,'Grainger Industrial','Active','Net 45','Materials',true,CURRENT_TIMESTAMP),
(4,2004,'Home Depot Pro','Active','Net 30','Materials',true,CURRENT_TIMESTAMP),
(5,2005,'CDW Government','Active','Net 45','Technology',true,CURRENT_TIMESTAMP);

-- fact_budgetary_control: Join Silver with dimensions
INSERT INTO cos_gold.fact_budgetary_control
SELECT
    ROW_NUMBER() OVER (ORDER BY s.code_combination_id, s.period_name) AS bc_key,
    dc.coa_key,
    dp.period_key,
    s.code_combination_id,
    s.budget_amount,
    s.actual_amount,
    s.encumbrance_amount,
    s.commitment_amount,
    s.obligation_amount,
    s.expenditure_amount,
    s.funds_available,
    s.fiscal_year,
    CURRENT_TIMESTAMP AS dw_load_date
FROM cos_silver.budget_control_clean s
JOIN cos_gold.dim_coa dc
    ON dc.code_combination_id = s.code_combination_id
    AND dc.is_current = true
JOIN cos_gold.dim_period dp
    ON dp.period_name = s.period_name;

-- VERIFY
SELECT COUNT(*) AS fact_rows FROM cos_gold.fact_budgetary_control;
SELECT COUNT(*) AS dim_coa_rows FROM cos_gold.dim_coa;
SELECT COUNT(*) AS dim_period_rows FROM cos_gold.dim_period;
