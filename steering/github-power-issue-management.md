---
inclusion: manual
---

# GitHub Power — Issue & Milestone Management Guide

## When to Use
Use this guide when the user asks to create, update, or manage GitHub Issues, labels, milestones, or issue relationships.

## Prerequisites
- GitHub Power must be configured (`github-power/config.json` exists)
- Repository must be accessible with current token

---

## Issue Operations

### Create an Issue:
1. Collect from user: title, body (optional), labels, assignees, milestone
2. Call GitHub MCP `create_issue` tool with:
   - owner, repo (from config)
   - title, body, labels, assignees, milestone
3. If project is configured: add issue to project board
4. Return: "Issue #[number] created: [url]"

### Update an Issue:
1. Identify issue (user provides number or search query)
2. Collect changes: title, body, labels, assignees, state, milestone
3. Call GitHub MCP `update_issue` tool
4. Confirm: "Issue #[number] updated"

### Close/Reopen an Issue:
1. Identify issue by number
2. Call `update_issue` with state: "closed" or "open"
3. Confirm state change

### Add Comment:
1. Identify issue by number
2. Collect comment text from user
3. Call GitHub MCP `add_issue_comment` tool
4. Confirm: "Comment added to #[number]"

---

## Label Management

### Standard AI-DLC Labels:
| Label | Color | Description |
|---|---|---|
| epic | 7057ff | Epic-level work item |
| story | 0075ca | User story |
| task | 008672 | Implementation task |
| bug | d73a4a | Bug report |
| enhancement | a2eeef | Enhancement request |
| priority-high | b60205 | High priority |
| priority-medium | fbca04 | Medium priority |
| priority-low | 0e8a16 | Low priority |
| has-children | c5def5 | Issue has child issues |
| blocked | e4e669 | Issue is blocked |

### Create Standard Labels:
1. For each label in the standard set:
   - Check if label exists (search by name)
   - If not exists: create with specified color and description
   - If exists: skip (don't overwrite user customizations)
2. Report: "Created [n] labels, skipped [m] existing"

### Create Custom Label:
1. Collect: name, color (hex), description
2. Create label via GitHub MCP
3. Confirm creation

---

## Milestone Management

### Create Milestone:
1. Collect: title, description (optional), due_date (optional)
2. Call GitHub MCP to create milestone
3. Return milestone number
4. Confirm: "Milestone '[title]' created"

### Associate Issues with Milestone:
1. Identify milestone (by name or number)
2. Identify issues to associate (by numbers or search)
3. Update each issue to set milestone field
4. Confirm: "[n] issues associated with milestone '[title]'"

### Track Milestone Progress:
1. List issues in milestone (open + closed)
2. Calculate: progress = closed / total * 100%
3. Report: "Milestone '[title]': [closed]/[total] issues complete ([percent]%)"

### Close Milestone:
1. Verify all issues are closed (or warn if open issues remain)
2. Close milestone
3. Confirm: "Milestone '[title]' closed"

---

## Issue Linking

### Link Parent/Child:
1. Identify parent issue number
2. Identify child issue number
3. Add label `has-children` to parent (if not already present)
4. Update child issue body to include relationship section:
   ```
   ---
   **Relationships:**
   - Parent: #[parent_number]
   ---
   ```
5. Confirm: "Issue #[child] linked as child of #[parent]"

### Link Related Issues:
1. Identify issues to link (two or more numbers)
2. Update each issue body to include:
   ```
   ---
   **Relationships:**
   - Related: #[other_numbers]
   ---
   ```
3. Confirm: "Issues #[a] and #[b] linked as related"

### Link Blocked-By:
1. Identify blocked issue and blocking issue
2. Add label `blocked` to blocked issue
3. Update blocked issue body:
   ```
   ---
   **Relationships:**
   - Blocked by: #[blocking_number]
   ---
   ```
4. Confirm: "Issue #[blocked] marked as blocked by #[blocking]"

---

## Error Handling
- If issue not found: suggest searching by title or listing recent issues
- If label creation fails (409 conflict): label already exists, skip
- If milestone not found: list available milestones for user to choose
- If permission denied: suggest checking token scopes
