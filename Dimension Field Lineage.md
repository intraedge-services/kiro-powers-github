# Dimension Field Lineage — PVO Source per Column

> For each dimension, every column traced back to its source PVO field or Amorphic source.

---

## dim_date (Role-Playing)

**SCD Type:** N/A (generated)
**Source:** Generated / static calendar table — no PVO source

| Column | Source | Notes |
|---|---|---|
| date_sk | Generated | YYYYMMDD integer |
| date_actual | Generated | Calendar date |
| fiscal_year | Generated | July-June fiscal year |
| fiscal_quarter | Generated | Fiscal quarter 1-4 |
| fiscal_period_number | Generated | 1=Jul, 12=Jun |
| fiscal_period_name | Generated | JUL-24 format |
| is_current_period | Generated | Current period flag |

---

## dim_code_combination

**SCD Type:** Type 2
**Source PVO:** CodeCombinationExtractPVO

| Column | Source PVO.Field | Transformation |
|---|---|---|
| coa_sk | (surrogate) | Auto-increment |
| coa_nk | CodeCombinationExtractPVO.CodeCombinationId | Direct |
| fund_sk | → dim_fund lookup | Segment1 → dim_fund.fund_nk |
| department_sk | → dim_department lookup | Segment2 → dim_department.department_nk |
| account_sk | → dim_account lookup | Segment3 → dim_account.account_nk |
| program_sk | → dim_program lookup | Segment4 → dim_program.program_nk |
| project_sk | → dim_project lookup | Segment5 → dim_project.project_nk |
| grant_sk | → dim_grant lookup | Segment6 → dim_grant.grant_nk |
| fund_code | CodeCombinationExtractPVO.Segment1 | Direct (denormalized) |
| department_code | CodeCombinationExtractPVO.Segment2 | Direct (denormalized) |
| account_code | CodeCombinationExtractPVO.Segment3 | Direct (denormalized) |
| program_code | CodeCombinationExtractPVO.Segment4 | Direct (denormalized) |
| project_code | CodeCombinationExtractPVO.Segment5 | Direct (denormalized) |
| grant_code | CodeCombinationExtractPVO.Segment6 | Direct (denormalized) |
| full_coa_string | CodeCombinationExtractPVO.ConcatenatedSegments | Direct |
| full_coa_description | Derived | Join segment descriptions |
| is_enabled | CodeCombinationExtractPVO.EnabledFlag | Y → true |
| is_summary | CodeCombinationExtractPVO.SummaryFlag | Y → true |
| _effective_from | CodeCombinationExtractPVO.StartDateActive | SCD2 |
| _effective_to | CodeCombinationExtractPVO.EndDateActive | SCD2 |

---

## dim_fund

**SCD Type:** Type 2
**Source PVO:** ChartOfAccountsSegmentValueExtractPVO (Fund value set)

| Column | Source PVO.Field | Transformation |
|---|---|---|
| fund_sk | (surrogate) | Auto-increment |
| fund_nk | SegmentValueExtractPVO.FlexValue | Direct |
| fund_description | SegmentValueExtractPVO.Description | Direct |
| fund_type | SegmentValueExtractPVO.CompiledValueAttributes | Parsed: General/Special Revenue/Capital/etc. |
| fund_group | Derived from fund_type | Governmental/Proprietary/Fiduciary |
| is_restricted | Derived from fund_type | Special Revenue, Capital → true |
| is_grant_funded | Enriched from grant data | Post-load enrichment |
| is_debt_funded | Derived from fund_type | Debt Service → true |
| parent_fund_sk | SegmentValueExtractPVO.ParentFlexValue | Lookup parent SK |
| hierarchy_level | SegmentValueExtractPVO.HierarchyLevel | Direct |
| hierarchy_path | Derived | Computed from parent chain |
| _effective_from | SegmentValueExtractPVO.StartDateActive | SCD2 |
| _effective_to | SegmentValueExtractPVO.EndDateActive | SCD2 |

---

## dim_department

**SCD Type:** Type 2
**Source PVO:** ChartOfAccountsSegmentValueExtractPVO (Department value set)
**Enrichment:** Amorphic ORG_HIERARCHY

