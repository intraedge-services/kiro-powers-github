# Power BI Drill-Through Enhancement — Blueprint

## Updated Relationship Map

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          POWER BI DATA MODEL                                     │
│                                                                                  │
│  ┌─────────────┐                                                                │
│  │ dim_period   │──(1:M)──┐                                                     │
│  │ period_key   │         │                                                      │
│  └─────────────┘         │                                                      │
│                           ▼                                                      │
│  ┌─────────────┐   ┌──────────────────────┐   ┌─────────────┐                  │
│  │  dim_coa    │──▶│ fact_budgetary_ctrl   │◀──│ dim_period   │                  │
│  │ coa_key     │   │ (coa_key, period_key) │   └─────────────┘                  │
│  │ ccid ●──────┼───┼──────────────────────┼────────────────────┐               │
│  └──────┬──────┘   └──────────────────────┘                    │               │
│         │                                                       │               │
│         │           ┌──────────────────────┐                    │               │
│         ├──(1:M)──▶│ fact_gl_actuals       │                    │               │
│         │           │ (coa_key, period_key, │                    │               │
│         │           │  supplier_key)        │                    │               │
│         │           └──────────────────────┘                    │               │
│         │                                                       │               │
│         │           ┌──────────────────────┐                    │               │
│         ├──(1:M)──▶│ fact_ap_invoices      │◀──┐               │               │
│         │           │ (coa_key, period_key, │   │               │               │
│         │           │  supplier_key,        │   │               │               │
│         │           │  po_header_id ●)      │   │               │               │
│         │           └───────────┬──────────┘   │               │               │
│         │                       │               │               │               │
│         │                       │ po_header_id  │               │               │
│         │                       ▼               │               │               │
│         │           ┌──────────────────────┐   │               │               │
│         └──(1:M)──▶│ fact_purchase_orders  │   │               │               │
│                     │ (coa_key, period_key, │   │               │               │
│                     │  supplier_key,        │   │               │               │
│                     │  po_header_id ●)      │   │               │               │
│                     └──────────────────────┘   │               │               │
│                                                 │               │               │
│  ┌─────────────┐                               │               │               │
│  │dim_supplier │──(1:M)─────────────────────────┘               │               │
│  │supplier_key │──(1:M)──▶ fact_gl_actuals                      │               │
│  │vendor_id    │──(1:M)──▶ fact_purchase_orders                 │               │
│  └─────────────┘                                                │               │
│                                                                  │               │
│  ┌─────────────────────────────────────────────────────────────┐│               │
│  │           SILVER LAYER (Drill-Through Only)                  ││               │
│  │                                                              ││               │
│  │  ┌────────────────────────┐  ┌─────────────────────────┐   ││               │
│  │  │ silver_ap_invoice_lines │  │ silver_po_distributions  │   ││               │
│  │  │ • invoice_id           │  │ • po_header_id           │   ││               │
│  │  │ • invoice_number       │  │ • po_number              │   ││               │
│  │  │ • line_description     │  │ • line_description       │   ││               │
│  │  │ • amount               │  │ • quantity               │   ││               │
│  │  │ • ccid ●───────────────┼──┼─────────────────────────┼───┘│               │
│  │  └────────────────────────┘  └─────────────────────────┘    │               │
│  └─────────────────────────────────────────────────────────────┘                │
│                                                                                  │
│  ● = Drill-through join key (CodeCombinationId / po_header_id)                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Relationship Definitions

| From Table | Join Key | To Table | Cardinality | Cross-Filter | Purpose |
|---|---|---|---|---|---|
| dim_coa | coa_key | fact_budgetary_control | 1:Many | Single | Budget by Fund/Dept/Account |
| dim_coa | coa_key | fact_gl_actuals | 1:Many | Single | Actuals by Fund/Dept/Account |
| dim_coa | coa_key | fact_ap_invoices | 1:Many | Single | AP by Fund/Dept/Account |
| dim_coa | coa_key | fact_purchase_orders | 1:Many | Single | PO by Fund/Dept/Account |
| dim_period | period_key | fact_budgetary_control | 1:Many | Single | Time analysis |
| dim_period | period_key | fact_gl_actuals | 1:Many | Single | Time analysis |
| dim_period | period_key | fact_ap_invoices | 1:Many | Single | Time analysis |
| dim_supplier | supplier_key | fact_gl_actuals | 1:Many | Single | Vendor spend |
| dim_supplier | supplier_key | fact_ap_invoices | 1:Many | Single | Vendor invoices |
| dim_supplier | supplier_key | fact_purchase_orders | 1:Many | Single | Vendor POs |
| fact_ap_invoices | po_header_id | fact_purchase_orders | Many:1 | Single | PO-to-Invoice match |

