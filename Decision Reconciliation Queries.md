# Decision Reconciliation Queries

> SQL queries/logic to derive each executive decision metric from Oracle Fusion PVO raw tables.
> Use these to reconcile dashboard outputs against source data.
>
> **Convention:**
> - `RAW.FUSION_*` = Snowflake raw tables loaded from BICC PVO extracts
> - `AMORPHIC.*` = Amorphic curated tables
> - All queries assume Snowflake SQL dialect

---

## Decision 1: Defines legal authority to spend

**Metric:** Original and current budget per department/fund/period

```sql
-- Source: BudgetBalanceExtractPVO
SELECT
    b.SEGMENT1 AS fund_code,
    b.SEGMENT2 AS department_code,
    b.SEGMENT3 AS account_code,
    b.PERIOD_NAME,
    b.BUDGET_NAME,
    SUM(b.GL_BUD_BAL_PERIOD_NET_DR - b.GL_BUD_BAL_PERIOD_NET_CR) AS original_budget
FROM RAW.FUSION_BUDGET_BALANCE_EXTRACT b
WHERE b.BUDGET_NAME = 'FY2024 Adopted'
GROUP BY b.SEGMENT1, b.SEGMENT2, b.SEGMENT3, b.PERIOD_NAME, b.BUDGET_NAME;
```

**Reconciliation check:**
```sql
-- Dashboard total must equal this
SELECT SUM(GL_BUD_BAL_PERIOD_NET_DR - GL_BUD_BAL_PERIOD_NET_CR) AS total_budget
FROM RAW.FUSION_BUDGET_BALANCE_EXTRACT
WHERE BUDGET_NAME = 'FY2024 Adopted';
```

---

## Decision 2: Explains why budgets moved

**Metric:** Budget amendment amounts by period and COA

```sql
-- Source: BudgetDistHeaderExtractPVO + BudgetDistAcctExtractPVO
SELECT
    h.BUDGET_ENTRY_TYPE_CODE AS amendment_type,
    a.PERIOD_NAME,
    cc.SEGMENT1 AS fund_code,
    cc.SEGMENT2 AS department_code,
    cc.SEGMENT3 AS account_code,
    SUM(a.AMOUNT_CHANGED) AS amendment_amount,
    h.DESCRIPTION AS amendment_reason
FROM RAW.FUSION_BUDGET_DIST_HEADER_EXTRACT h
JOIN RAW.FUSION_BUDGET_DIST_ACCT_EXTRACT a ON h.BUDGET_DIST_HEADER_ID = a.BUDGET_DIST_HEADER_ID
JOIN RAW.FUSION_CODE_COMBINATIONS_EXTRACT cc ON a.BUDGET_CCID = cc.CODE_COMBINATION_ID
GROUP BY h.BUDGET_ENTRY_TYPE_CODE, a.PERIOD_NAME, cc.SEGMENT1, cc.SEGMENT2, cc.SEGMENT3, h.DESCRIPTION;
```

**Reconciliation check:**
```sql
-- current_budget = original_budget + SUM(amendments)
-- This must equal fct_budget_snapshot.current_budget
SELECT
    SUM(AMOUNT_CHANGED) AS total_amendments
FROM RAW.FUSION_BUDGET_DIST_ACCT_EXTRACT;
```

---

## Decision 3: Establishes "true available budget"

**Metric:** Budgetary control balances — budget, commitments, obligations, expenditures, funds available

```sql
-- Source: BalanceExtractPVO (Budgetary Control)
SELECT
    bc.SEGMENT1 AS fund_code,
    bc.SEGMENT2 AS department_code,
    bc.SEGMENT3 AS account_code,
    bc.BUDGET_AMOUNT,
    bc.COMMITMENT_AMOUNT,
    bc.OBLIGATION_AMOUNT,
    bc.ACTUAL_AMOUNT AS expenditure_amount,
    bc.FUNDS_AVAILABLE_AMOUNT,
    CASE WHEN bc.FUNDS_AVAILABLE_AMOUNT < 0 THEN 'VIOLATION' ELSE 'OK' END AS budget_status
FROM RAW.FUSION_BC_BALANCE_EXTRACT bc;
```

**Reconciliation check:**
```sql
-- funds_available = budget - (commitment + obligation + actual + other)
SELECT
    SUM(BUDGET_AMOUNT) AS total_budget,
    SUM(COMMITMENT_AMOUNT + OBLIGATION_AMOUNT + ACTUAL_AMOUNT) AS total_consumed,
    SUM(FUNDS_AVAILABLE_AMOUNT) AS total_available,
    SUM(BUDGET_AMOUNT) - SUM(COMMITMENT_AMOUNT + OBLIGATION_AMOUNT + ACTUAL_AMOUNT)
        AS calculated_available
FROM RAW.FUSION_BC_BALANCE_EXTRACT;
-- total_available MUST equal calculated_available
```

---

## Decision 4: Identifies real spend drivers

**Metric:** Non-payroll actual GL expenses by account category

```sql
-- Source: JournalHeaderExtractPVO + JournalLineExtractPVO
SELECT
    cc.SEGMENT2 AS department_code,
    cc.SEGMENT3 AS account_code,
    h.GL_JE_HEADERS_JE_SOURCE AS journal_source,
    h.GL_JE_HEADERS_JE_CATEGORY AS journal_category,
    SUM(l.GL_JE_LINES_ACCOUNTED_DR - l.GL_JE_LINES_ACCOUNTED_CR) AS net_expense
FROM RAW.FUSION_GL_JOURNAL_HEADERS_EXTRACT h
JOIN RAW.FUSION_GL_JOURNAL_LINES_EXTRACT l ON h.JE_HEADER_ID = l.JE_HEADER_ID
JOIN RAW.FUSION_CODE_COMBINATIONS_EXTRACT cc ON l.GL_JE_LINES_CODE_COMBINATION_ID = cc.CODE_COMBINATION_ID
WHERE h.GL_JE_HEADERS_ACTUAL_FLAG = 'A'           -- Actuals only
  AND h.GL_JE_HEADERS_JE_SOURCE != 'Payroll'      -- Exclude payroll
  AND h.GL_JE_HEADERS_POSTED_DATE IS NOT NULL      -- Posted only
GROUP BY cc.SEGMENT2, cc.SEGMENT3, h.GL_JE_HEADERS_JE_SOURCE, h.GL_JE_HEADERS_JE_CATEGORY
ORDER BY net_expense DESC;
```

