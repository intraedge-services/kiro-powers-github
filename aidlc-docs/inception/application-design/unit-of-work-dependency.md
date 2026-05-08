# Unit of Work Dependencies

## Dependency Matrix

| Unit | Depends On | Depended By | Dependency Type |
|---|---|---|---|
| Unit 1: github-projects-server | GITHUB_TOKEN (env), Docker, GitHub GraphQL API | Unit 2, Unit 3 | Runtime |
| Unit 2: power-config | Unit 1 (Docker image reference in mcp.json) | Unit 3 | Configuration |
| Unit 3: hooks | Unit 1 (tools), Unit 2 (MCP config active) | None | Runtime |

---

## Dependency Graph

```
+-----------------------------------+
|  External Dependencies            |
|  - GITHUB_TOKEN (PAT)             |
|  - Docker runtime                 |
|  - GitHub REST API                |
|  - GitHub GraphQL API             |
|  - Official GitHub MCP Server     |
+-----------------------------------+
         |
         | required by
         v
+-----------------------------------+
|  Unit 1: github-projects-server   |
|  (Core - no internal deps)        |
+-----------------------------------+
         |
         | Docker image referenced by
         v
+-----------------------------------+
|  Unit 2: power-config             |
|  (mcp.json points to Unit 1)      |
+-----------------------------------+
         |
         | MCP tools available for
         v
+-----------------------------------+
|  Unit 3: hooks                    |
|  (triggers agent to use tools)    |
+-----------------------------------+
```

---

## Integration Points

### Unit 1 → Unit 2 Integration
- **Contract**: Unit 2's `mcp.json` references Unit 1's Docker image name and tag
- **Validation**: Unit 1 must be built and image available before Unit 2 can be tested end-to-end
- **Fallback**: Unit 2 can be developed with placeholder image reference, tested after Unit 1 is ready

### Unit 2 → Unit 3 Integration
- **Contract**: Unit 3's hooks assume MCP servers are configured and running (via Unit 2's mcp.json)
- **Validation**: Hooks can be developed independently (they just contain JSON config + prompts)
- **Fallback**: Hooks can be tested once Unit 1 + Unit 2 are integrated

### Cross-Unit Shared Resources
- **GITHUB_TOKEN**: Shared environment variable used by both MCP servers
- **`.kiro/github-cache/`**: Created and managed exclusively by Unit 1
- **Tool names**: Unit 3 hook prompts reference tool names from Unit 1 (e.g., `update_item_status`)

---

## Build Order Constraints

| Step | Unit | Action | Blocker |
|---|---|---|---|
| 1 | Unit 1 | Develop TypeScript server | None |
| 2 | Unit 1 | Build Docker image | TypeScript compilation |
| 3 | Unit 2 | Write POWER.md, mcp.json, steering files | Unit 1 Docker image name |
| 4 | Unit 3 | Write hook JSON files | None (can parallel with Unit 2) |
| 5 | Integration | Test all units together | Units 1, 2, 3 complete |

---

## Risk Assessment per Unit

| Unit | Risk | Mitigation |
|---|---|---|
| Unit 1 | Medium — GraphQL API complexity, rate limits | Comprehensive error handling, cache layer |
| Unit 2 | Low — Static configuration files | Template-based, well-documented structure |
| Unit 3 | Low — Simple JSON hook definitions | Standard Kiro hook format, tested prompts |
