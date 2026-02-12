import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import * as schemas from './schemas.js';
import { julesSessions, julesActivities, prReviews, repos } from '../../db/schema.js';
import { PrReviewRepository } from '../../db/repositories/pr-review.repo.js';
import { AutoMergeEvaluator } from '../../services/auto-merge.js';
import { DashboardService } from '../../services/dashboard.js';
import { JulesService } from '../../services/jules.service.js';
import { GitHubService } from '../../services/github.service.js';
import { PollManager } from '../../services/poll-manager.js';
import { StallDetector } from '../../services/stall-detector.js';
import { ComplexityScorer } from '../../services/complexity-scorer.js';
import type { Db } from '../../db/index.js';
import type { Config } from '../../config.js';

export interface ToolContext {
  db: Db;
  config: Config;
  services: {
    jules: JulesService;
    github: GitHubService;
    stallDetector: StallDetector;
    complexityScorer: ComplexityScorer;
    autoMergeEvaluator: AutoMergeEvaluator;
    pollManager: PollManager;
    dashboard: DashboardService;
  };
}

export type ToolHandler<T = any> = (args: T, context: ToolContext) => Promise<any>;

export interface ToolDefinition<TInput = any> {
  name: schemas.ToolName;
  description: string;
  inputSchema: Record<string, unknown>;
  zodSchema: z.ZodSchema<TInput>;
  handler: ToolHandler<TInput>;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
}

// --- Handlers ---

const handleJulesCreateSession: ToolHandler<z.infer<typeof schemas.JulesCreateSessionSchema>> = async (args, { services }) => {
  return services.jules.createSession(args);
};

const handleJulesApprovePlan: ToolHandler<z.infer<typeof schemas.JulesApprovePlanSchema>> = async (args, { services }) => {
  await services.jules.approvePlan(args.sessionId);
  return { success: true };
};

const handleJulesSendMessage: ToolHandler<z.infer<typeof schemas.JulesSendMessageSchema>> = async (args, { services }) => {
  await services.jules.sendMessage(args.sessionId, args.message);
  return { success: true };
};

const handleJulesGetDiff: ToolHandler<z.infer<typeof schemas.JulesGetDiffSchema>> = async (args, { services }) => {
  return services.jules.getDiff(args.sessionId, args.file);
};

const handleJulesGetBashOutputs: ToolHandler<z.infer<typeof schemas.JulesGetBashOutputsSchema>> = async (args, { services }) => {
  return services.jules.getBashOutputs(args.sessionId);
};

const handleRepoSync: ToolHandler<z.infer<typeof schemas.RepoSyncSchema>> = async (args, { services }) => {
  if (args.all) {
    await services.github.syncAllRepos();
  } else if (args.repos) {
    for (const repo of args.repos) {
      const parts = repo.split('/');
      if (parts.length === 2) {
        const [owner, name] = parts as [string, string];
        await services.github.syncRepoMetadata(owner, name);
      }
    }
  }
  return { success: true };
};

const handlePrReviewStatus: ToolHandler<z.infer<typeof schemas.PrReviewStatusSchema_Tool>> = async (args, { db, services }) => {
  if (args.prUrl) {
    await services.github.syncPrStatus(args.prUrl);
    const prRepo = new PrReviewRepository(db);
    return prRepo.findByPrUrl(args.prUrl);
  }
  return { error: 'prUrl is required for sync' };
};

const handlePrMerge: ToolHandler<z.infer<typeof schemas.PrMergeSchema>> = async (args, { config, db, services }) => {
  const { prUrl, method, force, confirm } = args;

  if (!confirm && !force) {
    return {
      content: [{ type: 'text', text: 'Merge requires confirmation. Please set confirm: true or force: true.' }],
      isError: true,
    };
  }

  const prRepo = new PrReviewRepository(db);
  const pr = await prRepo.findByPrUrl(prUrl);

  if (!pr && !force) {
    return { merged: false, reason: 'PR review row not found' };
  }

  if (!force && pr) {
    const evaluator = new AutoMergeEvaluator(config);
    const evaluation = evaluator.evaluate(pr);
    if (!evaluation.eligible) {
      return { merged: false, reason: 'PR not eligible for merge', reasons: evaluation.reasons };
    }
  }

  await services.github.mergePr(prUrl, method);
  return { success: true, merged: true };
};

const handleHealthCheck: ToolHandler = async (_args, { db }) => {
  const status: Record<string, any> = {
    database: 'ok',
    julesApi: 'pending',
    githubApi: 'pending',
  };

  try {
    const result = (db as any).get(sql`SELECT 1`);
    if (!result) status.database = 'error';
  } catch (_) {
    status.database = 'error';
  }

  return status;
};

