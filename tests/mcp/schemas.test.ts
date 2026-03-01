/**
 * Comprehensive tests for all MCP tool Zod schemas.
 * Verifies parsing, defaults, enum constraints, and rejection of invalid inputs.
 */

import { describe, it, expect } from 'vitest';
import {
  JulesCreateSessionSchema,
  JulesListSessionsSchema,
  JulesGetSessionSchema,
  JulesGetActivitiesSchema,
  JulesApprovePlanSchema,
  JulesSendMessageSchema,
  JulesGetDiffSchema,
  JulesGetBashOutputsSchema,
  JulesDashboardSchema,
  JulesStatusSchema,
  JulesPollSchema,
  JulesDetectStallsSchema,
  RepoSyncSchema,
  PrReviewStatusSchema_Tool,
  PrUpdateReviewSchema,
  PrCheckAutoMergeSchema,
  PrMergeSchema,
  PrReviewsListSchema,
  ReposListSchema,
  HealthCheckSchema,
  SessionStateSchema,
  ActivityTypeSchema,
  PrReviewStatusSchema,
  MergeMethodSchema,
  toolSchemas,
} from '../../src/mcp/tools/schemas.js';

// ─── Enum Schemas ─────────────────────────────────────────────────────────────

describe('Enum Schemas', () => {
  describe('SessionStateSchema', () => {
    const validStates = ['queued', 'planning', 'in_progress', 'completed', 'failed', 'awaiting_plan_approval', 'awaiting_user_feedback'];

    it.each(validStates)('accepts valid state: %s', (state) => {
      expect(SessionStateSchema.parse(state)).toBe(state);
    });

    it('rejects invalid state', () => {
      expect(() => SessionStateSchema.parse('running')).toThrow();
      expect(() => SessionStateSchema.parse('')).toThrow();
      expect(() => SessionStateSchema.parse(123)).toThrow();
    });
  });

  describe('ActivityTypeSchema', () => {
    const validTypes = ['message', 'plan', 'bash_output', 'file_change', 'error'];

    it.each(validTypes)('accepts valid type: %s', (type) => {
      expect(ActivityTypeSchema.parse(type)).toBe(type);
    });

    it('rejects invalid type', () => {
      expect(() => ActivityTypeSchema.parse('unknown')).toThrow();
    });
  });

  describe('PrReviewStatusSchema', () => {
    const validStatuses = ['pending', 'approved', 'changes_requested', 'closed'];

    it.each(validStatuses)('accepts valid status: %s', (status) => {
      expect(PrReviewStatusSchema.parse(status)).toBe(status);
    });

    it('rejects invalid status', () => {
      expect(() => PrReviewStatusSchema.parse('merged')).toThrow();
    });
  });

  describe('MergeMethodSchema', () => {
    const validMethods = ['merge', 'squash', 'rebase'];

    it.each(validMethods)('accepts valid method: %s', (method) => {
      expect(MergeMethodSchema.parse(method)).toBe(method);
    });

    it('rejects invalid method', () => {
      expect(() => MergeMethodSchema.parse('fast-forward')).toThrow();
    });
  });
});

// ─── Tool Input Schemas ───────────────────────────────────────────────────────

describe('JulesCreateSessionSchema', () => {
  it('accepts minimal valid input', () => {
    const result = JulesCreateSessionSchema.parse({ prompt: 'Fix the bug' });
    expect(result.prompt).toBe('Fix the bug');
    expect(result.autoPr).toBe(true);
    expect(result.requireApproval).toBe(false);
  });

  it('accepts full valid input', () => {
    const result = JulesCreateSessionSchema.parse({
      prompt: 'Add tests',
      repo: 'owner/repo',
      branch: 'feature-branch',
      autoPr: false,
      requireApproval: true,
      title: 'My session',
    });
    expect(result.repo).toBe('owner/repo');
    expect(result.branch).toBe('feature-branch');
    expect(result.autoPr).toBe(false);
    expect(result.requireApproval).toBe(true);
    expect(result.title).toBe('My session');
  });

  it('rejects empty prompt', () => {
    expect(() => JulesCreateSessionSchema.parse({ prompt: '' })).toThrow();
  });

  it('rejects missing prompt', () => {
    expect(() => JulesCreateSessionSchema.parse({})).toThrow();
  });

  it('rejects invalid repo format', () => {
    expect(() => JulesCreateSessionSchema.parse({ prompt: 'test', repo: 'badformat' })).toThrow();
    expect(() => JulesCreateSessionSchema.parse({ prompt: 'test', repo: 'a/b/c' })).toThrow();
  });

  it('accepts repo with dots and hyphens', () => {
    const result = JulesCreateSessionSchema.parse({ prompt: 'test', repo: 'my-org/my.repo' });
    expect(result.repo).toBe('my-org/my.repo');
  });
});

