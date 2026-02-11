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
    const now = new Date().toISOString();
    return {
      id: 'session-1',
      title: 'Test Session',
      prompt: 'Do a thing',
      repoId: null,
      sourceBranch: null,
      state: 'in_progress',
      automationMode: null,
      requirePlanApproval: null,
      planJson: null,
      planApprovedAt: null,
      julesUrl: null,
      prUrl: null,
      prTitle: null,
      errorReason: null,
      stallDetectedAt: null,
      stallReason: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      lastPolledAt: null,
      ...overrides,
    };
  }

  function createActivity(overrides: Partial<ActivityRow> = {}): ActivityRow {
    return {
      id: 'activity-1',
      sessionId: 'session-1',
      activityType: 'message',
      timestamp: new Date().toISOString(),
      content: 'Running command',
      metadata: null,
      ...overrides,
    };
  }

  it('detects plan approval timeout', () => {
    const detector = new StallDetector(defaultConfig);
    const session = createSession({
      state: 'awaiting_plan_approval',
      updatedAt: new Date(Date.now() - 35 * 60 * 1000).toISOString(),
    });

    const stall = detector.detect(session, []);
    expect(stall?.ruleId).toBe('plan_approval_timeout');
  });

  it('detects no progress based on activity timestamp', () => {
    const detector = new StallDetector(defaultConfig);
    const session = createSession({ state: 'in_progress' });
    const activities: ActivityRow[] = [
      createActivity({ timestamp: new Date(Date.now() - 20 * 60 * 1000).toISOString() }),
    ];

    const stall = detector.detect(session, activities);
    expect(stall?.ruleId).toBe('no_progress');
  });

  it('detects repeated bash errors using activityType/content', () => {
    const detector = new StallDetector(defaultConfig);
    const session = createSession({ state: 'in_progress' });
    const activities: ActivityRow[] = [
      createActivity({ id: 'a1', activityType: 'bash_output', content: 'Exit Code: 1' }),
      createActivity({ id: 'a2', activityType: 'bash_output', content: 'Exit Code: 1' }),
      createActivity({ id: 'a3', activityType: 'bash_output', content: 'Exit Code: 1' }),
    ];

    const stall = detector.detect(session, activities);
    expect(stall?.ruleId).toBe('repeated_errors');
  });
});
