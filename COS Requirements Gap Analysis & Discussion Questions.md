# COS Requirements Gap Analysis & Discussion Questions

> **Purpose:** Identify gaps in current requirements, missing information, and key questions
> to raise with the City of Scottsdale team during requirement discussions.
>
> **Perspective:** Data Engineering & Analytics SME reviewing the Executive Financial Dashboard requirements

---

## Executive Summary of Gaps

| Category | Gap Count | Priority |
|----------|-----------|----------|
| Data Source Confirmation | 8 questions | 🔴 High — blocks pipeline design |
| Business Rules & Logic | 12 questions | 🔴 High — blocks transformation layer |
| Scope & Boundaries | 6 questions | 🟡 Medium — affects architecture |
| Non-Functional Requirements | 7 questions | 🟡 Medium — affects infrastructure |
| User Experience & Delivery | 5 questions | 🟢 Low — affects presentation layer |
| Security & Compliance | 4 questions | 🔴 High — affects entire stack |

---

## 1. Data Source Confirmation (Blocks Pipeline Design)

These questions must be answered before we can finalize the ETL/ELT pipeline architecture.

| # | Question | Why It Matters | Impact If Not Answered |
|---|----------|---------------|----------------------|
| Q1 | **Which Oracle Fusion Cloud release is COS currently on?** (25A, 25B, 25C, 25D?) | PVO availability and field names change between releases. Some PVOs in our mapping may not exist in older releases. | Wrong PVO references → pipeline failures |
| Q2 | **Is BICC already configured and running extracts?** If yes, which PVOs are currently being extracted? | If BICC is already set up, we can leverage existing extracts. If not, we need to plan BICC configuration as a project phase. | 2-4 week delay if BICC needs setup from scratch |
| Q3 | **What is the Chart of Accounts structure?** We assumed 6 segments (Fund, Dept, Account, Program, Project, Grant). Is this correct? Are there additional segments? | The entire bridge dimension (`dim_code_combination`) depends on this. Wrong segment count = wrong data model. | Fundamental data model redesign |
| Q4 | **Where does payroll data live?** We assumed "Amorphic" as an intermediate platform. Is this a real system? Is it Oracle HCM Cloud, ADP, Workday, or a custom data lake? | Payroll is 65-70% of spend. If the source system is different, all labor fact ETL changes. | Entire labor pipeline redesign |
| Q5 | **Are Grant Awards managed in Oracle Fusion Grants (PPM)?** Or is there a separate grants management system (e.g., Fluxx, AmpliFund)? | Determines whether `GrantAwardExtractPVO` is the correct source or if we need a different integration. | Grant dimension may need different source |
| Q6 | **Is Oracle Fusion Procurement (PO/AP) the system of record for ALL purchases?** Or do some departments use P-Cards, separate systems, or manual processes? | If procurement data is fragmented, `fct_procurement_lifecycle` will have gaps. | Incomplete spend visibility |
| Q7 | **What is the "Amorphic" platform?** Is this an existing data lake/warehouse, a middleware layer, or a planned system? What technology stack? | 15+ datasets reference "Amorphic" as a source. We need to know if it exists today or needs to be built. | May need to build the source system first |
| Q8 | **Are there multiple ledgers?** (e.g., primary ledger + reporting ledger, or separate ledgers for enterprise funds like Water/Airport) | Multi-ledger environments require ledger_id filtering in every GL query. | Incorrect financial totals if ledgers are mixed |

---

## 2. Business Rules & Logic (Blocks Transformation Layer)

These questions clarify HOW to calculate metrics and apply business logic.

