import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '@/db/migrate.ts';

describe('Database Migration', () => {
  it('creates all required tables with correct schema', () => {
    const db = new Database(':memory:');
    migrate(db);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
    const tableNames = tables.map(t => t.name).filter(name => !name.startsWith('sqlite_')).sort();

    expect(tableNames).toEqual([
      'jules_activities',
      'jules_sessions',
      'poll_cursors',
      'pr_reviews',
      'repos'
    ]);

    const reposColumns = db.prepare("PRAGMA table_info(repos)").all() as { name: string }[];
    expect(reposColumns.map(c => c.name)).toEqual([
      'id', 'owner', 'name', 'full_name', 'description', 'default_branch',
      'primary_language', 'stars', 'is_private', 'jules_source_name',
      'jules_connected', 'synced_at', 'created_at'
    ]);

    const sessionsColumns = db.prepare("PRAGMA table_info(jules_sessions)").all() as { name: string }[];
    expect(sessionsColumns.map(c => c.name)).toEqual([
      'id', 'title', 'prompt', 'repo_id', 'source_branch', 'state',
      'automation_mode', 'require_plan_approval', 'plan_json', 'plan_approved_at',
      'jules_url', 'pr_url', 'pr_title', 'error_reason', 'stall_detected_at',
      'stall_reason', 'created_at', 'updated_at', 'completed_at', 'last_polled_at'
    ]);

    const activitiesColumns = db.prepare("PRAGMA table_info(jules_activities)").all() as { name: string }[];
    expect(activitiesColumns.map(c => c.name)).toEqual([
      'id', 'session_id', 'activity_type', 'timestamp', 'content', 'metadata'
    ]);

    const prReviewsColumns = db.prepare("PRAGMA table_info(pr_reviews)").all() as { name: string }[];
    expect(prReviewsColumns.map(c => c.name)).toEqual([
      'id', 'pr_url', 'pr_number', 'repo_id', 'session_id', 'pr_title',
      'pr_description', 'pr_state', 'review_status', 'complexity_score',
      'complexity_details', 'lines_changed', 'files_changed', 'test_files_changed',
      'critical_files_touched', 'ci_status', 'auto_merge_eligible',
      'auto_merge_reason', 'review_notes', 'pr_created_at', 'first_seen_at',
      'last_checked_at', 'merged_at'
    ]);

    const cursorsColumns = db.prepare("PRAGMA table_info(poll_cursors)").all() as { name: string }[];
    expect(cursorsColumns.map(c => c.name)).toEqual([
      'id', 'poll_type', 'last_poll_at', 'last_activity_seen_at', 'last_page_token',
      'poll_count', 'consecutive_unchanged', 'error_count', 'last_error'
    ]);

    db.close();
  });

  it('applies ON DELETE CASCADE to dependent foreign keys', () => {
    const db = new Database(':memory:');
    migrate(db);

    const sessionFks = db.prepare("PRAGMA foreign_key_list(jules_sessions)").all() as Array<{ table: string; on_delete: string }>;
    const activitiesFks = db.prepare("PRAGMA foreign_key_list(jules_activities)").all() as Array<{ table: string; on_delete: string }>;
    const prReviewFks = db.prepare("PRAGMA foreign_key_list(pr_reviews)").all() as Array<{ table: string; on_delete: string }>;

    expect(sessionFks.find((fk) => fk.table === 'repos')?.on_delete.toUpperCase()).toBe('CASCADE');
    expect(activitiesFks.find((fk) => fk.table === 'jules_sessions')?.on_delete.toUpperCase()).toBe('CASCADE');
    expect(prReviewFks.find((fk) => fk.table === 'jules_sessions')?.on_delete.toUpperCase()).toBe('CASCADE');
    expect(prReviewFks.find((fk) => fk.table === 'repos')?.on_delete.toUpperCase()).toBe('CASCADE');

    db.close();
  });
});
