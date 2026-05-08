# Requirements Document: Kiro Power for GitHub

## Intent Analysis

- **User Request**: Create a Kiro Power that wraps the official GitHub MCP Server and adds GitHub Projects V2 board management capabilities, replacing Jira with GitHub-native project task tracking, with full AIDLC workflow integration.
- **Request Type**: New Project (Greenfield)
- **Scope Estimate**: Multiple Components — Power configuration, MCP server integration, steering files, hooks, and GraphQL tooling for Projects V2
- **Complexity Estimate**: Complex — Requires MCP server wrapping, GraphQL API integration for Projects V2, bidirectional AIDLC sync, advanced hooks, and full PR workflow automation

---

## Functional Requirements

### FR-01: GitHub MCP Server Integration
The Power MUST integrate with the official GitHub MCP Server (`github/github-mcp-server`), supporting both:
- **Remote**: Hosted at `https://api.githubcopilot.com/mcp/` (OAuth/PAT)
- **Local**: Docker-based (`ghcr.io/github/github-mcp-server`) self-hosted

The user selects their preferred configuration during Power setup.

### FR-02: Authentication via Personal Access Token (PAT)
The Power MUST authenticate using GitHub Personal Access Tokens. The PAT must have scopes for:
- `repo` (full repository access)
- `project` (GitHub Projects V2 access)
- `read:org` (organization project access)

PAT is stored as an environment variable (`GITHUB_TOKEN`) referenced in `mcp.json`.

### FR-03: Full Project Board Management
The Power MUST provide complete GitHub Projects V2 board management:
- Create new projects (user or organization level)
- List existing projects
- Add issues/PRs to a project
- Move items between statuses (Backlog → Todo → In Progress → Review → Done)
- Remove items from a project
- Archive/unarchive items

### FR-04: Advanced Project Features
The Power MUST support advanced GitHub Projects V2 features:
- Custom fields (text, number, date, single-select, iteration)
- Views management (board view, table view, roadmap view)
- Filters and grouping
- Iterations/sprints (create, assign items to iterations)
- Automated workflows (auto-add issues, auto-set status)
- Project templates

### FR-05: Full PR Workflow Integration
The Power MUST handle complete Pull Request workflows:
- Create branches from issues
- Create PRs linked to issues (using `Closes #N` syntax)
- Request code reviews
- Auto-move issues to "Review" when PR is opened
- Auto-move issues to "Done" when PR is merged
- Auto-close issues on merge

### FR-06: Bidirectional AIDLC Sync
The Power MUST provide full bidirectional synchronization with the AIDLC workflow:
- **Write**: Create GitHub Issues from AIDLC user stories and add them to the project board
- **Write**: Update issue status as AIDLC stages progress (e.g., "In Progress" during Code Generation)
- **Write**: Link PRs to issues created from AIDLC stories
- **Read**: Read project board state to inform AIDLC decisions
- **Read**: Check issue status before proceeding with dependent work

### FR-07: Issue Management
The Power MUST provide comprehensive issue management:
- Create issues with title, body, labels, assignees, milestones
- Update issue state (open/closed)
- Add comments to issues
- Search and filter issues
- Link issues to project board items

### FR-08: Single Project Board Structure
The default project board structure MUST use a single board with columns:
```
Backlog → Todo → In Progress → Review → Done
```

### FR-09: Steering Workflows
The Power MUST include steering files for:
- **Project Setup**: Guide for creating and configuring a GitHub Project
- **Issue Management**: Patterns for creating, labeling, and organizing issues
- **Board Management**: Workflows for managing project board items and statuses

### FR-10: Advanced Kiro Hooks
The Power MUST include hooks for:
- Auto-create issues from AIDLC specs/user stories (postTaskExecution)
- Auto-update project board when tasks complete (postTaskExecution)
- Notify on PR status changes (userTriggered)
- Sync AIDLC state with project board (postTaskExecution)

---

## Non-Functional Requirements

### NFR-01: API Support
- Use REST API for issues, PRs, branches, and repository operations (via GitHub MCP Server)
- Use GraphQL API for GitHub Projects V2 operations (custom MCP tools or direct API calls)

### NFR-02: Security
- PAT MUST NOT be hardcoded in any configuration file
- PAT MUST be referenced via environment variable (`${GITHUB_TOKEN}`)
- All API communication MUST use HTTPS/TLS
- Input validation on all user-provided parameters (owner, repo, issue numbers)
- No sensitive data in logs or steering file outputs

### NFR-03: Error Handling
- Graceful handling of API rate limits (GitHub's 5000 requests/hour for authenticated users)
- Clear error messages for authentication failures
- Retry logic for transient network errors
- Fail-safe defaults — never proceed with destructive operations on error

### NFR-04: Performance
- MCP server startup time under 5 seconds
- API calls should use pagination for large result sets
- Minimize redundant API calls through caching where appropriate

### NFR-05: Usability
- Clear onboarding instructions in POWER.md
- Keyword-based activation (users mention "github", "project", "board", "issue", "PR")
- Sensible defaults for project board structure
- Helpful error messages guiding users to fix configuration issues

### NFR-06: Maintainability
- Modular steering file structure (one concern per file)
- Clear separation between MCP server config and Power logic
- Version-pinned dependencies

---

## Technical Constraints

- **GitHub Projects V2 API**: Requires GraphQL — the REST API does not support full project board management
- **GitHub MCP Server**: Provides 51 tools for REST operations but does NOT include Projects V2 GraphQL tools
- **Gap to Fill**: The Power must add custom MCP tooling or steering-based GraphQL workflows for Projects V2 operations
- **Kiro Power Structure**: Must follow `POWER.md` + `mcp.json` + `steering/` directory pattern

---

## Extension Configuration

| Extension | Enabled | Decided At |
|---|---|---|
| Security Baseline | Yes | Requirements Analysis |
| Property-Based Testing | No | Requirements Analysis |

---

## Architecture Decision: Filling the Projects V2 Gap

The official GitHub MCP Server does not include GitHub Projects V2 management tools. To fill this gap, the Power will:

1. **Wrap the official GitHub MCP Server** for all standard operations (issues, PRs, branches, code search, notifications)
2. **Add a custom lightweight MCP server** (Node.js/TypeScript) that provides Projects V2 GraphQL tools:
   - `create_project` — Create a new GitHub Project V2
   - `list_projects` — List projects for a user/org
   - `add_item_to_project` — Add an issue/PR to a project
   - `update_item_status` — Move an item between columns
   - `get_project_items` — List items in a project with their status
   - `create_iteration` — Create a sprint/iteration
   - `update_item_field` — Update custom field values
   - `create_project_view` — Create filtered views

This dual-server approach gives users the full 51 tools from the official server PLUS the Projects V2 capabilities needed for project management.