**Reconciliation check:**
```sql
-- Total non-payroll actuals from GL
SELECT SUM(GL_JE_LINES_ACCOUNTED_DR - GL_JE_LINES_ACCOUNTED_CR) AS total_nonpayroll
FROM RAW.FUSION_GL_JOURNAL_HEADERS_EXTRACT h
JOIN RAW.FUSION_GL_JOURNAL_LINES_EXTRACT l ON h.JE_HEADER_ID = l.JE_HEADER_ID
WHERE h.GL_JE_HEADERS_ACTUAL_FLAG = 'A'
  AND h.GL_JE_HEADERS_JE_SOURCE != 'Payroll';
-- Must match: SELECT SUM(net_amount) FROM fct_gl_transaction WHERE is_payroll = false
```

---

## Decision 5: Validates dashboard totals against ledger

**Metric:** GL period balances for cross-check

```sql
-- Source: GLBalancesExtractPVO
SELECT
    gb.CODE_COMBINATION_ID,
    cc.SEGMENT1 AS fund_code,
    cc.SEGMENT2 AS department_code,
    cc.SEGMENT3 AS account_code,
    gb.PERIOD_NAME,
    gb.BEGIN_BALANCE_DR - gb.BEGIN_BALANCE_CR AS begin_balance,
    gb.PERIOD_NET_DR AS period_debit,
    gb.PERIOD_NET_CR AS period_credit,
    gb.PERIOD_NET_DR - gb.PERIOD_NET_CR AS period_net,
    (gb.BEGIN_BALANCE_DR - gb.BEGIN_BALANCE_CR) + (gb.PERIOD_NET_DR - gb.PERIOD_NET_CR) AS ytd_balance
FROM RAW.FUSION_GL_BALANCES_EXTRACT gb
JOIN RAW.FUSION_CODE_COMBINATIONS_EXTRACT cc ON gb.CODE_COMBINATION_ID = cc.CODE_COMBINATION_ID
WHERE gb.ACTUAL_FLAG = 'A';
```

**Reconciliation check:**
```sql
-- GL Balances YTD must equal sum of all journal entries
SELECT
    SUM(PERIOD_NET_DR - PERIOD_NET_CR) AS gl_balance_total
FROM RAW.FUSION_GL_BALANCES_EXTRACT
WHERE ACTUAL_FLAG = 'A';

-- vs journal line totals
SELECT
    SUM(GL_JE_LINES_ACCOUNTED_DR - GL_JE_LINES_ACCOUNTED_CR) AS journal_total
FROM RAW.FUSION_GL_JOURNAL_HEADERS_EXTRACT h
JOIN RAW.FUSION_GL_JOURNAL_LINES_EXTRACT l ON h.JE_HEADER_ID = l.JE_HEADER_ID
WHERE h.GL_JE_HEADERS_ACTUAL_FLAG = 'A';
-- Both must be equal
```

---

## Decision 6: Identifies cancellable commitments

**Metric:** Open POs with zero receipts (cancellable)

```sql
-- Source: PO Header + Distribution + Receipt
SELECT
    po.SEGMENT1 AS po_number,
    po.DOCUMENT_STATUS,
    po.VENDOR_ID,
    dist.AMOUNT_ORDERED,
    dist.ENCUMBERED_AMOUNT,
    dist.CODE_COMBINATION_ID,
    COALESCE(rcv.received_total, 0) AS received_amount,
    CASE WHEN COALESCE(rcv.received_total, 0) = 0 THEN 'CANCELLABLE'
         ELSE 'PARTIALLY_RECEIVED' END AS cancellation_status
FROM RAW.FUSION_PO_HEADERS_EXTRACT po
JOIN RAW.FUSION_PO_DISTRIBUTIONS_EXTRACT dist ON po.PO_HEADER_ID = dist.PO_HEADER_ID
LEFT JOIN (
    SELECT PO_DISTRIBUTION_ID, SUM(AMOUNT) AS received_total
    FROM RAW.FUSION_RECEIPT_TRANSACTIONS_EXTRACT
    WHERE TRANSACTION_TYPE = 'RECEIVE'
    GROUP BY PO_DISTRIBUTION_ID
) rcv ON dist.PO_DISTRIBUTION_ID = rcv.PO_DISTRIBUTION_ID
WHERE po.DOCUMENT_STATUS = 'OPEN';
```

**Reconciliation check:**
```sql
-- Total cancellable = SUM(ordered) WHERE received = 0
SELECT
    SUM(CASE WHEN COALESCE(rcv.received_total, 0) = 0 THEN dist.AMOUNT_ORDERED ELSE 0 END) AS cancellable_amount,
    SUM(CASE WHEN COALESCE(rcv.received_total, 0) > 0 THEN dist.AMOUNT_ORDERED ELSE 0 END) AS non_cancellable_amount
FROM RAW.FUSION_PO_HEADERS_EXTRACT po
JOIN RAW.FUSION_PO_DISTRIBUTIONS_EXTRACT dist ON po.PO_HEADER_ID = dist.PO_HEADER_ID
LEFT JOIN (
    SELECT PO_DISTRIBUTION_ID, SUM(AMOUNT) AS received_total
    FROM RAW.FUSION_RECEIPT_TRANSACTIONS_EXTRACT
    WHERE TRANSACTION_TYPE = 'RECEIVE'
    GROUP BY PO_DISTRIBUTION_ID
) rcv ON dist.PO_DISTRIBUTION_ID = rcv.PO_DISTRIBUTION_ID
WHERE po.DOCUMENT_STATUS = 'OPEN';
```

---

## Decision 7: Distinguishes sunk vs avoidable spend

**Metric:** Received amounts per PO distribution

```sql
-- Source: ReceiptTransactionExtractPVO
SELECT
    r.PO_DISTRIBUTION_ID,
    r.TRANSACTION_DATE AS receipt_date,
    SUM(r.AMOUNT) AS received_amount,
    d.AMOUNT_ORDERED,
    d.AMOUNT_ORDERED - SUM(r.AMOUNT) AS avoidable_remainder
FROM RAW.FUSION_RECEIPT_TRANSACTIONS_EXTRACT r
JOIN RAW.FUSION_PO_DISTRIBUTIONS_EXTRACT d ON r.PO_DISTRIBUTION_ID = d.PO_DISTRIBUTION_ID
WHERE r.TRANSACTION_TYPE = 'RECEIVE'
GROUP BY r.PO_DISTRIBUTION_ID, r.TRANSACTION_DATE, d.AMOUNT_ORDERED;
```

