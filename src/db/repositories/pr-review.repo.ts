/**
 * PrReviewRepository — CRUD for pr_reviews table.
 */

import { eq, and } from 'drizzle-orm';
import type { Db } from '../index.js';
import { prReviews } from '../schema.js';

export type PrReviewRow = typeof prReviews.$inferSelect;
export type PrReviewInsert = typeof prReviews.$inferInsert;

export class PrReviewRepository {
  constructor(private db: Db) {}

  async upsert(review: PrReviewInsert): Promise<void> {
    await this.db
      .insert(prReviews)
      .values(review)
      .onConflictDoUpdate({
        target: prReviews.prUrl,
        set: { ...review, id: undefined, prUrl: undefined },
      });
  }

  async findByPrUrl(prUrl: string): Promise<PrReviewRow | undefined> {
    const rows = await this.db
      .select()
      .from(prReviews)
      .where(eq(prReviews.prUrl, prUrl))
      .limit(1);
    return rows[0];
  }

  async findBySessionId(sessionId: string): Promise<PrReviewRow | undefined> {
    const rows = await this.db
      .select()
      .from(prReviews)
      .where(eq(prReviews.sessionId, sessionId))
      .limit(1);
    return rows[0];
  }

  async findPending(): Promise<PrReviewRow[]> {
    return this.db
      .select()
      .from(prReviews)
      .where(eq(prReviews.reviewStatus, 'pending'));
  }

  async findAutoMergeEligible(): Promise<PrReviewRow[]> {
    return this.db
      .select()
      .from(prReviews)
      .where(
        and(
          eq(prReviews.autoMergeEligible, true),
          eq(prReviews.reviewStatus, 'pending'),
        )
      );
  }
}
