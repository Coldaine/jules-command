/**
 * Phase 7 Task 7.2-7.3: MCP Tools Integration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTestDb } from '../setup.js';
import { SessionRepository } from '../../src/db/repositories/session.repo.js';
import { PrReviewRepository } from '../../src/db/repositories/pr-review.repo.js';
import { validateAndCallTool } from '../../src/mcp/server.js';
import { julesActivities, repos } from '../../src/db/schema.js';
import type { Config } from '../../src/config.js';

// ─── Service Mock Setup ───────────────────────────────────────────────────

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
    constructor() {
      return mockJulesService;
    }
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
    constructor() {
      return mockGitHubService;
    }
  },
}));

const mockDashboardService = {
  generate: vi.fn(),
  generateCompact: vi.fn(),
};

vi.mock('../../src/services/dashboard.js', () => ({
  DashboardService: class {
    constructor() {
      return mockDashboardService;
    }
  },
}));

const mockPollManager = {
  pollSession: vi.fn(),
  pollAllActive: vi.fn(),
};

vi.mock('../../src/services/poll-manager.js', () => ({
  PollManager: class {
    constructor() {
      return mockPollManager;
    }
  },
}));

describe('MCP Tools Integration', () => {
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
  let sessionRepo: SessionRepository;
  let prReviewRepo: PrReviewRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    
    const testDb = createTestDb();
    db = testDb.db;
    sqlite = testDb.sqlite;
    sessionRepo = new SessionRepository(db);
    prReviewRepo = new PrReviewRepository(db);
  });

  async function setupTestSession(sessionId: string = 'session-1') {
    const now = new Date().toISOString();
    await db.insert(repos).values({
      id: 'owner/repo',
      owner: 'owner',
      name: 'repo',
      fullName: 'owner/repo',
    });
    await sessionRepo.upsert({
      id: sessionId,
      title: 'Test Session',
      prompt: 'Test prompt',
      state: 'in_progress',
      repoId: 'owner/repo',
      sourceBranch: 'main',
      createdAt: now,
      updatedAt: now,
    });
  }

  describe('Task 7.2: Jules Tools', () => {
    describe('jules_create_session', () => {
      it('should create session via JulesService', async () => {
        mockJulesService.createSession.mockResolvedValue({
          sessionId: 'new-session-123',
          url: 'https://jules.ai/session/new-session-123',
        });
        
        const result = await validateAndCallTool(
          'jules_create_session',
          { prompt: 'Test task' },
          { config: defaultConfig, db }
        );
        
        expect(result.ok).toBe(true);
        expect(mockJulesService.createSession).toHaveBeenCalledWith({
          prompt: 'Test task',
          autoPr: true,
          requireApproval: false,
        });
        expect((result.result as any).sessionId).toBe('new-session-123');
      });
    });

    describe('jules_sessions_list', () => {
      it('should list sessions from database', async () => {
        await setupTestSession();

        const result = await validateAndCallTool(
          'jules_sessions_list',
          {},
          { config: defaultConfig, db }
        );
        
        expect(result.ok).toBe(true);
        expect(Array.isArray(result.result)).toBe(true);
        expect((result.result as any[]).length).toBe(1);
      });
    });

    describe('jules_session_get', () => {
      it('should fetch and return session details', async () => {
        const now = new Date().toISOString();
        mockJulesService.getSession.mockResolvedValue({
          id: 'session-1',
          title: 'Test Session',
          prompt: 'Test prompt',
          state: 'in_progress',
          repoId: 'owner/repo',
          sourceBranch: 'main',
          createdAt: now,
          updatedAt: now,
        });
        
        const result = await validateAndCallTool(
          'jules_session_get',
          { sessionId: 'session-1' },
          { config: defaultConfig, db }
        );
        
        expect(result.ok).toBe(true);
        expect(mockJulesService.getSession).toHaveBeenCalledWith('session-1');
        expect((result.result as any).id).toBe('session-1');
      });
    });

    describe('jules_activities_list', () => {
      it('should return activities for session', async () => {
        await setupTestSession();
        const now = new Date().toISOString();

        await db.insert(julesActivities).values({
          id: 'act-1',
          sessionId: 'session-1',
          activityType: 'message',
          timestamp: now,
          content: 'Test activity',
        });

        const result = await validateAndCallTool(
          'jules_activities_list',
          { sessionId: 'session-1' },
          { config: defaultConfig, db }
        );
        
        expect(result.ok).toBe(true);
        expect((result.result as any[])).toHaveLength(1);
        expect((result.result as any[])[0].activityType).toBe('message');
      });
    });

    describe('jules_approve_plan', () => {
      it('should call JulesService.approvePlan', async () => {
        mockJulesService.approvePlan.mockResolvedValue(undefined);
        
        const result = await validateAndCallTool(
          'jules_approve_plan',
          { sessionId: 'session-1' },
          { config: defaultConfig, db }
        );
        
        expect(result.ok).toBe(true);
        expect(mockJulesService.approvePlan).toHaveBeenCalledWith('session-1');
        expect((result.result as any).success).toBe(true);
      });
    });

    describe('jules_send_message', () => {
      it('should call JulesService.sendMessage', async () => {
        mockJulesService.sendMessage.mockResolvedValue(undefined);
        
        const result = await validateAndCallTool(
          'jules_send_message',
          { sessionId: 'session-1', message: 'Test message' },
          { config: defaultConfig, db }
        );
        
        expect(result.ok).toBe(true);
        expect(mockJulesService.sendMessage).toHaveBeenCalledWith('session-1', 'Test message');
      });
    });

    describe('jules_get_diff', () => {
      it('should fetch diff from JulesService', async () => {
        const mockDiff = 'diff --git a/file.ts b/file.ts\n+added line';
        mockJulesService.getDiff.mockResolvedValue(mockDiff);
        
        const result = await validateAndCallTool(
          'jules_get_diff',
          { sessionId: 'session-1' },
          { config: defaultConfig, db }
        );
        
        expect(result.ok).toBe(true);
        expect(mockJulesService.getDiff).toHaveBeenCalledWith('session-1', undefined);
        expect(result.result).toBe(mockDiff);
      });
    });

    describe('jules_get_bash_outputs', () => {
      it('should fetch bash outputs from JulesService', async () => {
        const mockOutputs = [
          { id: 'act-1', sessionId: 'session-1', activityType: 'bash_output', timestamp: new Date().toISOString(), content: '$ npm test' },
        ];
        mockJulesService.getBashOutputs.mockResolvedValue(mockOutputs);
        
        const result = await validateAndCallTool(
          'jules_get_bash_outputs',
          { sessionId: 'session-1' },
          { config: defaultConfig, db }
        );
        
        expect(result.ok).toBe(true);
        expect(mockJulesService.getBashOutputs).toHaveBeenCalledWith('session-1');
        expect(result.result).toEqual(mockOutputs);
      });
    });
  });

  describe('Task 7.3: Dashboard & Orchestration Tools', () => {
    describe('jules_dashboard', () => {
      it('should call DashboardService.generate', async () => {
        mockDashboardService.generate.mockResolvedValue('# Mock Dashboard');

        const result = await validateAndCallTool(
          'jules_dashboard',
          { includeCompleted: true },
          { config: defaultConfig, db }
        );
        
        expect(result.ok).toBe(true);
        expect(mockDashboardService.generate).toHaveBeenCalledWith({
          includeCompleted: true,
          hours: 24,
        });
        expect((result.result as any).content[0].text).toBe('# Mock Dashboard');
      });
    });

    describe('jules_status', () => {
      it('should return compact status', async () => {
        mockDashboardService.generate.mockResolvedValue('Compact Status');

        const result = await validateAndCallTool(
          'jules_status',
          {},
          { config: defaultConfig, db }
        );
        
        expect(result.ok).toBe(true);
        expect(mockDashboardService.generate).toHaveBeenCalledWith({ hours: 1 });
        expect((result.result as any).content[0].text).toBe('Compact Status');
      });
    });

    describe('jules_poll', () => {
      it('should call PollManager.pollAllActive', async () => {
        mockPollManager.pollAllActive.mockResolvedValue({
          sessionsPolled: 2,
          sessionsUpdated: 1,
          stallsDetected: [],
          prsUpdated: 0,
          errors: [],
        });

        const result = await validateAndCallTool(
          'jules_poll',
          {},
          { config: defaultConfig, db }
        );
        
        expect(result.ok).toBe(true);
        expect(mockPollManager.pollAllActive).toHaveBeenCalled();
        expect((result.result as any).sessionsPolled).toBe(2);
      });
    });

    describe('jules_detect_stalls', () => {
      it('should detect stalled sessions', async () => {
        mockPollManager.pollAllActive.mockResolvedValue({
          sessionsPolled: 1,
          sessionsUpdated: 0,
          stallsDetected: [{ sessionId: 's1', reason: 'long-wait' }],
          prsUpdated: 0,
          errors: [],
        });

        const result = await validateAndCallTool(
          'jules_detect_stalls',
          {},
          { config: defaultConfig, db }
        );
        
        expect(result.ok).toBe(true);
        expect(mockPollManager.pollAllActive).toHaveBeenCalled();
        expect((result.result as any).stalls).toHaveLength(1);
      });
    });
  });

  describe('Task 7.3: PR Management Tools', () => {
    describe('pr_review_status', () => {
      it('should return PR review details', async () => {
        mockGitHubService.syncPrStatus.mockResolvedValue(undefined);
        await setupTestSession();

        const now = new Date().toISOString();
        await prReviewRepo.upsert({
          sessionId: 'session-1',
          prUrl: 'https://github.com/owner/repo/pull/123',
          prNumber: 123,
          prTitle: 'Test PR',
          prState: 'open',
          prCreatedAt: now,
          ciStatus: 'success',
          reviewStatus: 'approved',
          linesChanged: 50,
          filesChanged: 3,
          testFilesChanged: 1,
          criticalFilesTouched: false,
          complexityScore: 0.2,
        });

        const result = await validateAndCallTool(
          'pr_review_status',
          { prUrl: 'https://github.com/owner/repo/pull/123' },
          { config: defaultConfig, db }
        );
        
        expect(result.ok).toBe(true);
        expect(mockGitHubService.syncPrStatus).toHaveBeenCalled();
        expect((result.result as any).prNumber).toBe(123);
      });
    });

    describe('pr_update_review', () => {
      it('should update PR review status', async () => {
        await setupTestSession();
        const prUrl = 'https://github.com/owner/repo/pull/123';
        
        await prReviewRepo.upsert({
          sessionId: 'session-1',
          prUrl,
          prNumber: 123,
          reviewStatus: 'pending',
        });
        
        const result = await validateAndCallTool(
          'pr_update_review',
          { prUrl, status: 'approved', notes: 'Looks good' },
          { config: defaultConfig, db }
        );
        
        expect(result.ok).toBe(true);
        const updated = await prReviewRepo.findByPrUrl(prUrl);
        expect(updated?.reviewStatus).toBe('approved');
        expect(updated?.reviewNotes).toBe('Looks good');
      });
    });

    describe('pr_check_auto_merge', () => {
      it('should evaluate auto-merge eligibility', async () => {
        await setupTestSession();
        const prUrl = 'https://github.com/owner/repo/pull/123';
        
        await prReviewRepo.upsert({
          sessionId: 'session-1',
          prUrl,
          prNumber: 123,
          prTitle: 'Test PR',
          prState: 'open',
          prCreatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          ciStatus: 'success',
          reviewStatus: 'approved',
          linesChanged: 50,
          filesChanged: 3,
          testFilesChanged: 1,
          criticalFilesTouched: false,
          complexityScore: 0.2,
        });

        const result = await validateAndCallTool(
          'pr_check_auto_merge',
          { prUrl },
          { config: defaultConfig, db }
        );
        
        expect(result.ok).toBe(true);
        expect((result.result as any).eligible).toBe(true);
      });
    });

    describe('pr_merge', () => {
      it('should call GitHubService.mergePr', async () => {
        mockGitHubService.mergePr.mockResolvedValue({ success: true, merged: true });
        await setupTestSession();

        const prUrl = 'https://github.com/owner/repo/pull/123';
        await prReviewRepo.upsert({
          sessionId: 'session-1',
          prUrl,
          prNumber: 123,
          prState: 'open',
          prCreatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          ciStatus: 'success',
          reviewStatus: 'approved',
          linesChanged: 50,
          filesChanged: 3,
          testFilesChanged: 1,
          criticalFilesTouched: false,
          complexityScore: 0.2,
        });

        const result = await validateAndCallTool(
          'pr_merge',
          { prUrl, confirm: true },
          { config: defaultConfig, db }
        );
        
        expect(result.ok).toBe(true);
        expect(mockGitHubService.mergePr).toHaveBeenCalled();
      });
    });

    describe('jules_repo_sync', () => {
      it('should call GitHubService.syncRepoMetadata', async () => {
        mockGitHubService.syncRepoMetadata.mockResolvedValue(undefined);

        const result = await validateAndCallTool(
          'jules_repo_sync',
          { repos: ['owner/repo'] },
          { config: defaultConfig, db }
        );
        
        expect(result.ok).toBe(true);
        expect(mockGitHubService.syncRepoMetadata).toHaveBeenCalledWith('owner', 'repo');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing required parameters', async () => {
      const result = await validateAndCallTool(
        'jules_create_session',
        {},
        { config: defaultConfig, db }
      );
      
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Invalid input');
    });

    it('should handle service errors gracefully', async () => {
      mockJulesService.createSession.mockRejectedValue(new Error('API Down'));

      const result = await validateAndCallTool(
        'jules_create_session',
        { prompt: 'Test' },
        { config: defaultConfig, db }
      );

      expect(result.ok).toBe(false);
      // Error message should be generic and not expose internal error details
      expect(result.error).toBe('Tool jules_create_session failed');
    });
  });
});