**Reconciliation check:**
```sql
-- Sunk (received) + Avoidable (not received) must equal total open PO amount
SELECT
    SUM(CASE WHEN rcv.received > 0 THEN LEAST(d.AMOUNT_ORDERED, rcv.received) ELSE 0 END) AS sunk_cost,
    SUM(CASE WHEN rcv.received IS NULL THEN d.AMOUNT_ORDERED
             ELSE GREATEST(d.AMOUNT_ORDERED - rcv.received, 0) END) AS avoidable_cost
FROM RAW.FUSION_PO_DISTRIBUTIONS_EXTRACT d
LEFT JOIN (
    SELECT PO_DISTRIBUTION_ID, SUM(AMOUNT) AS received
    FROM RAW.FUSION_RECEIPT_TRANSACTIONS_EXTRACT WHERE TRANSACTION_TYPE = 'RECEIVE'
    GROUP BY PO_DISTRIBUTION_ID
) rcv ON d.PO_DISTRIBUTION_ID = rcv.PO_DISTRIBUTION_ID;
```

---

## Decision 8: Shows near-term budget pressure

**Metric:** Unpaid invoices with due dates in next 30 days

```sql
-- Source: InvoiceHeaderExtractPVO + InvoiceDistributionExtractPVO
SELECT
    inv.INVOICE_NUM,
    inv.VENDOR_ID,
    inv.INVOICE_AMOUNT,
    inv.DUE_DATE,
    inv.PAYMENT_STATUS_FLAG,
    inv.HOLD_REASON,
    DATEDIFF('day', CURRENT_DATE, inv.DUE_DATE) AS days_until_due,
    dist.CODE_COMBINATION_ID,
    cc.SEGMENT2 AS department_code
FROM RAW.FUSION_AP_INVOICE_HEADERS_EXTRACT inv
JOIN RAW.FUSION_AP_INVOICE_DISTRIBUTIONS_EXTRACT dist ON inv.INVOICE_ID = dist.INVOICE_ID
JOIN RAW.FUSION_CODE_COMBINATIONS_EXTRACT cc ON dist.CODE_COMBINATION_ID = cc.CODE_COMBINATION_ID
WHERE inv.PAYMENT_STATUS_FLAG != 'Y'  -- Not yet paid
  AND inv.DUE_DATE BETWEEN CURRENT_DATE AND DATEADD('day', 30, CURRENT_DATE);
```

**Reconciliation check:**
```sql
-- Total upcoming pressure
SELECT
    COUNT(*) AS invoice_count,
    SUM(INVOICE_AMOUNT) AS total_pressure,
    SUM(CASE WHEN HOLD_REASON IS NOT NULL THEN INVOICE_AMOUNT ELSE 0 END) AS on_hold_amount
FROM RAW.FUSION_AP_INVOICE_HEADERS_EXTRACT
WHERE PAYMENT_STATUS_FLAG != 'Y'
  AND DUE_DATE BETWEEN CURRENT_DATE AND DATEADD('day', 30, CURRENT_DATE);
```

---

## Decision 9: Identifies true cash outflow timing

**Metric:** Payment dates and cleared status

```sql
-- Source: PaymentExtractPVO
SELECT
    p.CHECK_NUMBER AS payment_number,
    p.CHECK_DATE AS payment_date,
    p.AMOUNT AS payment_amount,
    p.STATUS_CODE,  -- NEGOTIABLE, CLEARED, VOIDED
    inv.INVOICE_NUM,
    inv.INVOICE_DATE,
    DATEDIFF('day', inv.INVOICE_DATE, p.CHECK_DATE) AS days_invoice_to_payment
FROM RAW.FUSION_AP_PAYMENTS_EXTRACT p
JOIN RAW.FUSION_AP_INVOICE_HEADERS_EXTRACT inv ON p.INVOICE_ID = inv.INVOICE_ID
WHERE p.STATUS_CODE = 'CLEARED';
```

**Reconciliation check:**
```sql
-- Total cleared payments must equal total paid in procurement lifecycle
SELECT SUM(AMOUNT) AS total_cash_out
FROM RAW.FUSION_AP_PAYMENTS_EXTRACT
WHERE STATUS_CODE = 'CLEARED';
-- Must match: SELECT SUM(paid_amount) FROM fct_procurement_lifecycle
```

---

## Decision 10: Distinguishes commitment vs obligation vs expenditure

**Metric:** Encumbrance journal entries by type

```sql
-- Source: JournalHeader + JournalLine (ActualFlag = 'E')
SELECT
    h.JOURNAL_ENCUMBRANCE_TL_ENCUMBRANCE_TYPE AS encumbrance_type,
    cc.SEGMENT2 AS department_code,
    cc.SEGMENT3 AS account_code,
    SUM(l.GL_JE_LINES_ACCOUNTED_DR - l.GL_JE_LINES_ACCOUNTED_CR) AS encumbrance_amount
FROM RAW.FUSION_GL_JOURNAL_HEADERS_EXTRACT h
JOIN RAW.FUSION_GL_JOURNAL_LINES_EXTRACT l ON h.JE_HEADER_ID = l.JE_HEADER_ID
JOIN RAW.FUSION_CODE_COMBINATIONS_EXTRACT cc ON l.GL_JE_LINES_CODE_COMBINATION_ID = cc.CODE_COMBINATION_ID
WHERE h.GL_JE_HEADERS_ACTUAL_FLAG = 'E'
GROUP BY h.JOURNAL_ENCUMBRANCE_TL_ENCUMBRANCE_TYPE, cc.SEGMENT2, cc.SEGMENT3;
```

**Reconciliation check:**
```sql
-- Commitment + Obligation + Expenditure from encumbrance journals
-- must equal BC balance consumed amounts
SELECT
    SUM(CASE WHEN JOURNAL_ENCUMBRANCE_TL_ENCUMBRANCE_TYPE = 'Commitment'
             THEN l.GL_JE_LINES_ACCOUNTED_DR - l.GL_JE_LINES_ACCOUNTED_CR ELSE 0 END) AS commitments,
    SUM(CASE WHEN JOURNAL_ENCUMBRANCE_TL_ENCUMBRANCE_TYPE = 'Obligation'
             THEN l.GL_JE_LINES_ACCOUNTED_DR - l.GL_JE_LINES_ACCOUNTED_CR ELSE 0 END) AS obligations
FROM RAW.FUSION_GL_JOURNAL_HEADERS_EXTRACT h
JOIN RAW.FUSION_GL_JOURNAL_LINES_EXTRACT l ON h.JE_HEADER_ID = l.JE_HEADER_ID
WHERE h.GL_JE_HEADERS_ACTUAL_FLAG = 'E';
-- commitments must match BC.COMMITMENT_AMOUNT; obligations must match BC.OBLIGATION_AMOUNT
```

