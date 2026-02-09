/**
 * Database migration runner.
 *
 * Run with: npx tsx src/db/migrate.ts
 */

import Database from 'better-sqlite3';
import { createDb } from './index.js';
import { loadConfig } from '../config.js';

/**
 * Run database migrations on the provided SQLite database instance.
 */
export function migrate(db: Database.Database): void {
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
      session_id TEXT REFERENCES jules_sessions(id),
      complexity_score REAL,
      complexity_label TEXT,
      lines_changed INTEGER,
      files_changed INTEGER,
      critical_files_touched INTEGER DEFAULT 0,
      test_files_changed INTEGER DEFAULT 0,
      ci_status TEXT,
      review_state TEXT,
      decision TEXT,
      decision_reason TEXT,
      merged_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS poll_cursors (
      id TEXT PRIMARY KEY,
      last_poll_at TEXT,
      last_activity_seen_at TEXT,
      poll_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0
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
    CREATE INDEX IF NOT EXISTS idx_pr_reviews_review_status ON pr_reviews(review_state);
    CREATE INDEX IF NOT EXISTS idx_pr_reviews_auto_merge ON pr_reviews(decision);
  `);
}

// CLI runner
if (import.meta.url === `file://${process.argv[1]}`) {
  const config = loadConfig();
  const { sqlite } = createDb(config.databasePath);
  migrate(sqlite);
  console.log('Migrations complete.');
  sqlite.close();
}
