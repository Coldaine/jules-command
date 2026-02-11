# Jules Command — Implementation Plan

## Overview

This plan addresses critical issues identified in the code review and completes the remaining implementation phases. Each phase ends with a PR review gate to ensure quality and catch issues early.

**Critical Rule**: No self-merging. All PRs require external review before merge.

---

## Phase 0: Critical Fixes (BLOCKING)

**Goal**: Resolve security vulnerabilities and blocking issues before any new development.

**Estimated Effort**: 2-3 days
**PR Gate**: PR #8 - Critical Security & Schema Fixes

### Tasks

#### 0.1: Remove SQL Injection Vector
- [ ] **Remove `jules_query` tool entirely** from `src/mcp/tools/index.ts`
- [ ] Create replacement tools with safe, parameterized queries:
  - [ ] `jules_sessions_by_state` - List sessions filtered by state enum
  - [ ] `jules_sessions_by_repo` - List sessions for a specific repo
  - [ ] `jules_recent_activities` - Get recent activities with type filter
  - [ ] `pr_list_pending` - List pending PRs with filters
- [ ] Update test file `tests/mcp/tools.test.ts` to remove `jules_query` tests
- [ ] Update CURRENT_STATE.md to reflect tool changes

#### 0.2: Fix StallDetector Schema Mismatch
- [ ] **Option A**: Add missing fields to schema (RECOMMENDED)
  - [ ] Add `hasBashOutput BOOLEAN` to `julesActivities` in `src/db/schema.ts`
  - [ ] Add `progressDescription TEXT` to `julesActivities` in `src/db/schema.ts`
  - [ ] Create migration to add columns to existing DB
  - [ ] Update `ActivityRepository` to handle new fields
- [ ] **Option B**: Rewrite the rule to use existing fields
  - [ ] Change `src/services/stall-detector.ts:63-65` to use `activityType` and `content`
  - [ ] Update tests in `tests/services/stall-detector.test.ts`
- [ ] Run stall detector tests: `npm test tests/services/stall-detector.test.ts`
- [ ] Verify all 5 stall rules work correctly

#### 0.3: Fix Schema Drift
- [ ] **Standardize on Drizzle schema as source of truth**
- [ ] Generate migrations from Drizzle using `drizzle-kit generate:sqlite`
- [ ] Update all test fixtures to use correct column names:
  - [ ] `tests/services/poll-manager.test.ts` - Fix `repo` → `repoId`, `branch` → `sourceBranch`
  - [ ] `tests/services/dashboard.test.ts` - Fix field names
  - [ ] `tests/e2e/integration.test.ts` - Fix `createdAt` → `timestamp`, remove fake fields
  - [ ] `tests/mcp/tools.test.ts` - Fix session fixture fields
- [ ] Add TypeScript strict mode and compilation check to prevent future drift
- [ ] Run full test suite: `npm test`

#### 0.4: Add Tool Handler Architecture
- [ ] Update `ToolDefinition` interface in `src/mcp/tools/index.ts`:
  ```typescript
  export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    handler: (args: TInput, context: ToolContext) => Promise<TOutput>;
  }
  ```
- [ ] Define `ToolContext` interface with dependencies (config, db, services)
- [ ] Create `src/mcp/tools/handlers/` directory structure
- [ ] Create stub handlers for all 18 tools (return "Not implemented" for now)
- [ ] Wire handlers into tool definitions

#### 0.5: Add Input Validation Layer
- [ ] Create `src/mcp/tools/schemas.ts` with Zod schemas for all tools
- [ ] Add validation wrapper in `src/mcp/server.ts`:
  ```typescript
  async function validateAndCallTool(tool, args) {
    const validated = tool.zodSchema.parse(args);
    return await tool.handler(validated, context);
  }
  ```
- [ ] Add enum constraints:
  - [ ] Session states: `['queued', 'planning', 'in_progress', 'completed', 'failed', 'awaiting_plan_approval', 'awaiting_user_feedback']`
  - [ ] PR review statuses: `['pending', 'approved', 'changes_requested', 'closed']`
  - [ ] Activity types: `['message', 'plan', 'bash_output', 'file_change', 'error']`
- [ ] Write validation tests in `tests/mcp/validation.test.ts`