---

## Decision 11: Enables delay/stop capital decisions

**Metric:** Capital project status with spend-to-date and remaining budget

```sql
-- Source: ProjectExtractPVO + GL/BC filtered by project segment
SELECT
    p.PROJECT_NUMBER,
    p.PROJECT_NAME,
    p.PROJECT_TYPE_CODE,
    p.PROJECT_STATUS_CODE,
    p.TOTAL_BUDGET_AMOUNT,
    p.START_DATE,
    p.COMPLETION_DATE,
    COALESCE(spent.total_spent, 0) AS amount_spent,
    p.TOTAL_BUDGET_AMOUNT - COALESCE(spent.total_spent, 0) AS remaining_budget,
    CASE WHEN p.PROJECT_STATUS_CODE = 'ACTIVE'
              AND COALESCE(spent.total_spent, 0) / NULLIF(p.TOTAL_BUDGET_AMOUNT, 0) < 0.5
         THEN 'PAUSABLE'
         ELSE 'NOT_PAUSABLE' END AS pause_eligibility
FROM RAW.FUSION_PROJECT_EXTRACT p
LEFT JOIN (
    SELECT cc.SEGMENT5 AS project_code, SUM(l.GL_JE_LINES_ACCOUNTED_DR - l.GL_JE_LINES_ACCOUNTED_CR) AS total_spent
    FROM RAW.FUSION_GL_JOURNAL_HEADERS_EXTRACT h
    JOIN RAW.FUSION_GL_JOURNAL_LINES_EXTRACT l ON h.JE_HEADER_ID = l.JE_HEADER_ID
    JOIN RAW.FUSION_CODE_COMBINATIONS_EXTRACT cc ON l.GL_JE_LINES_CODE_COMBINATION_ID = cc.CODE_COMBINATION_ID
    WHERE h.GL_JE_HEADERS_ACTUAL_FLAG = 'A'
    GROUP BY cc.SEGMENT5
) spent ON p.PROJECT_NUMBER = spent.project_code
WHERE p.PROJECT_TYPE_CODE = 'CAPITAL';
```

---

## Decision 12: Prevents cutting restricted external funding

**Metric:** Grant awards with restriction status and remaining balance

```sql
-- Source: GrantAwardExtractPVO
SELECT
    g.AWARD_ID,
    g.SPONSOR_AWARD_NUMBER,
    g.AWARD_NAME,
    g.AWARD_STATUS,
    g.SPONSOR_NAME,
    g.TOTAL_AWARD_AMOUNT,
    g.START_DATE,
    g.END_DATE,
    DATEDIFF('day', CURRENT_DATE, g.END_DATE) AS days_remaining,
    TRUE AS is_restricted  -- All grants are restricted by definition
FROM RAW.FUSION_GRANT_AWARDS_EXTRACT g
WHERE g.AWARD_STATUS = 'ACTIVE';
```

---

## Decision 13: Supports restrictions, match requirements

**Metric:** Grant funding sources with match obligations

```sql
-- Source: GrantFundingSourceExtractPVO
SELECT
    g.AWARD_ID,
    g.AWARD_NAME,
    fs.MATCH_REQUIRED,
    fs.MATCH_PERCENTAGE,
    g.TOTAL_AWARD_AMOUNT,
    g.TOTAL_AWARD_AMOUNT * (fs.MATCH_PERCENTAGE / 100.0) AS required_match_amount
FROM RAW.FUSION_GRANT_AWARDS_EXTRACT g
JOIN RAW.FUSION_GRANT_FUNDING_SOURCES_EXTRACT fs ON g.AWARD_ID = fs.AWARD_ID
WHERE fs.MATCH_REQUIRED = 'Y';
```

---

## Decision 14: Identifies must-spend or at-risk funds

**Metric:** Grants expiring within 6 months with unspent balances

```sql
-- Derived: GL/BC filtered by grant segment + grant end dates
SELECT
    g.AWARD_NAME,
    g.SPONSOR_NAME,
    g.END_DATE,
    DATEDIFF('day', CURRENT_DATE, g.END_DATE) AS days_remaining,
    g.TOTAL_AWARD_AMOUNT,
    COALESCE(spent.grant_spent, 0) AS amount_spent,
    g.TOTAL_AWARD_AMOUNT - COALESCE(spent.grant_spent, 0) AS unspent_balance,
    CASE WHEN DATEDIFF('day', CURRENT_DATE, g.END_DATE) <= 180
              AND (g.TOTAL_AWARD_AMOUNT - COALESCE(spent.grant_spent, 0)) > 0
         THEN 'AT_RISK' ELSE 'OK' END AS risk_status
FROM RAW.FUSION_GRANT_AWARDS_EXTRACT g
LEFT JOIN (
    SELECT cc.SEGMENT6 AS grant_code, SUM(l.GL_JE_LINES_ACCOUNTED_DR - l.GL_JE_LINES_ACCOUNTED_CR) AS grant_spent
    FROM RAW.FUSION_GL_JOURNAL_HEADERS_EXTRACT h
    JOIN RAW.FUSION_GL_JOURNAL_LINES_EXTRACT l ON h.JE_HEADER_ID = l.JE_HEADER_ID
    JOIN RAW.FUSION_CODE_COMBINATIONS_EXTRACT cc ON l.GL_JE_LINES_CODE_COMBINATION_ID = cc.CODE_COMBINATION_ID
    WHERE h.GL_JE_HEADERS_ACTUAL_FLAG = 'A' AND cc.SEGMENT6 IS NOT NULL
    GROUP BY cc.SEGMENT6
) spent ON g.AWARD_ID = spent.grant_code
WHERE g.AWARD_STATUS = 'ACTIVE'
  AND DATEDIFF('day', CURRENT_DATE, g.END_DATE) <= 180;
```

---

## Decision 15: Ensures consistent rollups

**Metric:** COA segment value hierarchies

