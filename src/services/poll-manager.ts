/**
 * PollManager — orchestrates polling cycles for Jules sessions and GitHub PRs.
 */

import type { Config } from '../config.js';
import type { Db } from '../db/index.js';
import { SessionRepository } from '../db/repositories/session.repo.js';
import { PollCursorRepository } from '../db/repositories/poll-cursor.repo.js';
import { StallDetector, type StallInfo } from './stall-detector.js';

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
  private stallDetector: StallDetector;

  constructor(
    private config: Config,
    private db: Db,
  ) {
    this.sessionRepo = new SessionRepository(db);
    this.cursorRepo = new PollCursorRepository(db);
    this.stallDetector = new StallDetector(config);
  }

  async pollSession(sessionId: string): Promise<PollResult> {
    // TODO: Implement in Phase 3 Task 3.1
    throw new Error('Not implemented — Phase 3 Task 3.1');
  }

  async pollAllActive(): Promise<PollSummary> {
    // TODO: Implement in Phase 3 Task 3.2
    throw new Error('Not implemented — Phase 3 Task 3.2');
  }
}
