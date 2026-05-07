# GitHub Power — Setup Guide

## Prerequisites

- **Node.js 22+** installed
- **GitHub account** with repository access
- **GitHub Personal Access Token** with `repo` and `project` scopes
- **Kiro IDE** with MCP support

## Step 1: Install Dependencies

```bash
cd github-power
npm install
```

## Step 2: Build the Power

```bash
npm run build
```

## Step 3: Configure MCP Server

Add the following to `.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "github-power-sync": {
      "command": "node",
      "args": ["github-power/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

## Step 4: Set Environment Variable

```bash
export GITHUB_TOKEN=ghp_your_personal_access_token_here
```

**Best Practice**: Add to your shell profile (`~/.bashrc`, `~/.zshrc`) or use a secrets manager.

## Step 5: Run Guided Setup

Ask Kiro: "Set up the GitHub Power"

The guided setup will walk you through:
1. Authentication method (PAT or GitHub App)
2. Token validation (checks scopes)
3. Repository selection (owner/repo)
4. Project creation or linking
5. Label set configuration
6. Template selection
7. Feature flags (GitHub Actions)
8. Sync defaults

## Step 6: Verify Configuration

Ask Kiro: "Validate my GitHub Power configuration"

This checks:
- Token validity and scopes
- Repository accessibility
- Configuration completeness

## Token Scope Requirements

| Scope | Required | Purpose |
|---|---|---|
| `repo` | Always | Issues, PRs, repository access |
| `project` | Always | GitHub Projects V2 access |
| `workflow` | Only if Actions enabled | Trigger and read workflow runs |

### Creating a Token

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
2. Select your repository
3. Grant permissions: Issues (Read/Write), Projects (Read/Write), Metadata (Read)
4. If using Actions: also grant Actions (Read/Write)
5. Copy token and set as environment variable

## Troubleshooting

### "Environment variable not set"
- Ensure `GITHUB_TOKEN` is exported in your current shell session
- Restart Kiro after setting the variable

### "Insufficient scopes"
- Regenerate your token with `repo` and `project` scopes
- If using Actions, also add `workflow` scope

### "Repository not found"
- Verify the repository format: `owner/repo` (e.g., `myorg/myproject`)
- Ensure your token has access to the repository

### "MCP server not connecting"
- Verify the build completed: `npm run build`
- Check the path in mcp.json points to `github-power/dist/index.js`
- Check Kiro's MCP server panel for connection status
