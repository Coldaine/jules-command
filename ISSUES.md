# Jules Command — Issue Tracker

Track all issues identified in the code review. Each issue should be resolved before production deployment.

---

## 🚨 Critical Issues (BLOCKING)

### Issue #1: SQL Injection in `jules_query` Tool
**Severity**: CRITICAL
**Status**: Open
**Phase**: 0
**File**: `src/mcp/tools/index.ts:146-158`

**Problem**: The `jules_query` tool accepts arbitrary `where` objects and `orderBy` strings without validation, creating a direct SQL injection vector.

**Solution**: Remove `jules_query` and replace with safe, parameterized tools:
- `jules_sessions_by_state`
- `jules_sessions_by_repo`
- `jules_recent_activities`
- `pr_list_pending`

**Assigned**: -
**Target**: PR #8

---

### Issue #2: StallDetector References Non-Existent Fields
**Severity**: CRITICAL
**Status**: Open
**Phase**: 0
**File**: `src/services/stall-detector.ts:63-65`

**Problem**: The `repeated_errors` rule accesses `a.hasBashOutput` and `a.progressDescription` which don't exist in the `julesActivities` schema.

**Solution**: Either add these fields to the schema or rewrite the rule to use existing fields (`activityType`, `content`).

**Assigned**: -
**Target**: PR #8

---

### Issue #3: Schema Drift Between Drizzle and Tests
**Severity**: CRITICAL
**Status**: Open
**Phase**: 0
**Files**: Multiple test files

**Problem**: Test fixtures reference fields that don't match the actual schema:
- `repo` → should be `repoId`
- `branch` → should be `sourceBranch`
- `createdAt` (activities) → should be `timestamp`
- `stalledAt` → should be `stallDetectedAt`

**Solution**:
1. Generate migrations from Drizzle schema using `drizzle-kit`
2. Fix all test fixtures
3. Add TypeScript strict mode to CI

**Assigned**: -
**Target**: PR #8

---

### Issue #4: Missing Tool Handler Architecture
**Severity**: HIGH
**Status**: Open
**Phase**: 0
**File**: `src/mcp/tools/index.ts`

**Problem**: `ToolDefinition` interface has no `handler` property despite documentation claiming it does.

**Solution**: Add `handler: (args: unknown) => Promise<ToolResponse>` to interface and create handler functions for all 18 tools.

**Assigned**: -
**Target**: PR #8

---

### Issue #5: No Input Validation
**Severity**: HIGH
**Status**: Open
**Phase**: 0
**Files**: All tool definitions

**Problem**: No runtime validation of tool inputs. Invalid inputs will cause runtime errors deep in the service layer.

**Solution**:
1. Create Zod schemas for all 18 tools
2. Add validation wrapper in server
3. Add enum constraints for string fields

**Assigned**: -
**Target**: PR #8

---

### Issue #6: `pr_merge` Has No Safety Gates
**Severity**: HIGH
**Status**: Open
**Phase**: 0
**File**: `src/mcp/tools/index.ts:204-214`

**Problem**: `pr_merge` tool allows merging any PR without checking eligibility, CI status, or review state.

**Solution**:
1. Add `force: boolean` parameter
2. Require auto-merge eligibility check when `force: false`
3. Add `destructiveHint: true` annotation
4. Log warning when `force: true`

**Assigned**: -
**Target**: PR #8

---

## ⚠️ High Priority Issues

### Issue #7: Missing ON DELETE CASCADE
**Severity**: MEDIUM-HIGH
**Status**: Open
**Phase**: 0
**File**: `src/db/migrate.ts`

**Problem**: Foreign key constraints lack `ON DELETE CASCADE`, which will cause constraint violations when deleting parent records.

**Solution**: Add `ON DELETE CASCADE` to all foreign key constraints in migration.

**Assigned**: -
**Target**: PR #8

---

### Issue #8: Missing Enum Constraints
**Severity**: MEDIUM
**Status**: Open
**Phase**: 0
**Files**: Multiple tool schemas

**Problem**: String fields accept any value instead of constraining to valid enums.

**Solution**: Add enum constraints to:
- `jules_list_sessions.state`
- `jules_get_activities.type`
- `pr_update_review.status`

**Assigned**: -
**Target**: PR #8

---

### Issue #9: No Authentication/Authorization
**Severity**: MEDIUM
**Status**: Open
**Phase**: Post-MVP
**File**: `src/mcp/server.ts`

**Problem**: Any MCP client can perform destructive operations without authentication.

**Solution**: Add audit logging for all destructive operations. Consider adding API key authentication for tool access.

**Assigned**: -
**Target**: Phase 6 (Enhancement)

---

### Issue #10: PollCursorRepository Race Condition
**Severity**: MEDIUM
**Status**: Open
**Phase**: 3
**File**: `src/db/repositories/poll-cursor.repo.ts`

**Problem**: `incrementPollCount()` uses read-modify-write pattern which can lose updates.

**Solution**: Use atomic SQL update:
```sql
UPDATE poll_cursors SET poll_count = poll_count + 1, last_poll_at = ? WHERE id = ?
```

**Assigned**: -
**Target**: PR #11

---

### Issue #11: PollManager Missing Dependencies
**Severity**: MEDIUM
**Status**: Open
**Phase**: 3
**File**: `src/services/poll-manager.ts`

**Problem**: PollManager doesn't receive `JulesService` or `GitHubService` but needs them to fulfill its contract.

**Solution**: Update constructor to accept both services.

**Assigned**: -
**Target**: PR #11

---

