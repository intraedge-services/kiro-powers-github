# Executive Decision Traceability

> Maps each executive decision from the requirement sheet back through
> the datasets, PVOs, and target facts/dims needed to support it.

## Decision 1: Defines legal authority to spend
**Dataset:** Budget Balances
**PVO:** BudgetBalanceExtractPVO
**Target:** fct_budget_snapshot.original_budget, .current_budget
**Key Fields:** GlBudBalPeriodNetDr, GlBudBalPeriodNetCr, BudgetName, PeriodName, Segments1-6

## Decision 2: Explains why budgets moved
**Dataset:** Budget Adjustments
**PVOs:** BudgetDistHeaderExtractPVO + BudgetDistAcctExtractPVO
**Target:** fct_budget_snapshot.budget_amendments
**Key Fields:** AmountChanged, BudgetEntryTypeCode, BudgetCcid, PeriodName

## Decision 3: Establishes "true available budget"
**Dataset:** Budgetary Control Balances
**PVO:** BalanceExtractPVO
**Target:** fct_budget_snapshot.bc_budget, .bc_commitments, .bc_obligations, .bc_expenditures, .bc_funds_available
**Key Fields:** BudgetAmount, CommitmentAmount, ObligationAmount, ActualAmount, FundsAvailableAmount

## Decision 4: Identifies real spend drivers
**Dataset:** GL Actuals (Non-Payroll)
**PVOs:** JournalHeaderExtractPVO + JournalLineExtractPVO
**Target:** fct_gl_transaction (actual_flag='A')
**Key Fields:** JeSource, JeCategory, AccountedDr/Cr, CodeCombinationId, PostedDate

## Decision 5: Validates dashboard totals against ledger
**Dataset:** GL Balances (Actual)
**PVO:** GLBalancesExtractPVO
**Target:** fct_budget_snapshot.gl_begin_balance, .gl_period_debit/credit, .gl_ytd_balance
**Key Fields:** BeginBalanceDr/Cr, PeriodNetDr/Cr, CodeCombinationId

## Decision 6: Identifies cancellable commitments
**Dataset:** Purchase Orders
**PVOs:** PurchaseOrderHeaderExtractPVO + DistributionExtractPVO
**Target:** fct_procurement_lifecycle WHERE lifecycle_status='Ordered' AND received_amount=0
**Key Fields:** DocumentStatus, AmountOrdered, EncumberedAmount, VendorId

## Decision 7: Distinguishes sunk vs avoidable spend
**Dataset:** Receiving
**PVOs:** ReceiptTransactionExtractPVO
**Target:** fct_procurement_lifecycle.received_amount (>0 = sunk, =0 = avoidable)
**Key Fields:** TransactionDate, Amount, TransactionType, PoDistributionId

## Decision 8: Shows near-term budget pressure
**Dataset:** AP Invoices
**PVOs:** InvoiceHeaderExtractPVO + InvoiceDistributionExtractPVO
**Target:** fct_procurement_lifecycle.invoiced_amount, .remaining_obligation, .hold_reason
**Key Fields:** InvoiceAmount, DueDate, PaymentStatusFlag, HoldReason

## Decision 9: Identifies true cash outflow timing
**Dataset:** AP Invoice Payments
**PVO:** PaymentExtractPVO
**Target:** fct_procurement_lifecycle.paid_amount, .payment_date_sk
**Key Fields:** Amount, CheckDate, StatusCode (CLEARED = actual cash out)

## Decision 10: Distinguishes commitment vs obligation vs expenditure
**Dataset:** Encumbrance Accounting Entries
**PVOs:** JournalHeaderExtractPVO + JournalLineExtractPVO (ActualFlag='E')
**Target:** fct_gl_transaction WHERE is_encumbrance=true
**Key Fields:** EncumbranceType (Commitment/Obligation/Expenditure), AccountedDr/Cr

## Decision 11: Enables delay/stop capital decisions
**Dataset:** Project Financials
**PVO:** ProjectExtractPVO (confirm in BICC)
**Target:** dim_project + fct_budget_snapshot filtered by project_code
**Key Fields:** ProjectStatus, TotalBudgetAmount, StartDate, CompletionDate

## Decision 12: Prevents cutting restricted external funding
**Dataset:** Grant Awards
**PVO:** GrantAwardExtractPVO
**Target:** dim_grant.is_restricted, .grant_status, .award_end_date
**Key Fields:** AwardStatus, TotalAwardAmount, StartDate, EndDate

## Decision 13: Supports restrictions, match requirements
**Dataset:** Grant Award Funding Sources
**PVO:** GrantFundingSourceExtractPVO
**Target:** dim_grant.is_match_required, .match_percentage
**Key Fields:** MatchRequired, MatchPercentage

