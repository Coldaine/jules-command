# Jules Workflows — Complete Enumeration

[← Back to Architecture](./architecture.md)

This document enumerates every workflow you can perform with Jules via the API, including decision points, activity patterns, and what the Jules Command MCP server does at each step.

---

## 1. Create a Session (Start a Task)

### 1a. Repo-Based, Auto-Approve, Auto-PR (fire-and-forget)

**What happens:** You give Jules a prompt, it clones the repo, generates a plan, auto-approves it, does the work, and opens a PR.

**API call:**
```
POST /v1alpha/sessions
{
  "prompt": "Fix the login bug on mobile",
  "sourceContext": {
    "source": "sources/github/owner/repo",
    "githubRepoContext": { "startingBranch": "main" }
  },
  "automationMode": "AUTO_CREATE_PR",
  "title": "Fix mobile login"
}
```

**Decision points:** None — fully automated.
**Jules Command action:** Insert `jules_sessions` row, set up `poll_cursors`.

### 1b. Repo-Based, Manual Plan Approval

**Same as above but with:** `"requirePlanApproval": true`

**Decision points:** After plan is generated, human must call `approvePlan`.
**Activity pattern:** `planGenerated` → (wait) → `planApproved` → `progressUpdated` → ... → `sessionCompleted`

### 1c. Repoless Session (no GitHub repo)

**What happens:** Jules spins up an ephemeral VM with Node, Python, Rust, Bun etc. and works from only the prompt context.

**API call:** Omit `sourceContext` entirely.

**Use cases:** Quick scripts, prototypes, document generation, data processing.
**File outputs:** Retrieved via session `generatedFiles()` or `changeSet` artifacts.

### 1d. Parallel Sessions

**What happens:** Multiple sessions for the same prompt (up to 5), to get diverse approaches.

**SDK:** `jules.all(tasks, mapFn, { concurrency: 5 })`
**API:** Multiple `POST /sessions` calls.

---

## 2. Monitor Session Progress

### 2a. Poll Session State

**API call:** `GET /v1alpha/sessions/{id}`

**What you learn:**
- Current state (`queued`, `planning`, `awaitingPlanApproval`, `inProgress`, `completed`, `failed`, etc.)
- PR output URL (if auto-PR)
- Title, prompt context

**Jules Command action:** Upsert `jules_sessions`, compare state changes, detect transitions.

### 2b. Stream/Poll Activities

**API call:** `GET /v1alpha/sessions/{id}/activities?createTime={cursor}`

**What you learn:** Everything Jules has done — plan steps, bash commands, code changes, screenshots, messages.

**Activity types to watch for:**
| Activity Type | Meaning | Action Required? |
|---------------|---------|-----------------|
| `planGenerated` | Jules proposed a plan | Yes — approve/reject if manual approval |
| `planApproved` | Plan was approved | No — informational |
| `progressUpdated` | Jules made progress (ran command, edited file) | No — monitoring |
| `agentMessaged` | Jules sent a message (may be a question!) | **Maybe** — check if it's a question |
| `sessionCompleted` | Jules finished | **Yes** — review the PR / output |
| `sessionFailed` | Jules encountered an unrecoverable error | **Yes** — retry or investigate |

**Jules Command action:** Insert all new activities to `jules_activities`, update `poll_cursors.last_activity_seen_at`.

---

## 3. Approve or Reject a Plan

### 3a. Approve Plan

**When:** Session state is `awaitingPlanApproval`.

**API call:** `POST /v1alpha/sessions/{id}:approvePlan`

**Jules Command action:** Update `jules_sessions.plan_approved_at`, record `plan_approved` activity.

### 3b. Reject / Revise Plan

**How:** Send a message explaining what to change before approving.

**API call:** `POST /v1alpha/sessions/{id}:sendMessage` with `{ "prompt": "Actually, skip the database migration step and focus on the API endpoints." }`

Then Jules will regenerate the plan and you'll see a new `planGenerated` activity.

---

## 4. Help Jules When It's Stuck

### 4a. Jules Asks a Question

**Detection:** Activity type `agentMessaged` with a question mark or interrogative pattern.

