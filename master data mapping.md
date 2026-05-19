# Master Dataset → PVO → Snowflake → Dim/Fact Mapping

> Complete mapping of all 44 datasets from the Executive Financial Dashboard requirement sheet.
> Each row traces: Dataset → System of Record → Oracle PVO → Snowflake Raw Table → Target Dimension or Fact

---

## Executive Decision Breakdown (1–28)

> For each decision: what data is required, what the user/executive intends to achieve, and a concrete example of the expected output.

| # | Decision | What Is Required | User Intent / Business Question | Example Output |
|---|----------|-----------------|--------------------------------|----------------|
| 1 | Defines legal authority to spend | Budget balance records per period × COA from `BudgetBalanceExtractPVO` | "What is our legally adopted budget for each department/fund this fiscal year?" | HR Dept (4200), FY2024: Original Budget = $2.1M, Current Budget = $2.3M (after $200K amendment) |
| 2 | Explains why budgets moved | Budget distribution headers + account lines showing amendment amounts | "Why did the Parks budget increase by $150K in Q2?" | Amendment #BA-2024-012: +$150K transferred from General Reserve to Parks (Fund 201, Acct 62100) for emergency tree removal |
| 3 | Establishes "true available budget" | Budgetary Control balances: budget, commitments, obligations, expenditures, funds available | "How much can I actually still spend in this account?" | Account 51100-HR: Budget=$500K, Committed=$45K (open POs), Obligated=$12K (invoiced), Spent=$320K → Available=$123K |
| 4 | Identifies real spend drivers | GL journal lines with source='non-Payroll', actual flag='A', by account/department | "What are the top 5 non-payroll expense categories driving overspend?" | Top drivers: Consulting Services $890K (+22% vs budget), Utilities $450K (+15%), Fleet Maintenance $320K (+8%) |
| 5 | Validates dashboard totals against ledger | GL period balances (begin balance + period net) to cross-check fact table totals | "Do our dashboard numbers match the official ledger?" | Dashboard YTD Expense: $12,450,000 vs GL Balance YTD: $12,450,000 ✓ (variance = $0) |
| 6 | Identifies cancellable commitments | Open POs where nothing has been received yet (ordered > 0, received = 0) | "Which purchase orders can we cancel to free up budget immediately?" | PO-2024-0445: Office furniture $28K (not received, not invoiced) — cancellable. PO-2024-0312: IT equipment $95K (partially received) — not cancellable |
| 7 | Distinguishes sunk vs avoidable spend | Receipt transactions showing which PO lines have been physically received | "Of our $2M in open commitments, how much is already received (sunk) vs still avoidable?" | Total open POs: $2.1M. Received (sunk): $1.4M. Not yet received (avoidable): $700K |
| 8 | Shows near-term budget pressure | AP invoices pending payment with due dates, hold reasons | "What invoices are coming due in the next 30 days that will hit our budget?" | Next 30 days: 47 invoices totaling $890K. On hold: 3 invoices ($45K) — reason: price variance. Net pressure: $845K |
| 9 | Identifies true cash outflow timing | Payment records with check dates and cleared status | "When did cash actually leave the bank vs when was the expense recorded?" | Invoice INV-44821 ($2,500): Expense recorded Feb 10, Payment issued Feb 25, Check cleared Mar 1 |
| 10 | Distinguishes commitment vs obligation vs expenditure | Encumbrance journal entries with type classification (Commitment/Obligation/Expenditure) | "Break down our $5M encumbrance into what's committed, obligated, and spent" | Fund 101: Commitments (open POs) $1.2M, Obligations (invoiced) $800K, Expenditures (paid) $3.0M |
| 11 | Enables delay/stop capital decisions | Project records with status, budget, timeline, and associated spend | "Which capital projects can we pause to free up $500K?" | Project CIP-2024-08 (City Hall HVAC): Budget $1.2M, Spent $300K, Status=Active. Pausable savings: $900K. Project CIP-2024-03 (Road Resurfacing): 80% complete — not pausable |
| 12 | Prevents cutting restricted external funding | Grant award records with restriction status, end dates, remaining balance | "Which budget lines are grant-funded and cannot be cut?" | Grant G50 (HHS Workforce): $500K award, $200K remaining, restricted=YES, ends Jun 2025. Cannot reduce — must spend or return |
| 13 | Supports restrictions, match requirements | Grant funding source details showing match obligations | "Do any of our grants require matching funds we haven't budgeted?" | Grant G50 requires 25% local match. Award=$500K → Match required=$125K. Currently budgeted match=$100K. Gap=$25K |
| 14 | Identifies must-spend or at-risk funds | GL/BC data filtered by grant segment + grant end dates | "Which grants expire in 6 months with unspent balances?" | Grant G50: Expires Jun 2025, Remaining=$200K, Days left=180. At risk of clawback if not spent by deadline |
| 15 | Ensures consistent rollups | COA segment value hierarchies (parent-child relationships) | "When I roll up to 'Public Safety', which departments are included?" | Public Safety (Level 2) includes: Police (4100), Fire (4110), Emergency Mgmt (4120), Animal Control (4130). Total budget: $45M |
| 16 | Provides authoritative accounting key | Code combination records mapping CCID → 6 segments | "What does CCID 78432 decode to?" | CCID 78432 = Fund:101 (General) + Dept:4200 (HR) + Acct:51100 (Salaries) + Prog:300 (Workforce) + Proj:P001 + Grant:G50 |
| 17 | Supports vendor concentration analysis | Supplier master data with diversity flags, location, payment terms | "Are we over-concentrated with any single vendor? What % is local/minority?" | Top vendor: Acme Corp = 12% of total spend ($1.8M). Local vendors: 34% of spend. Minority-owned: 8% (target: 15%) |
| 18 | Identifies long-term obligations | Blanket POs and contract agreements with total amounts and expiry | "What multi-year contracts lock us into future spend?" | Contract BPA-2022-001 (Janitorial): $300K/year × 3 years remaining = $900K committed. Earliest exit: Jul 2025 with 90-day notice |
| 19 | Defines where labor savings can exist | Position records with FTE authorization, vacancy status, OT eligibility | "How many positions are vacant and what's the salary savings if we freeze them?" | 12 vacant positions across 4 departments. Total authorized salary: $890K. If frozen: $890K annual savings |
| 20 | Reconciles labor spend | Payroll actuals by employee × earning code × pay period | "Does our payroll GL posting match actual payroll records?" | GL Payroll Expense (Jan): $4,200,000. Payroll System Total (Jan): $4,200,000. Variance: $0 ✓ |
| 21 | Enables hiring freeze and cut scenarios | Scenario action records modeling freeze/cut impacts | "If we freeze all hiring for 6 months, what's the projected savings?" | Scenario 'Hiring Freeze': 12 open positions × avg $74K × 6 months = $444K savings. Impact: 3 departments lose capacity |
| 22 | Enables exec-level rollups | Org hierarchy with 4 levels mapping departments to executives | "Show me total spend rolled up to each executive's portfolio" | CFO Portfolio: Finance ($2.1M) + IT ($3.4M) + Procurement ($1.2M) = $6.7M total. COO Portfolio: Public Works ($8.9M) + Parks ($2.3M) = $11.2M |
| 23 | Prevents unrealistic cuts | Account classification with cuttability flags and floor percentages | "Which accounts can realistically be cut, and by how much?" | Account 51100 (Salaries): Cuttable=YES, Max cut=15%, Floor=60% of budget. Account 54200 (Debt Service): Cuttable=NO (contractual obligation) |
| 24 | Makes decisions defensible | Program-to-service mapping with mandate status and strategic priority | "If we cut Program 300, what services are affected and are any mandated?" | Program 300 (Workforce Dev): Service=Job Training, Priority=High, Mandated=NO. Can be reduced but impacts strategic goal #3 |
| 25 | Establishes trust in numbers | Reconciliation control checks (payroll-to-GL, encumbrance integrity) | "Can I trust these numbers for a council presentation?" | Reconciliation status: Payroll-GL ✓ ($0 variance), Encumbrance check ✓ (all POs balanced), BC-GL ✓ (funds available matches) |
| 26 | Enables repeatable what-if runs | Scenario header records with parameters, owner, approval status | "Which scenarios have been approved and what assumptions do they use?" | Scenario 'FY2025 5% Reduction': Owner=CFO, Baseline FY=2024, Inflation=3.2%, Status=Draft. Scenario 'Hiring Freeze': Status=Approved |
| 27 | Connects executive decisions to forecast deltas | Scenario action lines with baseline, action amount, and rationale | "Show me the line-by-line impact of the 5% reduction scenario" | Line 1: HR Salaries, Baseline=$500K, Action=-$75K (freeze 2 positions), Forecast=$425K. Line 2: IT Consulting, Baseline=$200K, Action=-$40K (cancel contract), Forecast=$160K |
| 28 | Provides auditable inflation drivers | CPI/inflation index series with year-over-year changes | "What inflation rate should we apply to utilities for FY2025 forecasting?" | CPI-U Energy (Dec 2024): Index=312.4, YoY=+4.8%. Applied to Account 53100 (Utilities): FY2024 actual $450K × 1.048 = FY2025 forecast $471K |

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