| Column | Source | Transformation |
|---|---|---|
| department_sk | (surrogate) | Auto-increment |
| department_nk | SegmentValueExtractPVO.FlexValue | Direct |
| department_description | SegmentValueExtractPVO.Description | Direct |
| level_1_code | Amorphic: ORG_HIERARCHY.level_1_code | Enrichment |
| level_1_description | Amorphic: ORG_HIERARCHY.level_1_description | Enrichment |
| level_2_code | Amorphic: ORG_HIERARCHY.level_2_code | Enrichment |
| level_2_description | Amorphic: ORG_HIERARCHY.level_2_description | Enrichment |
| level_3_code | Amorphic: ORG_HIERARCHY.level_3_code | Enrichment |
| level_3_description | Amorphic: ORG_HIERARCHY.level_3_description | Enrichment |
| level_4_code | Amorphic: ORG_HIERARCHY.level_4_code | Enrichment |
| level_4_description | Amorphic: ORG_HIERARCHY.level_4_description | Enrichment |
| hierarchy_path | Amorphic: ORG_HIERARCHY.hierarchy_path | Enrichment |
| executive_owner | Amorphic: ORG_HIERARCHY.executive_owner | Enrichment |
| division_name | Amorphic: ORG_HIERARCHY.division_name | Enrichment |
| service_area | Amorphic: ORG_HIERARCHY.service_area | Enrichment |
| cost_center_type | Amorphic: ORG_HIERARCHY.cost_center_type | Enrichment |
| is_enabled | SegmentValueExtractPVO.EnabledFlag | Y → true |
| _effective_from | SegmentValueExtractPVO.StartDateActive | SCD2 |
| _effective_to | SegmentValueExtractPVO.EndDateActive | SCD2 |

---

## dim_account

**SCD Type:** Type 2
**Source PVO:** ChartOfAccountsSegmentValueExtractPVO (Account value set)
**Enrichment:** Amorphic ACCOUNT_ROLLUPS + ACCOUNT_INFLATION_MAP + REDUCTION_LEVERS

| Column | Source | Transformation |
|---|---|---|
| account_sk | (surrogate) | Auto-increment |
| account_nk | SegmentValueExtractPVO.FlexValue | Direct |
| account_description | SegmentValueExtractPVO.Description | Direct |
| account_type | SegmentValueExtractPVO.CompiledValueAttributes | Parsed: Asset/Liability/Equity/Revenue/Expense |
| account_class | Amorphic: ACCOUNT_ROLLUPS.account_class | Personnel/Operating/Capital |
| account_category | Amorphic: ACCOUNT_ROLLUPS.account_category | Salaries/Benefits/Supplies/etc. |
| account_subcategory | Amorphic: ACCOUNT_ROLLUPS.account_subcategory | Regular Pay/Overtime/Medical/etc. |
| parent_account_sk | SegmentValueExtractPVO.ParentFlexValue | Lookup parent SK |
| hierarchy_level | SegmentValueExtractPVO.HierarchyLevel | Direct |
| is_labor | Amorphic: ACCOUNT_ROLLUPS.is_labor | Enrichment |
| is_benefits | Amorphic: ACCOUNT_ROLLUPS.is_benefits | Enrichment |
| is_discretionary | Amorphic: ACCOUNT_ROLLUPS.is_discretionary | Enrichment |
| is_cuttable | Amorphic: ACCOUNT_ROLLUPS.is_cuttable | Enrichment |
| is_contractual | Amorphic: ACCOUNT_ROLLUPS.is_contractual | Enrichment |
| is_grant_eligible | Amorphic: ACCOUNT_ROLLUPS.is_grant_eligible | Enrichment |
| minimum_spend_floor_pct | Amorphic: REDUCTION_LEVERS.minimum_spend_floor_pct | Enrichment |
| maximum_cut_pct | Amorphic: REDUCTION_LEVERS.maximum_cut_pct | Enrichment |
| inflation_index_type | Amorphic: ACCOUNT_INFLATION_MAP.inflation_index_type | Enrichment |
| default_escalation_pct | Amorphic: ACCOUNT_INFLATION_MAP.default_escalation_pct | Enrichment |
| _effective_from | SegmentValueExtractPVO.StartDateActive | SCD2 |
| _effective_to | SegmentValueExtractPVO.EndDateActive | SCD2 |

