# Kiro Power: GitHub Project Management

Manage GitHub repositories, issues, PRs, projects, and workflows directly from Kiro IDE using natural language. This Power wraps the official GitHub MCP Server (remote) and adds automated workflows via hooks and steering files.

## Features

- **51+ tools** from the official GitHub MCP Server — repos, issues, PRs, projects, code search, security, notifications, and more
- **PR comment auto-respond** — automatically analyze and reply to review comments
- **AIDLC workflow integration** — sync specs to issues, update board on task completion
- **Guided workflows** via steering files for project setup, issue management, and board management
- **Zero build step** — uses official pre-built Docker image, no local server to maintain

## Prerequisites

1. **Kiro IDE** — [Download](https://kiro.dev/downloads/)
2. **Docker Desktop** — [Download](https://www.docker.com/products/docker-desktop/) (runs the official GitHub MCP Server image)
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

### Step 2: Create your `.env` file

Create a `.env` file in the project root (this file is gitignored):

```bash
echo "GITHUB_TOKEN=ghp_your_token_here" > .env
```

Replace `ghp_your_token_here` with your actual GitHub PAT.

### Step 3: Install the Power in Kiro

1. Open Kiro IDE
2. Open the **Powers** panel (sidebar)
3. Click **"Add power from Local Path"**
4. Select the `kiro-powers-github/` directory
5. The Power will install and the MCP server will connect automatically

### Step 4: Verify connection

In Kiro chat, ask: "Who am I on GitHub?" — the agent should use `get_me` and return your username.

## Usage

Once installed, just talk to Kiro using natural language:

- "Show my open PRs"
- "Respond to unanswered comments on my current PR"
- "Create an issue titled 'Fix login bug'"
- "What's the status of PR #14?"
- "Search for files containing 'authentication' in my repo"
- "Show my GitHub notifications"
- "List code scanning alerts"

## Available Tools (51+)

| Category | Tools |
|---|---|
| Context | get_me |
| Repositories | create_repository, fork_repository, search_repositories, get_file_contents, create_or_update_file, delete_file, push_files |
| Branches & Tags | create_branch, list_branches, list_tags, get_tag |
| Issues | create_issue, get_issue, list_issues, update_issue, get_issue_comments, add_issue_comment, search_issues |
| Pull Requests | create_pull_request, get_pull_request, list_pull_requests, update_pull_request, merge_pull_request, get_pull_request_diff, get_pull_request_files, get_pull_request_comments, get_pull_request_reviews, get_pull_request_status, update_pull_request_branch |
| Code Reviews | create_pending_pull_request_review, add_pull_request_review_comment_to_pending_review, submit_pending_pull_request_review, delete_pending_pull_request_review, create_and_submit_pull_request_review, request_copilot_review |
| Commits | get_commit, list_commits |
| Code Search | search_code |
| Users | search_users |
| Notifications | list_notifications, get_notification_details, dismiss_notification, mark_all_notifications_read, manage_notification_subscription, manage_repository_notification_subscription |
| Code Security | list_code_scanning_alerts, get_code_scanning_alert |
| Secret Scanning | list_secret_scanning_alerts, get_secret_scanning_alert |
| Copilot | assign_copilot_to_issue |

## Hooks (Automation)

| Hook | Trigger | What it does |
|---|---|---|
| `pr-auto-respond.kiro.hook` | Manual (button click) | Auto-detects repo/branch, finds PR, responds to unanswered comments |
| `pr-comment-responder.kiro.hook` | Manual (button click) | Same as above with fallback for any PR |
| `aidlc-sync.kiro.hook` | After task completion | Updates project board status when AIDLC tasks complete |
| `pr-status.kiro.hook` | Manual (button click) | Shows status of all open PRs |
| `spec-to-issues.kiro.hook` | Manual (button click) | Creates GitHub issues from AIDLC user stories |

## Project Structure

```
kiro-powers-github/
├── POWER.md              # Power metadata and onboarding
├── README.md             # This file
├── mcp.json              # MCP server configuration (remote GitHub server)
├── .env                  # Your GitHub token (gitignored)
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

### MCP server shows "Connection Failed"
- Verify `.env` file exists at the project root with your token
- Verify the token starts with `ghp_` or `github_pat_`
- Ensure Docker is running (`docker ps`)
- Try pulling the image manually: `docker pull ghcr.io/github/github-mcp-server`

### 401 Bad Credentials
- Your token may have expired — regenerate at https://github.com/settings/tokens
- Ensure the `repo` and `project` scopes are enabled

### Tools work but Projects V2 queries fail
- Add the `project` scope to your PAT (required for GitHub Projects V2)

## License

MIT
