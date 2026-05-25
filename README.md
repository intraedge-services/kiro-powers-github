# COS — City of Scottsdale: Oracle Source → Data Warehouse Mapping

> **Purpose:** Single source of truth mapping Oracle Fusion BICC PVOs and Amorphic sources to a Kimball-style star schema (dimensions and facts) for the City of Scottsdale Executive Financial Dashboard.  
> **Oracle Release:** 25D  
> **Target Platform:** Snowflake  
> **Entity:** City of Scottsdale, AZ (Fiscal Year: Jul 1 – Jun 30)

---

## Document Index

| # | Document | Description |
|---|---|---|
| 1 | [BICC overview.md](BICC%20overview.md) | Oracle BICC extract architecture and dataset inventory |
| 2 | [pvo_overview.md](pvo_overview.md) | PVO (Public View Object) catalog with field details |
| 3 | [data organisation oracle fusion.md](data%20organisation%20oracle%20fusion.md) | Oracle Fusion data organization and module structure |
| 4 | [master data mapping.md](master%20data%20mapping.md) | Master dataset → PVO → Snowflake raw → target dim/fact |
| 5 | [pro to facs and dims mapping.md](pro%20to%20facs%20and%20dims%20mapping.md) | Process-level mapping from source to facts and dimensions |
| 6 | [Dimension Field Lineage.md](Dimension%20Field%20Lineage.md) | Every dimension column traced to its source PVO field |
| 7 | [Fact Field Lineage.md](Fact%20Field%20Lineage.md) | Every fact column traced to its source PVO field |
| 8 | [Bus Matrix with PVO Source Annotations.md](Bus%20Matrix%20with%20PVO%20Source%20Annotations.md) | Bus matrix showing which dimensions apply to which facts |
| 9 | [Executive Decision Traceability.md](Executive%20Decision%20Traceability.md) | Executive decisions → datasets → PVOs → facts/dims needed |
| 10 | [Sample Data Flow Lineage.md](Sample%20Data%20Flow%20Lineage.md) | Concrete examples: Fact → Bridge → Dimension with sample data |
| 11 | [COS Business Overview.md](COS%20Business%20Overview.md) | City of Scottsdale operations, key metrics, and requirements mapping |
| 12 | [Decision Reconciliation Queries.md](Decision%20Reconciliation%20Queries.md) | SQL queries to derive and reconcile all 28 decision metrics |

---

## Star Schema Diagram

The star schema diagram is available as an editable `.drawio` file:  
📁 [diagrams/star-schema-overview.drawio](diagrams/star-schema-overview.drawio)

**To view it:**
1. Click the file on GitHub — GitHub renders `.drawio` files natively for public repos
2. Or download and open at [app.diagrams.net](https://app.diagrams.net) → File → Open From → Device
3. Or install the [Draw.io VS Code extension](https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio) to view inline

**Direct draw.io link (if repo is public):**  
👉 [View in draw.io](https://app.diagrams.net/#Uhttps%3A%2F%2Fraw.githubusercontent.com%2Fintraedge-services%2Faws-cos-data-pipeline%2Ffeature%2Fcos-business-overview%2Fdiagrams%2Fstar-schema-overview.drawio)

### Schema at a Glance

```
                         ┌─── dim_fund
                         ├─── dim_department
Fact Tables ──────→ dim_code_combination ──┼─── dim_account
(GL, Budget,        (bridge table)         ├─── dim_program
 Procurement)                              ├─── dim_project
                                           └─── dim_grant

fct_labor_transaction ──→ dim_employee ──→ dim_position ──→ dim_department
fct_scenario_action ──→ dim_scenario, dim_department, dim_account, dim_position
```

---

## Data Model Summary

### Fact Tables (5)

| Fact | Grain | Type | Source |
|------|-------|------|--------|
| `fct_gl_transaction` | Journal header × line | Transaction | Oracle GL (2 PVOs) |
| `fct_budget_snapshot` | Period × code combination | Periodic snapshot | Oracle BC (4 PVOs) |
| `fct_procurement_lifecycle` | PO distribution | Accumulating snapshot | Oracle Procurement (6 PVOs) |
| `fct_labor_transaction` | Employee × position × pay period × earning | Transaction | Amorphic Payroll (3 tables) |
| `fct_scenario_action` | Scenario × action line × fiscal year | Transaction | Amorphic Scenarios (1 table) |

### Dimension Tables (12)

| Dimension | SCD Type | Primary Source |
|-----------|----------|----------------|
| `dim_date` | N/A (generated) | Calendar generation |
| `dim_code_combination` | Type 2 | CodeCombinationExtractPVO |
| `dim_fund` | Type 2 | SegmentValueExtractPVO (Fund set) |
| `dim_department` | Type 2 | SegmentValueExtractPVO + Amorphic ORG_HIERARCHY |
| `dim_account` | Type 2 | SegmentValueExtractPVO + Amorphic ACCOUNT_ROLLUPS |
| `dim_program` | Type 2 | SegmentValueExtractPVO + Amorphic PROGRAM_SERVICE_MAP |
| `dim_vendor` | Type 2 | SupplierExtractPVO + SupplierSiteExtractPVO |
| `dim_grant` | Type 2 | GrantAwardExtractPVO + GrantFundingSourceExtractPVO |
| `dim_position` | Type 2 | Amorphic POSITION_DIM + JOB_DIM |
| `dim_employee` | Type 2 | Amorphic EMPLOYEE_DIM |
| `dim_project` | Type 2 | ProjectExtractPVO |
| `dim_scenario` | Type 1 | Amorphic SCENARIO_HEADER |

---

## Key Design Decisions

1. **Bridge Table (`dim_code_combination`)** — Oracle GL uses a composite CCID key encoding 6 segments. The bridge resolves this into individual dimension FKs, giving facts a single join point while preserving drill-through to each segment dimension.

2. **Denormalized Segment Codes on Bridge** — `fund_code`, `department_code`, etc. are stored directly on the bridge for fast filtering without joining all 6 segment dimensions.

3. **Direct FKs for Non-GL Facts** — Labor and Scenario facts come from Amorphic (not Oracle GL), so they connect directly to dimensions without the bridge.

4. **Role-Playing dim_date** — The date dimension is used multiple times in procurement (PO date, receipt date, invoice date, payment date) via separate FK columns.

5. **SCD Type 2 Throughout** — All dimensions (except date and scenario) track historical changes with `_effective_from` / `_effective_to` columns.
