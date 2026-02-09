# Jules Command — TDD Task Plan

[← Back to Architecture](./architecture.md)

Every task follows **Red → Green → Refactor**. Write the test first, watch it fail, implement the minimum code to pass, then clean up.

---

## Phase 1 — Database Foundation

### Task 1.1: Schema Migration
- **Test:** `db/migrate.test.ts` — Run migration on fresh in-memory DB, assert all 5 tables exist with correct columns
- **Impl:** `src/db/migrate.ts` (already scaffolded)
- **Verify:** `SELECT name FROM sqlite_master WHERE type='table'`

### Task 1.2: Session Repository
- **Test:** `db/session.repo.test.ts`
  - `upsert()` creates a new row, verify all columns
  - `upsert()` updates an existing row (same external_id), verify updated_at changes
  - `findByState()` returns only sessions in the given state
  - `findActive()` returns sessions in non-terminal states
- **Impl:** `src/db/repositories/session.repo.ts` (already scaffolded)

### Task 1.3: Activity Repository
- **Test:** `db/activity.repo.test.ts`
  - `insertMany()` inserts activities, verify count
  - `insertMany()` with duplicates (INSERT OR IGNORE), verify no error
  - `findBySessionId()` returns activities ordered by timestamp
  - `findSince()` returns only activities after the cursor
- **Impl:** `src/db/repositories/activity.repo.ts`

### Task 1.4: Repo Repository
- **Test:** `db/repo.repo.test.ts`
  - `upsert()` creates repo, verify fields
  - `findJulesConnected()` returns only repos with `jules_connected = true`
- **Impl:** `src/db/repositories/repo.repo.ts`

### Task 1.5: PR Review Repository
- **Test:** `db/pr-review.repo.test.ts`
  - `upsert()` creates PR review with complexity score
  - `findAutoMergeEligible()` returns only eligible PRs (score below threshold, CI passing, no requested changes)
  - `findPending()` returns reviews where `decision` is null
- **Impl:** `src/db/repositories/pr-review.repo.ts`

### Task 1.6: Poll Cursor Repository
- **Test:** `db/poll-cursor.repo.test.ts`
  - `upsert()` creates cursor
  - `incrementPollCount()` increments by 1
  - `findById()` returns correct cursor after multiple increments
- **Impl:** `src/db/repositories/poll-cursor.repo.ts`

---

## Phase 2 — Config & Types

### Task 2.1: Config Loading
- **Test:** `config.test.ts`
  - Valid env → `loadConfig()` returns typed config
  - Missing required vars → throws with descriptive error
  - Default values applied when optionals are missing
  - BWS vars present → `bws` config populated
- **Impl:** `src/config.ts` (already implemented)

---

## Phase 3 — Jules Service (API Client)

### Task 3.1: List Sessions
- **Test:** `services/jules.service.test.ts` — Mock HTTP (MSW), call `listSessions()`, verify it maps SDK response to our types
- **Impl:** `src/services/jules.service.ts`

### Task 3.2: Get Session + Activities
- **Test:** Mock HTTP, call `getSession(id)` and `getActivities(id, cursor)`, verify mapping
- **Impl:** Same file

### Task 3.3: Create Session
- **Test:** Mock HTTP with various `automationMode` values, verify request body
- **Impl:** Same file

### Task 3.4: Approve Plan / Send Message
- **Test:** Mock HTTP for both endpoints, verify correct session ID used
- **Impl:** Same file

---

## Phase 4 — Core Services

### Task 4.1: Stall Detector
- **Test:** `services/stall-detector.test.ts`
  - Session awaiting plan > 30 min → `plan_approval_timeout`
  - Session awaiting feedback > 30 min → `feedback_timeout`
  - Session in_progress, latest activity > 15 min ago → `no_progress`
  - Session queued > 10 min → `queue_timeout`
  - Session with 3+ consecutive error activities → `repeated_errors`
  - Session in_progress with recent activity → not stalled
  - Custom thresholds override defaults
- **Impl:** `src/services/stall-detector.ts` (already implemented)

### Task 4.2: Complexity Scorer
- **Test:** `services/complexity-scorer.test.ts`
  - Trivial PR (10 lines, 1 file) → score < 0.2, label 'trivial'
  - Complex PR (500 lines, 20 files, critical files) → score > 0.7, label 'complex'
  - Edge: 0 lines → score 0.0
  - Weights sum to 1.0
