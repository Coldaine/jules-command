# Jules Command — Architecture

## Overview

Jules Command is an MCP server that wraps the Google Jules API (via `@google/jules-sdk`) with persistent state tracking, stall detection, PR lifecycle management, and GitHub integration. It is designed to be called by the zo computer as a set of MCP tools.

```
┌─────────────────────────────────────────────────────────────────┐
│                        ZO COMPUTER                              │
│               (calls MCP tools as needed)                       │
└────────────────────────────┬────────────────────────────────────┘
                             │ MCP (stdio/SSE)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                     JULES COMMAND MCP SERVER                    │
│                                                                 │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  MCP Tools  │  │   Services   │  │      Database         │  │
│  │ (18 tools)  │──│              │──│    (SQLite/Drizzle)   │  │
│  └─────────────┘  │ JulesService │  │                       │  │
│                   │ GitHubService│  │  repos                │  │
│                   │ PollManager  │  │  jules_sessions       │  │
│                   │ StallDetect  │  │  jules_activities     │  │
│                   │ Complexity   │  │  pr_reviews           │  │
│                   │ AutoMerge    │  │  poll_cursors         │  │
│                   │ Dashboard    │  │                       │  │
│                   └──────┬───────┘  └───────────────────────┘  │
│                          │                                      │
└──────────────────────────┼──────────────────────────────────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        Jules API     GitHub API   Bitwarden
        (SDK)         (Octokit)    (Secrets)
```

## Subdomain Documentation

Each major subsystem has its own detailed design document:

- [Database & Schema](./database.md) — Tables, indexes, migration strategy, complexity scoring formula
- [Jules Service & SDK Integration](./jules-service.md) — SDK wrapper, session management, activity tracking
- [Polling & Stall Detection](./polling.md) — Poll engine, stall heuristics, rate limiting, cursor management
- [GitHub Integration](./github-integration.md) — Repo sync, PR status tracking, merge workflow
- [PR Review & Auto-Merge](./pr-review.md) — Complexity scoring, auto-merge criteria, review lifecycle
- [MCP Tools Reference](./mcp-tools.md) — Tool catalog with input/output schemas
- [Jules Workflows](./jules-workflows.md) — Complete enumeration of Jules API workflows and decision points

## Data Flow

### Polling Cycle (`jules_poll`)

```
1. Query DB for active sessions (state NOT IN completed, failed)
2. For each session:
   a. GET /sessions/{id} via SDK → upsert jules_sessions
   b. GET /sessions/{id}/activities (since last cursor) → insert jules_activities
   c. Update poll_cursors
   d. Run stall detection rules
3. For tracked PRs (if syncPRs=true):
   a. Fetch PR state from GitHub API → update pr_reviews
   b. Recompute complexity_score + auto_merge_eligible
4. Return summary: { polled, updated, stalls_detected, errors }
```

### Session Lifecycle

```
Created → Queued → Planning → AwaitingPlanApproval → InProgress → Completed/Failed
                                    │                     │
                                    ▼                     ▼
                              (approve/revise)    AwaitingUserFeedback
                                                        │
                                                        ▼
                                                  (send message)
```

### PR Lifecycle

```
Session Completed → PR Created → Tracked in DB → Complexity Scored
    → Auto-Merge Check → { eligible: merge after age threshold }
                          { ineligible: human review required }
```

## Technology Choices

| Component | Choice | Rationale |
|-----------|--------|-----------|
| Runtime | Node.js 20+ (ESM) | SDK is TypeScript, MCP SDK is Node |
| Database | SQLite via better-sqlite3 | Single-file, synchronous, zero-config |
| ORM | Drizzle | Type-safe, lightweight, migrations |
| Jules client | @google/jules-sdk | Official SDK, handles auth + polling |
| GitHub client | @octokit/rest | Official, typed |
| MCP framework | @modelcontextprotocol/sdk | Standard MCP server |
| Testing | Vitest + MSW | Fast, ESM-native, API mocking |
| Validation | Zod | Input schemas for MCP tools |
| Secrets | Bitwarden Secrets Manager | GitHub token storage |

## Configuration

Environment variables (see `.env.example`):
- `JULES_API_KEY` — Jules API key
- `GITHUB_TOKEN` — GitHub PAT (from Bitwarden)
- `DATABASE_PATH` — SQLite file path (default: `./data/jules-command.db`)
- Configurable thresholds for stall detection, PR aging, auto-merge
