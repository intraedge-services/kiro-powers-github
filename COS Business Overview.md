# COS Line of Business — Operations, Key Metrics & Requirements Mapping

> This document explains how the City/County Organization Services (COS) operates,
> what metrics executives care about, and how each requirement maps to their business needs.

---

## What is COS?

**COS (City/County Organization Services)** is a public-sector government entity (city or county) that delivers services to citizens funded by taxpayer revenue, grants, and fees. Unlike private companies that optimize for profit, COS optimizes for:

- **Service delivery** within legally adopted budgets
- **Fiscal accountability** to elected officials and citizens
- **Compliance** with grant restrictions, labor agreements, and procurement regulations
- **Sustainability** — maintaining services across multi-year fiscal cycles

---

## How COS Operates

### Revenue Sources
```
┌─────────────────────────────────────────────────────────┐
│                    COS Revenue                           │
├──────────────┬──────────────┬──────────────┬────────────┤
│ Property Tax │ Sales Tax    │ Federal/State│ Fees &     │
│ (40%)        │ (25%)        │ Grants (20%) │ Charges    │
│              │              │              │ (15%)      │
│ Predictable  │ Volatile     │ Restricted   │ Variable   │
│ Annual       │ Monthly      │ Time-limited │ Service-   │
│              │              │              │ based      │
└──────────────┴──────────────┴──────────────┴────────────┘
```

### Expenditure Structure
```
┌─────────────────────────────────────────────────────────┐
│                  COS Expenditures                        │
├──────────────────────┬──────────────────────────────────┤
│ LABOR (65-70%)       │ NON-LABOR (30-35%)               │
├──────────────────────┼──────────────────────────────────┤
│ • Salaries           │ • Contracts & Services           │
│ • Benefits (30%+)    │ • Supplies & Materials           │
│ • Overtime           │ • Utilities                      │
│ • Employer taxes     │ • Capital Projects               │
│ • Workers comp       │ • Debt Service                   │
│                      │ • Insurance                      │
│ Largely fixed        │ Mix of fixed & discretionary     │
│ (union contracts)    │                                  │
└──────────────────────┴──────────────────────────────────┘
```

### Organizational Structure
```
City Manager / County Administrator
├── CFO / Finance Director
│   ├── Budget Office
│   ├── Accounting / Controller
│   ├── Treasury
│   └── Procurement
├── COO / Assistant City Manager
│   ├── Public Works
│   ├── Parks & Recreation
│   ├── Community Development
│   └── Utilities
├── Public Safety Chief
│   ├── Police
│   ├── Fire
│   └── Emergency Management
├── HR Director
│   ├── Compensation & Benefits
│   ├── Recruiting
│   └── Labor Relations
└── IT Director
    ├── Infrastructure
    └── Applications
```

### Budget Cycle (Annual)
```
Jul-Sep: Budget Development (departments submit requests)
Oct-Nov: Executive Review (CFO/Manager prioritize)
Dec-Jan: Council/Board Workshops (elected officials review)
Feb-Mar: Public Hearings (citizen input)
Apr-May: Adoption (legally binding appropriation)
Jun:     Year-End Close (encumbrance rollover decisions)
Jul 1:   New Fiscal Year Begins
```

---

## Key Metrics by Executive Role

### CFO / Finance Director

| Metric | Definition | Why It Matters | Decision Supported |
|--------|-----------|----------------|-------------------|
| **Funds Available** | Budget - Commitments - Obligations - Expenditures | "Can we still spend?" | Decisions 1, 3 |
| **Budget Variance** | (Actual / Budget) × 100 | "Are we on track?" | Decisions 4, 5 |
| **Burn Rate** | YTD Spend / Months Elapsed | "Will we run out before year-end?" | Decision 3 |
| **Encumbrance Coverage** | Commitments / Remaining Budget | "How much is already spoken for?" | Decision 10 |
| **Grant Utilization** | Grant Spent / Grant Award | "Are we spending grants on time?" | Decisions 12, 14 |
| **Reconciliation Status** | Source vs Warehouse variance | "Can I trust these numbers?" | Decision 25 |

### City Manager / County Administrator

