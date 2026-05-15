# Fact Field Lineage — PVO Source per Column

> For each fact table, every column traced back to its source PVO field.

## fct_gl_transaction (Transaction Grain)

**Grain:** One row per GL journal line posting
**Source PVOs:** JournalHeaderExtractPVO + JournalLineExtractPVO

| Column | Source PVO.Field | Transformation |
|---|---|---|
| gl_transaction_sk | (surrogate) | Auto-increment |
| journal_header_id | JournalHeaderExtractPVO.JeHeaderId | Direct (DD) |
| journal_line_number | JournalLineExtractPVO.JeLineNum | Direct (DD) |
| journal_name | JournalHeaderExtractPVO.GlJeHeadersName | Direct (DD) |
| journal_description | JournalHeaderExtractPVO.GlJeHeadersDescription | Direct (DD) |
| posted_date_sk | JournalHeaderExtractPVO.GlJeHeadersPostedDate | dim_date lookup |
| coa_sk | JournalLineExtractPVO.GlJeLinesCodeCombinationId | dim_code_combination lookup |
| fund_code | CodeCombinationExtractPVO.Segment1 (via CCID) | Denormalized |
| department_code | CodeCombinationExtractPVO.Segment2 (via CCID) | Denormalized |
| account_code | CodeCombinationExtractPVO.Segment3 (via CCID) | Denormalized |
| entered_debit | JournalLineExtractPVO.GlJeLinesEnteredDr | COALESCE(x, 0) |
| entered_credit | JournalLineExtractPVO.GlJeLinesEnteredCr | COALESCE(x, 0) |
| accounted_debit | JournalLineExtractPVO.GlJeLinesAccountedDr | COALESCE(x, 0) |
| accounted_credit | JournalLineExtractPVO.GlJeLinesAccountedCr | COALESCE(x, 0) |
| net_amount | Derived | accounted_debit - accounted_credit |
| journal_source | JournalHeaderExtractPVO.GlJeHeadersJeSource | Direct |
| journal_category | JournalHeaderExtractPVO.GlJeHeadersJeCategory | Direct |
| actual_flag | JournalHeaderExtractPVO.GlJeHeadersActualFlag | A/B/E |
| encumbrance_type | JournalHeaderExtractPVO.JournalEncumbranceTLEncumbranceType | Direct |
| currency_code | JournalLineExtractPVO.GlJeLinesCurrencyCode | Line overrides header |
| ledger_id | JournalHeaderExtractPVO.GlJeHeadersLedgerId | Direct |
| is_payroll | Derived | JeSource = 'Payroll' |
| is_encumbrance | Derived | ActualFlag = 'E' |
| is_reversal | Derived | ReversedJeHeaderId IS NOT NULL |

## fct_budget_snapshot (Periodic Snapshot)

**Grain:** One row per fiscal period x code combination
**Source PVOs:** BudgetBalanceExtractPVO + BalanceExtractPVO + GLBalancesExtractPVO

| Column | Source PVO.Field | Transformation |
|---|---|---|
| budget_snapshot_sk | (surrogate) | Auto-increment |
| period_end_date_sk | BudgetBalanceExtractPVO.PeriodName | dim_date lookup |
| coa_sk | BudgetBalanceExtractPVO / BalanceExtractPVO.BudgetCcid | dim_code_combination |
| fund_code | BudgetBalanceExtractPVO.GlBudBalSegment1 | Denormalized |
| department_code | BudgetBalanceExtractPVO.GlBudBalSegment2 | Denormalized |
| account_code | BudgetBalanceExtractPVO.GlBudBalSegment3 | Denormalized |
| fiscal_period_name | BudgetBalanceExtractPVO.PeriodName | Direct |
| original_budget | BudgetBalanceExtractPVO.GlBudBalPeriodNetDr - GlBudBalPeriodNetCr | Debit - Credit |
| current_budget | Derived | original + amendments |
| budget_amendments | BudgetDistAcctExtractPVO.AmountChanged | SUM per period x COA |
| budget_version | BudgetBalanceExtractPVO.BudgetName | Direct |
| bc_budget | BalanceExtractPVO.BudgetAmount | Direct |
| bc_commitments | BalanceExtractPVO.CommitmentAmount | Direct |
| bc_obligations | BalanceExtractPVO.ObligationAmount | Direct |
| bc_expenditures | BalanceExtractPVO.ActualAmount | Direct |
| bc_funds_consumed | Derived | Commitment + Obligation + Actual + Other |
| bc_funds_available | BalanceExtractPVO.FundsAvailableAmount | Direct |
| bc_has_violation | Derived | FundsAvailable < 0 |
| gl_begin_balance | GLBalancesExtractPVO.BeginBalanceDr - BeginBalanceCr | Debit - Credit |
| gl_period_debit | GLBalancesExtractPVO.PeriodNetDr | Direct |
| gl_period_credit | GLBalancesExtractPVO.PeriodNetCr | Direct |
| gl_period_net | Derived | PeriodNetDr - PeriodNetCr |
| gl_ytd_balance | Derived | begin_balance + period_net |
| pct_budget_spent | Derived | gl_period_net / current_budget x 100 |
| remaining_spendable | BalanceExtractPVO.FundsAvailableAmount | Direct |

