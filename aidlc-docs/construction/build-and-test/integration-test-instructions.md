# Integration Test Instructions

## Purpose
Test the complete MCP server end-to-end with real GitHub API calls to verify tool functionality.

**Note**: Integration tests require a valid `GITHUB_TOKEN` and a test GitHub Project. They are designed to be run manually, not in CI.

## Prerequisites

1. A GitHub PAT with `repo`, `project`, `read:org` scopes
2. A test repository (can be private)
3. Docker running locally

## Setup Test Environment

### 1. Create a Test Project

```bash
# Set your token
export GITHUB_TOKEN="ghp_your_token"

# Start the MCP server
cd server
npm run dev
```

In a separate terminal, send MCP requests via stdin:

### 2. Test Tool Calls

Use JSON-RPC format to test individual tools:

```json
{"jsonrpc":"2.0","method":"tools/call","params":{"name":"list_projects","arguments":{"owner":"your-username","type":"user","first":5}},"id":1}
```

## Test Scenarios

### Scenario 1: Project Lifecycle
1. `create_project` — Create a test project
2. `get_project` — Verify project exists
3. `get_status_options` — Verify default status columns
4. `update_project` — Change title/description
5. `delete_project` — Clean up

**Expected**: Each operation succeeds, project is created and deleted cleanly.

### Scenario 2: Item Management
1. Create a test issue in the repository (via `github` MCP server)
2. `add_item_to_project` — Add issue to project
3. `get_project_items` — Verify item appears
4. `update_item_status` — Move to "In Progress"
5. `get_project_items` — Verify status changed
6. `archive_item` — Archive the item
7. `remove_item_from_project` — Remove from project

**Expected**: Item flows through the board correctly.

### Scenario 3: Cache Behavior
1. `get_project_items` — First call (cache miss, hits API)
2. `get_project_items` — Second call (cache hit, no API call)
3. `update_item_status` — Mutation invalidates cache
4. `get_project_items` — Third call (cache miss after invalidation)
5. `get_cache_status` — Verify cache state
6. `clear_cache` — Clear all cache

**Expected**: Cache hits reduce API calls, mutations invalidate correctly.

### Scenario 4: Rate Limit Handling
1. Make rapid successive calls to verify rate limit tracking
2. Check that rate limit info appears in responses when below 20%
3. Verify server doesn't crash on rate limit (graceful queuing)

**Expected**: Rate limit state is tracked and reported.

### Scenario 5: Error Handling
1. Call `get_project` with invalid owner — should return error message
2. Call `update_item_status` with invalid status name — should list available options
3. Call any tool without `GITHUB_TOKEN` set — server should fail to start

**Expected**: All errors are handled gracefully with helpful messages.

## Cleanup

After testing:
1. Delete any test projects created
2. Close any test issues created
3. Clear the cache: call `clear_cache` tool
