/**
 * Database connection factory.
 *
 * Returns a configured better-sqlite3 instance with WAL mode enabled.
 */

import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function createDb(databasePath: string): { db: any; sqlite: any } {
  // Ensure data directory exists
  mkdirSync(dirname(databasePath), { recursive: true });

  const sqlite = new Database(databasePath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

export type Db = ReturnType<typeof createDb>['db'];
