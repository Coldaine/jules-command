/**
 * Drizzle ORM schema definitions for Jules Command.
 */

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ─── repos ──────────────────────────────────────────────────────────────────

export const repos = sqliteTable('repos', {
  id: text('id').primaryKey(),                    // owner/name
  owner: text('owner').notNull(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull().unique(),
  description: text('description'),
  defaultBranch: text('default_branch'),
  primaryLanguage: text('primary_language'),
  stars: integer('stars'),
  isPrivate: integer('is_private', { mode: 'boolean' }),
  julesSourceName: text('jules_source_name'),
  julesConnected: integer('jules_connected', { mode: 'boolean' }).default(false),
  syncedAt: text('synced_at'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

// ─── jules_sessions ─────────────────────────────────────────────────────────

export const julesSessions = sqliteTable('jules_sessions', {
  id: text('id').primaryKey(),
  title: text('title'),
  prompt: text('prompt').notNull(),
  repoId: text('repo_id').references(() => repos.id),
  sourceBranch: text('source_branch'),
  state: text('state').notNull(),
  automationMode: text('automation_mode'),
  requirePlanApproval: integer('require_plan_approval', { mode: 'boolean' }),
  planJson: text('plan_json'),
  planApprovedAt: text('plan_approved_at'),
  julesUrl: text('jules_url'),
  prUrl: text('pr_url'),
  prTitle: text('pr_title'),
  errorReason: text('error_reason'),
  stallDetectedAt: text('stall_detected_at'),
  stallReason: text('stall_reason'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  completedAt: text('completed_at'),
  lastPolledAt: text('last_polled_at'),
});

// ─── jules_activities ───────────────────────────────────────────────────────

export const julesActivities = sqliteTable('jules_activities', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => julesSessions.id),
  type: text('type').notNull(),
  originator: text('originator'),
  message: text('message'),
  planStepCount: integer('plan_step_count'),
  progressTitle: text('progress_title'),
  progressDescription: text('progress_description'),
  hasChangeset: integer('has_changeset', { mode: 'boolean' }).default(false),
  hasBashOutput: integer('has_bash_output', { mode: 'boolean' }).default(false),
  hasMedia: integer('has_media', { mode: 'boolean' }).default(false),
  filesChanged: integer('files_changed'),
  linesAdded: integer('lines_added'),
  linesDeleted: integer('lines_deleted'),
  createdAt: text('created_at').notNull(),
});

// ─── pr_reviews ─────────────────────────────────────────────────────────────

export const prReviews = sqliteTable('pr_reviews', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  prUrl: text('pr_url').notNull().unique(),
  prNumber: integer('pr_number').notNull(),
  repoId: text('repo_id').references(() => repos.id),
  sessionId: text('session_id').references(() => julesSessions.id),
  prTitle: text('pr_title'),
  prDescription: text('pr_description'),
  prState: text('pr_state'),
  reviewStatus: text('review_status').default('pending'),
  complexityScore: real('complexity_score'),
  complexityDetails: text('complexity_details'),
  linesChanged: integer('lines_changed'),
  filesChanged: integer('files_changed'),
  testFilesChanged: integer('test_files_changed'),
  criticalFilesTouched: integer('critical_files_touched', { mode: 'boolean' }).default(false),
  ciStatus: text('ci_status'),
  autoMergeEligible: integer('auto_merge_eligible', { mode: 'boolean' }).default(false),
  autoMergeReason: text('auto_merge_reason'),
  reviewNotes: text('review_notes'),
  prCreatedAt: text('pr_created_at'),
  firstSeenAt: text('first_seen_at').default(sql`(datetime('now'))`),
  lastCheckedAt: text('last_checked_at'),
  mergedAt: text('merged_at'),
});

// ─── poll_cursors ───────────────────────────────────────────────────────────

export const pollCursors = sqliteTable('poll_cursors', {
  id: text('id').primaryKey(),
  pollType: text('poll_type').notNull(),
  lastPollAt: text('last_poll_at'),
  lastActivitySeenAt: text('last_activity_seen_at'),
  lastPageToken: text('last_page_token'),
  pollCount: integer('poll_count').default(0),
  consecutiveUnchanged: integer('consecutive_unchanged').default(0),
  errorCount: integer('error_count').default(0),
  lastError: text('last_error'),
});
