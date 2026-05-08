# Component Definitions

## Component Architecture Overview

```
+------------------------------------------------------------------+
|                     Kiro Power: GitHub                            |
+------------------------------------------------------------------+
|                                                                    |
|  +-------------------+    +-----------------------------------+   |
|  |   POWER.md        |    |   mcp.json                        |   |
|  |   (Metadata +     |    |   (Dual Server Config)            |   |
|  |    Onboarding +   |    |   - github (official remote/local)|   |
|  |    Steering Map)  |    |   - github-projects (custom)      |   |
|  +-------------------+    +-----------------------------------+   |
|                                                                    |
|  +-------------------+    +-----------------------------------+   |
|  |   steering/       |    |   hooks/                          |   |
|  |   - project-      |    |   - aidlc-sync.kiro.hook          |   |
|  |     setup.md      |    |   - pr-status.kiro.hook           |   |
|  |   - issue-mgmt.md |    |   - spec-to-issues.kiro.hook     |   |
|  |   - board-mgmt.md |    |                                   |   |
|  +-------------------+    +-----------------------------------+   |
|                                                                    |
+------------------------------------------------------------------+
                              |
                              | configures
                              v
+------------------------------------------------------------------+
|                     MCP Servers (Sidecar)                         |
+------------------------------------------------------------------+
|                                                                    |
|  +-----------------------------+  +----------------------------+  |
|  | Official GitHub MCP Server  |  | Custom Projects V2 Server  |  |
|  | (Remote or Docker)          |  | (Docker - TypeScript)      |  |
|  |                             |  |                            |  |
|  | 51 tools:                   |  | 25+ tools:                 |  |
|  | - Issues (CRUD)             |  | - Project CRUD             |  |
|  | - PRs (CRUD + review)       |  | - Item management          |  |
|  | - Branches                  |  | - Status transitions       |  |
|  | - Code search               |  | - Custom fields            |  |
|  | - Notifications             |  | - Iterations/sprints       |  |
|  | - Commits                   |  | - Views management         |  |
|  | - Files                     |  | - Workflow automation       |  |
|  | - Security alerts           |  | - Cross-project ops        |  |
|  |                             |  | - Analytics/reporting      |  |
|  | Auth: GITHUB_TOKEN (PAT)    |  | - Cache management         |  |
|  +-----------------------------+  |                            |  |
|                                   | Auth: GITHUB_TOKEN (PAT)   |  |
|                                   | Cache: .kiro/github-cache/ |  |
|                                   +----------------------------+  |
|                                                                    |
+------------------------------------------------------------------+
                              |
                              | calls
                              v
+------------------------------------------------------------------+
|                     GitHub APIs                                   |
+------------------------------------------------------------------+
|  REST API (api.github.com)    |  GraphQL API (api.github.com/    |
|  - Issues, PRs, Branches     |    graphql)                       |
|  - Repos, Commits, Files     |  - Projects V2 mutations         |
|  - Notifications, Security   |  - Projects V2 queries           |
+------------------------------------------------------------------+
```

---

## Component 1: Power Configuration (`POWER.md`)

| Attribute | Value |
|---|---|
| **Purpose** | Entry point for the Kiro Power — metadata, onboarding instructions, and steering file mappings |
| **Type** | Configuration / Documentation |
| **Responsibilities** | Define keywords for activation, guide onboarding, map steering files to workflows |
| **Interfaces** | Read by Kiro IDE Power system |
| **Dependencies** | None (root artifact) |

---

## Component 2: MCP Configuration (`mcp.json`)

| Attribute | Value |
|---|---|
| **Purpose** | Configure both MCP servers (official GitHub + custom Projects V2) |
| **Type** | Configuration |
| **Responsibilities** | Define server commands, args, environment variables, auto-approve lists |
| **Interfaces** | Read by Kiro MCP system |
| **Dependencies** | Requires `GITHUB_TOKEN` environment variable |

---

## Component 3: Custom Projects V2 MCP Server

| Attribute | Value |
|---|---|
| **Purpose** | Provide GitHub Projects V2 management tools via GraphQL API |
| **Type** | MCP Server (TypeScript / Node.js / Docker) |
| **Responsibilities** | Expose 25+ tools for project board management, custom fields, iterations, views, automation, analytics, and caching |
| **Interfaces** | MCP stdio protocol (stdin/stdout JSON-RPC) |
| **Dependencies** | `@modelcontextprotocol/sdk`, `graphql-request`, `GITHUB_TOKEN` env var |

### Sub-components:
- **Tool Registry** — Registers all MCP tools with schemas
- **GraphQL Client** — Authenticated client for GitHub GraphQL API
- **Cache Manager** — File-based cache in `.kiro/github-cache/`
- **Input Validator** — Validates all tool inputs before API calls

---

## Component 4: Steering Files (`steering/`)

| Attribute | Value |
|---|---|
| **Purpose** | Provide workflow-specific guidance for project setup, issue management, and board management |
| **Type** | Documentation / Guidance |
| **Responsibilities** | Guide the AI agent through common workflows with best practices |
| **Interfaces** | Read by Kiro agent when relevant keywords/contexts are detected |
| **Dependencies** | References tools from both MCP servers |

### Files:
- `project-setup.md` — Guide for creating and configuring a GitHub Project
- `issue-management.md` — Patterns for creating, labeling, and organizing issues
- `board-management.md` — Workflows for managing project board items and statuses

---

## Component 5: Kiro Hooks (`hooks/`)

| Attribute | Value |
|---|---|
| **Purpose** | Automate project board updates based on IDE events and AIDLC workflow stages |
| **Type** | Automation / Event Handlers |
| **Responsibilities** | Fire on AIDLC events to create issues, update board, sync state |
| **Interfaces** | Kiro Hook system (JSON config files) |
| **Dependencies** | Requires active MCP servers, requires project board to exist |

### Hooks:
- `aidlc-sync.kiro.hook` — Sync AIDLC state with project board (postTaskExecution)
- `pr-status.kiro.hook` — Check PR status on demand (userTriggered)
- `spec-to-issues.kiro.hook` — Create issues from spec files (userTriggered)