#### 0.6: Add Safety Gate to `pr_merge`
- [ ] Update `pr_merge` tool schema to add `force` parameter:
  ```typescript
  force: {
    type: 'boolean',
    description: 'Skip eligibility checks (use with caution)',
    default: false
  }
  ```
- [ ] Update tool handler (when implemented) to:
  - [ ] If `force: false`, call `AutoMergeEvaluator.evaluate()` first
  - [ ] If not eligible, return error with reasons
  - [ ] If `force: true`, log warning and proceed
- [ ] Add `destructiveHint: true` annotation to tool definition
- [ ] Write test in `tests/mcp/tools.test.ts` for safety gate

#### 0.7: Fix Foreign Key Cascades
- [ ] Update `src/db/migrate.ts` to add `ON DELETE CASCADE`:
  ```sql
  repo_id TEXT REFERENCES repos(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES jules_sessions(id) ON DELETE CASCADE,
  ```
- [ ] Test cascade behavior in `tests/db/migrate.test.ts`
- [ ] Verify cascade works: delete repo → sessions deleted

### PR Review Checklist
- [ ] All 6 critical issues resolved
- [ ] All tests passing (112 existing + new tests)
- [ ] No TypeScript compilation errors
- [ ] Test fixtures match schema
- [ ] Security review: SQL injection eliminated
- [ ] External reviewer approval required

**PR #8 Title**: `fix: critical security and schema issues (Phase 0)`

**⛔ STOP: Do not proceed to Phase 1 until PR #8 is merged**

---

## Phase 1: External API Integration - Jules Service

**Goal**: Implement `JulesService` to integrate with `@google/jules-sdk`, making 27 skipped tests pass.

**Estimated Effort**: 3-4 days
**PR Gate**: PR #9 - Jules Service Implementation

### Tasks

#### 1.1: Implement JulesService Core Methods
- [ ] Implement `createSession()` in `src/services/jules.service.ts`
  - [ ] Initialize Jules SDK client with API key
  - [ ] Create session via SDK
  - [ ] Insert session into DB via `SessionRepository`
  - [ ] Return session ID and URL
- [ ] Implement `getSession()`
  - [ ] Fetch session details from Jules API
  - [ ] Upsert to DB
  - [ ] Return formatted session data
- [ ] Implement `listSessions()`
  - [ ] Query from DB (not API, for performance)
  - [ ] Apply filters (state, repo, limit)
- [ ] Implement `getActivities()`
  - [ ] Fetch activities from Jules API
  - [ ] Insert new activities to DB
  - [ ] Return activity list

#### 1.2: Implement JulesService Action Methods
- [ ] Implement `approvePlan()`
  - [ ] Call Jules SDK approve endpoint
  - [ ] Update session state in DB
- [ ] Implement `sendMessage()`
  - [ ] Send message via Jules SDK
  - [ ] If `waitForReply`, poll for response (with timeout)
  - [ ] Record message in activities
- [ ] Implement `getDiff()`
  - [ ] Fetch diff from Jules API
  - [ ] Return formatted diff
- [ ] Implement `getBashOutputs()`
  - [ ] Query activities table for bash_output type
  - [ ] Return outputs

#### 1.3: Add Error Handling & Retry Logic
- [ ] Create custom error classes:
  - [ ] `JulesApiError` - API request failures
  - [ ] `JulesNotFoundError` - Session not found
  - [ ] `JulesTimeoutError` - Request timeout
- [ ] Add retry logic with exponential backoff for transient failures
- [ ] Add timeout to `sendMessage` with `waitForReply`

#### 1.4: Unskip and Pass Jules Service Tests
- [ ] Unskip tests in `tests/services/jules.service.test.ts`
- [ ] Mock Jules SDK client for testing
- [ ] Ensure all 27 tests pass
- [ ] Add integration test with real API (optional, CI-gated)

#### 1.5: Wire Jules Tools to Handlers
- [ ] Implement handlers in `src/mcp/tools/handlers/jules.handlers.ts`:
  - [ ] `jules_create_session` → `JulesService.createSession()`
  - [ ] `jules_list_sessions` → `JulesService.listSessions()`
  - [ ] `jules_get_session` → `JulesService.getSession()`
  - [ ] `jules_get_activities` → `JulesService.getActivities()`
  - [ ] `jules_approve_plan` → `JulesService.approvePlan()`
  - [ ] `jules_send_message` → `JulesService.sendMessage()`
  - [ ] `jules_get_diff` → `JulesService.getDiff()`
  - [ ] `jules_get_bash_outputs` → `JulesService.getBashOutputs()`