| # | Question | Why It Matters | Current Assumption |
|---|----------|---------------|-------------------|
| Q9 | **How is "current budget" calculated?** Is it: Original + Amendments? Or does it include carryforward encumbrances from prior year? | Affects `fct_budget_snapshot.current_budget` calculation | Original + Amendments only |
| Q10 | **What fiscal year does COS use for budget naming?** FY2025 = Jul 2024–Jun 2025? Or FY2025 = Jul 2025–Jun 2026? | Arizona cities vary. Wrong mapping = data off by one year. | FY2025 = Jul 2024–Jun 2025 |
| Q11 | **How are encumbrances rolled forward at year-end?** Do all open POs carry forward? Only capital? Is there a re-appropriation process? | Affects beginning balance calculations and budget continuity | All open POs roll forward |
| Q12 | **What defines "payroll" in GL?** Is it JeSource = 'Payroll'? Or a specific journal category? Are benefits posted separately from salaries? | Determines the `is_payroll` flag logic in `fct_gl_transaction` | JeSource = 'Payroll' |
| Q13 | **How are interfund transfers handled?** Are they revenue in the receiving fund and expense in the sending fund? Or netted out? | Transfers can double-count if not handled correctly in rollups | Shown as expense in source, revenue in target |
| Q14 | **What is the definition of "discretionary" vs "non-discretionary" spend?** Is there an official classification, or is it judgment-based? | Drives Decision 23 (prevents unrealistic cuts). Needs authoritative source. | Classified in ACCOUNT_ROLLUPS table |
| Q15 | **How are capital projects distinguished from operating?** By fund? By account range? By project type code? | Affects Decision 11 (delay/stop capital decisions) | ProjectTypeCode = 'CAPITAL' |
| Q16 | **What constitutes a "vacancy"?** Authorized FTE > Filled FTE? Or is there a specific position status code? | Drives vacancy savings calculations (Decision 19) | Authorized FTE - Filled FTE > 0 |
| Q17 | **Are there multiple budget versions?** (Adopted, Revised, Proposed, etc.) Which one is the "legal authority"? | Dashboard must show the legally binding budget, not a working draft | 'Adopted' is the legal version |
| Q18 | **How are benefits loaded onto positions?** Flat percentage? Tiered by plan? Actual per-employee? | Affects total employer cost accuracy in labor fact | 30% flat load factor assumed |
| Q19 | **What is the overtime threshold?** 40 hours/week? Or different for fire/police (e.g., 53-hour FLSA cycle)? | Public safety OT rules differ from standard. Affects OT calculations. | Standard 40-hour threshold |
| Q20 | **How are grant indirect costs (F&A) handled?** Are they charged to the grant or to general fund? | Affects grant utilization calculations and fund balance accuracy | Charged to grant |

---

## 3. Scope & Boundaries (Affects Architecture)

| # | Question | Why It Matters | Current Assumption |
|---|----------|---------------|-------------------|
| Q21 | **How many years of history are needed?** Current year only? 3 years? 5 years? Full history? | Determines initial load volume, storage costs, and time-travel depth | 3 fiscal years (current + 2 prior) |
| Q22 | **Which funds are in scope?** All funds? Or only General Fund + major enterprise funds? | Scottsdale has many funds (General, Water, Airport, CIP, Debt Service, etc.). Full scope = much larger dataset. | All funds |
| Q23 | **Are enterprise funds (Water, Airport) in scope?** These operate like businesses with their own revenue/expense cycles. | Enterprise funds have different reporting requirements and may need separate dashboards | Included |
| Q24 | **Is the dashboard for internal executives only? Or also for public/council consumption?** | Public-facing requires different security, data masking, and presentation standards | Internal executives only |
| Q25 | **Are there existing reports/dashboards being replaced?** If so, can we get them for comparison and validation? | Existing reports define "expected" numbers — critical for reconciliation testing | Unknown |
| Q26 | **Is scenario modeling (Decisions 21, 26, 27) a Phase 1 requirement or future phase?** | Scenario modeling is complex and may not be needed for initial launch | Phase 1 |

---

## 4. Non-Functional Requirements (Affects Infrastructure)

