import { z } from 'zod';

// --- Enums ---

export const SessionStateSchema = z.enum([
  'queued',
  'planning',
  'in_progress',
  'completed',
  'failed',
  'awaiting_plan_approval',
  'awaiting_user_feedback',
]);

export const ActivityTypeSchema = z.enum([
  'message',
  'plan',
  'bash_output',
  'file_change',
  'error',
]);

export const PrReviewStatusSchema = z.enum([
  'pending',
  'approved',
  'changes_requested',
  'closed',
]);

export const MergeMethodSchema = z.enum(['merge', 'squash', 'rebase']);

// --- Tool Schemas ---

export const JulesCreateSessionSchema = z.object({
  prompt: z.string().min(1),
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/).optional(),
  branch: z.string().optional(),
  autoPr: z.boolean().default(true),
  requireApproval: z.boolean().default(false),
  title: z.string().optional(),
});

export const JulesListSessionsSchema = z.object({
  state: SessionStateSchema.optional(),
  repo: z.string().optional(),
  limit: z.number().int().min(1).max(200).default(50),
  fromDb: z.boolean().default(true),
});

export const JulesGetSessionSchema = z.object({
  sessionId: z.string().min(1),
});

export const JulesGetActivitiesSchema = z.object({
  sessionId: z.string().min(1),
  type: ActivityTypeSchema.optional(),
  limit: z.number().int().min(1).max(200).default(50),
  since: z.string().optional(), // ISO date string
});

export const JulesApprovePlanSchema = z.object({
  sessionId: z.string().min(1),
});

export const JulesSendMessageSchema = z.object({
  sessionId: z.string().min(1),
  message: z.string().min(1),
  waitForReply: z.boolean().default(true),
  waitTimeout: z.number().int().min(1).max(600).default(120),
});

export const JulesGetDiffSchema = z.object({
  sessionId: z.string().min(1),
  file: z.string().optional(),
});

export const JulesGetBashOutputsSchema = z.object({
  sessionId: z.string().min(1),
  limit: z.number().int().min(1).max(200).default(50),
});

export const JulesDashboardSchema = z.object({
  includeCompleted: z.boolean().default(false),
  hours: z.number().int().min(1).max(720).default(24),
});

export const JulesStatusSchema = z.object({});

export const JulesPollSchema = z.object({
  sessionIds: z.array(z.string()).optional(),
  syncPRs: z.boolean().default(true),
});

export const JulesDetectStallsSchema = z.object({});

export const RepoSyncSchema = z.object({
  repos: z.array(z.string().regex(/^[\w.-]+\/[\w.-]+$/)).optional(),
  all: z.boolean().default(false),
});

export const PrReviewStatusSchema_Tool = z.object({
  prUrl: z.string().url().optional(),
  sessionId: z.string().optional(),
  repo: z.string().optional(),
});

export const PrUpdateReviewSchema = z.object({
  prUrl: z.string().url(),
  status: PrReviewStatusSchema.optional(),
  notes: z.string().optional(),
});

export const PrCheckAutoMergeSchema = z.object({
  prUrl: z.string().url(),
});

export const PrMergeSchema = z.object({
  prUrl: z.string().url(),
  method: MergeMethodSchema.default('merge'),
  force: z.boolean().default(false),
  confirm: z.boolean().default(false),
  expectedHeadSha: z.string().optional(),
});

// --- Safe Query Alternatives ---

export const JulesSessionsListSchema = JulesListSessionsSchema;

export const JulesSessionGetSchema = JulesGetSessionSchema;

export const JulesActivitiesListSchema = JulesGetActivitiesSchema;

export const PrReviewsListSchema = z.object({
  repoId: z.string().optional(),
  status: PrReviewStatusSchema.optional(),
  limit: z.number().int().min(1).max(200).default(50),
});

export const ReposListSchema = z.object({
  connectedOnly: z.boolean().default(false),
  limit: z.number().int().min(1).max(200).default(50),
});

export const HealthCheckSchema = z.object({});

export const toolSchemas = {
  jules_create_session: JulesCreateSessionSchema,
  jules_list_sessions: JulesListSessionsSchema,
  jules_get_session: JulesGetSessionSchema,
  jules_get_activities: JulesGetActivitiesSchema,
  jules_approve_plan: JulesApprovePlanSchema,
  jules_send_message: JulesSendMessageSchema,
  jules_get_diff: JulesGetDiffSchema,
  jules_get_bash_outputs: JulesGetBashOutputsSchema,
  jules_dashboard: JulesDashboardSchema,
  jules_status: JulesStatusSchema,
  jules_poll: JulesPollSchema,
  jules_detect_stalls: JulesDetectStallsSchema,
  jules_repo_sync: RepoSyncSchema,
  pr_review_status: PrReviewStatusSchema_Tool,
  pr_update_review: PrUpdateReviewSchema,
  pr_check_auto_merge: PrCheckAutoMergeSchema,
  pr_merge: PrMergeSchema,
};

export type ToolSchemaMap = typeof toolSchemas;
export type ToolName = keyof ToolSchemaMap | 'jules_sessions_list' | 'jules_session_get' | 'jules_activities_list' | 'pr_reviews_list' | 'repos_list' | 'jules_health';