| Metric | Definition | Why It Matters | Decision Supported |
|--------|-----------|----------------|-------------------|
| **Total Spend by Division** | Rolled up to executive portfolio | "Who's spending what?" | Decision 22 |
| **Scenario Impact** | Baseline - Forecast under scenario | "What happens if we cut 5%?" | Decisions 21, 26, 27 |
| **Service Impact Score** | Programs affected × mandate status | "What services break if we cut?" | Decision 24 |
| **Vacancy Savings** | Open positions × avg salary | "How much do we save by not hiring?" | Decisions 19, 21 |
| **Capital Project Risk** | Projects > 50% budget remaining + pausable | "What can we defer?" | Decision 11 |

### Budget Director

| Metric | Definition | Why It Matters | Decision Supported |
|--------|-----------|----------------|-------------------|
| **Original vs Amended Budget** | Budget + Amendments = Current | "How much has the budget shifted?" | Decisions 1, 2 |
| **Cancellable Commitments** | Open POs with $0 received | "What can we claw back immediately?" | Decision 6 |
| **Sunk vs Avoidable** | Received (sunk) vs Not-received (avoidable) | "What's truly recoverable?" | Decision 7 |
| **30-Day Cash Pressure** | Invoices due within 30 days | "What's the near-term obligation?" | Decision 8 |
| **Multi-Year Obligations** | Blanket POs + contracts remaining | "What are we locked into?" | Decision 18 |

### HR Director / Labor Relations

| Metric | Definition | Why It Matters | Decision Supported |
|--------|-----------|----------------|-------------------|
| **Total Employer Cost** | Salary + Benefits + Taxes | "What does each position really cost?" | Decision 20 |
| **Overtime Trend** | OT hours and cost by department | "Where is OT out of control?" | Decision 19 |
| **Vacancy Rate** | Vacant FTE / Authorized FTE | "How understaffed are we?" | Decision 19 |
| **Hiring Freeze Impact** | Positions × months × avg salary | "What does a freeze save?" | Decision 21 |
| **Bargaining Unit Exposure** | Positions by union contract | "What can't we cut?" | Decision 23 |

### Procurement Director

| Metric | Definition | Why It Matters | Decision Supported |
|--------|-----------|----------------|-------------------|
| **Vendor Concentration** | Top vendor % of total spend | "Are we over-reliant on one vendor?" | Decision 17 |
| **Cycle Time** | Days from PO to payment | "How efficient is our process?" | Decision 9 |
| **Local/Minority Spend %** | Diversity spend / total spend | "Are we meeting equity goals?" | Decision 17 |
| **Contract Renewal Pipeline** | Contracts expiring in 6 months | "What needs renegotiation?" | Decision 18 |

---

## Requirements Mapped to Business Operations

### Business Process 1: Annual Budget Adoption & Monitoring

**How it works:** Council adopts a budget in May. Finance monitors spend against that legal authority all year. If revenues fall short or emergencies arise, amendments are processed.

| Requirement (Decision) | Business Need | Operational Context |
|------------------------|---------------|---------------------|
| D1: Legal authority to spend | The adopted budget IS the law — departments cannot exceed it | Council Resolution #2024-045 appropriates $180M for FY2024 |
| D2: Why budgets moved | Every amendment needs council approval and audit trail | "We moved $150K from Reserves to Parks for storm damage repair" |
| D3: True available budget | Real-time view of what's left after all encumbrances | Budget=$500K, but $200K is already committed on POs → only $300K truly available |
| D5: Dashboard vs ledger | CFO presents to council — numbers must match the official books | If dashboard says $12.4M and ledger says $12.5M, trust is destroyed |

**Example scenario:**
```
Mid-year budget review (January):
- Original Budget: $180M
- Amendments to date: +$2.3M (emergency repairs, grant matches)
- Current Budget: $182.3M
- YTD Expenditures: $95.2M (52% of budget, 50% through year)
- Open Commitments: $12.8M
- Funds Available: $74.3M
- Status: ON TRACK (burn rate slightly ahead but within tolerance)
```

---

### Business Process 2: Expenditure Control & Spend Analysis

