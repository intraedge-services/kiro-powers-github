# Code Generation Plan: github-projects-server (Unit 1)

## Unit Context
- **Unit**: github-projects-server
- **Type**: Custom MCP Server (TypeScript / Node.js / Docker)
- **Stories**: 11 (Epic 2: Stories 2.1-2.6, Epic 5: Stories 5.1-5.5)
- **Dependencies**: `@modelcontextprotocol/sdk`, `graphql-request`, `zod`
- **Output Location**: `server/` directory in workspace root

## Code Generation Steps

### Phase A: Project Structure Setup

- [ ] Step 1: Create `server/package.json` with dependencies, scripts, and metadata
- [ ] Step 2: Create `server/tsconfig.json` with strict TypeScript configuration
- [ ] Step 3: Create `server/Dockerfile` with multi-stage build (build + runtime)
- [x] Step 1: Create `server/package.json` with dependencies, scripts, and metadata
- [x] Step 2: Create `server/tsconfig.json` with strict TypeScript configuration
- [x] Step 3: Create `server/Dockerfile` with multi-stage build (build + runtime)
- [x] Step 4: Create `server/.dockerignore`

### Phase B: Core Infrastructure

- [x] Step 5: Create `server/src/index.ts` — MCP server entry point with stdio transport, tool registration, global error handler, startup validation
- [x] Step 6: Create `server/src/graphql/client.ts` — Authenticated GraphQL client with rate limit tracking, retry logic, timeout handling
- [x] Step 7: Create `server/src/graphql/queries.ts` — All GraphQL read queries (projects, items, fields, iterations, views, workflows)
- [x] Step 8: Create `server/src/graphql/mutations.ts` — All GraphQL write mutations (create, update, delete, archive operations)
- [x] Step 9: Create `server/src/cache/manager.ts` — File-based cache with TTL, write-through invalidation, corruption recovery
- [x] Step 10: Create `server/src/validation/schemas.ts` — Zod schemas for all 36 tool inputs

### Phase C: Tool Handlers (36 tools)

- [x] Step 11: Create `server/src/tools/projects.ts` — 5 tools: create_project, list_projects, get_project, delete_project, update_project (Stories 2.1, 2.2)
- [x] Step 12: Create `server/src/tools/items.ts` — 7 tools: add_item_to_project, remove_item_from_project, get_project_items, archive_item, unarchive_item, bulk_add_items, bulk_archive_items (Stories 2.3, 2.5, 2.6)
- [x] Step 13: Create `server/src/tools/status.ts` — 3 tools: update_item_status, bulk_update_status, get_status_options (Story 2.4)
- [x] Step 14: Create `server/src/tools/fields.ts` — 4 tools: create_field, update_item_field, get_project_fields, delete_field (Story 5.1)
- [x] Step 15: Create `server/src/tools/iterations.ts` — 4 tools: create_iteration, assign_item_to_iteration, get_iteration_items, list_iterations (Story 5.2)
- [x] Step 16: Create `server/src/tools/views.ts` — 3 tools: create_view, list_views, delete_view (Story 5.3)
- [x] Step 17: Create `server/src/tools/workflows.ts` — 4 tools: create_auto_add_workflow, create_status_workflow, list_workflows, toggle_workflow (Story 5.5)
- [x] Step 18: Create `server/src/tools/analytics.ts` — 3 tools: get_project_stats, get_iteration_burndown, get_stale_items
- [x] Step 19: Create `server/src/tools/cache-tools.ts` — 3 tools: refresh_cache, get_cache_status, clear_cache

### Phase D: Unit Tests

- [x] Step 20: Create `server/src/__tests__/validation.test.ts` — Tests for all Zod schemas (valid/invalid inputs)
- [x] Step 21: Create `server/src/__tests__/cache.test.ts` — Tests for cache manager (TTL, invalidation, corruption recovery, directory creation)

### Phase E: Documentation & Deployment

- [x] Step 22: Create `server/README.md` — Setup instructions, environment variables, tool reference, Docker usage
- [x] Step 23: Create `aidlc-docs/construction/github-projects-server/code/code-summary.md` — Summary of generated code

---

## Story Traceability

| Step(s) | Stories Covered |
|---|---|
| Steps 11 | Story 2.1 (Create Project), Story 2.2 (List Projects) |
| Steps 12 | Story 2.3 (Add Items), Story 2.5 (View Board), Story 2.6 (Archive/Remove) |
| Steps 13 | Story 2.4 (Move Items) |
| Steps 14 | Story 5.1 (Custom Fields) |
| Steps 15 | Story 5.2 (Iterations/Sprints) |
| Steps 16 | Story 5.3 (Project Views) |
| Steps 17 | Story 5.5 (Automated Workflows) |
| Steps 18-19 | Supporting tools (analytics, cache management) |
| Steps 5-10 | Infrastructure supporting all stories |

---

## Generation Approach
- **Core-first**: Build infrastructure (Steps 1-10) before tool handlers (Steps 11-19)
- **One file per tool category**: Each tool file is self-contained with handler functions
- **Shared validation**: All schemas in one file for consistency
- **Tests last**: Unit tests after implementation is stable
