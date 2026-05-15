# Sample Data Flow Lineage — Fact → Bridge → Dimension

> Concrete examples showing how each fact table connects through `dim_code_combination` (bridge) to segment dimensions, with sample data at every hop.

---

## 1. fct_gl_transaction — GL Journal Posting

### Scenario
Monthly payroll journal posts $5,000 salary expense for HR department, funded by a federal grant.

### Source (Oracle Fusion GL)
```
Journal Header: "Monthly Payroll - Jan 2024"
Journal Line #3: Debit $5,000 to CCID 78432
Source: Payroll | Category: Labor | Actual Flag: A
```

### Fact Table

```
fct_gl_transaction
┌──────────────────────┬─────────────────────────────────────────┐
│ gl_transaction_sk    │ 99001                                   │
│ journal_header_id    │ 50421 (DD)                              │
│ journal_line_number  │ 3 (DD)                                  │
│ journal_name         │ Monthly Payroll - Jan 2024              │
│ posted_date_sk       │ 20240115  ──→ dim_date                  │
│ coa_sk               │ 5001      ──→ dim_code_combination      │
│ fund_code            │ 101       (denormalized from bridge)    │
│ department_code      │ 4200      (denormalized from bridge)    │
│ account_code         │ 51100     (denormalized from bridge)    │
│ entered_debit        │ 5000.00                                 │
│ entered_credit       │ 0.00                                    │
│ accounted_debit      │ 5000.00                                 │
│ accounted_credit     │ 0.00                                    │
│ net_amount           │ 5000.00   (debit - credit)              │
│ journal_source       │ Payroll                                 │
│ journal_category     │ Labor                                   │
│ actual_flag          │ A (Actual)                              │
│ is_payroll           │ true                                    │
│ is_encumbrance       │ false                                   │
└──────────────────────┴─────────────────────────────────────────┘
```

### Bridge (dim_code_combination)

```
dim_code_combination (coa_sk = 5001)
┌──────────────────────┬─────────────────────────────────────────┐
│ coa_sk               │ 5001                                    │
│ coa_nk               │ 78432 (Oracle CCID)                     │
│ fund_sk              │ 12      ──→ dim_fund                    │
│ department_sk        │ 45      ──→ dim_department              │
│ account_sk           │ 203     ──→ dim_account                 │
│ program_sk           │ 8       ──→ dim_program                 │
│ project_sk           │ 31      ──→ dim_project                 │
│ grant_sk             │ 5       ──→ dim_grant                   │
│ fund_code            │ 101                                     │
│ department_code      │ 4200                                    │
│ account_code         │ 51100                                   │
│ program_code         │ 300                                     │
│ project_code         │ P001                                    │
│ grant_code           │ G50                                     │
│ full_coa_string      │ 101-4200-51100-300-P001-G50             │
│ full_coa_description │ General Fund-HR-Reg Salaries-Workforce  │
│ is_enabled           │ true                                    │
└──────────────────────┴─────────────────────────────────────────┘
```

### Resolved Dimensions

```
dim_fund (fund_sk = 12)                    dim_department (department_sk = 45)
┌──────────────────────────────────┐       ┌──────────────────────────────────────┐
│ fund_nk: 101                     │       │ department_nk: 4200                  │
│ fund_description: General Fund   │       │ department_description: Human Res.   │
│ fund_type: General Revenue       │       │ level_1_code: 1000 (Corporate)       │
│ fund_group: Governmental         │       │ level_2_code: 4000 (People & Culture)│
│ is_restricted: false             │       │ level_3_code: 4200 (HR Operations)   │
│ is_grant_funded: true            │       │ executive_owner: Jane Smith           │
└──────────────────────────────────┘       │ division_name: People & Culture      │
                                           │ service_area: Internal Services      │
                                           └──────────────────────────────────────┘

dim_account (account_sk = 203)             dim_grant (grant_sk = 5)
┌──────────────────────────────────┐       ┌──────────────────────────────────────┐
│ account_nk: 51100                │       │ grant_nk: G50                        │
│ account_description: Reg Salary  │       │ grant_name: HHS Workforce Dev        │
│ account_type: Expense            │       │ sponsor_name: US HHS                 │
│ account_class: Personnel         │       │ total_award_amount: 500,000          │
│ account_category: Salaries       │       │ award_start_date: 2023-07-01         │
│ is_labor: true                   │       │ award_end_date: 2025-06-30           │
│ is_discretionary: false          │       │ is_match_required: true              │
│ inflation_index_type: CPI-W      │       │ match_percentage: 25                 │
└──────────────────────────────────┘       └──────────────────────────────────────┘
```

