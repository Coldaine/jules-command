/**
 * ActivityRepository — CRUD for jules_activities table.
 */

import { eq, desc, and, gt } from 'drizzle-orm';
import type { Db } from '../index.js';
import { julesActivities } from '../schema.js';

export type ActivityRow = typeof julesActivities.$inferSelect;
export type ActivityInsert = typeof julesActivities.$inferInsert;

export class ActivityRepository {
  constructor(private db: Db) {}

  async insertMany(activities: ActivityInsert[]): Promise<void> {
    if (activities.length === 0) return;
    // Use INSERT OR IGNORE to handle duplicates
    for (const activity of activities) {
      await this.db
        .insert(julesActivities)
        .values(activity)
        .onConflictDoNothing();
    }
  }

  async findBySessionId(sessionId: string, limit = 50): Promise<ActivityRow[]> {
    return this.db
      .select()
      .from(julesActivities)
      .where(eq(julesActivities.sessionId, sessionId))
      .orderBy(desc(julesActivities.createdAt))
      .limit(limit);
  }

  async findBySessionAndType(sessionId: string, type: string): Promise<ActivityRow[]> {
    return this.db
      .select()
      .from(julesActivities)
      .where(
        and(
          eq(julesActivities.sessionId, sessionId),
          eq(julesActivities.type, type),
        )
      )
      .orderBy(desc(julesActivities.createdAt));
  }

  async findSince(sessionId: string, since: string): Promise<ActivityRow[]> {
    return this.db
      .select()
      .from(julesActivities)
      .where(
        and(
          eq(julesActivities.sessionId, sessionId),
          gt(julesActivities.createdAt, since),
        )
      )
      .orderBy(julesActivities.createdAt);
  }
}
