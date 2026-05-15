# Master Dataset → PVO → Snowflake → Dim/Fact Mapping

> Complete mapping of all 44 datasets from the Executive Financial Dashboard requirement sheet.
> Each row traces: Dataset → System of Record → Oracle PVO → Snowflake Raw Table → Target Dimension or Fact

---

## Oracle Fusion Datasets (BICC Extracts)

| # | Dataset Name | Fusion Module | PVO / Extract Data Store | Data Store Key | Snowflake Raw Table | Target Dim/Fact | Executive Decision |
|---|---|---|---|---|---|---|---|
| 1 | Budget Balances | GL | BudgetBalanceExtractPVO | `FscmTopModelAM.FinExtractAM.BudgetBalanceExtractPVO` | `RAW.FUSION_BUDGET_BALANCE_EXTRACT` | **fct_budget_snapshot** | Defines legal authority to spend |
| 2 | Budget Adjustments | GL / BC | BudgetDistHeaderExtractPVO + BudgetDistAcctExtractPVO | `FscmTopModelAM.FinExtractAM.XccBiccExtractAM.BudgetDistHeaderExtractPVO` | `RAW.FUSION_BUDGET_DIST_HEADER_EXTRACT` + `RAW.FUSION_BUDGET_DIST_ACCT_EXTRACT` | **fct_budget_snapshot** | Explains why budgets moved |
| 3 | Budgetary Control Balances | GL / BC | BalanceExtractPVO | `FscmTopModelAM.FinExtractAM.XccBiccExtractAM.BalanceExtractPVO` | `RAW.FUSION_BC_BALANCE_EXTRACT` | **fct_budget_snapshot** | Establishes "true available budget" |
| 4 | GL Actuals (Non-Payroll) | GL | JournalHeaderExtractPVO + JournalLineExtractPVO | `FscmTopModelAM.FinExtractAM.JournalHeaderExtractPVO` | `RAW.FUSION_GL_JOURNAL_HEADERS_EXTRACT` + `RAW.FUSION_GL_JOURNAL_LINES_EXTRACT` | **fct_gl_transaction** | Identifies real spend drivers |
| 5 | GL Balances (Actual) | GL | GLBalancesExtractPVO | `FscmTopModelAM.FinExtractAM.GLBalancesExtractPVO` | `RAW.FUSION_GL_BALANCES_EXTRACT` | **fct_budget_snapshot** | Validates dashboard totals against ledger |
| 6 | Purchase Orders | Procurement | PurchaseOrderHeaderExtractPVO + LineExtractPVO + DistributionExtractPVO | Confirm in BICC console | `RAW.FUSION_PO_HEADERS_EXTRACT` + `_LINES_` + `_DISTRIBUTIONS_` | **fct_procurement_lifecycle** | Identifies cancellable commitments |
| 7 | Receiving | Procurement | ReceiptHeaderExtractPVO + ReceiptTransactionExtractPVO | Confirm in BICC console | `RAW.FUSION_RECEIPT_HEADERS_EXTRACT` + `_TRANSACTIONS_` | **fct_procurement_lifecycle** | Distinguishes sunk vs avoidable spend |
| 8 | AP Invoices | Financials | InvoiceHeaderExtractPVO + LineExtractPVO + DistributionExtractPVO | Confirm in BICC console | `RAW.FUSION_AP_INVOICE_HEADERS_EXTRACT` + `_LINES_` + `_DISTRIBUTIONS_` | **fct_procurement_lifecycle** | Shows near-term budget pressure |
| 9 | AP Invoice Payments | Financials | PaymentExtractPVO | Confirm in BICC console | `RAW.FUSION_AP_PAYMENTS_EXTRACT` | **fct_procurement_lifecycle** | Identifies true cash outflow timing |
| 10 | Encumbrance Accounting Entries | GL / BC | JournalHeaderExtractPVO + JournalLineExtractPVO (ActualFlag='E') | Same as #4 (filtered) | Same as #4 (filtered) | **fct_gl_transaction** (encumbrance rows) | Distinguishes commitment vs obligation vs expenditure |
| 11 | Project Financials | PPM | ProjectExtractPVO (confirm in BICC) | Confirm in BICC console | `RAW.FUSION_PROJECT_EXTRACT` | **dim_project** + **fct_budget_snapshot** | Enables delay/stop capital decisions |
| 12 | Grant Awards | Grants | GrantAwardExtractPVO | Confirm in BICC console | `RAW.FUSION_GRANT_AWARDS_EXTRACT` | **dim_grant** | Prevents cutting restricted external funding |
| 13 | Grant Award Funding Sources | Grants | GrantFundingSourceExtractPVO | Confirm in BICC console | `RAW.FUSION_GRANT_FUNDING_SOURCES_EXTRACT` | **dim_grant** (extended) | Supports restrictions, match requirements |
| 14 | Grant Financials | Grants + GL/BC | Derived from GL/BC filtered by grant segment | N/A (derived) | N/A (derived from fct_gl_transaction + fct_budget_snapshot) | **fct_budget_snapshot** + **fct_gl_transaction** (filtered) | Identifies must-spend or at-risk funds |
| 15 | Chart of Accounts – Segment Values | GL | ChartOfAccountsSegmentValueExtractPVO | Confirm in BICC console | `RAW.FUSION_COA_SEGMENT_VALUES_EXTRACT` | **dim_fund**, **dim_department**, **dim_account**, **dim_program** | Ensures consistent rollups |
| 16 | Chart of Accounts – Code Combinations | GL | CodeCombinationExtractPVO | `FscmTopModelAM.FinExtractAM.CodeCombinationExtractPVO` | `RAW.FUSION_CODE_COMBINATIONS_EXTRACT` | **dim_code_combination** | Provides authoritative accounting key |
| 17 | Vendor / Supplier Dimension | Procurement | SupplierExtractPVO + SupplierSiteExtractPVO | Confirm in BICC console | `RAW.FUSION_SUPPLIERS_EXTRACT` + `_SITES_` | **dim_vendor** | Supports vendor concentration analysis |
| 18 | Commitment / Contract Agreements | Procurement | PurchaseOrderHeaderExtractPVO (DocumentType=BLANKET/CONTRACT) | Same as #6 (filtered) | Same as #6 (filtered) | **fct_procurement_lifecycle** (extended) | Identifies long-term obligations |
| 19 | Agreement Terms & Price Breaks | Procurement | PurchaseOrderLineExtractPVO (agreement lines) | Same as #6 (filtered) | Same as #6 (filtered) | **fct_procurement_lifecycle** (extended) | Identifies renegotiation windows |
| 20 | Capital Plan & Asset Commitments | PPM / Assets | ProjectExtractPVO (capital projects) | Confirm in BICC console | `RAW.FUSION_CAPITAL_PLAN_EXTRACT` | **dim_project** + **fct_budget_snapshot** | Shows multi-year non-labor pressure |

