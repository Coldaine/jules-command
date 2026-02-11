import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import * as schemas from './schemas.js';
import { julesSessions, julesActivities, prReviews, repos } from '../../db/schema.js';
import type { Db } from '../../db/index.js';

export interface ToolContext {
  db: Db;
  services: {
    jules: any;
    github: any;
    stallDetector: any;
    complexityScorer: any;
    autoMergeEvaluator: any;
    pollManager: any;
    dashboard: any;
  };
  config: any;
}

export type ToolHandler<T = any> = (args: T, context: ToolContext) => Promise<any>;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  zodSchema: z.ZodSchema<any>;
  handler: ToolHandler;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
}

// --- Handlers ---

const handleNotImplemented: ToolHandler = async (_args, _context) => {
  return {
    content: [{ type: 'text', text: 'This tool is not yet fully implemented.' }],
  };
};

const handleJulesSessionsList: ToolHandler<z.infer<typeof schemas.JulesSessionsListSchema>> = async (args, { db }) => {
  const { state, repo, limit } = args;
  const conditions = [];
  if (state) conditions.push(eq(julesSessions.state, state));
  if (repo) conditions.push(eq(julesSessions.repoId, repo));

  let query = db.select().from(julesSessions);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  return query.orderBy(desc(julesSessions.createdAt)).limit(limit);
};

const handleJulesSessionGet: ToolHandler<z.infer<typeof schemas.JulesSessionGetSchema>> = async ({ sessionId }, { db }) => {
  const result = await db.select().from(julesSessions).where(eq(julesSessions.id, sessionId)).limit(1);
  return result[0] || { error: 'Session not found' };
};

const handleJulesActivitiesList: ToolHandler<z.infer<typeof schemas.JulesActivitiesListSchema>> = async (args, { db }) => {
  const { sessionId, type, limit, since } = args;
  const conditions = [eq(julesActivities.sessionId, sessionId)];
  if (type) conditions.push(eq(julesActivities.activityType, type));
  if (since) conditions.push(sql`datetime(${julesActivities.timestamp}) >= datetime(${since})`);

  return db.select()
    .from(julesActivities)
    .where(and(...conditions))
    .orderBy(desc(julesActivities.timestamp))
    .limit(limit);
};

const handlePrReviewsList: ToolHandler<z.infer<typeof schemas.PrReviewsListSchema>> = async (args, { db }) => {
  const { repoId, status, limit } = args;
  const conditions = [];
  if (repoId) conditions.push(eq(prReviews.repoId, repoId));
  if (status) conditions.push(eq(prReviews.reviewStatus, status));

  let query = db.select().from(prReviews);
  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as any;
  }
  return query.orderBy(desc(prReviews.prCreatedAt)).limit(limit);
};

const handleReposList: ToolHandler<z.infer<typeof schemas.ReposListSchema>> = async ({ connectedOnly, limit }, { db }) => {
  let query = db.select().from(repos);
  if (connectedOnly) {
    query = query.where(eq(repos.julesConnected, true)) as any;
  }
  return query.orderBy(desc(repos.stars)).limit(limit);
};

const handlePrMerge: ToolHandler<z.infer<typeof schemas.PrMergeSchema>> = async (args, _context) => {
  const { prUrl, method, force, confirm, expectedHeadSha: _expectedHeadSha } = args;

  if (!confirm && !force) {
    return {
      content: [{ type: 'text', text: 'Merge requires confirmation. Please set confirm: true or force: true.' }],
      isError: true,
    };
  }

  return {
    content: [{ type: 'text', text: `[PLACEHOLDER] Merging ${prUrl} via ${method} (force=${force})` }],
  };
};

const handleHealthCheck: ToolHandler = async (_args, { db }) => {
  const status: Record<string, any> = {
    database: 'ok',
    julesApi: 'pending',
    githubApi: 'pending',
  };

  try {
    await db.run(sql`SELECT 1`);
  } catch (_) {
    status.database = 'error';
  }

  return status;
};

