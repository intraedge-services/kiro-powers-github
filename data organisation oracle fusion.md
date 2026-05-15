# 04 — Fusion Data Structures

## How Oracle Fusion Organizes Data

### Multi-Org Architecture

```
Business Group (top level)
    └── Legal Entity (LE)
        └── Business Unit (BU)
            └── Ledger (GL)
                └── Operating Unit (OU)
                    └── Inventory Organization (INV)
```

Every transaction in Fusion is stamped with these org identifiers. When extracting data, always include these columns for proper filtering and joining.

### Date-Tracked Tables (Effective Dating)

Many Fusion tables are **date-tracked** — they store history by effective date range:

```sql
-- Example: Person Names table
SELECT *
FROM PER_PERSON_NAMES_F
WHERE PERSON_ID = 12345
  AND EFFECTIVE_START_DATE <= SYSDATE
  AND EFFECTIVE_END_DATE >= SYSDATE;
-- Returns the CURRENT name

-- To get all historical names:
SELECT * FROM PER_PERSON_NAMES_F WHERE PERSON_ID = 12345;
-- Returns multiple rows — one per name change
```

**In BICC extracts:** Date-tracked PVOs return ALL rows (all effective date ranges). You must filter to current records in your transformation layer.

```sql
-- dbt staging model — get current record only
SELECT *
FROM {{ source('fusion_raw', 'person_names_pvo') }}
WHERE EFFECTIVE_END_DATE = '4712-12-31'  -- Oracle's "forever" date
   OR EFFECTIVE_END_DATE >= CURRENT_DATE
```

### Translation Tables (_TL suffix)

Oracle stores multilingual text in separate `_TL` tables:

```
EGP_SYSTEM_ITEMS_B    → Base table (codes, IDs, numbers)
EGP_SYSTEM_ITEMS_TL   → Translation table (descriptions in each language)

Join: B.INVENTORY_ITEM_ID = TL.INVENTORY_ITEM_ID AND TL.LANGUAGE = 'US'
```

**In BICC:** The `EgpItemDescriptionsPVO` handles this join for you.

## Key Finance Data Relationships

```mermaid
erDiagram
    GL_LEDGERS {
        number LEDGER_ID PK
        varchar NAME
        varchar CURRENCY_CODE
        varchar PERIOD_SET_NAME
    }
    GL_CODE_COMBINATIONS {
        number CODE_COMBINATION_ID PK
        number CHART_OF_ACCOUNTS_ID
        varchar SEGMENT1
        varchar SEGMENT2
        varchar SEGMENT3
        varchar SEGMENT4
        varchar SEGMENT5
    }
    GL_JE_HEADERS {
        number JE_HEADER_ID PK
        number LEDGER_ID FK
        varchar JE_CATEGORY
        varchar JE_SOURCE
        varchar PERIOD_NAME
        varchar STATUS
        date POSTED_DATE
    }
    GL_JE_LINES {
        number JE_HEADER_ID FK
        number JE_LINE_NUM
        number CODE_COMBINATION_ID FK
        number ENTERED_DR
        number ENTERED_CR
        number ACCOUNTED_DR
        number ACCOUNTED_CR
    }
    AP_INVOICES_ALL {
        number INVOICE_ID PK
        number VENDOR_ID FK
        number LEDGER_ID FK
        varchar INVOICE_NUM
        number INVOICE_AMOUNT
        date INVOICE_DATE
        varchar PAYMENT_STATUS_FLAG
    }
    AP_INVOICE_LINES_ALL {
        number INVOICE_ID FK
        number LINE_NUMBER
        number AMOUNT
        varchar LINE_TYPE_LOOKUP_CODE
    }
    AP_SUPPLIERS {
        number VENDOR_ID PK
        varchar VENDOR_NAME
        varchar VENDOR_TYPE_LOOKUP_CODE
    }

    GL_LEDGERS ||--o{ GL_JE_HEADERS : "has"
    GL_JE_HEADERS ||--o{ GL_JE_LINES : "has"
    GL_JE_LINES }o--|| GL_CODE_COMBINATIONS : "uses"
    AP_SUPPLIERS ||--o{ AP_INVOICES_ALL : "has"
    AP_INVOICES_ALL ||--o{ AP_INVOICE_LINES_ALL : "has"
```

