/**
 * Phase 3 Task 3.1-3.4: Jules Service Tests
 *
 * Tests for the JulesService — DB-only operations use the real in-memory DB,
 * SDK-dependent operations use a vitest mock of @google/jules-sdk.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JulesService } from '../../src/services/jules.service.js';
import { createTestDb } from '../setup.js';
import type { Config } from '../../src/config.js';

// ─── SDK Mock Setup ─────────────────────────────────────────────────────────

const mockSessionClient = {
  id: 'test-session-id',
  info: vi.fn(),
  approve: vi.fn(),
  send: vi.fn(),
  ask: vi.fn(),
  snapshot: vi.fn(),
  history: vi.fn(),
  activities: {},
  stream: vi.fn(),
  select: vi.fn(),
  result: vi.fn(),
  waitFor: vi.fn(),
  updates: vi.fn(),
};

const mockClient = {
  session: vi.fn(() => mockSessionClient),
  sessions: vi.fn(),
  run: vi.fn(),
  sources: Object.assign(vi.fn(), { get: vi.fn() }),
  with: vi.fn(),
  connect: vi.fn(),
  all: vi.fn(),
  storage: {},
  select: vi.fn(),
  sync: vi.fn(),
};

vi.mock('@google/jules-sdk', () => ({
  connect: vi.fn(() => mockClient),
}));

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('JulesService', () => {
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
  let sqlite: ReturnType<typeof createTestDb>['sqlite'];
  let service: JulesService;

  beforeEach(() => {
    vi.clearAllMocks();

    const testDb = createTestDb();
    db = testDb.db;
    sqlite = testDb.sqlite;
    service = new JulesService(defaultConfig, db);

    // Default: session() returns mockSessionClient (sync, like rehydrating)
    mockClient.session.mockReturnValue(mockSessionClient);

    // Default: info() returns a valid SessionResource
    mockSessionClient.info.mockResolvedValue({
      id: 'test-session-id',
      name: 'sessions/test-session-id',
      state: 'inProgress',
      title: 'Test Session',
      prompt: 'test prompt',
      url: 'https://jules.google.com/session/test-session-id',
      createTime: '2024-01-01T00:00:00Z',
      updateTime: '2024-01-01T01:00:00Z',
    });

    // Default: approve / send / ask
    mockSessionClient.approve.mockResolvedValue(undefined);
    mockSessionClient.send.mockResolvedValue(undefined);
    mockSessionClient.ask.mockResolvedValue({
      id: 'reply-1',
      type: 'agentMessaged',
      message: 'Sure, proceeding.',
      name: 'sessions/test-session-id/activities/reply-1',
      createTime: '2024-01-01T00:00:00Z',
      originator: 'agent',
      artifacts: [],
    });

    // Default: snapshot with a diff containing src/handler.ts
    mockSessionClient.snapshot.mockResolvedValue({
      changeSet: () => ({
        source: 'sources/github/owner/repo',
        gitPatch: {
          unidiffPatch:
            'diff --git a/src/handler.ts b/src/handler.ts\n' +
            '--- a/src/handler.ts\n' +
            '+++ b/src/handler.ts\n' +
            '@@ -1,3 +1,4 @@\n' +
            '+// new line\n',
          baseCommitId: 'abc123',
          suggestedCommitMessage: 'Fix handler',
        },
      }),
    });
  });

  // ─── Task 3.1: List Sessions (DB-only) ──────────────────────────────

  describe('Task 3.1: List Sessions', () => {
    it('should list sessions from database', async () => {
      const sessions = await service.listSessions();
      expect(Array.isArray(sessions)).toBe(true);
    });

    it('should filter sessions by state', async () => {
      const sessions = await service.listSessions({ state: 'in_progress' });
      expect(sessions.every(s => s.state === 'in_progress')).toBe(true);
    });

    it('should filter sessions by repo', async () => {
      const sessions = await service.listSessions({ repo: 'owner/repo' });
      expect(sessions.every(s => s.repoId === 'owner/repo')).toBe(true);
    });

    it('should limit number of results', async () => {
      const sessions = await service.listSessions({ limit: 5 });
      expect(sessions.length).toBeLessThanOrEqual(5);
    });
  });

  // ─── Task 3.2: Get Session + Activities ─────────────────────────────

  describe('Task 3.2: Get Session + Activities', () => {
    it('should fetch and cache session details', async () => {
      const session = await service.getSession('test-session-id');

      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('state');
      expect(session).toHaveProperty('title');
    });

    it('should fetch activities for a session', async () => {
      const activities = await service.getActivities('test-session-id');
      expect(Array.isArray(activities)).toBe(true);
    });

    it('should filter activities by type', async () => {
      const activities = await service.getActivities('test-session-id', {
        type: 'bash_output',
      });
      expect(activities.every(a => a.activityType === 'bash_output')).toBe(true);
    });

    it('should limit activity results', async () => {
      const activities = await service.getActivities('test-session-id', {
        limit: 10,
      });
      expect(activities.length).toBeLessThanOrEqual(10);
    });

    it('should fetch activities since cursor', async () => {
      const activities = await service.getActivities('test-session-id', {
        since: '2024-01-01T00:00:00Z',
      });
      expect(
        activities.every(a => a.timestamp >= '2024-01-01T00:00:00Z'),
      ).toBe(true);
    });
  });

  // ─── Task 3.3: Create Session ───────────────────────────────────────

  describe('Task 3.3: Create Session', () => {
    it('should create session with prompt only', async () => {
      const result = await service.createSession({
        prompt: 'Fix the bug in handler.ts',
      });

      expect(result).toHaveProperty('sessionId');
      expect(result).toHaveProperty('url');
    });

    it('should create session with repo and branch', async () => {
      const result = await service.createSession({
        prompt: 'Add new feature',
        repo: 'owner/repo',
        branch: 'feature-branch',
      });
      expect(result.sessionId).toBeTruthy();
    });

    it('should create session with auto PR enabled', async () => {
      const result = await service.createSession({
        prompt: 'Update dependencies',
        autoPr: true,
      });
      expect(result.sessionId).toBeTruthy();
    });

    it('should create session requiring approval', async () => {
      const result = await service.createSession({
        prompt: 'Refactor codebase',
        requireApproval: true,
      });
      expect(result.sessionId).toBeTruthy();
    });

    it('should include custom title in session', async () => {
      const result = await service.createSession({
        prompt: 'Fix issue',
        title: 'Custom Title for Session',
      });
      expect(result.sessionId).toBeTruthy();
    });

    it('should persist session to database', async () => {
      const result = await service.createSession({
        prompt: 'Test prompt',
      });

      const session = await service.getSession(result.sessionId);
      expect(session).toBeTruthy();
      expect(session.id).toBe(result.sessionId);
    });
  });

  // ─── Task 3.4: Approve Plan / Send Message ─────────────────────────

  describe('Task 3.4: Approve Plan / Send Message', () => {
    it('should approve plan for a session', async () => {
      await expect(
        service.approvePlan('test-session-id'),
      ).resolves.toBeUndefined();
    });

    it('should update session state after approval', async () => {
      await service.approvePlan('test-session-id');

      const session = await service.getSession('test-session-id');
      expect(session.state).not.toBe('awaiting_plan_approval');
    });

    it('should send message to session', async () => {
      await expect(
        service.sendMessage(
          'test-session-id',
          'Please fix the linting errors',
        ),
      ).resolves.toBeUndefined();
    });

    it('should record message as activity', async () => {
      await service.sendMessage('test-session-id', 'Test message');

      const activities = await service.getActivities('test-session-id');
      expect(
        activities.some(
          a =>
            a.activityType === 'message' &&
            a.content?.includes('Test message'),
        ),
      ).toBe(true);
    });

    it('should ask question and wait for response', async () => {
      await expect(
        service.askAndWait('test-session-id', 'Should I proceed?'),
      ).resolves.toBeUndefined();
    });
  });

  // ─── Session Snapshots ──────────────────────────────────────────────

  describe('Session Snapshots', () => {
    it('should get diff for session', async () => {
      const diff = await service.getDiff('test-session-id');
      expect(typeof diff).toBe('string');
    });

    it('should get diff for specific file', async () => {
      const diff = await service.getDiff('test-session-id', 'src/handler.ts');
      expect(diff).toContain('src/handler.ts');
    });

    it('should get bash outputs from session', async () => {
      const outputs = await service.getBashOutputs('test-session-id');

      expect(Array.isArray(outputs)).toBe(true);
      expect(outputs.every(o => o.activityType === 'bash_output')).toBe(true);
    });

    it('should get session snapshot with aggregated data', async () => {
      const snapshot = await service.getSessionSnapshot('test-session-id');

      expect(snapshot).toHaveProperty('session');
      expect(snapshot).toHaveProperty('activities');
      expect(snapshot).toHaveProperty('currentDiff');
    });
  });

  // ─── Error Handling ─────────────────────────────────────────────────

  describe('Error Handling', () => {
    it('should throw on invalid session ID', async () => {
      mockSessionClient.info.mockRejectedValue(
        new Error('Session not found'),
      );
      await expect(service.getSession('invalid-id')).rejects.toThrow();
    });

    it('should throw on API errors', async () => {
      mockSessionClient.info.mockRejectedValue(
        new Error('Internal server error'),
      );
      await expect(
        service.createSession({ prompt: 'test' }),
      ).rejects.toThrow();
    });

    it('should handle network timeouts', async () => {
      mockSessionClient.info.mockRejectedValue(
        new Error('Request timeout'),
      );
      await expect(service.getSession('timeout-test')).rejects.toThrow(
        /timeout/i,
      );
    });
  });
});
