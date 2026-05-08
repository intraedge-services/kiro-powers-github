# Component Methods

## Custom Projects V2 MCP Server — Tool Signatures

### Project Management Tools

| Tool | Input | Output | Purpose |
|---|---|---|---|
| `create_project` | `{owner, title, description?, template?}` | `{projectId, url, title}` | Create a new GitHub Project V2 |
| `list_projects` | `{owner, type?: "user"\|"org", first?: number}` | `{projects: [{id, title, url, itemCount}]}` | List accessible projects |
| `get_project` | `{owner, projectNumber}` | `{id, title, description, fields, views, itemCount}` | Get project details |
| `delete_project` | `{projectId}` | `{success, message}` | Delete a project |
| `update_project` | `{projectId, title?, description?, public?}` | `{projectId, title}` | Update project settings |

### Item Management Tools

| Tool | Input | Output | Purpose |
|---|---|---|---|
| `add_item_to_project` | `{projectId, contentId, contentType: "Issue"\|"PR"\|"DraftIssue"}` | `{itemId, title, status}` | Add issue/PR to project |
| `remove_item_from_project` | `{projectId, itemId}` | `{success}` | Remove item from project |
| `get_project_items` | `{projectId, status?, assignee?, first?: number}` | `{items: [{id, title, status, assignee, fields}]}` | List project items with filters |
| `archive_item` | `{projectId, itemId}` | `{success}` | Archive a project item |
| `unarchive_item` | `{projectId, itemId}` | `{success}` | Unarchive a project item |
| `bulk_add_items` | `{projectId, contentIds: string[]}` | `{added: number, items: [{id, title}]}` | Add multiple items at once |
| `bulk_archive_items` | `{projectId, status?: string, olderThan?: string}` | `{archived: number}` | Archive items by criteria |

### Status Transition Tools

| Tool | Input | Output | Purpose |
|---|---|---|---|
| `update_item_status` | `{projectId, itemId, status: string}` | `{itemId, oldStatus, newStatus}` | Move item between columns |
| `bulk_update_status` | `{projectId, itemIds: string[], status: string}` | `{updated: number}` | Move multiple items |
| `get_status_options` | `{projectId}` | `{options: [{id, name, color}]}` | List available status values |

### Custom Field Tools

| Tool | Input | Output | Purpose |
|---|---|---|---|
| `create_field` | `{projectId, name, dataType, options?}` | `{fieldId, name, dataType}` | Create a custom field |
| `update_item_field` | `{projectId, itemId, fieldId, value}` | `{success, fieldName, value}` | Set field value on item |
| `get_project_fields` | `{projectId}` | `{fields: [{id, name, dataType, options?}]}` | List all project fields |
| `delete_field` | `{projectId, fieldId}` | `{success}` | Delete a custom field |

### Iteration/Sprint Tools

| Tool | Input | Output | Purpose |
|---|---|---|---|
| `create_iteration` | `{projectId, fieldId, title, startDate, duration}` | `{iterationId, title, startDate, endDate}` | Create a new iteration |
| `assign_item_to_iteration` | `{projectId, itemId, iterationId}` | `{success}` | Assign item to iteration |
| `get_iteration_items` | `{projectId, iterationId}` | `{items: [{id, title, status}]}` | List items in iteration |
| `list_iterations` | `{projectId, fieldId}` | `{iterations: [{id, title, startDate, endDate}]}` | List all iterations |

### View Management Tools

| Tool | Input | Output | Purpose |
|---|---|---|---|
| `create_view` | `{projectId, name, layout: "board"\|"table"\|"roadmap", filter?}` | `{viewId, name, url}` | Create a project view |
| `list_views` | `{projectId}` | `{views: [{id, name, layout}]}` | List project views |
| `delete_view` | `{projectId, viewId}` | `{success}` | Delete a view |

### Workflow Automation Tools

| Tool | Input | Output | Purpose |
|---|---|---|---|
| `create_auto_add_workflow` | `{projectId, repositoryId, labelFilter?}` | `{workflowId}` | Auto-add new issues to project |
| `create_status_workflow` | `{projectId, trigger, targetStatus}` | `{workflowId}` | Auto-set status on events |
| `list_workflows` | `{projectId}` | `{workflows: [{id, type, enabled}]}` | List automation workflows |
| `toggle_workflow` | `{projectId, workflowId, enabled}` | `{success}` | Enable/disable workflow |

### Analytics & Reporting Tools

| Tool | Input | Output | Purpose |
|---|---|---|---|
| `get_project_stats` | `{projectId}` | `{totalItems, byStatus: {}, byAssignee: {}}` | Project statistics |
| `get_iteration_burndown` | `{projectId, iterationId}` | `{total, completed, remaining, velocity}` | Iteration progress |
| `get_stale_items` | `{projectId, staleDays?: number}` | `{items: [{id, title, lastUpdated}]}` | Find stale/blocked items |

### Cache Management Tools

| Tool | Input | Output | Purpose |
|---|---|---|---|
| `refresh_cache` | `{projectId?}` | `{refreshed: boolean, itemCount: number}` | Force cache refresh |
| `get_cache_status` | `{}` | `{cacheFile, lastRefresh, itemCount, stale}` | Check cache state |
| `clear_cache` | `{}` | `{success}` | Clear all cached data |

---

## Steering File Methods (Guidance Patterns)

### `project-setup.md` Workflows
- Create new project with AIDLC template
- Configure project for existing repository
- Set up automation workflows
- Configure custom fields and iterations

### `issue-management.md` Workflows
- Create issues from user stories
- Bulk label and organize issues
- Link issues to milestones
- Convert AIDLC stories to issues

### `board-management.md` Workflows
- Move items through pipeline
- Manage sprint/iteration planning
- Archive completed work
- Generate progress reports

---

## Hook Trigger Methods

### `aidlc-sync.kiro.hook`
- **Trigger**: postTaskExecution
- **Action**: askAgent — "Check if the completed task corresponds to a GitHub issue. If so, update the issue status on the project board."

### `pr-status.kiro.hook`
- **Trigger**: userTriggered
- **Action**: askAgent — "List all open PRs for the current repository, show their review status, CI check results, and linked issues."

### `spec-to-issues.kiro.hook`
- **Trigger**: userTriggered
- **Action**: askAgent — "Read the user stories from aidlc-docs/inception/user-stories/stories.md and create GitHub issues for any stories not yet tracked. Add them to the active project board."