```sql
-- Source: ChartOfAccountsSegmentValueExtractPVO
SELECT
    sv.FLEX_VALUE AS segment_code,
    sv.DESCRIPTION AS segment_description,
    sv.PARENT_FLEX_VALUE AS parent_code,
    sv.HIERARCHY_LEVEL,
    sv.VALUE_SET_NAME,  -- identifies which segment (Fund, Dept, Account, Program)
    sv.ENABLED_FLAG,
    sv.START_DATE_ACTIVE,
    sv.END_DATE_ACTIVE
FROM RAW.FUSION_COA_SEGMENT_VALUES_EXTRACT sv
WHERE sv.ENABLED_FLAG = 'Y'
ORDER BY sv.VALUE_SET_NAME, sv.HIERARCHY_LEVEL, sv.FLEX_VALUE;
```

**Reconciliation check:**
```sql
-- Every parent must exist as a value
SELECT child.FLEX_VALUE, child.PARENT_FLEX_VALUE
FROM RAW.FUSION_COA_SEGMENT_VALUES_EXTRACT child
LEFT JOIN RAW.FUSION_COA_SEGMENT_VALUES_EXTRACT parent
    ON child.PARENT_FLEX_VALUE = parent.FLEX_VALUE
    AND child.VALUE_SET_NAME = parent.VALUE_SET_NAME
WHERE child.PARENT_FLEX_VALUE IS NOT NULL
  AND parent.FLEX_VALUE IS NULL;
-- Must return 0 rows (no orphan children)
```

---

## Decision 16: Provides authoritative accounting key

**Metric:** Code combination decode (CCID → 6 segments)

```sql
-- Source: CodeCombinationExtractPVO
SELECT
    cc.CODE_COMBINATION_ID,
    cc.SEGMENT1 AS fund_code,
    cc.SEGMENT2 AS department_code,
    cc.SEGMENT3 AS account_code,
    cc.SEGMENT4 AS program_code,
    cc.SEGMENT5 AS project_code,
    cc.SEGMENT6 AS grant_code,
    cc.CONCATENATED_SEGMENTS AS full_coa_string,
    cc.ENABLED_FLAG,
    cc.START_DATE_ACTIVE,
    cc.END_DATE_ACTIVE
FROM RAW.FUSION_CODE_COMBINATIONS_EXTRACT cc;
```

**Reconciliation check:**
```sql
-- Every CCID referenced in GL must exist in code combinations
SELECT DISTINCT l.GL_JE_LINES_CODE_COMBINATION_ID
FROM RAW.FUSION_GL_JOURNAL_LINES_EXTRACT l
LEFT JOIN RAW.FUSION_CODE_COMBINATIONS_EXTRACT cc
    ON l.GL_JE_LINES_CODE_COMBINATION_ID = cc.CODE_COMBINATION_ID
WHERE cc.CODE_COMBINATION_ID IS NULL;
-- Must return 0 rows
```

---

## Decision 17: Supports vendor concentration analysis

**Metric:** Spend by vendor with diversity and locality flags

```sql
-- Source: SupplierExtractPVO + PO/Invoice spend
SELECT
    s.VENDOR_NAME,
    s.VENDOR_TYPE_CODE,
    CASE WHEN s.MINORITY_GROUP_CODE IS NOT NULL THEN TRUE ELSE FALSE END AS is_minority_owned,
    s.WOMAN_OWNED_FLAG = 'Y' AS is_woman_owned,
    s.SMALL_BUSINESS_FLAG = 'Y' AS is_small_business,
    site.STATE,
    site.CITY,
    COALESCE(spend.total_spend, 0) AS total_spend,
    COALESCE(spend.total_spend, 0) / NULLIF(SUM(COALESCE(spend.total_spend, 0)) OVER(), 0) * 100 AS pct_of_total
FROM RAW.FUSION_SUPPLIERS_EXTRACT s
LEFT JOIN RAW.FUSION_SUPPLIER_SITES_EXTRACT site ON s.VENDOR_ID = site.VENDOR_ID AND site.PAY_SITE_FLAG = 'Y'
LEFT JOIN (
    SELECT po.VENDOR_ID, SUM(dist.AMOUNT_ORDERED) AS total_spend
    FROM RAW.FUSION_PO_HEADERS_EXTRACT po
    JOIN RAW.FUSION_PO_DISTRIBUTIONS_EXTRACT dist ON po.PO_HEADER_ID = dist.PO_HEADER_ID
    GROUP BY po.VENDOR_ID
) spend ON s.VENDOR_ID = spend.VENDOR_ID
ORDER BY total_spend DESC;
```

---

## Decision 18: Identifies long-term obligations

**Metric:** Blanket/contract POs with remaining commitment

```sql
-- Source: PO Headers filtered by document type
SELECT
    po.SEGMENT1 AS po_number,
    po.DOCUMENT_TYPE,  -- BLANKET, CONTRACT
    po.DOCUMENT_STATUS,
    po.TOTAL_AMOUNT,
    po.CREATION_DATE,
    po.CLOSED_DATE,
    COALESCE(released.total_released, 0) AS amount_released,
    po.TOTAL_AMOUNT - COALESCE(released.total_released, 0) AS remaining_obligation
FROM RAW.FUSION_PO_HEADERS_EXTRACT po
LEFT JOIN (
    SELECT BPA_HEADER_ID, SUM(AMOUNT_ORDERED) AS total_released
    FROM RAW.FUSION_PO_DISTRIBUTIONS_EXTRACT
    WHERE BPA_HEADER_ID IS NOT NULL
    GROUP BY BPA_HEADER_ID
) released ON po.PO_HEADER_ID = released.BPA_HEADER_ID
WHERE po.DOCUMENT_TYPE IN ('BLANKET', 'CONTRACT')
  AND po.DOCUMENT_STATUS = 'OPEN';
```

---

## Decision 19: Defines where labor savings can exist

**Metric:** Vacant positions with salary cost

```sql
-- Source: Amorphic POSITION_DIM + POSITION_PLAN
SELECT
    p.POSITION_ID,
    p.POSITION_TITLE,
    p.DEPARTMENT_CODE,
    p.AUTHORIZED_FTE,
    pp.FILLED_FTE,
    p.AUTHORIZED_FTE - COALESCE(pp.FILLED_FTE, 0) AS vacant_fte,
    j.GRADE,
    j.PAY_TYPE,
    j.IS_OVERTIME_ELIGIBLE,
    p.BARGAINING_UNIT,
    -- Estimated annual salary for vacant positions
    CASE WHEN (p.AUTHORIZED_FTE - COALESCE(pp.FILLED_FTE, 0)) > 0
         THEN (p.AUTHORIZED_FTE - COALESCE(pp.FILLED_FTE, 0)) * j.MIDPOINT_SALARY
         ELSE 0 END AS vacancy_savings_potential
FROM AMORPHIC.POSITION_DIM p
LEFT JOIN AMORPHIC.POSITION_PLAN pp ON p.POSITION_ID = pp.POSITION_ID
LEFT JOIN AMORPHIC.JOB_DIM j ON p.JOB_CODE = j.JOB_CODE
WHERE (p.AUTHORIZED_FTE - COALESCE(pp.FILLED_FTE, 0)) > 0;
```

