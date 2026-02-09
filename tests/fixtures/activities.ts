/**
 * Test fixtures — activity factories.
 */

import type { ActivityInsert } from '../../src/db/repositories/activity.repo.js';

let counter = 0;

export function makeActivity(overrides: Partial<ActivityInsert> = {}): ActivityInsert {
  counter++;
  return {
    id: `activity-${counter}`,
    sessionId: 'session-1',
    activityType: 'progress_updated',
    timestamp: new Date().toISOString(),
    content: null,
    metadata: null,
    ...overrides,
  };
}

export function makePlanActivity(sessionId: string, steps = 3): ActivityInsert {
  return makeActivity({
    sessionId,
    activityType: 'plan_generated',
    content: JSON.stringify({ steps }),
  });
}

export function makeAgentMessageActivity(sessionId: string, message: string): ActivityInsert {
  return makeActivity({
    sessionId,
    activityType: 'agent_messaged',
    content: message,
  });
}