---

## dim_vendor

**SCD Type:** Type 2
**Source PVO:** SupplierExtractPVO + SupplierSiteExtractPVO

| Column | Source PVO.Field | Transformation |
|---|---|---|
| vendor_sk | (surrogate) | Auto-increment |
| vendor_nk | SupplierExtractPVO.VendorId | Direct |
| vendor_name | SupplierExtractPVO.VendorName | Direct |
| vendor_number | SupplierExtractPVO.Segment1 | Direct |
| vendor_type | SupplierExtractPVO.VendorTypeCode | Direct |
| vendor_status | SupplierExtractPVO.EnabledFlag | Y → Active, N → Inactive |
| payment_terms | SupplierExtractPVO.PaymentTermsId | Lookup to terms table |
| payment_method | SupplierExtractPVO.PaymentMethodCode | Site overrides supplier |
| is_minority_owned | SupplierExtractPVO.MinorityGroupCode | IS NOT NULL → true |
| is_woman_owned | SupplierExtractPVO.WomanOwnedFlag | Y → true |
| is_local_vendor | SupplierSiteExtractPVO.State | Derived: state match |
| is_small_business | SupplierExtractPVO.SmallBusinessFlag | Y → true |
| city | SupplierSiteExtractPVO.City | Primary pay site |
| state | SupplierSiteExtractPVO.State | Primary pay site |
| country | SupplierSiteExtractPVO.Country | Primary pay site |
| zip_code | SupplierSiteExtractPVO.Zip | Primary pay site |

---

## dim_grant

**SCD Type:** Type 2
**Source PVO:** GrantAwardExtractPVO + GrantFundingSourceExtractPVO

| Column | Source PVO.Field | Transformation |
|---|---|---|
| grant_sk | (surrogate) | Auto-increment |
| grant_nk | GrantAwardExtractPVO.AwardId | Direct |
| sponsor_award_number | GrantAwardExtractPVO.SponsorAwardNumber | Direct |
| grant_name | GrantAwardExtractPVO.AwardName | Direct |
| grant_type | GrantAwardExtractPVO.AwardType | Direct |
| grant_purpose | GrantAwardExtractPVO.AwardPurpose | Direct |
| grant_status | GrantAwardExtractPVO.AwardStatus | Direct |
| sponsor_name | GrantAwardExtractPVO.SponsorName | Direct |
| award_start_date | GrantAwardExtractPVO.StartDate | Direct |
| award_end_date | GrantAwardExtractPVO.EndDate | Direct |
| days_remaining | Derived | DATEDIFF(CURRENT_DATE, EndDate) |
| total_award_amount | GrantAwardExtractPVO.TotalAwardAmount | Direct |
| currency_code | GrantAwardExtractPVO.CurrencyCode | Direct |
| is_restricted | Derived | TRUE for all grants |
| is_match_required | GrantFundingSourceExtractPVO.MatchRequired | ANY(Y) aggregated |
| match_percentage | GrantFundingSourceExtractPVO.MatchPercentage | MAX aggregated |
| _effective_from | GrantAwardExtractPVO.EffectiveStartDate | SCD2 |
| _effective_to | GrantAwardExtractPVO.EffectiveEndDate | SCD2 |

---

## dim_position

**SCD Type:** Type 2
**Source:** Amorphic POSITION_DIM + JOB_DIM

| Column | Source | Transformation |
|---|---|---|
| position_sk | (surrogate) | Auto-increment |
| position_nk | Amorphic: POSITION_DIM.position_id | Direct |
| position_title | Amorphic: POSITION_DIM.position_title | Direct |
| job_code | Amorphic: JOB_DIM.job_code | Enrichment |
| job_title | Amorphic: JOB_DIM.job_title | Enrichment |
| grade | Amorphic: JOB_DIM.grade | Enrichment |
| step | Amorphic: JOB_DIM.step | Enrichment |
| pay_type | Amorphic: JOB_DIM.pay_type | Salary/Hourly |
| flsa_status | Amorphic: JOB_DIM.flsa_status | Exempt/Non-Exempt |
| bargaining_unit | Amorphic: POSITION_DIM.bargaining_unit | Direct |
| is_overtime_eligible | Amorphic: JOB_DIM.is_overtime_eligible | Direct |
| authorized_fte | Amorphic: POSITION_DIM.authorized_fte | Direct |
| department_sk | Amorphic: POSITION_DIM.department_code → dim_department | FK lookup |

