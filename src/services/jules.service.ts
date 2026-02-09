/**
 * JulesService — wraps @google/jules-sdk with DB persistence.
 *
 * Every API interaction is recorded in the local database.
 */

import type { Config } from '../config.js';
import type { Db } from '../db/index.js';
import { SessionRepository } from '../db/repositories/session.repo.js';
import { ActivityRepository } from '../db/repositories/activity.repo.js';

export interface CreateSessionOpts {
  prompt: string;
  repo?: string;
  branch?: string;
  autoPr?: boolean;
  requireApproval?: boolean;
  title?: string;
}

export class JulesService {
  private sessionRepo: SessionRepository;
  private activityRepo: ActivityRepository;

  constructor(
    private config: Config,
    private db: Db,
  ) {
    this.sessionRepo = new SessionRepository(db);
    this.activityRepo = new ActivityRepository(db);
  }

  async createSession(opts: CreateSessionOpts): Promise<{ sessionId: string; url: string }> {
    // TODO: Call jules.session() or jules.run() via SDK
    // Then persist to DB
    throw new Error('Not implemented — Phase 2 Task 2.1');
  }

  async getSession(sessionId: string) {
    // TODO: Fetch from SDK, upsert to DB, return
    throw new Error('Not implemented — Phase 2 Task 2.1');
  }

  async listSessions(filters?: { state?: string; repo?: string; limit?: number }) {
    // TODO: Query DB or SDK
    throw new Error('Not implemented — Phase 2 Task 2.1');
  }

  async approvePlan(sessionId: string) {
    // TODO: Call session.approve() via SDK, update DB
    throw new Error('Not implemented — Phase 2 Task 2.2');
  }

  async sendMessage(sessionId: string, message: string) {
    // TODO: Call session.send() via SDK, record activity
    throw new Error('Not implemented — Phase 2 Task 2.2');
  }

  async askAndWait(sessionId: string, message: string) {
    // TODO: Call session.ask() via SDK, record both user + agent activities
    throw new Error('Not implemented — Phase 2 Task 2.2');
  }

  async getActivities(sessionId: string, opts?: { type?: string; limit?: number; since?: string }) {
    // TODO: Fetch + cache activities
    throw new Error('Not implemented — Phase 2 Task 2.3');
  }

  async getDiff(sessionId: string, file?: string) {
    // TODO: Get unidiff patch from session snapshot
    throw new Error('Not implemented — Phase 2 Task 2.3');
  }

  async getBashOutputs(sessionId: string) {
    // TODO: Filter activities by bash output type
    throw new Error('Not implemented — Phase 2 Task 2.3');
  }

  async getSessionSnapshot(sessionId: string) {
    // TODO: Aggregate from DB
    throw new Error('Not implemented — Phase 2 Task 2.4');
  }
}
