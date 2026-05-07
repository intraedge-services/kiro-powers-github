# GitHub Power — Configuration Reference

## Configuration Files

| File | Purpose |
|---|---|
| `.kiro/settings/mcp.json` | MCP server registration (github + github-power-sync) |
| `github-power/config.json` | Power-specific settings |
| `github-power/sync-state.json` | Sync metadata (auto-generated) |

---

## Power Configuration Schema (`github-power/config.json`)

```json
{
  "authType": "pat",
  "authConfig": {
    "type": "pat",
    "tokenEnvVar": "GITHUB_TOKEN"
  },
  "repository": "owner/repo",
  "projectName": "My Project - AI-DLC",
  "projectId": "PVT_abc123",
  "labelSet": [
    { "name": "epic", "color": "7057ff", "description": "Epic-level work item" }
  ],
  "template": "aidlc-standard",
  "enableGitHubActions": false,
  "syncDefaults": {
    "mappingStrategy": "ask",
    "autoSync": true
  },
  "retryConfig": {
    "maxRetries": 3,
    "initialBackoffMs": 1000,
    "maxBackoffMs": 30000,
    "timeoutMs": 30000
  }
}
```

---

## Field Reference

### `authType` (required)
- Type: `"pat"` | `"github-app"`
- Purpose: Authentication method selection

### `authConfig` (required)
For PAT:
```json
{ "type": "pat", "tokenEnvVar": "GITHUB_TOKEN" }
```

For GitHub App:
```json
{
  "type": "github-app",
  "appId": "12345",
  "installationId": "67890",
  "privateKeyPath": "/path/to/private-key.pem"
}
```

### `repository` (required)
- Type: string
- Format: `owner/repo`
- Example: `"myorg/myproject"`

### `projectName` (optional)
- Type: string
- Purpose: GitHub Project name (created during setup)

### `projectId` (optional)
- Type: string
- Purpose: GitHub Project V2 node ID (stored after creation)

### `enableGitHubActions` (optional)
- Type: boolean
- Default: `false`
- Purpose: Enable/disable GitHub Actions integration

### `syncDefaults.mappingStrategy` (optional)
- Type: `"milestones"` | `"labels"` | `"custom-fields"` | `"ask"`
- Default: `"ask"`
- Purpose: Default mapping strategy for sync operations
- `"ask"`: Prompt user each time

### `syncDefaults.autoSync` (optional)
- Type: boolean
- Default: `true`
- Purpose: Whether to prompt for sync after User Stories stage

### `retryConfig` (optional)
| Field | Default | Range | Purpose |
|---|---|---|---|
| `maxRetries` | 3 | 1-10 | Maximum retry attempts |
| `initialBackoffMs` | 1000 | 100-10000 | Initial backoff delay |
| `maxBackoffMs` | 30000 | 1000-60000 | Maximum backoff delay |
| `timeoutMs` | 30000 | 5000-120000 | Per-request timeout |

---

## MCP Server Configuration (`.kiro/settings/mcp.json`)

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      },
      "disabled": false,
      "autoApprove": ["create_issue", "update_issue", "list_issues", "add_issue_comment"]
    },
    "github-power-sync": {
      "command": "node",
      "args": ["github-power/dist/index.js"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      },
      "disabled": false,
      "autoApprove": ["validate_config", "get_sync_status"]
    }
  }
}
```

### Auto-Approve Recommendations
- **Safe to auto-approve**: `validate_config`, `get_sync_status`, `list_issues`
- **Require approval**: `sync_stories`, `guided_setup`, `create_issue`, `update_issue`
