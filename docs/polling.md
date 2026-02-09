# Polling & Stall Detection

[← Back to Architecture](./architecture.md)

## Polling Architecture

Polling is on-demand — triggered by the `jules_poll` MCP tool. The zo computer calls this tool at whatever cadence it chooses (every few minutes, every hour, or reactively).

### PollManager

```typescript
class PollManager {
  async pollSession(sessionId: string): Promise<PollResult>;
  async pollAllActive(): Promise<PollSummary>;
}
```

### Single Session Poll (`pollSession`)

1. Fetch session from Jules API via SDK
2. Compare with DB row → detect state changes
3. Fetch new activities (using `createTime` cursor from `poll_cursors`)
4. Insert new activities into `jules_activities`
5. Update `jules_sessions` row
6. Update `poll_cursors` with new timestamps
7. Check for PR in session output → upsert `pr_reviews` if present
8. Run stall detection
9. Return `PollResult`

### Batch Poll (`pollAllActive`)

1. Query DB: `SELECT id FROM jules_sessions WHERE state NOT IN ('completed', 'failed')`
2. For each: `pollSession(id)` with rate limiting (100ms delay between calls)
3. Optionally sync PRs from GitHub API
4. Aggregate results into `PollSummary`

```typescript
interface PollSummary {
  sessionsPolled: number;
  sessionsUpdated: number;
  stallsDetected: StallInfo[];
  prsUpdated: number;
  errors: PollError[];
}
```

## Stall Detection

### StallDetector

```typescript
class StallDetector {
  detect(session: SessionRow, activities: ActivityRow[]): StallInfo | null;
}
```

### Rules

| Rule ID | Condition | Stall Reason | Default Threshold |
|---------|-----------|--------------|-------------------|
| `plan_approval_timeout` | state = `awaiting_plan_approval` AND age > threshold | Plan awaiting approval too long | 30 min |
| `feedback_timeout` | state = `awaiting_user_feedback` AND age > threshold | Jules asked a question, no response | 30 min |
| `no_progress` | state = `in_progress` AND no new activity for > threshold | Session stuck | 15 min |
| `queue_timeout` | state = `queued` AND age > threshold | Stuck in queue | 10 min |
| `repeated_errors` | last N activities are `progressUpdated` with bash exit code > 0 | Jules hitting errors repeatedly | 3 consecutive |

### Stall Response

When a stall is detected:
1. Set `stall_detected_at` and `stall_reason` in `jules_sessions`
2. Include in `PollSummary.stallsDetected`
3. Surface in `jules_dashboard` output
4. The zo computer decides what to do (approve plan, send message, retry, abandon)

## Rate Limiting

- **Jules API**: 100ms delay between sequential requests. On 429: exponential backoff.
- **GitHub API**: Check `X-RateLimit-Remaining`. If < 10, pause until `X-RateLimit-Reset`.
- **Per-session backoff**: After 3 consecutive errors on a session, skip it for 5 min.

## Cursor Management

Each session gets a `poll_cursors` entry:

```
id: session-123
poll_type: activities
last_poll_at: 2026-02-09T10:00:00Z
last_activity_seen_at: 2026-02-09T09:55:00Z
consecutive_unchanged: 0
```

Activities endpoint supports `createTime` filter — we pass `last_activity_seen_at` to only fetch new activities.

## PR Age Alerts

| Level | Threshold | Action |
|-------|-----------|--------|
| Yellow | > 4 hours | Note in dashboard |
| Orange | > 24 hours | Highlight in dashboard |
| Red | > 72 hours | Urgent flag in dashboard |
