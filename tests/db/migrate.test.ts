import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '@/db/migrate.ts';

describe('Database Migration', () => {
  it('creates all required tables with correct schema', () => {
    // Create in-memory database
    const db = new Database(':memory:');

    // Run migration
    migrate(db);

    // Query for all tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];

    // Extract table names, filter out SQLite internal tables
    const tableNames = tables.map(t => t.name).filter(name => !name.startsWith('sqlite_')).sort();

    // Assert all 5 tables exist
    expect(tableNames).toEqual([
      'jules_activities',
      'jules_sessions',
      'poll_cursors',
      'pr_reviews',
      'repos'
    ]);

    // Verify repos table schema
    const reposColumns = db.prepare("PRAGMA table_info(repos)").all() as { name: string; type: string; notnull: number; pk: number }[];
    expect(reposColumns.map(c => c.name)).toEqual([
      'id', 'owner', 'name', 'full_name', 'description', 'default_branch',
      'primary_language', 'stars', 'is_private', 'jules_source_name',
      'jules_connected', 'synced_at', 'created_at'
    ]);

    // Verify jules_sessions table schema
    const sessionsColumns = db.prepare("PRAGMA table_info(jules_sessions)").all() as { name: string; type: string; notnull: number; pk: number }[];
    expect(sessionsColumns.map(c => c.name)).toEqual([
      'id', 'title', 'prompt', 'repo_id', 'source_branch', 'state',
      'automation_mode', 'require_plan_approval', 'plan_json', 'plan_approved_at',
      'jules_url', 'pr_url', 'pr_title', 'error_reason', 'stall_detected_at',
      'stall_reason', 'created_at', 'updated_at', 'completed_at', 'last_polled_at'
    ]);

    // Verify jules_activities table schema
    const activitiesColumns = db.prepare("PRAGMA table_info(jules_activities)").all() as { name: string; type: string; notnull: number; pk: number }[];
    expect(activitiesColumns.map(c => c.name)).toEqual([
      'id', 'session_id', 'activity_type', 'timestamp', 'content', 'metadata'
    ]);

    // Verify pr_reviews table schema
    const prReviewsColumns = db.prepare("PRAGMA table_info(pr_reviews)").all() as { name: string; type: string; notnull: number; pk: number }[];
    expect(prReviewsColumns.map(c => c.name)).toEqual([
      'id', 'pr_url', 'pr_number', 'repo_id', 'session_id', 'pr_title',
      'pr_description', 'pr_state', 'review_status', 'complexity_score',
      'complexity_details', 'lines_changed', 'files_changed', 'test_files_changed',
      'critical_files_touched', 'ci_status', 'auto_merge_eligible',
      'auto_merge_reason', 'review_notes', 'pr_created_at', 'first_seen_at',
      'last_checked_at', 'merged_at'
    ]);

    // Verify poll_cursors table schema
    const cursorsColumns = db.prepare("PRAGMA table_info(poll_cursors)").all() as { name: string; type: string; notnull: number; pk: number }[];
    expect(cursorsColumns.map(c => c.name)).toEqual([
      'id', 'poll_type', 'last_poll_at', 'last_activity_seen_at', 'last_page_token',
      'poll_count', 'consecutive_unchanged', 'error_count', 'last_error'
    ]);

    // Verify foreign key constraints are enabled
    const foreignKeys = db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number };
    expect(foreignKeys.foreign_keys).toBe(1);

    // Verify WAL mode is enabled (skip for in-memory DBs)
    const journalMode = db.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
    // In-memory databases don't support WAL mode
    if (db.name !== ':memory:') {
      expect(journalMode.journal_mode).toBe('wal');
    }

    db.close();
  });
});