const handleJulesDashboard: ToolHandler<z.infer<typeof schemas.JulesDashboardSchema>> = async (args, { services }) => {
  const dashboard = await services.dashboard.generate(args);
  return {
    content: [{ type: 'text', text: dashboard }],
  };
};

const handleJulesStatus: ToolHandler = async (_args, { services }) => {
  const dashboard = await services.dashboard.generate({ hours: 1 });
  return {
    content: [{ type: 'text', text: dashboard }],
  };
};

const handleJulesPoll: ToolHandler<z.infer<typeof schemas.JulesPollSchema>> = async (args, { services }) => {
  if (args.sessionIds && args.sessionIds.length > 0) {
    const results = [];
    for (const id of args.sessionIds) {
      results.push(await services.pollManager.pollSession(id));
    }
    return { results };
  }
  return services.pollManager.pollAllActive();
};

const handleJulesDetectStalls: ToolHandler = async (_args, { services }) => {
  const summary = await services.pollManager.pollAllActive();
  return {
    stalls: summary.stallsDetected,
    count: summary.stallsDetected.length,
  };
};

const handlePrUpdateReview: ToolHandler<z.infer<typeof schemas.PrUpdateReviewSchema>> = async (args, { db }) => {
  const prRepo = new PrReviewRepository(db);
  const pr = await prRepo.findByPrUrl(args.prUrl);

  if (!pr) {
    // If PR doesn't exist, we need to create a minimal record with required fields
    // The prUrl should contain owner/repo/number format
    const urlParts = args.prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!urlParts) {
      throw new Error(`Invalid PR URL format: ${args.prUrl}`);
    }
    const [, owner, repo, prNumber] = urlParts;
    const repoId = `${owner}/${repo}`;

    await prRepo.upsert({
      prUrl: args.prUrl,
      repoId,
      prNumber: parseInt(prNumber!, 10),
      reviewStatus: args.status,
      reviewNotes: args.notes,
    });
  } else {
    // Update existing record
    await prRepo.upsert({
      ...pr,
      reviewStatus: args.status,
      reviewNotes: args.notes,
    });
  }

  return { success: true };
};

const handlePrCheckAutoMerge: ToolHandler<z.infer<typeof schemas.PrCheckAutoMergeSchema>> = async (args, { config, db }) => {
  const prRepo = new PrReviewRepository(db);
  const pr = await prRepo.findByPrUrl(args.prUrl);
  if (!pr) return { eligible: false, reason: 'PR not tracked' };

  const evaluator = new AutoMergeEvaluator(config);
  return evaluator.evaluate(pr);
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

const handleJulesSessionGet: ToolHandler<z.infer<typeof schemas.JulesSessionGetSchema>> = async ({ sessionId }, { services }) => {
  return services.jules.getSession(sessionId);
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
    handler: handleJulesCreateSession,
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
    handler: handleJulesApprovePlan,
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
    handler: handleJulesSendMessage,
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
    handler: handleJulesGetDiff,
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
    handler: handleJulesGetBashOutputs,
    readOnlyHint: true,
  },
  {
    name: 'jules_dashboard',
    description: 'Comprehensive status dashboard of all Jules work.',
    inputSchema: {
      type: 'object',
      properties: {
        includeCompleted: { type: 'boolean' },
        hours: { type: 'number' },
      },
    },
    zodSchema: schemas.JulesDashboardSchema,
    handler: handleJulesDashboard,
    readOnlyHint: true,
  },
  {
    name: 'jules_status',
    description: 'Quick compact status of all non-terminal sessions.',
    inputSchema: { type: 'object', properties: {} },
    zodSchema: schemas.JulesStatusSchema,
    handler: handleJulesStatus,
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
    handler: handleJulesPoll,
  },
  {
    name: 'jules_detect_stalls',
    description: 'Analyze sessions for stall patterns.',
    inputSchema: { type: 'object', properties: {} },
    zodSchema: schemas.JulesDetectStallsSchema,
    handler: handleJulesDetectStalls,
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
    handler: handleRepoSync,
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
    handler: handlePrReviewStatus,
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
    handler: handlePrUpdateReview,
  },
  {
    name: 'pr_check_auto_merge',
    description: 'Evaluate auto-merge eligibility for pending PRs.',
    inputSchema: {
      type: 'object',
      properties: { prUrl: { type: 'string' } },
    },
    zodSchema: schemas.PrCheckAutoMergeSchema,
    handler: handlePrCheckAutoMerge,
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

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return TOOL_DEFINITIONS.find((tool) => tool.name === name);
}
