import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';

describe('Database Migration', () => {
  it('creates all required tables with correct schema', () => {
    const db = new Database(':memory:');
    migrate(db);

    // Verify tables exist
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as any[];
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('repos');
    expect(tableNames).toContain('jules_sessions');
    expect(tableNames).toContain('jules_activities');
    expect(tableNames).toContain('pr_reviews');
    expect(tableNames).toContain('poll_cursors');

    // Verify jules_activities table schema (updated)
    const activitiesColumns = db.prepare("PRAGMA table_info(jules_activities)").all() as any[];
    expect(activitiesColumns.map(c => c.name)).toEqual([
      'id', 'session_id', 'activity_type', 'timestamp', 'content', 'metadata', 'has_bash_output', 'progress_description'
    ]);
  });
});
