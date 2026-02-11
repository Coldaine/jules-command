/**
 * ActivityRepository — CRUD for jules_activities table.
 */

import { eq, and, gt, desc } from 'drizzle-orm';
import type { Db } from '../index.js';
import { julesActivities } from '../schema.js';

export type ActivityRow = typeof julesActivities.$inferSelect;
export type ActivityInsert = typeof julesActivities.$inferInsert;

export class ActivityRepository {
  constructor(private db: Db) {}

  async insertMany(activities: ActivityInsert[]): Promise<void> {
    if (activities.length === 0) return;
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
      .orderBy(desc(julesActivities.timestamp))
      .limit(limit);
  }

  async findBySessionAndType(sessionId: string, type: string, limit = 50): Promise<ActivityRow[]> {
    return this.db
      .select()
      .from(julesActivities)
      .where(
        and(
          eq(julesActivities.sessionId, sessionId),
          eq(julesActivities.activityType, type),
        )
      )
      .orderBy(desc(julesActivities.timestamp))
      .limit(limit);
  }

  async findSince(sessionId: string, since: string, limit = 50): Promise<ActivityRow[]> {
    return this.db
      .select()
      .from(julesActivities)
      .where(
        and(
          eq(julesActivities.sessionId, sessionId),
          gt(julesActivities.timestamp, since),
        )
      )
      .orderBy(desc(julesActivities.timestamp))
      .limit(limit);
  }

  async findRecent(limit = 50, type?: string): Promise<ActivityRow[]> {
    const base = this.db
      .select()
      .from(julesActivities)
      .orderBy(desc(julesActivities.timestamp))
      .limit(limit);

    if (!type) {
      return base;
    }

    return this.db
      .select()
      .from(julesActivities)
      .where(eq(julesActivities.activityType, type))
      .orderBy(desc(julesActivities.timestamp))
      .limit(limit);
  }
}