---

## Decision 20: Reconciles labor spend

**Metric:** Payroll actuals vs GL payroll postings

```sql
-- Source: Amorphic PAYROLL_ACTUALS
-- Payroll system total
SELECT
    pay_period_end_date,
    SUM(gross_amount) AS payroll_gross,
    SUM(employer_benefits) AS payroll_benefits,
    SUM(employer_taxes) AS payroll_taxes,
    SUM(gross_amount + employer_benefits + employer_taxes) AS total_employer_cost
FROM AMORPHIC.PAYROLL_ACTUALS
GROUP BY pay_period_end_date;
```

**Reconciliation check:**
```sql
-- GL payroll postings for same period
SELECT
    h.GL_JE_HEADERS_PERIOD_NAME,
    SUM(l.GL_JE_LINES_ACCOUNTED_DR - l.GL_JE_LINES_ACCOUNTED_CR) AS gl_payroll_total
FROM RAW.FUSION_GL_JOURNAL_HEADERS_EXTRACT h
JOIN RAW.FUSION_GL_JOURNAL_LINES_EXTRACT l ON h.JE_HEADER_ID = l.JE_HEADER_ID
WHERE h.GL_JE_HEADERS_JE_SOURCE = 'Payroll'
  AND h.GL_JE_HEADERS_ACTUAL_FLAG = 'A'
GROUP BY h.GL_JE_HEADERS_PERIOD_NAME;
-- payroll_gross + payroll_benefits + payroll_taxes MUST equal gl_payroll_total per period
```

---

## Decision 21: Enables hiring freeze and cut scenarios

**Metric:** Scenario actions modeling freeze/cut impacts

```sql
-- Source: Amorphic SCENARIO_ACTIONS + PAYROLL_FORECAST
SELECT
    sa.SCENARIO_ID,
    sh.SCENARIO_NAME,
    sa.ACTION_TYPE,       -- FreezeHire, CancelPO, ReduceOT, etc.
    sa.DEPARTMENT_CODE,
    sa.ACCOUNT_CODE,
    sa.POSITION_ID,
    sa.FISCAL_YEAR,
    sa.BASELINE_AMOUNT,
    sa.ACTION_AMOUNT,     -- Negative = savings
    sa.BASELINE_AMOUNT + sa.ACTION_AMOUNT AS forecast_amount,
    sa.RATIONALE
FROM AMORPHIC.SCENARIO_ACTIONS sa
JOIN AMORPHIC.SCENARIO_HEADER sh ON sa.SCENARIO_ID = sh.SCENARIO_ID
WHERE sa.ACTION_TYPE = 'FreezeHire';
```

**Reconciliation check:**
```sql
-- Total scenario savings must equal sum of action_amounts
SELECT
    sh.SCENARIO_NAME,
    SUM(sa.ACTION_AMOUNT) AS total_savings,
    SUM(sa.BASELINE_AMOUNT) AS total_baseline,
    SUM(sa.BASELINE_AMOUNT + sa.ACTION_AMOUNT) AS total_forecast
FROM AMORPHIC.SCENARIO_ACTIONS sa
JOIN AMORPHIC.SCENARIO_HEADER sh ON sa.SCENARIO_ID = sh.SCENARIO_ID
GROUP BY sh.SCENARIO_NAME;
```

---

## Decision 22: Enables exec-level rollups

**Metric:** Department hierarchy with executive ownership

```sql
-- Source: Amorphic ORG_HIERARCHY
SELECT
    oh.DEPARTMENT_CODE,
    oh.LEVEL_1_CODE, oh.LEVEL_1_DESCRIPTION,
    oh.LEVEL_2_CODE, oh.LEVEL_2_DESCRIPTION,
    oh.LEVEL_3_CODE, oh.LEVEL_3_DESCRIPTION,
    oh.LEVEL_4_CODE, oh.LEVEL_4_DESCRIPTION,
    oh.EXECUTIVE_OWNER,
    oh.DIVISION_NAME,
    oh.SERVICE_AREA,
    oh.HIERARCHY_PATH
FROM AMORPHIC.ORG_HIERARCHY oh;
```

**Reconciliation check:**
```sql
-- Every department in GL must exist in org hierarchy
SELECT DISTINCT cc.SEGMENT2 AS department_code
FROM RAW.FUSION_CODE_COMBINATIONS_EXTRACT cc
LEFT JOIN AMORPHIC.ORG_HIERARCHY oh ON cc.SEGMENT2 = oh.DEPARTMENT_CODE
WHERE oh.DEPARTMENT_CODE IS NULL AND cc.SEGMENT2 IS NOT NULL;
-- Must return 0 rows
```

---

## Decision 23: Prevents unrealistic cuts

**Metric:** Account cuttability flags and floor percentages

```sql
-- Source: Amorphic ACCOUNT_ROLLUPS + REDUCTION_LEVERS
SELECT
    ar.ACCOUNT_CODE,
    ar.ACCOUNT_CLASS,       -- Personnel/Operating/Capital
    ar.ACCOUNT_CATEGORY,    -- Salaries/Benefits/Supplies
    ar.IS_DISCRETIONARY,
    ar.IS_CUTTABLE,
    ar.IS_CONTRACTUAL,
    rl.MINIMUM_SPEND_FLOOR_PCT,
    rl.MAXIMUM_CUT_PCT,
    -- Calculate max allowable cut
    budget.current_budget * (rl.MAXIMUM_CUT_PCT / 100.0) AS max_cut_amount,
    budget.current_budget * (1 - rl.MINIMUM_SPEND_FLOOR_PCT / 100.0) AS max_reduction_to_floor
FROM AMORPHIC.ACCOUNT_ROLLUPS ar
LEFT JOIN AMORPHIC.REDUCTION_LEVERS rl ON ar.ACCOUNT_CODE = rl.ACCOUNT_CODE
LEFT JOIN (
    SELECT SEGMENT3 AS account_code, SUM(GL_BUD_BAL_PERIOD_NET_DR - GL_BUD_BAL_PERIOD_NET_CR) AS current_budget
    FROM RAW.FUSION_BUDGET_BALANCE_EXTRACT
    GROUP BY SEGMENT3
) budget ON ar.ACCOUNT_CODE = budget.account_code
WHERE ar.IS_CUTTABLE = TRUE;
```

