# Service Definitions

## Service Architecture

The Kiro Power for GitHub uses a **sidecar service pattern** where two independent MCP servers run alongside each other, sharing authentication but operating independently.

---

## Service 1: Official GitHub MCP Server

| Attribute | Value |
|---|---|
| **Name** | `github` |
| **Type** | External MCP Server (maintained by GitHub) |
| **Protocol** | MCP stdio (local Docker) or HTTP (remote) |
| **Responsibilities** | All standard GitHub operations: issues, PRs, branches, commits, files, notifications, code scanning, secret scanning |
| **Authentication** | `GITHUB_TOKEN` environment variable |
| **Configuration** | Remote: `https://api.githubcopilot.com/mcp/` / Local: `docker run ghcr.io/github/github-mcp-server` |

### Orchestration Role
- Handles all REST API operations
- Primary server for issue CRUD, PR workflows, branch management
- No awareness of Projects V2 (gap filled by custom server)

---

## Service 2: Custom GitHub Projects V2 MCP Server

| Attribute | Value |
|---|---|
| **Name** | `github-projects` |
| **Type** | Custom MCP Server (TypeScript, Docker) |
| **Protocol** | MCP stdio |
| **Responsibilities** | All GitHub Projects V2 operations via GraphQL API |
| **Authentication** | `GITHUB_TOKEN` environment variable (same PAT as official server) |
| **Configuration** | `docker run ghcr.io/your-org/github-projects-mcp-server` |

### Internal Service Layers

```
+--------------------------------------------------+
|          MCP Server Entry Point                  |
|          (stdio transport)                       |
+--------------------------------------------------+
          |
          v
+--------------------------------------------------+
|          Tool Registry                           |
|          (registers 25+ tools with schemas)      |
+--------------------------------------------------+
          |
          v
+--------------------------------------------------+
|          Input Validation Layer                   |
|          (validates all params before execution)  |
+--------------------------------------------------+
          |
          v
+--------------------------------------------------+
|          Tool Handlers                           |
|          (business logic per tool)               |
+--------------------------------------------------+
          |         |
          v         v
+------------------+  +---------------------------+
| GraphQL Client   |  | Cache Manager             |
| (graphql-request)|  | (file-based .kiro/cache)  |
+------------------+  +---------------------------+
          |
          v
+--------------------------------------------------+
|          GitHub GraphQL API                       |
|          (api.github.com/graphql)                |
+--------------------------------------------------+
```

### Service Interactions

| From | To | Pattern | Purpose |
|---|---|---|---|
| Kiro Agent | `github` server | MCP tool call | Issue/PR/branch operations |
| Kiro Agent | `github-projects` server | MCP tool call | Project board operations |
| `github-projects` | GitHub GraphQL API | HTTP POST | Execute GraphQL mutations/queries |
| `github-projects` | File system (.kiro/) | File I/O | Read/write cache |
| Kiro Hooks | Kiro Agent | askAgent prompt | Trigger automated workflows |
| Kiro Agent | Both servers | MCP tool calls | Execute hook-triggered operations |

---

## Service 3: Kiro Hook Orchestration

| Attribute | Value |
|---|---|
| **Name** | Hook System |
| **Type** | Event-driven automation |
| **Protocol** | Kiro Hook JSON configuration |
| **Responsibilities** | Trigger agent actions on IDE/AIDLC events |
| **Authentication** | Inherits from Kiro agent session |

### Orchestration Patterns

**Pattern 1: AIDLC Stage Completion → Board Update**
```
postTaskExecution event
  → Hook fires askAgent prompt
    → Agent reads completed task context
      → Agent calls `github-projects.update_item_status`
        → Board item moves to new column
```

**Pattern 2: User-Triggered Spec-to-Issues**
```
User clicks "Spec to Issues" hook button
  → Hook fires askAgent prompt
    → Agent reads stories.md
      → Agent calls `github.create_issue` for each story
        → Agent calls `github-projects.add_item_to_project` for each issue
          → Board populated with new items
```

**Pattern 3: User-Triggered PR Status Check**
```
User clicks "PR Status" hook button
  → Hook fires askAgent prompt
    → Agent calls `github.list_pull_requests`
      → Agent calls `github.get_pull_request_status` per PR
        → Agent presents summary to user
```

---

## Service Communication Summary

```
+-------------+          +------------------+
|   Kiro IDE  |          |  GitHub APIs     |
|   Agent     |          |                  |
+------+------+          +--------+---------+
       |                          ^
       | MCP calls                | REST + GraphQL
       v                          |
+------+------+          +--------+---------+
| MCP Servers |--------->|                  |
| (sidecar)   |          | api.github.com   |
+------+------+          +------------------+
       |
       | File I/O
       v
+------+------+
| .kiro/      |
| github-     |
| cache/      |
+-------------+
```

**Key Design Decisions:**
1. **No inter-server communication** — servers are fully independent
2. **Shared auth** — same `GITHUB_TOKEN` env var for both
3. **Agent orchestrates** — Kiro agent decides which server to call based on the operation
4. **Cache is server-local** — only the Projects V2 server uses the cache
5. **Hooks trigger agent** — hooks don't call servers directly; they prompt the agent to act
