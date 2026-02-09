/**
 * Phase 4 Task 4.1: Stall Detector Tests
 */

import { describe, it, expect } from 'vitest';
import { StallDetector } from '../../src/services/stall-detector.js';
import type { Config } from '../../src/config.js';
import type { SessionRow } from '../../src/db/repositories/session.repo.js';
import type { ActivityRow } from '../../src/db/repositories/activity.repo.js';

describe('StallDetector', () => {
  const defaultConfig: Config = {
    julesApiKey: 'test-key',
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

  function createSession(overrides: Partial<SessionRow> = {}): SessionRow {
    return {
      id: 'session-1',
      title: 'Test Session',
      state: 'in_progress',
      repo: 'owner/repo',
      branch: 'main',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      prUrl: null,
      ...overrides,
    };
  }

  function createActivity(overrides: Partial<ActivityRow> = {}): ActivityRow {
    return {
      id: 'activity-1',
      sessionId: 'session-1',
      activityType: 'bash_output',
      createdAt: new Date().toISOString(),
      progressDescription: 'Running command',
      hasBashOutput: false,
      filesDiff: null,
      rawPayload: null,
      ...overrides,
    };
  }

  describe('plan_approval_timeout', () => {
    it('should detect stall when plan awaits approval beyond threshold', () => {
      const detector = new StallDetector(defaultConfig);
      const session = createSession({
        state: 'awaiting_plan_approval',
        updatedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(), // 35 min ago
      });

      const stall = detector.detect(session, []);

      expect(stall).not.toBeNull();
      expect(stall?.ruleId).toBe('plan_approval_timeout');
      expect(stall?.sessionState).toBe('awaiting_plan_approval');
      expect(stall?.minutesSinceUpdate).toBeGreaterThanOrEqual(35);
      expect(stall?.reason).toContain('Plan awaiting approval');
    });

    it('should not detect stall when plan approval is recent', () => {
      const detector = new StallDetector(defaultConfig);
      const session = createSession({
        state: 'awaiting_plan_approval',
        updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
      });

      const stall = detector.detect(session, []);

      expect(stall).toBeNull();
    });
  });

  describe('feedback_timeout', () => {
    it('should detect stall when waiting for user feedback beyond threshold', () => {
      const detector = new StallDetector(defaultConfig);
      const session = createSession({
        state: 'awaiting_user_feedback',
        updatedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(), // 35 min ago
      });

      const stall = detector.detect(session, []);

      expect(stall).not.toBeNull();
      expect(stall?.ruleId).toBe('feedback_timeout');
      expect(stall?.reason).toContain('Jules asked a question');
    });

    it('should not detect stall when feedback is recent', () => {
      const detector = new StallDetector(defaultConfig);
      const session = createSession({
        state: 'awaiting_user_feedback',
        updatedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 min ago
      });

      const stall = detector.detect(session, []);

      expect(stall).toBeNull();
    });
  });

  describe('no_progress', () => {
    it('should detect stall when in_progress but no recent activities', () => {
      const detector = new StallDetector(defaultConfig);
      const session = createSession({
        state: 'in_progress',
        updatedAt: new Date().toISOString(),
      });
      const activities: ActivityRow[] = [
        createActivity({
          createdAt: new Date(Date.now() - 20 * 60 * 1000).toISOString(), // 20 min ago
        }),
      ];

      const stall = detector.detect(session, activities);

      expect(stall).not.toBeNull();
      expect(stall?.ruleId).toBe('no_progress');
      expect(stall?.reason).toContain('No new activity');
    });

    it('should not detect stall when session has recent activity', () => {
      const detector = new StallDetector(defaultConfig);
      const session = createSession({
        state: 'in_progress',
        updatedAt: new Date().toISOString(),
      });
      const activities: ActivityRow[] = [
        createActivity({
          createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
        }),
      ];

      const stall = detector.detect(session, activities);

      expect(stall).toBeNull();
    });
  });

  describe('queue_timeout', () => {
    it('should detect stall when queued beyond threshold', () => {
      const detector = new StallDetector(defaultConfig);
      const session = createSession({
        state: 'queued',
        createdAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 min ago
        updatedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      });

      const stall = detector.detect(session, []);

      expect(stall).not.toBeNull();
      expect(stall?.ruleId).toBe('queue_timeout');
      expect(stall?.reason).toContain('stuck in queue');
    });

    it('should not detect stall when queue time is within threshold', () => {
      const detector = new StallDetector(defaultConfig);
      const session = createSession({
        state: 'queued',
        createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
        updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      });

      const stall = detector.detect(session, []);

      expect(stall).toBeNull();
    });
  });

  describe('repeated_errors', () => {
    it('should detect stall when consecutive activities have bash errors', () => {
      const detector = new StallDetector(defaultConfig);
      const session = createSession({
        state: 'in_progress',
      });
      const activities: ActivityRow[] = [
        createActivity({
          id: 'act-1',
          hasBashOutput: true,
          progressDescription: 'Exit Code: 1',
          createdAt: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
        }),
        createActivity({
          id: 'act-2',
          hasBashOutput: true,
          progressDescription: 'Exit Code: 1',
          createdAt: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        }),
        createActivity({
          id: 'act-3',
          hasBashOutput: true,
          progressDescription: 'Exit Code: 1',
          createdAt: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
        }),
      ];

      const stall = detector.detect(session, activities);

      expect(stall).not.toBeNull();
      expect(stall?.ruleId).toBe('repeated_errors');
      expect(stall?.reason).toContain('bash errors');
    });

    it('should not detect stall when not all recent activities are errors', () => {
      const detector = new StallDetector(defaultConfig);
      const session = createSession({
        state: 'in_progress',
      });
      const activities: ActivityRow[] = [
        createActivity({
          id: 'act-1',
          hasBashOutput: true,
          progressDescription: 'Exit Code: 1',
        }),
        createActivity({
          id: 'act-2',
          hasBashOutput: true,
          progressDescription: 'Exit Code: 0', // Success
        }),
        createActivity({
          id: 'act-3',
          hasBashOutput: true,
          progressDescription: 'Exit Code: 1',
        }),
      ];

      const stall = detector.detect(session, activities);

      expect(stall).toBeNull();
    });

    it('should not detect stall with fewer errors than threshold', () => {
      const detector = new StallDetector(defaultConfig);
      const session = createSession({
        state: 'in_progress',
      });
      const activities: ActivityRow[] = [
        createActivity({
          id: 'act-1',
          hasBashOutput: true,
          progressDescription: 'Exit Code: 1',
        }),
        createActivity({
          id: 'act-2',
          hasBashOutput: true,
          progressDescription: 'Exit Code: 1',
        }),
      ];

      const stall = detector.detect(session, activities);

      expect(stall).toBeNull();
    });
  });

  describe('custom thresholds', () => {
    it('should respect custom thresholds for plan approval', () => {
      const customConfig: Config = {
        ...defaultConfig,
        stallPlanApprovalTimeoutMin: 60, // Custom: 60 minutes
      };
      const detector = new StallDetector(customConfig);
      const session = createSession({
        state: 'awaiting_plan_approval',
        updatedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 min ago
      });

      // Should not stall with 60 min threshold
      const stall = detector.detect(session, []);
      expect(stall).toBeNull();

      // But would stall at 65 minutes
      const session2 = createSession({
        state: 'awaiting_plan_approval',
        updatedAt: new Date(Date.now() - 65 * 60 * 1000).toISOString(), // 65 min ago
      });
      const stall2 = detector.detect(session2, []);
      expect(stall2).not.toBeNull();
      expect(stall2?.reason).toContain('threshold: 60 min');
    });

    it('should respect custom consecutive errors threshold', () => {
      const customConfig: Config = {
        ...defaultConfig,
        stallConsecutiveErrors: 5, // Custom: 5 errors
      };
      const detector = new StallDetector(customConfig);
      const session = createSession({
        state: 'in_progress',
      });
      const activities: ActivityRow[] = Array.from({ length: 5 }, (_, i) =>
        createActivity({
          id: `act-${i}`,
          hasBashOutput: true,
          progressDescription: 'Exit Code: 1',
        })
      );

      const stall = detector.detect(session, activities);

      expect(stall).not.toBeNull();
      expect(stall?.reason).toContain('Last 5 activities had bash errors');
    });
  });

  describe('stall info structure', () => {
    it('should return complete stall info with all fields', () => {
      const detector = new StallDetector(defaultConfig);
      const session = createSession({
        id: 'test-session-123',
        title: 'Fix bug in handler',
        state: 'awaiting_plan_approval',
        updatedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(), // 40 min ago
      });

      const stall = detector.detect(session, []);

      expect(stall).toMatchObject({
        sessionId: 'test-session-123',
        ruleId: 'plan_approval_timeout',
        sessionState: 'awaiting_plan_approval',
        sessionTitle: 'Fix bug in handler',
        minutesSinceUpdate: expect.any(Number),
        reason: expect.stringContaining('Plan awaiting approval'),
        detectedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), // ISO date
      });
    });
  });

  describe('no false positives', () => {
    it('should not detect stall for completed session', () => {
      const detector = new StallDetector(defaultConfig);
      const session = createSession({
        state: 'completed',
        updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 60 min ago
      });

      const stall = detector.detect(session, []);

      expect(stall).toBeNull();
    });

    it('should not detect stall for failed session', () => {
      const detector = new StallDetector(defaultConfig);
      const session = createSession({
        state: 'failed',
        updatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 60 min ago
      });

      const stall = detector.detect(session, []);

      expect(stall).toBeNull();
    });
  });
});
