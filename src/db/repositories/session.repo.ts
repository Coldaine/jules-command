/**
 * SessionRepository — CRUD for jules_sessions table.
 */

import { eq, desc, and, ne } from 'drizzle-orm';
import type { Db } from '../index.js';
import { julesSessions } from '../schema.js';

export type SessionRow = typeof julesSessions.$inferSelect;
export type SessionInsert = typeof julesSessions.$inferInsert;

export class SessionRepository {
  constructor(private db: Db) {}

  async upsert(session: SessionInsert): Promise<SessionRow> {
    const result = await this.db
      .insert(julesSessions)
      .values(session)
      .onConflictDoUpdate({
        target: julesSessions.id,
        set: session,
      })
      .returning()
      .get();
    return result;
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

  async findByRepoId(repoId: string, limit = 50): Promise<SessionRow[]> {
    return this.db
      .select()
      .from(julesSessions)
      .where(eq(julesSessions.repoId, repoId))
      .orderBy(desc(julesSessions.createdAt))
      .limit(limit);
  }

  async findActive(): Promise<SessionRow[]> {
    return this.db
      .select()
      .from(julesSessions)
      .where(and(
        ne(julesSessions.state, 'completed'),
        ne(julesSessions.state, 'failed')
      ))
      .orderBy(desc(julesSessions.createdAt));
  }

  async findAll(limit?: number): Promise<SessionRow[]> {
    const query = this.db
      .select()
      .from(julesSessions)
      .orderBy(desc(julesSessions.createdAt));
    return typeof limit === 'number' ? query.limit(limit) : query;
  }
}
