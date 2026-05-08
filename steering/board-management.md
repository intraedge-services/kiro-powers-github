# Board Management Workflow

## Viewing the Board

When the user asks about board status:

1. **Full board**: Use `get_project_items` to list all items grouped by status
2. **Specific column**: Use `get_project_items` with status filter
3. **By assignee**: Use `get_project_items` with assignee filter
4. **Statistics**: Use `get_project_stats` for counts by status and assignee

### Presenting Board Status

Format the response as a board view:
```
📋 Project Board: [Project Name]

🔴 Backlog (X items)
  • Issue #1: Title [assignee]
  • Issue #2: Title [assignee]

🟡 Todo (X items)
  • Issue #3: Title [assignee]

🔵 In Progress (X items)
  • Issue #4: Title [assignee]

🟣 Review (X items)
  • PR #5: Title [assignee]

🟢 Done (X items)
  • Issue #6: Title [assignee]
```

## Moving Items

### Manual Moves
When the user says "move issue #X to In Progress":
1. Find the item ID using `get_project_items`
2. Use `update_item_status` with the target status name

### AIDLC-Triggered Moves
During AIDLC workflow progression:
- **User Stories created** → Issues move to "Todo"
- **Code Generation starts** → Issues move to "In Progress"
- **PR created** → Issues move to "Review"
- **Build & Test passes / PR merged** → Issues move to "Done"

### Bulk Moves
When moving multiple items:
- Use `bulk_update_status` with an array of item IDs

## Sprint/Iteration Planning

### Starting a Sprint
1. Use `list_iterations` to see existing iterations
2. Assign items to the iteration using `assign_item_to_iteration`
3. Move assigned items from "Backlog" to "Todo"

### Tracking Sprint Progress
1. Use `get_iteration_burndown` for completion metrics
2. Use `get_stale_items` to find blocked work
3. Present velocity and remaining work

## PR Workflow Integration

### When a PR is Opened
1. The linked issue should move to "Review"
2. Use `update_item_status` to move the issue
3. Add a comment to the issue noting the PR

### When a PR is Merged
1. GitHub auto-closes the issue (if PR body has "Closes #N")
2. The issue should move to "Done"
3. Use `update_item_status` to confirm board state

### Creating a PR from an Issue
1. Use `create_branch` to create a feature branch (e.g., `feature/42-issue-title`)
2. After code changes, use `create_pull_request` with body containing `Closes #42`
3. Move the issue to "In Progress" when branch is created
4. Move to "Review" when PR is opened

## Archiving and Cleanup

### Archive Completed Work
- Use `bulk_archive_items` with status "Done" to archive completed items
- Use `archive_item` for individual items
- Archived items are hidden from the board but not deleted

### Finding Stale Items
- Use `get_stale_items` with a staleDays threshold (default: 7)
- Review stale items and either:
  - Move them forward (unblock)
  - Move them back to Backlog
  - Close the issue if no longer needed

## Cache Management

If board data seems stale:
1. Use `get_cache_status` to check cache freshness
2. Use `refresh_cache` to force a fresh pull from GitHub API
3. Cache auto-invalidates on any write operation (mutations)