- [ ] Format responses as MCP tool results
- [ ] Unskip handler tests in `tests/mcp/tools.test.ts`

### PR Review Checklist
- [ ] 27 Jules service tests passing
- [ ] All tool handlers implemented and tested
- [ ] Error handling comprehensive
- [ ] API key never logged or exposed
- [ ] Timeout protection on blocking calls
- [ ] External reviewer approval required

**PR #9 Title**: `feat: implement Jules Service and tool handlers (Phase 1)`

**⛔ STOP: Do not proceed to Phase 2 until PR #9 is merged**

---

## Phase 2: External API Integration - GitHub Service

**Goal**: Implement `GitHubService` to integrate with Octokit, making 35 skipped tests pass.

**Estimated Effort**: 3-4 days
**PR Gate**: PR #10 - GitHub Service Implementation

### Tasks

#### 2.1: Add PR URL Parser Utility
- [ ] Create `src/utils/pr-url.ts`:
  ```typescript
  export function parsePrUrl(url: string): {
    owner: string;
    repo: string;
    number: number;
  }
  ```
- [ ] Add validation for GitHub URL format
- [ ] Add tests in `tests/utils/pr-url.test.ts`

#### 2.2: Implement GitHubService Core Methods
- [ ] Implement `syncPrMetadata()` in `src/services/github.service.ts`
  - [ ] Initialize Octokit with GitHub token
  - [ ] Fetch PR details (title, description, state, files changed, etc.)
  - [ ] Calculate complexity using `ComplexityScorer`
  - [ ] Upsert to `PrReviewRepository`
  - [ ] Return PR metadata
- [ ] Implement `syncRepoMetadata()`
  - [ ] Fetch repo details from GitHub API
  - [ ] Upsert to `RepoRepository`
  - [ ] Return repo data

#### 2.3: Implement GitHub Action Methods
- [ ] Implement `mergePr()`
  - [ ] Parse PR URL
  - [ ] Check auto-merge eligibility (unless force=true)
  - [ ] Call GitHub merge API
  - [ ] Update `mergedAt` in database
  - [ ] Return merge result
- [ ] Implement `getCiStatus()`
  - [ ] Fetch CI check runs via GitHub API
  - [ ] Aggregate status (success/failure/pending)
  - [ ] Update `ciStatus` in database

#### 2.4: Add Error Handling
- [ ] Create `GitHubApiError` class
- [ ] Handle rate limiting (wait and retry)
- [ ] Handle 403/404 errors gracefully
- [ ] Add retry logic for transient failures

#### 2.5: Unskip and Pass GitHub Service Tests
- [ ] Unskip tests in `tests/services/github.service.test.ts`
- [ ] Mock Octokit client
- [ ] Ensure all 35 tests pass
- [ ] Add rate limit handling tests

#### 2.6: Wire PR & Repo Tools to Handlers
- [ ] Implement handlers in `src/mcp/tools/handlers/pr.handlers.ts`:
  - [ ] `pr_review_status` → Query `PrReviewRepository` + format
  - [ ] `pr_update_review` → Update `PrReviewRepository`
  - [ ] `pr_check_auto_merge` → Call `AutoMergeEvaluator.evaluate()`
  - [ ] `pr_merge` → Call `GitHubService.mergePr()` with safety gate
  - [ ] `repo_sync` → Call `GitHubService.syncRepoMetadata()`
- [ ] Unskip handler tests

### PR Review Checklist
- [ ] 35 GitHub service tests passing
- [ ] All PR/repo tool handlers implemented
- [ ] Rate limiting handled correctly
- [ ] GitHub token never logged
- [ ] PR merge safety gate enforced
- [ ] External reviewer approval required

**PR #10 Title**: `feat: implement GitHub Service and PR tool handlers (Phase 2)`

**⛔ STOP: Do not proceed to Phase 3 until PR #10 is merged**

---

## Phase 3: Orchestration Layer - Poll Manager & Dashboard