### Drill-Through Relationships (Silver Layer)

| From Table | Join Key | To Table | Cardinality | Cross-Filter | Purpose |
|---|---|---|---|---|---|
| fact_ap_invoices | invoice_id | silver_ap_invoice_lines | 1:Many | Single | Invoice line detail |
| fact_purchase_orders | po_header_id | silver_po_distributions | 1:Many | Single | PO line detail |
| dim_coa | code_combination_id | silver_ap_invoice_lines (ccid) | 1:Many | Single | CCID drill-through |
| dim_coa | code_combination_id | silver_po_distributions (ccid) | 1:Many | Single | CCID drill-through |

---

## Detail Page — Drill-Through Design

### Page Name: "Transaction Detail"

### Drill-Through Fields (Right-click triggers)
- `dim_coa[department_description]`
- `dim_coa[fund_description]`
- `fact_budgetary_control[coa_key]`

### Page Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  ← Back to Executive Summary                                         │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  HEADER: {Selected Department} — Transaction Detail           │   │
│  │  Fund: {fund_description} | Period: {period_name}             │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌─────────────────────────────────────────┐  ┌────────────────┐   │
│  │  KPI: Budget Remaining for this Dept     │  │ Status Badge   │   │
│  │  $XX.XM of $YY.YM (XX% consumed)        │  │ 🟢/🟡/🔴      │   │
│  └─────────────────────────────────────────┘  └────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  TABLE: Purchase Orders (from Silver Layer)                    │   │
│  │  ─────────────────────────────────────────────────────────── │   │
│  │  PO Number | Supplier | Description | Amount | Status         │   │
│  │  PO-2025-001 | Grainger | Safety Equipment | $45,200 | OPEN  │   │
│  │  PO-2025-003 | CDW Gov  | Network Switches | $128,500 | OPEN │   │
│  │  ...                                                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  TABLE: Invoices (from Silver Layer)                           │   │
│  │  ─────────────────────────────────────────────────────────── │   │
│  │  Invoice # | Supplier | Description | Amount | Paid | Status  │   │
│  │  INV-8821  | APS      | Mar Utilities | $12,400 | $12,400 | Y│   │
│  │  INV-9102  | SRP      | Apr Utilities | $8,900  | $0      | N│   │
│  │  ...                                                          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Conditional Formatting:                                             │
│  • Rows where (actual/budget > 0.85) → Red background              │
│  • Rows where PO status = OPEN and amount > $100K → Orange text     │
│  • Payment status N → Bold red "UNPAID"                             │
└─────────────────────────────────────────────────────────────────────┘
```

### DAX Measures for Detail Page

```dax
// Drill-through context measure
Selected Department Budget =
    CALCULATE(
        [Total Budget],
        ALLEXCEPT(dim_coa, dim_coa[department_description])
    )

Selected Department Burn Rate =
    DIVIDE(
        CALCULATE([Total Actual], ALLEXCEPT(dim_coa, dim_coa[department_description])),
        [Selected Department Budget],
        0
    )

Detail Status Badge =
    VAR BurnRate = [Selected Department Burn Rate]
    RETURN
        SWITCH(TRUE(),
            BurnRate >= 0.85, "🔴 OVER BUDGET RISK",
            BurnRate >= 0.70, "🟡 APPROACHING LIMIT",
            "🟢 ON TRACK"
        )
```

---

## Silver Layer Tables (Import for Drill-Through)

### silver_ap_invoice_lines

```sql
-- Import into Power BI via DirectQuery or scheduled refresh
SELECT
    invoice_id,
    invoice_number,
    line_number,
    line_description,
    line_amount,
    code_combination_id,
    po_header_id,
    creation_date
FROM silver.ap_invoice_lines
WHERE creation_date >= DATEADD(month, -12, CURRENT_DATE);
```

### silver_po_distributions

```sql
SELECT
    po_header_id,
    po_number,
    line_number,
    item_description,
    quantity_ordered,
    unit_price,
    amount,
    code_combination_id,
    closed_code
FROM silver.po_distributions
WHERE creation_date >= DATEADD(month, -12, CURRENT_DATE);
```

---

## Implementation Steps

1. **Add Silver tables** to Power BI model (DirectQuery recommended for freshness)
2. **Create relationships** from Silver tables to dim_coa via `code_combination_id`
3. **Create Detail page** → Set as Drill-Through page
4. **Add drill-through fields**: `department_description`, `fund_description`
5. **Add tables** with PO and Invoice data, filtered by drill-through context
6. **Apply conditional formatting** rules per the design above
7. **Test**: Click any department bar in Executive Summary → should navigate to Detail page
