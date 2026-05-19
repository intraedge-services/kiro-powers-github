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

- **GitHub Personal Access Token (PAT)**: You need a PAT with these scopes:
  - `repo` (full repository access)
  - `project` (GitHub Projects V2 access)
  - `read:org` (organization project access)
  - **CRITICAL**: If `GITHUB_TOKEN` is not set, DO NOT proceed. Guide the user to create a PAT at https://github.com/settings/tokens

- **Docker Desktop**: Required to run the official GitHub MCP Server image
  - Verify with: `docker --version`
  - The image (`ghcr.io/github/github-mcp-server`) is pulled automatically on first use

## Step 2: Verify MCP server connectivity

After installation, verify the MCP server is accessible:
1. Test by calling the `get_me` tool — it should return the authenticated user's details

If it fails, check:
- `GITHUB_TOKEN` is set correctly in your `.env` file
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
