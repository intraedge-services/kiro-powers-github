# Units of Work

## Decomposition Strategy
- **Approach**: Core-first — build the custom MCP server first, then layer Power configuration and hooks on top
- **Server Structure**: Single unit with all 36 tools in one package
- **Config Grouping**: POWER.md + mcp.json + steering files as one unit

---

## Unit 1: Custom GitHub Projects V2 MCP Server

| Attribute | Value |
|---|---|
| **Name** | `github-projects-server` |
| **Type** | MCP Server (TypeScript / Node.js / Docker) |
| **Priority** | 1 (Core — built first) |
| **Description** | Complete MCP server providing 36 tools for GitHub Projects V2 management via GraphQL API |
| **Deliverables** | TypeScript source, Dockerfile, package.json, compiled dist/, README |

### Scope
- All 36 MCP tools (projects, items, status, fields, iterations, views, workflows, analytics, cache)
- GraphQL client with authenticated requests
- Zod input validation for all tools
- File-based cache manager (.kiro/github-cache/)
- Structured logging (no secrets in logs)
- Global error handler (fail-closed)
- Docker containerization

### Code Organization
```
server/
+-- package.json
+-- package-lock.json
+-- tsconfig.json
+-- Dockerfile
+-- .dockerignore
+-- src/
|   +-- index.ts                 (entry point, MCP server setup)
|   +-- tools/
|   |   +-- projects.ts          (create, list, get, update, delete)
|   |   +-- items.ts             (add, remove, get, archive, bulk ops)
|   |   +-- status.ts            (update status, bulk update, get options)
|   |   +-- fields.ts            (create, update, list, delete fields)
|   |   +-- iterations.ts        (create, assign, list, get items)
|   |   +-- views.ts             (create, list, delete views)
|   |   +-- workflows.ts         (auto-add, status workflow, list, toggle)
|   |   +-- analytics.ts         (stats, burndown, stale items)
|   |   +-- cache-tools.ts       (refresh, status, clear)
|   +-- graphql/
|   |   +-- client.ts            (authenticated GraphQL client)
|   |   +-- queries.ts           (all read queries)
|   |   +-- mutations.ts         (all write mutations)
|   +-- cache/
|   |   +-- manager.ts           (file-based cache with TTL)
|   +-- validation/
|       +-- schemas.ts           (Zod schemas for all tool inputs)
+-- dist/                        (compiled output)
```

### Dependencies (npm)
- `@modelcontextprotocol/sdk` — MCP server framework
- `graphql-request` — GraphQL client
- `zod` — Input validation
- `typescript` (dev) — Compiler
- `@types/node` (dev) — Node.js types

---

## Unit 2: Power Configuration Package

| Attribute | Value |
|---|---|
| **Name** | `power-config` |
| **Type** | Configuration / Documentation |
| **Priority** | 2 (Layered on top of server) |
| **Description** | Kiro Power entry point with metadata, onboarding, MCP configuration, and steering files |
| **Deliverables** | POWER.md, mcp.json, steering/*.md |

### Scope
- POWER.md with frontmatter (name, keywords, description), onboarding steps, and steering mappings
- mcp.json configuring both MCP servers (official GitHub + custom Projects V2)
- Steering files:
  - `project-setup.md` — Creating and configuring GitHub Projects
  - `issue-management.md` — Issue creation, labeling, organization patterns
  - `board-management.md` — Board item management and status workflows

### Code Organization
```
POWER.md
mcp.json
steering/
+-- project-setup.md
+-- issue-management.md
+-- board-management.md
```

### Dependencies
- Requires Unit 1 (server) to be built and available as Docker image
- Requires `GITHUB_TOKEN` environment variable documentation

---

## Unit 3: Automation Hooks

| Attribute | Value |
|---|---|
| **Name** | `hooks` |
| **Type** | Automation / Event Handlers |
| **Priority** | 3 (Final layer — requires both server and config) |
| **Description** | Kiro hooks for automated AIDLC integration, PR status checks, and spec-to-issues conversion |
| **Deliverables** | hooks/*.kiro.hook |

### Scope
- `aidlc-sync.kiro.hook` — Sync AIDLC task completion with project board (postTaskExecution)
- `pr-status.kiro.hook` — On-demand PR status summary (userTriggered)
- `spec-to-issues.kiro.hook` — Convert AIDLC stories to GitHub issues (userTriggered)

### Code Organization
```
hooks/
+-- aidlc-sync.kiro.hook
+-- pr-status.kiro.hook
+-- spec-to-issues.kiro.hook
```

### Dependencies
- Requires Unit 1 (server) for Projects V2 operations
- Requires Unit 2 (config) for MCP server availability
- Requires official GitHub MCP Server for issue/PR operations

---

## Development Order

```
Unit 1: github-projects-server  (FIRST - core capability)
         |
         | provides tools for
         v
Unit 2: power-config            (SECOND - configures and documents)
         |
         | enables automation via
         v
Unit 3: hooks                   (THIRD - automation layer)
```

## Greenfield Code Organization Strategy

Final deliverable directory structure:
```
kiro-powers-github/
+-- POWER.md                    (Unit 2)
+-- mcp.json                    (Unit 2)
+-- README.md                   (project root)
+-- LICENSE                     (project root)
+-- steering/                   (Unit 2)
|   +-- project-setup.md
|   +-- issue-management.md
|   +-- board-management.md
+-- hooks/                      (Unit 3)
|   +-- aidlc-sync.kiro.hook
|   +-- pr-status.kiro.hook
|   +-- spec-to-issues.kiro.hook
+-- server/                     (Unit 1)
    +-- package.json
    +-- package-lock.json
    +-- tsconfig.json
    +-- Dockerfile
    +-- .dockerignore
    +-- src/
    |   +-- index.ts
    |   +-- tools/
    |   +-- graphql/
    |   +-- cache/
    |   +-- validation/
    +-- dist/
```
