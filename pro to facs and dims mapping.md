# PVO Field Inventory — Required Fields per Extract

> Every Oracle Fusion BICC PVO with its required fields, data types, and target column mapping.
> Fields marked ✅ are required. Fields marked 🔍 are optional/audit.

---

## 1. BudgetBalanceExtractPVO → fct_budget_snapshot

| # | PVO Field | Type | Req | Target Column | Purpose |
|---|---|---|---|---|---|
| 1 | LedgerId | NUMBER | ✅ | (filter) | Primary ledger filter |
| 2 | BudgetName | VARCHAR | ✅ | budget_version | Budget identifier |
| 3 | PeriodName | VARCHAR | ✅ | fiscal_period_name | Period key |
| 4 | CurrencyCode | VARCHAR | ✅ | (filter) | Currency filter |
| 5 | CurrencyType | VARCHAR | ✅ | (filter) | Currency type filter |
| 6 | ConcatAccount | VARCHAR | ✅ | full_coa_string | Full COA |
| 7 | GlBudBalSegment1-6 | VARCHAR | ✅ | fund/dept/acct/prog/proj/grant_code | COA segments |
| 8 | GlBudBalPeriodNetDr | NUMBER | ✅ | original_budget (debit part) | Budget debit |
| 9 | GlBudBalPeriodNetCr | NUMBER | ✅ | original_budget (credit part) | Budget credit |
| 10 | GlBudBalLastUpdateDate | TIMESTAMP | ✅ | (incremental key) | CDC |

## 2. BalanceExtractPVO (BC) → fct_budget_snapshot

| # | PVO Field | Type | Req | Target Column | Purpose |
|---|---|---|---|---|---|
| 1 | ControlBudgetId | NUMBER | ✅ | (grouping) | Control budget ID |
| 2 | BudgetCcid | NUMBER | ✅ | coa_nk | Account CCID |
| 3 | PeriodName | VARCHAR | ✅ | fiscal_period_name | Period key |
| 4 | BudgetAmount | NUMBER | ✅ | bc_budget | Total budget |
| 5 | BudgetAdjustmentAmount | NUMBER | ✅ | budget_amendments | Adjustments |
| 6 | CommitmentAmount | NUMBER | ✅ | bc_commitments | Requisitions |
| 7 | ObligationAmount | NUMBER | ✅ | bc_obligations | PO obligations |
| 8 | ActualAmount | NUMBER | ✅ | bc_expenditures | Actuals |
| 9 | OtherAmount | NUMBER | ✅ | (bc_funds_consumed part) | Other encumbrances |
| 10 | FundsAvailableAmount | NUMBER | ✅ | bc_funds_available | Available funds |
| 11 | ApprovedCommitmentAmount | NUMBER | ✅ | (detail) | Req detail |
| 12 | ApprovedObligationAmount | NUMBER | ✅ | (detail) | PO detail |
| 13 | AccountedPayablesAmount | NUMBER | ✅ | (detail) | AP expenditure |
| 14 | AccountedReceiptsAmount | NUMBER | ✅ | (detail) | Receipt expenditure |
| 15 | AccountedProjectAmount | NUMBER | ✅ | (detail) | Project expenditure |
| 16 | LastUpdateDate | TIMESTAMP | ✅ | (incremental key) | CDC |

## 3. BudgetDistHeaderExtractPVO → fct_budget_snapshot (adjustments)

| # | PVO Field | Type | Req | Target Column | Purpose |
|---|---|---|---|---|---|
| 1 | HeaderId | NUMBER | ✅ | (join key) | Budget entry header |
| 2 | DataSet | VARCHAR | ✅ | budget_version | Budget name |
| 3 | BudgetEntryTypeCode | VARCHAR | ✅ | (classification) | Initial/Adjustment |
| 4 | ApprovedBy | VARCHAR | 🔍 | (audit) | Approver |
| 5 | ApprovedDate | TIMESTAMP | 🔍 | (audit) | Approval date |
| 6 | ImportSourceCode | VARCHAR | 🔍 | (audit) | PPM/FBDI/HYPERION |
| 7 | LastUpdateDate | TIMESTAMP | ✅ | (incremental key) | CDC |

## 4. BudgetDistAcctExtractPVO → fct_budget_snapshot (adjustment lines)

| # | PVO Field | Type | Req | Target Column | Purpose |
|---|---|---|---|---|---|
| 1 | HeaderId | NUMBER | ✅ | (join to header) | FK |
| 2 | BudgetCcid | NUMBER | ✅ | coa_nk | Account CCID |
| 3 | PeriodName | VARCHAR | ✅ | fiscal_period_name | Period |
| 4 | AmountChanged | NUMBER | ✅ | budget_amendments | Adjustment amount |
| 5 | LastUpdateDate | TIMESTAMP | ✅ | (incremental key) | CDC |

