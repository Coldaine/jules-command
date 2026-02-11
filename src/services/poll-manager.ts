/**
 * PollManager — orchestrates polling cycles for Jules sessions and GitHub PRs.
 */

import type { Config } from '../config.js';
import type { Db } from '../db/index.js';
import { SessionRepository } from '../db/repositories/session.repo.js';
import { PollCursorRepository } from '../db/repositories/poll-cursor.repo.js';
import { ActivityRepository } from '../db/repositories/activity.repo.js';
import { StallDetector, type StallInfo } from './stall-detector.js';
import type { JulesService } from './jules.service.js';
import type { GitHubService } from './github.service.js';

export interface PollResult {
  sessionId: string;
  updated: boolean;
  stall: StallInfo | null;
  error: string | null;
}

export interface PollSummary {
  sessionsPolled: number;
  sessionsUpdated: number;
  stallsDetected: StallInfo[];
  prsUpdated: number;
  errors: Array<{ sessionId: string; error: string }>;
}

export class PollManager {
  private sessionRepo: SessionRepository;
  private cursorRepo: PollCursorRepository;
  private activityRepo: ActivityRepository;
  private stallDetector: StallDetector;

  constructor(
    private config: Config,
    private db: Db,
    private julesService?: JulesService,
    private githubService?: GitHubService,
  ) {
    this.sessionRepo = new SessionRepository(db);
    this.cursorRepo = new PollCursorRepository(db);
    this.activityRepo = new ActivityRepository(db);
    this.stallDetector = new StallDetector(config);
  }

  async pollSession(sessionId: string): Promise<PollResult> {
    try {
      const session = await this.sessionRepo.findById(sessionId);
      if (!session) {
        return {
          sessionId,
          updated: false,
          stall: null,
          error: `Session not found: ${sessionId}`,
        };
      }

      const now = new Date().toISOString();
      const activities = await this.activityRepo.findBySessionId(sessionId, 100);
      const stall = this.stallDetector.detect(session, activities);

      const existingCursor = await this.cursorRepo.findById(sessionId);
      await this.cursorRepo.upsert({
        id: sessionId,
        pollType: existingCursor?.pollType ?? 'session',
        lastPollAt: now,
        pollCount: (existingCursor?.pollCount ?? 0) + 1,
        lastActivitySeenAt: existingCursor?.lastActivitySeenAt ?? null,
        lastPageToken: existingCursor?.lastPageToken ?? null,
        consecutiveUnchanged: existingCursor?.consecutiveUnchanged ?? 0,
        errorCount: existingCursor?.errorCount ?? 0,
        lastError: existingCursor?.lastError ?? null,
      });

      await this.sessionRepo.upsert({
        ...session,
        lastPolledAt: now,
        stallDetectedAt: stall?.detectedAt ?? null,
        stallReason: stall?.reason ?? null,
      });

      return {
        sessionId,
        updated: true,
        stall,
        error: null,
      };
    } catch (error) {
      return {
        sessionId,
        updated: false,
        stall: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async pollAllActive(): Promise<PollSummary> {
    const sessions = await this.sessionRepo.findActive();

    const summary: PollSummary = {
      sessionsPolled: 0,
      sessionsUpdated: 0,
      stallsDetected: [],
      prsUpdated: 0,
      errors: [],
    };

    for (const session of sessions) {
      const result = await this.pollSession(session.id);
      summary.sessionsPolled += 1;

      if (result.updated) {
        summary.sessionsUpdated += 1;
      }

      if (result.stall) {
        summary.stallsDetected.push(result.stall);
      }

      if (result.error) {
        summary.errors.push({ sessionId: session.id, error: result.error });
      }

      if (this.config.pollDelayBetweenSessionsMs > 0) {
        await this.sleep(this.config.pollDelayBetweenSessionsMs);
      }
    }

    return summary;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