**Example agent message:** "I see two possible approaches for the authentication module. Should I use JWT tokens or session cookies?"

**What to do:**
1. Read the question from the activity
2. Decide on an answer (may require research, codebase context, or domain knowledge)
3. Send a response

**API call:** `POST /v1alpha/sessions/{id}:sendMessage` with `{ "prompt": "Use JWT tokens with a 24h expiry." }`

### 4b. Jules Stalled (No Progress)

**Detection:** Jules Command's `StallDetector` flags it — no new activities for N minutes while in `in_progress`.

**Possible actions:**
- Send an encouraging nudge: "Are you stuck? Try a different approach."
- Send specific guidance: "Use the `parseConfig` function from utils.ts instead of writing a new parser."
- Wait longer (some tasks take time)

### 4c. Jules Hit Repeated Errors

**Detection:** Last N activities have `bashOutput` with `exitCode > 0`.

**Possible actions:**
- Send debugging guidance: "The test requires NODE_ENV=test to be set."
- Provide missing context: "The database connection string should use port 5433, not 5432."
- Suggest a workaround: "Skip the integration tests and just fix the unit tests."

### 4d. Jules Waiting for Feedback (`awaitingUserFeedback`)

**Detection:** Session state is `awaitingUserFeedback`.

**What happened:** Jules explicitly paused and is waiting for user input (Interactive Plan mode).

**Action:** Read the last `agentMessaged` activity to understand what Jules needs, then `sendMessage`.

---

## 5. Session Completion — What Happens Next

### 5a. Session Completed Successfully

**Detection:** Activity type `sessionCompleted`, session state `completed`.

**What's available:**
- **PR (if auto-PR):** `session.outputs[].pullRequest.url` — a real GitHub PR
- **Change set:** `session.outputs[].changeSet.gitPatch.unidiffPatch` — the full diff
- **Generated files:** parsed from the unidiff — individual file contents

### 5b. Session Failed

**Detection:** Activity type `sessionFailed`, session state `failed`.

**What to do:**
1. Check `errorReason` for details
2. Decide: retry with modified prompt? Abandon? Manual fix?

---

## 6. PR Review Workflow (Post-Completion)

This is the most critical workflow — ensuring Jules's code is actually correct before merging.

### 6a. Initial PR Triage

1. **Read the diff** — `jules_get_diff` tool
2. **Check complexity** — `pr_review_status` tool shows `complexity_score`
3. **Check CI** — `ci_status` from GitHub sync

### 6b. Challenge Questions (Review Checklist)

Before approving any Jules PR, systematically verify:

| # | Question | How to Check |
|---|----------|-------------|
| 1 | Does the PR match the original prompt? | Compare `session.prompt` with PR diff |
| 2 | Are there unintended side effects? | Check for files changed that weren't part of the task |
| 3 | Are tests adequate? | Check `test_files_changed`, look for new functions without tests |
| 4 | Does it follow project conventions? | Compare against AGENTS.md, existing patterns |
| 5 | Are there security concerns? | Scan for hardcoded secrets, SQL injection, unsafe patterns |
| 6 | Is the change minimal? | Could the same result be achieved with fewer changes? |
| 7 | Does it compile/build? | CI status |
| 8 | Do existing tests still pass? | CI status + bash outputs from session |
| 9 | Are error cases handled? | Review error handling in new code |
| 10 | Is the commit message accurate? | Check `suggestedCommitMessage` from final changeset |

### 6c. Request Changes

If the PR needs work:

**Option A — Send feedback via Jules session:**
```
POST /v1alpha/sessions/{id}:sendMessage
{ "prompt": "The authentication middleware is missing rate limiting. Add a rate limiter of 100 req/min per IP." }
```
Jules will push a new commit to the PR.

**Option B — Comment on the PR directly:**
Jules can read PR comments (if comment-reading is enabled). Add the `@Jules` mention or just comment, and Jules will respond.

### 6d. Auto-Merge Evaluation

**Criteria checked by `AutoMergeEvaluator`:**
- complexity_score < threshold (default 0.3)
- lines_changed ≤ max (default 200)
- files_changed ≤ max (default 5)
- No critical files touched
- CI passing
- PR age ≥ minimum (default 2h)
- No `changes_requested` reviews