**Goal**: Implement polling orchestration and dashboard generation.

**Estimated Effort**: 3-4 days
**PR Gate**: PR #11 - Poll Manager & Dashboard

### Tasks

#### 3.1: Fix PollManager Dependencies
- [ ] Update `PollManager` constructor in `src/services/poll-manager.ts`:
  ```typescript
  constructor(
    private config: Config,
    private db: Db,
    private julesService: JulesService,
    private githubService: GitHubService,
    private stallDetector: StallDetector,
  ) {}
  ```
- [ ] Update service instantiation in `src/mcp/server.ts`

#### 3.2: Implement PollManager
- [ ] Implement `pollAllActive()`
  - [ ] Query active sessions from DB
  - [ ] For each session:
    - [ ] Fetch latest state from Jules API
    - [ ] Upsert to DB
    - [ ] Detect stalls using `StallDetector`
    - [ ] Update `stallDetectedAt` if stalled
    - [ ] Delay between sessions (rate limiting)
  - [ ] Return `PollSummary`
- [ ] Implement `pollSession()`
  - [ ] Poll single session by ID
  - [ ] Same logic as above
- [ ] Implement `syncPrsForSession()`
  - [ ] If session has `prUrl`, sync PR metadata via GitHub API
  - [ ] Calculate complexity
  - [ ] Check auto-merge eligibility

#### 3.3: Fix PollCursor Race Condition
- [ ] Rewrite `PollCursorRepository.incrementPollCount()` to use atomic SQL:
  ```sql
  UPDATE poll_cursors
  SET poll_count = poll_count + 1, last_poll_at = ?
  WHERE id = ?
  ```
- [ ] Add test for concurrent increment

#### 3.4: Implement DashboardService
- [ ] Fix constructor to accept `Config`:
  ```typescript
  constructor(
    private db: Db,
    private config: Config,
  ) {}
  ```
- [ ] Implement `generate()` in `src/services/dashboard.ts`
  - [ ] Query session counts by state
  - [ ] Query stalled sessions (with threshold coloring)
  - [ ] Query pending PRs (with age coloring: 4h/24h/72h)
  - [ ] Query auto-merge candidates
  - [ ] Query recent completions
  - [ ] Format as markdown "Single Pane of Glass"
- [ ] Implement `generateCompact()` for `jules_status` tool
  - [ ] One-line summary: "5 active, 2 stalled, 3 PRs pending"

#### 3.5: Unskip and Pass Tests
- [ ] Unskip tests in `tests/services/poll-manager.test.ts`
- [ ] Unskip tests in `tests/services/dashboard.test.ts`
- [ ] Ensure all tests pass

#### 3.6: Wire Orchestration Tools to Handlers
- [ ] Implement handlers in `src/mcp/tools/handlers/orchestration.handlers.ts`:
  - [ ] `jules_dashboard` → `DashboardService.generate()`
  - [ ] `jules_status` → `DashboardService.generateCompact()`
  - [ ] `jules_poll` → `PollManager.pollAllActive()` or `pollSession()`
  - [ ] `jules_detect_stalls` → Query DB for stalled sessions + format
- [ ] Unskip handler tests

### PR Review Checklist
- [ ] Poll manager tests passing
- [ ] Dashboard tests passing
- [ ] Race condition fixed
- [ ] Dashboard output readable and useful
- [ ] External reviewer approval required

**PR #11 Title**: `feat: implement Poll Manager and Dashboard (Phase 3)`

**⛔ STOP: Do not proceed to Phase 4 until PR #11 is merged**

---

## Phase 4: MCP Server Implementation

**Goal**: Implement actual MCP server with stdio transport and tool routing.

**Estimated Effort**: 2-3 days
**PR Gate**: PR #12 - MCP Server Implementation

### Tasks

#### 4.1: Implement Server Lifecycle
- [ ] Implement `createServer()` in `src/mcp/server.ts`:
  - [ ] Load config via `loadConfig()`
  - [ ] Create database via `createDb()`
  - [ ] Run migrations
  - [ ] Instantiate all services with dependency injection
  - [ ] Create MCP `Server` instance
  - [ ] Register all 18 tools
  - [ ] Set up `ListTools` handler
  - [ ] Set up `CallTool` handler with routing
  - [ ] Add graceful shutdown handler
