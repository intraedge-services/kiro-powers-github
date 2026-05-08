# NFR Requirements Plan: github-projects-server (Unit 1)

## Plan Overview
Assess non-functional requirements for the custom GitHub Projects V2 MCP server, covering security, performance, reliability, and tech stack decisions.

---

## Clarifying Questions

### Question 1
What is the expected usage scale for this MCP server?

A) Personal use — single developer, occasional project management operations (< 100 API calls/day)
B) Small team — 2-5 developers, moderate usage (100-500 API calls/day)
C) Team/org scale — 5-20 developers, heavy usage (500-2000 API calls/day)
D) Other (please describe after [Answer]: tag below)

[Answer]: C

### Question 2
What response time expectations do you have for MCP tool calls?

A) Fast (< 2 seconds) — tools should respond quickly for interactive use
B) Moderate (< 5 seconds) — acceptable for project management operations
C) Flexible — no strict latency requirements, correctness matters more than speed
D) Other (please describe after [Answer]: tag below)

[Answer]: C

### Question 3
How should the server handle GitHub API rate limits (5000 requests/hour for authenticated users)?

A) Simple — fail with clear error message when rate limited, let user retry
B) Smart — implement exponential backoff with automatic retry (up to 3 attempts)
C) Proactive — track remaining rate limit, warn user when approaching limit, queue requests if needed
D) Other (please describe after [Answer]: tag below)

[Answer]: C

### Question 4
What logging level should the server support?

A) Minimal — errors only, keep output clean
B) Standard — errors + warnings + info (tool calls, cache hits/misses)
C) Configurable — environment variable to set log level (debug/info/warn/error)
D) Other (please describe after [Answer]: tag below)

[Answer]: B

### Question 5
How should the Docker image be versioned and tagged?

A) Simple — `latest` tag only, rebuild as needed
B) Semantic versioning — `v1.0.0`, `v1.1.0`, etc. with `latest` pointing to newest
C) Git-based — tag with git commit SHA + semantic version
D) Other (please describe after [Answer]: tag below)

[Answer]: A

---

## NFR Assessment Steps

- [x] Step 1: Define security requirements (PAT handling, input validation, logging)
- [x] Step 2: Define performance requirements (response times, caching, rate limits)
- [x] Step 3: Define reliability requirements (error handling, retry logic, graceful degradation)
- [x] Step 4: Define maintainability requirements (code structure, testing, documentation)
- [x] Step 5: Document tech stack decisions with rationale
- [x] Step 6: Validate against Security Baseline extension rules