describe('JulesListSessionsSchema', () => {
  it('accepts empty input with defaults', () => {
    const result = JulesListSessionsSchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.fromDb).toBe(true);
    expect(result.state).toBeUndefined();
    expect(result.repo).toBeUndefined();
  });

  it('accepts valid state filter', () => {
    const result = JulesListSessionsSchema.parse({ state: 'completed' });
    expect(result.state).toBe('completed');
  });

  it('rejects invalid state', () => {
    expect(() => JulesListSessionsSchema.parse({ state: 'invalid' })).toThrow();
  });

  it('accepts limit within range', () => {
    expect(JulesListSessionsSchema.parse({ limit: 1 }).limit).toBe(1);
    expect(JulesListSessionsSchema.parse({ limit: 200 }).limit).toBe(200);
  });

  it('rejects limit out of range', () => {
    expect(() => JulesListSessionsSchema.parse({ limit: 0 })).toThrow();
    expect(() => JulesListSessionsSchema.parse({ limit: 201 })).toThrow();
  });

  it('rejects non-integer limit', () => {
    expect(() => JulesListSessionsSchema.parse({ limit: 1.5 })).toThrow();
  });
});

describe('JulesGetSessionSchema', () => {
  it('accepts valid sessionId', () => {
    expect(JulesGetSessionSchema.parse({ sessionId: 'abc-123' }).sessionId).toBe('abc-123');
  });

  it('rejects empty sessionId', () => {
    expect(() => JulesGetSessionSchema.parse({ sessionId: '' })).toThrow();
  });

  it('rejects missing sessionId', () => {
    expect(() => JulesGetSessionSchema.parse({})).toThrow();
  });
});

describe('JulesGetActivitiesSchema', () => {
  it('accepts minimal input with defaults', () => {
    const result = JulesGetActivitiesSchema.parse({ sessionId: 's1' });
    expect(result.sessionId).toBe('s1');
    expect(result.limit).toBe(50);
    expect(result.type).toBeUndefined();
    expect(result.since).toBeUndefined();
  });

  it('accepts valid type filter', () => {
    const result = JulesGetActivitiesSchema.parse({ sessionId: 's1', type: 'bash_output' });
    expect(result.type).toBe('bash_output');
  });

  it('rejects invalid type', () => {
    expect(() => JulesGetActivitiesSchema.parse({ sessionId: 's1', type: 'unknown' })).toThrow();
  });

  it('accepts since parameter', () => {
    const result = JulesGetActivitiesSchema.parse({ sessionId: 's1', since: '2026-01-01T00:00:00Z' });
    expect(result.since).toBe('2026-01-01T00:00:00Z');
  });
});

describe('JulesApprovePlanSchema', () => {
  it('accepts valid sessionId', () => {
    expect(JulesApprovePlanSchema.parse({ sessionId: 'plan-1' }).sessionId).toBe('plan-1');
  });

  it('rejects empty sessionId', () => {
    expect(() => JulesApprovePlanSchema.parse({ sessionId: '' })).toThrow();
  });
});

describe('JulesSendMessageSchema', () => {
  it('accepts minimal input with defaults', () => {
    const result = JulesSendMessageSchema.parse({ sessionId: 's1', message: 'Hello' });
    expect(result.waitForReply).toBe(true);
    expect(result.waitTimeout).toBe(120);
  });

  it('rejects empty message', () => {
    expect(() => JulesSendMessageSchema.parse({ sessionId: 's1', message: '' })).toThrow();
  });

  it('accepts custom timeout', () => {
    const result = JulesSendMessageSchema.parse({ sessionId: 's1', message: 'Hi', waitTimeout: 300 });
    expect(result.waitTimeout).toBe(300);
  });

  it('rejects timeout out of range', () => {
    expect(() => JulesSendMessageSchema.parse({ sessionId: 's1', message: 'Hi', waitTimeout: 0 })).toThrow();
    expect(() => JulesSendMessageSchema.parse({ sessionId: 's1', message: 'Hi', waitTimeout: 601 })).toThrow();
  });
});

