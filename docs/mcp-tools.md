# MCP Tools Reference

[← Back to Architecture](./architecture.md)

## Tool Catalog

### Jules-Native Tools (SDK + persistence)

---

#### `jules_create_session`

Create a new Jules task. Persists to DB immediately.

**Input:**
```json
{
  "prompt": "string (required) — task description",
  "repo": "string — owner/name (omit for repoless)",
  "branch": "string — starting branch (default: repo default branch)",
  "autoPr": "boolean — auto-create PR on completion (default: true)",
  "requireApproval": "boolean — require human plan approval (default: false)",
  "title": "string — session title"
}
```

**Output:** `{ sessionId: string, url: string, state: string }`

---

#### `jules_list_sessions`

List sessions, optionally filtered.

**Input:**
```json
{
  "state": "string — filter by state (e.g. 'in_progress', 'completed')",
  "repo": "string — filter by repo (owner/name)",
  "limit": "number — max results (default: 20)",
  "fromDb": "boolean — query local DB instead of API (default: true)"
}
```

**Output:** `{ sessions: SessionSummary[], total: number }`

---

#### `jules_get_session`

Get detailed info for one session. Syncs to DB.

**Input:** `{ sessionId: "string (required)" }`

**Output:** Full session object with state, plan, activities count, PR info.

---

#### `jules_get_activities`

Get activities for a session.

**Input:**
```json
{
  "sessionId": "string (required)",
  "type": "string — filter by type (e.g. 'agent_messaged')",
  "limit": "number — max results (default: 50)",
  "since": "string — ISO timestamp to fetch after"
}
```

**Output:** `{ activities: Activity[], total: number }`

---

#### `jules_approve_plan`

Approve a pending plan. Records approval in DB.

**Input:** `{ sessionId: "string (required)" }`

**Output:** `{ success: boolean, message: string }`

---

#### `jules_send_message`

Send a message to Jules in a session.

**Input:**
```json
{
  "sessionId": "string (required)",
  "message": "string (required)",
  "waitForReply": "boolean — block until agent responds (default: false)"
}
```

**Output:** `{ success: boolean, reply?: string }`

---

#### `jules_get_diff`

Get code diff for a session.

**Input:**
```json
{
  "sessionId": "string (required)",
  "file": "string — filter to specific file path"
}
```

**Output:** Unidiff patch text.

---

#### `jules_get_bash_outputs`

Get bash command outputs from a session.

**Input:** `{ sessionId: "string (required)" }`

**Output:** `{ outputs: BashOutput[] }`

---

### Orchestration Tools

---

#### `jules_dashboard`

Comprehensive status dashboard. The primary "what's going on" tool.

**Input:**
```json
{
  "includeCompleted": "boolean — include recent completed sessions (default: false)",
  "hours": "number — lookback window (default: 24)"
}
```

**Output:** Formatted markdown with sections:
- Active Sessions (by status)
- Awaiting Action (needs human input)
- Stalled Sessions
- PRs Pending Review (with complexity + age)
- Auto-Merge Candidates
- Recently Completed (if requested)

---

#### `jules_status`

Quick compact status of all non-terminal sessions.

**Input:** `{}`

**Output:** `[{ id, title, state, lastActivity, ageMinutes }]`

---

#### `jules_poll`

Run a polling cycle — sync all active sessions to DB.

**Input:**
```json
{
  "sessionIds": "string[] — specific sessions (omit for all active)",
  "syncPRs": "boolean — also sync PR statuses from GitHub (default: true)"
}
```

**Output:** `{ polled: number, updated: number, stallsDetected: StallInfo[], errors: PollError[] }`

---

#### `jules_detect_stalls`

Analyze sessions for stall patterns (from DB, no API calls).

**Input:** `{}`

**Output:** `{ stalled: StallInfo[] }`

---

#### `jules_query`

Flexible DB query tool.

**Input:**
```json
{
  "table": "string — 'sessions' | 'activities' | 'pr_reviews' | 'repos'",
  "where": "object — filter conditions",
  "orderBy": "string — column to order by",
  "limit": "number — default 20"
}
```

**Output:** Result rows from the database.

---

#### `repo_sync`

Sync GitHub repo metadata to local DB.

**Input:**
```json
{
  "repos": "string[] — owner/name list (omit for all known repos)",
  "all": "boolean — sync all repos from Jules sources"
}
```

**Output:** `{ synced: number, repos: RepoSummary[] }`

---

#### `pr_review_status`

Get PR review tracking for one or more PRs.

**Input:**
```json
{
  "prUrl": "string",
  "sessionId": "string",
  "repo": "string"
}
```

**Output:** PR review record with complexity, auto-merge eligibility, age.

---

#### `pr_update_review`

Update PR review status or notes.

**Input:**
```json
{
  "prUrl": "string (required)",
  "status": "string — 'approved' | 'changes_requested' | 'closed'",
  "notes": "string — review notes"
}
```

**Output:** Updated PR review record.

---

#### `pr_check_auto_merge`

Evaluate auto-merge eligibility.

**Input:** `{ prUrl: "string — omit to check all pending" }`

**Output:** `{ eligible: PrReview[], ineligible: PrReview[] }` with reasons.

---

#### `pr_merge`

Merge an approved PR via GitHub API.

**Input:**
```json
{
  "prUrl": "string (required)",
  "method": "string — 'merge' | 'squash' | 'rebase' (default: 'squash')"
}
```

**Output:** `{ success: boolean, mergedAt: string }`
