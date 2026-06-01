---
name: "github"
displayName: "GitHub Project Management"
description: "Manage GitHub repositories, issues, PRs, projects, and workflows directly from Kiro using the official GitHub MCP Server. Includes automated PR comment response, AIDLC integration hooks, and guided workflows."
keywords: ["github", "project", "board", "issue", "pull request", "PR", "sprint", "iteration", "backlog", "kanban", "task", "milestone", "label", "code review", "notifications"]
author: "Kiro Community"
---

# Onboarding

## Step 1: Validate prerequisites

Before using the GitHub Power, ensure the following:

- **Docker Desktop** (REQUIRED): This power runs the official GitHub MCP Server as a Docker container.
  - **Install**: https://www.docker.com/products/docker-desktop/
  - **Verify installed**: Run `docker --version` in your terminal
  - **Verify running**: Run `docker info` — if you see an error, open Docker Desktop and wait for it to start
  - **CRITICAL**: If you see `spawn docker ENOENT`, Docker is not installed. If you see `failed to connect to the docker API`, Docker is installed but not running.
  - The image (`ghcr.io/github/github-mcp-server`) is pulled automatically on first use

- **GitHub Personal Access Token (PAT)**: You need a PAT with these scopes:
  - `repo` (full repository access)
  - `project` (GitHub Projects V2 access)
  - `read:org` (organization project access)
  - Create a PAT at: https://github.com/settings/tokens
  - Set it in your shell environment:
    ```bash
    # Add to ~/.zshrc or ~/.bashrc
    export GITHUB_PERSONAL_ACCESS_TOKEN=ghp_your_token_here
    ```
  - Then approve `GITHUB_PERSONAL_ACCESS_TOKEN` in Kiro: Settings → search "Mcp Approved Env Vars" → add it
  - **CRITICAL**: If `GITHUB_PERSONAL_ACCESS_TOKEN` is not set in your environment, the server will fail to authenticate

## Troubleshooting

| Error | Cause | Fix |
|-------|-------|-----|
| `spawn docker ENOENT` | Docker is not installed | Install Docker Desktop from https://www.docker.com/products/docker-desktop/ |
| `failed to connect to the docker API` | Docker is installed but not running | Open Docker Desktop, wait for it to fully start, then reconnect the MCP server |
| `Connection closed` immediately | Docker daemon not ready OR token missing | Wait for Docker to be fully ready (whale icon stable), verify `GITHUB_PERSONAL_ACCESS_TOKEN` is set in your shell environment |
| `401 Unauthorized` | Invalid or expired token | Generate a new PAT with required scopes and update your shell environment |

## Step 2: Verify MCP server connectivity

After installation, verify the MCP server is accessible:
1. Test by calling the `get_me` tool — it should return the authenticated user's details

If it fails, check:
- `GITHUB_PERSONAL_ACCESS_TOKEN` is set in your shell environment (`echo $GITHUB_PERSONAL_ACCESS_TOKEN`)
- The variable is approved in Kiro settings (Settings → "Mcp Approved Env Vars")
- Docker is running (`docker ps` should work)
- The token has the required scopes
- Network connectivity to api.github.com

## Step 3: Available hooks

The Power includes automation hooks in the `hooks/` directory:

### PR Auto-Respond Hook
Automatically detects your repo and branch, finds the associated PR, and responds to all unanswered review comments.

### AIDLC Sync Hook
Updates GitHub Project board when AIDLC tasks complete.

### PR Status Hook
Shows status of all open PRs for the current repository.

### Spec to Issues Hook
Creates GitHub issues from AIDLC user stories and adds them to the project board.

# When to Load Steering Files

- Setting up a new GitHub Project or configuring an existing one → `project-setup.md`
- Creating, updating, labeling, or organizing issues → `issue-management.md`
- Managing project board items, moving between columns, sprint planning → `board-management.md`