## Key HCM Data Relationships

```mermaid
erDiagram
    PER_ALL_PEOPLE_F {
        number PERSON_ID PK
        date EFFECTIVE_START_DATE
        date EFFECTIVE_END_DATE
        varchar PERSON_TYPE
    }
    PER_PERSON_NAMES_F {
        number PERSON_ID FK
        varchar FIRST_NAME
        varchar LAST_NAME
        varchar FULL_NAME
        date EFFECTIVE_START_DATE
        date EFFECTIVE_END_DATE
    }
    PER_ALL_ASSIGNMENTS_F {
        number ASSIGNMENT_ID PK
        number PERSON_ID FK
        number POSITION_ID FK
        number DEPARTMENT_ID FK
        number LOCATION_ID FK
        varchar ASSIGNMENT_STATUS_TYPE_ID
        date EFFECTIVE_START_DATE
        date EFFECTIVE_END_DATE
    }
    HR_ALL_POSITIONS_F {
        number POSITION_ID PK
        varchar NAME
        varchar POSITION_TYPE
    }
    HR_ALL_ORGANIZATION_UNITS_F {
        number ORGANIZATION_ID PK
        varchar NAME
        varchar TYPE
    }
    CMP_SALARY {
        number SALARY_ID PK
        number ASSIGNMENT_ID FK
        number SALARY_AMOUNT
        varchar CURRENCY_CODE
        date DATE_FROM
        date DATE_TO
    }

    PER_ALL_PEOPLE_F ||--o{ PER_PERSON_NAMES_F : "has names"
    PER_ALL_PEOPLE_F ||--o{ PER_ALL_ASSIGNMENTS_F : "has assignments"
    PER_ALL_ASSIGNMENTS_F }o--|| HR_ALL_POSITIONS_F : "in position"
    PER_ALL_ASSIGNMENTS_F }o--|| HR_ALL_ORGANIZATION_UNITS_F : "in department"
    PER_ALL_ASSIGNMENTS_F ||--o{ CMP_SALARY : "has salary"
```

## Flexfields — Custom Data in Fusion

Oracle Fusion uses **Flexfields** to store custom/configurable data:

| Type | Description | Example |
|---|---|---|
| **DFF** (Descriptive Flexfield) | Custom attributes on standard objects | Extra fields on invoices |
| **KFF** (Key Flexfield) | Structured codes (Chart of Accounts) | GL segments |
| **EFF** (Extensible Flexfield) | Complex custom structures | Custom HR attributes |

### Extracting Flexfield Data via BICC

```
Standard PVO: InvoiceHeadersPVO
  → Extracts standard invoice columns

Flexfield PVO: InvoiceHeadersDFFPVO (if configured)
  → Extracts DFF attribute columns
  → Columns named: ATTRIBUTE1, ATTRIBUTE2, ... ATTRIBUTE30
  → Meaning of each ATTRIBUTE column defined in Fusion setup
```

**Important:** Document your flexfield mappings — `ATTRIBUTE1` in one environment may mean something different than in another.

## Segment Values (Chart of Accounts)

For government/public sector, the Chart of Accounts typically has:

```
Segment 1: Fund          (e.g., 1000 = General Fund)
Segment 2: Department    (e.g., 2100 = Finance)
Segment 3: Account       (e.g., 5100 = Salaries)
Segment 4: Program       (e.g., 3001 = Public Safety)
Segment 5: Project       (e.g., 0000 = No Project)
Segment 6: Object        (e.g., 100 = Personnel)
```

These are stored in `GL_CODE_COMBINATIONS` and extracted via `CodeCombinationsPVO`.