**How it works:** Finance tracks every dollar spent — who spent it, on what, from which fund. Non-payroll spend is the primary area where cuts can be made quickly.

| Requirement (Decision) | Business Need | Operational Context |
|------------------------|---------------|---------------------|
| D4: Real spend drivers | Identify which categories are growing fastest | "Consulting spend is up 22% — are these one-time or recurring?" |
| D10: Commitment vs obligation vs expenditure | Know the lifecycle stage of every dollar | PO issued (committed) → goods received (obligated) → invoice paid (expended) |
| D6: Cancellable commitments | Quick wins for budget reduction | "We have $700K in POs where nothing has shipped yet — cancel them" |
| D7: Sunk vs avoidable | Don't waste time trying to recover spent money | "That $1.4M is already received — focus on the $700K we can still stop" |

**Example scenario:**
```
CFO asks: "Find me $500K in savings by Friday"

Analysis:
1. Cancellable POs (not received): $700K available
   - PO-2024-0445: Office furniture $28K ← CANCEL
   - PO-2024-0512: Training services $95K ← CANCEL
   - PO-2024-0601: Consulting phase 2 $180K ← CANCEL
   Subtotal: $303K

2. Discretionary accounts with remaining budget:
   - Travel & Training: $120K remaining, 80% cuttable → $96K
   - Professional Services: $340K remaining, 50% cuttable → $170K
   Subtotal: $266K

Total identified: $569K (exceeds $500K target) ✓
```

---

### Business Process 3: Procurement Lifecycle Management

**How it works:** Every purchase follows: Requisition → PO → Receipt → Invoice → Payment. Each stage creates a financial obligation that consumes budget.

| Requirement (Decision) | Business Need | Operational Context |
|------------------------|---------------|---------------------|
| D6: Cancellable commitments | Stop spending before goods arrive | "Cancel all non-essential POs issued in the last 30 days" |
| D8: Near-term budget pressure | Know what invoices are coming due | "We have $890K in invoices due next month — do we have cash?" |
| D9: Cash outflow timing | Distinguish accrual expense from actual cash leaving | "Expense recorded in Feb, but check doesn't clear until March" |
| D17: Vendor concentration | Reduce risk and ensure competition | "45% of IT spend goes to one vendor — we need to diversify" |
| D18: Long-term obligations | Understand multi-year commitments | "Our janitorial contract locks us in for $900K over 3 years" |

**Example scenario:**
```
Procurement lifecycle for PO-2024-0892:

Day 0:  PO Approved ($2,500 for office supplies)
        → Budget impact: $2,500 COMMITTED (encumbered)
        
Day 7:  Goods Received
        → Budget impact: $2,500 moves from COMMITTED to OBLIGATED
        
Day 10: Invoice Received (INV-44821, $2,500)
        → AP records liability, 3-way match passes
        
Day 25: Payment Issued (CHK-99012)
        → Budget impact: $2,500 moves from OBLIGATED to EXPENDED
        → Cash actually leaves the bank

Day 30: Check Clears
        → Treasury confirms cash outflow

Total cycle: 30 days from PO to cash out
```

---

### Business Process 4: Labor Cost Management (65-70% of budget)

**How it works:** Labor is the largest expense. It's driven by positions (authorized FTE), filled status, pay rates (union contracts), overtime, and benefits. Most labor costs are "fixed" in the short term due to employment contracts.

| Requirement (Decision) | Business Need | Operational Context |
|------------------------|---------------|---------------------|
| D19: Where labor savings exist | Identify vacant positions and OT-eligible roles | "12 positions are vacant — that's $890K we're not spending" |
| D20: Reconcile labor spend | Payroll system must match GL postings | "Payroll says $4.2M, GL says $4.2M — we're reconciled" |
| D21: Hiring freeze scenarios | Model the impact of not filling vacancies | "6-month freeze on 12 positions = $444K savings" |
| D23: Prevent unrealistic cuts | Can't cut below contractual minimums | "Police staffing is mandated at 2.0 officers per 1,000 residents" |

