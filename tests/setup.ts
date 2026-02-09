/**
 * Test setup — creates an in-memory SQLite database for tests.
 * FIXED: Now uses migrate() function to ensure schema consistency
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../src/db/schema.js';
import { migrate } from '../src/db/migrate.js';

export function createTestDb() {
  const sqlite = new Database(':memory:');
  
  // Use the actual migrate function to ensure schema consistency
  migrate(sqlite);

  return {
    sqlite,
    db: drizzle(sqlite, { schema }),
  };
}