## 5. JournalHeaderExtractPVO → fct_gl_transaction

| # | PVO Field | Type | Req | Target Column | Purpose |
|---|---|---|---|---|---|
| 1 | JeHeaderId | NUMBER | ✅ | journal_header_id | PK |
| 2 | GlJeHeadersName | VARCHAR | ✅ | journal_name | Degenerate dim |
| 3 | GlJeHeadersDescription | VARCHAR | ✅ | journal_description | Degenerate dim |
| 4 | GlJeHeadersJeSource | VARCHAR | ✅ | journal_source | Source classification |
| 5 | GlJeHeadersJeCategory | VARCHAR | ✅ | journal_category | Category |
| 6 | GlJeHeadersActualFlag | VARCHAR | ✅ | actual_flag | A/B/E |
| 7 | GlJeHeadersLedgerId | NUMBER | ✅ | ledger_id | Ledger |
| 8 | GlJeHeadersPeriodName | VARCHAR | ✅ | (dim_date join) | Period |
| 9 | GlJeHeadersPostedDate | DATE | ✅ | posted_date_sk | Date FK |
| 10 | GlJeHeadersCurrencyCode | VARCHAR | ✅ | currency_code | Currency |
| 11 | GlJeHeadersStatus | VARCHAR | ✅ | (filter: 'P') | Posted only |
| 12 | GlJeHeadersEncumbranceTypeId | NUMBER | ✅ | (encumbrance FK) | Encumbrance type |
| 13 | JournalEncumbranceTLEncumbranceType | VARCHAR | ✅ | encumbrance_type | Type name |
| 14 | GlJeHeadersReversedJeHeaderId | NUMBER | ✅ | is_reversal | Reversal flag |
| 15 | GlJeHeadersDefaultEffectiveDate | DATE | ✅ | posted_date_sk (fallback) | Accounting date |
| 16 | GlJeHeadersLastUpdateDate | TIMESTAMP | ✅ | (incremental key) | CDC |

## 6. JournalLineExtractPVO → fct_gl_transaction

| # | PVO Field | Type | Req | Target Column | Purpose |
|---|---|---|---|---|---|
| 1 | JeHeaderId | NUMBER | ✅ | journal_header_id | FK to header |
| 2 | JeLineNum | NUMBER | ✅ | journal_line_number | Degenerate dim |
| 3 | GlJeLinesCodeCombinationId | NUMBER | ✅ | coa_sk | FK to dim_code_combination |
| 4 | GlJeLinesEnteredDr | NUMBER | ✅ | entered_debit | Entered debit |
| 5 | GlJeLinesEnteredCr | NUMBER | ✅ | entered_credit | Entered credit |
| 6 | GlJeLinesAccountedDr | NUMBER | ✅ | accounted_debit | Ledger debit |
| 7 | GlJeLinesAccountedCr | NUMBER | ✅ | accounted_credit | Ledger credit |
| 8 | GlJeLinesEffectiveDate | DATE | ✅ | posted_date_sk | Line date |
| 9 | GlJeLinesCurrencyCode | VARCHAR | ✅ | currency_code | Currency |
| 10 | GlJeLinesLastUpdateDate | TIMESTAMP | ✅ | (incremental key) | CDC |

## 7. GLBalancesExtractPVO → fct_budget_snapshot

| # | PVO Field | Type | Req | Target Column | Purpose |
|---|---|---|---|---|---|
| 1 | LedgerId | NUMBER | ✅ | (filter) | Ledger |
| 2 | PeriodName | VARCHAR | ✅ | fiscal_period_name | Period |
| 3 | CodeCombinationId | NUMBER | ✅ | coa_sk | Account FK |
| 4 | ActualFlag | VARCHAR | ✅ | (filter: 'A') | Actuals only |
| 5 | BeginBalanceDr/Cr | NUMBER | ✅ | gl_begin_balance | Beginning balance |
| 6 | PeriodNetDr/Cr | NUMBER | ✅ | gl_period_debit/credit | Period activity |
| 7 | LastUpdateDate | TIMESTAMP | ✅ | (incremental key) | CDC |

## 8. CodeCombinationExtractPVO → dim_code_combination

| # | PVO Field | Type | Req | Target Column | Purpose |
|---|---|---|---|---|---|
| 1 | CodeCombinationId | NUMBER | ✅ | coa_nk | Natural key |
| 2 | Segment1-6 | VARCHAR | ✅ | fund/dept/acct/prog/proj/grant_code | COA segments |
| 3 | ConcatenatedSegments | VARCHAR | ✅ | full_coa_string | Display |
| 4 | EnabledFlag | VARCHAR | ✅ | is_enabled | Active |
| 5 | SummaryFlag | VARCHAR | ✅ | is_summary | Summary |
| 6 | StartDateActive | DATE | ✅ | _effective_from | SCD2 |
| 7 | EndDateActive | DATE | ✅ | _effective_to | SCD2 |

