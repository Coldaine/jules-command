/**
 * Error handling tests.
 * Verifies user-friendly error messages, error isolation, and edge cases.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../setup.js';
import { validateAndCallTool } from '../../src/mcp/server.js';
import type { Config } from '../../src/config.js';

// ─── Service Mocks ───────────────────────────────────────────────────────────

const mockJulesService = {
  createSession: vi.fn(),
  getSession: vi.fn(),
  listSessions: vi.fn(),
  getActivities: vi.fn(),
  approvePlan: vi.fn(),
  sendMessage: vi.fn(),
  getDiff: vi.fn(),
  getBashOutputs: vi.fn(),
};

vi.mock('../../src/services/jules.service.js', () => ({
  JulesService: class {
    constructor() { return mockJulesService; }
  },
}));

const mockGitHubService = {
  syncAllRepos: vi.fn(),
  syncRepoMetadata: vi.fn(),
  syncPrStatus: vi.fn(),
  mergePr: vi.fn(),
};

vi.mock('../../src/services/github.service.js', () => ({
  GitHubService: class {
    constructor() { return mockGitHubService; }
  },
}));

vi.mock('../../src/services/dashboard.js', () => ({
  DashboardService: class {
    constructor() {
      return { generate: vi.fn().mockResolvedValue('# Dashboard'), generateCompact: vi.fn() };
    }
  },
}));

vi.mock('../../src/services/poll-manager.js', () => ({
  PollManager: class {
    constructor() {
      return { pollSession: vi.fn(), pollAllActive: vi.fn().mockResolvedValue({ stallsDetected: [] }) };
    }
  },
}));

// ─── Config ──────────────────────────────────────────────────────────────────

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

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Error Handling', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    vi.clearAllMocks();
    const testDb = createTestDb();
    db = testDb.db;
  });

  describe('Unknown Tool Errors', () => {
    it('returns user-friendly error for unknown tool', async () => {
      const result = await validateAndCallTool('does_not_exist', {}, { config: defaultConfig, db });
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Unknown tool: does_not_exist');
    });

    it('returns user-friendly error for empty tool name', async () => {
      const result = await validateAndCallTool('', {}, { config: defaultConfig, db });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });

    it('returns user-friendly error for tool name with typo', async () => {
      const result = await validateAndCallTool('jules_creat_session', {}, { config: defaultConfig, db });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });
  });

  describe('Validation Errors', () => {
    it('reports field name in validation error', async () => {
      const result = await validateAndCallTool(
        'jules_create_session',
        { prompt: '' },
        { config: defaultConfig, db },
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain('prompt');
    });

    it('reports invalid enum value', async () => {
      const result = await validateAndCallTool(
        'jules_sessions_list',
        { state: 'nonexistent_state' },
        { config: defaultConfig, db },
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain('state');
    });

    it('reports invalid type for numeric field', async () => {
      const result = await validateAndCallTool(
        'jules_sessions_list',
        { limit: 'not-a-number' },
        { config: defaultConfig, db },
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain('limit');
    });

    it('reports invalid URL format', async () => {
      const result = await validateAndCallTool(
        'pr_check_auto_merge',
        { prUrl: 'not-a-valid-url' },
        { config: defaultConfig, db },
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain('prUrl');
    });

    it('safely handles missing required fields', async () => {
      const result = await validateAndCallTool(
        'jules_create_session',
        {},
        { config: defaultConfig, db },
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid input');
    });
  });

  describe('Handler Errors', () => {
    it('does not leak internal error messages', async () => {
      mockJulesService.createSession.mockRejectedValue(
        new Error('GOOGLE_API_KEY_INVALID: 403 Forbidden'),
      );

      const result = await validateAndCallTool(
        'jules_create_session',
        { prompt: 'Test' },
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(false);
      expect(result.error).not.toContain('GOOGLE_API_KEY_INVALID');
      expect(result.error).not.toContain('403');
      expect(result.error).toBe('Tool jules_create_session failed');
    });

    it('does not leak stack traces', async () => {
      mockJulesService.getDiff.mockRejectedValue(new Error('stack trace here'));

      const result = await validateAndCallTool(
        'jules_get_diff',
        { sessionId: 's1' },
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(false);
      expect(result.error).not.toContain('stack trace');
      expect(result.error).not.toContain('at ');
    });

    it('handles non-Error thrown values', async () => {
      mockJulesService.approvePlan.mockRejectedValue('string error');

      const result = await validateAndCallTool(
        'jules_approve_plan',
        { sessionId: 's1' },
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Tool jules_approve_plan failed');
    });

    it('handles undefined rejection', async () => {
      mockJulesService.sendMessage.mockRejectedValue(undefined);

      const result = await validateAndCallTool(
        'jules_send_message',
        { sessionId: 's1', message: 'Hi' },
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Tool jules_send_message failed');
    });
  });

  describe('Edge Cases', () => {
    it('handles null args gracefully', async () => {
      const result = await validateAndCallTool(
        'jules_status',
        null,
        { config: defaultConfig, db },
      );
      // jules_status accepts empty object, null should fallback to {}
      expect(result.ok).toBe(true);
    });

    it('handles undefined args gracefully', async () => {
      const result = await validateAndCallTool(
        'jules_status',
        undefined,
        { config: defaultConfig, db },
      );
      expect(result.ok).toBe(true);
    });

    it('handles handler returning null', async () => {
      mockJulesService.getSession.mockResolvedValue(null);

      const result = await validateAndCallTool(
        'jules_session_get',
        { sessionId: 'nonexistent' },
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
      expect(result.result).toBeNull();
    });

    it('handles handler returning empty array', async () => {
      mockJulesService.getBashOutputs.mockResolvedValue([]);

      const result = await validateAndCallTool(
        'jules_get_bash_outputs',
        { sessionId: 's1' },
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
      expect(result.result).toEqual([]);
    });

    it('pr_review_status requires prUrl for sync', async () => {
      const result = await validateAndCallTool(
        'pr_review_status',
        {},
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
      expect((result.result as any).error).toContain('prUrl is required');
    });
  });
});
