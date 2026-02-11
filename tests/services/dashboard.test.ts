import { describe, it, expect, beforeEach } from 'vitest';
import type { Config } from '../../src/config.js';
import { DashboardService } from '../../src/services/dashboard.js';
import { createTestDb } from '../setup.js';
import { SessionRepository } from '../../src/db/repositories/session.repo.js';
import { PrReviewRepository } from '../../src/db/repositories/pr-review.repo.js';
import { repos } from '../../src/db/schema.js';

function testConfig(): Config {
  return {
    julesApiKey: 'test-key',
    githubToken: 'test-token',
    bwsAccessToken: undefined,
    bwsGithubSecretId: undefined,
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
}

describe('DashboardService', () => {
  let db: ReturnType<typeof createTestDb>['db'];
  let sqlite: ReturnType<typeof createTestDb>['sqlite'];
  let dashboard: DashboardService;
  let sessionRepo: SessionRepository;
  let prReviewRepo: PrReviewRepository;

  beforeEach(async () => {
    const testDb = createTestDb();
    db = testDb.db;
    sqlite = testDb.sqlite;
    dashboard = new DashboardService(db, testConfig());
    sessionRepo = new SessionRepository(db);
    prReviewRepo = new PrReviewRepository(db);

    await db.insert(repos).values({
      id: 'owner/repo',
      owner: 'owner',
      name: 'repo',
      fullName: 'owner/repo',
      createdAt: new Date().toISOString(),
    });
  });

  it('generates markdown with state counts and recent sessions', async () => {
    const now = new Date().toISOString();
    await sessionRepo.upsert({ id: 'session-1', prompt: 'p1', title: 'In Progress', state: 'in_progress', repoId: 'owner/repo', sourceBranch: 'main', createdAt: now, updatedAt: now });
    await sessionRepo.upsert({ id: 'session-2', prompt: 'p2', title: 'Queued', state: 'queued', repoId: 'owner/repo', sourceBranch: 'dev', createdAt: now, updatedAt: now });

    const output = await dashboard.generate();

    expect(output).toContain('# Jules Dashboard');
    expect(output).toContain('## Session counts');
    expect(output).toContain('- in_progress: 1');
    expect(output).toContain('- queued: 1');
    expect(output).toContain('In Progress');
  });

  it('lists stalled sessions and pending PR rows', async () => {
    const now = new Date().toISOString();
    await sessionRepo.upsert({
      id: 'session-stalled',
      prompt: 'p3',
      title: 'Stalled Session',
      state: 'awaiting_plan_approval',
      repoId: 'owner/repo',
      sourceBranch: 'main',
      stallDetectedAt: now,
      stallReason: 'plan_approval_timeout',
      createdAt: now,
      updatedAt: now,
    });

    await prReviewRepo.upsert({
      sessionId: 'session-stalled',
      repoId: 'owner/repo',
      prUrl: 'https://github.com/owner/repo/pull/123',
      prNumber: 123,
      prTitle: 'Needs review',
      reviewStatus: 'pending',
      autoMergeEligible: true,
    });

    const output = await dashboard.generate({ includeCompleted: true });

    expect(output).toContain('Stalled Session: plan_approval_timeout');
    expect(output).toContain('#123 Needs review (pending)');
    expect(output).toContain('Auto-merge eligible: 1');
  });

  it('filters out old sessions with hours window', async () => {
    const old = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();
    await sessionRepo.upsert({ id: 'old-session', prompt: 'old', title: 'Old Session', state: 'in_progress', repoId: 'owner/repo', sourceBranch: 'main', createdAt: old, updatedAt: old });
    await sessionRepo.upsert({ id: 'new-session', prompt: 'new', title: 'New Session', state: 'in_progress', repoId: 'owner/repo', sourceBranch: 'main', createdAt: now, updatedAt: now });

    const output = await dashboard.generate({ hours: 24 });

    expect(output).toContain('New Session');
    expect(output).not.toContain('Old Session');
  });

  it('returns empty-state message when no active sessions', async () => {
    const output = await dashboard.generate();
    expect(output).toContain('No active sessions.');
  });

  it('includes completed sessions only when includeCompleted=true', async () => {
    const now = new Date().toISOString();
    await sessionRepo.upsert({ id: 'completed-1', prompt: 'done', title: 'Completed Session', state: 'completed', repoId: 'owner/repo', sourceBranch: 'main', createdAt: now, updatedAt: now });

    const withoutCompleted = await dashboard.generate({ includeCompleted: false, hours: 72 });
    const withCompleted = await dashboard.generate({ includeCompleted: true, hours: 72 });

    expect(withoutCompleted).not.toContain('Completed Session');
    expect(withCompleted).toContain('Completed Session');
  });

  afterEach(() => {
    sqlite.close();
  });
});
