# Kiro Power: GitHub

Manage GitHub repositories, issues, PRs, Projects V2 boards, and workflows directly from Kiro IDE using natural language. This Power wraps the [official GitHub MCP Server](https://github.com/github/github-mcp-server) and adds automated workflows via hooks and steering files.

## What You Get

- **71 tools** — repos, issues, PRs, Projects V2, code search, security alerts, notifications, Actions, discussions, and more
- **GitHub Projects V2** — list projects, add items, move between columns (Todo → In Progress → Done)
- **PR comment auto-respond** — analyze and reply to review comments automatically
- **AIDLC integration** — sync specs to issues, update board status on task completion
- **Guided workflows** — steering files for project setup, issue management, and board management
- **Zero custom code** — uses GitHub's official pre-built Docker image, maintained by GitHub

## Prerequisites

| Requirement | Why | Install |
|-------------|-----|---------|
| **Kiro IDE** | Runs the Power | [Download](https://kiro.dev/downloads/) |
| **Docker Desktop** | Runs the official GitHub MCP Server | [Download](https://www.docker.com/products/docker-desktop/) |
| **GitHub PAT** | Authenticates API calls | [Create one](https://github.com/settings/tokens) |

### Required PAT scopes

- `repo` — Full repository access
- `project` — GitHub Projects V2 read/write
- `read:org` — Organization project access

## Installation

### 1. Clone

```bash
git clone https://github.com/intraedge-services/kiro-powers-github.git
cd kiro-powers-github
```

### 2. Set your GitHub token

Add your token to your shell profile (required for Kiro to pass it to Docker):

```bash
echo 'export GITHUB_TOKEN="ghp_your_token_here"' >> ~/.zshrc
source ~/.zshrc
```

> **Important:** The token must be in your shell environment, not just a `.env` file. Kiro resolves `${GITHUB_TOKEN}` from the environment when spawning the Docker container.

### 3. Start Docker Desktop

Ensure Docker is running. On first use, the image is pulled automatically (~50MB):

```bash
docker pull ghcr.io/github/github-mcp-server
```

### 4. Install the Power in Kiro

1. Open Kiro IDE
2. Open the **Powers** panel (sidebar)
3. Click **"Add power from Local Path"**
4. Select the `kiro-powers-github/` directory
5. The MCP server connects automatically

### 5. Verify

In Kiro chat, type: **"Who am I on GitHub?"**

You should see your GitHub username returned. If not, see [Troubleshooting](#troubleshooting).

## Usage

Just talk to Kiro in natural language:

```
Show my open PRs
Create an issue titled "Add retry logic" in intraedge-services/my-repo
List projects for intraedge-services
Move issue #24 to "In Progress" on the Kiro E2E Validation Board
Respond to unanswered comments on my current PR
Show code scanning alerts for my repo
What are my GitHub notifications?
```

## How It Works

```
Kiro IDE → spawns Docker container → official GitHub MCP Server (stdio)
                                          ↓
                                    GitHub REST + GraphQL APIs
```

The Power runs `ghcr.io/github/github-mcp-server` with `GITHUB_TOOLSETS=all` to enable all 71 tools including Projects V2. Communication happens over stdin/stdout (MCP stdio transport). No network ports, no custom server code.

## Available Tools (71)

| Category | Key Tools |
|----------|-----------|
| **Projects V2** | projects_list, projects_get, projects_write (add items, update fields, move status) |
| **Issues** | issue_write (create/update), issue_read, list_issues, search_issues, add_issue_comment |
| **Pull Requests** | pull_request_read (get, diff, files, comments, reviews, status), create_pull_request, merge_pull_request, update_pull_request |
| **Code Reviews** | pull_request_review_write, add_comment_to_pending_review, add_reply_to_pull_request_comment |
| **Repositories** | create_repository, get_file_contents, push_files, create_or_update_file, get_repository_tree |
| **Branches & Tags** | create_branch, list_branches, list_tags |
| **Commits** | get_commit, list_commits |
| **Code Search** | search_code, search_repositories |
| **Actions** | actions_list, actions_get, actions_run_trigger, get_job_logs |
| **Security** | list_code_scanning_alerts, list_secret_scanning_alerts, list_dependabot_alerts |
| **Notifications** | list_notifications, dismiss_notification, mark_all_notifications_read |
| **Discussions** | list_discussions, get_discussion, get_discussion_comments |
| **Copilot** | assign_copilot_to_issue, request_copilot_review |
| **Users & Teams** | get_me, search_users, get_teams, get_team_members |

## Hooks (Automation)

| Hook | Trigger | What it does |
|------|---------|--------------|
| `pr-auto-respond` | Manual (click) | Detects repo/branch, finds PR, responds to unanswered review comments |
| `pr-comment-responder` | Manual (click) | Same with fallback for any PR |
| `pr-status` | Manual (click) | Shows status of all open PRs |
| `aidlc-sync` | After task completion | Updates project board when AIDLC tasks complete |
| `spec-to-issues` | Manual (click) | Creates GitHub issues from AIDLC user stories |

## Project Structure

```
kiro-powers-github/
├── POWER.md              # Power metadata and onboarding instructions
├── README.md             # This file
├── mcp.json              # MCP server config (official GitHub MCP via Docker)
├── steering/
│   ├── project-setup.md
│   ├── issue-management.md
│   └── board-management.md
└── hooks/
    ├── pr-auto-respond.kiro.hook
    ├── pr-comment-responder.kiro.hook
    ├── aidlc-sync.kiro.hook
    ├── pr-status.kiro.hook
    └── spec-to-issues.kiro.hook
```

## Troubleshooting

### "Connection Failed" or server not starting

1. Is Docker running? → `docker ps` should work
2. Can you pull the image? → `docker pull ghcr.io/github/github-mcp-server`
3. Is `GITHUB_TOKEN` in your environment? → `echo $GITHUB_TOKEN` should show your token
4. Did you restart Kiro after adding the token to `~/.zshrc`?

### 401 Bad Credentials

- Token expired → regenerate at https://github.com/settings/tokens
- Token not in environment → add `export GITHUB_TOKEN="ghp_..."` to `~/.zshrc`, then restart Kiro
- Wrong scopes → ensure `repo`, `project`, `read:org` are enabled

### Projects V2 operations fail

- Ensure your PAT has the `project` scope
- Use `owner_type: "org"` when working with organization projects

### Server disconnects between calls

- This can happen if Docker Desktop goes to sleep. Keep Docker running while using Kiro.
- Reconnect from the MCP Servers panel (right-click → Reconnect)

## Team Onboarding Checklist

For new team members setting up this Power:

- [ ] Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and ensure it's running
- [ ] Create a [GitHub PAT](https://github.com/settings/tokens) with scopes: `repo`, `project`, `read:org`
- [ ] Add token to shell: `echo 'export GITHUB_TOKEN="ghp_..."' >> ~/.zshrc && source ~/.zshrc`
- [ ] Clone this repo: `git clone https://github.com/intraedge-services/kiro-powers-github.git`
- [ ] Pre-pull Docker image: `docker pull ghcr.io/github/github-mcp-server`
- [ ] Open Kiro → Powers panel → "Add power from Local Path" → select the cloned directory
- [ ] Verify: type "Who am I on GitHub?" in Kiro chat

Total setup time: ~5 minutes.

## License

MIT
