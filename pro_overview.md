# 02 — PVO Deep Dive

## What is a PVO?

A **Public View Object (PVO)** is a structured view that sits on top of Oracle Fusion's base tables. It provides a governed, stable interface for data extraction — Oracle manages the underlying table changes, and the PVO interface stays consistent across upgrades.

```
Oracle Fusion Base Tables (internal, not directly accessible)
    GL_JE_HEADERS, GL_JE_LINES, GL_CODE_COMBINATIONS, ...
         ↓
    PVO (Public View Object)
    oracle.apps.financials.generalLedger.journals.publicView.JournalHeadersPVO
         ↓
    BICC Extract → CSV file
    JournalHeadersPVO.csv
```

## PVO Naming Convention

```
oracle.apps.<product_family>.<module>.<sub_module>.publicView.<ObjectName>PVO

Examples:
oracle.apps.financials.generalLedger.journals.publicView.JournalHeadersPVO
oracle.apps.hcm.workforce.person.publicView.PersonNamesPVO
oracle.apps.procurement.purchasing.orders.publicView.PurchaseOrderHeadersPVO
oracle.apps.scm.inventory.items.publicView.EgpSystemItemsPVO
```

## Extract PVO vs Non-Extract PVO

```
Extract PVO:
  ✅ Optimized for bulk extraction
  ✅ Uses efficient SQL with minimal joins
  ✅ Supports incremental extraction
  ✅ Recommended for data warehouse loads
  Example: JournalHeadersPVO, PersonNamesPVO

Non-Extract PVO:
  ⚠️  Runs complex queries in background
  ⚠️  Can be slow for large datasets
  ⚠️  May time out on large extracts
  ⚠️  Use only when no extract PVO available
  Example: Some CX and custom PVOs
```

## Key PVOs by Module

### Finance (ERP)

| PVO Name | Tables | Description |
|---|---|---|
| `JournalHeadersPVO` | GL_JE_HEADERS | Journal entry headers |
| `JournalLinesPVO` | GL_JE_LINES | Journal entry lines |
| `CodeCombinationsPVO` | GL_CODE_COMBINATIONS | Chart of accounts segments |
| `LedgersPVO` | GL_LEDGERS | Ledger definitions |
| `BalancesPVO` | GL_BALANCES | Account balances |
| `InvoiceHeadersPVO` | AP_INVOICES_ALL | AP invoice headers |
| `InvoiceLinesPVO` | AP_INVOICE_LINES_ALL | AP invoice lines |
| `InvoiceDistributionsPVO` | AP_INVOICE_DISTRIBUTIONS_ALL | AP distributions |
| `PaymentsPVO` | AP_CHECKS_ALL | AP payments |
| `ReceivableTransactionsPVO` | RA_CUSTOMER_TRX_ALL | AR transactions |
| `ReceivableLinesPVO` | RA_CUSTOMER_TRX_LINES_ALL | AR transaction lines |
| `CashReceiptsPVO` | AR_CASH_RECEIPTS_ALL | AR cash receipts |
| `BudgetLinesPVO` | XCC_BUDGET_LINES | Budget lines |
| `BudgetPeriodAmountsPVO` | XCC_BUDGET_PERIOD_AMOUNTS | Budget period amounts |

### HCM (Human Capital Management)

| PVO Name | Tables | Description |
|---|---|---|
| `PersonNamesPVO` | PER_PERSON_NAMES_F | Person names (date-tracked) |
| `PersonsPVO` | PER_ALL_PEOPLE_F | Person master |
| `WorkRelationshipsPVO` | PER_ALL_ASSIGNMENTS_M | Employment relationships |
| `AssignmentsPVO` | PER_ALL_ASSIGNMENTS_F | Assignment details |
| `SalaryBasisPVO` | PER_PAY_BASES | Salary basis |
| `SalaryDetailsPVO` | CMP_SALARY | Salary records |
| `PositionsPVO` | HR_ALL_POSITIONS_F | Position definitions |
| `JobsPVO` | PER_JOBS_F | Job definitions |
| `DepartmentsPVO` | HR_ALL_ORGANIZATION_UNITS_F | Departments/orgs |
| `LocationsPVO` | HR_LOCATIONS_ALL | Work locations |
| `PayrollRunResultsPVO` | PAY_RUN_RESULTS | Payroll run results |
| `PayrollElementEntriesPVO` | PAY_ELEMENT_ENTRIES_F | Element entries |
| `AbsencesPVO` | ANC_PER_ABS_ENTRIES | Absence records |

