---
inclusion: manual
---

# GitHub Power — AI-DLC Standard Template

## When to Use
Use this guide when the user asks to apply the AI-DLC standard project template, or during guided setup when template selection is "aidlc-standard".

## Prerequisites
- GitHub Project must exist (create one first if needed)
- Project ID must be stored in `github-power/config.json`

---

## Template Application Steps

Apply each step in order. Before each step, check if the item already exists — skip if it does (idempotent).

### Step 1: Create Custom Fields

**Field: Type**
- Type: single_select
- Options: Epic, Story, Task, Bug
- Purpose: Categorize work items

**Field: Priority**
- Type: single_select
- Options: High, Medium, Low
- Purpose: Prioritize work

**Field: Sprint**
- Type: iteration
- Duration: 2 weeks
- Purpose: Time-box work into sprints

**Field: Status**
- Type: single_select
- Options: Backlog, In Progress, Review, Done
- Purpose: Track workflow state

For each field:
1. Check if field with same name exists → skip if yes
2. Create field with specified type and options
3. Confirm: "Field '[name]' created"

### Step 2: Create Views

**View: Board**
- Type: board
- Group by: Status field
- Purpose: Kanban workflow visualization

**View: Table**
- Type: table
- Columns: Title, Type, Priority, Status, Sprint, Assignee
- Purpose: Spreadsheet overview of all items

**View: Roadmap**
- Type: roadmap
- Group by: Sprint field
- Purpose: Timeline planning view

For each view:
1. Check if view with same name exists → skip if yes
2. Create view with specified configuration
3. Confirm: "View '[name]' created"

### Step 3: Create Standard Labels

Create all labels from the standard AI-DLC set:
- epic, story, task, bug, enhancement
- priority-high, priority-medium, priority-low
- has-children, blocked

For each label:
1. Check if label exists in repo → skip if yes
2. Create with specified color and description
3. Report summary: "Created [n] labels, skipped [m] existing"

### Step 4: Configure Automation

**Rule 1: Auto-move closed to Done**
- Trigger: Issue closed
- Action: Set Status field to "Done"

**Rule 2: Auto-add new issues to Backlog**
- Trigger: Issue added to project
- Action: Set Status field to "Backlog"

For each rule:
1. Check if similar automation exists → skip if yes
2. Configure automation
3. Confirm: "Automation '[description]' configured"

---

## Completion Message

After all steps complete:
```
✅ AI-DLC Standard Template applied successfully!

Created:
- [n] custom fields (Type, Priority, Sprint, Status)
- [n] views (Board, Table, Roadmap)
- [n] labels
- [n] automation rules

Skipped [m] items that already existed.

Your project is ready for AI-DLC workflow integration.
```

---

## Error Handling
- If any step fails: report which step failed, continue with remaining steps
- If project not found: suggest creating project first
- If permissions insufficient: suggest checking token scopes include "project"
- Template application is best-effort — partial application is acceptable