| # | Question | Why It Matters | Current Assumption |
|---|----------|---------------|-------------------|
| Q27 | **What is the required data freshness?** Real-time? Daily? Weekly? | Determines pipeline scheduling (BICC extracts are batch, minimum ~15 min) | Daily refresh (overnight batch) |
| Q28 | **What is the expected data volume?** How many GL journal lines per year? PO distributions? Payroll records? | Affects Snowflake warehouse sizing, partition strategy, and cost estimates | ~2M GL lines/year, ~50K POs/year |
| Q29 | **What is the target query response time?** Sub-second for dashboards? Or acceptable to wait 5-10 seconds? | Affects materialization strategy (pre-aggregated tables vs live queries) | < 5 seconds for standard queries |
| Q30 | **Is there an existing Snowflake environment?** Or does it need to be provisioned? What edition/size? | Affects timeline and cost. Enterprise edition needed for time-travel, masking. | Exists, needs new schemas |
| Q31 | **What BI/visualization tool will consume the data?** Tableau? Power BI? Looker? Oracle Analytics? | Affects semantic layer design, connection patterns, and optimization | TBD |
| Q32 | **What is the disaster recovery requirement?** RPO/RTO targets? | Affects backup strategy, multi-region deployment decisions | Standard (24hr RPO, 4hr RTO) |
| Q33 | **Is there a data retention policy?** How long must historical data be kept? Archival requirements? | Affects storage costs and lifecycle management | 7 years (audit requirement) |

---

## 5. User Experience & Delivery (Affects Presentation Layer)

| # | Question | Why It Matters | Current Assumption |
|---|----------|---------------|-------------------|
| Q34 | **Who are the primary dashboard users?** City Manager? CFO? Budget Director? Department heads? All of the above? | Determines role-based views, drill-down depth, and complexity level | CFO + City Manager + Budget Director |
| Q35 | **What are the top 5 questions the dashboard must answer on the landing page?** | Drives the default view and KPI selection | Funds available, burn rate, variance, OT trend, scenario impact |
| Q36 | **Are there existing KPI definitions or a data dictionary?** | Prevents misalignment between what COS means by a term and what we build | None assumed — we define |
| Q37 | **What drill-down paths are expected?** City → Division → Department → Account → Transaction? | Affects dimension hierarchy design and aggregation tables | Full drill-down to transaction |
| Q38 | **Are there alert/threshold requirements?** (e.g., notify when budget is 90% consumed, or when a grant is at risk) | May require a notification layer beyond the dashboard | Not in Phase 1 |

---

## 6. Security & Compliance (Affects Entire Stack)

| # | Question | Why It Matters | Current Assumption |
|---|----------|---------------|-------------------|
| Q39 | **What data classification applies?** Is employee salary data PII? Are vendor names public record? | Arizona public records law makes most government financial data public, but employee PII is protected | Financial data = public, employee PII = restricted |
| Q40 | **Is row-level security needed?** Can a department head see only their department? Or can all executives see everything? | Affects Snowflake security model and BI tool configuration | Executives see all; dept heads see own dept |
| Q41 | **Are there audit requirements for who accessed what data?** | May need Snowflake access history logging and BI tool audit trails | Standard audit logging |
| Q42 | **Is the data subject to any federal compliance?** (CJIS for police data, HIPAA for employee health benefits, Single Audit for grants) | Federal compliance adds specific controls and may restrict certain data from the warehouse | Grants subject to Single Audit; no CJIS/HIPAA data in scope |

---

## 7. Identified Gaps in Current Documentation

### Missing Information We Need to Obtain

| Gap | What's Missing | Where to Get It | Priority |
|-----|---------------|-----------------|----------|
| **BICC PVO Confirmation** | 6 PVOs marked "Confirm in BICC console" in master mapping | COS Oracle admin to verify in BICC console | 🔴 High |
| **Amorphic Platform Details** | No technical specification of what "Amorphic" is | COS IT team / data engineering team | 🔴 High |
| **COA Segment Structure** | Assumed 6 segments — not confirmed | COS Finance / GL admin | 🔴 High |
| **Payroll Source System** | Assumed Amorphic intermediary — actual source unknown | COS HR / Payroll team | 🔴 High |
| **Budget Amendment Workflow** | How amendments flow through approval | COS Budget Office | 🟡 Medium |
| **Grant Management System** | Oracle PPM vs external system | COS Grants team | 🟡 Medium |
| **Existing Reports Inventory** | What reports exist today for comparison | COS Finance / BI team | 🟡 Medium |
| **Data Quality Issues** | Known data quality problems in source systems | COS data stewards | 🟡 Medium |
| **User Access Matrix** | Who needs access to what | COS IT Security | 🟢 Low |
| **Change Management Plan** | How will users be trained on new dashboard | COS project sponsor | 🟢 Low |

