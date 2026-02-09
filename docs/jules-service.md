# Jules Service & SDK Integration

[← Back to Architecture](./architecture.md)

## Overview

`JulesService` wraps `@google/jules-sdk` and adds persistent database writes at every API interaction. Every call to Jules flows through this service so the local DB always has an up-to-date mirror.

## API Mapping

| Service Method | SDK Method | DB Effect |
|---------------|------------|-----------|
| `createSession(opts)` | `jules.session()` / `jules.run()` | INSERT `jules_sessions` |
| `getSession(id)` | `session.info()` | UPSERT `jules_sessions` |
| `listSessions(filters)` | SDK list / DB query | UPSERT batch |
| `approvePlan(id)` | `session.approve()` | UPDATE `jules_sessions.plan_approved_at` |
| `sendMessage(id, msg)` | `session.send()` | INSERT `jules_activities` (user) |
| `askAndWait(id, msg)` | `session.ask()` | INSERT activities (user + agent reply) |
| `getActivities(id, opts)` | Activity stream | INSERT batch `jules_activities` |
| `getDiff(id)` | `session.snapshot()` | Return unidiff, update changeset metadata |
| `getBashOutputs(id)` | Activity filter | Return bash artifacts |
| `getSessionSnapshot(id)` | Composite | Aggregated from DB: timeline, stats, PR |

## Session State Mapping

Jules SDK states → our database `state` column:

```
unspecified → unspecified
queued → queued
planning → planning
awaitingPlanApproval → awaiting_plan_approval
inProgress → in_progress
awaitingUserFeedback → awaiting_user_feedback
paused → paused
completed → completed
failed → failed
```

## Activity Type Mapping

| SDK Activity Type | DB `type` value | Key Fields |
|-------------------|-----------------|------------|
| `planGenerated` | `plan_generated` | `plan_step_count`, plan JSON |
| `planApproved` | `plan_approved` | planId |
| `progressUpdated` | `progress_updated` | `progress_title`, `progress_description`, artifacts |
| `agentMessaged` | `agent_messaged` | `message` |
| `userMessaged` | `user_messaged` | `message` |
| `sessionCompleted` | `session_completed` | final changeset |
| `sessionFailed` | `session_failed` | `error_reason` |

## Artifact Handling

Activities may contain artifacts:

- **changeSet**: git patches. We parse the unidiff to extract `files_changed`, `lines_added`, `lines_deleted`. Full patch stored on demand (or re-fetched from API).
- **bashOutput**: command + output + exit code. Stored as-is for querying.
- **media**: images (screenshots, etc.). We record `has_media = true` and `mimeType`. Binary data not stored in DB — re-fetched from API when needed.

## Error Handling

All SDK calls are wrapped with:
1. Try/catch for `JulesError` hierarchy (`JulesNetworkError`, `JulesApiError`, `JulesRateLimitError`, `MissingApiKeyError`)
2. Rate limit errors → exponential backoff (1s, 2s, 4s, ... max 60s)
3. Network errors → retry up to 3 times with delay
4. API errors → log, record in `poll_cursors.last_error`, propagate to caller

## Configuration

```typescript
interface JulesServiceConfig {
  apiKey: string;
  pollingIntervalMs?: number;  // default 5000
  timeout?: number;            // default 60000
  maxRetries?: number;         // default 3
}
```