### Procurement

| PVO Name | Tables | Description |
|---|---|---|
| `PurchaseOrderHeadersPVO` | PO_HEADERS_ALL | PO headers |
| `PurchaseOrderLinesPVO` | PO_LINES_ALL | PO lines |
| `PurchaseOrderDistributionsPVO` | PO_DISTRIBUTIONS_ALL | PO distributions |
| `RequisitionHeadersPVO` | PO_REQUISITION_HEADERS_ALL | Requisition headers |
| `RequisitionLinesPVO` | PO_REQUISITION_LINES_ALL | Requisition lines |
| `SuppliersPVO` | AP_SUPPLIERS | Supplier master |
| `SupplierSitesPVO` | AP_SUPPLIER_SITES_ALL | Supplier sites |
| `ReceiptHeadersPVO` | RCV_SHIPMENT_HEADERS | Receipt headers |
| `ReceiptTransactionsPVO` | RCV_TRANSACTIONS | Receipt transactions |

### SCM (Supply Chain)

| PVO Name | Tables | Description |
|---|---|---|
| `EgpSystemItemsPVO` | EGP_SYSTEM_ITEMS_B | Item master |
| `EgpItemDescriptionsPVO` | EGP_SYSTEM_ITEMS_TL | Item descriptions (multilingual) |
| `InvOrganizationsPVO` | INV_ORG_PARAMETERS | Inventory organizations |
| `OnHandQuantitiesPVO` | MTL_ONHAND_QUANTITIES | Current inventory |
| `TransactionsPVO` | MTL_MATERIAL_TRANSACTIONS | Inventory transactions |

### Projects

| PVO Name | Tables | Description |
|---|---|---|
| `ProjectsPVO` | PA_PROJECTS_ALL | Project master |
| `TasksPVO` | PA_TASKS | Project tasks |
| `ExpenditureItemsPVO` | PA_EXPENDITURE_ITEMS_ALL | Project costs |
| `BudgetLinesPVO` | PA_BUDGET_LINES | Project budget |
| `AgreementsPVO` | PA_AGREEMENTS_ALL | Project agreements |

## PVO Output Structure

Each BICC extract produces a CSV with:
- All columns from the PVO
- A `LAST_UPDATE_DATE` column for incremental filtering
- A `EXTRACTION_DATE` metadata column added by BICC

Example `JournalHeadersPVO.csv`:
```
JE_HEADER_ID,LEDGER_ID,JE_CATEGORY,JE_SOURCE,PERIOD_NAME,STATUS,POSTED_DATE,LAST_UPDATE_DATE,EXTRACTION_DATE
1001,1,Accrual,Manual,JAN-24,P,2024-01-31,2024-01-31 10:23:45,2024-02-01 02:00:00
1002,1,Accrual,Payables,JAN-24,P,2024-01-31,2024-01-31 14:55:12,2024-02-01 02:00:00
```

## Incremental Extraction

BICC supports incremental extraction using `LAST_UPDATE_DATE`:

```
Full Extract (first run):
  → Extract ALL records from PVO
  → Store watermark: MAX(LAST_UPDATE_DATE)

Incremental Extract (subsequent runs):
  → Extract records WHERE LAST_UPDATE_DATE > watermark
  → Update watermark to new MAX(LAST_UPDATE_DATE)
```

**Important:** Incremental only captures updates to existing records. Hard deletes are NOT captured. Use soft-delete patterns or periodic full refreshes for delete detection.