- **Impl:** `src/services/complexity-scorer.ts` (already implemented)

### Task 4.3: Auto-Merge Evaluator
- **Test:** `services/auto-merge.test.ts`
  - Eligible PR (low score, CI green, age OK) → `{ eligible: true }`
  - High complexity → not eligible, reason includes 'complexity'
  - CI failing → not eligible
  - PR too young → not eligible
  - Changes requested → not eligible
  - Multiple failing criteria → all reasons listed
- **Impl:** `src/services/auto-merge.ts` (already implemented)

---

## Phase 5 — GitHub Service

### Task 5.1: Repo Sync
- **Test:** `services/github.service.test.ts`
  - Mock Octokit, call `syncAllRepos()`, verify it upserts to `repos` table
  - `syncRepoMetadata(owner, repo)` fetches and stores default branch, language, topics
- **Impl:** `src/services/github.service.ts`

### Task 5.2: PR Status Sync
- **Test:** Mock Octokit, call `syncPrStatus(prUrl)`, verify CI status, review state, lines changed extracted
- **Impl:** Same file

### Task 5.3: Merge PR
- **Test:** Mock Octokit merge endpoint, verify `mergePr(prUrl)` calls correct API with squash strategy by default
  - Verify it updates `pr_reviews.merged_at`
  - Verify it rejects if auto-merge checks fail
- **Impl:** Same file

---

## Phase 6 — Poll Manager

### Task 6.1: Poll Single Session
- **Test:** `services/poll-manager.test.ts`
  - Mock JulesService + DB, call `pollSession(id)`
  - Verify: session upserted, new activities inserted, cursor updated
  - On state change to `completed`: PR review row created, complexity scored
  - On stall detected: session flagged
- **Impl:** `src/services/poll-manager.ts`

### Task 6.2: Poll All Active Sessions
- **Test:** `pollAllActive()` fetches all active sessions from DB, polls each
  - Rate limiting: max N sessions per poll cycle
  - Error in one session doesn't abort others
- **Impl:** Same file

---

## Phase 7 — MCP Server

### Task 7.1: Tool Registration
- **Test:** `mcp/server.test.ts` — Create server, list tools, verify all 18 tools registered with correct schemas
- **Impl:** `src/mcp/server.ts`

### Task 7.2: Jules Tools (Integration)
- **Test:** `mcp/tools/jules.test.ts`
  - Call `jules_create_session` tool → verify it calls JulesService + inserts DB row
  - Call `jules_get_session` tool → verify it returns formatted session data
  - Call `jules_approve_plan` tool → verify it calls approvePlan
  - Call `jules_send_message` tool → verify it calls sendMessage
- **Impl:** `src/mcp/tools/jules.ts` (split from tools/index.ts)

### Task 7.3: Dashboard & PR Tools (Integration)
- **Test:** `mcp/tools/orchestration.test.ts`
  - Call `dashboard` tool → returns session counts, stalled list, pending PRs
  - Call `pr_review_status` tool → returns complexity, CI, eligibility
  - Call `pr_merge` tool → calls GitHub merge, updates DB
- **Impl:** `src/mcp/tools/orchestration.ts`

---

## Phase 8 — End-to-End

### Task 8.1: Full Lifecycle Test
- **Test:** `e2e/lifecycle.test.ts`
  - Create session → poll → approve plan → poll → complete → score PR → merge
  - All with mocked HTTP, real SQLite (in-memory)
  - Verify final DB state matches expected

### Task 8.2: Stall Recovery Test
- **Test:** `e2e/stall-recovery.test.ts`
  - Create session → stall detected → send help message → session resumes → completes
  - Verify stall flag set and then cleared

---

## Implementation Order

```
Phase 1 (DB) → Phase 2 (Config) → Phase 3 (Jules API) → Phase 4 (Core)
     ↓                                     ↓
Phase 5 (GitHub) ─────────────→ Phase 6 (Polling) → Phase 7 (MCP) → Phase 8 (E2E)
```

**Estimated tests:** ~45-55 test cases across ~15 test files.

**Run tests:** `npm test` (all), `npm run test:watch` (TDD mode), `npm run test:coverage` (with coverage report).