### Data Flow Diagram

```
Oracle Fusion GL                    Data Warehouse
─────────────────                   ──────────────────────────────────────────────

JournalHeaderPVO ─┐                              ┌── dim_fund (General Fund)
                  │                              │
JournalLinePVO ───┼──→ fct_gl_transaction ──→ dim_code_combination ──┼── dim_department (HR)
                  │       (coa_sk=5001)         (bridge)             │
CodeCombPVO ──────┘                                                  ├── dim_account (Salaries)
                                                                     │
                                                                     ├── dim_program (Workforce)
                                                                     │
                                                                     ├── dim_project (P001)
                                                                     │
                                                                     └── dim_grant (HHS)
```

---

## 2. fct_budget_snapshot — Period Budget Balance

### Scenario
February 2024 budget snapshot for the same COA shows $50K budget with $12K spent.

### Source (Oracle Fusion Budgetary Control)
```
Budget: "FY2024 Adopted"
Period: FEB-24
CCID: 78432
Budget Balance: $50,000
Actuals YTD: $12,000
```

### Fact Table

```
fct_budget_snapshot
┌──────────────────────┬─────────────────────────────────────────┐
│ budget_snapshot_sk   │ 44201                                   │
│ period_end_date_sk   │ 20240229  ──→ dim_date                  │
│ coa_sk               │ 5001      ──→ dim_code_combination      │
│ fund_code            │ 101       (denormalized)                │
│ department_code      │ 4200      (denormalized)                │
│ account_code         │ 51100     (denormalized)                │
│ fiscal_period_name   │ FEB-24                                  │
│ original_budget      │ 50000.00                                │
│ current_budget       │ 52000.00  (original + amendments)       │
│ budget_amendments    │ 2000.00                                 │
│ budget_version       │ FY2024 Adopted                          │
│ bc_budget            │ 52000.00                                │
│ bc_commitments       │ 3000.00   (open POs)                    │
│ bc_obligations       │ 1500.00   (invoiced not paid)           │
│ bc_expenditures      │ 12000.00  (actual spend)                │
│ bc_funds_consumed    │ 16500.00  (commit+oblig+actual)         │
│ bc_funds_available   │ 35500.00  (budget - consumed)           │
│ bc_has_violation     │ false                                   │
│ gl_period_net        │ 5000.00   (this period actuals)         │
│ gl_ytd_balance       │ 12000.00  (cumulative)                  │
│ pct_budget_spent     │ 23.08     (12000/52000 × 100)           │
│ remaining_spendable  │ 35500.00                                │
└──────────────────────┴─────────────────────────────────────────┘
```

### Bridge Resolution (same CCID → same bridge row)

```
fct_budget_snapshot.coa_sk = 5001
  └──→ dim_code_combination (same row as GL example above)
         └──→ dim_fund: General Fund
         └──→ dim_department: HR
         └──→ dim_account: Regular Salaries
         └──→ dim_program: Workforce (300)
         └──→ dim_project: P001
         └──→ dim_grant: HHS Workforce Dev
```

### Data Flow Diagram

```
Oracle Fusion BC                    Data Warehouse
────────────────                    ──────────────────────────────────────────────

BudgetBalancePVO ──┐
                   │                             ┌── dim_fund
BalanceExtractPVO ─┼──→ fct_budget_snapshot ──→ dim_code_combination ──┼── dim_department
                   │       (coa_sk=5001)        (same bridge row)      ├── dim_account
GLBalancesPVO ─────┘                                                   ├── dim_program
                                                                       ├── dim_project
BudgetDistAcctPVO ─── (amendments)                                     └── dim_grant
```

---

## 3. fct_procurement_lifecycle — PO Distribution

### Scenario
Purchase order for office supplies, $2,500, charged to Admin department's operating budget.

### Source (Oracle Fusion Procurement)
```
PO #: PO-2024-0892
Vendor: Office Depot (Vendor ID: 3301)
Distribution Line: $2,500 to CCID 81205
Approved: 2024-02-01
```

### Fact Table