- [ ] Add signal handlers (SIGINT, SIGTERM) to close DB and exit cleanly

#### 4.2: Implement Tool Routing
- [ ] Implement `CallTool` handler:
  - [ ] Look up tool by name
  - [ ] Validate input using Zod schema
  - [ ] Call handler with validated input and context
  - [ ] Format response as MCP result
  - [ ] Handle errors and return MCP error response
- [ ] Add error formatting helper:
  ```typescript
  function formatError(error: Error): MCPResponse {
    return {
      content: [{ type: 'text', text: error.message }],
      isError: true,
    };
  }
  ```

#### 4.3: Add MCP Tool Annotations
- [ ] Add annotations to all tools:
  - [ ] `jules_create_session`: `{ idempotentHint: false }`
  - [ ] `jules_list_sessions`: `{ readOnlyHint: true }`
  - [ ] `jules_get_session`: `{ readOnlyHint: true }`
  - [ ] `pr_merge`: `{ destructiveHint: true, idempotentHint: false }`
  - [ ] `jules_dashboard`: `{ readOnlyHint: true }`
  - [ ] etc.

#### 4.4: Add Structured Logging
- [ ] Add `pino` or `consola` dependency
- [ ] Create logger in `src/utils/logger.ts`
- [ ] Configure log levels from env var
- [ ] Add secret redaction (API keys, tokens)
- [ ] Replace all `console.log` with structured logging

#### 4.5: Add Health Check Tool
- [ ] Create `jules_health` tool:
  - [ ] Check database connectivity
  - [ ] Verify Jules API key (call ping endpoint)
  - [ ] Verify GitHub token (call user endpoint)
  - [ ] Return status for each

#### 4.6: Unskip and Pass MCP Server Tests
- [ ] Unskip tests in `tests/mcp/server.test.ts`
- [ ] Test tool registration
- [ ] Test tool routing
- [ ] Test error handling
- [ ] Ensure all tests pass

### PR Review Checklist
- [ ] MCP server fully functional
- [ ] All 18 tools registered and working
- [ ] Graceful shutdown implemented
- [ ] Structured logging in place
- [ ] Health check tool working
- [ ] External reviewer approval required

**PR #12 Title**: `feat: implement MCP server with stdio transport (Phase 4)`

**⛔ STOP: Do not proceed to Phase 5 until PR #12 is merged**

---

## Phase 5: End-to-End Testing & Hardening

**Goal**: Run full lifecycle tests and harden the system for production use.

**Estimated Effort**: 2-3 days
**PR Gate**: PR #13 - E2E Tests & Hardening

### Tasks

#### 5.1: Unskip and Pass E2E Tests
- [ ] Unskip tests in `tests/e2e/integration.test.ts`
- [ ] Fix any remaining test fixture issues
- [ ] Run full lifecycle scenarios:
  - [ ] Create session → poll → detect progress → complete
  - [ ] Create session → stall detection → recovery
  - [ ] PR creation → complexity scoring → auto-merge evaluation
  - [ ] Dashboard generation with multiple sessions
- [ ] Ensure all E2E tests pass

#### 5.2: Add Missing Tool Improvements
- [ ] Add timeout parameter to `jules_send_message`:
  ```typescript
  waitTimeout: {
    type: 'number',
    description: 'Max seconds to wait for reply (default: 120)'
  }
  ```
- [ ] Add `limit` and `since` to `jules_get_bash_outputs`
- [ ] Rename `repo_sync` to `jules_repo_sync` for consistency

#### 5.3: Set Up CI/CD
- [ ] Create `.github/workflows/test.yml`:
  - [ ] Run `npm install`
  - [ ] Run `npm run typecheck`
  - [ ] Run `npm test`
  - [ ] Run `npm run lint`
- [ ] Add branch protection rules:
  - [ ] Require CI passing
  - [ ] Require 1 approval from external reviewer
  - [ ] Prevent self-merge

#### 5.4: Add Documentation
- [ ] Update README.md with:
  - [ ] Installation instructions
  - [ ] Configuration guide
  - [ ] MCP tool usage examples
  - [ ] Architecture diagram
- [ ] Create SECURITY.md with:
  - [ ] Security best practices
  - [ ] How to report vulnerabilities
