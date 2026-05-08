# Component Dependencies

## Dependency Matrix

| Component | Depends On | Depended By |
|---|---|---|
| POWER.md | None | Kiro IDE (reads metadata) |
| mcp.json | GITHUB_TOKEN env var | Kiro MCP system (starts servers) |
| Official GitHub MCP Server | GITHUB_TOKEN, Docker (local) or network (remote) | Kiro Agent (tool calls) |
| Custom Projects V2 Server | GITHUB_TOKEN, Docker, Node.js runtime | Kiro Agent (tool calls) |
| Steering files | Both MCP servers (references tools) | Kiro Agent (loads guidance) |
| Hooks | Kiro Agent, both MCP servers | AIDLC workflow, user triggers |
| File cache (.kiro/github-cache/) | File system | Custom Projects V2 Server |

---

## Dependency Graph

```
+------------------+
|   POWER.md       |  (root - no dependencies)
+--------+---------+
         |
         | references
         v
+--------+---------+     +-------------------+
|   mcp.json       |---->| GITHUB_TOKEN      |
+--------+---------+     | (env variable)    |
         |               +--------+----------+
         | configures             |
         v                        | authenticates
+--------+---------+              |
| Official GitHub  |<-------------+
| MCP Server       |              |
+--------+---------+              |
         |                        |
         |    +-------------------+
         |    |
         v    v
+--------+---------+     +-------------------+
| Custom Projects  |---->| .kiro/github-     |
| V2 MCP Server    |     | cache/            |
+--------+---------+     +-------------------+
         |
         |
+--------+---------+
|   steering/      |  (references tools from both servers)
+--------+---------+
         |
         v
+--------+---------+
|   hooks/         |  (triggers agent to use both servers)
+------------------+
```

---

## Communication Patterns

### Pattern 1: Direct Tool Call (Synchronous)
```
Kiro Agent --[MCP stdio]--> MCP Server --[HTTPS]--> GitHub API
                                |
                                +--> Response back to Agent
```

### Pattern 2: Cached Tool Call (Read-through)
```
Kiro Agent --[MCP stdio]--> Projects V2 Server
                                |
                                +--> Check .kiro/github-cache/
                                |       |
                                |       +-- Cache HIT --> Return cached data
                                |       |
                                |       +-- Cache MISS --> GitHub GraphQL API
                                |                              |
                                |                              +--> Update cache
                                |                              +--> Return data
```

### Pattern 3: Hook-Triggered Workflow (Asynchronous)
```
IDE Event (e.g., postTaskExecution)
    |
    +--> Hook fires
           |
           +--> askAgent prompt
                  |
                  +--> Agent evaluates context
                         |
                         +--> Agent calls MCP tools as needed
                                |
                                +--> Board updated
```

---

## External Dependencies

| Dependency | Version | Purpose |
|---|---|---|
| `@modelcontextprotocol/sdk` | ^1.x | MCP server framework |
| `graphql-request` | ^6.x | GraphQL client for GitHub API |
| `zod` | ^3.x | Input validation schemas |
| `node:fs/promises` | built-in | File-based cache operations |
| Docker | latest | Container runtime for both servers |

---

## Environment Variables

| Variable | Required | Purpose |
|---|---|---|
| `GITHUB_TOKEN` | Yes | GitHub PAT with `repo`, `project`, `read:org` scopes |
| `GITHUB_PROJECTS_CACHE_DIR` | No | Override cache directory (default: `.kiro/github-cache/`) |
| `GITHUB_PROJECTS_CACHE_TTL` | No | Cache TTL in seconds (default: 300) |

---

## Data Flow: AIDLC Integration

```
AIDLC Workflow
    |
    | generates stories.md
    v
+-------------------+
| postTaskExecution  |  (hook fires)
| hook               |
+--------+----------+
         |
         | askAgent: "sync stories to board"
         v
+--------+----------+
| Kiro Agent        |
+--------+----------+
         |
         | 1. Read stories.md
         | 2. For each story:
         |    a. create_issue (github server)
         |    b. add_item_to_project (projects server)
         |    c. update_item_status → "Todo"
         v
+--------+----------+
| GitHub Project    |
| Board             |
| (Backlog/Todo/    |
|  InProgress/      |
|  Review/Done)     |
+-------------------+
```