---

## Decision 24: Makes decisions defensible

**Metric:** Program-to-service mapping with mandate status

```sql
-- Source: Amorphic PROGRAM_SERVICE_MAP
SELECT
    psm.PROGRAM_CODE,
    psm.SERVICE_LABEL,
    psm.STRATEGIC_PRIORITY,
    psm.IS_MANDATED,
    budget.program_budget,
    CASE WHEN psm.IS_MANDATED = TRUE THEN 'CANNOT_CUT'
         WHEN psm.STRATEGIC_PRIORITY = 'High' THEN 'CUT_WITH_JUSTIFICATION'
         ELSE 'DISCRETIONARY' END AS cut_classification
FROM AMORPHIC.PROGRAM_SERVICE_MAP psm
LEFT JOIN (
    SELECT SEGMENT4 AS program_code, SUM(GL_BUD_BAL_PERIOD_NET_DR - GL_BUD_BAL_PERIOD_NET_CR) AS program_budget
    FROM RAW.FUSION_BUDGET_BALANCE_EXTRACT
    GROUP BY SEGMENT4
) budget ON psm.PROGRAM_CODE = budget.program_code;
```

---

## Decision 25: Establishes trust in numbers

**Metric:** Reconciliation control checks

```sql
-- Source: Amorphic RECONCILIATION_CONTROLS (derived)
-- Check 1: Payroll-to-GL variance
SELECT
    'Payroll-to-GL' AS check_name,
    payroll.total AS payroll_total,
    gl.total AS gl_total,
    payroll.total - gl.total AS variance,
    CASE WHEN ABS(payroll.total - gl.total) < 1 THEN 'PASS' ELSE 'FAIL' END AS status
FROM (SELECT SUM(gross_amount + employer_benefits + employer_taxes) AS total FROM AMORPHIC.PAYROLL_ACTUALS) payroll,
     (SELECT SUM(GL_JE_LINES_ACCOUNTED_DR - GL_JE_LINES_ACCOUNTED_CR) AS total
      FROM RAW.FUSION_GL_JOURNAL_HEADERS_EXTRACT h
      JOIN RAW.FUSION_GL_JOURNAL_LINES_EXTRACT l ON h.JE_HEADER_ID = l.JE_HEADER_ID
      WHERE h.GL_JE_HEADERS_JE_SOURCE = 'Payroll' AND h.GL_JE_HEADERS_ACTUAL_FLAG = 'A') gl

UNION ALL

-- Check 2: BC balance integrity
SELECT
    'BC-Balance-Integrity' AS check_name,
    SUM(BUDGET_AMOUNT) AS budget_total,
    SUM(FUNDS_AVAILABLE_AMOUNT + COMMITMENT_AMOUNT + OBLIGATION_AMOUNT + ACTUAL_AMOUNT) AS reconstructed,
    SUM(BUDGET_AMOUNT) - SUM(FUNDS_AVAILABLE_AMOUNT + COMMITMENT_AMOUNT + OBLIGATION_AMOUNT + ACTUAL_AMOUNT) AS variance,
    CASE WHEN ABS(SUM(BUDGET_AMOUNT) - SUM(FUNDS_AVAILABLE_AMOUNT + COMMITMENT_AMOUNT + OBLIGATION_AMOUNT + ACTUAL_AMOUNT)) < 1
         THEN 'PASS' ELSE 'FAIL' END AS status
FROM RAW.FUSION_BC_BALANCE_EXTRACT;
```

---

## Decision 26: Enables repeatable what-if runs

**Metric:** Scenario metadata and parameters

```sql
-- Source: Amorphic SCENARIO_HEADER
SELECT
    sh.SCENARIO_ID,
    sh.SCENARIO_NAME,
    sh.SCENARIO_TYPE,       -- Baseline/Optimistic/Pessimistic
    sh.OWNER,
    sh.BASELINE_FISCAL_YEAR,
    sh.DEFAULT_INFLATION_PCT,
    sh.IS_APPROVED,
    sh.IS_BASELINE,
    sh.CREATED_AT,
    COUNT(sa.SCENARIO_ACTION_ID) AS action_count,
    SUM(sa.ACTION_AMOUNT) AS total_impact
FROM AMORPHIC.SCENARIO_HEADER sh
LEFT JOIN AMORPHIC.SCENARIO_ACTIONS sa ON sh.SCENARIO_ID = sa.SCENARIO_ID
GROUP BY sh.SCENARIO_ID, sh.SCENARIO_NAME, sh.SCENARIO_TYPE, sh.OWNER,
         sh.BASELINE_FISCAL_YEAR, sh.DEFAULT_INFLATION_PCT, sh.IS_APPROVED,
         sh.IS_BASELINE, sh.CREATED_AT;
```

---

## Decision 27: Connects executive decisions to forecast deltas

**Metric:** Scenario action lines with cumulative impact

```sql
-- Source: Amorphic SCENARIO_ACTIONS
SELECT
    sh.SCENARIO_NAME,
    sa.ACTION_TYPE,
    sa.TARGET_TYPE,         -- LABOR / NON_LABOR / CAPITAL
    sa.DEPARTMENT_CODE,
    sa.ACCOUNT_CODE,
    sa.FISCAL_YEAR,
    sa.BASELINE_AMOUNT,
    sa.ACTION_AMOUNT,
    sa.BASELINE_AMOUNT + sa.ACTION_AMOUNT AS forecast_amount,
    SUM(sa.ACTION_AMOUNT) OVER (
        PARTITION BY sa.SCENARIO_ID
        ORDER BY sa.DEPARTMENT_CODE, sa.ACCOUNT_CODE
    ) AS cumulative_savings,
    sa.IS_CONSTRAINED,
    sa.RATIONALE
FROM AMORPHIC.SCENARIO_ACTIONS sa
JOIN AMORPHIC.SCENARIO_HEADER sh ON sa.SCENARIO_ID = sh.SCENARIO_ID
ORDER BY sh.SCENARIO_NAME, sa.DEPARTMENT_CODE, sa.ACCOUNT_CODE;
```