```
fct_procurement_lifecycle
┌──────────────────────┬─────────────────────────────────────────┐
│ procurement_sk       │ 67501                                   │
│ po_number            │ PO-2024-0892 (DD)                       │
│ invoice_number       │ INV-44821 (DD)                          │
│ payment_number       │ CHK-99012 (DD)                          │
│ po_date_sk           │ 20240201  ──→ dim_date                  │
│ receipt_date_sk      │ 20240208  ──→ dim_date (role-playing)   │
│ invoice_date_sk      │ 20240210  ──→ dim_date (role-playing)   │
│ payment_date_sk      │ 20240225  ──→ dim_date (role-playing)   │
│ coa_sk               │ 6020      ──→ dim_code_combination      │
│ vendor_sk            │ 88        ──→ dim_vendor                │
│ project_sk           │ -1        (no project)                  │
│ ordered_amount       │ 2500.00                                 │
│ received_amount      │ 2500.00                                 │
│ invoiced_amount      │ 2500.00                                 │
│ paid_amount          │ 2500.00                                 │
│ remaining_commitment │ 0.00      (fully paid)                  │
│ remaining_obligation │ 0.00                                    │
│ total_encumbrance    │ 2500.00                                 │
│ days_po_to_receipt   │ 7                                       │
│ days_po_to_close     │ 24                                      │
│ lifecycle_status     │ CLOSED                                  │
└──────────────────────┴─────────────────────────────────────────┘
```

### Bridge (different CCID than GL example)

```
dim_code_combination (coa_sk = 6020)
┌──────────────────────┬─────────────────────────────────────────┐
│ coa_sk               │ 6020                                    │
│ coa_nk               │ 81205 (Oracle CCID)                     │
│ fund_sk              │ 12      ──→ dim_fund (General Fund)     │
│ department_sk        │ 52      ──→ dim_department (Admin)      │
│ account_sk           │ 310     ──→ dim_account (Supplies)      │
│ program_sk           │ 2       ──→ dim_program (Gen Admin)     │
│ project_sk           │ -1      (no project)                    │
│ grant_sk             │ -1      (no grant)                      │
│ full_coa_string      │ 101-5100-62100-100-NONE-NONE            │
└──────────────────────┴─────────────────────────────────────────┘
```

### Additional Dimension (direct FK, not through bridge)

```
dim_vendor (vendor_sk = 88)
┌──────────────────────────────────────┐
│ vendor_nk: 3301                      │
│ vendor_name: Office Depot            │
│ vendor_type: Supplier                │
│ vendor_status: Active                │
│ payment_terms: Net 30                │
│ is_minority_owned: false             │
│ is_woman_owned: false                │
│ is_local_vendor: true                │
│ is_small_business: false             │
│ city: Orlando                        │
│ state: FL                            │
└──────────────────────────────────────┘
```

### Data Flow Diagram

```
Oracle Fusion Procurement           Data Warehouse
─────────────────────────           ──────────────────────────────────────────────

POHeaderPVO ──────────┐
PODistributionPVO ────┤                                    ┌── dim_fund
ReceiptTxnPVO ────────┼──→ fct_procurement_lifecycle ──→ dim_code_combination ──┼── dim_department
InvoiceHeaderPVO ─────┤       │    (coa_sk=6020)          (bridge)              ├── dim_account
InvoiceDistPVO ───────┤       │                                                 └── dim_program
PaymentPVO ───────────┘       │
                              ├──→ dim_vendor (Office Depot) [direct FK]
                              └──→ dim_date ×4 (PO, receipt, invoice, payment)
```

---

## 4. fct_labor_transaction — Payroll Earning

### Scenario
Employee John Doe worked 80 regular hours + 8 overtime hours in the Jan 15 pay period.

### Source (Amorphic HR/Payroll)
```
Employee: EMP-2045 (John Doe)
Position: POS-1122 (Senior Analyst)
Department: 4200 (HR)
Pay Period End: 2024-01-15
Earning: REG (80 hrs) + OT (8 hrs)
```

### Fact Table (2 rows — one per earning code)

