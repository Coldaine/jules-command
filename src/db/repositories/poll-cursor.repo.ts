/**
 * PollCursorRepository — CRUD for poll_cursors table.
 */

import { eq, sql } from 'drizzle-orm';
import type { Db } from '../index.js';
import { pollCursors } from '../schema.js';

export type PollCursorRow = typeof pollCursors.$inferSelect;
export type PollCursorInsert = typeof pollCursors.$inferInsert;

export class PollCursorRepository {
  constructor(private db: Db) {}

  async upsert(cursor: PollCursorInsert): Promise<void> {
    await this.db
      .insert(pollCursors)
      .values(cursor)
      .onConflictDoUpdate({
        target: pollCursors.id,
        set: { ...cursor, id: undefined },
      });
  }

  async findById(id: string): Promise<PollCursorRow | undefined> {
    const rows = await this.db
      .select()
      .from(pollCursors)
      .where(eq(pollCursors.id, id))
      .limit(1);
    return rows[0];
  }

  async incrementPollCount(id: string): Promise<void> {
    await this.db
      .update(pollCursors)
      .set({
        pollCount: sql`COALESCE(${pollCursors.pollCount}, 0) + 1`,
        lastPollAt: new Date().toISOString(),
      })
      .where(eq(pollCursors.id, id));
  }
}
