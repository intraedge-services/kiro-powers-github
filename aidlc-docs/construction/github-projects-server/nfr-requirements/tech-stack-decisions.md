# Tech Stack Decisions: github-projects-server

## Runtime & Language

| Decision | Choice | Rationale |
|---|---|---|
| Language | TypeScript | Strong typing, excellent MCP SDK support, team familiarity |
| Runtime | Node.js 20 LTS | Stable, long-term support, Alpine image available |
| Module System | ESM (`"type": "module"`) | Modern standard, tree-shaking support |
| Target | ES2022 | Node 20 supports all ES2022 features natively |

## Core Dependencies

| Package | Version | Purpose | Rationale |
|---|---|---|---|
| `@modelcontextprotocol/sdk` | `^1.x` | MCP server framework | Official SDK, stdio transport |
| `graphql-request` | `^6.x` | GraphQL HTTP client | Lightweight, typed, minimal deps |
| `zod` | `^3.x` | Input validation | Runtime validation + TS type inference |

## Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| `typescript` | `^5.x` | TypeScript compiler |
| `@types/node` | `^20.x` | Node.js type definitions |
| `vitest` | `^1.x` | Unit test runner |
| `tsx` | `^4.x` | TypeScript execution for development |

## Containerization

| Decision | Choice | Rationale |
|---|---|---|
| Base Image | `node:20-alpine` | Small footprint (~50MB), security-focused |
| Build Strategy | Multi-stage | Separate build and runtime stages, smaller final image |
| User | Non-root (`node` user) | Security best practice (SECURITY-09) |
| Tag | `latest` only | Simple for initial release, semver later if needed |

## Caching

| Decision | Choice | Rationale |
|---|---|---|
| Storage | File-based JSON | Persistent across sessions, simple implementation |
| Location | `.kiro/github-cache/` | Workspace-local, gitignored |
| TTL | 300s (configurable) | Balance between freshness and API call reduction |
| Invalidation | Write-through | Any mutation invalidates related cache entries |
| Format | One JSON file per project | Simple file management, atomic reads/writes |

## GraphQL Client Configuration

| Decision | Choice | Rationale |
|---|---|---|
| Endpoint | `https://api.github.com/graphql` | Official GitHub GraphQL endpoint |
| Auth Header | `Authorization: Bearer ${GITHUB_TOKEN}` | Standard GitHub PAT auth |
| Timeout | 30 seconds | Generous for complex queries |
| Retry | 3 attempts, exponential backoff | Handle transient failures |
| User-Agent | `kiro-github-projects-mcp/1.0` | Identify requests to GitHub |

## Error Handling Strategy

| Scenario | Approach |
|---|---|
| Invalid input | Return MCP error with validation details |
| Network timeout | Retry up to 3x with backoff |
| Rate limited (429) | Wait for reset, then retry |
| Auth failure (401) | Return error, suggest checking PAT |
| Not found (404) | Return error with resource context |
| Server error (5xx) | Retry up to 3x with backoff |
| Cache corruption | Log warning, fall back to fresh API call |
| Unhandled exception | Global handler catches, returns generic error |

## Decisions NOT Made (Deferred)

| Topic | Reason |
|---|---|
| CI/CD pipeline | Not needed for initial Power release |
| Monitoring/alerting | Local process, logging sufficient |
| Database | No persistent storage needed |
| Authentication service | Single PAT, no multi-user auth |
| CDN/static assets | No web frontend |
