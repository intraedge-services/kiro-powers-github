# NFR Requirements: github-projects-server

## Usage Context
- **Scale**: Team/org (5-20 developers, 500-2000 API calls/day)
- **Latency**: Flexible — correctness prioritized over speed
- **Rate Limits**: Proactive tracking with warnings and request queuing
- **Logging**: Standard (errors + warnings + info)
- **Versioning**: Simple Docker `latest` tag

---

## NFR-01: Security Requirements

### NFR-01.1: Credential Management
- PAT MUST be read exclusively from `GITHUB_TOKEN` environment variable
- PAT MUST NOT appear in any log output, error messages, or cache files
- PAT MUST NOT be stored in source code, configuration files, or Docker image layers
- Server MUST fail to start if `GITHUB_TOKEN` is not set (fail-closed)

### NFR-01.2: Input Validation
- ALL tool inputs MUST be validated using Zod schemas before processing
- Invalid inputs MUST return descriptive error messages without exposing internals
- String inputs MUST have maximum length constraints (owner: 39 chars, repo: 100 chars, title: 256 chars, body: 65536 chars)
- Numeric inputs MUST have range validation (projectNumber > 0, first: 1-100)
- No raw user input MUST be interpolated into GraphQL queries (use parameterized variables)

### NFR-01.3: Logging Security
- Log output MUST include: timestamp, log level, tool name, operation result
- Log output MUST NOT include: PAT value, full GraphQL responses with sensitive data, user PII
- Cache file contents MUST NOT contain authentication tokens
- Error messages returned to users MUST be generic (no stack traces, no internal paths)

### NFR-01.4: Network Security
- ALL GitHub API calls MUST use HTTPS (TLS 1.2+)
- Server MUST validate TLS certificates (no `NODE_TLS_REJECT_UNAUTHORIZED=0`)
- Docker image MUST run as non-root user

---

## NFR-02: Performance Requirements

### NFR-02.1: Response Time
- No strict latency SLA — correctness prioritized over speed
- Cache hits SHOULD respond in < 100ms (file read only)
- Cache misses acceptable at GitHub API latency (typically 200ms-2s)
- Bulk operations MAY take longer proportional to item count

### NFR-02.2: Caching Strategy
- File-based cache in `.kiro/github-cache/` directory
- Cache TTL: 300 seconds (5 minutes) by default, configurable via `GITHUB_PROJECTS_CACHE_TTL`
- Cache invalidation: Automatic on any mutation (write-through invalidation)
- Cache scope: Project structure, item lists, field definitions
- Cache format: JSON files, one per project (keyed by project ID)