**If eligible:** The zo computer can call `pr_merge` to merge automatically.
**If not eligible:** Human review required. Dashboard shows why.

### 6e. Merge

**API call (via GitHub):** `PUT /repos/{owner}/{repo}/pulls/{number}/merge`

**Jules Command:** `pr_merge` tool → validates eligibility → merges via Octokit → updates `pr_reviews.merged_at`.

---

## 7. Batch / Maintenance Workflows

### 7a. Scheduled Tasks

Jules supports scheduled recurring tasks (via the web UI, not API). These fire automatically on a cron schedule and create sessions.

Jules Command tracks these the same way — they show up as regular sessions in polling.

### 7b. Suggested Tasks

Jules can proactively scan repos for TODOs and performance issues. These appear as suggestions in the UI.

Currently no API to trigger/manage them — track via polling if sessions are created from suggestions.

### 7c. Issue-Triggered Tasks

Label a GitHub issue with `jules` → Jules creates a session to fix it.

Jules Command picks these up in the next poll cycle — they appear as regular sessions.

---

## 8. Source Management

### 8a. List Connected Repos

**API call:** `GET /v1alpha/sources`

**Jules Command:** `repo_sync` tool with `all: true` → lists sources, cross-references with GitHub API for metadata, persists to `repos` table.

### 8b. Get Specific Source

**API call:** `GET /v1alpha/sources/{name}`

---

## 9. Decision Tree — What Should the Automated System Do?

```
Poll all active sessions
│
├─ Session in 'queued'
│   └─ Age > 10 min? → Flag as stalled (queue_timeout)
│
├─ Session in 'planning'
│   └─ Just monitor — plan being generated
│
├─ Session in 'awaiting_plan_approval'
│   ├─ Age > 30 min? → Flag as stalled (plan_approval_timeout)
│   └─ Auto-approve enabled? → Approve automatically
│
├─ Session in 'in_progress'
│   ├─ New activities? → Log them, update DB
│   ├─ No activities for 15 min? → Flag as stalled (no_progress)
│   └─ Repeated bash errors? → Flag (repeated_errors), consider sending help
│
├─ Session in 'awaiting_user_feedback'
│   ├─ Read the question
│   ├─ Can answer automatically? → Send answer
│   └─ Need human? → Flag for human attention
│
├─ Session 'completed'
│   ├─ Has PR? → Track in pr_reviews
│   │   ├─ Score complexity
│   │   ├─ Check CI
│   │   ├─ Auto-merge eligible? → Queue for merge (after age threshold)
│   │   └─ Not eligible? → Flag for human review
│   └─ No PR? → Record outputs, mark tracked
│
└─ Session 'failed'
    └─ Record error, flag for decision (retry/abandon)
```

---

## 10. End-to-End Example

```
1. User asks zo computer: "Fix the flaky test in auth.test.ts"
2. Zo calls jules_create_session(prompt="Fix flaky test in auth.test.ts", repo="myorg/myapp")
3. Jules Command creates session, inserts DB row, returns sessionId
4. Zo calls jules_poll() after 2 minutes
5. Poll finds session in 'awaiting_plan_approval' — plan has 4 steps
6. Zo reviews plan via jules_get_session(sessionId), decides it looks good
7. Zo calls jules_approve_plan(sessionId)
8. Zo calls jules_poll() after 5 minutes
9. Poll finds session in 'in_progress' with 6 new activities
10. Zo calls jules_poll() after 5 more minutes
11. Poll finds session 'completed' with PR at github.com/myorg/myapp/pull/42
12. PR tracked in pr_reviews, complexity scored at 0.18 (trivial), CI passing
13. pr_check_auto_merge → eligible (score 0.18, 45 lines, 2 files, no critical, CI green)
14. But PR age is only 0.1h — below 2h threshold
15. Later: zo calls pr_check_auto_merge again → age now 2.5h → eligible
16. Zo calls pr_merge(prUrl="https://github.com/myorg/myapp/pull/42")
17. PR merged. Database updated. Done.
```
