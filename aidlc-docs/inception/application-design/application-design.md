# Application Design: Kiro Power for GitHub

## Executive Summary

The Kiro Power for GitHub is a comprehensive integration that combines the official GitHub MCP Server with a custom TypeScript-based Projects V2 MCP server, steering files, and automation hooks. It enables developers, project managers, and team leads to manage GitHub Projects, issues, PRs, and workflows entirely from within Kiro IDE using natural language.

---

## Architecture Overview

**Pattern**: Sidecar MCP Servers with shared authentication

```
+------------------------------------------------------------------+
|                        Kiro IDE                                   |
|  +------------------------------------------------------------+  |
|  |  Agent (routes tool calls based on tool name)               |  |
|  +------------------------------------------------------------+  |
|       |                    |                    |                  |
|       v                    v                    v                  |
|  +-----------+    +----------------+    +-------------+           |
|  | Steering  |    | Hook System    |    | MCP Router  |           |
|  | Files (3) |    | (3 hooks)      |    |             |           |
|  +-----------+    +----------------+    +------+------+           |
|                                                |                  |
+------------------------------------------------|------------------+
                                                 |
                          +----------------------+----------------------+
                          |                                             |
                          v                                             v
               +---------------------+                    +------------------------+
               | github              |                    | github-projects        |
               | (Official Server)   |                    | (Custom Server)        |
               |                     |                    |                        |
               | 51 REST tools       |                    | 25+ GraphQL tools      |
               | Docker/Remote       |                    | Docker (TypeScript)    |
               +----------+----------+                    +----------+-------------+
                          |                                          |
                          v                                          v
               +---------------------+                    +------------------------+
               | GitHub REST API     |                    | GitHub GraphQL API     |
               | api.github.com      |                    | api.github.com/graphql |
               +---------------------+                    +----------+-------------+
                                                                     |
                                                                     v
                                                          +------------------------+
                                                          | .kiro/github-cache/    |
                                                          | (file-based cache)     |
                                                          +------------------------+
```

---

## Components (5)

| # | Component | Type | Key Responsibility |
|---|---|---|---|
| 1 | POWER.md | Config/Docs | Power metadata, onboarding, steering mappings |
| 2 | mcp.json | Config | Dual MCP server configuration |
| 3 | Custom Projects V2 Server | MCP Server | 25+ GraphQL tools for Projects V2 |
| 4 | Steering Files (3) | Guidance | Workflow-specific best practices |
| 5 | Hooks (3) | Automation | Event-driven board sync and notifications |

---

## Custom MCP Server: Tool Categories (25+ tools)

| Category | Tools | Purpose |
|---|---|---|
| Project Management | 5 | Create, list, get, update, delete projects |
| Item Management | 7 | Add, remove, get, archive, unarchive, bulk ops |
| Status Transitions | 3 | Move items, bulk move, get status options |
| Custom Fields | 4 | Create, update, list, delete fields |
| Iterations/Sprints | 4 | Create, assign, list, get iteration items |
| View Management | 3 | Create, list, delete views |
| Workflow Automation | 4 | Create auto-add, create status workflow, list, toggle |
| Analytics/Reporting | 3 | Stats, burndown, stale items |
| Cache Management | 3 | Refresh, status, clear |
| **Total** | **36 tools** | |

---

## Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| MCP Server Runtime | TypeScript + Node.js | Strong typing, excellent MCP SDK support |
| MCP Framework | `@modelcontextprotocol/sdk` | Official MCP SDK |
| GraphQL Client | `graphql-request` | Lightweight, typed GraphQL client |
| Input Validation | `zod` | Runtime type validation with TypeScript inference |
| Containerization | Docker | Consistent runtime, easy distribution |
| Cache Storage | File system (JSON) | Simple, persistent across sessions |

---

## Key Design Decisions

1. **Sidecar over Proxy**: Two independent servers rather than wrapping the official server. Simpler, no coupling to official server internals, independent versioning.

2. **Docker for both**: Consistent deployment model. Users need Docker regardless (for official server in local mode), so no additional dependency.

3. **File-based cache**: Persists across Kiro sessions. Stored in `.kiro/github-cache/` to keep it workspace-local. TTL-based invalidation (default 5 minutes).

4. **Comprehensive tool set (36 tools)**: Covers the full Projects V2 API surface. Users can do everything from Kiro that they could do in the GitHub UI.

5. **Hooks trigger agent, not servers directly**: Hooks use `askAgent` pattern so the agent can make intelligent decisions about what operations to perform based on context.

---

## Security Considerations (SECURITY Baseline)

| Rule | Compliance Approach |
|---|---|
| SECURITY-01 | All API calls use HTTPS/TLS. No local data stores requiring encryption at rest. |
| SECURITY-03 | Structured logging in MCP server (timestamp, level, message). No PAT in logs. |
| SECURITY-05 | Zod schemas validate all tool inputs. No raw user input in GraphQL queries. |
| SECURITY-09 | No default credentials. PAT via env var only. Generic error messages to user. |
| SECURITY-10 | Lock file committed. Pinned dependency versions. Docker image with specific tag. |
| SECURITY-12 | PAT stored as env var, never in source. No hardcoded credentials. |
| SECURITY-15 | All GraphQL calls wrapped in try/catch. Fail-closed on errors. Global error handler. |

---

## File Structure (Final Deliverable)

```
kiro-powers-github/
+-- POWER.md
+-- mcp.json
+-- steering/
|   +-- project-setup.md
|   +-- issue-management.md
|   +-- board-management.md
+-- hooks/
|   +-- aidlc-sync.kiro.hook
|   +-- pr-status.kiro.hook
|   +-- spec-to-issues.kiro.hook
+-- server/
|   +-- package.json
|   +-- tsconfig.json
|   +-- Dockerfile
|   +-- src/
|   |   +-- index.ts
|   |   +-- tools/
|   |   |   +-- projects.ts
|   |   |   +-- items.ts
|   |   |   +-- status.ts
|   |   |   +-- fields.ts
|   |   |   +-- iterations.ts
|   |   |   +-- views.ts
|   |   |   +-- workflows.ts
|   |   |   +-- analytics.ts
|   |   |   +-- cache.ts
|   |   +-- graphql/
|   |   |   +-- client.ts
|   |   |   +-- queries.ts
|   |   |   +-- mutations.ts
|   |   +-- cache/
|   |   |   +-- manager.ts
|   |   +-- validation/
|   |       +-- schemas.ts
|   +-- dist/               (compiled output)
+-- README.md
+-- LICENSE
```