### NFR-02.3: Rate Limit Management
- Server MUST track `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers from GitHub API
- Server MUST include rate limit status in tool responses when below 20% remaining
- Server MUST warn user when rate limit drops below 10% (< 500 remaining)
- Server MUST queue requests and wait for reset when rate limit is exhausted (0 remaining)
- Rate limit state MUST be shared across all tool calls within a session

### NFR-02.4: Pagination
- List operations MUST support pagination (default: 20 items, max: 100)
- Large result sets MUST use cursor-based pagination (GitHub GraphQL standard)
- Server MUST NOT fetch all pages automatically — return one page with pagination info

---

## NFR-03: Reliability Requirements

### NFR-03.1: Error Handling
- ALL external calls (GraphQL API, file I/O) MUST have explicit try/catch error handling
- Server MUST have a global error handler that catches unhandled exceptions
- On error, server MUST return a structured MCP error response (never crash)
- Error responses MUST include: error type, user-friendly message, suggested action
- Server MUST NOT expose internal state on error (fail-closed)

### NFR-03.2: Retry Logic
- Transient errors (network timeout, 502/503/504) MUST be retried with exponential backoff
- Retry policy: max 3 attempts, initial delay 1s, backoff factor 2x (1s, 2s, 4s)
- Non-transient errors (400, 401, 403, 404, 422) MUST NOT be retried
- Rate limit errors (429) MUST wait for `X-RateLimit-Reset` before retrying

### NFR-03.3: Graceful Degradation
- If cache file is corrupted or unreadable, server MUST fall back to fresh API calls
- If GitHub API is unreachable, server MUST return clear error (not hang indefinitely)
- HTTP timeout: 30 seconds per request
- If cache directory doesn't exist, server MUST create it on first write

### NFR-03.4: Startup Validation
- Server MUST validate `GITHUB_TOKEN` is set on startup
- Server MUST validate token format (starts with `ghp_` or `github_pat_`)
- Server MUST NOT validate token against API on startup (avoid unnecessary API call)
- Server MUST log successful startup with version and configured cache directory

---

## NFR-04: Maintainability Requirements

### NFR-04.1: Code Structure
- One file per tool category (projects.ts, items.ts, status.ts, etc.)
- Shared utilities in dedicated modules (graphql/client.ts, cache/manager.ts, validation/schemas.ts)
- Clear separation: tool handlers → validation → GraphQL client → cache
- No circular dependencies between modules

### NFR-04.2: Type Safety
- Strict TypeScript configuration (`strict: true`, `noImplicitAny: true`)
- All tool inputs typed with Zod schemas (runtime validation + TypeScript inference)
- All GraphQL responses typed with TypeScript interfaces
- No `any` types in production code

### NFR-04.3: Documentation
- JSDoc comments on all exported functions
- README.md with setup instructions, environment variables, and tool reference
- Inline comments for complex GraphQL queries explaining the query structure

### NFR-04.4: Testing Strategy
- Unit tests for validation schemas (Zod schema correctness)
- Unit tests for cache manager (TTL, invalidation, corruption recovery)
- Integration tests for GraphQL queries (requires PAT — documented as manual)
- No property-based testing (PBT extension disabled)

---

## NFR-05: Operational Requirements

### NFR-05.1: Logging Format
- Structured logging: `[TIMESTAMP] [LEVEL] [TOOL] message`
- Levels: ERROR, WARN, INFO
- INFO: Tool invocations, cache hits/misses, rate limit status
- WARN: Rate limit approaching threshold, cache corruption recovered
- ERROR: API failures, validation errors, unhandled exceptions

### NFR-05.2: Health Indicators
- Server startup log confirms: version, cache directory, token presence (not value)
- Cache status tool provides operational visibility
- Rate limit tracking provides proactive capacity awareness

### NFR-05.3: Docker Configuration
- Base image: `node:20-alpine` (small, secure)
- Non-root user execution
- Multi-stage build (build stage + runtime stage)
- `.dockerignore` excludes: node_modules, .git, src/ (only dist/ in final image)
- Single `latest` tag for simplicity

---

## Security Baseline Compliance

| Rule | Status | Implementation |
|---|---|---|
| SECURITY-01 | N/A | No persistent data stores (cache is ephemeral, non-sensitive) |
| SECURITY-02 | N/A | No network intermediaries (MCP server is local process) |
| SECURITY-03 | Compliant | Structured logging with timestamp, level, tool name. No secrets in logs. |
| SECURITY-04 | N/A | No web application / HTML endpoints |
| SECURITY-05 | Compliant | Zod schemas validate all inputs. Parameterized GraphQL variables. |
| SECURITY-06 | N/A | No IAM policies (local process, single PAT) |
| SECURITY-07 | N/A | No network configuration (Docker internal only) |
| SECURITY-08 | N/A | No multi-user auth (single PAT, local process) |
| SECURITY-09 | Compliant | No default credentials. Generic error messages. Non-root Docker. |
| SECURITY-10 | Compliant | Lock file committed. Pinned deps. Alpine base image (not `latest` Node). |
| SECURITY-11 | Compliant | Validation isolated in schemas.ts. Rate limiting built-in. |
| SECURITY-12 | Compliant | PAT via env var only. No hardcoded credentials. Token format validation. |
| SECURITY-13 | N/A | No deserialization of untrusted data. No CDN resources. |
| SECURITY-14 | N/A | Local process — no alerting infrastructure needed. Logging covers observability. |
| SECURITY-15 | Compliant | All external calls in try/catch. Global error handler. Fail-closed. Resource cleanup. |
