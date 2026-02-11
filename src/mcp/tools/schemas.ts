import { z } from 'zod';

export const sessionStateSchema = z.enum([
  'queued',
  'planning',
  'in_progress',
  'completed',
  'failed',
  'awaiting_plan_approval',
  'awaiting_user_feedback',
]);

export const reviewStatusSchema = z.enum(['pending', 'approved', 'changes_requested', 'closed']);
export const activityTypeSchema = z.enum(['message', 'plan', 'bash_output', 'file_change', 'error']);

export const toolSchemas = {
  jules_create_session: z.object({
    prompt: z.string().min(1),
    repo: z.string().optional(),
    branch: z.string().optional(),
    autoPr: z.boolean().optional(),
    requireApproval: z.boolean().optional(),
    title: z.string().optional(),
  }),
  jules_list_sessions: z.object({
    state: sessionStateSchema.optional(),
    repo: z.string().optional(),
    limit: z.number().int().positive().max(200).optional(),
    fromDb: z.boolean().optional(),
  }),
  jules_get_session: z.object({ sessionId: z.string().min(1) }),
  jules_get_activities: z.object({
    sessionId: z.string().min(1),
    type: activityTypeSchema.optional(),
    limit: z.number().int().positive().max(200).optional(),
    since: z.string().optional(),
  }),
  jules_approve_plan: z.object({ sessionId: z.string().min(1) }),
  jules_send_message: z.object({
    sessionId: z.string().min(1),
    message: z.string().min(1),
    waitForReply: z.boolean().optional(),
    waitTimeout: z.number().int().positive().max(600).optional(),
  }),
  jules_get_diff: z.object({ sessionId: z.string().min(1), file: z.string().optional() }),
  jules_get_bash_outputs: z.object({ sessionId: z.string().min(1) }),
  jules_dashboard: z.object({ includeCompleted: z.boolean().optional(), hours: z.number().positive().optional() }),
  jules_status: z.object({}),
  jules_poll: z.object({ sessionIds: z.array(z.string()).optional(), syncPRs: z.boolean().optional() }),
  jules_detect_stalls: z.object({}),
  jules_sessions_by_state: z.object({ state: sessionStateSchema, limit: z.number().int().positive().max(200).optional() }),
  jules_sessions_by_repo: z.object({ repoId: z.string().min(1), limit: z.number().int().positive().max(200).optional() }),
  jules_recent_activities: z.object({ type: activityTypeSchema.optional(), limit: z.number().int().positive().max(200).optional() }),
  pr_list_pending: z.object({ statuses: z.array(reviewStatusSchema).optional(), limit: z.number().int().positive().max(200).optional() }),
  repo_sync: z.object({ repos: z.array(z.string()).optional(), all: z.boolean().optional() }),
  pr_review_status: z.object({ prUrl: z.string().optional(), sessionId: z.string().optional(), repo: z.string().optional() }),
  pr_update_review: z.object({ prUrl: z.string().min(1), status: reviewStatusSchema.optional(), notes: z.string().optional() }),
  pr_check_auto_merge: z.object({ prUrl: z.string().optional() }),
  pr_merge: z.object({
    prUrl: z.string().min(1),
    method: z.enum(['merge', 'squash', 'rebase']).optional(),
    force: z.boolean().default(false),
  }),
} as const;

export type ToolSchemaMap = typeof toolSchemas;
export type ToolName = keyof ToolSchemaMap;
