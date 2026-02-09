# Jules Command — North Star

## Mission

Ensure zero Jules tasks fall through the cracks: every session gets the help it needs, every PR gets reviewed, nothing piles up.

## Top Goals

1. **No Jules PR pile-up** — Every Jules-created PR is tracked from creation through merge/close. Aging PRs are surfaced with increasing urgency (4h yellow → 24h orange → 72h red).

2. **Jules gets unstuck fast** — Stalled sessions (awaiting feedback, plan approval, or making no progress) are detected automatically and surfaced to the operator within minutes, not hours.

3. **No task slips through the cracks** — Every Jules session is polled, persisted to the local database, and visible in the dashboard. Terminal states (completed/failed) are reconciled with their PR outcomes.

4. **Informed merge decisions** — PRs are scored for complexity (lines, files, critical paths, test coverage) with a deterministic formula. Auto-merge is available for low-complexity, fully-tested, non-critical PRs that have aged sufficiently.

5. **Single pane of glass** — The `jules_dashboard` MCP tool gives the zo computer (or a human) a complete view: active sessions, stalls, pending PRs, auto-merge candidates, recent completions — in one call.

6. **MCP-native** — The entire system is an MCP server. The zo computer calls tools to poll, review, approve, merge, and get status. No CLI wrapper — direct API integration via `@google/jules-sdk`.

7. **TDD from day one** — Every service, repository, and tool has test coverage. Integration tests cover the full lifecycle. The project is built incrementally with tests written first.

## Non-Goals (for now)

- Real-time WebSocket streaming (polling is sufficient for v1)
- Multi-user / multi-tenant support
- Custom UI dashboard (MCP tool output is the dashboard)
- Background daemon mode (on-demand polling via MCP tools; daemon can be added later)
