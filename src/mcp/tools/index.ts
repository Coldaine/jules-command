/**
 * MCP Tool registry.
 */

import type { Config } from '../../config.js';
import type { Db } from '../../db/index.js';
import { SessionRepository } from '../../db/repositories/session.repo.js';
import { ActivityRepository } from '../../db/repositories/activity.repo.js';
import { PrReviewRepository } from '../../db/repositories/pr-review.repo.js';
import { AutoMergeEvaluator } from '../../services/auto-merge.js';
import { DashboardService } from '../../services/dashboard.js';
import { toolSchemas, type ToolName, sessionStateSchema } from './schemas.js';

export interface ToolContext {
  config: Config;
  db: Db;
}

export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  name: ToolName;
  description: string;
  inputSchema: Record<string, unknown>;
  zodSchema: typeof toolSchemas[ToolName];
  handler: (args: TInput, context: ToolContext) => Promise<TOutput>;
  destructiveHint?: boolean;
}

function notImplemented(name: string): never {
  throw new Error(`${name} not implemented`);
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'jules_create_session',
    description: 'Create a new Jules task. Persists to local DB.',
    inputSchema: { type: 'object', properties: { prompt: { type: 'string' }, repo: { type: 'string' }, branch: { type: 'string' }, autoPr: { type: 'boolean' }, requireApproval: { type: 'boolean' }, title: { type: 'string' } }, required: ['prompt'] },
    zodSchema: toolSchemas.jules_create_session,
    handler: async () => notImplemented('jules_create_session'),
  },
  {
    name: 'jules_list_sessions',
    description: 'List sessions, optionally filtered by state or repo.',
    inputSchema: { type: 'object', properties: { state: { type: 'string', enum: sessionStateSchema.options }, repo: { type: 'string' }, limit: { type: 'number' }, fromDb: { type: 'boolean' } } },
    zodSchema: toolSchemas.jules_list_sessions,
    handler: async (args: unknown, context) => {
      const parsed = toolSchemas.jules_list_sessions.parse(args);
      const repo = new SessionRepository(context.db);
      if (parsed.state) {
        return repo.findByState(parsed.state);
      }
      if (parsed.repo) {
        return repo.findByRepoId(parsed.repo, parsed.limit ?? 50);
      }
      return repo.findAll(parsed.limit);
    },
  },
  {
    name: 'jules_get_session',
    description: 'Get detailed info for one session. Syncs to DB.',
    inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] },
    zodSchema: toolSchemas.jules_get_session,
    handler: async () => notImplemented('jules_get_session'),
  },
  {
    name: 'jules_get_activities',
    description: 'Get activities for a session.',
    inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, type: { type: 'string', enum: ['message', 'plan', 'bash_output', 'file_change', 'error'] }, limit: { type: 'number' }, since: { type: 'string' } }, required: ['sessionId'] },
    zodSchema: toolSchemas.jules_get_activities,
    handler: async (args: unknown, context) => {
      const parsed = toolSchemas.jules_get_activities.parse(args);
      const repo = new ActivityRepository(context.db);
      if (parsed.since) {
        return repo.findSince(parsed.sessionId, parsed.since, parsed.limit ?? 50);
      }
      if (parsed.type) {
        return repo.findBySessionAndType(parsed.sessionId, parsed.type, parsed.limit ?? 50);
      }
      return repo.findBySessionId(parsed.sessionId, parsed.limit ?? 50);
    },
  },
  { name: 'jules_approve_plan', description: 'Approve a pending plan.', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] }, zodSchema: toolSchemas.jules_approve_plan, handler: async () => notImplemented('jules_approve_plan') },
  { name: 'jules_send_message', description: 'Send a message to Jules in a session.', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, message: { type: 'string' }, waitForReply: { type: 'boolean' }, waitTimeout: { type: 'number' } }, required: ['sessionId', 'message'] }, zodSchema: toolSchemas.jules_send_message, handler: async () => notImplemented('jules_send_message') },
  { name: 'jules_get_diff', description: 'Get code diff for a session.', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' }, file: { type: 'string' } }, required: ['sessionId'] }, zodSchema: toolSchemas.jules_get_diff, handler: async () => notImplemented('jules_get_diff') },
  { name: 'jules_get_bash_outputs', description: 'Get bash command outputs from a session.', inputSchema: { type: 'object', properties: { sessionId: { type: 'string' } }, required: ['sessionId'] }, zodSchema: toolSchemas.jules_get_bash_outputs, handler: async () => notImplemented('jules_get_bash_outputs') },
  {
    name: 'jules_dashboard',
    description: 'Comprehensive status dashboard of all Jules work.',
    inputSchema: { type: 'object', properties: { includeCompleted: { type: 'boolean' }, hours: { type: 'number' } } },
    zodSchema: toolSchemas.jules_dashboard,
    handler: async (args: unknown, context) => {
      const parsed = toolSchemas.jules_dashboard.parse(args);
      return new DashboardService(context.db, context.config).generate(parsed);
    },
  },
  {
    name: 'jules_status',
    description: 'Quick compact status of all non-terminal sessions.',
    inputSchema: { type: 'object', properties: {} },
    zodSchema: toolSchemas.jules_status,
    handler: async (_args: unknown, context) => {
      const active = await new SessionRepository(context.db).findActive();
      const stalled = active.filter((session) => Boolean(session.stallDetectedAt));
      return {
        active: active.length,
        stalled: stalled.length,
        sessions: active.slice(0, 10).map((session) => ({
          id: session.id,
          title: session.title,
          state: session.state,
          stallReason: session.stallReason,
        })),
      };
    },
  },
  { name: 'jules_poll', description: 'Run a polling cycle — sync active sessions to DB.', inputSchema: { type: 'object', properties: { sessionIds: { type: 'array', items: { type: 'string' } }, syncPRs: { type: 'boolean' } } }, zodSchema: toolSchemas.jules_poll, handler: async () => notImplemented('jules_poll') },
  { name: 'jules_detect_stalls', description: 'Analyze sessions for stall patterns.', inputSchema: { type: 'object', properties: {} }, zodSchema: toolSchemas.jules_detect_stalls, handler: async () => notImplemented('jules_detect_stalls') },
  {
    name: 'jules_sessions_by_state',
    description: 'List sessions by state using safe filtering.',
    inputSchema: { type: 'object', properties: { state: { type: 'string', enum: ['queued', 'planning', 'in_progress', 'completed', 'failed', 'awaiting_plan_approval', 'awaiting_user_feedback'] }, limit: { type: 'number' } }, required: ['state'] },
    zodSchema: toolSchemas.jules_sessions_by_state,
    handler: async (args: unknown, context) => {
      const parsed = toolSchemas.jules_sessions_by_state.parse(args);
      const sessions = await new SessionRepository(context.db).findByState(parsed.state);
      return sessions.slice(0, parsed.limit ?? 50);
    },
  },
  {
    name: 'jules_sessions_by_repo',
    description: 'List sessions by repository id using safe filtering.',
    inputSchema: { type: 'object', properties: { repoId: { type: 'string' }, limit: { type: 'number' } }, required: ['repoId'] },
    zodSchema: toolSchemas.jules_sessions_by_repo,
    handler: async (args: unknown, context) => {
      const parsed = toolSchemas.jules_sessions_by_repo.parse(args);
      return new SessionRepository(context.db).findByRepoId(parsed.repoId, parsed.limit ?? 50);
    },
  },
  {
    name: 'jules_recent_activities',
    description: 'Get recent activities with optional type filtering.',
    inputSchema: { type: 'object', properties: { type: { type: 'string', enum: ['message', 'plan', 'bash_output', 'file_change', 'error'] }, limit: { type: 'number' } } },
    zodSchema: toolSchemas.jules_recent_activities,
    handler: async (args: unknown, context) => {
      const parsed = toolSchemas.jules_recent_activities.parse(args);
      return new ActivityRepository(context.db).findRecent(parsed.limit ?? 50, parsed.type);
    },
  },
  {
    name: 'pr_list_pending',
    description: 'List pending PR review rows with optional status filtering.',
    inputSchema: { type: 'object', properties: { statuses: { type: 'array', items: { type: 'string', enum: ['pending', 'approved', 'changes_requested', 'closed'] } }, limit: { type: 'number' } } },
    zodSchema: toolSchemas.pr_list_pending,
    handler: async (args: unknown, context) => {
      const parsed = toolSchemas.pr_list_pending.parse(args);
      const repo = new PrReviewRepository(context.db);
      const statuses = parsed.statuses && parsed.statuses.length > 0 ? parsed.statuses : ['pending'];
      const rows = await repo.findByReviewStatuses(statuses);
      return rows.slice(0, parsed.limit ?? 50);
    },
  },
  { name: 'jules_repo_sync', description: 'Sync GitHub repo metadata to local DB.', inputSchema: { type: 'object', properties: { repos: { type: 'array', items: { type: 'string' } }, all: { type: 'boolean' } } }, zodSchema: toolSchemas.jules_repo_sync, handler: async () => notImplemented('jules_repo_sync') },
  { name: 'pr_review_status', description: 'Get PR review tracking info.', inputSchema: { type: 'object', properties: { prUrl: { type: 'string' }, sessionId: { type: 'string' }, repo: { type: 'string' } } }, zodSchema: toolSchemas.pr_review_status, handler: async () => notImplemented('pr_review_status') },
  { name: 'pr_update_review', description: 'Update PR review status or notes.', inputSchema: { type: 'object', properties: { prUrl: { type: 'string' }, status: { type: 'string', enum: ['pending', 'approved', 'changes_requested', 'closed'] }, notes: { type: 'string' } }, required: ['prUrl'] }, zodSchema: toolSchemas.pr_update_review, handler: async () => notImplemented('pr_update_review') },
  { name: 'pr_check_auto_merge', description: 'Evaluate auto-merge eligibility for pending PRs.', inputSchema: { type: 'object', properties: { prUrl: { type: 'string' } } }, zodSchema: toolSchemas.pr_check_auto_merge, handler: async () => notImplemented('pr_check_auto_merge') },
  {
    name: 'pr_merge',
    description: 'Merge an approved PR via GitHub API.',
    inputSchema: { type: 'object', properties: { prUrl: { type: 'string' }, method: { type: 'string', enum: ['merge', 'squash', 'rebase'] }, force: { type: 'boolean', default: false } }, required: ['prUrl'] },
    zodSchema: toolSchemas.pr_merge,
    destructiveHint: true,
    handler: async (args: unknown, context) => {
      const parsed = toolSchemas.pr_merge.parse(args);
      const prRepo = new PrReviewRepository(context.db);
      const pr = await prRepo.findByPrUrl(parsed.prUrl);

      if (!pr) {
        return { merged: false, reason: 'PR review row not found' };
      }

      if (!parsed.force) {
        const evaluation = new AutoMergeEvaluator(context.config).evaluate(pr);
        if (!evaluation.eligible) {
          return { merged: false, reason: 'PR not eligible for merge', reasons: evaluation.reasons };
        }
      }

      // TODO: Actually call GitHubService.mergePr() once implemented
      notImplemented('pr_merge (GitHub API call)');
    },
  },
];

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((tool) => tool.name === name);
}
