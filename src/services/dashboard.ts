import type { Config } from '../config.js';
import type { Db } from '../db/index.js';
import { SessionRepository } from '../db/repositories/session.repo.js';
import { PrReviewRepository } from '../db/repositories/pr-review.repo.js';

export class DashboardService {
  private sessionRepo: SessionRepository;
  private prReviewRepo: PrReviewRepository;

  constructor(
    db: Db,
    private config: Config,
  ) {
    this.sessionRepo = new SessionRepository(db);
    this.prReviewRepo = new PrReviewRepository(db);
  }

  async generate(opts?: { includeCompleted?: boolean; hours?: number }): Promise<string> {
    const includeCompleted = opts?.includeCompleted ?? false;
    const now = Date.now();
    const thresholdMs = (opts?.hours ?? 24) * 60 * 60 * 1000;
    const thresholdIso = new Date(now - thresholdMs).toISOString();

    const allSessions = await this.sessionRepo.findAll();
    const sessions = allSessions
      .filter((session) => includeCompleted || session.state !== 'completed')
      .filter((session) => session.updatedAt >= thresholdIso);

    const stateCounts = sessions.reduce<Record<string, number>>((acc, session) => {
      acc[session.state] = (acc[session.state] ?? 0) + 1;
      return acc;
    }, {});

    const stalled = sessions.filter((session) => Boolean(session.stallDetectedAt));
    const pendingReviews = await this.prReviewRepo.findByReviewStatuses(['pending', 'changes_requested']);
    const eligibleReviews = pendingReviews.filter((review) => review.autoMergeEligible === true);

    if (sessions.length === 0 && pendingReviews.length === 0) {
      return '# Jules Dashboard\n\nNo active sessions.';
    }

    const lines: string[] = ['# Jules Dashboard', ''];
    lines.push('## Session counts');
    for (const [state, count] of Object.entries(stateCounts)) {
      lines.push(`- ${state}: ${count}`);
    }

    lines.push('', '## Recent sessions');
    for (const session of sessions.slice(0, 10)) {
      const ageMinutes = Math.max(0, Math.round((now - new Date(session.updatedAt).getTime()) / 60000));
      lines.push(`- ${session.title ?? session.id} (${session.state}) • ${session.repoId ?? 'no-repo'} • ${session.sourceBranch ?? 'no-branch'} • ${ageMinutes} min ago`);
    }

    lines.push('', '## Stalled sessions');
    if (stalled.length === 0) {
      lines.push('- none');
    } else {
      for (const session of stalled) {
        lines.push(`- ${session.title ?? session.id}: ${session.stallReason ?? 'unknown'}`);
      }
    }

    lines.push('', '## Pending PR reviews');
    if (pendingReviews.length === 0) {
      lines.push('- none');
    } else {
      for (const review of pendingReviews.slice(0, 10)) {
        lines.push(`- #${review.prNumber} ${review.prTitle ?? review.prUrl} (${review.reviewStatus})`);
      }
    }

    if (eligibleReviews.length > 0) {
      lines.push('', `Auto-merge eligible: ${eligibleReviews.length}`);
    }

    lines.push('', `Thresholds: queue>${this.config.stallQueueTimeoutMin}m, no-progress>${this.config.stallNoProgressTimeoutMin}m`);

    return lines.join('\n');
  }

  async generateCompact(): Promise<string> {
    const active = await this.sessionRepo.findActive();
    return `Jules: ${active.length} active sessions, ${active.filter(s => !!s.stallDetectedAt).length} stalled.`;
  }
}
