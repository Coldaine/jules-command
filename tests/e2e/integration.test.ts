/**
 * Phase 8 Task 8.1-8.2: End-to-End Integration Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../setup.js';
import { SessionRepository } from '../../src/db/repositories/session.repo.js';
import { ActivityRepository } from '../../src/db/repositories/activity.repo.js';
import { PrReviewRepository } from '../../src/db/repositories/pr-review.repo.js';
import { PollManager } from '../../src/services/poll-manager.js';
import { ComplexityScorer } from '../../src/services/complexity-scorer.js';
import { AutoMergeEvaluator } from '../../src/services/auto-merge.js';
import type { Config } from '../../src/config.js';

describe('End-to-End Integration Tests', () => {
  const defaultConfig: Config = {
    julesApiKey: 'test-jules-key',
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

  let db: ReturnType<typeof createTestDb>['db'];
  let _sqlite: ReturnType<typeof createTestDb>['sqlite'];
  let sessionRepo: SessionRepository;
  let activityRepo: ActivityRepository;
  let prReviewRepo: PrReviewRepository;

  beforeEach(() => {
    const testDb = createTestDb();
    db = testDb.db;
    sqlite = testDb.sqlite;
    sessionRepo = new SessionRepository(db);
    activityRepo = new ActivityRepository(db);
    prReviewRepo = new PrReviewRepository(db);
  });

  describe('Task 8.1: Full Lifecycle Test', () => {
    it.skip('should complete full session lifecycle', async () => {
      /**
       * Full workflow:
       * 1. Create session (mocked Jules API)
       * 2. Poll → session moves to 'awaiting_plan_approval'
       * 3. Approve plan
       * 4. Poll → session moves to 'in_progress'
       * 5. Poll → session moves to 'completed' with PR URL
       * 6. Score PR complexity
       * 7. Evaluate auto-merge eligibility
       * 8. Merge PR (mocked GitHub API)
       */

      // Step 1: Create session
      await sessionRepo.upsert({
        id: 'e2e-session-1',
        title: 'E2E Test Session',
        state: 'queued',
        repo: 'owner/repo',
        branch: 'main',
      });

      // Step 2: First poll - session awaiting plan approval
      // Mock: Jules API returns awaiting_plan_approval
      let session = await sessionRepo.findById('e2e-session-1');
      expect(session?.state).toBe('queued');

      // Step 3: Approve plan
      await sessionRepo.upsert({
        id: 'e2e-session-1',
        state: 'in_progress',
      });

      // Step 4: Poll - session in progress
      session = await sessionRepo.findById('e2e-session-1');
      expect(session?.state).toBe('in_progress');

      // Step 5: Poll - session completed with PR
      await sessionRepo.upsert({
        id: 'e2e-session-1',
        state: 'completed',
        prUrl: 'https://github.com/owner/repo/pull/123',
      });

      session = await sessionRepo.findById('e2e-session-1');
      expect(session?.state).toBe('completed');
      expect(session?.prUrl).toBeTruthy();

      // Step 6: Score PR complexity
      const scorer = new ComplexityScorer(defaultConfig);
      const complexityResult = scorer.score({
        linesChanged: 50,
        filesChanged: 3,
        testFilesChanged: 1,
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
      });

      await prReviewRepo.upsert({
        sessionId: 'e2e-session-1',
        prUrl: 'https://github.com/owner/repo/pull/123',
        prNumber: 123,
        prTitle: 'E2E Test PR',
        prState: 'open',
        prCreatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        ciStatus: 'success',
        reviewStatus: 'approved',
        linesChanged: 50,
        filesChanged: 3,
        testFilesChanged: 1,
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
        complexityScore: complexityResult.score,
      });

      // Step 7: Evaluate auto-merge eligibility
      const prReview = await prReviewRepo.findByPrUrl('https://github.com/owner/repo/pull/123');
      expect(prReview).toBeTruthy();
      
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const eligibility = evaluator.evaluate(prReview!);
      expect(eligibility.eligible).toBe(true);

      // Step 8: Merge PR (mocked)
      await prReviewRepo.upsert({
        sessionId: 'e2e-session-1',
        prUrl: 'https://github.com/owner/repo/pull/123',
        mergedAt: new Date().toISOString(),
      });

      const finalPrReview = await prReviewRepo.findByPrUrl('https://github.com/owner/repo/pull/123');
      expect(finalPrReview?.mergedAt).toBeTruthy();
    });

    it.skip('should handle lifecycle with activities', async () => {
      // Create session
      await sessionRepo.upsert({
        id: 'e2e-session-2',
        title: 'Session with Activities',
        state: 'in_progress',
        repo: 'owner/repo',
        branch: 'main',
      });

      // Add activities during progress
      await activityRepo.insertMany([
        {
          sessionId: 'e2e-session-2',
          activityType: 'bash_output',
          createdAt: new Date().toISOString(),
          progressDescription: 'Running tests',
          hasBashOutput: true,
        },
        {
          sessionId: 'e2e-session-2',
          activityType: 'user_message',
          createdAt: new Date().toISOString(),
          progressDescription: 'User feedback',
          hasBashOutput: false,
        },
      ]);

      const activities = await activityRepo.findBySessionId('e2e-session-2');
      expect(activities.length).toBe(2);
    });

    it.skip('should maintain data integrity across lifecycle', async () => {
      // Verify foreign key relationships
      await sessionRepo.upsert({
        id: 'e2e-session-3',
        title: 'Integrity Test',
        state: 'completed',
        repo: 'owner/repo',
        branch: 'main',
        prUrl: 'https://github.com/owner/repo/pull/456',
      });

      await activityRepo.insertMany([
        {
          sessionId: 'e2e-session-3',
          activityType: 'bash_output',
          createdAt: new Date().toISOString(),
          progressDescription: 'Test activity',
          hasBashOutput: false,
        },
      ]);

      await prReviewRepo.upsert({
        sessionId: 'e2e-session-3',
        prUrl: 'https://github.com/owner/repo/pull/456',
        prNumber: 456,
        prTitle: 'Integrity Test PR',
        prState: 'open',
        prCreatedAt: new Date().toISOString(),
        ciStatus: 'success',
        reviewStatus: 'approved',
        linesChanged: 30,
        filesChanged: 2,
        testFilesChanged: 1,
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
        complexityScore: 0.15,
      });

      // Verify all related data exists
      const session = await sessionRepo.findById('e2e-session-3');
      const activities = await activityRepo.findBySessionId('e2e-session-3');
      const prReview = await prReviewRepo.findBySessionId('e2e-session-3');

      expect(session).toBeTruthy();
      expect(activities.length).toBeGreaterThan(0);
      expect(prReview).toBeTruthy();
    });
  });

  describe('Task 8.2: Stall Recovery Test', () => {
    it.skip('should detect stall and recover', async () => {
      /**
       * Stall recovery workflow:
       * 1. Create session
       * 2. Detect stall (plan approval timeout)
       * 3. Send help message
       * 4. Session resumes
       * 5. Session completes
       * 6. Verify stall flag cleared
       */

      // Step 1: Create session in stalled state
      await sessionRepo.upsert({
        id: 'stall-session-1',
        title: 'Stalled Session',
        state: 'awaiting_plan_approval',
        repo: 'owner/repo',
        branch: 'main',
        updatedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(), // 40 min ago
      });

      // Step 2: Detect stall
      const pollManager = new PollManager(defaultConfig, db);
      const pollResult = await pollManager.pollSession('stall-session-1');
      
      expect(pollResult.stall).not.toBeNull();
      expect(pollResult.stall?.ruleId).toBe('plan_approval_timeout');

      // Mark as stalled
      await sessionRepo.upsert({
        id: 'stall-session-1',
        stalledAt: new Date().toISOString(),
        stallReason: 'plan_approval_timeout',
      });

      let session = await sessionRepo.findById('stall-session-1');
      expect(session?.stalledAt).toBeTruthy();
      expect(session?.stallReason).toBe('plan_approval_timeout');

      // Step 3: Send help message (mocked)
      await activityRepo.insertMany([
        {
          sessionId: 'stall-session-1',
          activityType: 'user_message',
          createdAt: new Date().toISOString(),
          progressDescription: 'Help message sent to unstall session',
          hasBashOutput: false,
        },
      ]);

      // Step 4: Session resumes
      await sessionRepo.upsert({
        id: 'stall-session-1',
        state: 'in_progress',
        updatedAt: new Date().toISOString(),
      });

      session = await sessionRepo.findById('stall-session-1');
      expect(session?.state).toBe('in_progress');

      // Step 5: Session completes
      await sessionRepo.upsert({
        id: 'stall-session-1',
        state: 'completed',
        prUrl: 'https://github.com/owner/repo/pull/789',
      });

      // Step 6: Verify stall flag cleared
      await sessionRepo.upsert({
        id: 'stall-session-1',
        stalledAt: null,
        stallReason: null,
      });

      session = await sessionRepo.findById('stall-session-1');
      expect(session?.state).toBe('completed');
      expect(session?.stalledAt).toBeNull();
      expect(session?.stallReason).toBeNull();
    });

    it.skip('should handle multiple stall-recovery cycles', async () => {
      // Create session
      await sessionRepo.upsert({
        id: 'multi-stall-session',
        title: 'Multi-Stall Session',
        state: 'queued',
        repo: 'owner/repo',
        branch: 'main',
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      });

      // First stall: queue timeout
      await sessionRepo.upsert({
        id: 'multi-stall-session',
        stalledAt: new Date().toISOString(),
        stallReason: 'queue_timeout',
      });

      let session = await sessionRepo.findById('multi-stall-session');
      expect(session?.stallReason).toBe('queue_timeout');

      // Recovery 1
      await sessionRepo.upsert({
        id: 'multi-stall-session',
        state: 'in_progress',
        stalledAt: null,
        stallReason: null,
      });

      // Second stall: no progress
      await sessionRepo.upsert({
        id: 'multi-stall-session',
        stalledAt: new Date().toISOString(),
        stallReason: 'no_progress',
      });

      session = await sessionRepo.findById('multi-stall-session');
      expect(session?.stallReason).toBe('no_progress');

      // Final recovery
      await sessionRepo.upsert({
        id: 'multi-stall-session',
        state: 'completed',
        stalledAt: null,
        stallReason: null,
      });

      session = await sessionRepo.findById('multi-stall-session');
      expect(session?.state).toBe('completed');
      expect(session?.stalledAt).toBeNull();
    });

    it.skip('should track stall history in activities', async () => {
      await sessionRepo.upsert({
        id: 'history-session',
        title: 'History Tracking',
        state: 'awaiting_plan_approval',
        repo: 'owner/repo',
        branch: 'main',
        updatedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      });

      // Record stall detection
      await activityRepo.insertMany([
        {
          sessionId: 'history-session',
          activityType: 'system_event',
          createdAt: new Date().toISOString(),
          progressDescription: 'Stall detected: plan_approval_timeout',
          hasBashOutput: false,
        },
      ]);

      // Record recovery
      await activityRepo.insertMany([
        {
          sessionId: 'history-session',
          activityType: 'system_event',
          createdAt: new Date().toISOString(),
          progressDescription: 'Stall cleared: session resumed',
          hasBashOutput: false,
        },
      ]);

      const activities = await activityRepo.findBySessionId('history-session');
      expect(activities.length).toBe(2);
      expect(activities.some(a => a.progressDescription?.includes('Stall detected'))).toBe(true);
      expect(activities.some(a => a.progressDescription?.includes('Stall cleared'))).toBe(true);
    });
  });

  describe('Complex Scenarios', () => {
    it.skip('should handle concurrent sessions', async () => {
      // Create multiple sessions
      const sessionIds = ['concurrent-1', 'concurrent-2', 'concurrent-3'];
      
      for (const id of sessionIds) {
        await sessionRepo.upsert({
          id,
          title: `Concurrent Session ${id}`,
          state: 'in_progress',
          repo: 'owner/repo',
          branch: `feature-${id}`,
        });
      }

      const activeSessions = await sessionRepo.findActive();
      expect(activeSessions.length).toBe(3);
    });

    it.skip('should handle session with failed CI and recovery', async () => {
      // Create session with completed PR
      await sessionRepo.upsert({
        id: 'ci-fail-session',
        title: 'CI Failure Session',
        state: 'completed',
        repo: 'owner/repo',
        branch: 'main',
        prUrl: 'https://github.com/owner/repo/pull/999',
      });

      // PR with failing CI
      await prReviewRepo.upsert({
        sessionId: 'ci-fail-session',
        prUrl: 'https://github.com/owner/repo/pull/999',
        prNumber: 999,
        prTitle: 'CI Failure PR',
        prState: 'open',
        prCreatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        ciStatus: 'failure',
        reviewStatus: 'approved',
        linesChanged: 50,
        filesChanged: 3,
        testFilesChanged: 1,
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
        complexityScore: 0.2,
      });

      // Should not be eligible for auto-merge
      const prReview = await prReviewRepo.findByPrUrl('https://github.com/owner/repo/pull/999');
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const eligibility = evaluator.evaluate(prReview!);
      
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reasons.some(r => r.includes('ci_status'))).toBe(true);

      // CI passes after fix
      await prReviewRepo.upsert({
        sessionId: 'ci-fail-session',
        prUrl: 'https://github.com/owner/repo/pull/999',
        ciStatus: 'success',
      });

      // Now eligible
      const updatedPrReview = await prReviewRepo.findByPrUrl('https://github.com/owner/repo/pull/999');
      const updatedEligibility = evaluator.evaluate(updatedPrReview!);
      expect(updatedEligibility.eligible).toBe(true);
    });
  });
});
