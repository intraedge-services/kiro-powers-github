# Kiro Power: GitHub Project Management

Manage GitHub Projects V2 boards, issues, and workflows directly from Kiro IDE using natural language. This Power provides 36 MCP tools for complete project board management via the GitHub GraphQL API.

## Features

- Create and manage GitHub Projects V2 boards
- Add/remove/move items between columns (Backlog → Todo → In Progress → Review → Done)
- Custom fields, iterations/sprints, and views
- Project statistics and burndown tracking
- File-based caching to reduce API calls
- Proactive rate limit tracking
- AIDLC workflow integration via hooks

## Prerequisites

1. **Node.js 24+** (Active LTS) — [Download](https://nodejs.org/)
2. **Kiro IDE** — [Download](https://kiro.dev/downloads/)
3. **GitHub Personal Access Token (PAT)** with these scopes:
   - `repo` — Full repository access
   - `project` — GitHub Projects V2 read/write
   - `read:org` — Organization project access

   Create one at: https://github.com/settings/tokens

## Installation

### Step 1: Clone the repository

```bash
git clone https://github.com/intraedge-services/kiro-powers-github.git
cd kiro-powers-github
```

### Step 2: Install dependencies and build

```bash
cd server
npm install
npm run build
cd ..
```

### Step 3: Create your `.env` file

Create a `.env` file in the project root (this file is gitignored):

```bash
echo "GITHUB_TOKEN=ghp_your_token_here" > .env
```

Replace `ghp_your_token_here` with your actual GitHub PAT.

### Step 4: Install the Power in Kiro

1. Open Kiro IDE
2. Open the **Powers** panel (sidebar)
3. Click **"Add power from Local Path"**
4. Select the `kiro-powers-github/` directory
5. The Power will install and the MCP server will connect automatically

### Step 5: Verify connection

In the **MCP Servers** panel, you should see:
```
power-kiro-powers-github-github-projects  Connected (36 tools) ✅
```

## Usage

Once installed, just talk to Kiro using natural language:

- "Show my GitHub projects"
- "Create a new project called Sprint Board"
- "Add issue #5 to the project"
- "Move issue #5 to In Progress"
- "What's the board status?"
- "Show project statistics"
- "Create an iteration Sprint-1 starting May 12 for 14 days"

## Available Tools (36)

| Category | Tools |
|---|---|
| Project Management | create_project, list_projects, get_project, update_project, delete_project |
| Item Management | add_item_to_project, remove_item_from_project, get_project_items, archive_item, unarchive_item, bulk_add_items, bulk_archive_items |
| Status Transitions | update_item_status, bulk_update_status, get_status_options |
| Custom Fields | create_field, update_item_field, get_project_fields, delete_field |
| Iterations | create_iteration, assign_item_to_iteration, get_iteration_items, list_iterations |
| Views | create_view, list_views, delete_view |
| Workflows | create_auto_add_workflow, create_status_workflow, list_workflows, toggle_workflow |
| Analytics | get_project_stats, get_iteration_burndown, get_stale_items |
| Cache | refresh_cache, get_cache_status, clear_cache |

## Hooks (Automation)

The Power includes 3 automation hooks in the `hooks/` directory:

| Hook | Trigger | What it does |
|---|---|---|
| `aidlc-sync.kiro.hook` | After task completion | Updates project board status when AIDLC tasks complete |
| `pr-status.kiro.hook` | Manual (button click) | Shows status of all open PRs |
| `spec-to-issues.kiro.hook` | Manual (button click) | Creates GitHub issues from AIDLC user stories |

## Project Structure

```
kiro-powers-github/
├── POWER.md              # Power metadata and onboarding
├── mcp.json              # MCP server configuration
├── .env                  # Your GitHub token (gitignored)
├── steering/
│   ├── project-setup.md
│   ├── issue-management.md
│   └── board-management.md
├── hooks/
│   ├── aidlc-sync.kiro.hook
│   ├── pr-status.kiro.hook
│   └── spec-to-issues.kiro.hook
└── server/
    ├── package.json
    ├── tsconfig.json
    └── src/              # TypeScript source (36 MCP tools)
```

## Troubleshooting

### Server shows "Connection Failed"
- Verify `.env` file exists at the project root with your token
- Verify the token starts with `ghp_` or `github_pat_`
- Run `npm run build` in the `server/` directory
- Remove and re-add the Power from Local Path

### 401 Bad Credentials
- Your token may have expired — regenerate at https://github.com/settings/tokens
- Ensure the `project` scope is enabled on your token
- Update the `.env` file with the new token and click Retry on the MCP server

### Tools work but Projects V2 queries fail
- Add the `project` scope to your PAT (required for GitHub Projects V2 GraphQL API)

## Running Tests

```bash
cd server
npm test
```

## License

MIT
