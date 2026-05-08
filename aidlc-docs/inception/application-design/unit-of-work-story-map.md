# Unit of Work — Story Map

## Story-to-Unit Assignment

### Unit 1: github-projects-server (Custom MCP Server)

| Epic | Story | Rationale |
|---|---|---|
| Epic 2 | 2.1: Create a New GitHub Project | Requires `create_project` tool |
| Epic 2 | 2.2: List Projects | Requires `list_projects` tool |
| Epic 2 | 2.3: Add Items to Project Board | Requires `add_item_to_project`, `bulk_add_items` tools |
| Epic 2 | 2.4: Move Items Between Columns | Requires `update_item_status` tool |
| Epic 2 | 2.5: View Board Status | Requires `get_project_items` tool |
| Epic 2 | 2.6: Archive and Remove Items | Requires `archive_item`, `remove_item_from_project` tools |
| Epic 5 | 5.1: Manage Custom Fields | Requires `create_field`, `update_item_field` tools |
| Epic 5 | 5.2: Manage Iterations/Sprints | Requires `create_iteration`, `assign_item_to_iteration` tools |
| Epic 5 | 5.3: Create Project Views | Requires `create_view`, `list_views` tools |
| Epic 5 | 5.4: Project Templates | Requires `create_project` with template logic |
| Epic 5 | 5.5: Automated Workflows | Requires `create_auto_add_workflow`, `create_status_workflow` tools |

**Total: 11 stories** (all Project Board Management + Advanced Project Features)

---

### Unit 2: power-config (POWER.md + mcp.json + Steering)

| Epic | Story | Rationale |
|---|---|---|
| Epic 1 | 1.1: Install and Configure the Power | POWER.md onboarding, mcp.json setup |
| Epic 1 | 1.2: Validate Power Activation via Keywords | POWER.md frontmatter keywords |
| Epic 1 | 1.3: Onboarding Validation | POWER.md onboarding steps |
| Epic 3 | 3.1: Create Issues | Steering: issue-management.md patterns |
| Epic 3 | 3.2: Update Issues | Steering: issue-management.md patterns |
| Epic 3 | 3.3: Search and Filter Issues | Steering: issue-management.md patterns |
| Epic 3 | 3.4: Add Comments to Issues | Steering: issue-management.md patterns |
| Epic 3 | 3.5: Manage Labels and Milestones | Steering: issue-management.md patterns |
| Epic 4 | 4.1: Create Branch from Issue | Steering: board-management.md PR workflow |
| Epic 4 | 4.2: Create Pull Request from Issue | Steering: board-management.md PR workflow |
| Epic 4 | 4.3: Request Code Review | Steering: board-management.md PR workflow |
| Epic 4 | 4.4: Merge PR and Auto-Close Issue | Steering: board-management.md PR workflow |
| Epic 4 | 4.5: View PR Status and Checks | Steering: board-management.md PR workflow |
| Epic 4 | 4.6: Update PR Branch | Steering: board-management.md PR workflow |

**Total: 14 stories** (Setup + Issue Management + PR Workflow)

---

### Unit 3: hooks (Automation Hooks)

| Epic | Story | Rationale |
|---|---|---|
| Epic 1 | 1.4: Hook Installation During Setup | Hook file creation during onboarding |
| Epic 6 | 6.1: Auto-Create Issues from AIDLC Specs | `spec-to-issues.kiro.hook` |
| Epic 6 | 6.2: Auto-Update Board on Task Completion | `aidlc-sync.kiro.hook` |
| Epic 6 | 6.3: PR Status Notifications | `pr-status.kiro.hook` |
| Epic 6 | 6.4: Sync AIDLC State with Project Board | `aidlc-sync.kiro.hook` |
| Epic 6 | 6.5: Auto-Create Issues from Specs on File Save | `spec-to-issues.kiro.hook` |

**Total: 6 stories** (Hook Installation + all Automation)

---

## Summary

| Unit | Stories | Epics Covered | Priority |
|---|---|---|---|
| Unit 1: github-projects-server | 11 | Epic 2, Epic 5 | 1 (First) |
| Unit 2: power-config | 14 | Epic 1, Epic 3, Epic 4 | 2 (Second) |
| Unit 3: hooks | 6 | Epic 1 (partial), Epic 6 | 3 (Third) |
| **Total** | **31** | **All 6 Epics** | |

---

## Coverage Validation

- [x] All 31 stories assigned to a unit
- [x] No story assigned to multiple units
- [x] All 6 epics have at least one story in a unit
- [x] Dependencies respected (Unit 1 stories don't depend on Unit 2/3)
- [x] Each unit is independently testable within its scope
