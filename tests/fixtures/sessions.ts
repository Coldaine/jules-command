/**
 * Test fixtures — session factories.
 */

import type { SessionInsert } from '../../src/db/repositories/session.repo.js';

let counter = 0;

export function makeSession(overrides: Partial<SessionInsert> = {}): SessionInsert {
  counter++;
  return {
    id: `session-${counter}`,
    title: `Test Session ${counter}`,
    prompt: `Fix bug #${counter}`,
    repoId: null,
    sourceBranch: 'main',
    state: 'in_progress',
    automationMode: 'AUTO_CREATE_PR',
    requirePlanApproval: false,
    planJson: null,
    planApprovedAt: null,
    julesUrl: null,
    prUrl: null,
    prTitle: null,
    errorReason: null,
    stallDetectedAt: null,
    stallReason: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    lastPolledAt: null,
    ...overrides,
  };
}

export function makeCompletedSession(overrides: Partial<SessionInsert> = {}): SessionInsert {
  return makeSession({
    state: 'completed',
    completedAt: new Date().toISOString(),
    prUrl: `https://github.com/test/repo/pull/${counter}`,
    ...overrides,
  });
}

export function makeStalledSession(overrides: Partial<SessionInsert> = {}): SessionInsert {
  const thirtyMinAgo = new Date(Date.now() - 31 * 60 * 1000).toISOString();
  return makeSession({
    state: 'awaiting_plan_approval',
    updatedAt: thirtyMinAgo,
    ...overrides,
  });
}
