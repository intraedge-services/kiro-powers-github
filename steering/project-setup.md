# Project Setup Workflow

## Default Organization Context

**IMPORTANT**: When the user references projects, boards, or repositories without specifying an owner, determine the correct context dynamically:

1. **Detect the user's org**: Call `get_teams` to discover which organizations the user belongs to
2. **Prefer org-level projects**: Use `owner_type: "org"` by default when listing or searching projects
3. **If the user belongs to one org**: Use that org as the default owner
4. **If the user belongs to multiple orgs**: Ask which org they want to use
5. **Personal projects**: Only search personal (user-level) projects when the user explicitly says "my personal projects" or specifies their username

This prevents the common issue of searching personal projects when the team's boards live at the org level.

### Why this matters
GitHub Projects V2 separates user and org namespaces. A project created under an org will NOT appear when querying the user's personal projects. Always pass `owner_type: "org"` for organization-owned projects.

---

## Creating a New GitHub Project

When the user wants to create a new project for task tracking:

1. **Ask for project details**:
   - Project name (e.g., "Sprint Board", "Feature Tracker")
   - Owner (GitHub username or organization)
   - Whether to use the AIDLC template (default columns + labels)

2. **Create the project**:
   - Use `create_project` tool with the owner and title
   - Record the returned `projectId` for subsequent operations

3. **Set up default columns** (if AIDLC template):
   The project should have these status options:
   - Backlog
   - Todo
   - In Progress
   - Review
   - Done

   Note: GitHub Projects V2 creates a default "Status" field. Verify the options match using `get_status_options`.

4. **Configure automation workflows**:
   - Enable "Auto-add to project" for the repository
   - Enable "Item closed" → move to "Done"
   - Enable "PR merged" → move to "Done"
   - Use `list_workflows` and `toggle_workflow` to manage these

5. **Confirm setup**:
   - Use `get_project` to verify the project is configured correctly
   - Report the project URL to the user

## Configuring an Existing Project

When the user has an existing project:

1. Use `list_projects` to find the project
2. Use `get_project` to inspect its current configuration
3. Use `get_status_options` to verify column structure
4. Suggest any missing columns or fields for AIDLC compatibility

## AIDLC Integration Setup

When setting up a project for AIDLC workflow tracking:

1. Ensure the project has the standard 5 columns (Backlog, Todo, In Progress, Review, Done)
2. Suggest creating custom fields:
   - "Phase" (single-select): Inception, Construction, Operations
   - "Priority" (single-select): Low, Medium, High, Critical
3. Verify hooks are installed (check `.kiro/hooks/` directory)
4. Test the integration by creating a sample issue and moving it through columns