**Reconciliation check:**
```sql
-- Forecast = Baseline + Action for every line
SELECT COUNT(*) AS mismatched_rows
FROM AMORPHIC.SCENARIO_ACTIONS
WHERE ABS((BASELINE_AMOUNT + ACTION_AMOUNT) - FORECAST_AMOUNT) > 0.01;
-- Must return 0
```

---

## Decision 28: Provides auditable inflation drivers

**Metric:** CPI index values with year-over-year change

```sql
-- Source: Amorphic CPI_INDEX + ACCOUNT_INFLATION_MAP
SELECT
    cpi.SERIES_ID,          -- CPI-U, CPI-W, CPI-U Energy, etc.
    cpi.PERIOD_DATE,
    cpi.INDEX_VALUE,
    cpi.YOY_PCT,            -- Year-over-year percentage change
    aim.ACCOUNT_CODE,
    aim.INFLATION_INDEX_TYPE,
    aim.DEFAULT_ESCALATION_PCT,
    -- Applied forecast: prior year actual × (1 + escalation)
    budget.prior_year_actual * (1 + COALESCE(cpi.YOY_PCT, aim.DEFAULT_ESCALATION_PCT) / 100.0) AS forecast_amount
FROM AMORPHIC.CPI_INDEX cpi
JOIN AMORPHIC.ACCOUNT_INFLATION_MAP aim ON cpi.SERIES_ID = aim.INFLATION_INDEX_TYPE
LEFT JOIN (
    SELECT cc.SEGMENT3 AS account_code,
           SUM(l.GL_JE_LINES_ACCOUNTED_DR - l.GL_JE_LINES_ACCOUNTED_CR) AS prior_year_actual
    FROM RAW.FUSION_GL_JOURNAL_HEADERS_EXTRACT h
    JOIN RAW.FUSION_GL_JOURNAL_LINES_EXTRACT l ON h.JE_HEADER_ID = l.JE_HEADER_ID
    JOIN RAW.FUSION_CODE_COMBINATIONS_EXTRACT cc ON l.GL_JE_LINES_CODE_COMBINATION_ID = cc.CODE_COMBINATION_ID
    WHERE h.GL_JE_HEADERS_ACTUAL_FLAG = 'A'
      AND h.GL_JE_HEADERS_PERIOD_NAME LIKE '%FY2024%'
    GROUP BY cc.SEGMENT3
) budget ON aim.ACCOUNT_CODE = budget.account_code
WHERE cpi.PERIOD_DATE = (SELECT MAX(PERIOD_DATE) FROM AMORPHIC.CPI_INDEX WHERE SERIES_ID = cpi.SERIES_ID);
```

---

## Master Reconciliation Summary Query

**Run this to validate all data flows are consistent:**

```sql
-- MASTER RECONCILIATION DASHBOARD
SELECT 'Budget Balance' AS check,
       (SELECT SUM(GL_BUD_BAL_PERIOD_NET_DR - GL_BUD_BAL_PERIOD_NET_CR) FROM RAW.FUSION_BUDGET_BALANCE_EXTRACT) AS source_total,
       (SELECT SUM(original_budget) FROM fct_budget_snapshot) AS warehouse_total,
       ABS((SELECT SUM(GL_BUD_BAL_PERIOD_NET_DR - GL_BUD_BAL_PERIOD_NET_CR) FROM RAW.FUSION_BUDGET_BALANCE_EXTRACT)
         - (SELECT SUM(original_budget) FROM fct_budget_snapshot)) AS variance

UNION ALL SELECT 'GL Actuals',
       (SELECT SUM(GL_JE_LINES_ACCOUNTED_DR - GL_JE_LINES_ACCOUNTED_CR)
        FROM RAW.FUSION_GL_JOURNAL_HEADERS_EXTRACT h
        JOIN RAW.FUSION_GL_JOURNAL_LINES_EXTRACT l ON h.JE_HEADER_ID = l.JE_HEADER_ID
        WHERE h.GL_JE_HEADERS_ACTUAL_FLAG = 'A'),
       (SELECT SUM(net_amount) FROM fct_gl_transaction WHERE actual_flag = 'A'),
       ABS((SELECT SUM(GL_JE_LINES_ACCOUNTED_DR - GL_JE_LINES_ACCOUNTED_CR)
            FROM RAW.FUSION_GL_JOURNAL_HEADERS_EXTRACT h
            JOIN RAW.FUSION_GL_JOURNAL_LINES_EXTRACT l ON h.JE_HEADER_ID = l.JE_HEADER_ID
            WHERE h.GL_JE_HEADERS_ACTUAL_FLAG = 'A')
         - (SELECT SUM(net_amount) FROM fct_gl_transaction WHERE actual_flag = 'A'))

UNION ALL SELECT 'PO Ordered',
       (SELECT SUM(AMOUNT_ORDERED) FROM RAW.FUSION_PO_DISTRIBUTIONS_EXTRACT),
       (SELECT SUM(ordered_amount) FROM fct_procurement_lifecycle),
       ABS((SELECT SUM(AMOUNT_ORDERED) FROM RAW.FUSION_PO_DISTRIBUTIONS_EXTRACT)
         - (SELECT SUM(ordered_amount) FROM fct_procurement_lifecycle))

UNION ALL SELECT 'Payments Cleared',
       (SELECT SUM(AMOUNT) FROM RAW.FUSION_AP_PAYMENTS_EXTRACT WHERE STATUS_CODE = 'CLEARED'),
       (SELECT SUM(paid_amount) FROM fct_procurement_lifecycle),
       ABS((SELECT SUM(AMOUNT) FROM RAW.FUSION_AP_PAYMENTS_EXTRACT WHERE STATUS_CODE = 'CLEARED')
         - (SELECT SUM(paid_amount) FROM fct_procurement_lifecycle))

UNION ALL SELECT 'Payroll',
       (SELECT SUM(gross_amount + employer_benefits + employer_taxes) FROM AMORPHIC.PAYROLL_ACTUALS),
       (SELECT SUM(total_employer_cost) FROM fct_labor_transaction),
       ABS((SELECT SUM(gross_amount + employer_benefits + employer_taxes) FROM AMORPHIC.PAYROLL_ACTUALS)
         - (SELECT SUM(total_employer_cost) FROM fct_labor_transaction));

-- ALL variances must be 0 (or < $1 for rounding)
```
