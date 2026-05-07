# GitHub Power for Kiro

Manage GitHub Projects, Issues, and Milestones directly from Kiro IDE. Sync AI-DLC user stories to GitHub Projects with a single prompt.

## Keywords
github, project, sync, aidlc, issues, milestones, labels, projects-v2, workflow, actions, sprint, kanban, board

## Capabilities

### AI-DLC Workflow Integration
- **Automatic sync prompt** after User Stories stage completes
- **Manual sync** available anytime via user-triggered hook
- **Configurable mapping** — choose how epics/stories/tasks map to GitHub entities
- **Idempotent** — re-running sync never creates duplicates

### GitHub Project Management
- Create and configure GitHub Projects V2
- Manage custom fields (type, priority, sprint, status)
- Create views (board, table, roadmap)
- Apply AI-DLC standard project template
- Configure automation rules

### Issue & Milestone Management
- Create, update, close, and reopen issues
- Manage labels (standard AI-DLC set + custom)
- Create and track milestones
- Link issues (parent/child, related, blocked-by)

### GitHub Actions (Optional)
- List available workflows
- Trigger workflow runs
- Check workflow run status
- Controlled by `enableGitHubActions` feature flag

## MCP Servers

### github-power-sync
Custom MCP server providing Power-specific tools:
- `guided_setup` — Step-by-step Power configuration
- `validate_config` — Configuration validation and connectivity check
- `sync_stories` — Sync AI-DLC user stories to GitHub
- `select_mapping` — Choose mapping strategy
- `get_sync_status` — View sync state and history

### mcp-server-github (External)
Standard GitHub MCP server for all GitHub API operations:
- Issue management, PR management, repository operations
- Used by steering files for project/issue/milestone operations

## Steering Files
- `steering/github-power-sync.md` — Sync workflow instructions
- `steering/github-power-project-management.md` — Project creation and management
- `steering/github-power-issue-management.md` — Issue, label, milestone operations
- `steering/github-power-template.md` — AI-DLC standard template application

## Hooks
- `hooks/github-power-sync.json` — Auto-sync prompt after User Stories stage + manual trigger

## Quick Start

1. **Install the Power** in your Kiro workspace
2. **Run guided setup**: Ask Kiro to "set up GitHub Power"
3. **Configure**: Provide your GitHub token, repository, and preferences
4. **Use AI-DLC**: Run the AI-DLC workflow — after User Stories, you'll be prompted to sync
5. **Manage**: Use natural language to manage projects, issues, and milestones

## Configuration

The Power uses two configuration files:
- `.kiro/settings/mcp.json` — MCP server registration
- `config.json` — Power-specific settings (auth, repo, features, sync defaults)

Generated at runtime:
- `sync-state.json` — Sync metadata (idempotency tracking)
- `logs/power.log` — Structured log output

## Authentication

Supports two methods:
- **Personal Access Token (PAT)** — Simple, stored in environment variable
- **GitHub App** — More secure, organization-level (coming soon)

Required token scopes: `repo`, `project` (+ `workflow` if Actions enabled)

## Security
- Tokens stored in environment variables only (never in config files)
- All operations logged with structured format
- Sensitive data automatically redacted from logs
- Fail-safe error handling (never fails open)
- Dependencies pinned to exact versions
