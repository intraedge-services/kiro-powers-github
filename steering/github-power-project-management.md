---
inclusion: manual
---

# GitHub Power — Project Management Guide

## When to Use
Use this guide when the user asks to create or manage a GitHub Project, custom fields, views, or automation rules.

## Prerequisites
- GitHub Power must be configured (`github-power/config.json` exists)
- User must have appropriate GitHub permissions (repo + project scopes)

---

## Create a GitHub Project

### Steps:
1. Read config to get repository owner/repo
2. Ask user for project name (or use default: "[Repo Name] - AI-DLC")
3. Use GitHub MCP tools to create a Project V2:
   - Call `create_issue` is NOT correct for projects — use GraphQL mutation via the GitHub API
   - Since the GitHub MCP server may not have direct project creation, guide the user to create it via GitHub UI or use the `gh` CLI
4. Once created, store the project ID in `github-power/config.json`
5. Confirm: "Project '[name]' created successfully"

### If Project Already Exists:
- Search for project by name
- If found: "Project '[name]' already exists. Would you like to link to it?"
- Store project ID in config

---

## Manage Custom Fields

### Add a Custom Field:
1. Ask user: field name, field type (single_select, iteration, number, text, date)
2. If single_select: ask for option values
3. If iteration: ask for duration (default: 2 weeks)
4. Create field via GitHub Projects V2 GraphQL API
5. Confirm creation

### Update a Custom Field:
1. List current fields
2. User selects field to update
3. Collect changes (rename, add/remove options)
4. Apply changes

### Delete a Custom Field:
1. List current fields
2. User selects field to delete
3. Confirm deletion (warn: data in this field will be lost)
4. Delete field

---

## Manage Project Views

### Create a View:
1. Ask user: view name, view type (board, table, roadmap)
2. For board: ask for grouping field (default: Status)
3. For table: include all fields by default
4. For roadmap: ask for date/iteration field
5. Create view
6. Confirm creation

### Available View Types:
- **Board**: Kanban-style columns grouped by a single_select field
- **Table**: Spreadsheet-style with all fields visible
- **Roadmap**: Timeline view grouped by iteration/date field

---

## Configure Automation Rules

### Available Automations:
1. **Auto-close**: When item moved to "Done" status → close the issue
2. **Auto-add to project**: When issue created with specific label → add to project
3. **Auto-set status**: When issue assigned → move to "In Progress"

### Setup Steps:
1. Present available automation options to user
2. User selects which automations to enable
3. Configure each selected automation via Projects V2 API
4. Confirm: "Automation '[name]' configured"

---

## Error Handling
- If project creation fails: check permissions, suggest verifying token scopes
- If field creation fails: check for duplicate field names
- If view creation fails: check project exists and is accessible
- Never block workflow on project management failures — inform and offer alternatives