// --- Definitions ---

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'jules_create_session',
    description: 'Create a new Jules task. Persists to local DB.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Task description' },
        repo: { type: 'string', description: 'owner/name (omit for repoless)' },
        branch: { type: 'string', description: 'Starting branch' },
        autoPr: { type: 'boolean', description: 'Auto-create PR (default: true)' },
        requireApproval: { type: 'boolean', description: 'Require plan approval (default: false)' },
        title: { type: 'string', description: 'Session title' },
      },
      required: ['prompt'],
    },
    zodSchema: schemas.JulesCreateSessionSchema,
    handler: handleNotImplemented,
  },
  {
    name: 'jules_sessions_list',
    description: 'List sessions from local DB, optionally filtered.',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'string', enum: schemas.SessionStateSchema.options },
        repo: { type: 'string' },
        limit: { type: 'number' },
      },
    },
    zodSchema: schemas.JulesSessionsListSchema,
    handler: handleJulesSessionsList,
    readOnlyHint: true,
  },
  {
    name: 'jules_session_get',
    description: 'Get detailed info for one session from local DB.',
    inputSchema: {
      type: 'object',
      properties: { sessionId: { type: 'string' } },
      required: ['sessionId'],
    },
    zodSchema: schemas.JulesSessionGetSchema,
    handler: handleJulesSessionGet,
    readOnlyHint: true,
  },
  {
    name: 'jules_activities_list',
    description: 'Get activities for a session from local DB.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        type: { type: 'string', enum: schemas.ActivityTypeSchema.options },
        limit: { type: 'number' },
        since: { type: 'string' },
      },
      required: ['sessionId'],
    },
    zodSchema: schemas.JulesActivitiesListSchema,
    handler: handleJulesActivitiesList,
    readOnlyHint: true,
  },
  {
    name: 'jules_approve_plan',
    description: 'Approve a pending plan.',
    inputSchema: {
      type: 'object',
      properties: { sessionId: { type: 'string' } },
      required: ['sessionId'],
    },
    zodSchema: schemas.JulesApprovePlanSchema,
    handler: handleNotImplemented,
    idempotentHint: true,
  },
  {
    name: 'jules_send_message',
    description: 'Send a message to Jules in a session.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        message: { type: 'string' },
        waitForReply: { type: 'boolean' },
        waitTimeout: { type: 'number', description: 'Seconds to wait (max 600)' },
      },
      required: ['sessionId', 'message'],
    },
    zodSchema: schemas.JulesSendMessageSchema,
    handler: handleNotImplemented,
  },
  {
    name: 'jules_get_diff',
    description: 'Get code diff for a session.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
        file: { type: 'string' },
      },
      required: ['sessionId'],
    },
    zodSchema: schemas.JulesGetDiffSchema,
    handler: handleNotImplemented,
    readOnlyHint: true,
  },
  {
    name: 'jules_get_bash_outputs',
    description: 'Get bash command outputs from a session.',
    inputSchema: {
      type: 'object',
      properties: { sessionId: { type: 'string' } },
      required: ['sessionId'],
    },
    zodSchema: schemas.JulesGetBashOutputsSchema,
    handler: handleNotImplemented,
    readOnlyHint: true,
  },
  {
    name: 'jules_dashboard',
    description: 'Comprehensive status dashboard of all Jules work.',
    inputSchema: {
      type: 'object',
      properties: {
        includeCompleted: { type: 'boolean' },
        hours: { type: 'number', description: 'Lookback window in hours' },
      },
    },
    zodSchema: schemas.JulesDashboardSchema,
    handler: handleNotImplemented,
    readOnlyHint: true,
  },
  {
    name: 'jules_status',
    description: 'Quick compact status of all non-terminal sessions.',
    inputSchema: { type: 'object', properties: {} },
    zodSchema: schemas.JulesStatusSchema,
    handler: handleNotImplemented,
    readOnlyHint: true,
  },
  {
    name: 'jules_poll',
    description: 'Run a polling cycle — sync active sessions to DB.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionIds: { type: 'array', items: { type: 'string' } },
        syncPRs: { type: 'boolean' },
      },
    },
    zodSchema: schemas.JulesPollSchema,
    handler: handleNotImplemented,
  },
  {
    name: 'jules_detect_stalls',
    description: 'Analyze sessions for stall patterns.',
    inputSchema: { type: 'object', properties: {} },
    zodSchema: schemas.JulesDetectStallsSchema,
    handler: handleNotImplemented,
    readOnlyHint: true,
  },
  {
    name: 'jules_repo_sync',
    description: 'Sync GitHub repo metadata to local DB.',
    inputSchema: {
      type: 'object',
      properties: {
        repos: { type: 'array', items: { type: 'string' } },
        all: { type: 'boolean' },
      },
    },
    zodSchema: schemas.RepoSyncSchema,
    handler: handleNotImplemented,
  },
  {
    name: 'pr_reviews_list',
    description: 'List PR reviews from local DB, optionally filtered.',
    inputSchema: {
      type: 'object',
      properties: {
        repoId: { type: 'string' },
        status: { type: 'string', enum: schemas.PrReviewStatusSchema.options },
        limit: { type: 'number' },
      },
    },
    zodSchema: schemas.PrReviewsListSchema,
    handler: handlePrReviewsList,
    readOnlyHint: true,
  },
  {
    name: 'repos_list',
    description: 'List repositories from local DB.',
    inputSchema: {
      type: 'object',
      properties: {
        connectedOnly: { type: 'boolean' },
        limit: { type: 'number' },
      },
    },
    zodSchema: schemas.ReposListSchema,
    handler: handleReposList,
    readOnlyHint: true,
  },
  {
    name: 'pr_review_status',
    description: 'Get PR review tracking info.',
    inputSchema: {
      type: 'object',
      properties: {
        prUrl: { type: 'string' },
        sessionId: { type: 'string' },
        repo: { type: 'string' },
      },
    },
    zodSchema: schemas.PrReviewStatusSchema_Tool,
    handler: handleNotImplemented,
    readOnlyHint: true,
  },
  {
    name: 'pr_update_review',
    description: 'Update PR review status or notes.',
    inputSchema: {
      type: 'object',
      properties: {
        prUrl: { type: 'string' },
        status: { type: 'string', enum: schemas.PrReviewStatusSchema.options },
        notes: { type: 'string' },
      },
      required: ['prUrl'],
    },
    zodSchema: schemas.PrUpdateReviewSchema,
    handler: handleNotImplemented,
  },
  {
    name: 'pr_check_auto_merge',
    description: 'Evaluate auto-merge eligibility for pending PRs.',
    inputSchema: {
      type: 'object',
      properties: { prUrl: { type: 'string' } },
    },
    zodSchema: schemas.PrCheckAutoMergeSchema,
    handler: handleNotImplemented,
    readOnlyHint: true,
  },
  {
    name: 'pr_merge',
    description: 'Merge an approved PR via GitHub API.',
    inputSchema: {
      type: 'object',
      properties: {
        prUrl: { type: 'string' },
        method: { type: 'string', enum: schemas.MergeMethodSchema.options },
        force: { type: 'boolean', description: 'Skip eligibility checks' },
        confirm: { type: 'boolean', description: 'Confirm merge' },
        expectedHeadSha: { type: 'string', description: 'Sha to verify before merge' },
      },
      required: ['prUrl'],
    },
    zodSchema: schemas.PrMergeSchema,
    handler: handlePrMerge,
    destructiveHint: true,
  },
  {
    name: 'jules_health',
    description: 'Check health of database and API connections.',
    inputSchema: { type: 'object', properties: {} },
    zodSchema: schemas.HealthCheckSchema,
    handler: handleHealthCheck,
    readOnlyHint: true,
  },
];
