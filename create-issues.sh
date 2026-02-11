#!/bin/bash
# Create GitHub issues from code review findings
# Repository: Coldaine/jules-command

set -e

REPO="Coldaine/jules-command"

echo "Creating GitHub issues for jules-command code review..."
echo ""

# Issue #1: SQL Injection
echo "Creating Issue #1: SQL Injection vulnerability..."
gh issue create \
  --repo "$REPO" \
  --title "🚨 CRITICAL: SQL Injection vulnerability in jules_query tool" \
  --label "security,critical,phase-0" \
  --body "**Severity**: CRITICAL
**Phase**: 0 (Blocking)
**File**: \`src/mcp/tools/index.ts:146-158\`

## Problem
The \`jules_query\` tool accepts arbitrary \`where\` objects and \`orderBy\` strings without validation, creating a direct SQL injection vector.

\`\`\`typescript
{
  name: 'jules_query',
  inputSchema: {
    where: { type: 'object' },  // ⚠️ No sanitization
    orderBy: { type: 'string' }, // ⚠️ Direct SQL injection vector
  }
}
\`\`\`

**Risk**: Any MCP client can execute arbitrary SQL queries, potentially exfiltrating sensitive data or corrupting the database.

## Solution
**Option A** (RECOMMENDED): Remove \`jules_query\` and replace with safe, parameterized tools:
- \`jules_sessions_by_state\`
- \`jules_sessions_by_repo\`
- \`jules_recent_activities\`
- \`pr_list_pending\`

**Option B**: Whitelist allowed columns and implement strict sanitization

## References
- See ISSUES.md #1
- See IMPLEMENTATION_PLAN.md Phase 0.1

**Target**: PR #8"

# Issue #2: StallDetector bug
echo "Creating Issue #2: StallDetector schema mismatch..."
gh issue create \
  --repo "$REPO" \
  --title "🚨 CRITICAL: StallDetector references non-existent schema fields" \
  --label "bug,critical,phase-0" \
  --body "**Severity**: CRITICAL
**Phase**: 0 (Blocking)
**File**: \`src/services/stall-detector.ts:63-65\`

## Problem
The \`repeated_errors\` stall detection rule accesses \`a.hasBashOutput\` and \`a.progressDescription\` fields that DO NOT exist in the \`julesActivities\` schema.

\`\`\`typescript
// Current broken code:
const allErrors = recentActivities.every(a =>
  a.hasBashOutput && a.progressDescription?.includes('Exit Code: 1')
);
\`\`\`

The actual schema only has: \`id\`, \`sessionId\`, \`activityType\`, \`timestamp\`, \`content\`, \`metadata\`

**Impact**: The \`repeated_errors\` stall detection rule will NEVER work - it always returns \`false\` because \`a.hasBashOutput\` is \`undefined\`.

## Solution
**Option A** (RECOMMENDED): Add missing fields to schema
- Add \`hasBashOutput BOOLEAN\` to \`julesActivities\`
- Add \`progressDescription TEXT\` to \`julesActivities\`
- Create migration to add columns
- Update ActivityRepository

**Option B**: Rewrite rule to use existing fields
\`\`\`typescript
const allErrors = recentActivities.every(a =>
  a.activityType === 'bash_output' &&
  (a.content?.includes('Exit Code: 1') || a.content?.includes('error'))
);
\`\`\`

## References
- See ISSUES.md #2
- See IMPLEMENTATION_PLAN.md Phase 0.2

**Target**: PR #8"

# Issue #3: Schema drift
echo "Creating Issue #3: Schema drift..."
gh issue create \
  --repo "$REPO" \
  --title "🚨 CRITICAL: Schema drift between Drizzle ORM and test fixtures" \
  --label "bug,critical,phase-0,testing" \
  --body "**Severity**: CRITICAL
**Phase**: 0 (Blocking)
**Files**: Multiple test files

## Problem
Two sources of truth exist for the database schema, causing test fixtures to reference fields that don't match the actual schema:

### Field Mismatches
- \`repo\` → should be \`repoId\`
- \`branch\` → should be \`sourceBranch\`
- \`createdAt\` (activities) → should be \`timestamp\`
- \`stalledAt\` → should be \`stallDetectedAt\`
- \`hasBashOutput\`, \`progressDescription\` → don't exist at all

### Affected Files
- \`tests/services/poll-manager.test.ts\`
- \`tests/services/dashboard.test.ts\`
- \`tests/e2e/integration.test.ts\`
- \`tests/mcp/tools.test.ts\`

**Impact**: All 142 skipped tests will fail when unskipped due to type mismatches.

## Solution
1. Use \`drizzle-kit generate:sqlite\` to generate migrations from schema (single source of truth)
2. Fix all test fixtures to match actual schema column names
3. Add TypeScript strict compilation to CI to catch future drift
4. Run full test suite to verify

## References
- See ISSUES.md #3
- See IMPLEMENTATION_PLAN.md Phase 0.3

**Target**: PR #8"

# Issue #4: Missing handler architecture
echo "Creating Issue #4: Missing handler architecture..."
gh issue create \
  --repo "$REPO" \
  --title "⚠️ CRITICAL: Missing tool handler architecture" \
  --label "enhancement,high-priority,phase-0" \
  --body "**Severity**: HIGH
**Phase**: 0 (Blocking)
**File**: \`src/mcp/tools/index.ts\`

## Problem
The \`ToolDefinition\` interface has NO \`handler\` property, despite the file documentation claiming each tool is defined as \`{ name, description, inputSchema, handler }\`.

\`\`\`typescript
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  // ❌ No handler property!
}
\`\`\`

**Impact**: Tool routing will require a giant switch statement over 18 cases instead of clean dispatch through the tool definition itself.

## Solution
Update the \`ToolDefinition\` interface:

\`\`\`typescript
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: TInput, context: ToolContext) => Promise<TOutput>;
}
\`\`\`

Create:
- \`ToolContext\` interface with dependencies (config, db, services)
- \`src/mcp/tools/handlers/\` directory structure
- Stub handlers for all 18 tools
- Wire handlers into tool definitions

## References
- See ISSUES.md #4
- See IMPLEMENTATION_PLAN.md Phase 0.4

**Target**: PR #8"

# Issue #5: No input validation
echo "Creating Issue #5: No input validation..."
gh issue create \
  --repo "$REPO" \
  --title "⚠️ CRITICAL: No input validation on MCP tools" \
  --label "enhancement,high-priority,phase-0,validation" \
  --body "**Severity**: HIGH
**Phase**: 0 (Blocking)
**Files**: All tool definitions

## Problem
While \`inputSchema\` defines JSON Schema for documentation, there is NO runtime validation of tool inputs. Invalid inputs will cause runtime errors deep in the service layer instead of early rejection.

**Risk**:
- Type errors in production
- Poor user experience
- Potential security issues from malformed inputs

## Solution
1. Create \`src/mcp/tools/schemas.ts\` with Zod schemas for all 18 tools
2. Add validation wrapper in \`src/mcp/server.ts\`:

\`\`\`typescript
async function validateAndCallTool(tool, args) {
  const validated = tool.zodSchema.parse(args);
  return await tool.handler(validated, context);
}
\`\`\`

3. Add enum constraints for string fields:
   - Session states: \`['queued', 'planning', 'in_progress', 'completed', 'failed', 'awaiting_plan_approval', 'awaiting_user_feedback']\`
   - PR review statuses: \`['pending', 'approved', 'changes_requested', 'closed']\`
   - Activity types: \`['message', 'plan', 'bash_output', 'file_change', 'error']\`

4. Write validation tests in \`tests/mcp/validation.test.ts\`

## Example
\`\`\`typescript
const createSessionInput = z.object({
  prompt: z.string().min(1),
  repo: z.string().regex(/^[\\w.-]+\\/[\\w.-]+\$/).optional(),
  branch: z.string().optional(),
  autoPr: z.boolean().default(true),
  requireApproval: z.boolean().default(false),
  title: z.string().optional(),
});
\`\`\`

## References
- See ISSUES.md #5
- See IMPLEMENTATION_PLAN.md Phase 0.5

**Target**: PR #8"

# Issue #6: pr_merge safety
echo "Creating Issue #6: pr_merge safety gates..."
gh issue create \
  --repo "$REPO" \
  --title "⚠️ CRITICAL: pr_merge tool has no safety gates" \
  --label "security,high-priority,phase-0" \
  --body "**Severity**: HIGH
**Phase**: 0 (Blocking)
**File**: \`src/mcp/tools/index.ts:204-214\`

## Problem
The \`pr_merge\` tool allows merging ANY PR without checking:
- Auto-merge eligibility
- CI status
- Review status
- Complexity score

**Risk**: Destructive, irreversible operation with no guardrails. Unchecked PRs could be merged to production.

## Solution
1. Add \`force\` parameter to tool schema:

\`\`\`typescript
force: {
  type: 'boolean',
  description: 'Skip eligibility checks (use with caution)',
  default: false
}
\`\`\`

2. Update tool handler (when implemented) to:
   - If \`force: false\`, call \`AutoMergeEvaluator.evaluate()\` first
   - If not eligible, return error with reasons
   - If \`force: true\`, log warning and proceed

3. Add \`destructiveHint: true\` annotation to tool definition

4. Write test in \`tests/mcp/tools.test.ts\` for safety gate

## References
- See ISSUES.md #6
- See IMPLEMENTATION_PLAN.md Phase 0.6

**Target**: PR #8"

# Issue #7: Missing ON DELETE CASCADE
echo "Creating Issue #7: Missing ON DELETE CASCADE..."
gh issue create \
  --repo "$REPO" \
  --title "Missing ON DELETE CASCADE in foreign key constraints" \
  --label "bug,medium-priority,phase-0" \
  --body "**Severity**: MEDIUM-HIGH
**Phase**: 0
**File**: \`src/db/migrate.ts\`

## Problem
Foreign key constraints lack \`ON DELETE CASCADE\`, which will cause constraint violations when deleting parent records.

CURRENT_STATE.md claims: \"Schema includes foreign key constraints with \\\`ON DELETE CASCADE\\\`\"

Reality in migrate.ts:
\`\`\`sql
repo_id TEXT REFERENCES repos(id),  -- ❌ No CASCADE!
\`\`\`

**Impact**: Deleting a repo will violate foreign key constraints if sessions reference it.

## Solution
Add \`ON DELETE CASCADE\` to all foreign key constraints:
\`\`\`sql
repo_id TEXT REFERENCES repos(id) ON DELETE CASCADE,
session_id TEXT REFERENCES jules_sessions(id) ON DELETE CASCADE,
\`\`\`

Test cascade behavior in \`tests/db/migrate.test.ts\`.

## References
- See ISSUES.md #7
- See IMPLEMENTATION_PLAN.md Phase 0.7

**Target**: PR #8"

# Issue #8: Missing enum constraints
echo "Creating Issue #8: Missing enum constraints..."
gh issue create \
  --repo "$REPO" \
  --title "Missing enum constraints on string fields" \
  --label "enhancement,medium-priority,phase-0" \
  --body "**Severity**: MEDIUM
**Phase**: 0
**Files**: Multiple tool schemas

## Problem
String fields accept any value instead of constraining to valid enums.

### Affected Fields
- \`jules_list_sessions.state\` (should be \`['queued', 'planning', 'in_progress', ...]\`)
- \`jules_get_activities.type\`
- \`pr_update_review.status\` (should be \`['pending', 'approved', 'changes_requested']\`)

**Impact**: Invalid values can be passed, causing confusion and potential bugs.

## Solution
Add enum constraints to JSON Schema definitions and Zod schemas.

## References
- See ISSUES.md #8
- See IMPLEMENTATION_PLAN.md Phase 0.5

**Target**: PR #8"

# Issue #9-13: Medium priority issues
echo "Creating additional medium-priority issues..."

gh issue create \
  --repo "$REPO" \
  --title "PollCursorRepository has race condition in incrementPollCount" \
  --label "bug,medium-priority,phase-3" \
  --body "**Severity**: MEDIUM
**Phase**: 3
**File**: \`src/db/repositories/poll-cursor.repo.ts\`

## Problem
\`incrementPollCount()\` uses read-modify-write pattern which can lose updates.

## Solution
Use atomic SQL update:
\`\`\`sql
UPDATE poll_cursors SET poll_count = poll_count + 1, last_poll_at = ? WHERE id = ?
\`\`\`

**Target**: PR #11"

gh issue create \
  --repo "$REPO" \
  --title "PollManager missing JulesService and GitHubService dependencies" \
  --label "bug,medium-priority,phase-3" \
  --body "**Severity**: MEDIUM
**Phase**: 3
**File**: \`src/services/poll-manager.ts\`

## Problem
PollManager doesn't receive \`JulesService\` or \`GitHubService\` but needs them to fulfill its contract.

## Solution
Update constructor to accept both services.

**Target**: PR #11"

gh issue create \
  --repo "$REPO" \
  --title "DashboardService missing Config dependency" \
  --label "bug,medium-priority,phase-3" \
  --body "**Severity**: MEDIUM
**Phase**: 3
**File**: \`src/services/dashboard.ts\`

## Problem
DashboardService only receives \`Db\` but needs \`Config\` for threshold-aware formatting.

## Solution
Update constructor to accept \`Config\`.

**Target**: PR #11"

gh issue create \
  --repo "$REPO" \
  --title "No error handling strategy defined" \
  --label "enhancement,medium-priority,phase-1" \
  --body "**Severity**: MEDIUM
**Phase**: 1-2
**Files**: All service files

## Problem
No custom error classes, no retry logic, no MCP error response format.

## Solution
1. Create error classes: \`JulesApiError\`, \`GitHubApiError\`, etc.
2. Add retry logic with exponential backoff
3. Define MCP error response format

**Target**: PR #9, PR #10"

gh issue create \
  --repo "$REPO" \
  --title "Missing PR URL parser utility" \
  --label "enhancement,medium-priority,phase-2" \
  --body "**Severity**: MEDIUM
**Phase**: 2
**Files**: Multiple

## Problem
Multiple tools parse \`https://github.com/{owner}/{repo}/pull/{number}\` inconsistently.

## Solution
Create \`src/utils/pr-url.ts\` with \`parsePrUrl()\` function.

**Target**: PR #10"

# Lower priority issues
echo "Creating lower-priority enhancement issues..."

gh issue create \
  --repo "$REPO" \
  --title "Add structured logging with secret redaction" \
  --label "enhancement,phase-4" \
  --body "**Severity**: MEDIUM
**Phase**: 4

## Problem
Only \`console.log\`/\`console.error\` used; no structured logging or secret redaction.

## Solution
Add \`pino\` or \`consola\` with log levels and secret redaction.

**Target**: PR #12"

gh issue create \
  --repo "$REPO" \
  --title "Add graceful shutdown handlers" \
  --label "enhancement,phase-4" \
  --body "**Severity**: MEDIUM
**Phase**: 4

## Problem
SQLite connection not closed on process exit.

## Solution
Add SIGINT/SIGTERM handlers to close DB and exit cleanly.

**Target**: PR #12"

gh issue create \
  --repo "$REPO" \
  --title "Add jules_health diagnostic tool" \
  --label "enhancement,phase-4" \
  --body "**Severity**: LOW
**Phase**: 4

## Problem
No diagnostic tool to verify API connectivity and configuration.

## Solution
Create \`jules_health\` tool that checks DB, Jules API, and GitHub API.

**Target**: PR #12"

gh issue create \
  --repo "$REPO" \
  --title "Add MCP tool annotations for all tools" \
  --label "enhancement,phase-4" \
  --body "**Severity**: LOW
**Phase**: 4

## Problem
Tools don't declare read-only, destructive, or idempotent hints.

## Solution
Add MCP annotations to all tools per MCP specification.

**Target**: PR #12"

gh issue create \
  --repo "$REPO" \
  --title "Set up CI/CD pipeline with branch protection" \
  --label "enhancement,ci-cd,phase-5" \
  --body "**Severity**: MEDIUM
**Phase**: 5

## Problem
No automated testing, linting, or type checking on PRs.

## Solution
Create GitHub Actions workflow with branch protection rules requiring:
- CI passing
- 1 external approval
- No self-merge

**Target**: PR #13"

gh issue create \
  --repo "$REPO" \
  --title "Rename repo_sync to jules_repo_sync for consistency" \
  --label "enhancement,phase-5" \
  --body "**Severity**: LOW
**Phase**: 5

## Problem
\`repo_sync\` doesn't follow naming convention (no \`jules_\` or \`pr_\` prefix).

## Solution
Rename to \`jules_repo_sync\`.

**Target**: PR #13"

gh issue create \
  --repo "$REPO" \
  --title "Add timeout parameter to jules_send_message" \
  --label "enhancement,phase-5" \
  --body "**Severity**: MEDIUM
**Phase**: 5

## Problem
\`waitForReply\` could block indefinitely with no timeout parameter.

## Solution
Add \`waitTimeout\` parameter (default: 120 seconds).

**Target**: PR #13"

echo ""
echo "✅ All issues created successfully!"
echo ""
echo "View issues at: https://github.com/$REPO/issues"
