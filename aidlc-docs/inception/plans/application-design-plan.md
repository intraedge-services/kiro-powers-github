# Application Design Plan: Kiro Power for GitHub

## Plan Overview
This plan defines the component architecture for the GitHub Kiro Power, including the custom Projects V2 MCP server, Power configuration, steering files, and hooks.

---

## Clarifying Questions

### Question 1
What programming language/runtime should the custom Projects V2 MCP server use?

A) TypeScript with Node.js — modern, strong typing, excellent MCP SDK support (`@modelcontextprotocol/sdk`)
B) Python — simpler, good MCP SDK support (`mcp` package via uvx)
C) Go — compiled binary, fast startup, no runtime dependency
D) Other (please describe after [Answer]: tag below)

[Answer]: A

### Question 2
How should the custom MCP server be distributed/run?

A) Via `npx` — users run `npx @your-org/github-projects-mcp-server` (requires npm publish)
B) Via `node` pointing to local source — Power includes the server source code, runs with `node dist/index.js`
C) Via Docker — containerized server alongside the official GitHub MCP Server
D) Other (please describe after [Answer]: tag below)

[Answer]: C

### Question 3
How should the two MCP servers (official GitHub + custom Projects V2) be coordinated?

A) Completely independent — two separate server entries in `mcp.json`, Kiro routes to the right one based on tool name
B) Proxy pattern — custom server wraps the official server, exposing all tools through a single entry point
C) Sidecar pattern — both servers run independently but share the same PAT configuration
D) Other (please describe after [Answer]: tag below)

[Answer]: C

### Question 4
What level of GitHub Projects V2 GraphQL operations should the custom server expose?

A) Minimal (8-10 tools) — create project, list projects, add item, move item, get items, update field, create iteration, delete item
B) Standard (15-20 tools) — Minimal + create/manage views, manage custom fields, archive items, project templates, bulk operations
C) Comprehensive (25+ tools) — Standard + workflow automation rules, cross-project operations, analytics/reporting queries
D) Other (please describe after [Answer]: tag below)

[Answer]: C

### Question 5
Should the Power include a project state cache to reduce API calls?

A) No cache — every operation makes fresh API calls (simpler, always current)
B) Simple in-memory cache — cache project structure and item list, invalidate on mutations (faster reads, slightly stale)
C) File-based cache — persist project state to `.kiro/` directory for cross-session continuity
D) Other (please describe after [Answer]: tag below)

[Answer]: C

---

## Design Generation Steps

- [x] Step 1: Define component architecture (Power, MCP servers, steering, hooks)
- [x] Step 2: Define component responsibilities and boundaries
- [x] Step 3: Define component methods/tool signatures
- [x] Step 4: Define service layer and orchestration patterns
- [x] Step 5: Define component dependencies and communication
- [x] Step 6: Generate all design artifacts
- [x] Step 7: Validate design completeness and consistency
