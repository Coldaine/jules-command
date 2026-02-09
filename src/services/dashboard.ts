/**
 * Dashboard — aggregates data from DB into a formatted markdown summary.
 */

import type { Db } from '../db/index.js';
import { SessionRepository } from '../db/repositories/session.repo.js';
import { PrReviewRepository } from '../db/repositories/pr-review.repo.js';

export class DashboardService {
  private sessionRepo: SessionRepository;
  private prReviewRepo: PrReviewRepository;

  constructor(private db: Db) {
    this.sessionRepo = new SessionRepository(db);
    this.prReviewRepo = new PrReviewRepository(db);
  }

  async generate(opts?: { includeCompleted?: boolean; hours?: number }): Promise<string> {
    // TODO: Implement in Phase 6 Task 6.4
    // Query sessions grouped by state
    // Query PRs pending review
    // Format as markdown dashboard
    throw new Error('Not implemented — Phase 6 Task 6.4');
  }
}