**Example scenario:**
```
HR Director presents labor analysis:

Department: Public Works (Dept 5100)
- Authorized FTE: 145
- Filled FTE: 132
- Vacant: 13 positions
- Vacancy Rate: 9.0%

Labor Cost Breakdown (annual):
- Regular Salaries: $9.2M
- Overtime: $1.1M (12% of salary — above 8% target)
- Benefits: $3.7M (40% load factor)
- Employer Taxes: $704K (7.65% FICA)
- Total Employer Cost: $14.7M

Savings Opportunities:
- Freeze 8 non-critical vacancies: $592K/year
- Reduce OT to 8% target: $368K/year
- Total potential: $960K without layoffs
```

---

### Business Process 5: Grant Management & Compliance

**How it works:** Federal/state grants provide restricted funding for specific purposes. COS must spend within the grant period, meet match requirements, and comply with allowable cost rules. Unspent funds are returned (clawed back).

| Requirement (Decision) | Business Need | Operational Context |
|------------------------|---------------|---------------------|
| D12: Prevent cutting restricted funding | Grant money cannot be redirected to other purposes | "The $500K HHS grant is for workforce development ONLY" |
| D13: Match requirements | Some grants require local matching funds | "HHS grant requires 25% match — we must budget $125K locally" |
| D14: Must-spend or at-risk funds | Grants expiring soon with unspent balances | "Grant G50 expires in 6 months with $200K unspent — use it or lose it" |

**Example scenario:**
```
Grant Portfolio Summary:

Grant G50 (HHS Workforce Development):
- Award: $500,000
- Period: Jul 2023 – Jun 2025
- Spent to date: $300,000 (60%)
- Remaining: $200,000
- Days until expiry: 180
- Match required: 25% ($125K) — currently budgeted: $100K (GAP: $25K!)
- Status: AT RISK — spending pace too slow + match gap
- Action needed: Accelerate spending + budget additional $25K match

Grant G72 (FEMA Emergency Preparedness):
- Award: $250,000
- Period: Jan 2024 – Dec 2025
- Spent to date: $80,000 (32%)
- Remaining: $170,000
- Days until expiry: 580
- Match required: None
- Status: ON TRACK

CRITICAL: Do NOT cut any budget lines coded to grant segments.
These funds are legally restricted and must be spent on approved purposes.
```

---

### Business Process 6: Scenario Planning & What-If Analysis

**How it works:** When revenues decline or costs spike, executives need to model different reduction scenarios. Each scenario applies specific actions (hiring freezes, PO cancellations, service reductions) and shows the projected impact.

| Requirement (Decision) | Business Need | Operational Context |
|------------------------|---------------|---------------------|
| D21: Hiring freeze scenarios | Model vacancy savings over time | "Freeze all hiring for 6 months → $444K savings" |
| D24: Defensible decisions | Know which programs are mandated vs discretionary | "We can cut Workforce Dev but NOT Emergency Services" |
| D26: Repeatable what-if runs | Save and compare multiple scenarios | "Compare 3% cut vs 5% cut vs hiring freeze" |
| D27: Decision-to-forecast link | Show line-by-line impact of each action | "Line 1: Cancel IT consulting = -$40K. Line 2: Freeze HR position = -$75K" |
| D28: Inflation drivers | Apply realistic cost escalation to forecasts | "Utilities inflate at 4.8% (CPI-U Energy), not the default 3%" |

