/**
 * Command execution pipeline tests.
 * Verifies tool dispatching, result handling, error wrapping, and context wiring.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../setup.js';
import { validateAndCallTool } from '../../src/mcp/server.js';
import { TOOL_DEFINITIONS, getToolDefinition } from '../../src/mcp/tools/index.js';
import { repos } from '../../src/db/schema.js';
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

const mockDashboardService = {
  generate: vi.fn(),
  generateCompact: vi.fn(),
};

vi.mock('../../src/services/dashboard.js', () => ({
  DashboardService: class {
    constructor() { return mockDashboardService; }
  },
}));

const mockPollManager = {
  pollSession: vi.fn(),
  pollAllActive: vi.fn(),
};

vi.mock('../../src/services/poll-manager.js', () => ({
  PollManager: class {
    constructor() { return mockPollManager; }
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

describe('Command Execution Pipeline', () => {
  let db: ReturnType<typeof createTestDb>['db'];

  beforeEach(() => {
    vi.clearAllMocks();
    const testDb = createTestDb();
    db = testDb.db;
  });

  describe('Tool Dispatching', () => {
    it('returns error for unknown tool name', async () => {
      const result = await validateAndCallTool('nonexistent_tool', {}, { config: defaultConfig, db });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Unknown tool');
    });

    it('dispatches to correct handler — jules_create_session', async () => {
      mockJulesService.createSession.mockResolvedValue({ sessionId: 'new-1' });

      const result = await validateAndCallTool(
        'jules_create_session',
        { prompt: 'Test task' },
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
      expect(mockJulesService.createSession).toHaveBeenCalledTimes(1);
    });

    it('dispatches to correct handler — jules_approve_plan', async () => {
      mockJulesService.approvePlan.mockResolvedValue(undefined);

      const result = await validateAndCallTool(
        'jules_approve_plan',
        { sessionId: 's-1' },
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
      expect(mockJulesService.approvePlan).toHaveBeenCalledWith('s-1');
    });

    it('dispatches to correct handler — jules_get_diff', async () => {
      mockJulesService.getDiff.mockResolvedValue('diff content');

      const result = await validateAndCallTool(
        'jules_get_diff',
        { sessionId: 's-1' },
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
      expect(result.result).toBe('diff content');
    });

    it('dispatches to correct handler — jules_get_bash_outputs', async () => {
      mockJulesService.getBashOutputs.mockResolvedValue([]);

      const result = await validateAndCallTool(
        'jules_get_bash_outputs',
        { sessionId: 's-1' },
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
      expect(result.result).toEqual([]);
    });

    it('dispatches to correct handler — jules_dashboard', async () => {
      mockDashboardService.generate.mockResolvedValue('# Dashboard');

      const result = await validateAndCallTool(
        'jules_dashboard',
        {},
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
    });

    it('dispatches to correct handler — jules_status', async () => {
      mockDashboardService.generate.mockResolvedValue('# Status');

      const result = await validateAndCallTool(
        'jules_status',
        {},
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
    });

    it('dispatches to correct handler — jules_poll with session IDs', async () => {
      mockPollManager.pollSession.mockResolvedValue({ updated: true });

      const result = await validateAndCallTool(
        'jules_poll',
        { sessionIds: ['s1', 's2'] },
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
      expect(mockPollManager.pollSession).toHaveBeenCalledTimes(2);
    });

    it('dispatches to correct handler — jules_poll without session IDs', async () => {
      mockPollManager.pollAllActive.mockResolvedValue({ stallsDetected: [] });

      const result = await validateAndCallTool(
        'jules_poll',
        {},
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
      expect(mockPollManager.pollAllActive).toHaveBeenCalledTimes(1);
    });

    it('dispatches to correct handler — jules_detect_stalls', async () => {
      mockPollManager.pollAllActive.mockResolvedValue({ stallsDetected: [] });

      const result = await validateAndCallTool(
        'jules_detect_stalls',
        {},
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
      expect((result.result as any).count).toBe(0);
    });

    it('dispatches to correct handler — jules_repo_sync with all', async () => {
      mockGitHubService.syncAllRepos.mockResolvedValue(undefined);

      const result = await validateAndCallTool(
        'jules_repo_sync',
        { all: true },
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
      expect(mockGitHubService.syncAllRepos).toHaveBeenCalledTimes(1);
    });

    it('dispatches to correct handler — jules_repo_sync with repos list', async () => {
      mockGitHubService.syncRepoMetadata.mockResolvedValue(undefined);

      const result = await validateAndCallTool(
        'jules_repo_sync',
        { repos: ['owner/repo'] },
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
      expect(mockGitHubService.syncRepoMetadata).toHaveBeenCalledWith('owner', 'repo');
    });

    it('dispatches to correct handler — jules_health', async () => {
      const result = await validateAndCallTool(
        'jules_health',
        {},
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
      expect((result.result as any).database).toBe('ok');
    });

    it('dispatches to correct handler — repos_list', async () => {
      const result = await validateAndCallTool(
        'repos_list',
        {},
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.result)).toBe(true);
    });

    it('dispatches to correct handler — jules_sessions_list', async () => {
      const result = await validateAndCallTool(
        'jules_sessions_list',
        {},
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.result)).toBe(true);
    });

    it('dispatches to correct handler — pr_reviews_list', async () => {
      const result = await validateAndCallTool(
        'pr_reviews_list',
        {},
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.result)).toBe(true);
    });
  });

  describe('Input Validation', () => {
    it('rejects invalid input and returns field-level error', async () => {
      const result = await validateAndCallTool(
        'jules_create_session',
        { prompt: '' },
        { config: defaultConfig, db },
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid input');
      expect(result.error).toContain('prompt');
    });

    it('reports multiple invalid fields', async () => {
      const result = await validateAndCallTool(
        'jules_send_message',
        { sessionId: '', message: '' },
        { config: defaultConfig, db },
      );
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid input');
    });

    it('applies defaults when args is null/undefined', async () => {
      mockDashboardService.generate.mockResolvedValue('# Dashboard');

      const result = await validateAndCallTool(
        'jules_dashboard',
        null,
        { config: defaultConfig, db },
      );
      expect(result.ok).toBe(true);
    });

    it('applies defaults when args is empty object', async () => {
      mockDashboardService.generate.mockResolvedValue('# Dashboard');

      const result = await validateAndCallTool(
        'jules_dashboard',
        {},
        { config: defaultConfig, db },
      );
      expect(result.ok).toBe(true);
    });
  });

  describe('Result Handling', () => {
    it('wraps successful result in ok: true', async () => {
      mockJulesService.createSession.mockResolvedValue({ sessionId: 'x' });

      const result = await validateAndCallTool(
        'jules_create_session',
        { prompt: 'Test' },
        { config: defaultConfig, db },
      );

      expect(result).toEqual({ ok: true, result: { sessionId: 'x' } });
    });

    it('wraps handler error in ok: false without leaking internals', async () => {
      mockJulesService.createSession.mockRejectedValue(new Error('Internal SDK failure'));

      const result = await validateAndCallTool(
        'jules_create_session',
        { prompt: 'Test' },
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Tool jules_create_session failed');
      // Must not leak internal error details
      expect(result.error).not.toContain('Internal SDK failure');
    });

    it('returns result for tools that return arrays', async () => {
      await db.insert(repos).values({ id: 'test/repo', owner: 'test', name: 'repo', fullName: 'test/repo' });

      const result = await validateAndCallTool(
        'repos_list',
        {},
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
      expect(Array.isArray(result.result)).toBe(true);
      expect((result.result as any[]).length).toBe(1);
    });
  });

  describe('PR Safety Gates', () => {
    it('blocks merge without confirm or force', async () => {
      const result = await validateAndCallTool(
        'pr_merge',
        { prUrl: 'https://github.com/o/r/pull/1' },
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
      expect((result.result as any).isError).toBe(true);
      expect((result.result as any).content[0].text).toContain('Merge requires confirmation');
    });

    it('allows merge with force=true even without PR record', async () => {
      mockGitHubService.mergePr.mockResolvedValue(undefined);

      const result = await validateAndCallTool(
        'pr_merge',
        { prUrl: 'https://github.com/o/r/pull/1', force: true },
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
      expect((result.result as any).merged).toBe(true);
    });

    it('returns not found when confirm without PR record', async () => {
      const result = await validateAndCallTool(
        'pr_merge',
        { prUrl: 'https://github.com/o/r/pull/1', confirm: true },
        { config: defaultConfig, db },
      );

      expect(result.ok).toBe(true);
      expect((result.result as any).merged).toBe(false);
      expect((result.result as any).reason).toContain('not found');
    });
  });
});

// ─── Tool Definition Registry ────────────────────────────────────────────────

describe('Tool Definition Registry', () => {
  it('getToolDefinition returns correct tool', () => {
    const tool = getToolDefinition('jules_create_session');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('jules_create_session');
  });

  it('getToolDefinition returns undefined for unknown tool', () => {
    const tool = getToolDefinition('nonexistent');
    expect(tool).toBeUndefined();
  });

  it('every tool has a handler function', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(typeof tool.handler).toBe('function');
    }
  });

  it('every tool has a zodSchema', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.zodSchema).toBeDefined();
      expect(typeof tool.zodSchema.parse).toBe('function');
    }
  });

  it('every tool has a non-empty description', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect(tool.description.length).toBeGreaterThan(0);
    }
  });

  it('every tool has inputSchema with type object', () => {
    for (const tool of TOOL_DEFINITIONS) {
      expect((tool.inputSchema as any).type).toBe('object');
      expect((tool.inputSchema as any).properties).toBeDefined();
    }
  });

  it('tool names are unique', () => {
    const names = TOOL_DEFINITIONS.map((t) => t.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('destructive tools are marked', () => {
    const prMerge = getToolDefinition('pr_merge');
    expect(prMerge?.destructiveHint).toBe(true);
  });

  it('read-only tools are marked', () => {
    const readOnlyTools = TOOL_DEFINITIONS.filter((t) => t.readOnlyHint === true);
    expect(readOnlyTools.length).toBeGreaterThan(0);

    // Verify specific read-only tools
    const expectedReadOnly = ['jules_sessions_list', 'jules_session_get', 'jules_activities_list', 'jules_get_diff', 'jules_get_bash_outputs', 'jules_dashboard', 'jules_status', 'jules_detect_stalls', 'repos_list', 'pr_reviews_list', 'pr_review_status', 'pr_check_auto_merge', 'jules_health'];
    for (const name of expectedReadOnly) {
      const tool = getToolDefinition(name);
      expect(tool?.readOnlyHint, `${name} should be readOnlyHint`).toBe(true);
    }
  });
});