---

## Amorphic Datasets (HR / Payroll / Curated)

| # | Dataset Name | Source System | Amorphic Table | Target Dim/Fact | Executive Decision |
|---|---|---|---|---|---|
| 21 | Position Dimension | HR/Payroll → Amorphic | `AMORPHIC.POSITION_DIM` | **dim_position** | Defines where labor savings can exist |
| 22 | Employee Dimension | HR/Payroll → Amorphic | `AMORPHIC.EMPLOYEE_DIM` | **dim_employee** | Supports headcount trend, attrition assumptions |
| 23 | Job / Classification Dimension | HR → Amorphic | `AMORPHIC.JOB_DIM` | **dim_position** (enrichment) | Enables credible labor cost projections |
| 24 | Payroll Actuals | Payroll → Amorphic | `AMORPHIC.PAYROLL_ACTUALS` | **fct_labor_transaction** | Reconciles labor spend |
| 25 | Payroll Earnings Detail | Payroll → Amorphic | `AMORPHIC.PAYROLL_EARNINGS` | **fct_labor_transaction** | Separates controllable labor drivers |
| 26 | Payroll Benefits & Employer Costs | Payroll/Benefits → Amorphic | `AMORPHIC.PAYROLL_BENEFITS` | **fct_labor_transaction** | Prevents underestimating total compensation |
| 27 | Payroll Forecast | Amorphic (Derived) | `AMORPHIC.PAYROLL_FORECAST` | **fct_labor_transaction** (forecast) | Enables hiring freeze & cut scenarios |
| 28 | Payroll Posting / Finance Interface | Payroll-to-GL → Amorphic | `AMORPHIC.PAYROLL_GL_POSTING` | **fct_gl_transaction** (reconciliation) | Enables payroll-to-GL reconciliation |
| 29 | Position Funding Distribution | HR/Payroll → Amorphic | `AMORPHIC.POSITION_FUNDING` | **bridge_position_funding** | Ties PBB to financial structure |
| 30 | Position Plan (Auth vs Filled) | HR/Payroll → Amorphic | `AMORPHIC.POSITION_PLAN` | **dim_position** (extended) | Core PBB control table |
| 31 | Org Hierarchy | HR Metadata → Amorphic | `AMORPHIC.ORG_HIERARCHY` | **dim_department** (enrichment) | Enables exec-level rollups |
| 32 | Account Rollups | Finance Metadata → Amorphic | `AMORPHIC.ACCOUNT_ROLLUPS` | **dim_account** (enrichment) | Prevents unrealistic cuts |
| 33 | Program / Service Map | Business Mapping → Amorphic | `AMORPHIC.PROGRAM_SERVICE_MAP` | **dim_program** (enrichment) | Makes decisions defensible |
| 34 | Reconciliation Controls | Amorphic (Derived) | `AMORPHIC.RECONCILIATION_CONTROLS` | (validation layer) | Establishes trust in numbers |
| 35 | Timekeeping / Leave Usage | Time & Attendance → Amorphic | `AMORPHIC.TIMEKEEPING` | **fct_labor_transaction** (optional) | Improves OT forecasting |
| 36 | Recruiting / Vacancy Pipeline | Recruiting/HR → Amorphic | `AMORPHIC.RECRUITING_PIPELINE` | (optional) | Makes vacancy-savings timing-realistic |

