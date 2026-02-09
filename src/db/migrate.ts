/**
 * Database migration runner.
 *
 * Run with: npx tsx src/db/migrate.ts
 */

import Database from 'better-sqlite3';
import { createDb } from './index.js';
import { loadConfig } from '../config.js';
import { fileURLToPath } from 'url';

/**
 * Run database migrations on the provided SQLite database instance.
 * TODO: Add structured logging (JSON format) for better observability
 * TODO: Add audit logging for compliance tracking
 */
export function migrate(db: Database.Database): void {
  try {
    // Enable foreign keys and WAL mode
    db.pragma('foreign_keys = ON');
    db.pragma('journal_mode = WAL');

  // For initial setup we use raw SQL to create tables + indexes.
  // Drizzle migrations can be added later via drizzle-kit.

  db.exec(`
    CREATE TABLE IF NOT EXISTS repos (
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

    CREATE TABLE IF NOT EXISTS jules_sessions (
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

    CREATE TABLE IF NOT EXISTS jules_activities (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES jules_sessions(id),
      activity_type TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      content TEXT,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS pr_reviews (
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

    CREATE TABLE IF NOT EXISTS poll_cursors (
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

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_repos_jules_connected ON repos(jules_connected);
    CREATE INDEX IF NOT EXISTS idx_sessions_state ON jules_sessions(state);
    CREATE INDEX IF NOT EXISTS idx_sessions_repo_id ON jules_sessions(repo_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON jules_sessions(created_at);
    CREATE INDEX IF NOT EXISTS idx_activities_session_id ON jules_activities(session_id);
    CREATE INDEX IF NOT EXISTS idx_activities_type ON jules_activities(activity_type);
    CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON jules_activities(timestamp);
    CREATE INDEX IF NOT EXISTS idx_pr_reviews_session_id ON pr_reviews(session_id);
    CREATE INDEX IF NOT EXISTS idx_pr_reviews_review_status ON pr_reviews(review_status);
    CREATE INDEX IF NOT EXISTS idx_pr_reviews_auto_merge ON pr_reviews(auto_merge_eligible);
  `);
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// CLI runner - fixed for ESM compatibility
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const config = loadConfig();
  const { sqlite } = createDb(config.databasePath);
  migrate(sqlite);
  console.log('Migrations complete.');
  sqlite.close();
}