describe('JulesGetDiffSchema', () => {
  it('accepts sessionId only', () => {
    const result = JulesGetDiffSchema.parse({ sessionId: 's1' });
    expect(result.sessionId).toBe('s1');
    expect(result.file).toBeUndefined();
  });

  it('accepts sessionId with file filter', () => {
    const result = JulesGetDiffSchema.parse({ sessionId: 's1', file: 'src/index.ts' });
    expect(result.file).toBe('src/index.ts');
  });
});

describe('JulesGetBashOutputsSchema', () => {
  it('accepts valid input with defaults', () => {
    const result = JulesGetBashOutputsSchema.parse({ sessionId: 's1' });
    expect(result.limit).toBe(50);
  });
});

describe('JulesDashboardSchema', () => {
  it('accepts empty input with defaults', () => {
    const result = JulesDashboardSchema.parse({});
    expect(result.includeCompleted).toBe(false);
    expect(result.hours).toBe(24);
  });

  it('accepts custom hours', () => {
    const result = JulesDashboardSchema.parse({ hours: 72 });
    expect(result.hours).toBe(72);
  });

  it('rejects hours out of range', () => {
    expect(() => JulesDashboardSchema.parse({ hours: 0 })).toThrow();
    expect(() => JulesDashboardSchema.parse({ hours: 721 })).toThrow();
  });
});

describe('JulesStatusSchema', () => {
  it('accepts empty input', () => {
    expect(JulesStatusSchema.parse({})).toEqual({});
  });
});

describe('JulesPollSchema', () => {
  it('accepts empty input with defaults', () => {
    const result = JulesPollSchema.parse({});
    expect(result.syncPRs).toBe(true);
    expect(result.sessionIds).toBeUndefined();
  });

  it('accepts session IDs array', () => {
    const result = JulesPollSchema.parse({ sessionIds: ['s1', 's2'] });
    expect(result.sessionIds).toEqual(['s1', 's2']);
  });
});

describe('JulesDetectStallsSchema', () => {
  it('accepts empty input', () => {
    expect(JulesDetectStallsSchema.parse({})).toEqual({});
  });
});

describe('RepoSyncSchema', () => {
  it('accepts empty input with defaults', () => {
    const result = RepoSyncSchema.parse({});
    expect(result.all).toBe(false);
    expect(result.repos).toBeUndefined();
  });

  it('accepts repos list with valid format', () => {
    const result = RepoSyncSchema.parse({ repos: ['owner/repo', 'org/project'] });
    expect(result.repos).toEqual(['owner/repo', 'org/project']);
  });

  it('rejects repos with invalid format', () => {
    expect(() => RepoSyncSchema.parse({ repos: ['invalid'] })).toThrow();
  });

  it('accepts all flag', () => {
    const result = RepoSyncSchema.parse({ all: true });
    expect(result.all).toBe(true);
  });
});

describe('PrReviewStatusSchema_Tool', () => {
  it('accepts prUrl', () => {
    const result = PrReviewStatusSchema_Tool.parse({ prUrl: 'https://github.com/o/r/pull/1' });
    expect(result.prUrl).toBe('https://github.com/o/r/pull/1');
  });

  it('accepts sessionId', () => {
    const result = PrReviewStatusSchema_Tool.parse({ sessionId: 's1' });
    expect(result.sessionId).toBe('s1');
  });

  it('accepts empty input', () => {
    const result = PrReviewStatusSchema_Tool.parse({});
    expect(result.prUrl).toBeUndefined();
  });

  it('rejects invalid URL', () => {
    expect(() => PrReviewStatusSchema_Tool.parse({ prUrl: 'not-a-url' })).toThrow();
  });
});

describe('PrUpdateReviewSchema', () => {
  it('accepts prUrl with status', () => {
    const result = PrUpdateReviewSchema.parse({
      prUrl: 'https://github.com/o/r/pull/1',
      status: 'approved',
    });
    expect(result.status).toBe('approved');
  });

  it('accepts prUrl with notes', () => {
    const result = PrUpdateReviewSchema.parse({
      prUrl: 'https://github.com/o/r/pull/1',
      notes: 'Looks good',
    });
    expect(result.notes).toBe('Looks good');
  });

  it('rejects missing prUrl', () => {
    expect(() => PrUpdateReviewSchema.parse({ status: 'approved' })).toThrow();
  });

  it('rejects invalid status', () => {
    expect(() => PrUpdateReviewSchema.parse({
      prUrl: 'https://github.com/o/r/pull/1',
      status: 'invalid',
    })).toThrow();
  });
});