## fct_procurement_lifecycle (Accumulating Snapshot)

**Grain:** One row per PO distribution line
**Source PVOs:** PO Header/Distribution + Receipt + Invoice Header/Distribution + Payment

| Column | Source PVO.Field | Transformation |
|---|---|---|
| procurement_sk | (surrogate) | Auto-increment |
| po_number | POHeaderExtractPVO.Segment1 | Direct (DD) |
| invoice_number | InvoiceHeaderExtractPVO.InvoiceNum | Direct (DD) |
| payment_number | PaymentExtractPVO.CheckNumber | Direct (DD) |
| po_date_sk | POHeaderExtractPVO.ApprovedDate | dim_date |
| receipt_date_sk | ReceiptTransactionExtractPVO.TransactionDate | dim_date (MIN) |
| invoice_date_sk | InvoiceHeaderExtractPVO.InvoiceDate | dim_date |
| payment_date_sk | PaymentExtractPVO.CheckDate | dim_date (MIN) |
| coa_sk | PODistributionExtractPVO.CodeCombinationId | dim_code_combination |
| vendor_sk | POHeaderExtractPVO.VendorId | dim_vendor |
| project_sk | PODistributionExtractPVO.ProjectId | dim_project |
| ordered_amount | PODistributionExtractPVO.AmountOrdered | Direct |
| received_amount | ReceiptTransactionExtractPVO.Amount | SUM WHERE RECEIVE |
| invoiced_amount | InvoiceDistributionExtractPVO.Amount | SUM per PoDistId |
| paid_amount | PaymentExtractPVO.Amount | SUM via invoice chain |
| remaining_commitment | Derived | ordered - invoiced |
| remaining_obligation | Derived | invoiced - paid |
| total_encumbrance | PODistributionExtractPVO.EncumberedAmount | Direct |
| po_created_date | POHeaderExtractPVO.CreationDate | Milestone |
| first_receipt_date | ReceiptTransactionExtractPVO.TransactionDate | MIN |
| first_invoice_date | InvoiceDistributionExtractPVO.AccountingDate | MIN |
| first_payment_date | PaymentExtractPVO.CheckDate | MIN |
| days_po_to_receipt | Derived | receipt - po date |
| days_po_to_close | Derived | payment - po date |
| lifecycle_status | Derived | Milestone progression |
| hold_reason | InvoiceHeaderExtractPVO.HoldReason | Direct |

## fct_labor_transaction (Transaction Grain)

**Grain:** One row per employee x position x pay period x earning code
**Source:** Amorphic PAYROLL_ACTUALS + PAYROLL_EARNINGS + PAYROLL_BENEFITS

| Column | Source | Transformation |
|---|---|---|
| labor_transaction_sk | (surrogate) | Auto-increment |
| pay_period_end_date_sk | Amorphic: pay_period_end_date | dim_date |
| employee_sk | Amorphic: employee_id | dim_employee |
| position_sk | Amorphic: position_id | dim_position |
| department_sk | Amorphic: department_code | dim_department |
| earning_code | Amorphic: earning_code | REG/OT/PREM/SICK/VAC |
| earning_category | Amorphic: earning_category | Base Pay/Overtime/etc. |
| hours_worked | Amorphic: hours_worked | Direct |
| overtime_hours | Amorphic: overtime_hours | Direct |
| gross_amount | Amorphic: gross_amount | Direct |
| regular_pay | Amorphic: regular_pay | Direct |
| overtime_pay | Amorphic: overtime_pay | Direct |
| employer_benefits | Amorphic: employer_benefits | Direct |
| employer_taxes | Amorphic: employer_taxes | Direct |
| total_employer_cost | Derived | gross + benefits + taxes |
| is_overtime | Derived | overtime_hours > 0 |

## fct_scenario_action (Transaction Grain)

**Grain:** One row per scenario x action line x fiscal year
**Source:** Amorphic SCENARIO_ACTIONS

| Column | Source | Transformation |
|---|---|---|
| scenario_action_sk | (surrogate) | Auto-increment |
| scenario_sk | Amorphic: scenario_id | dim_scenario |
| department_sk | Amorphic: department_code | dim_department |
| account_sk | Amorphic: account_code | dim_account |
| position_sk | Amorphic: position_id | dim_position |
| action_type | Amorphic: action_type | FreezeHire/CancelPO/etc. |
| target_type | Amorphic: target_type | LABOR/NON_LABOR/CAPITAL |
| fiscal_year | Amorphic: fiscal_year | Direct |
| baseline_amount | Amorphic: baseline_amount | Direct |
| action_amount | Amorphic: action_amount | Negative = savings |
| forecast_amount | Derived | baseline + action |
| cumulative_savings | Derived | Running SUM(action_amount) |
| is_constrained | Amorphic: is_constrained | Direct |
| rationale | Amorphic: rationale | Direct |