- [ ] Create CONTRIBUTING.md with:
  - [ ] PR process (no self-merge rule)
  - [ ] Testing requirements
  - [ ] Code review guidelines

#### 5.5: Production Readiness Checklist
- [ ] All 254 tests passing (112 existing + 142 unskipped)
- [ ] Zero TypeScript errors
- [ ] Zero linting errors
- [ ] Test coverage > 80%
- [ ] All secrets redacted in logs
- [ ] Error messages user-friendly
- [ ] MCP server starts successfully
- [ ] Health check passes

### PR Review Checklist
- [ ] All E2E tests passing
- [ ] CI/CD pipeline working
- [ ] Documentation complete
- [ ] Production readiness confirmed
- [ ] External reviewer approval required

**PR #13 Title**: `test: add E2E tests and production hardening (Phase 5)`

**⛔ STOP: Do not proceed to deployment until PR #13 is merged**

---

## Phase 6: Optional Enhancements (Post-MVP)

These can be tackled in separate PRs after the core system is stable.

### Enhancement Ideas
- [ ] **Caching layer** - Reduce DB queries for frequently accessed data
- [ ] **Integer timestamps** - Migrate from ISO strings to Unix epoch for performance
- [ ] **Progress reporting** - Add MCP progress notifications for long-running tools
- [ ] **Output schemas** - Define MCP output schemas for type safety
- [ ] **Webhook support** - React to GitHub/Jules events in real-time
- [ ] **Multi-repo tracking** - Dashboard across multiple repositories
- [ ] **Custom stall rules** - User-configurable stall detection rules
- [ ] **PR merge queue** - Queue PRs for sequential merging
- [ ] **Audit logging** - Track all destructive operations
- [ ] **Metrics & monitoring** - Prometheus metrics export

---

## PR Review Process

### For All PRs

1. **Before Creating PR**:
   - [ ] All tests passing locally
   - [ ] TypeScript compiles without errors
   - [ ] Linting passes
   - [ ] Self-review completed

2. **PR Description Must Include**:
   - [ ] Summary of changes
   - [ ] Links to related issues
   - [ ] Testing performed
   - [ ] Screenshots/examples (if UI/output changes)
   - [ ] Security considerations

3. **Review Requirements**:
   - [ ] Minimum 1 external reviewer approval
   - [ ] All review comments addressed
   - [ ] CI/CD checks passing
   - [ ] No self-merge (enforced by branch protection)

4. **Post-Merge**:
   - [ ] Update CURRENT_STATE.md with progress
   - [ ] Close related issues
   - [ ] Tag release if appropriate

---

## Timeline Estimate

| Phase | Effort | Duration | PR # |
|-------|--------|----------|------|
| Phase 0: Critical Fixes | 2-3 days | Week 1 | PR #8 |
| Phase 1: Jules Service | 3-4 days | Week 1-2 | PR #9 |
| Phase 2: GitHub Service | 3-4 days | Week 2-3 | PR #10 |
| Phase 3: Poll Manager | 3-4 days | Week 3-4 | PR #11 |
| Phase 4: MCP Server | 2-3 days | Week 4 | PR #12 |
| Phase 5: E2E & Hardening | 2-3 days | Week 5 | PR #13 |
| **Total** | **15-21 days** | **~5 weeks** | **6 PRs** |

This assumes 1 developer working full-time. Add 1-2 days per PR for review cycles.

---

## Success Criteria

The project is considered **production-ready** when:

✅ All 254 tests passing
✅ Zero critical or high severity issues
✅ All 18 MCP tools functional
✅ Full E2E lifecycle working
✅ CI/CD pipeline enforcing quality gates
✅ External code review on every PR
✅ Documentation complete
✅ Security audit completed

---

## Notes

- **No shortcuts**: Each phase builds on the previous. Do not skip PR review gates.
- **Quality over speed**: It's better to take 6 weeks and do it right than rush and introduce vulnerabilities.
- **External review is non-negotiable**: The solo self-merge pattern that created the current issues must not continue.
- **TDD continues**: Write/unskip tests before implementation, not after.
- **Break glass procedure**: If a critical production bug requires immediate hotfix, still require review from at least one other person before merge.

---

**Last Updated**: 2026-02-10
**Status**: Ready for Phase 0 implementation