---

## dim_employee

**SCD Type:** Type 2
**Source:** Amorphic EMPLOYEE_DIM

| Column | Source | Transformation |
|---|---|---|
| employee_sk | (surrogate) | Auto-increment |
| employee_nk | Amorphic: EMPLOYEE_DIM.employee_id | Direct |
| full_name | Amorphic: EMPLOYEE_DIM.full_name | Direct (PII) |
| employee_status | Amorphic: EMPLOYEE_DIM.employee_status | Active/Terminated/LOA |
| hire_date | Amorphic: EMPLOYEE_DIM.hire_date | Direct |
| termination_date | Amorphic: EMPLOYEE_DIM.termination_date | Direct |
| tenure_years | Derived | DATEDIFF(hire_date, COALESCE(term_date, NOW)) |
| position_sk | Amorphic: EMPLOYEE_DIM.position_id → dim_position | FK lookup |
| department_sk | Amorphic: EMPLOYEE_DIM.department_code → dim_department | FK lookup |

---

## dim_project

**SCD Type:** Type 2
**Source PVO:** ProjectExtractPVO (confirm in BICC) or COA project segment

| Column | Source | Transformation |
|---|---|---|
| project_sk | (surrogate) | Auto-increment |
| project_nk | ProjectExtractPVO.ProjectId or COA Segment5 | Direct |
| project_number | ProjectExtractPVO.ProjectNumber | Direct |
| project_name | ProjectExtractPVO.ProjectName | Direct |
| project_type | ProjectExtractPVO.ProjectTypeCode | Capital/Operating/Grant |
| project_status | ProjectExtractPVO.ProjectStatusCode | Active/Closed/On Hold |
| start_date | ProjectExtractPVO.StartDate | Direct |
| planned_end_date | ProjectExtractPVO.CompletionDate | Direct |
| total_budget | ProjectExtractPVO.TotalBudgetAmount | Direct |

---

## dim_scenario

**SCD Type:** Type 1
**Source:** Amorphic SCENARIO_HEADER

| Column | Source | Transformation |
|---|---|---|
| scenario_sk | (surrogate) | Auto-increment |
| scenario_nk | Amorphic: SCENARIO_HEADER.scenario_id | Direct |
| scenario_name | Amorphic: SCENARIO_HEADER.scenario_name | Direct |
| scenario_type | Amorphic: SCENARIO_HEADER.scenario_type | Baseline/Optimistic/etc. |
| owner | Amorphic: SCENARIO_HEADER.owner | Direct |
| baseline_fiscal_year | Amorphic: SCENARIO_HEADER.baseline_fiscal_year | Direct |
| default_inflation_pct | Amorphic: SCENARIO_HEADER.default_inflation_pct | Direct |
| is_approved | Amorphic: SCENARIO_HEADER.is_approved | Direct |
| is_baseline | Amorphic: SCENARIO_HEADER.is_baseline | Direct |

---

## dim_program

**SCD Type:** Type 2
**Source PVO:** ChartOfAccountsSegmentValueExtractPVO (Program value set)
**Enrichment:** Amorphic PROGRAM_SERVICE_MAP

| Column | Source | Transformation |
|---|---|---|
| program_sk | (surrogate) | Auto-increment |
| program_nk | SegmentValueExtractPVO.FlexValue | Direct |
| program_description | SegmentValueExtractPVO.Description | Direct |
| service_label | Amorphic: PROGRAM_SERVICE_MAP.service_label | Enrichment |
| strategic_priority | Amorphic: PROGRAM_SERVICE_MAP.strategic_priority | Enrichment |
| is_mandated | Amorphic: PROGRAM_SERVICE_MAP.is_mandated | Enrichment |
| parent_program_sk | SegmentValueExtractPVO.ParentFlexValue | Lookup parent SK |
| hierarchy_level | SegmentValueExtractPVO.HierarchyLevel | Direct |