### Issue #12: DashboardService Missing Config
**Severity**: MEDIUM
**Status**: Open
**Phase**: 3
**File**: `src/services/dashboard.ts`

**Problem**: DashboardService only receives `Db` but needs `Config` for threshold-aware formatting.

**Solution**: Update constructor to accept `Config`.

**Assigned**: -
**Target**: PR #11

---

### Issue #13: No Error Handling Strategy
**Severity**: MEDIUM
**Status**: Open
**Phase**: 1-2
**Files**: All service files

**Problem**: No custom error classes, no retry logic, no MCP error response format.

**Solution**:
1. Create error classes: `JulesApiError`, `GitHubApiError`, etc.
2. Add retry logic with exponential backoff
3. Define MCP error response format

**Assigned**: -
**Target**: PR #9, PR #10

---

## 📝 Medium Priority Issues

### Issue #14: Inconsistent Tool Naming
**Severity**: LOW
**Status**: Open
**Phase**: 5
**File**: `src/mcp/tools/index.ts`

**Problem**: `repo_sync` doesn't follow naming convention (no `jules_` or `pr_` prefix).

**Solution**: Rename to `jules_repo_sync`.

**Assigned**: -
**Target**: PR #13

---

### Issue #15: Misleading Async/Await
**Severity**: LOW
**Status**: Open
**Phase**: Post-MVP
**Files**: All repository files

**Problem**: better-sqlite3 is synchronous; all `async` calls are unnecessary overhead.

**Solution**: Document this architectural decision or consider removing `async`.

**Assigned**: -
**Target**: Phase 6 (Documentation)

---

### Issue #16: Missing Timeout on `jules_send_message`
**Severity**: MEDIUM
**Status**: Open
**Phase**: 5
**File**: `src/mcp/tools/index.ts`

**Problem**: `waitForReply` could block indefinitely with no timeout parameter.

**Solution**: Add `waitTimeout` parameter (default: 120 seconds).

**Assigned**: -
**Target**: PR #13

---

### Issue #17: No PR URL Parser Utility
**Severity**: MEDIUM
**Status**: Open
**Phase**: 2
**Files**: Multiple

**Problem**: Multiple tools parse `https://github.com/{owner}/{repo}/pull/{number}` inconsistently.

**Solution**: Create `src/utils/pr-url.ts` with `parsePrUrl()` function.

**Assigned**: -
**Target**: PR #10

---

### Issue #18: No Structured Logging
**Severity**: MEDIUM
**Status**: Open
**Phase**: 4
**Files**: All

**Problem**: Only `console.log`/`console.error` used; no structured logging or secret redaction.

**Solution**: Add `pino` or `consola` with log levels and secret redaction.

**Assigned**: -
**Target**: PR #12

---

### Issue #19: No Graceful Shutdown
**Severity**: MEDIUM
**Status**: Open
**Phase**: 4
**File**: `src/index.ts`

**Problem**: SQLite connection not closed on process exit.

**Solution**: Add SIGINT/SIGTERM handlers to close DB and exit cleanly.

**Assigned**: -
**Target**: PR #12

---

### Issue #20: No Health Check Tool
**Severity**: LOW
**Status**: Open
**Phase**: 4
**File**: `src/mcp/tools/index.ts`

**Problem**: No diagnostic tool to verify API connectivity and configuration.

**Solution**: Create `jules_health` tool that checks DB, Jules API, and GitHub API.

**Assigned**: -
**Target**: PR #12

---

### Issue #21: No MCP Tool Annotations
**Severity**: LOW
**Status**: Open
**Phase**: 4
**Files**: All tool definitions

**Problem**: Tools don't declare read-only, destructive, or idempotent hints.

**Solution**: Add MCP annotations to all tools.

**Assigned**: -
**Target**: PR #12

---

### Issue #22: No Output Schemas
**Severity**: LOW
**Status**: Open
**Phase**: Post-MVP
**Files**: All tool definitions

**Problem**: MCP supports output schemas but none are defined.

**Solution**: Define output schemas for type safety.

**Assigned**: -
**Target**: Phase 6 (Enhancement)

---

### Issue #23: No CI/CD Pipeline
**Severity**: MEDIUM
**Status**: Open
**Phase**: 5
**File**: `.github/workflows/test.yml` (missing)

**Problem**: No automated testing, linting, or type checking on PRs.

**Solution**: Create GitHub Actions workflow with branch protection rules.

**Assigned**: -
**Target**: PR #13

---

### Issue #24: Test Fixtures Don't Work
**Severity**: MEDIUM
**Status**: Open
**Phase**: 0
**Files**: Multiple test files

**Problem**: 142 skipped tests have incorrect fixtures (field name mismatches).

**Solution**: Fix all fixtures as part of schema drift resolution.

**Assigned**: -
**Target**: PR #8

---

## Summary

| Severity | Open | In Progress | Resolved |
|----------|------|-------------|----------|
| CRITICAL | 6 | 0 | 0 |
| HIGH | 0 | 0 | 0 |
| MEDIUM | 13 | 0 | 0 |
| LOW | 5 | 0 | 0 |
| **Total** | **24** | **0** | **0** |

---

## Issue Template

```markdown
### Issue #X: [Title]
**Severity**: [CRITICAL/HIGH/MEDIUM/LOW]
**Status**: [Open/In Progress/Resolved]
**Phase**: [0-6]
**File**: [file path]

**Problem**: [Description]

**Solution**: [Proposed fix]

**Assigned**: [Name]
**Target**: [PR #]
```

---

**Last Updated**: 2026-02-10
