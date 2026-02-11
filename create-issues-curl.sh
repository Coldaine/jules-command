#!/bin/bash
# Create GitHub issues using curl and GitHub API
# Usage: GITHUB_TOKEN=your_token ./create-issues-curl.sh

set -e

REPO="Coldaine/jules-command"
GITHUB_API="https://api.github.com/repos/$REPO/issues"

if [ -z "$GITHUB_TOKEN" ]; then
    echo "Error: GITHUB_TOKEN environment variable not set"
    echo "Usage: GITHUB_TOKEN=your_token ./create-issues-curl.sh"
    exit 1
fi

echo "Creating GitHub issues for jules-command code review..."
echo ""

# Function to create an issue
create_issue() {
    local title="$1"
    local body="$2"
    local labels="$3"

    echo "Creating: $title"

    curl -s -X POST "$GITHUB_API" \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github+json" \
        -d "$(jq -n \
            --arg title "$title" \
            --arg body "$body" \
            --argjson labels "$(echo $labels | jq -R 'split(",")' | jq -c '.')" \
            '{title: $title, body: $body, labels: $labels}'
        )" | jq -r '.html_url // .message'
}

# Issue #1: SQL Injection
create_issue \
    "🚨 CRITICAL: SQL Injection vulnerability in jules_query tool" \
    "**Severity**: CRITICAL
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

**Target**: PR #8" \
    "security,critical,phase-0"

sleep 1

# Issue #2: StallDetector
create_issue \
    "🚨 CRITICAL: StallDetector references non-existent schema fields" \
    "**Severity**: CRITICAL
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

## References
- See ISSUES.md #2
- See IMPLEMENTATION_PLAN.md Phase 0.2

**Target**: PR #8" \
    "bug,critical,phase-0"

sleep 1

# Issue #3: Schema drift
create_issue \
    "🚨 CRITICAL: Schema drift between Drizzle ORM and test fixtures" \
    "**Severity**: CRITICAL
**Phase**: 0 (Blocking)
**Files**: Multiple test files

## Problem
Two sources of truth exist for the database schema, causing test fixtures to reference fields that don't match the actual schema.

### Field Mismatches
- \`repo\` → should be \`repoId\`
- \`branch\` → should be \`sourceBranch\`
- \`createdAt\` (activities) → should be \`timestamp\`
- \`stalledAt\` → should be \`stallDetectedAt\`

**Impact**: All 142 skipped tests will fail when unskipped due to type mismatches.

## Solution
1. Use \`drizzle-kit generate:sqlite\` to generate migrations from schema
2. Fix all test fixtures to match actual schema column names
3. Add TypeScript strict compilation to CI
4. Run full test suite to verify

## References
- See ISSUES.md #3
- See IMPLEMENTATION_PLAN.md Phase 0.3

**Target**: PR #8" \
    "bug,critical,phase-0,testing"

sleep 1

# Issue #4: Missing handler architecture
create_issue \
    "⚠️ CRITICAL: Missing tool handler architecture" \
    "**Severity**: HIGH
**Phase**: 0 (Blocking)
**File**: \`src/mcp/tools/index.ts\`

## Problem
The \`ToolDefinition\` interface has NO \`handler\` property, despite documentation claiming it does.

**Impact**: Tool routing will require unmaintainable switch statement over 18 cases.

## Solution
Update the \`ToolDefinition\` interface to include handler functions.

## References
- See ISSUES.md #4
- See IMPLEMENTATION_PLAN.md Phase 0.4

**Target**: PR #8" \
    "enhancement,high-priority,phase-0"

sleep 1

# Issue #5: No input validation
create_issue \
    "⚠️ CRITICAL: No input validation on MCP tools" \
    "**Severity**: HIGH
**Phase**: 0 (Blocking)
**Files**: All tool definitions

## Problem
No runtime validation of tool inputs. Invalid inputs will cause runtime errors deep in the service layer.

## Solution
1. Create Zod schemas for all 18 tools
2. Add validation wrapper in server
3. Add enum constraints for string fields

## References
- See ISSUES.md #5
- See IMPLEMENTATION_PLAN.md Phase 0.5

**Target**: PR #8" \
    "enhancement,high-priority,phase-0,validation"

sleep 1

# Issue #6: pr_merge safety
create_issue \
    "⚠️ CRITICAL: pr_merge tool has no safety gates" \
    "**Severity**: HIGH
**Phase**: 0 (Blocking)
**File**: \`src/mcp/tools/index.ts:204-214\`

## Problem
The \`pr_merge\` tool allows merging ANY PR without checking eligibility, CI status, or review state.

**Risk**: Destructive, irreversible operation with no guardrails.

## Solution
1. Add \`force\` parameter
2. Require eligibility check when \`force: false\`
3. Add \`destructiveHint: true\` annotation

## References
- See ISSUES.md #6
- See IMPLEMENTATION_PLAN.md Phase 0.6

**Target**: PR #8" \
    "security,high-priority,phase-0"

sleep 1

# Issue #7: Missing CASCADE
create_issue \
    "Missing ON DELETE CASCADE in foreign key constraints" \
    "**Severity**: MEDIUM-HIGH
**Phase**: 0
**File**: \`src/db/migrate.ts\`

## Problem
Foreign key constraints lack \`ON DELETE CASCADE\`, which will cause constraint violations.

## Solution
Add \`ON DELETE CASCADE\` to all foreign key constraints.

**Target**: PR #8" \
    "bug,medium-priority,phase-0"

sleep 1

# Issue #8: Missing enums
create_issue \
    "Missing enum constraints on string fields" \
    "**Severity**: MEDIUM
**Phase**: 0

## Problem
String fields accept any value instead of constraining to valid enums.

## Solution
Add enum constraints to JSON Schema definitions and Zod schemas.

**Target**: PR #8" \
    "enhancement,medium-priority,phase-0"

echo ""
echo "✅ Created 8 critical issues (Phase 0)"
echo "Run with: GITHUB_TOKEN=your_token ./create-issues-curl.sh"
echo ""
echo "For remaining issues, see create-issues.sh (requires gh CLI)"
