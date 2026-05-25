# Issue Management Workflow

## Default Context

When the user references issues or repositories without specifying an owner:
1. Call `get_teams` to detect the user's organization(s)
2. Use the detected org as the default owner
3. If multiple orgs exist, ask the user which one to use
4. When adding issues to project boards, always use `owner_type: "org"` for org-owned projects
5. Infer the repo from the current workspace (check git remote) when possible

---

## Creating Issues

When the user wants to create issues:

1. **Single issue**: Use `create_issue` from the github server with title, body, labels, and assignees
2. **Add to project**: After creation, use `add_item_to_project` to add it to the active project board
3. **Set initial status**: Use `update_item_status` to place it in the appropriate column (usually "Todo")

### From AIDLC User Stories

When converting AIDLC stories to issues:

1. Read `aidlc-docs/inception/user-stories/stories.md`
2. For each story:
   - Title: Story title (e.g., "Create a New GitHub Project")
   - Body: Include the full story description and acceptance criteria/scenarios
   - Labels: `aidlc:story`, plus epic label (e.g., `epic:project-board-management`)
   - Assignee: Leave unassigned unless user specifies
3. After creating all issues, use `bulk_add_items` to add them to the project
4. Set all new items to "Todo" status

### Issue Body Template for AIDLC Stories

```markdown
## User Story
**As a** [persona]
**I want to** [action]
**So that** [benefit]

## Acceptance Scenarios
[List scenarios from the story]

## Epic
[Epic name]

## Story ID
[Story number from stories.md]
```

## Updating Issues

- **Change status**: Use `update_issue` to open/close, then `update_item_status` to move on board
- **Add labels**: Use `update_issue` with the labels array
- **Assign**: Use `update_issue` with assignees array
- **Comment**: Use `add_issue_comment` for progress updates

## Organizing Issues

### By Label
Common label patterns:
- `aidlc:story` — Created from AIDLC user stories
- `aidlc:inception` — Related to inception phase
- `aidlc:construction` — Related to construction phase
- `epic:<name>` — Epic grouping
- `priority:high` — Priority indicators
- `bug`, `enhancement`, `documentation` — Type indicators

### By Milestone
- Create milestones for sprints or releases
- Assign issues to milestones using `update_issue`
- Track milestone progress via issue counts

## Searching Issues

Use `search_issues` with GitHub search syntax:
- `repo:owner/repo is:open label:aidlc:story` — All open AIDLC stories
- `repo:owner/repo assignee:username is:open` — User's open issues
- `repo:owner/repo milestone:"Sprint 1"` — Sprint issues