describe('PrCheckAutoMergeSchema', () => {
  it('accepts valid PR URL', () => {
    const result = PrCheckAutoMergeSchema.parse({ prUrl: 'https://github.com/o/r/pull/1' });
    expect(result.prUrl).toBe('https://github.com/o/r/pull/1');
  });

  it('rejects missing prUrl', () => {
    expect(() => PrCheckAutoMergeSchema.parse({})).toThrow();
  });
});

describe('PrMergeSchema', () => {
  it('accepts minimal input with defaults', () => {
    const result = PrMergeSchema.parse({ prUrl: 'https://github.com/o/r/pull/1' });
    expect(result.method).toBe('merge');
    expect(result.force).toBe(false);
    expect(result.confirm).toBe(false);
    expect(result.expectedHeadSha).toBeUndefined();
  });

  it('accepts all parameters', () => {
    const result = PrMergeSchema.parse({
      prUrl: 'https://github.com/o/r/pull/1',
      method: 'squash',
      force: true,
      confirm: true,
      expectedHeadSha: 'abc123',
    });
    expect(result.method).toBe('squash');
    expect(result.force).toBe(true);
    expect(result.confirm).toBe(true);
    expect(result.expectedHeadSha).toBe('abc123');
  });

  it('rejects invalid merge method', () => {
    expect(() => PrMergeSchema.parse({
      prUrl: 'https://github.com/o/r/pull/1',
      method: 'fast-forward',
    })).toThrow();
  });

  it('rejects missing prUrl', () => {
    expect(() => PrMergeSchema.parse({ method: 'merge' })).toThrow();
  });
});

describe('PrReviewsListSchema', () => {
  it('accepts empty input with defaults', () => {
    const result = PrReviewsListSchema.parse({});
    expect(result.limit).toBe(50);
    expect(result.repoId).toBeUndefined();
    expect(result.status).toBeUndefined();
  });

  it('accepts status filter', () => {
    const result = PrReviewsListSchema.parse({ status: 'pending' });
    expect(result.status).toBe('pending');
  });

  it('rejects invalid status', () => {
    expect(() => PrReviewsListSchema.parse({ status: 'merged' })).toThrow();
  });
});

describe('ReposListSchema', () => {
  it('accepts empty input with defaults', () => {
    const result = ReposListSchema.parse({});
    expect(result.connectedOnly).toBe(false);
    expect(result.limit).toBe(50);
  });

  it('accepts connectedOnly flag', () => {
    const result = ReposListSchema.parse({ connectedOnly: true });
    expect(result.connectedOnly).toBe(true);
  });
});

describe('HealthCheckSchema', () => {
  it('accepts empty input', () => {
    expect(HealthCheckSchema.parse({})).toEqual({});
  });
});

// ─── Tool Schema Map ──────────────────────────────────────────────────────────

describe('toolSchemas map', () => {
  const expectedTools = [
    'jules_create_session',
    'jules_list_sessions',
    'jules_get_session',
    'jules_get_activities',
    'jules_approve_plan',
    'jules_send_message',
    'jules_get_diff',
    'jules_get_bash_outputs',
    'jules_dashboard',
    'jules_status',
    'jules_poll',
    'jules_detect_stalls',
    'jules_repo_sync',
    'pr_review_status',
    'pr_update_review',
    'pr_check_auto_merge',
    'pr_merge',
  ];

  it('contains all expected tool schemas', () => {
    for (const name of expectedTools) {
      expect(toolSchemas).toHaveProperty(name);
    }
  });

  it('each schema can parse empty object or has required fields', () => {
    // Schemas with no required fields should accept {}
    const noRequiredFields = ['jules_list_sessions', 'jules_dashboard', 'jules_status', 'jules_poll', 'jules_detect_stalls', 'jules_repo_sync', 'pr_review_status'];
    for (const name of noRequiredFields) {
      const schema = toolSchemas[name as keyof typeof toolSchemas];
      expect(() => schema.parse({})).not.toThrow();
    }
  });
});