### Assumptions That Need Validation

| # | Assumption | Risk If Wrong | Validation Method |
|---|-----------|---------------|-------------------|
| A1 | Fiscal year is Jul 1 – Jun 30 | All date logic breaks | Confirm with Finance |
| A2 | 6-segment COA (Fund-Dept-Acct-Prog-Proj-Grant) | Bridge dimension redesign | Review COA setup in Fusion |
| A3 | Single primary ledger | Multi-ledger = filter logic needed | Check Fusion GL setup |
| A4 | All POs flow through Oracle Procurement | Missing spend if P-cards exist | Confirm with Procurement |
| A5 | Benefits are ~30% load on salary | Total cost calculations off | Get actual benefit rates |
| A6 | "Amorphic" exists and has the listed tables | 15+ datasets unavailable | Demo the platform |
| A7 | Scenario modeling is a Phase 1 requirement | Scope creep or missing feature | Confirm with sponsor |
| A8 | Daily batch refresh is sufficient | Users may expect real-time | Confirm with stakeholders |

---

## 8. Recommended Discussion Agenda

### Meeting 1: Data Sources & Technical Architecture (with IT + Finance)
- Confirm Oracle Fusion release and BICC status (Q1, Q2)
- Validate COA segment structure (Q3)
- Clarify "Amorphic" platform (Q7)
- Confirm payroll source system (Q4)
- Discuss existing Snowflake environment (Q30)
- Review data freshness requirements (Q27)

### Meeting 2: Business Rules & Definitions (with Budget Office + Finance)
- Budget calculation rules (Q9, Q10, Q11, Q17)
- Encumbrance and fund balance logic (Q13)
- Discretionary vs non-discretionary classification (Q14)
- Grant management and indirect costs (Q5, Q20)
- Existing reports for comparison (Q25)

### Meeting 3: Labor & HR Data (with HR + Payroll)
- Payroll data source and structure (Q4)
- Vacancy definition and position management (Q16)
- Benefits loading methodology (Q18)
- Overtime rules by department (Q19)
- Hiring freeze scenario requirements (Q21 scope)

### Meeting 4: Scope, Security & Delivery (with Project Sponsor + IT Security)
- Confirm scope boundaries (Q21-Q26)
- Security and access requirements (Q39-Q42)
- BI tool selection (Q31)
- User personas and top questions (Q34-Q37)
- Phase 1 vs future phase features (Q26)

---

## 9. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| "Amorphic" doesn't exist yet | Medium | 🔴 Critical — 15 datasets unavailable | Confirm in Meeting 1; plan alternative sources |
| COA has more/fewer than 6 segments | Low | 🔴 Critical — bridge redesign | Validate in Meeting 1 before any development |
| BICC not configured | Medium | 🟡 High — 4-week delay | Check in Meeting 1; plan BICC setup sprint |
| Payroll is in a system we haven't mapped | Medium | 🟡 High — labor pipeline redesign | Confirm source in Meeting 3 |
| Scenario modeling too complex for Phase 1 | High | 🟡 Medium — scope reduction | Propose phased approach in Meeting 4 |
| Data quality issues in source systems | High | 🟡 Medium — reconciliation failures | Request known issues list; plan data quality sprint |
| Multiple budget versions cause confusion | Medium | 🟡 Medium — wrong numbers shown | Confirm "legal" version in Meeting 2 |
| Enterprise funds need separate treatment | Low | 🟢 Low — additional work | Clarify scope in Meeting 4 |