**Example scenario:**
```
Scenario: "FY2025 5% General Fund Reduction"
Owner: CFO Office
Baseline Year: FY2024
Target Savings: $9.1M (5% of $182M General Fund)

Action Plan:
┌────┬──────────────────────────┬──────────┬───────────┬───────────┬─────────────────────────┐
│ #  │ Action                   │ Dept     │ Baseline  │ Savings   │ Rationale               │
├────┼──────────────────────────┼──────────┼───────────┼───────────┼─────────────────────────┤
│ 1  │ Freeze 12 vacancies      │ Multiple │ $890K     │ -$890K    │ Non-critical positions   │
│ 2  │ Cancel IT consulting     │ IT       │ $200K     │ -$200K    │ Phase 2 deferrable       │
│ 3  │ Reduce OT to 8% target   │ PW       │ $1.1M    │ -$368K    │ Scheduling optimization  │
│ 4  │ Cancel training travel   │ All      │ $450K     │ -$360K    │ Virtual alternatives     │
│ 5  │ Defer road resurfacing   │ PW       │ $2.0M    │ -$1.5M    │ Push to FY2026           │
│ 6  │ Renegotiate janitorial   │ Facilities│ $900K   │ -$135K    │ 15% rate reduction       │
│ 7  │ Reduce discretionary     │ All      │ $8.5M    │ -$5.6M    │ 10% across-the-board     │
├────┼──────────────────────────┼──────────┼───────────┼───────────┼─────────────────────────┤
│    │ TOTAL                    │          │           │ -$9.05M   │ Meets 5% target ✓        │
└────┴──────────────────────────┴──────────┴───────────┴───────────┴─────────────────────────┘

Constraints Applied:
- Police staffing: Cannot go below 2.0 per 1,000 (mandated)
- Debt service: Cannot reduce (contractual)
- Grant-funded lines: Cannot reduce (restricted)
- Account 54200 (Insurance): Floor = 95% (contractual)
```

---

### Business Process 7: Financial Reporting & Accountability

**How it works:** COS must report to council, auditors, rating agencies, and citizens. Numbers must be accurate, reconciled, and traceable to source systems.

| Requirement (Decision) | Business Need | Operational Context |
|------------------------|---------------|---------------------|
| D5: Dashboard vs ledger validation | Numbers presented must match official books | Monthly council report must tie to GL within $0 |
| D15: Consistent rollups | Hierarchies must be correct for aggregation | "Public Safety" must include Police + Fire + Emergency Mgmt |
| D16: Authoritative accounting key | Every transaction must decode to valid COA | CCID 78432 → Fund:101, Dept:4200, Acct:51100 |
| D22: Exec-level rollups | Roll up to executive portfolio for leadership view | "CFO portfolio = Finance + IT + Procurement = $6.7M" |
| D25: Trust in numbers | Automated reconciliation before any presentation | Payroll-GL ✓, BC-GL ✓, Encumbrance ✓ → "Numbers are clean" |

---

## Summary: Business Process → Decision → Data Flow

```
┌─────────────────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│ BUSINESS PROCESS        │     │ EXECUTIVE        │     │ DATA REQUIRED       │
│                         │     │ DECISION         │     │                     │
├─────────────────────────┤     ├──────────────────┤     ├─────────────────────┤
│ Budget Adoption &       │────▶│ D1, D2, D3, D5   │────▶│ Budget PVOs         │
│ Monitoring              │     │                  │     │ GL Balances PVO     │
├─────────────────────────┤     ├──────────────────┤     ├─────────────────────┤
│ Expenditure Control     │────▶│ D4, D6, D7, D10  │────▶│ GL Journals PVO     │
│ & Spend Analysis        │     │                  │     │ PO/Receipt PVOs     │
├─────────────────────────┤     ├──────────────────┤     ├─────────────────────┤
│ Procurement Lifecycle   │────▶│ D6, D8, D9,      │────▶│ PO/Invoice/Payment  │
│                         │     │ D17, D18         │     │ Supplier PVOs       │
├─────────────────────────┤     ├──────────────────┤     ├─────────────────────┤
│ Labor Cost Management   │────▶│ D19, D20, D21,   │────▶│ Amorphic Payroll    │
│                         │     │ D23              │     │ Position/Employee   │
├─────────────────────────┤     ├──────────────────┤     ├─────────────────────┤
│ Grant Compliance        │────▶│ D12, D13, D14    │────▶│ Grant Award PVOs    │
│                         │     │                  │     │ GL filtered by grant│
├─────────────────────────┤     ├──────────────────┤     ├─────────────────────┤
│ Scenario Planning       │────▶│ D21, D24, D26,   │────▶│ Amorphic Scenarios  │
│                         │     │ D27, D28         │     │ CPI Index           │
├─────────────────────────┤     ├──────────────────┤     ├─────────────────────┤
│ Financial Reporting     │────▶│ D5, D15, D16,    │────▶│ COA Segment Values  │
│ & Accountability        │     │ D22, D25         │     │ Org Hierarchy       │
└─────────────────────────┘     └──────────────────┘     └─────────────────────┘
```
