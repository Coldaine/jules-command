import { describe, it, expect } from 'vitest';
import { validateAndCallTool } from '../../src/mcp/server.js';
import { createTestDb } from '../setup.js';
import type { Config } from '../../src/config.js';
import { SessionRepository } from '../../src/db/repositories/session.repo.js';
import { repos } from '../../src/db/schema.js';

const config: Config = {
  julesApiKey: 'test',
  databasePath: ':memory:',
  pollingIntervalMs: 5000,
  pollDelayBetweenSessionsMs: 100,
  stallPlanApprovalTimeoutMin: 30,
  stallFeedbackTimeoutMin: 30,
  stallNoProgressTimeoutMin: 15,
  stallQueueTimeoutMin: 10,
  stallConsecutiveErrors: 3,
  autoMergeMaxComplexity: 0.3,
  autoMergeMaxLines: 200,
  autoMergeMaxFiles: 5,
  autoMergeMinAgeHours: 2,
  complexityLinesThreshold: 500,
  complexityFilesThreshold: 20,
};

describe('validateAndCallTool', () => {
  it('rejects invalid enum inputs', async () => {
    const { db } = createTestDb();
    const result = await validateAndCallTool('jules_sessions_by_state', { state: 'bad' }, { db, config });
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Invalid input');
  });

  it('calls safe query tool with valid input', async () => {
    const { db } = createTestDb();
    const sessions = new SessionRepository(db);
    await db.insert(repos).values({ id: 'owner/repo', owner: 'owner', name: 'repo', fullName: 'owner/repo' });
    await sessions.upsert({
      id: 's1', title: 'A', prompt: 'P', repoId: 'owner/repo', sourceBranch: 'main', state: 'queued',
      automationMode: null, requirePlanApproval: null, planJson: null, planApprovedAt: null,
      julesUrl: null, prUrl: null, prTitle: null, errorReason: null, stallDetectedAt: null,
      stallReason: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), completedAt: null, lastPolledAt: null,
    });

    const result = await validateAndCallTool('jules_sessions_by_state', { state: 'queued' }, { db, config });
    expect(result.ok).toBe(true);
    expect(Array.isArray(result.result)).toBe(true);
  });

  it('enforces pr_merge safety gate when not eligible', async () => {
    const { db } = createTestDb();
    const result = await validateAndCallTool('pr_merge', { prUrl: 'https://github.com/o/r/pull/1' }, { db, config });
    expect(result.ok).toBe(true);
    expect(result.result).toMatchObject({ merged: false });
  });
});
