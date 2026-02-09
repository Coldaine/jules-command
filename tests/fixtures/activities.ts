/**
 * Test fixtures — activity factories.
 */

import type { ActivityInsert } from '../../src/db/repositories/activity.repo.js';

let counter = 0;

export function makeActivity(sessionId: string, overrides: Partial<ActivityInsert> = {}): ActivityInsert {
  counter++;
  return {
    id: `activity-${counter}`,
    sessionId,
    type: 'progress_updated',
    originator: 'agent',
    message: null,
    planStepCount: null,
    progressTitle: `Step ${counter}`,
    progressDescription: `Working on step ${counter}`,
    hasChangeset: false,
    hasBashOutput: false,
    hasMedia: false,
    filesChanged: null,
    linesAdded: null,
    linesDeleted: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function makePlanActivity(sessionId: string, steps = 3): ActivityInsert {
  return makeActivity(sessionId, {
    type: 'plan_generated',
    originator: 'agent',
    planStepCount: steps,
    progressTitle: null,
    progressDescription: null,
  });
}

export function makeAgentMessageActivity(sessionId: string, message: string): ActivityInsert {
  return makeActivity(sessionId, {
    type: 'agent_messaged',
    originator: 'agent',
    message,
    progressTitle: null,
    progressDescription: null,
  });
}
