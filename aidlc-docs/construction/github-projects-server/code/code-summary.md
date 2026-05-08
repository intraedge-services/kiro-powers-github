# Code Summary: github-projects-server (Unit 1)

## Generated Files

### Project Configuration
| File | Purpose |
|---|---|
| `server/package.json` | Dependencies, scripts, metadata |
| `server/tsconfig.json` | Strict TypeScript configuration |
| `server/Dockerfile` | Multi-stage Docker build (node:20-alpine) |
| `server/.dockerignore` | Docker build exclusions |

### Core Infrastructure
| File | Purpose |
|---|---|
| `server/src/index.ts` | MCP server entry point, tool registration, global error handler |
| `server/src/utils/logger.ts` | Structured logging (no secrets) |
| `server/src/graphql/client.ts` | Authenticated GraphQL client with rate limit tracking and retry |
| `server/src/graphql/queries.ts` | All read queries for Projects V2 |
| `server/src/graphql/mutations.ts` | All write mutations for Projects V2 |
| `server/src/cache/manager.ts` | File-based cache with TTL and corruption recovery |
| `server/src/validation/schemas.ts` | Zod schemas for all 36 tool inputs |

### Tool Handlers (36 tools)
| File | Tools | Stories |
|---|---|---|
| `server/src/tools/projects.ts` | 5 | 2.1, 2.2 |
| `server/src/tools/items.ts` | 7 | 2.3, 2.5, 2.6 |
| `server/src/tools/status.ts` | 3 | 2.4 |
| `server/src/tools/fields.ts` | 4 | 5.1 |
| `server/src/tools/iterations.ts` | 4 | 5.2 |
| `server/src/tools/views.ts` | 3 | 5.3 |
| `server/src/tools/workflows.ts` | 4 | 5.5 |
| `server/src/tools/analytics.ts` | 3 | — |
| `server/src/tools/cache-tools.ts` | 3 | — |

### Unit Tests
| File | Coverage |
|---|---|
| `server/src/__tests__/validation.test.ts` | All Zod schemas (valid/invalid inputs) |
| `server/src/__tests__/cache.test.ts` | Cache manager (TTL, invalidation, corruption, directory creation) |

### Documentation
| File | Purpose |
|---|---|
| `server/README.md` | Setup, environment variables, tool reference |

## Security Baseline Compliance
- SECURITY-03: Structured logging via `utils/logger.ts`, no secrets in output
- SECURITY-05: Zod validation on all inputs, parameterized GraphQL variables
- SECURITY-09: Non-root Docker user, generic error messages
- SECURITY-10: Lock file, pinned dependencies, Alpine base image
- SECURITY-12: PAT via env var only, format validation on startup
- SECURITY-15: Global error handler, try/catch on all external calls, fail-closed
