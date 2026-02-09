/**
 * Phase 2 Task 2.1: Config Loading Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('Config Loading', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset process.env before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  it('should return typed config with valid env vars', () => {
    process.env['JULES_API_KEY'] = 'test-api-key-12345';
    process.env['GITHUB_TOKEN'] = 'ghp_test123';
    process.env['DATABASE_PATH'] = './test.db';
    process.env['POLLING_INTERVAL_MS'] = '3000';

    const config = loadConfig();

    expect(config.julesApiKey).toBe('test-api-key-12345');
    expect(config.githubToken).toBe('ghp_test123');
    expect(config.databasePath).toBe('./test.db');
    expect(config.pollingIntervalMs).toBe(3000);
  });

  it('should throw descriptive error when JULES_API_KEY is missing', () => {
    delete process.env['JULES_API_KEY'];

    expect(() => loadConfig()).toThrow(); // Zod throws validation error
  });

  it('should throw error when JULES_API_KEY is empty string', () => {
    process.env['JULES_API_KEY'] = '';

    expect(() => loadConfig()).toThrow(/JULES_API_KEY is required/);
  });

  it('should apply default values for optional configs', () => {
    process.env['JULES_API_KEY'] = 'test-key';
    // Don't set any optional values

    const config = loadConfig();

    expect(config.databasePath).toBe('./data/jules-command.db');
    expect(config.pollingIntervalMs).toBe(5000);
    expect(config.pollDelayBetweenSessionsMs).toBe(100);
    expect(config.stallPlanApprovalTimeoutMin).toBe(30);
    expect(config.stallFeedbackTimeoutMin).toBe(30);
    expect(config.stallNoProgressTimeoutMin).toBe(15);
    expect(config.stallQueueTimeoutMin).toBe(10);
    expect(config.stallConsecutiveErrors).toBe(3);
    expect(config.autoMergeMaxComplexity).toBe(0.3);
    expect(config.autoMergeMaxLines).toBe(200);
    expect(config.autoMergeMaxFiles).toBe(5);
    expect(config.autoMergeMinAgeHours).toBe(2);
    expect(config.complexityLinesThreshold).toBe(500);
    expect(config.complexityFilesThreshold).toBe(20);
  });

  it('should populate BWS config when both BWS vars present', () => {
    process.env['JULES_API_KEY'] = 'test-key';
    process.env['BWS_ACCESS_TOKEN'] = 'bws-token-xyz';
    process.env['BWS_GITHUB_SECRET_ID'] = 'secret-id-123';

    const config = loadConfig();

    expect(config.bwsAccessToken).toBe('bws-token-xyz');
    expect(config.bwsGithubSecretId).toBe('secret-id-123');
  });

  it('should handle optional BWS vars being absent', () => {
    process.env['JULES_API_KEY'] = 'test-key';
    // Don't set BWS vars

    const config = loadConfig();

    expect(config.bwsAccessToken).toBeUndefined();
    expect(config.bwsGithubSecretId).toBeUndefined();
  });

  it('should parse custom threshold values correctly', () => {
    process.env['JULES_API_KEY'] = 'test-key';
    process.env['STALL_PLAN_APPROVAL_TIMEOUT_MIN'] = '45';
    process.env['AUTO_MERGE_MAX_COMPLEXITY'] = '0.5';
    process.env['AUTO_MERGE_MIN_AGE_HOURS'] = '3.5';
    process.env['COMPLEXITY_LINES_THRESHOLD'] = '1000';

    const config = loadConfig();

    expect(config.stallPlanApprovalTimeoutMin).toBe(45);
    expect(config.autoMergeMaxComplexity).toBe(0.5);
    expect(config.autoMergeMinAgeHours).toBe(3.5);
    expect(config.complexityLinesThreshold).toBe(1000);
  });

  it('should ignore invalid numeric values and use defaults', () => {
    process.env['JULES_API_KEY'] = 'test-key';
    process.env['POLLING_INTERVAL_MS'] = 'not-a-number';
    process.env['AUTO_MERGE_MAX_COMPLEXITY'] = 'invalid';

    const config = loadConfig();

    expect(config.pollingIntervalMs).toBe(5000); // default
    expect(config.autoMergeMaxComplexity).toBe(0.3); // default
  });
});
