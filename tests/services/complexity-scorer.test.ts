/**
 * Phase 4 Task 4.2: Complexity Scorer Tests
 */

import { describe, it, expect } from 'vitest';
import { ComplexityScorer } from '../../src/services/complexity-scorer.js';
import type { Config } from '../../src/config.js';
import type { ComplexityInput } from '../../src/services/complexity-scorer.js';

describe('ComplexityScorer', () => {
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

  describe('trivial PRs', () => {
    it('should score trivial PR (10 lines, 1 file) as very low complexity', () => {
      const scorer = new ComplexityScorer(defaultConfig);
      const input: ComplexityInput = {
        linesChanged: 10,
        filesChanged: 1,
        testFilesChanged: 1,
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
      };

      const result = scorer.score(input);

      expect(result.score).toBeLessThan(0.2);
      expect(result.label).toBe('trivial');
    });

    it('should score documentation-only PR as trivial', () => {
      const scorer = new ComplexityScorer(defaultConfig);
      const input: ComplexityInput = {
        linesChanged: 5,
        filesChanged: 1,
        testFilesChanged: 0,
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
      };

      const result = scorer.score(input);

      expect(result.score).toBeLessThan(0.2);
      expect(result.label).toBe('trivial');
    });
  });

  describe('complex PRs', () => {
    it('should score complex PR (500 lines, 20 files, critical) as high complexity', () => {
      const scorer = new ComplexityScorer(defaultConfig);
      const input: ComplexityInput = {
        linesChanged: 500,
        filesChanged: 20,
        testFilesChanged: 5,
        criticalFilesTouched: true,
        dependencyFilesTouched: false,
      };

      const result = scorer.score(input);

      expect(result.score).toBeGreaterThan(0.7);
      expect(result.label).toMatch(/high|critical/);
    });

    it('should score dependency changes as high complexity', () => {
      const scorer = new ComplexityScorer(defaultConfig);
      const input: ComplexityInput = {
        linesChanged: 100,
        filesChanged: 5,
        testFilesChanged: 0,
        criticalFilesTouched: false,
        dependencyFilesTouched: true,
      };

      const result = scorer.score(input);

      expect(result.score).toBeGreaterThan(0.3);
      expect(result.details.dependencyComponent).toBeGreaterThan(0);
    });

    it('should penalize critical files', () => {
      const scorer = new ComplexityScorer(defaultConfig);
      const inputWithCritical: ComplexityInput = {
        linesChanged: 50,
        filesChanged: 2,
        testFilesChanged: 1,
        criticalFilesTouched: true,
        dependencyFilesTouched: false,
      };
      const inputWithoutCritical: ComplexityInput = {
        ...inputWithCritical,
        criticalFilesTouched: false,
      };

      const resultWith = scorer.score(inputWithCritical);
      const resultWithout = scorer.score(inputWithoutCritical);

      expect(resultWith.score).toBeGreaterThan(resultWithout.score);
      expect(resultWith.details.criticalComponent).toBe(0.25); // Full weight
      expect(resultWithout.details.criticalComponent).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle 0 lines changed', () => {
      const scorer = new ComplexityScorer(defaultConfig);
      const input: ComplexityInput = {
        linesChanged: 0,
        filesChanged: 0,
        testFilesChanged: 0,
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
      };

      const result = scorer.score(input);

      expect(result.score).toBe(0.0);
      expect(result.label).toBe('trivial');
    });

    it('should handle extremely large PRs', () => {
      const scorer = new ComplexityScorer(defaultConfig);
      const input: ComplexityInput = {
        linesChanged: 10000, // Way beyond threshold
        filesChanged: 100,
        testFilesChanged: 0,
        criticalFilesTouched: true,
        dependencyFilesTouched: true,
      };

      const result = scorer.score(input);

      // Lines and files components should cap at 1.0 normalized
      expect(result.score).toBeGreaterThan(0.8);
      expect(result.label).toBe('critical');
    });

    it('should handle PR with only test files', () => {
      const scorer = new ComplexityScorer(defaultConfig);
      const input: ComplexityInput = {
        linesChanged: 100,
        filesChanged: 5,
        testFilesChanged: 5, // All files are tests
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
      };

      const result = scorer.score(input);

      // High test ratio should reduce complexity
      expect(result.details.testComponent).toBe(0); // 1 - 1.0 = 0
    });

    it('should handle PR with no test files', () => {
      const scorer = new ComplexityScorer(defaultConfig);
      const input: ComplexityInput = {
        linesChanged: 100,
        filesChanged: 5,
        testFilesChanged: 0, // No tests
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
      };

      const result = scorer.score(input);

      // No tests should increase complexity
      expect(result.details.testComponent).toBe(0.15); // Full weight
    });
  });

  describe('component weighting', () => {
    it('should verify weights sum to 1.0', () => {
      const scorer = new ComplexityScorer(defaultConfig);
      const input: ComplexityInput = {
        linesChanged: 500, // At threshold
        filesChanged: 20, // At threshold
        testFilesChanged: 0,
        criticalFilesTouched: true,
        dependencyFilesTouched: true,
      };

      const result = scorer.score(input);

      const totalWeight =
        result.details.linesComponent +
        result.details.filesComponent +
        result.details.criticalComponent +
        result.details.testComponent +
        result.details.dependencyComponent;

      expect(totalWeight).toBeCloseTo(1.0, 2);
    });

    it('should include all component details', () => {
      const scorer = new ComplexityScorer(defaultConfig);
      const input: ComplexityInput = {
        linesChanged: 250, // Half threshold
        filesChanged: 10, // Half threshold
        testFilesChanged: 5,
        criticalFilesTouched: true,
        dependencyFilesTouched: true,
      };

      const result = scorer.score(input);

      expect(result.details).toHaveProperty('linesComponent');
      expect(result.details).toHaveProperty('filesComponent');
      expect(result.details).toHaveProperty('criticalComponent');
      expect(result.details).toHaveProperty('testComponent');
      expect(result.details).toHaveProperty('dependencyComponent');

      // Verify calculations
      expect(result.details.linesComponent).toBeCloseTo(0.125, 1); // 0.25 * 0.5
      expect(result.details.filesComponent).toBeCloseTo(0.10, 2); // 0.20 * 0.5
      expect(result.details.criticalComponent).toBe(0.25); // 0.25 * 1.0
      expect(result.details.dependencyComponent).toBe(0.15); // 0.15 * 1.0
    });
  });

  describe('label assignment', () => {
    it('should assign "trivial" label for score < 0.2', () => {
      const scorer = new ComplexityScorer(defaultConfig);
      const input: ComplexityInput = {
        linesChanged: 10,
        filesChanged: 1,
        testFilesChanged: 1,
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
      };

      const result = scorer.score(input);

      expect(result.label).toBe('trivial');
    });

    it('should assign "low" label for score 0.2-0.4', () => {
      const scorer = new ComplexityScorer(defaultConfig);
      const input: ComplexityInput = {
        linesChanged: 150,
        filesChanged: 3,
        testFilesChanged: 1,
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
      };

      const result = scorer.score(input);

      expect(result.label).toBe('low');
    });

    it('should assign "medium" label for score 0.4-0.6', () => {
      const scorer = new ComplexityScorer(defaultConfig);
      const input: ComplexityInput = {
        linesChanged: 350, // Higher to push into medium range
        filesChanged: 12,
        testFilesChanged: 0,
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
      };

      const result = scorer.score(input);

      expect(result.label).toBe('medium');
    });

    it('should assign "high" label for score 0.6-0.8', () => {
      const scorer = new ComplexityScorer(defaultConfig);
      const input: ComplexityInput = {
        linesChanged: 400,
        filesChanged: 15,
        testFilesChanged: 0,
        criticalFilesTouched: true,
        dependencyFilesTouched: false,
      };

      const result = scorer.score(input);

      expect(result.label).toBe('high');
    });

    it('should assign "critical" label for score >= 0.8', () => {
      const scorer = new ComplexityScorer(defaultConfig);
      const input: ComplexityInput = {
        linesChanged: 500,
        filesChanged: 20,
        testFilesChanged: 0,
        criticalFilesTouched: true,
        dependencyFilesTouched: true,
      };

      const result = scorer.score(input);

      expect(result.label).toBe('critical');
    });
  });

  describe('test coverage impact', () => {
    it('should reward good test coverage', () => {
      const scorer = new ComplexityScorer(defaultConfig);
      const inputWithTests: ComplexityInput = {
        linesChanged: 200,
        filesChanged: 10,
        testFilesChanged: 8, // 80% test coverage
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
      };
      const inputWithoutTests: ComplexityInput = {
        ...inputWithTests,
        testFilesChanged: 0,
      };

      const resultWith = scorer.score(inputWithTests);
      const resultWithout = scorer.score(inputWithoutTests);

      expect(resultWith.score).toBeLessThan(resultWithout.score);
    });

    it('should handle test ratio > 1.0 (more test files than src files)', () => {
      const scorer = new ComplexityScorer(defaultConfig);
      const input: ComplexityInput = {
        linesChanged: 100,
        filesChanged: 3,
        testFilesChanged: 5, // More test files
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
      };

      const result = scorer.score(input);

      // Test ratio caps at 1.0, so test component should be 0
      expect(result.details.testComponent).toBe(0);
    });
  });

  describe('custom thresholds', () => {
    it('should respect custom line threshold', () => {
      const customConfig: Config = {
        ...defaultConfig,
        complexityLinesThreshold: 1000, // Custom threshold
      };
      const scorer = new ComplexityScorer(customConfig);
      const input: ComplexityInput = {
        linesChanged: 500, // Half of custom threshold
        filesChanged: 5,
        testFilesChanged: 2,
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
      };

      const result = scorer.score(input);

      // With 1000 threshold, 500 lines is 0.5 normalized
      expect(result.details.linesComponent).toBeCloseTo(0.125, 1); // 0.25 * 0.5
    });

    it('should respect custom files threshold', () => {
      const customConfig: Config = {
        ...defaultConfig,
        complexityFilesThreshold: 40, // Custom threshold
      };
      const scorer = new ComplexityScorer(customConfig);
      const input: ComplexityInput = {
        linesChanged: 100,
        filesChanged: 20, // Half of custom threshold
        testFilesChanged: 5,
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
      };

      const result = scorer.score(input);

      // With 40 threshold, 20 files is 0.5 normalized
      expect(result.details.filesComponent).toBeCloseTo(0.10, 2); // 0.20 * 0.5
    });
  });

  describe('score rounding', () => {
    it('should round score to 2 decimal places', () => {
      const scorer = new ComplexityScorer(defaultConfig);
      const input: ComplexityInput = {
        linesChanged: 123,
        filesChanged: 7,
        testFilesChanged: 2,
        criticalFilesTouched: false,
        dependencyFilesTouched: false,
      };

      const result = scorer.score(input);

      // Check that score has at most 2 decimal places
      const decimalPlaces = (result.score.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });
  });
});
