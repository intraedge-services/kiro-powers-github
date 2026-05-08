# Unit Test Execution

## Run Unit Tests

### 1. Execute All Unit Tests

```bash
cd server
npm test
```

This runs Vitest in single-run mode (`vitest run`).

### 2. Expected Results

- **Validation Tests** (`validation.test.ts`):
  - Tests for `createProjectSchema` (valid input, empty owner, long owner, long title, optional description)
  - Tests for `listProjectsSchema` (defaults, invalid type, first > 100)
  - Tests for `addItemSchema` (valid input, defaults, PR type)
  - Tests for `updateItemStatusSchema` (valid, empty status, long status)
  - Tests for `createFieldSchema` (single select with options, text without options, invalid type)
  - Tests for `createIterationSchema` (valid date, invalid date format, duration > 42)
  - Tests for `bulkAddItemsSchema` (valid array, empty array, array > 50)
  - Tests for `getStaleItemsSchema` (default staleDays, staleDays > 365)
  - **Expected**: ~20 tests pass, 0 failures

- **Cache Tests** (`cache.test.ts`):
  - get/set: returns null for missing, stores and retrieves, expires after TTL
  - invalidate: removes entry, handles non-existent key
  - invalidateProject: removes all project-related entries
  - clear: removes all JSON files
  - getStatus: empty status, correct item count
  - corruption recovery: handles invalid JSON gracefully
  - directory creation: creates cache dir if missing
  - **Expected**: ~10 tests pass, 0 failures

### 3. Total Expected Results

| Suite | Tests | Expected |
|---|---|---|
| validation.test.ts | ~20 | All pass |
| cache.test.ts | ~10 | All pass |
| **Total** | **~30** | **0 failures** |

### 4. Test Coverage

Coverage is not enforced for this project (PBT extension disabled), but tests cover:
- All Zod schema validation (boundary conditions, type checking, defaults)
- Cache lifecycle (set, get, expire, invalidate, clear, corrupt recovery)

### 5. Fix Failing Tests

If tests fail:
1. Review test output — Vitest shows the failing assertion and expected vs actual values
2. Check if the schema definition matches the test expectation
3. For cache tests, ensure the test cache directory is writable
4. Run individual test file: `npx vitest run src/__tests__/validation.test.ts`
