# Bus Matrix with PVO Source Annotations

## Bus Matrix

| Fact | dim_date | dim_coa | dim_fund | dim_dept | dim_acct | dim_prog | dim_vendor | dim_pos | dim_emp | dim_grant | dim_proj | dim_scenario | dim_status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| fct_gl_transaction | JrnlHdr.PostedDate | JrnlLine.CCID | via COA | via COA | via COA | via COA | | | | | via COA | | Y |
| fct_procurement_lifecycle | POHdr.ApprovedDate | PODist.CCID | via COA | via COA | via COA | via COA | POHdr.VendorId | | | | PODist.ProjectId | | Y |
| fct_budget_snapshot | BudBal.PeriodName | BudBal/BCBal.CCID | via COA | via COA | via COA | via COA | | | | | via COA | | |
| fct_labor_transaction | Amorphic.pay_period | Amorphic.funding | via COA | Amorphic.dept | via COA | | | Amorphic.pos | Amorphic.emp | Amorphic.grant | | | Y |
| fct_scenario_action | Amorphic.eff_date | | | Amorphic.dept | Amorphic.acct | | | Amorphic.pos | | | Amorphic.proj | Amorphic.scenario | |

## Dimension Source PVOs

| Dimension | Primary PVO | Enrichment |
|---|---|---|
| dim_date | Generated | N/A |
| dim_code_combination | CodeCombinationExtractPVO | Segment dims |
| dim_fund | SegmentValueExtractPVO (Fund set) | Manual classification |
| dim_department | SegmentValueExtractPVO (Dept set) | Amorphic ORG_HIERARCHY |
| dim_account | SegmentValueExtractPVO (Account set) | Amorphic ACCOUNT_ROLLUPS + INFLATION_MAP |
| dim_program | SegmentValueExtractPVO (Program set) | Amorphic PROGRAM_SERVICE_MAP |
| dim_vendor | SupplierExtractPVO + SupplierSiteExtractPVO | N/A |
| dim_position | Amorphic POSITION_DIM | Amorphic JOB_DIM |
| dim_employee | Amorphic EMPLOYEE_DIM | N/A |
| dim_grant | GrantAwardExtractPVO + GrantFundingSourceExtractPVO | N/A |
| dim_project | ProjectExtractPVO (confirm BICC) | N/A |
| dim_scenario | Amorphic SCENARIO_HEADER | N/A |
| dim_status_flags | Generated (junk dimension) | N/A |

## Grain Declarations

| Fact | Grain | Type | PVO Count |
|---|---|---|---|
| fct_gl_transaction | Journal header x line | Transaction | 2 PVOs |
| fct_procurement_lifecycle | PO distribution | Accumulating snapshot | 6 PVOs |
| fct_budget_snapshot | Period x code combination | Periodic snapshot | 4 PVOs |
| fct_labor_transaction | Employee x position x pay period x earning | Transaction | Amorphic (3 tables) |
| fct_scenario_action | Scenario x action line | Transaction | Amorphic (1 table) |
