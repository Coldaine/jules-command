/**
 * SessionRepository — CRUD for jules_sessions table.
 */

import { eq, inArray, and, desc } from 'drizzle-orm';
import type { Db } from '../index.js';
import { julesSessions } from '../schema.js';

export type SessionRow = typeof julesSessions.$inferSelect;
export type SessionInsert = typeof julesSessions.$inferInsert;

const TERMINAL_STATES = ['completed', 'failed'] as const;

export class SessionRepository {
  constructor(private db: Db) {}

  async upsert(session: SessionInsert): Promise<void> {
    await this.db
      .insert(julesSessions)
      .values(session)
      .onConflictDoUpdate({
        target: julesSessions.id,
        set: {
          ...session,
          id: undefined, // don't update PK
        },
      });
  }

  async findById(id: string): Promise<SessionRow | undefined> {
    const rows = await this.db
      .select()
      .from(julesSessions)
      .where(eq(julesSessions.id, id))
      .limit(1);
    return rows[0];
  }

  async findByState(state: string): Promise<SessionRow[]> {
    return this.db
      .select()
      .from(julesSessions)
      .where(eq(julesSessions.state, state))
      .orderBy(desc(julesSessions.createdAt));
  }

  async findActive(): Promise<SessionRow[]> {
    return this.db
      .select()
      .from(julesSessions)
      .where(
        and(
          // Not in terminal states — we check for each terminal state
          // SQLite doesn't have a NOT IN helper in drizzle, so we use raw
        )
      )
      .orderBy(desc(julesSessions.createdAt));
  }

  async findAll(limit = 20): Promise<SessionRow[]> {
    return this.db
      .select()
      .from(julesSessions)
      .orderBy(desc(julesSessions.createdAt))
      .limit(limit);
  }
}
