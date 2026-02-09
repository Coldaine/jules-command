/**
 * Phase 4 Task 4.3: Auto-Merge Evaluator Tests
 */

import { describe, it, expect } from 'vitest';
import { AutoMergeEvaluator } from '../../src/services/auto-merge.js';
import type { Config } from '../../src/config.js';
import type { PrReviewRow } from '../../src/db/repositories/pr-review.repo.js';

describe('AutoMergeEvaluator', () => {
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

  function createPR(overrides: Partial<PrReviewRow> = {}): PrReviewRow {
    return {
      id: 'pr-1',
      prUrl: 'https://github.com/owner/repo/pull/1',
      sessionId: 'session-1',
      prNumber: 1,
      prTitle: 'Test PR',
      prState: 'open',
      prCreatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
      ciStatus: 'success',
      reviewStatus: 'approved',
      linesChanged: 50,
      filesChanged: 3,
      testFilesChanged: 1,
      criticalFilesTouched: false,
      dependencyFilesTouched: false,
      complexityScore: 0.15,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  describe('eligible PRs', () => {
    it('should mark eligible PR (low score, CI green, age OK) as eligible', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        complexityScore: 0.2,
        linesChanged: 100,
        filesChanged: 3,
        criticalFilesTouched: false,
        ciStatus: 'success',
        reviewStatus: 'approved',
        prCreatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });

    it('should mark small, simple PR as eligible', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        complexityScore: 0.1,
        linesChanged: 10,
        filesChanged: 1,
        ciStatus: 'success',
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(true);
      expect(result.reasons).toHaveLength(0);
    });
  });

  describe('complexity checks', () => {
    it('should reject PR with high complexity score', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        complexityScore: 0.6, // Exceeds 0.3 threshold
        ciStatus: 'success',
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('complexity_score 0.6 exceeds threshold 0.3');
    });

    it('should accept PR with complexity score at threshold', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        complexityScore: 0.3, // Exactly at threshold
        ciStatus: 'success',
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      // At threshold should not trigger complexity check
      expect(result.eligible).toBe(true);
    });

    it('should handle null complexity score', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        complexityScore: null, // Not computed yet
        ciStatus: 'success',
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      // Should not fail on null, other checks might pass
      expect(result.eligible).toBe(true);
    });
  });

  describe('lines changed checks', () => {
    it('should reject PR with too many lines changed', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        linesChanged: 500, // Exceeds 200 threshold
        complexityScore: 0.2,
        ciStatus: 'success',
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('lines_changed 500 exceeds max 200');
    });

    it('should accept PR with lines at threshold', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        linesChanged: 200, // Exactly at threshold
        complexityScore: 0.2,
        ciStatus: 'success',
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(true);
    });
  });

  describe('files changed checks', () => {
    it('should reject PR with too many files changed', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        filesChanged: 10, // Exceeds 5 threshold
        complexityScore: 0.2,
        ciStatus: 'success',
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('files_changed 10 exceeds max 5');
    });

    it('should accept PR with files at threshold', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        filesChanged: 5, // Exactly at threshold
        complexityScore: 0.2,
        ciStatus: 'success',
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(true);
    });
  });

  describe('critical files checks', () => {
    it('should reject PR that touches critical files', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        criticalFilesTouched: true,
        complexityScore: 0.2,
        linesChanged: 50,
        filesChanged: 2,
        ciStatus: 'success',
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('critical files touched');
    });

    it('should accept PR that does not touch critical files', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        criticalFilesTouched: false,
        complexityScore: 0.2,
        ciStatus: 'success',
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(true);
    });
  });

  describe('CI status checks', () => {
    it('should reject PR with failing CI', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        ciStatus: 'failure',
        complexityScore: 0.2,
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain("ci_status is 'failure' (must be 'success')");
    });

    it('should reject PR with pending CI', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        ciStatus: 'pending',
        complexityScore: 0.2,
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain("ci_status is 'pending' (must be 'success')");
    });

    it('should reject PR with unknown CI status', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        ciStatus: null,
        complexityScore: 0.2,
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain("ci_status is 'unknown' (must be 'success')");
    });

    it('should accept PR with successful CI', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        ciStatus: 'success',
        complexityScore: 0.2,
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(true);
    });
  });

  describe('PR age checks', () => {
    it('should reject PR that is too young', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        prCreatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
        complexityScore: 0.2,
        ciStatus: 'success',
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(false);
      expect(result.reasons.some(r => r.includes('pr_age') && r.includes('below minimum'))).toBe(true);
    });

    it('should accept PR that is old enough', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        prCreatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
        complexityScore: 0.2,
        ciStatus: 'success',
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(true);
    });

    it('should reject PR with unknown creation time', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        prCreatedAt: null,
        complexityScore: 0.2,
        ciStatus: 'success',
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('pr_created_at unknown — cannot verify age');
    });
  });

  describe('review status checks', () => {
    it('should reject PR with changes requested', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        reviewStatus: 'changes_requested',
        complexityScore: 0.2,
        ciStatus: 'success',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(false);
      expect(result.reasons).toContain('review status is changes_requested');
    });

    it('should accept PR with approved status', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        reviewStatus: 'approved',
        complexityScore: 0.2,
        ciStatus: 'success',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(true);
    });

    it('should accept PR with no reviews', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        reviewStatus: null,
        complexityScore: 0.2,
        ciStatus: 'success',
      });

      const result = evaluator.evaluate(pr);

      // Only changes_requested should block
      expect(result.eligible).toBe(true);
    });
  });

  describe('multiple failing criteria', () => {
    it('should list all reasons when multiple criteria fail', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        complexityScore: 0.8, // Too high
        linesChanged: 500, // Too many
        filesChanged: 10, // Too many
        criticalFilesTouched: true, // Critical
        ciStatus: 'failure', // Failing
        reviewStatus: 'changes_requested', // Requested changes
        prCreatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // Too young
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(false);
      expect(result.reasons.length).toBeGreaterThanOrEqual(6);
      // Verify at least the major failure reasons are present
      expect(result.reasons.some(r => r.includes('complexity'))).toBe(true);
      expect(result.reasons.some(r => r.includes('lines'))).toBe(true);
      expect(result.reasons.some(r => r.includes('files'))).toBe(true);
      expect(result.reasons.some(r => r.includes('critical'))).toBe(true);
      expect(result.reasons.some(r => r.includes('ci_status'))).toBe(true);
      expect(result.reasons.some(r => r.includes('review status'))).toBe(true);
    });

    it('should list specific reasons in order', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        complexityScore: 0.5,
        linesChanged: 300,
        ciStatus: 'failure',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(false);
      // Verify order matches implementation
      expect(result.reasons[0]).toContain('complexity_score');
      expect(result.reasons[1]).toContain('lines_changed');
      expect(result.reasons[2]).toContain('ci_status');
    });
  });

  describe('custom thresholds', () => {
    it('should respect custom complexity threshold', () => {
      const customConfig: Config = {
        ...defaultConfig,
        autoMergeMaxComplexity: 0.5, // More permissive
      };
      const evaluator = new AutoMergeEvaluator(customConfig);
      const pr = createPR({
        complexityScore: 0.4, // Would fail with 0.3, passes with 0.5
        ciStatus: 'success',
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(true);
    });

    it('should respect custom lines threshold', () => {
      const customConfig: Config = {
        ...defaultConfig,
        autoMergeMaxLines: 500, // More permissive
      };
      const evaluator = new AutoMergeEvaluator(customConfig);
      const pr = createPR({
        linesChanged: 400, // Would fail with 200, passes with 500
        complexityScore: 0.2,
        ciStatus: 'success',
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(true);
    });

    it('should respect custom age threshold', () => {
      const customConfig: Config = {
        ...defaultConfig,
        autoMergeMinAgeHours: 0.5, // 30 minutes
      };
      const evaluator = new AutoMergeEvaluator(customConfig);
      const pr = createPR({
        prCreatedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(), // 40 minutes ago
        complexityScore: 0.2,
        ciStatus: 'success',
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(true);
    });
  });

  describe('result structure', () => {
    it('should return result with eligible flag and reasons array', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        complexityScore: 0.2,
        ciStatus: 'success',
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      expect(result).toHaveProperty('eligible');
      expect(result).toHaveProperty('reasons');
      expect(Array.isArray(result.reasons)).toBe(true);
    });

    it('should have empty reasons array for eligible PR', () => {
      const evaluator = new AutoMergeEvaluator(defaultConfig);
      const pr = createPR({
        complexityScore: 0.2,
        ciStatus: 'success',
        reviewStatus: 'approved',
      });

      const result = evaluator.evaluate(pr);

      expect(result.eligible).toBe(true);
      expect(result.reasons).toEqual([]);
    });
  });
});
