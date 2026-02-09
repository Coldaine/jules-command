/**
 * Shared types for Jules Command.
 */

// Re-export DB row types
export type { SessionRow, SessionInsert } from '../db/repositories/session.repo.js';
export type { ActivityRow, ActivityInsert } from '../db/repositories/activity.repo.js';
export type { RepoRow, RepoInsert } from '../db/repositories/repo.repo.js';
export type { PrReviewRow, PrReviewInsert } from '../db/repositories/pr-review.repo.js';
export type { PollCursorRow, PollCursorInsert } from '../db/repositories/poll-cursor.repo.js';

// Re-export service types
export type { StallInfo } from '../services/stall-detector.js';
export type { PollResult, PollSummary } from '../services/poll-manager.js';
export type { ComplexityInput, ComplexityResult } from '../services/complexity-scorer.js';
export type { AutoMergeResult } from '../services/auto-merge.js';
export type { CreateSessionOpts } from '../services/jules.service.js';