```
fct_labor_transaction (Regular Pay)
┌──────────────────────┬─────────────────────────────────────────┐
│ labor_transaction_sk │ 120001                                  │
│ pay_period_end_date_sk│ 20240115 ──→ dim_date                  │
│ employee_sk          │ 2045     ──→ dim_employee               │
│ position_sk          │ 1122     ──→ dim_position               │
│ department_sk        │ 45       ──→ dim_department              │
│ earning_code         │ REG                                     │
│ earning_category     │ Base Pay                                │
│ hours_worked         │ 80.0                                    │
│ overtime_hours       │ 0.0                                     │
│ gross_amount         │ 3846.15  (80 × $48.08/hr)              │
│ regular_pay          │ 3846.15                                 │
│ overtime_pay         │ 0.00                                    │
│ employer_benefits    │ 1153.85  (30% of gross)                 │
│ employer_taxes       │ 294.23   (7.65% FICA)                   │
│ total_employer_cost  │ 5294.23  (gross + benefits + taxes)     │
│ is_overtime          │ false                                   │
└──────────────────────┴─────────────────────────────────────────┘

fct_labor_transaction (Overtime)
┌──────────────────────┬─────────────────────────────────────────┐
│ labor_transaction_sk │ 120002                                  │
│ pay_period_end_date_sk│ 20240115 ──→ dim_date                  │
│ employee_sk          │ 2045     ──→ dim_employee               │
│ position_sk          │ 1122     ──→ dim_position               │
│ department_sk        │ 45       ──→ dim_department              │
│ earning_code         │ OT                                      │
│ earning_category     │ Overtime                                │
│ hours_worked         │ 8.0                                     │
│ overtime_hours       │ 8.0                                     │
│ gross_amount         │ 576.92   (8 × $72.12/hr)               │
│ regular_pay          │ 0.00                                    │
│ overtime_pay         │ 576.92                                  │
│ employer_benefits    │ 173.08                                  │
│ employer_taxes       │ 44.13                                   │
│ total_employer_cost  │ 794.13                                  │
│ is_overtime          │ true                                    │
└──────────────────────┴─────────────────────────────────────────┘
```

### Resolved Dimensions (direct FKs — no bridge needed for labor)

```
dim_employee (employee_sk = 2045)          dim_position (position_sk = 1122)
┌──────────────────────────────────┐       ┌──────────────────────────────────┐
│ employee_nk: EMP-2045            │       │ position_nk: POS-1122            │
│ full_name: John Doe              │       │ position_title: Senior Analyst   │
│ employee_status: Active          │       │ job_code: JC-440                 │
│ hire_date: 2019-03-15            │       │ job_title: Business Analyst III  │
│ tenure_years: 4.8                │       │ grade: 12                        │
│ position_sk: 1122 ──→ dim_pos    │       │ step: 5                          │
│ department_sk: 45 ──→ dim_dept   │       │ pay_type: Salary                 │
└──────────────────────────────────┘       │ flsa_status: Exempt              │
                                           │ is_overtime_eligible: true        │
dim_department (department_sk = 45)        │ authorized_fte: 1.0              │
┌──────────────────────────────────┐       │ department_sk: 45 ──→ dim_dept   │
│ department_nk: 4200              │       └──────────────────────────────────┘
│ department_description: HR       │
│ division_name: People & Culture  │
│ executive_owner: Jane Smith      │
└──────────────────────────────────┘
```

### Data Flow Diagram

```
Amorphic HR/Payroll                 Data Warehouse
───────────────────                 ──────────────────────────────────────────────

PAYROLL_ACTUALS ───┐
                   │                ┌──→ dim_date (pay period end)
PAYROLL_EARNINGS ──┼──→ fct_labor_transaction ──┼──→ dim_employee (John Doe)
                   │                            ├──→ dim_position (Sr Analyst)
PAYROLL_BENEFITS ──┘                            └──→ dim_department (HR)

Note: Labor facts connect DIRECTLY to dimensions (no bridge needed)
      because payroll doesn't use Oracle's CCID structure.
```

---

## 5. fct_scenario_action — Budget Scenario Modeling

### Scenario
CFO creates a "5% Reduction" scenario that freezes hiring in HR, saving $75K.

### Source (Amorphic Scenario Planning)
```
Scenario: "FY2025 5% Reduction"
Action: Freeze all open positions in HR
Target: LABOR
Baseline: $500K | Savings: -$75K | Forecast: $425K
```

### Fact Table

```
fct_scenario_action
┌──────────────────────┬─────────────────────────────────────────┐
│ scenario_action_sk   │ 8801                                    │
│ scenario_sk          │ 3        ──→ dim_scenario               │
│ department_sk        │ 45       ──→ dim_department              │
│ account_sk           │ 203      ──→ dim_account                │
│ position_sk          │ 1122     ──→ dim_position               │
│ action_type          │ FreezeHire                              │
│ target_type          │ LABOR                                   │
│ fiscal_year          │ 2025                                    │
│ baseline_amount      │ 500000.00                               │
│ action_amount        │ -75000.00 (negative = savings)          │
│ forecast_amount      │ 425000.00 (baseline + action)           │
│ cumulative_savings   │ -75000.00                               │
│ is_constrained       │ true      (can't cut below floor)       │
│ rationale            │ Freeze 2 open positions in HR           │
└──────────────────────┴─────────────────────────────────────────┘
```

