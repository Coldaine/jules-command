/**
 * Test fixtures — poll cursor factories.
 */

import type { PollCursorInsert } from '../../src/db/repositories/poll-cursor.repo.js';

let counter = 0;

export function makePollCursor(overrides: Partial<PollCursorInsert> = {}): PollCursorInsert {
  counter++;
  return {
    id: overrides.id ?? `cursor-${counter}`,
    pollType: overrides.pollType ?? 'session_activity',
    lastPollAt: overrides.lastPollAt ?? new Date().toISOString(),
    lastActivitySeenAt: overrides.lastActivitySeenAt ?? null,
    lastPageToken: overrides.lastPageToken ?? null,
    pollCount: overrides.pollCount ?? 0,
    consecutiveUnchanged: overrides.consecutiveUnchanged ?? 0,
    errorCount: overrides.errorCount ?? 0,
    lastError: overrides.lastError ?? null,
  };
}
