# GitHub Power — Usage Patterns

## Pattern 1: AI-DLC Workflow Sync

The most common usage — sync user stories after the AI-DLC User Stories stage.

### Automatic (Post-Stage Hook)
1. Complete the AI-DLC User Stories stage
2. When prompted: "Would you like to sync user stories to GitHub Projects?"
3. Choose "Yes"
4. Select mapping strategy (or use saved default)
5. Sync executes automatically

### Manual Sync
Ask Kiro: "Sync my user stories to GitHub"

### Retry Failed Items
Ask Kiro: "Retry failed sync items"

### Check Sync Status
Ask Kiro: "Show my GitHub sync status"

---

## Pattern 2: Project Setup

### Quick Setup with Template
Ask Kiro: "Create a GitHub Project with the AI-DLC template"

This creates:
- Project with standard fields (Type, Priority, Sprint, Status)
- Board, Table, and Roadmap views
- Standard label set
- Automation rules

### Custom Setup
Ask Kiro: "Create a GitHub Project called 'Sprint Board'"
Then: "Add a custom field 'Effort' as a number field"
Then: "Create a board view grouped by Priority"

---

## Pattern 3: Daily Issue Management

### Create Issues
- "Create a GitHub issue: Fix login timeout on mobile"
- "Create a bug issue with priority-high label: API returns 500 on empty payload"

### Update Issues
- "Close issue #42"
- "Add label 'in-progress' to issue #15"
- "Assign issue #20 to @username"

### Link Issues
- "Link issue #10 as child of #5"
- "Mark issue #12 as blocked by #8"

---

## Pattern 4: Milestone Tracking

### Create Milestone
- "Create a milestone 'v1.0 Release' due March 15"

### Track Progress
- "Show progress on milestone 'v1.0 Release'"

### Associate Issues
- "Add issues #10, #11, #12 to milestone 'v1.0 Release'"

---

## Pattern 5: GitHub Actions (When Enabled)

### List Workflows
- "Show available GitHub Actions workflows"

### Trigger Workflow
- "Run the 'CI' workflow on main branch"

### Check Status
- "What's the status of the latest CI run?"

---

## Mapping Strategy Guide

### Strategy A: Milestones (Best for timeline-focused teams)
- Epics become Milestones with due dates
- Stories become Issues assigned to milestones
- Progress tracked via milestone completion percentage
- **Best when**: You track work by release/sprint milestones

### Strategy B: Labels (Best for flat/simple projects)
- Epics and Stories are all Issues, differentiated by labels
- Simple flat structure, easy to filter
- **Best when**: Small projects, solo developers, simple tracking

### Strategy C: Custom Fields (Best for Projects V2 power users)
- Stories become Issues added to Project board
- Epic tracked via custom "Epic" field
- Full Projects V2 features (views, filters, grouping)
- **Best when**: You use GitHub Projects V2 extensively
