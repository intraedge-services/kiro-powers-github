# COS Executive Financial Dashboard — Complete Documentation
## City of Scottsdale | Oracle Fusion 25D → AWS → Power BI

![Dashboard Preview](dashboard_preview.png)

---

## 📌 Project Summary

| Item | Detail |
|---|---|
| Client | City of Scottsdale (COS) |
| Source System | Oracle Fusion Cloud 25D |
| Extraction Method | BICC (BI Cloud Connector) — PVO-based |
| Cloud Platform | AWS (S3, Glue, Redshift) |
| Reporting Tool | Microsoft Power BI |
| Budget Authority | $2.1 Billion |
| Domains | GL, AP, PO, Grants, Projects |

---

## 1. ARCHITECTURE — Bronze / Silver / Gold (Medallion + Iceberg)

```
┌────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│  ORACLE FUSION 25D ──▶ BICC (PVO) ──▶ AWS S3                          │
│                                                                         │
│       ┌──────────┐      ┌──────────┐      ┌──────────┐                │
│       │  BRONZE  │ ───▶ │  SILVER  │ ───▶ │   GOLD   │                │
│       │  (Raw)   │      │ (Clean)  │      │  (Star)  │                │
│       └──────────┘      └──────────┘      └──────────┘                │
│                                                   │                     │
│                                                   ▼                     │
│                                          ┌──────────────┐              │
│                                          │   POWER BI   │              │
│                                          └──────────────┘              │
└────────────────────────────────────────────────────────────────────────┘
```

| Layer | Purpose | Strategy | Format |
|---|---|---|---|
| Bronze | Raw BICC extracts, append-only, no transformation | Full history preserved | Iceberg (Parquet) |
| Silver | Cleaned, deduplicated, standardized | SCD Type 1 (Merge/Upsert on LastUpdateDate) | Iceberg (Parquet) |
| Gold | Kimball Star Schema — final consumption layer | Fact + Dimension tables, optimized for Power BI | Iceberg (Parquet) |

---

## 2. STAR SCHEMA DESIGN

```
                              ┌─────────────┐
                              │ dim_period   │
                              │─────────────│
                              │ period_key   │
                              │ period_name  │
                              │ fiscal_month │
                              │ fiscal_year  │
                              └──────┬──────┘
                                     │
  ┌─────────────┐            ┌──────┴───────┐            ┌─────────────┐
  │dim_supplier │            │              │            │  dim_coa    │
  │─────────────│◀───────────│  FACT TABLES │───────────▶│─────────────│
  │ vendor_id   │            │              │            │ ccid        │
  │ supplier_nm │            │              │            │ fund        │
  │ status      │            └──────┬───────┘            │ department  │
  └─────────────┘                   │                    │ account     │
                                    │                    └─────────────┘
  ┌─────────────┐                   │
  │ dim_project │◀──────────────────┘
  │─────────────│
  │ project_id  │
  │ project_nm  │
  └─────────────┘
```

---

## 3. TABLE DEFINITIONS — DIMENSIONS

### dim_coa (Chart of Accounts) — UNIVERSAL JOIN KEY

| Column | Data Type | Key | Description |
|---|---|---|---|
| coa_key | BIGINT | PK | Surrogate key |
| code_combination_id | BIGINT | NK | Oracle CCID — joins to ALL fact tables |
| fund | VARCHAR(30) | | Fund code (100, 200, etc.) |
| fund_description | VARCHAR(100) | | "General Fund", "Water Fund" |
| department | VARCHAR(30) | | Department code |
| department_description | VARCHAR(100) | | "Police", "Fire", "Public Works" |
| account | VARCHAR(30) | | Natural account code |
| account_description | VARCHAR(100) | | "Salaries", "Professional Services" |
| project | VARCHAR(30) | | Project code |
| program_grant | VARCHAR(30) | | Grant/program code |
| account_type | VARCHAR(1) | | A/L/E/R |
| enabled_flag | VARCHAR(1) | | Y/N |
| is_current | BOOLEAN | | SCD Type 2 flag |

**SCD Strategy:** Type 2 (tracks historical changes to descriptions)

---

### dim_period (Fiscal Calendar)