## 9. SegmentValueExtractPVO → dim_fund, dim_department, dim_account, dim_program

| # | PVO Field | Type | Req | Target Column | Purpose |
|---|---|---|---|---|---|
| 1 | FlexValueSetId | NUMBER | ✅ | (routing key) | Which segment dim |
| 2 | FlexValue | VARCHAR | ✅ | fund_nk / department_nk / account_nk / program_nk | Natural key |
| 3 | Description | VARCHAR | ✅ | fund_description / etc. | Display name |
| 4 | EnabledFlag | VARCHAR | ✅ | is_enabled | Active |
| 5 | SummaryFlag | VARCHAR | ✅ | (hierarchy) | Parent node |
| 6 | ParentFlexValue | VARCHAR | ✅ | parent_fund_nk / etc. | Hierarchy parent |
| 7 | HierarchyLevel | NUMBER | ✅ | hierarchy_level | Depth |
| 8 | CompiledValueAttributes | VARCHAR | ✅ | account_type / fund_type | Parsed attributes |
| 9 | StartDateActive | DATE | ✅ | _effective_from | SCD2 |
| 10 | EndDateActive | DATE | ✅ | _effective_to | SCD2 |

## 10. PurchaseOrderHeaderExtractPVO → fct_procurement_lifecycle

| # | PVO Field | Type | Req | Target Column | Purpose |
|---|---|---|---|---|---|
| 1 | PoHeaderId | NUMBER | ✅ | (join key) | PO header PK |
| 2 | Segment1 (OrderNumber) | VARCHAR | ✅ | po_number | Degenerate dim |
| 3 | DocumentTypeCode | VARCHAR | ✅ | (classification) | STANDARD/BLANKET |
| 4 | DocumentStatus | VARCHAR | ✅ | po_status | Status |
| 5 | VendorId | NUMBER | ✅ | vendor_sk | FK to dim_vendor |
| 6 | TotalAmount | NUMBER | ✅ | ordered_amount (header) | PO total |
| 7 | CreationDate | TIMESTAMP | ✅ | po_created_date | Milestone |
| 8 | ApprovedDate | TIMESTAMP | ✅ | po_date_sk | Date FK |

## 11. PurchaseOrderDistributionExtractPVO → fct_procurement_lifecycle (GRAIN)

| # | PVO Field | Type | Req | Target Column | Purpose |
|---|---|---|---|---|---|
| 1 | PoDistributionId | NUMBER | ✅ | (fact grain key) | PK |
| 2 | PoHeaderId | NUMBER | ✅ | (join to header) | FK |
| 3 | CodeCombinationId | NUMBER | ✅ | coa_sk | FK to dim_code_combination |
| 4 | ProjectId | NUMBER | ✅ | project_sk | FK to dim_project |
| 5 | AmountOrdered | NUMBER | ✅ | ordered_amount | Distribution amount |
| 6 | EncumberedAmount | NUMBER | ✅ | total_encumbrance | Encumbrance |
| 7 | DistributionStatus | VARCHAR | ✅ | lifecycle_status | Status |

## 12. ReceiptTransactionExtractPVO → fct_procurement_lifecycle

| # | PVO Field | Type | Req | Target Column | Purpose |
|---|---|---|---|---|---|
| 1 | TransactionId | NUMBER | ✅ | (staging PK) | Receipt event |
| 2 | PoDistributionId | NUMBER | ✅ | (join to fact grain) | Links to fact |
| 3 | TransactionType | VARCHAR | ✅ | (filter: RECEIVE) | Type |
| 4 | TransactionDate | DATE | ✅ | receipt_date_sk / first_receipt_date | Milestone |
| 5 | Amount | NUMBER | ✅ | received_amount | Receipt amount |

## 13. InvoiceHeaderExtractPVO → fct_procurement_lifecycle

| # | PVO Field | Type | Req | Target Column | Purpose |
|---|---|---|---|---|---|
| 1 | InvoiceId | NUMBER | ✅ | (join key) | Invoice PK |
| 2 | InvoiceNum | VARCHAR | ✅ | invoice_number | Degenerate dim |
| 3 | InvoiceDate | DATE | ✅ | invoice_date_sk | Date FK |
| 4 | InvoiceAmount | NUMBER | ✅ | invoiced_amount (header) | Total |
| 5 | VendorId | NUMBER | ✅ | vendor_sk (cross-check) | Vendor |
| 6 | PaymentStatusFlag | VARCHAR | ✅ | payment_status | Y/N/P |
| 7 | DueDate | DATE | ✅ | due_date_sk | Due date |
| 8 | HoldReason | VARCHAR | ✅ | hold_reason | Hold info |