## Decision 14: Identifies must-spend or at-risk funds
**Dataset:** Grant Financials
**Source:** Derived from GL/BC filtered by grant segment
**Target:** fct_budget_snapshot + fct_gl_transaction WHERE grant_code IS NOT NULL
**Key Fields:** bc_funds_available, days_remaining (from dim_grant)

## Decision 15: Ensures consistent rollups
**Dataset:** Chart of Accounts - Segment Values
**PVO:** ChartOfAccountsSegmentValueExtractPVO
**Target:** dim_fund, dim_department, dim_account, dim_program (hierarchies)
**Key Fields:** FlexValue, Description, ParentFlexValue, HierarchyLevel

## Decision 16: Provides authoritative accounting key
**Dataset:** Chart of Accounts - Code Combinations
**PVO:** CodeCombinationExtractPVO
**Target:** dim_code_combination (central FK for all facts)
**Key Fields:** CodeCombinationId, Segment1-6, ConcatenatedSegments, EnabledFlag

## Decision 17: Supports vendor concentration analysis
**Dataset:** Vendor / Supplier Dimension
**PVOs:** SupplierExtractPVO + SupplierSiteExtractPVO
**Target:** dim_vendor (joined to fct_procurement_lifecycle)
**Key Fields:** VendorName, VendorType, MinorityGroupCode, City/State

## Decision 18: Identifies long-term obligations
**Dataset:** Commitment / Contract Agreements
**PVO:** PurchaseOrderHeaderExtractPVO (DocumentType=BLANKET/CONTRACT)
**Target:** fct_procurement_lifecycle WHERE document_type IN ('BLANKET','CONTRACT')
**Key Fields:** TotalAmount, DocumentStatus, ClosedDate

## Decision 19: Defines where labor savings can exist
**Dataset:** Position Dimension
**Source:** Amorphic POSITION_DIM
**Target:** dim_position.authorized_fte, .is_overtime_eligible, .pay_type
**Key Fields:** position_id, authorized_fte, job_code, bargaining_unit

## Decision 20: Reconciles labor spend
**Dataset:** Payroll Actuals
**Source:** Amorphic PAYROLL_ACTUALS
**Target:** fct_labor_transaction.gross_amount, .total_employer_cost
**Key Fields:** gross_amount, employer_benefits, employer_taxes, fund_code

## Decision 21: Enables hiring freeze and cut scenarios
**Dataset:** Payroll Forecast + Scenario Actions
**Source:** Amorphic PAYROLL_FORECAST + SCENARIO_ACTIONS
**Target:** fct_scenario_action.action_type='FreezeHire', .action_amount
**Key Fields:** action_type, baseline_amount, action_amount, fiscal_year

## Decision 22: Enables exec-level rollups
**Dataset:** Org Hierarchy
**Source:** Amorphic ORG_HIERARCHY
**Target:** dim_department.level_1-4, .executive_owner, .hierarchy_path
**Key Fields:** level_1_code through level_4_code, executive_owner

## Decision 23: Prevents unrealistic cuts
**Dataset:** Account Rollups + Discretionary Reduction Levers
**Source:** Amorphic ACCOUNT_ROLLUPS + REDUCTION_LEVERS
**Target:** dim_account.is_cuttable, .maximum_cut_pct, .minimum_spend_floor_pct
**Key Fields:** is_discretionary, is_cuttable, maximum_cut_pct

## Decision 24: Makes decisions defensible
**Dataset:** Program / Service Map
**Source:** Amorphic PROGRAM_SERVICE_MAP
**Target:** dim_program.service_label, .strategic_priority, .is_mandated
**Key Fields:** service_label, strategic_priority, is_mandated

## Decision 25: Establishes trust in numbers
**Dataset:** Reconciliation Controls
**Source:** Amorphic RECONCILIATION_CONTROLS
**Target:** (validation layer - payroll vs GL, encumbrance checks)
**Key Fields:** payroll_gl_variance, encumbrance_check_status

## Decision 26: Enables repeatable what-if runs
**Dataset:** Scenario Run Header
**Source:** Amorphic SCENARIO_HEADER
**Target:** dim_scenario
**Key Fields:** scenario_id, scenario_name, baseline_fiscal_year, is_approved

## Decision 27: Connects executive decisions to forecast deltas
**Dataset:** Scenario Actions (Lines)
**Source:** Amorphic SCENARIO_ACTIONS
**Target:** fct_scenario_action
**Key Fields:** action_type, action_amount, baseline_amount, rationale, is_constrained

## Decision 28: Provides auditable inflation drivers
**Dataset:** Inflation / CPI Index Series
**Source:** BLS/FRED via Amorphic CPI_INDEX
**Target:** (reference table for non-labor forecasting)
**Key Fields:** index_value, yoy_pct, series_id
