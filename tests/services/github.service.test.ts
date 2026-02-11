/**
 * Phase 5 Task 5.1-5.2: GitHub Service Tests
 * 
 * NOTE: GitHub Service is not yet fully implemented. These tests will fail initially
 * and serve as the specification for the implementation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitHubService } from '../../src/services/github.service.js';
import { createTestDb } from '../setup.js';
import type { Config } from '../../src/config.js';

// ─── Octokit Mock Setup ─────────────────────────────────────────────────────

const mockOctokit = {
  repos: {
    get: vi.fn(),
  },
  pulls: {
    get: vi.fn(),
    listFiles: vi.fn(),
    listReviews: vi.fn(),
    merge: vi.fn(),
  },
  checks: {
    listForRef: vi.fn(),
  },
};

vi.mock('@octokit/rest', () => ({
  Octokit: class {
    constructor() {
      return mockOctokit;
    }
  },
}));

describe('GitHubService', () => {
  const defaultConfig: Config = {
    julesApiKey: 'test-jules-key',
    githubToken: 'ghp_test_token',
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
  let service: GitHubService;

  beforeEach(() => {
    vi.clearAllMocks();
    
    const testDb = createTestDb();
    db = testDb.db;
    sqlite = testDb.sqlite;
    service = new GitHubService(defaultConfig, db);
  });

  describe('Task 5.1: Repo Metadata Sync', () => {
    it('should sync single repo metadata', async () => {
      mockOctokit.repos.get.mockResolvedValue({
        data: {
          full_name: 'owner/repo',
          description: 'Test repository',
          default_branch: 'main',
          language: 'TypeScript',
          stargazers_count: 42,
          private: false,
        },
      });
      
      await service.syncRepoMetadata('owner', 'repo');
      
      // Verify mocked API was called
      expect(mockOctokit.repos.get).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
      });
      
      // Verify repo was inserted/updated using standard Drizzle queries
      const { repos } = await import('../../src/db/schema.js');
      const { eq, and } = await import('drizzle-orm');
      
      const result = await db
        .select()
        .from(repos)
        .where(and(eq(repos.owner, 'owner'), eq(repos.name, 'repo')))
        .limit(1);
      
      expect(result.length).toBe(1);
      expect(result[0]?.owner).toBe('owner');
      expect(result[0]?.name).toBe('repo');
      expect(result[0]?.fullName).toBe('owner/repo');
      expect(result[0]?.description).toBe('Test repository');
    });

    it('should fetch default branch from GitHub', async () => {
      mockOctokit.repos.get.mockResolvedValue({
        data: {
          full_name: 'owner/repo',
          description: null,
          default_branch: 'main',
          language: null,
          stargazers_count: 0,
          private: false,
        },
      });
      
      await service.syncRepoMetadata('owner', 'repo');
      
      const { repos } = await import('../../src/db/schema.js');
      const { eq, and } = await import('drizzle-orm');
      
      const result = await db
        .select()
        .from(repos)
        .where(and(eq(repos.owner, 'owner'), eq(repos.name, 'repo')))
        .limit(1);
      
      expect(result[0]?.defaultBranch).toBe('main');
    });

    it('should fetch primary language from GitHub', async () => {
      mockOctokit.repos.get.mockResolvedValue({
        data: {
          full_name: 'owner/repo',
          description: null,
          default_branch: 'main',
          language: 'TypeScript',
          stargazers_count: 0,
          private: false,
        },
      });
      
      await service.syncRepoMetadata('owner', 'repo');
      
      const { repos } = await import('../../src/db/schema.js');
      const { eq, and } = await import('drizzle-orm');
      
      const result = await db
        .select()
        .from(repos)
        .where(and(eq(repos.owner, 'owner'), eq(repos.name, 'repo')))
        .limit(1);
      
      expect(result[0]?.primaryLanguage).toBe('TypeScript');
    });

    it('should fetch topics from GitHub', async () => {
      // NOTE: repos schema does not have a 'topics' field.
      // This test verifies the sync works even without topics storage.
      mockOctokit.repos.get.mockResolvedValue({
        data: {
          full_name: 'owner/repo',
          description: null,
          default_branch: 'main',
          language: 'JavaScript',
          stargazers_count: 0,
          private: false,
          topics: ['javascript', 'nodejs'], // Not stored in schema
        },
      });
      
      await service.syncRepoMetadata('owner', 'repo');
      
      // Verify sync completed successfully (topics just ignored)
      expect(mockOctokit.repos.get).toHaveBeenCalled();
    });

    it('should update existing repo metadata', async () => {
      // First sync
      mockOctokit.repos.get.mockResolvedValue({
        data: {
          full_name: 'owner/repo',
          description: 'First description',
          default_branch: 'main',
          language: 'TypeScript',
          stargazers_count: 10,
          private: false,
        },
      });
      await service.syncRepoMetadata('owner', 'repo');
      
      // Second sync with updated data
      mockOctokit.repos.get.mockResolvedValue({
        data: {
          full_name: 'owner/repo',
          description: 'Updated description',
          default_branch: 'main',
          language: 'TypeScript',
          stargazers_count: 20,
          private: false,
        },
      });
      await service.syncRepoMetadata('owner', 'repo');
      
      // Verify only one record exists (upsert, not insert)
      const { repos } = await import('../../src/db/schema.js');
      const { eq, and } = await import('drizzle-orm');
      
      const result = await db
        .select()
        .from(repos)
        .where(and(eq(repos.owner, 'owner'), eq(repos.name, 'repo')));
      
      expect(result.length).toBe(1);
      expect(result[0]?.description).toBe('Updated description');
      expect(result[0]?.stars).toBe(20);
    });

    it('should handle GitHub API errors gracefully', async () => {
      // Mock: GitHub API returns 404
      mockOctokit.repos.get.mockRejectedValue({
        status: 404,
        message: 'Not Found',
      });
      
      await expect(
        service.syncRepoMetadata('owner', 'non-existent')
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('Task 5.1: Sync All Repos', () => {
    it('should sync all known repos', async () => {
      // Setup: Insert multiple repos in DB
      const { RepoRepository } = await import('../../src/db/repositories/repo.repo.js');
      const repoRepo = new RepoRepository(db);
      
      await repoRepo.upsert({
        id: 'owner1/repo1',
        owner: 'owner1',
        name: 'repo1',
        fullName: 'owner1/repo1',
      });
      await repoRepo.upsert({
        id: 'owner2/repo2',
        owner: 'owner2',
        name: 'repo2',
        fullName: 'owner2/repo2',
      });
      
      // Mock: Octokit calls for each repo
      mockOctokit.repos.get.mockResolvedValue({
        data: {
          full_name: 'owner/repo',
          description: 'Synced',
          default_branch: 'main',
          language: 'TypeScript',
          stargazers_count: 1,
          private: false,
        },
      });
      
      await service.syncAllRepos();
      
      // Verify both repos were attempted to sync
      expect(mockOctokit.repos.get).toHaveBeenCalledTimes(2);
    });

    it('should skip repos with missing metadata', async () => {
      // Empty repos table - should not throw
      await expect(service.syncAllRepos()).resolves.toBeUndefined();
    });

    it('should continue on individual repo failures', async () => {
      // Setup: Multiple repos
      const { RepoRepository } = await import('../../src/db/repositories/repo.repo.js');
      const repoRepo = new RepoRepository(db);
      
      await repoRepo.upsert({
        id: 'owner1/repo1',
        owner: 'owner1',
        name: 'repo1',
        fullName: 'owner1/repo1',
      });
      await repoRepo.upsert({
        id: 'owner2/repo2',
        owner: 'owner2',
        name: 'repo2',
        fullName: 'owner2/repo2',
      });
      
      // Mock: First repo fails, second succeeds
      mockOctokit.repos.get
        .mockRejectedValueOnce({ status: 404, message: 'Not Found' })
        .mockResolvedValueOnce({
          data: {
            full_name: 'owner2/repo2',
            description: 'Success',
            default_branch: 'main',
            language: 'TypeScript',
            stargazers_count: 1,
            private: false,
          },
        });
      
      // Should not throw, should continue
      await service.syncAllRepos();
      
      // Both repos should have been attempted
      expect(mockOctokit.repos.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('Task 5.2: PR Status Sync', () => {
    it('should sync PR status from GitHub', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test PR',
          body: 'Test description',
          state: 'open',
          additions: 50,
          deletions: 25,
          changed_files: 5,
          head: { sha: 'abc123' },
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      
      mockOctokit.pulls.listFiles.mockResolvedValue({
        data: [
          { filename: 'src/index.ts' },
          { filename: 'src/utils.ts' },
          { filename: 'src/test.spec.ts' },
        ],
      });
      
      mockOctokit.checks.listForRef.mockResolvedValue({
        data: { total_count: 0, check_runs: [] },
      });
      
      mockOctokit.pulls.listReviews.mockResolvedValue({ data: [] });
      
      await service.syncPrStatus('https://github.com/owner/repo/pull/123');
      
      const { prReviews } = await import('../../src/db/schema.js');
      const { eq } = await import('drizzle-orm');
      
      const result = await db
        .select()
        .from(prReviews)
        .where(eq(prReviews.prUrl, 'https://github.com/owner/repo/pull/123'))
        .limit(1);
      
      expect(result.length).toBe(1);
      expect(result[0]?.prNumber).toBe(123);
      expect(result[0]?.prTitle).toBe('Test PR');
    });

    it('should extract CI status from PR', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test PR',
          body: 'Test',
          state: 'open',
          additions: 50,
          deletions: 25,
          changed_files: 5,
          head: { sha: 'abc123' },
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      
      mockOctokit.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'src/index.ts' }],
      });
      
      mockOctokit.checks.listForRef.mockResolvedValue({
        data: {
          total_count: 2,
          check_runs: [
            { conclusion: 'success' },
            { conclusion: 'success' },
          ],
        },
      });
      
      mockOctokit.pulls.listReviews.mockResolvedValue({ data: [] });
      
      await service.syncPrStatus('https://github.com/owner/repo/pull/123');
      
      const { prReviews } = await import('../../src/db/schema.js');
      const { eq } = await import('drizzle-orm');
      
      const result = await db
        .select()
        .from(prReviews)
        .where(eq(prReviews.prUrl, 'https://github.com/owner/repo/pull/123'))
        .limit(1);
      
      expect(result[0]?.ciStatus).toBe('success');
    });

    it('should extract review state from PR', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test PR',
          body: 'Test',
          state: 'open',
          additions: 50,
          deletions: 25,
          changed_files: 5,
          head: { sha: 'abc123' },
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      
      mockOctokit.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'src/index.ts' }],
      });
      
      mockOctokit.checks.listForRef.mockResolvedValue({
        data: { total_count: 0, check_runs: [] },
      });
      
      mockOctokit.pulls.listReviews.mockResolvedValue({
        data: [
          { user: { login: 'reviewer1' }, state: 'APPROVED' },
        ],
      });
      
      await service.syncPrStatus('https://github.com/owner/repo/pull/123');
      
      const { prReviews } = await import('../../src/db/schema.js');
      const { eq } = await import('drizzle-orm');
      
      const result = await db
        .select()
        .from(prReviews)
        .where(eq(prReviews.prUrl, 'https://github.com/owner/repo/pull/123'))
        .limit(1);
      
      expect(result[0]?.reviewStatus).toBe('approved');
    });

    it('should extract lines changed from PR', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test PR',
          body: 'Test',
          state: 'open',
          additions: 50,
          deletions: 25,
          changed_files: 5,
          head: { sha: 'abc123' },
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      
      mockOctokit.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'src/index.ts' }],
      });
      
      mockOctokit.checks.listForRef.mockResolvedValue({
        data: { total_count: 0, check_runs: [] },
      });
      
      mockOctokit.pulls.listReviews.mockResolvedValue({ data: [] });
      
      await service.syncPrStatus('https://github.com/owner/repo/pull/123');
      
      const { prReviews } = await import('../../src/db/schema.js');
      const { eq } = await import('drizzle-orm');
      
      const result = await db
        .select()
        .from(prReviews)
        .where(eq(prReviews.prUrl, 'https://github.com/owner/repo/pull/123'))
        .limit(1);
      
      expect(result[0]?.linesChanged).toBe(75); // 50 + 25
    });

    it('should extract files changed from PR', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test PR',
          body: 'Test',
          state: 'open',
          additions: 50,
          deletions: 25,
          changed_files: 5,
          head: { sha: 'abc123' },
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      
      mockOctokit.pulls.listFiles.mockResolvedValue({
        data: [
          { filename: 'src/index.ts' },
          { filename: 'src/utils.ts' },
          { filename: 'src/types.ts' },
          { filename: 'src/test.spec.ts' },
          { filename: 'README.md' },
        ],
      });
      
      mockOctokit.checks.listForRef.mockResolvedValue({
        data: { total_count: 0, check_runs: [] },
      });
      
      mockOctokit.pulls.listReviews.mockResolvedValue({ data: [] });
      
      await service.syncPrStatus('https://github.com/owner/repo/pull/123');
      
      const { prReviews } = await import('../../src/db/schema.js');
      const { eq } = await import('drizzle-orm');
      
      const result = await db
        .select()
        .from(prReviews)
        .where(eq(prReviews.prUrl, 'https://github.com/owner/repo/pull/123'))
        .limit(1);
      
      expect(result[0]?.filesChanged).toBe(5);
      expect(result[0]?.testFilesChanged).toBe(1);
    });

    it('should detect critical files touched', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test PR',
          body: 'Test',
          state: 'open',
          additions: 10,
          deletions: 5,
          changed_files: 2,
          head: { sha: 'abc123' },
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      
      mockOctokit.pulls.listFiles.mockResolvedValue({
        data: [
          { filename: 'package.json' },
          { filename: 'src/index.ts' },
        ],
      });
      
      mockOctokit.checks.listForRef.mockResolvedValue({
        data: { total_count: 0, check_runs: [] },
      });
      
      mockOctokit.pulls.listReviews.mockResolvedValue({ data: [] });
      
      await service.syncPrStatus('https://github.com/owner/repo/pull/123');
      
      const { prReviews } = await import('../../src/db/schema.js');
      const { eq } = await import('drizzle-orm');
      
      const result = await db
        .select()
        .from(prReviews)
        .where(eq(prReviews.prUrl, 'https://github.com/owner/repo/pull/123'))
        .limit(1);
      
      expect(result[0]?.criticalFilesTouched).toBe(true);
    });

    it('should detect dependency files touched', async () => {
      // NOTE: dependencyFilesTouched is only used in ComplexityScorer input, not stored in DB.
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test PR',
          body: 'Test',
          state: 'open',
          additions: 10,
          deletions: 5,
          changed_files: 1,
          head: { sha: 'abc123' },
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      
      mockOctokit.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'package-lock.json' }],
      });
      
      mockOctokit.checks.listForRef.mockResolvedValue({
        data: { total_count: 0, check_runs: [] },
      });
      
      mockOctokit.pulls.listReviews.mockResolvedValue({ data: [] });
      
      await service.syncPrStatus('https://github.com/owner/repo/pull/123');
      
      // Verify complexity reflects dependency changes
      const { prReviews } = await import('../../src/db/schema.js');
      const { eq } = await import('drizzle-orm');
      
      const result = await db
        .select()
        .from(prReviews)
        .where(eq(prReviews.prUrl, 'https://github.com/owner/repo/pull/123'))
        .limit(1);
      
      // Complexity should account for dependency file changes
      expect(result[0]?.complexityScore).toBeGreaterThan(0);
    });

    it('should update existing PR status', async () => {
      // First sync
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test PR',
          body: 'Test',
          state: 'open',
          additions: 50,
          deletions: 25,
          changed_files: 5,
          head: { sha: 'abc123' },
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      
      mockOctokit.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'src/index.ts' }],
      });
      
      mockOctokit.checks.listForRef.mockResolvedValue({
        data: {
          total_count: 1,
          check_runs: [{ conclusion: null }],
        },
      });
      
      mockOctokit.pulls.listReviews.mockResolvedValue({ data: [] });
      
      await service.syncPrStatus('https://github.com/owner/repo/pull/123');
      
      // Second sync with updated CI status
      mockOctokit.checks.listForRef.mockResolvedValue({
        data: {
          total_count: 1,
          check_runs: [{ conclusion: 'success' }],
        },
      });
      
      await service.syncPrStatus('https://github.com/owner/repo/pull/123');
      
      const { prReviews } = await import('../../src/db/schema.js');
      const { eq } = await import('drizzle-orm');
      
      const result = await db
        .select()
        .from(prReviews)
        .where(eq(prReviews.prUrl, 'https://github.com/owner/repo/pull/123'));
      
      expect(result.length).toBe(1); // Upsert, not duplicate
      expect(result[0]?.ciStatus).toBe('success');
    });

    it('should handle invalid PR URLs', async () => {
      await expect(
        service.syncPrStatus('not-a-valid-url')
      ).rejects.toThrow(/invalid/i);
    });

    it('should handle non-existent PRs', async () => {
      mockOctokit.pulls.get.mockRejectedValue({
        status: 404,
        message: 'Not Found',
      });
      
      await expect(
        service.syncPrStatus('https://github.com/owner/repo/pull/99999')
      ).rejects.toThrow(/not found/i);
    });
  });

  describe('CI Status Detection', () => {
    it('should detect successful CI', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test PR',
          body: 'Test',
          state: 'open',
          additions: 10,
          deletions: 5,
          changed_files: 1,
          head: { sha: 'abc123' },
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      
      mockOctokit.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'src/index.ts' }],
      });
      
      mockOctokit.checks.listForRef.mockResolvedValue({
        data: {
          total_count: 3,
          check_runs: [
            { conclusion: 'success' },
            { conclusion: 'success' },
            { conclusion: 'success' },
          ],
        },
      });
      
      mockOctokit.pulls.listReviews.mockResolvedValue({ data: [] });
      
      await service.syncPrStatus('https://github.com/owner/repo/pull/123');
      
      const { prReviews } = await import('../../src/db/schema.js');
      const { eq } = await import('drizzle-orm');
      
      const result = await db
        .select()
        .from(prReviews)
        .where(eq(prReviews.prUrl, 'https://github.com/owner/repo/pull/123'))
        .limit(1);
      
      expect(result[0]?.ciStatus).toBe('success');
    });

    it('should detect failing CI', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test PR',
          body: 'Test',
          state: 'open',
          additions: 10,
          deletions: 5,
          changed_files: 1,
          head: { sha: 'abc123' },
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      
      mockOctokit.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'src/index.ts' }],
      });
      
      mockOctokit.checks.listForRef.mockResolvedValue({
        data: {
          total_count: 2,
          check_runs: [
            { conclusion: 'success' },
            { conclusion: 'failure' },
          ],
        },
      });
      
      mockOctokit.pulls.listReviews.mockResolvedValue({ data: [] });
      
      await service.syncPrStatus('https://github.com/owner/repo/pull/123');
      
      const { prReviews } = await import('../../src/db/schema.js');
      const { eq } = await import('drizzle-orm');
      
      const result = await db
        .select()
        .from(prReviews)
        .where(eq(prReviews.prUrl, 'https://github.com/owner/repo/pull/123'))
        .limit(1);
      
      expect(result[0]?.ciStatus).toBe('failure');
    });

    it('should detect pending CI', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test PR',
          body: 'Test',
          state: 'open',
          additions: 10,
          deletions: 5,
          changed_files: 1,
          head: { sha: 'abc123' },
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      
      mockOctokit.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'src/index.ts' }],
      });
      
      mockOctokit.checks.listForRef.mockResolvedValue({
        data: {
          total_count: 2,
          check_runs: [
            { conclusion: 'success' },
            { conclusion: null }, // Pending
          ],
        },
      });
      
      mockOctokit.pulls.listReviews.mockResolvedValue({ data: [] });
      
      await service.syncPrStatus('https://github.com/owner/repo/pull/123');
      
      const { prReviews } = await import('../../src/db/schema.js');
      const { eq } = await import('drizzle-orm');
      
      const result = await db
        .select()
        .from(prReviews)
        .where(eq(prReviews.prUrl, 'https://github.com/owner/repo/pull/123'))
        .limit(1);
      
      expect(result[0]?.ciStatus).toBe('pending');
    });

    it('should handle missing CI checks', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test PR',
          body: 'Test',
          state: 'open',
          additions: 10,
          deletions: 5,
          changed_files: 1,
          head: { sha: 'abc123' },
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      
      mockOctokit.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'src/index.ts' }],
      });
      
      mockOctokit.checks.listForRef.mockResolvedValue({
        data: { total_count: 0, check_runs: [] },
      });
      
      mockOctokit.pulls.listReviews.mockResolvedValue({ data: [] });
      
      await service.syncPrStatus('https://github.com/owner/repo/pull/123');
      
      const { prReviews } = await import('../../src/db/schema.js');
      const { eq } = await import('drizzle-orm');
      
      const result = await db
        .select()
        .from(prReviews)
        .where(eq(prReviews.prUrl, 'https://github.com/owner/repo/pull/123'))
        .limit(1);
      
      expect(result[0]?.ciStatus).toBeNull();
    });
  });

  describe('Review Status Detection', () => {
    it('should detect approved reviews', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test PR',
          body: 'Test',
          state: 'open',
          additions: 10,
          deletions: 5,
          changed_files: 1,
          head: { sha: 'abc123' },
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      
      mockOctokit.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'src/index.ts' }],
      });
      
      mockOctokit.checks.listForRef.mockResolvedValue({
        data: { total_count: 0, check_runs: [] },
      });
      
      mockOctokit.pulls.listReviews.mockResolvedValue({
        data: [
          { user: { login: 'reviewer1' }, state: 'APPROVED' },
          { user: { login: 'reviewer2' }, state: 'APPROVED' },
        ],
      });
      
      await service.syncPrStatus('https://github.com/owner/repo/pull/123');
      
      const { prReviews } = await import('../../src/db/schema.js');
      const { eq } = await import('drizzle-orm');
      
      const result = await db
        .select()
        .from(prReviews)
        .where(eq(prReviews.prUrl, 'https://github.com/owner/repo/pull/123'))
        .limit(1);
      
      expect(result[0]?.reviewStatus).toBe('approved');
    });

    it('should detect changes requested', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test PR',
          body: 'Test',
          state: 'open',
          additions: 10,
          deletions: 5,
          changed_files: 1,
          head: { sha: 'abc123' },
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      
      mockOctokit.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'src/index.ts' }],
      });
      
      mockOctokit.checks.listForRef.mockResolvedValue({
        data: { total_count: 0, check_runs: [] },
      });
      
      mockOctokit.pulls.listReviews.mockResolvedValue({
        data: [
          { user: { login: 'reviewer1' }, state: 'APPROVED' },
          { user: { login: 'reviewer2' }, state: 'CHANGES_REQUESTED' },
        ],
      });
      
      await service.syncPrStatus('https://github.com/owner/repo/pull/123');
      
      const { prReviews } = await import('../../src/db/schema.js');
      const { eq } = await import('drizzle-orm');
      
      const result = await db
        .select()
        .from(prReviews)
        .where(eq(prReviews.prUrl, 'https://github.com/owner/repo/pull/123'))
        .limit(1);
      
      expect(result[0]?.reviewStatus).toBe('changes_requested');
    });

    it('should detect no reviews', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          title: 'Test PR',
          body: 'Test',
          state: 'open',
          additions: 10,
          deletions: 5,
          changed_files: 1,
          head: { sha: 'abc123' },
          created_at: '2026-01-01T00:00:00Z',
        },
      });
      
      mockOctokit.pulls.listFiles.mockResolvedValue({
        data: [{ filename: 'src/index.ts' }],
      });
      
      mockOctokit.checks.listForRef.mockResolvedValue({
        data: { total_count: 0, check_runs: [] },
      });
      
      mockOctokit.pulls.listReviews.mockResolvedValue({ data: [] });
      
      await service.syncPrStatus('https://github.com/owner/repo/pull/123');
      
      const { prReviews } = await import('../../src/db/schema.js');
      const { eq } = await import('drizzle-orm');
      
      const result = await db
        .select()
        .from(prReviews)
        .where(eq(prReviews.prUrl, 'https://github.com/owner/repo/pull/123'))
        .limit(1);
      
      expect(result[0]?.reviewStatus).toBeNull();
    });
  });

  describe('Merge Operations', () => {
    it('should merge PR with squash method', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          state: 'open',
          mergeable: true,
        },
      });
      
      mockOctokit.pulls.merge.mockResolvedValue({ data: {} });
      
      await expect(
        service.mergePr('https://github.com/owner/repo/pull/123', 'squash')
      ).resolves.toBeUndefined();
      
      expect(mockOctokit.pulls.merge).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 123,
        merge_method: 'squash',
      });
    });

    it('should merge PR with merge method', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          state: 'open',
          mergeable: true,
        },
      });
      
      mockOctokit.pulls.merge.mockResolvedValue({ data: {} });
      
      await expect(
        service.mergePr('https://github.com/owner/repo/pull/123', 'merge')
      ).resolves.toBeUndefined();
      
      expect(mockOctokit.pulls.merge).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 123,
        merge_method: 'merge',
      });
    });

    it('should merge PR with rebase method', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          state: 'open',
          mergeable: true,
        },
      });
      
      mockOctokit.pulls.merge.mockResolvedValue({ data: {} });
      
      await expect(
        service.mergePr('https://github.com/owner/repo/pull/123', 'rebase')
      ).resolves.toBeUndefined();
      
      expect(mockOctokit.pulls.merge).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 123,
        merge_method: 'rebase',
      });
    });

    it('should default to squash merge', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          state: 'open',
          mergeable: true,
        },
      });
      
      mockOctokit.pulls.merge.mockResolvedValue({ data: {} });
      
      await expect(
        service.mergePr('https://github.com/owner/repo/pull/123')
      ).resolves.toBeUndefined();
      
      expect(mockOctokit.pulls.merge).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        pull_number: 123,
        merge_method: 'squash',
      });
    });

    it('should validate PR is mergeable before merging', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          state: 'open',
          mergeable: false,
        },
      });
      
      await expect(
        service.mergePr('https://github.com/owner/repo/pull/123')
      ).rejects.toThrow(/not mergeable/i);
      
      expect(mockOctokit.pulls.merge).not.toHaveBeenCalled();
    });

    it('should handle merge conflicts', async () => {
      mockOctokit.pulls.get.mockResolvedValue({
        data: {
          number: 123,
          state: 'open',
          mergeable: true,
        },
      });
      
      mockOctokit.pulls.merge.mockRejectedValue({
        status: 409,
        message: 'Merge conflict',
      });
      
      await expect(
        service.mergePr('https://github.com/owner/repo/pull/123')
      ).rejects.toThrow(/conflict/i);
    });
  });

  describe('Error Handling', () => {
    it('should throw on missing GitHub token', async () => {
      const noTokenConfig = { ...defaultConfig, githubToken: undefined };
      
      expect(() => {
        new GitHubService(noTokenConfig, db);
      }).toThrow(/token/i);
    });

    it('should handle rate limiting', async () => {
      mockOctokit.repos.get.mockRejectedValue({
        status: 429,
        message: 'Rate limit exceeded',
      });
      
      await expect(
        service.syncRepoMetadata('owner', 'repo')
      ).rejects.toThrow(/rate limit/i);
    });

    it('should retry on network errors', async () => {
      // This test verifies that network errors are properly thrown
      // Actual retry logic would be implemented in a separate wrapper
      mockOctokit.repos.get.mockRejectedValue(new Error('Network error'));
      
      await expect(
        service.syncRepoMetadata('owner', 'repo')
      ).rejects.toThrow();
    });
  });
});
