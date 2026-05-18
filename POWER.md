---
name: "github"
displayName: "GitHub Project Management"
description: "Manage GitHub Projects V2 boards, issues, PRs, and workflows directly from Kiro. Full project board management with AIDLC integration for automated task tracking."
keywords: ["github", "project", "board", "issue", "pull request", "PR", "sprint", "iteration", "backlog", "kanban", "task", "milestone", "label"]
author: "Kiro Community"
---

# Onboarding

## Step 1: Validate prerequisites

Before using the GitHub Power, ensure the following:

- **GitHub Personal Access Token (PAT)**: You need a PAT with these scopes:
  - `repo` (full repository access)
  - `project` (GitHub Projects V2 access)
  - `read:org` (organization project access)
  - Verify by running: check if `GITHUB_TOKEN` environment variable is set
  - **CRITICAL**: If `GITHUB_TOKEN` is not set, DO NOT proceed. Guide the user to create a PAT at https://github.com/settings/tokens

- **Node.js 22+** (Active LTS): Required for running the MCP server
  - Verify with: `node --version`
  - **CRITICAL**: If Node.js is not installed or version is below 22, guide the user to install it from https://nodejs.org/

## Step 2: Verify MCP server connectivity

After installation, verify both MCP servers are accessible:
1. Test the official GitHub MCP Server by calling `get_me` tool
2. Test the custom Projects V2 server by calling `get_cache_status` tool

If either fails, check:
- `GITHUB_TOKEN` is set correctly
- Node.js 22+ is installed
- Network connectivity to api.github.com

## Step 3: Add hooks

Create the following hooks in `.kiro/hooks/`:

### AIDLC Sync Hook
Add to `.kiro/hooks/aidlc-sync.kiro.hook`:
```json
{
  "name": "Sync AIDLC with GitHub Project",
  "version": "1.0.0",
  "description": "Updates GitHub Project board when AIDLC tasks complete",
  "when": {
    "type": "postTaskExecution"
  },
  "then": {
    "type": "askAgent",
    "prompt": "A task just completed. Check if it corresponds to a GitHub issue on the project board. If so, update the issue status: move to 'In Progress' if code generation started, or 'Done' if build and test passed. Use the update_item_status tool from the github-projects MCP server."
  }
}
```

### PR Status Hook
Add to `.kiro/hooks/pr-status.kiro.hook`:
```json
{
  "name": "Check PR Status",
  "version": "1.0.0",
  "description": "Shows status of all open PRs for the current repository",
  "when": {
    "type": "userTriggered"
  },
  "then": {
    "type": "askAgent",
    "prompt": "List all open pull requests for the current repository. For each PR, show: title, review status, CI check results, and any linked issues. Use the list_pull_requests and get_pull_request_status tools."
  }
}
```

### Spec to Issues Hook
Add to `.kiro/hooks/spec-to-issues.kiro.hook`:
```json
{
  "name": "Create Issues from Specs",
  "version": "1.0.0",
  "description": "Creates GitHub issues from AIDLC user stories and adds them to the project board",
  "when": {
    "type": "userTriggered"
  },
  "then": {
    "type": "askAgent",
    "prompt": "Read the user stories from aidlc-docs/inception/user-stories/stories.md. For each story that doesn't already have a corresponding GitHub issue, create one with the story title and acceptance criteria in the body. Label each issue with 'aidlc:story'. Then add all new issues to the active GitHub Project board in 'Todo' status. Use create_issue from the github server and add_item_to_project + update_item_status from the github-projects server."
  }
}
```

# When to Load Steering Files

- Setting up a new GitHub Project or configuring an existing one → `project-setup.md`
- Creating, updating, labeling, or organizing issues → `issue-management.md`
- Managing project board items, moving between columns, sprint planning → `board-management.md`
