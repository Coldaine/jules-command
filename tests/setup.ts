/**
 * Test setup — creates an in-memory SQLite database for tests.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../src/db/schema.js';

export function createTestDb() {
  const sqlite = new Database(':memory:');
  sqlite.pragma('foreign_keys = ON');

  // Run migrations inline
  sqlite.exec(`
    CREATE TABLE repos (
      id TEXT PRIMARY KEY,
      owner TEXT NOT NULL,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL UNIQUE,
      description TEXT,
      default_branch TEXT,
      primary_language TEXT,
      stars INTEGER,
      is_private INTEGER DEFAULT 0,
      jules_source_name TEXT,
      jules_connected INTEGER DEFAULT 0,
      synced_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE jules_sessions (
      id TEXT PRIMARY KEY,
      title TEXT,
      prompt TEXT NOT NULL,
      repo_id TEXT REFERENCES repos(id),
      source_branch TEXT,
      state TEXT NOT NULL,
      automation_mode TEXT,
      require_plan_approval INTEGER,
      plan_json TEXT,
      plan_approved_at TEXT,
      jules_url TEXT,
      pr_url TEXT,
      pr_title TEXT,
      error_reason TEXT,
      stall_detected_at TEXT,
      stall_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      last_polled_at TEXT
    );

    CREATE TABLE jules_activities (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES jules_sessions(id),
      activity_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      content TEXT,
      metadata TEXT
    );

    CREATE TABLE pr_reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pr_url TEXT NOT NULL UNIQUE,
      pr_number INTEGER NOT NULL,
      repo_id TEXT REFERENCES repos(id),
      session_id TEXT REFERENCES jules_sessions(id),
      pr_title TEXT,
      pr_description TEXT,
      pr_state TEXT,
      review_status TEXT DEFAULT 'pending',
      complexity_score REAL,
      complexity_details TEXT,
      lines_changed INTEGER,
      files_changed INTEGER,
      test_files_changed INTEGER,
      critical_files_touched INTEGER DEFAULT 0,
      ci_status TEXT,
      auto_merge_eligible INTEGER DEFAULT 0,
      auto_merge_reason TEXT,
      review_notes TEXT,
      pr_created_at TEXT,
      first_seen_at TEXT DEFAULT (datetime('now')),
      last_checked_at TEXT,
      merged_at TEXT
    );

    CREATE TABLE poll_cursors (
      id TEXT PRIMARY KEY,
      poll_type TEXT NOT NULL,
      last_poll_at TEXT,
      last_activity_seen_at TEXT,
      last_page_token TEXT,
      poll_count INTEGER DEFAULT 0,
      consecutive_unchanged INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      last_error TEXT
    );
  `);

  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}