---

## Scenario & Forecast Datasets (Amorphic Derived)

| # | Dataset Name | Source System | Amorphic Table | Target Dim/Fact | Executive Decision |
|---|---|---|---|---|---|
| 37 | Scenario Run Header | Scenario Modeling → Amorphic | `AMORPHIC.SCENARIO_HEADER` | **dim_scenario** | Enables repeatable what-if runs |
| 38 | Scenario Actions (Lines) | Scenario Modeling → Amorphic | `AMORPHIC.SCENARIO_ACTIONS` | **fct_scenario_action** | Connects decisions to forecast deltas |
| 39 | Labor Assumptions | Scenario Input → Amorphic | `AMORPHIC.LABOR_ASSUMPTIONS` | **fct_scenario_action** (inputs) | Enables 5-year stress-test scenarios |
| 40 | Non-Labor Assumptions | Scenario Input → Amorphic | `AMORPHIC.NONLABOR_ASSUMPTIONS` | **fct_scenario_action** (inputs) | Enables non-labor stress-test scenarios |
| 41 | Recurring Spend Baseline | GL+AP+PO → Amorphic | `AMORPHIC.RECURRING_SPEND_BASELINE` | (derived/reference) | Creates defensible 'do-nothing' baseline |
| 42 | Non-Labor Forecast (Baseline) | Baseline Model → Amorphic | `AMORPHIC.NONLABOR_FORECAST` | (derived/reference) | Shows where costs drift without policy changes |
| 43 | Discretionary Reduction Levers | Policy/Finance → Amorphic | `AMORPHIC.REDUCTION_LEVERS` | **dim_account** (enrichment) | Prevents cuts violating operational minimums |

---

## External Datasets

| # | Dataset Name | Source System | Amorphic Table | Target Dim/Fact | Executive Decision |
|---|---|---|---|---|---|
| 44 | Inflation / CPI Index Series | BLS/FRED → Amorphic | `AMORPHIC.CPI_INDEX` | (reference) | Provides auditable inflation drivers |
| 45 | Account Inflation Mapping | Finance Metadata → Amorphic | `AMORPHIC.ACCOUNT_INFLATION_MAP` | **dim_account** (enrichment) | Keeps forecasts structurally realistic |