| Column | Data Type | Key | Description |
|---|---|---|---|
| period_key | BIGINT | PK | Surrogate key |
| period_name | VARCHAR(30) | NK | "JUL-2024", "AUG-2024" |
| fiscal_year | INTEGER | | 2025 (COS fiscal: Jul-Jun) |
| fiscal_quarter | INTEGER | | Q1=Jul-Sep, Q2=Oct-Dec, Q3=Jan-Mar, Q4=Apr-Jun |
| fiscal_month | INTEGER | | 1-12 starting July |
| calendar_month_name | VARCHAR(20) | | "July", "August" |
| period_start_date | DATE | | First day of period |
| period_end_date | DATE | | Last day of period |

**SCD Strategy:** Type 1 (periods don't change)

---

### dim_supplier

| Column | Data Type | Key | Description |
|---|---|---|---|
| supplier_key | BIGINT | PK | Surrogate key |
| vendor_id | BIGINT | NK | Oracle VendorId |
| supplier_name | VARCHAR(240) | | "APS Energy", "Grainger" |
| supplier_status | VARCHAR(30) | | Active / Inactive |
| payment_terms | VARCHAR(50) | | Net 30, Net 60 |
| commodity_category | VARCHAR(100) | | Utilities, Materials, Technology |
| is_current | BOOLEAN | | SCD Type 2 flag |

**SCD Strategy:** Type 2 (tracks status and payment term changes)

---

## 4. TABLE DEFINITIONS — FACTS

### fact_budgetary_control (PRIMARY FACT)

| Column | Data Type | Key | Description |
|---|---|---|---|
| bc_key | BIGINT | PK | Surrogate key |
| coa_key | BIGINT | FK → dim_coa | Chart of Accounts |
| period_key | BIGINT | FK → dim_period | Fiscal period |
| code_combination_id | BIGINT | DD | Original CCID |
| budget_amount | DECIMAL(18,2) | Measure | Approved budget |
| actual_amount | DECIMAL(18,2) | Measure | Actual expenditures |
| encumbrance_amount | DECIMAL(18,2) | Measure | Total encumbrances |
| commitment_amount | DECIMAL(18,2) | Measure | PO commitments |
| obligation_amount | DECIMAL(18,2) | Measure | Invoice obligations |
| expenditure_amount | DECIMAL(18,2) | Measure | Payments made |
| funds_available | DECIMAL(18,2) | Measure | Budget - All consumption |

**Grain:** One row per Code Combination per Period

---

### fact_gl_actuals

| Column | Data Type | Key | Description |
|---|---|---|---|
| gl_key | BIGINT | PK | Surrogate key |
| coa_key | BIGINT | FK → dim_coa | Chart of Accounts |
| period_key | BIGINT | FK → dim_period | Fiscal period |
| supplier_key | BIGINT | FK → dim_supplier | Vendor (if applicable) |
| acctd_amount | DECIMAL(18,2) | Measure | Functional currency amount |
| journal_source | VARCHAR(50) | DD | Payables / Purchasing / Manual |
| journal_category | VARCHAR(50) | DD | Accrual / Standard / Payroll |

**Grain:** One row per GL Journal Line (Posted only)

---

### fact_ap_invoices

| Column | Data Type | Key | Description |
|---|---|---|---|
| ap_key | BIGINT | PK | Surrogate key |
| coa_key | BIGINT | FK → dim_coa | Chart of Accounts |
| period_key | BIGINT | FK → dim_period | Fiscal period |
| supplier_key | BIGINT | FK → dim_supplier | Vendor |
| invoice_id | BIGINT | DD | Oracle InvoiceId |
| invoice_number | VARCHAR(50) | DD | Business invoice number |
| invoice_amount | DECIMAL(18,2) | Measure | Total invoice amount |
| amount_paid | DECIMAL(18,2) | Measure | Paid to date |
| payment_status_flag | VARCHAR(1) | DD | Y/N/P |
| po_header_id | BIGINT | DD | Linked PO |

**Grain:** One row per Invoice Distribution

---

### fact_purchase_orders

| Column | Data Type | Key | Description |
|---|---|---|---|
| po_key | BIGINT | PK | Surrogate key |
| coa_key | BIGINT | FK → dim_coa | Chart of Accounts |
| period_key | BIGINT | FK → dim_period | Fiscal period |
| supplier_key | BIGINT | FK → dim_supplier | Vendor |
| po_header_id | BIGINT | DD | Oracle PoHeaderId |
| po_number | VARCHAR(30) | DD | Business PO number |
| total_amount | DECIMAL(18,2) | Measure | Total PO value |
| amount_received | DECIMAL(18,2) | Measure | Received (sunk cost) |
| amount_billed | DECIMAL(18,2) | Measure | Invoiced |
| amount_remaining | DECIMAL(18,2) | Measure | Cancellable commitment |
| closed_code | VARCHAR(30) | DD | OPEN/CLOSED |

**Grain:** One row per PO Distribution

---

## 5. JOIN LOGIC

| From | Join Column | To | Purpose |
|---|---|---|---|
| All Facts | coa_key | dim_coa | Fund / Department / Account breakdown |
| All Facts | period_key | dim_period | Time-based analysis |
| fact_ap_invoices | supplier_key | dim_supplier | Vendor spend |
| fact_purchase_orders | supplier_key | dim_supplier | Vendor commitments |
| fact_ap_invoices | po_header_id | fact_purchase_orders | PO-to-Invoice match |

**Universal Key:** `CodeCombinationId` connects every financial transaction to the Chart of Accounts.

---

## 6. SCD STRATEGY

| Table | SCD Type | Reason |
|---|---|---|
| dim_coa | Type 2 | Department names change; combinations get disabled; historical reports need point-in-time accuracy |
| dim_supplier | Type 2 | Status changes (Active→Inactive); payment terms renegotiated |
| dim_period | Type 1 | Periods never change |
| dim_project | Type 1 | Only current state needed |
| All Facts | Type 1 | Overwrite with latest values |

**Iceberg Time-Travel:** Enables comparing budget at any two points in time without SCD complexity on facts.

---

## 7. SAMPLE DATASETS USED IN DASHBOARD

### dim_coa (16 rows)

| code_combination_id | fund | fund_description | department | department_description | account | account_description |
|---|---|---|---|---|---|---|
| 1001 | 100 | General Fund | 4100 | Police | 5100 | Salaries & Wages |
| 1002 | 100 | General Fund | 4100 | Police | 5200 | Professional Services |
| 1003 | 100 | General Fund | 4200 | Fire | 5100 | Salaries & Wages |
| 1004 | 100 | General Fund | 4200 | Fire | 5200 | Professional Services |
| 1005 | 100 | General Fund | 4300 | Public Works | 5100 | Salaries & Wages |
| 1006 | 100 | General Fund | 4300 | Public Works | 5300 | Materials & Supplies |
| 1007 | 100 | General Fund | 4400 | Parks & Rec | 5100 | Salaries & Wages |
| 1008 | 100 | General Fund | 4400 | Parks & Rec | 5400 | Contracted Services |
| 1009 | 100 | General Fund | 4500 | Community Dev | 5100 | Salaries & Wages |
| 1010 | 100 | General Fund | 4500 | Community Dev | 5200 | Professional Services |
| 1011 | 200 | Water Fund | 4600 | Water Resources | 5100 | Salaries & Wages |
| 1012 | 200 | Water Fund | 4600 | Water Resources | 5500 | Utilities |
| 1013 | 300 | Wastewater Fund | 4700 | Transportation | 5100 | Salaries & Wages |
| 1014 | 400 | Transit Fund | 4800 | Library | 5100 | Salaries & Wages |
| 1015 | 500 | Airport Fund | 4900 | Information Tech | 5600 | Technology Services |
| 1016 | 100 | General Fund | 5000 | City Manager | 5100 | Salaries & Wages |

### dim_period (12 rows — FY2025: Jul 2024 – Jun 2025)

| period_name | fiscal_year | fiscal_quarter | fiscal_month | calendar_month_name |
|---|---|---|---|---|
| JUL-2024 | 2025 | Q1 | 1 | July |
| AUG-2024 | 2025 | Q1 | 2 | August |
| SEP-2024 | 2025 | Q1 | 3 | September |
| OCT-2024 | 2025 | Q2 | 4 | October |
| NOV-2024 | 2025 | Q2 | 5 | November |
| DEC-2024 | 2025 | Q2 | 6 | December |
| JAN-2025 | 2025 | Q3 | 7 | January |
| FEB-2025 | 2025 | Q3 | 8 | February |
| MAR-2025 | 2025 | Q3 | 9 | March |
| APR-2025 | 2025 | Q4 | 10 | April |
| MAY-2025 | 2025 | Q4 | 11 | May |
| JUN-2025 | 2025 | Q4 | 12 | June |

### dim_supplier (10 rows)

| vendor_id | supplier_name | supplier_status | payment_terms | commodity_category |
|---|---|---|---|---|
| 2001 | APS Energy | Active | Net 30 | Utilities |
| 2002 | Salt River Project | Active | Net 30 | Utilities |
| 2003 | Grainger Industrial | Active | Net 45 | Materials & Supplies |
| 2004 | Home Depot Pro | Active | Net 30 | Materials & Supplies |
| 2005 | Fisher Scientific | Active | Net 60 | Lab Equipment |
| 2006 | W.W. Grainger | Active | Net 45 | Facilities |
| 2007 | United Rentals | Active | Net 30 | Equipment Rental |
| 2008 | Amazon Business | Active | Net 30 | Office Supplies |
| 2009 | Lowes Pro | Active | Net 30 | Building Materials |
| 2010 | CDW Government | Active | Net 45 | Technology |

---

## 8. KPIs & METRICS

### Dashboard KPI Cards

| KPI | Value (Sample) | Formula | Color Logic |
|---|---|---|---|
| 💰 Total Budget | $1.23B | SUM(budget_amount) | Dark Blue #1F3A5F |
| 📊 Total Actual | $842.7M | SUM(actual_amount) | Teal #2CA58D |
| ✅ Available Budget | $263.6M | Budget - Actual - Encumbrance | Green if > 20% of budget, Orange if 10-20%, Red if < 10% |
| 📈 Variance | $387.3M | Budget - Actual | Green if positive, Red if negative |

### Additional Metrics

| Metric | Formula | Purpose |
|---|---|---|
| Budget Burn Rate | (Actual + Encumbrance) / Budget × 100 | Shows % of budget consumed |
| Encumbrance Rate | Encumbrance / Budget × 100 | Outstanding commitments as % of budget |
| YTD Spend | Cumulative actual through current period | Year-to-date tracking |
| Dept Status | 🟢 <70%, 🟡 70-85%, 🔴 >85% burn rate | Traffic light indicator |
| Supplier Concentration | Top 5 supplier spend / Total spend | Vendor risk metric |

---

## 9. DAX MEASURES (Power BI)

```dax
// ═══════════════════════════════════════════
// CORE MEASURES
// ═══════════════════════════════════════════

Total Budget = 
    SUM(fact_budgetary_control[budget_amount])

Total Actual = 
    SUM(fact_budgetary_control[actual_amount])

Total Encumbrance = 
    SUM(fact_budgetary_control[encumbrance_amount])

Available Budget = 
    [Total Budget] - [Total Actual] - [Total Encumbrance]

Variance = 
    [Total Budget] - [Total Actual]

Variance % = 
    DIVIDE([Variance], [Total Budget], 0)

Budget Burn Rate = 
    DIVIDE(
        [Total Actual] + [Total Encumbrance],
        [Total Budget],
        0
    )

// ═══════════════════════════════════════════
// DISPLAY MEASURES (Formatted)
// ═══════════════════════════════════════════

Total Budget Display = 
    VAR val = [Total Budget]
    RETURN
        IF(val >= 1000000000, FORMAT(val/1000000000, "$#,##0.00") & "B",
        IF(val >= 1000000, FORMAT(val/1000000, "$#,##0.0") & "M",
        FORMAT(val, "$#,##0")))

Total Actual Display = 
    VAR val = [Total Actual]
    RETURN
        IF(val >= 1000000000, FORMAT(val/1000000000, "$#,##0.00") & "B",
        IF(val >= 1000000, FORMAT(val/1000000, "$#,##0.0") & "M",
        FORMAT(val, "$#,##0")))

Available Budget Display = 
    VAR val = [Available Budget]
    RETURN
        IF(val >= 1000000000, FORMAT(val/1000000000, "$#,##0.00") & "B",
        IF(val >= 1000000, FORMAT(val/1000000, "$#,##0.0") & "M",
        FORMAT(val, "$#,##0")))

// ═══════════════════════════════════════════
// CONDITIONAL FORMATTING
// ═══════════════════════════════════════════

Variance Color = 
    IF([Variance] >= 0, "#2CA58D", "#E76F51")

Dept Status = 
    VAR BurnRate = [Budget Burn Rate]
    RETURN
        SWITCH(TRUE(),
            BurnRate >= 0.85, "🔴 Critical",
            BurnRate >= 0.70, "🟡 Warning",
            "🟢 On Track"
        )

Dept Status Color = 
    VAR BurnRate = [Budget Burn Rate]
    RETURN
        SWITCH(TRUE(),
            BurnRate >= 0.85, "#E76F51",
            BurnRate >= 0.70, "#F4A261",
            "#2CA58D"
        )

// ═══════════════════════════════════════════
// ENCUMBRANCE MEASURES
// ═══════════════════════════════════════════

Total Commitments = 
    SUM(fact_budgetary_control[commitment_amount])

Total Obligations = 
    SUM(fact_budgetary_control[obligation_amount])

Total Expenditures = 
    SUM(fact_budgetary_control[expenditure_amount])

// ═══════════════════════════════════════════
// SUPPLIER MEASURES
// ═══════════════════════════════════════════

Spend by Supplier = 
    CALCULATE(
        SUM(fact_gl_actuals[acctd_amount]),
        ALLEXCEPT(dim_supplier, dim_supplier[supplier_name])
    )

Supplier % of Total = 
    DIVIDE(
        [Spend by Supplier],
        CALCULATE(SUM(fact_gl_actuals[acctd_amount]), ALL(dim_supplier)),
        0
    )
```

---

## 10. DASHBOARD THEME

```json
{
  "Primary Color": "#1F3A5F (Dark Blue)",
  "Secondary Color": "#2CA58D (Teal)",
  "Accent Color": "#F4A261 (Orange)",
  "Alert Color": "#E76F51 (Red-Orange)",
  "Background": "#F5F7FA (Light Gray)",
  "Card Background": "#FFFFFF (White)",
  "Text": "#333333 (Dark Gray)",
  "Border Radius": "10px (Rounded cards)"
}
```

---

## 11. DASHBOARD PAGES & VISUALS

### PAGE 1: EXECUTIVE SUMMARY

```
┌─────────────────────────────────────────────────────────────────────┐
│  FILTERS (Left Sidebar)                                              │
│  ┌─────┐  ┌──────────────────────────────────────────────────────┐  │
│  │Year │  │  💰 $1.23B  │  📊 $842.7M  │  ✅ $263.6M  │  📈 $387M │  │
│  │Fund │  │  BUDGET     │  ACTUAL      │  AVAILABLE   │  VARIANCE│  │
│  │Dept │  └──────────────────────────────────────────────────────┘  │
│  │Acct │                                                             │
│  │Supp │  ┌────────────────┐ ┌──────────────┐ ┌────────────────┐  │
│  └─────┘  │ Line Chart:    │ │ Bar Chart:   │ │ Donut Chart:   │  │
│           │ Budget vs      │ │ Top 10 Depts │ │ Supplier       │  │
│           │ Actual Trend   │ │ by Spend     │ │ Distribution   │  │
│           └────────────────┘ └──────────────┘ └────────────────┘  │
│                                                                      │
│           ┌──────────────────────────────────────────────────────┐  │
│           │ Matrix Table: Fund × Dept × Budget × Actual × Avail  │  │
│           └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

| Visual | Type | X-Axis / Rows | Y-Axis / Values | Colors |
|---|---|---|---|---|
| KPI Card 1 | Card | — | Total Budget Display | #1F3A5F |
| KPI Card 2 | Card | — | Total Actual Display | #2CA58D |
| KPI Card 3 | Card | — | Available Budget Display | #F4A261 |
| KPI Card 4 | Card | — | Variance | Conditional (green/red) |
| Trend Chart | Line | period_name (sorted by fiscal_month) | budget_amount, actual_amount | Blue line, Teal line |
| Dept Chart | Horizontal Bar | department_description (Top 10) | actual_amount | #1F3A5F |
| Supplier Chart | Donut | supplier_name | acctd_amount | Multi-color palette |
| Matrix | Matrix | fund_description → department_description | budget, actual, available, variance% | Conditional on variance |

---

### PAGE 2: BUDGET VS ACTUAL

| Visual | Type | Config |
|---|---|---|
| Variance KPI | Card | Variance % with conditional color |
| Trend Line | Line Chart | Budget vs Actual by Period |
| Breakdown Table | Table | Dept, Budget, Actual, Variance, Variance% |

---

### PAGE 3: ENCUMBRANCE ANALYSIS

| Visual | Type | Config |
|---|---|---|
| Encumbrance KPI | Card | Total Encumbrance amount |
| Available KPI | Card | Available Budget |
| Stacked Bar | Stacked Bar | Budget + Actual + Encumbrance by Department |
| Trend Line | Line Chart | Encumbrance over time (monthly) |

---

### PAGE 4: SUPPLIER ANALYSIS

| Visual | Type | Config |
|---|---|---|
| Top Suppliers | Horizontal Bar | Top 10 suppliers by total spend |
| Distribution | Donut | Supplier % of total spend |
| Detail Table | Table | Supplier, Invoice Amount, Payment Terms, Status |

---

### PAGE 5: DRILLDOWN (Drill-through)

| Visual | Type | Config |
|---|---|---|
| Header | Text | Selected Department name |
| Account Spend | Bar Chart | Spend by Account within department |
| Detail Table | Table | Account, Budget, Actual, Encumbrance, Available |
| Project/Grant | Table | Project breakdown (if applicable) |

---

## 12. FILTERS / SLICERS

| Slicer | Source Column | Position | Type |
|---|---|---|---|
| Fiscal Year | dim_period.fiscal_year | Left sidebar | Dropdown |
| Period | dim_period.period_name | Left sidebar | Dropdown |
| Fund | dim_coa.fund_description | Left sidebar | Dropdown |
| Department | dim_coa.department_description | Left sidebar | Dropdown |
| Account | dim_coa.account_description | Left sidebar | Dropdown |
| Supplier | dim_supplier.supplier_name | Left sidebar | Searchable dropdown |
| Project/Grant | dim_coa.program_grant | Left sidebar | Dropdown |

---

## 13. POWER BI RELATIONSHIPS (Model View)

```
dim_coa ──────────────(1:Many)──────────────▶ fact_budgetary_control
dim_coa ──────────────(1:Many)──────────────▶ fact_gl_actuals
dim_coa ──────────────(1:Many)──────────────▶ fact_ap_invoices
dim_coa ──────────────(1:Many)──────────────▶ fact_purchase_orders

dim_period ───────────(1:Many)──────────────▶ fact_budgetary_control
dim_period ───────────(1:Many)──────────────▶ fact_gl_actuals
dim_period ───────────(1:Many)──────────────▶ fact_ap_invoices

dim_supplier ─────────(1:Many)──────────────▶ fact_gl_actuals
dim_supplier ─────────(1:Many)──────────────▶ fact_ap_invoices
dim_supplier ─────────(1:Many)──────────────▶ fact_purchase_orders
```

**Join Keys:**
- `code_combination_id` → connects Facts to dim_coa
- `period_name` → connects Facts to dim_period
- `vendor_id` → connects Facts to dim_supplier
- `po_header_id` → connects fact_ap_invoices to fact_purchase_orders

---

## 14. SQL DDL — Gold Layer (CREATE TABLE)

```sql
CREATE TABLE gold.dim_coa (
    coa_key                 BIGINT PRIMARY KEY,
    code_combination_id     BIGINT NOT NULL,
    fund                    VARCHAR(30),
    fund_description        VARCHAR(100),
    department              VARCHAR(30),
    department_description  VARCHAR(100),
    account                 VARCHAR(30),
    account_description     VARCHAR(100),
    project                 VARCHAR(30),
    program_grant           VARCHAR(30),
    account_type            VARCHAR(1),
    enabled_flag            VARCHAR(1),
    effective_start_date    DATE DEFAULT CURRENT_DATE,
    effective_end_date      DATE DEFAULT '9999-12-31',
    is_current              BOOLEAN DEFAULT TRUE,
    dw_load_date            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE gold.dim_period (
    period_key              BIGINT PRIMARY KEY,
    period_name             VARCHAR(30) NOT NULL,
    fiscal_year             INTEGER NOT NULL,
    fiscal_quarter          INTEGER NOT NULL,
    fiscal_month            INTEGER NOT NULL,
    calendar_year           INTEGER,
    calendar_month          INTEGER,
    calendar_month_name     VARCHAR(20),
    period_start_date       DATE,
    period_end_date         DATE,
    is_current_period       BOOLEAN DEFAULT FALSE,
    dw_load_date            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE gold.dim_supplier (
    supplier_key            BIGINT PRIMARY KEY,
    vendor_id               BIGINT NOT NULL,
    supplier_name           VARCHAR(240),
    supplier_number         VARCHAR(30),
    supplier_status         VARCHAR(30),
    payment_terms           VARCHAR(50),
    commodity_category      VARCHAR(100),
    effective_start_date    DATE DEFAULT CURRENT_DATE,
    effective_end_date      DATE DEFAULT '9999-12-31',
    is_current              BOOLEAN DEFAULT TRUE,
    dw_load_date            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE gold.fact_budgetary_control (
    bc_key                  BIGINT PRIMARY KEY,
    coa_key                 BIGINT REFERENCES gold.dim_coa(coa_key),
    period_key              BIGINT REFERENCES gold.dim_period(period_key),
    code_combination_id     BIGINT,
    budget_amount           DECIMAL(18,2),
    actual_amount           DECIMAL(18,2),
    encumbrance_amount      DECIMAL(18,2),
    commitment_amount       DECIMAL(18,2),
    obligation_amount       DECIMAL(18,2),
    expenditure_amount      DECIMAL(18,2),
    funds_available         DECIMAL(18,2),
    dw_load_date            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE gold.fact_gl_actuals (
    gl_key                  BIGINT PRIMARY KEY,
    coa_key                 BIGINT REFERENCES gold.dim_coa(coa_key),
    period_key              BIGINT REFERENCES gold.dim_period(period_key),
    supplier_key            BIGINT REFERENCES gold.dim_supplier(supplier_key),
    code_combination_id     BIGINT,
    acctd_amount            DECIMAL(18,2),
    journal_source          VARCHAR(50),
    journal_category        VARCHAR(50),
    dw_load_date            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE gold.fact_ap_invoices (
    ap_key                  BIGINT PRIMARY KEY,
    coa_key                 BIGINT REFERENCES gold.dim_coa(coa_key),
    period_key              BIGINT REFERENCES gold.dim_period(period_key),
    supplier_key            BIGINT REFERENCES gold.dim_supplier(supplier_key),
    invoice_id              BIGINT,
    invoice_number          VARCHAR(50),
    invoice_amount          DECIMAL(18,2),
    amount_paid             DECIMAL(18,2),
    payment_status_flag     VARCHAR(1),
    po_header_id            BIGINT,
    dw_load_date            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE gold.fact_purchase_orders (
    po_key                  BIGINT PRIMARY KEY,
    coa_key                 BIGINT REFERENCES gold.dim_coa(coa_key),
    period_key              BIGINT REFERENCES gold.dim_period(period_key),
    supplier_key            BIGINT REFERENCES gold.dim_supplier(supplier_key),
    po_header_id            BIGINT,
    po_number               VARCHAR(30),
    total_amount            DECIMAL(18,2),
    amount_received         DECIMAL(18,2),
    amount_billed           DECIMAL(18,2),
    amount_remaining        DECIMAL(18,2),
    closed_code             VARCHAR(30),
    dw_load_date            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 15. SAMPLE TRANSFORMATION SQL (Silver → Gold)

```sql
-- Load fact_budgetary_control from Silver
INSERT INTO gold.fact_budgetary_control
SELECT
    ROW_NUMBER() OVER() AS bc_key,
    dc.coa_key,
    dp.period_key,
    s.code_combination_id,
    s.budget_amount,
    s.actual_amount,
    s.encumbrance_amount,
    s.commitment_amount,
    s.obligation_amount,
    s.expenditure_amount,
    s.budget_amount - s.actual_amount - s.encumbrance_amount AS funds_available,
    CURRENT_TIMESTAMP
FROM silver.budgetary_control_balances s
JOIN gold.dim_coa dc ON dc.code_combination_id = s.code_combination_id AND dc.is_current = TRUE
JOIN gold.dim_period dp ON dp.period_name = s.period_name
WHERE s.last_update_date > (SELECT COALESCE(MAX(dw_load_date), '1900-01-01') FROM gold.fact_budgetary_control);
```

---

## 16. HOW TO BUILD IN POWER BI

1. **Import Theme:** View → Themes → Browse → Select `COS_Theme.json`
2. **Import Data:** Get Data → CSV → Import all 5 sample CSV files
3. **Create Relationships:** Model View → Drag join columns between tables
4. **Create Measures:** New Table → `Measures = {BLANK()}` → Add all DAX formulas
5. **Build Page 1:** Add KPI cards, line chart, bar chart, donut, matrix
6. **Build Pages 2-5:** Follow visual specs above
7. **Add Slicers:** Place on left sidebar, connect to dimension columns
8. **Apply Conditional Formatting:** Right-click values → Conditional formatting → Rules
9. **Publish:** File → Publish → Select workspace

---

> **Oracle 26A Workaround:** Always verify PVO names in Classic UI (append `?beSkin=CASDefault` to Fusion URL) before building BICC extraction jobs.
