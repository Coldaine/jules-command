/**
 * Phase 6 Task 6.3: Dashboard Service Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DashboardService } from '../../src/services/dashboard.js';
import { createTestDb } from '../setup.js';
import { SessionRepository } from '../../src/db/repositories/session.repo.js';
import { PrReviewRepository } from '../../src/db/repositories/pr-review.repo.js';

describe('DashboardService', () => {
  let db: ReturnType<typeof createTestDb>['db'];
  let _sqlite: ReturnType<typeof createTestDb>['sqlite'];
  let dashboard: DashboardService;
  let sessionRepo: SessionRepository;
  let prReviewRepo: PrReviewRepository;

  beforeEach(() => {
    const testDb = createTestDb();
    db = testDb.db;
    sqlite = testDb.sqlite;
    dashboard = new DashboardService(db);
    sessionRepo = new SessionRepository(db);
    prReviewRepo = new PrReviewRepository(db);
  });

  describe('Dashboard Generation', () => {
    it.skip('should generate dashboard with session counts', async () => {
      // Setup: Create sessions in different states
      await sessionRepo.upsert({
        id: 'session-1',
        title: 'In Progress',
        state: 'in_progress',
        repo: 'owner/repo',
        branch: 'main',
      });
      await sessionRepo.upsert({
        id: 'session-2',
        title: 'Queued',
        state: 'queued',
        repo: 'owner/repo',
        branch: 'main',
      });
      await sessionRepo.upsert({
        id: 'session-3',
        title: 'Completed',
        state: 'completed',
        repo: 'owner/repo',
        branch: 'main',
      });

      const output = await dashboard.generate();

      expect(output).toContain('in_progress: 1');
      expect(output).toContain('queued: 1');
      expect(output).toContain('completed: 1');
    });

    it.skip('should list stalled sessions', async () => {
      await sessionRepo.upsert({
        id: 'session-1',
        title: 'Stalled Session',
        state: 'awaiting_plan_approval',
        repo: 'owner/repo',
        branch: 'main',
        updatedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
        stalledAt: new Date().toISOString(),
        stallReason: 'plan_approval_timeout',
      });

      const output = await dashboard.generate();

      expect(output).toContain('Stalled Session');
      expect(output).toContain('plan_approval_timeout');
    });

    it.skip('should list pending PR reviews', async () => {
      await sessionRepo.upsert({
        id: 'session-1',
        title: 'PR Session',
        state: 'completed',
        repo: 'owner/repo',
        branch: 'main',
        prUrl: 'https://github.com/owner/repo/pull/123',
      });

      await prReviewRepo.upsert({
        sessionId: 'session-1',
        prUrl: 'https://github.com/owner/repo/pull/123',
        prNumber: 123,
        prTitle: 'Test PR',
        prState: 'open',
        prCreatedAt: new Date().toISOString(),
        ciStatus: 'success',
        reviewStatus: 'approved',
        linesChanged: 50,
        filesChanged: 3,
        testFilesChanged: 1,
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
        complexityScore: 0.2,
      });

      const output = await dashboard.generate();

      expect(output).toContain('Test PR');
      expect(output).toContain('#123');
    });

    it.skip('should format as markdown', async () => {
      const output = await dashboard.generate();

      expect(output).toContain('# ');  // Has headings
      expect(output).toContain('## '); // Has subheadings
    });

    it.skip('should filter by time range', async () => {
      // Create old session
      await sessionRepo.upsert({
        id: 'session-old',
        title: 'Old Session',
        state: 'completed',
        repo: 'owner/repo',
        branch: 'main',
        createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 48 hours ago
      });

      // Create recent session
      await sessionRepo.upsert({
        id: 'session-new',
        title: 'Recent Session',
        state: 'completed',
        repo: 'owner/repo',
        branch: 'main',
        createdAt: new Date().toISOString(),
      });

      const output = await dashboard.generate({ hours: 24 });

      expect(output).toContain('Recent Session');
      expect(output).not.toContain('Old Session');
    });

    it.skip('should include completed sessions when opted in', async () => {
      await sessionRepo.upsert({
        id: 'session-completed',
        title: 'Completed Session',
        state: 'completed',
        repo: 'owner/repo',
        branch: 'main',
      });

      const withCompleted = await dashboard.generate({ includeCompleted: true });
      const withoutCompleted = await dashboard.generate({ includeCompleted: false });

      expect(withCompleted).toContain('Completed Session');
      expect(withoutCompleted).not.toContain('Completed Session');
    });

    it.skip('should handle empty database', async () => {
      const output = await dashboard.generate();

      expect(output).toContain('No active sessions');
    });

    it.skip('should show auto-merge eligible PRs', async () => {
      await sessionRepo.upsert({
        id: 'session-1',
        title: 'PR Session',
        state: 'completed',
        repo: 'owner/repo',
        branch: 'main',
        prUrl: 'https://github.com/owner/repo/pull/123',
      });

      await prReviewRepo.upsert({
        sessionId: 'session-1',
        prUrl: 'https://github.com/owner/repo/pull/123',
        prNumber: 123,
        prTitle: 'Eligible PR',
        prState: 'open',
        prCreatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
        ciStatus: 'success',
        reviewStatus: 'approved',
        linesChanged: 50,
        filesChanged: 3,
        testFilesChanged: 1,
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
        complexityScore: 0.2,
      });

      const output = await dashboard.generate();

      expect(output).toContain('auto-merge eligible');
    });
  });

  describe('Session Summaries', () => {
    it.skip('should include session details', async () => {
      await sessionRepo.upsert({
        id: 'session-1',
        title: 'Detailed Session',
        state: 'in_progress',
        repo: 'owner/repo',
        branch: 'feature-branch',
      });

      const output = await dashboard.generate();

      expect(output).toContain('Detailed Session');
      expect(output).toContain('owner/repo');
      expect(output).toContain('feature-branch');
    });

    it.skip('should show time since last update', async () => {
      await sessionRepo.upsert({
        id: 'session-1',
        title: 'Test Session',
        state: 'in_progress',
        repo: 'owner/repo',
        branch: 'main',
        updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 min ago
      });

      const output = await dashboard.generate();

      expect(output).toMatch(/15.*min/i);
    });
  });

  describe('PR Review Summaries', () => {
    it.skip('should show PR complexity score', async () => {
      await sessionRepo.upsert({
        id: 'session-1',
        title: 'PR Session',
        state: 'completed',
        repo: 'owner/repo',
        branch: 'main',
        prUrl: 'https://github.com/owner/repo/pull/123',
      });

      await prReviewRepo.upsert({
        sessionId: 'session-1',
        prUrl: 'https://github.com/owner/repo/pull/123',
        prNumber: 123,
        prTitle: 'Test PR',
        prState: 'open',
        prCreatedAt: new Date().toISOString(),
        ciStatus: 'success',
        reviewStatus: 'approved',
        linesChanged: 50,
        filesChanged: 3,
        testFilesChanged: 1,
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
        complexityScore: 0.45,
      });

      const output = await dashboard.generate();

      expect(output).toMatch(/0\.45|45%/);
    });

    it.skip('should show CI status', async () => {
      await sessionRepo.upsert({
        id: 'session-1',
        title: 'PR Session',
        state: 'completed',
        repo: 'owner/repo',
        branch: 'main',
        prUrl: 'https://github.com/owner/repo/pull/123',
      });

      await prReviewRepo.upsert({
        sessionId: 'session-1',
        prUrl: 'https://github.com/owner/repo/pull/123',
        prNumber: 123,
        prTitle: 'Test PR',
        prState: 'open',
        prCreatedAt: new Date().toISOString(),
        ciStatus: 'failure',
        reviewStatus: null,
        linesChanged: 50,
        filesChanged: 3,
        testFilesChanged: 1,
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
        complexityScore: 0.2,
      });

      const output = await dashboard.generate();

      expect(output).toMatch(/CI.*fail/i);
    });
  });
});