## 14. InvoiceDistributionExtractPVO → fct_procurement_lifecycle

| # | PVO Field | Type | Req | Target Column | Purpose |
|---|---|---|---|---|---|
| 1 | InvoiceDistributionId | NUMBER | ✅ | (staging PK) | Distribution PK |
| 2 | InvoiceId | NUMBER | ✅ | (join to header) | FK |
| 3 | PoDistributionId | NUMBER | ✅ | (join to fact grain) | Links to fact |
| 4 | DistCodeCombinationId | NUMBER | ✅ | coa_sk | Account FK |
| 5 | Amount | NUMBER | ✅ | invoiced_amount | Distribution amount |
| 6 | AccountingDate | DATE | ✅ | first_invoice_date | Milestone |

## 15. PaymentExtractPVO → fct_procurement_lifecycle

| # | PVO Field | Type | Req | Target Column | Purpose |
|---|---|---|---|---|---|
| 1 | CheckId/PaymentId | NUMBER | ✅ | (staging PK) | Payment PK |
| 2 | CheckNumber/PaymentNumber | VARCHAR | ✅ | payment_number | Degenerate dim |
| 3 | CheckDate/PaymentDate | DATE | ✅ | payment_date_sk / first_payment_date | Milestone |
| 4 | Amount | NUMBER | ✅ | paid_amount | Payment amount |
| 5 | StatusCode | VARCHAR | ✅ | payment_status | NEGOTIABLE/CLEARED/VOIDED |
| 6 | InvoiceId | NUMBER | ✅ | (join to invoice) | Links to invoice |

## 16. SupplierExtractPVO → dim_vendor

| # | PVO Field | Type | Req | Target Column | Purpose |
|---|---|---|---|---|---|
| 1 | VendorId | NUMBER | ✅ | vendor_nk | Natural key |
| 2 | VendorName | VARCHAR | ✅ | vendor_name | Display name |
| 3 | Segment1 | VARCHAR | ✅ | vendor_number | Vendor number |
| 4 | VendorTypeCode | VARCHAR | ✅ | vendor_type | Type |
| 5 | EnabledFlag | VARCHAR | ✅ | vendor_status | Active/Inactive |
| 6 | PaymentMethodCode | VARCHAR | ✅ | payment_method | CHECK/EFT/WIRE |
| 7 | MinorityGroupCode | VARCHAR | ✅ | is_minority_owned | Diversity |
| 8 | WomanOwnedFlag | VARCHAR | ✅ | is_woman_owned | Diversity |
| 9 | SmallBusinessFlag | VARCHAR | ✅ | is_small_business | Diversity |

## 17. SupplierSiteExtractPVO → dim_vendor (address)

| # | PVO Field | Type | Req | Target Column | Purpose |
|---|---|---|---|---|---|
| 1 | VendorId | NUMBER | ✅ | vendor_nk (join) | FK |
| 2 | City | VARCHAR | ✅ | city | Address |
| 3 | State | VARCHAR | ✅ | state | Address |
| 4 | Country | VARCHAR | ✅ | country | Address |
| 5 | Zip | VARCHAR | ✅ | zip_code | Address |
| 6 | PaySiteFlag | VARCHAR | ✅ | (filter: primary site) | Primary site |

## 18. GrantAwardExtractPVO → dim_grant

| # | PVO Field | Type | Req | Target Column | Purpose |
|---|---|---|---|---|---|
| 1 | AwardId | NUMBER | ✅ | grant_nk | Natural key |
| 2 | SponsorAwardNumber | VARCHAR | ✅ | sponsor_award_number | External ref |
| 3 | AwardName | VARCHAR | ✅ | grant_name | Display name |
| 4 | AwardType | VARCHAR | ✅ | grant_type | Federal/State/etc. |
| 5 | AwardPurpose | VARCHAR | ✅ | grant_purpose | Purpose |
| 6 | AwardStatus | VARCHAR | ✅ | grant_status | Active/Closed |
| 7 | SponsorName | VARCHAR | ✅ | sponsor_name | Grantor |
| 8 | StartDate | DATE | ✅ | award_start_date | Start |
| 9 | EndDate | DATE | ✅ | award_end_date | End |
| 10 | TotalAwardAmount | NUMBER | ✅ | total_award_amount | Total funding |

## 19. GrantFundingSourceExtractPVO → dim_grant (extended)

| # | PVO Field | Type | Req | Target Column | Purpose |
|---|---|---|---|---|---|
| 1 | AwardId | NUMBER | ✅ | grant_nk (join) | FK |
| 2 | MatchRequired | VARCHAR | ✅ | is_match_required | Match flag |
| 3 | MatchPercentage | NUMBER | ✅ | match_percentage | Match % |

---

**Total: 19 Oracle Fusion PVOs, ~160 required fields mapped to target columns.**