### Resolved Dimensions (direct FKs)

```
dim_scenario (scenario_sk = 3)             dim_account (account_sk = 203)
┌──────────────────────────────────┐       ┌──────────────────────────────────┐
│ scenario_nk: SCN-003             │       │ account_nk: 51100                │
│ scenario_name: FY2025 5% Reduc.  │       │ account_description: Reg Salary  │
│ scenario_type: Pessimistic       │       │ account_class: Personnel         │
│ owner: CFO Office                │       │ is_labor: true                   │
│ baseline_fiscal_year: 2024       │       │ is_cuttable: true                │
│ default_inflation_pct: 3.2       │       │ minimum_spend_floor_pct: 60      │
│ is_approved: false               │       │ maximum_cut_pct: 15              │
│ is_baseline: false               │       └──────────────────────────────────┘
└──────────────────────────────────┘
```

### Data Flow Diagram

```
Amorphic Scenario Planning          Data Warehouse
──────────────────────────          ──────────────────────────────────────────────

SCENARIO_HEADER ──→ dim_scenario

SCENARIO_ACTIONS ──→ fct_scenario_action ──┬──→ dim_scenario (5% Reduction)
                                           ├──→ dim_department (HR)
                                           ├──→ dim_account (Reg Salaries)
                                           └──→ dim_position (Sr Analyst)

Note: Scenario facts also use DIRECT dimension FKs (no bridge).
      They model "what-if" against specific departments/accounts/positions.
```

---

## Summary: Bridge vs Direct FK Pattern

| Fact Table | Uses Bridge? | Why |
|---|---|---|
| **fct_gl_transaction** | ✅ Yes (via coa_sk) | Source is Oracle GL which uses CCID for all 6 segments |
| **fct_budget_snapshot** | ✅ Yes (via coa_sk) | Budget balances are tracked per CCID |
| **fct_procurement_lifecycle** | ✅ Yes (via coa_sk) + direct FKs | PO distributions charge to CCID; vendor/project are direct |
| **fct_labor_transaction** | ❌ No (direct FKs) | Payroll comes from Amorphic, not Oracle GL — no CCID |
| **fct_scenario_action** | ❌ No (direct FKs) | Scenario planning targets specific dims directly |

### When to use the bridge:
- Source system uses a **composite key** (CCID) that encodes multiple dimensions
- Multiple facts share the **same composite key structure**
- You want **one join** for quick filtering, **two joins** for deep drill

### When to use direct FKs:
- Source system provides **individual dimension keys** natively
- Fact only connects to **2-3 dimensions** (bridge overhead not justified)
- Dimensions are **independent** (not segments of a composite key)

---

## Query Patterns Across All Facts

### Cross-fact analysis: "Total cost for HR department across all sources"

```sql
-- GL actuals
SELECT 'GL Actuals' as source, SUM(f.net_amount) as amount
FROM fct_gl_transaction f
JOIN dim_code_combination c ON f.coa_sk = c.coa_sk
WHERE c.department_code = '4200' AND f.actual_flag = 'A'

UNION ALL

-- Labor cost
SELECT 'Labor Cost', SUM(f.total_employer_cost)
FROM fct_labor_transaction f
JOIN dim_department d ON f.department_sk = d.department_sk
WHERE d.department_nk = '4200'

UNION ALL

-- Procurement
SELECT 'Procurement', SUM(f.ordered_amount)
FROM fct_procurement_lifecycle f
JOIN dim_code_combination c ON f.coa_sk = c.coa_sk
WHERE c.department_code = '4200'

UNION ALL

-- Scenario savings
SELECT 'Scenario Savings', SUM(f.action_amount)
FROM fct_scenario_action f
JOIN dim_department d ON f.department_sk = d.department_sk
WHERE d.department_nk = '4200'
```

Result:
```
source            │ amount
──────────────────┼────────────
GL Actuals        │ 1,250,000
Labor Cost        │ 980,000
Procurement       │ 185,000
Scenario Savings  │ -75,000
```
