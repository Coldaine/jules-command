/**
 * JulesService — wraps @google/jules-sdk with DB persistence.
 *
 * Every API interaction is recorded in the local database.
 */

import { connect } from '@google/jules-sdk';
import type { JulesClient } from '@google/jules-sdk';
import type { Config } from '../config.js';
import type { Db } from '../db/index.js';
import { SessionRepository, type SessionRow } from '../db/repositories/session.repo.js';
import { ActivityRepository, type ActivityRow } from '../db/repositories/activity.repo.js';
import { randomUUID } from 'node:crypto';

// ─── State mapping: SDK camelCase → DB snake_case ───────────────────────────

const SDK_TO_DB_STATE: Record<string, string> = {
  unspecified: 'unspecified',
  queued: 'queued',
  planning: 'planning',
  awaitingPlanApproval: 'awaiting_plan_approval',
  awaitingUserFeedback: 'awaiting_user_feedback',
  inProgress: 'in_progress',
  paused: 'paused',
  failed: 'failed',
  completed: 'completed',
};

function mapSdkState(sdkState: string): string {
  return SDK_TO_DB_STATE[sdkState] ?? sdkState;
}

// ─── Public types ───────────────────────────────────────────────────────────

export interface CreateSessionOpts {
  prompt: string;
  repo?: string;
  branch?: string;
  autoPr?: boolean;
  requireApproval?: boolean;
  title?: string;
}

// ─── Service ────────────────────────────────────────────────────────────────

export class JulesService {
  private client: JulesClient;
  private sessions: SessionRepository;
  private activities: ActivityRepository;

  constructor(config: Config, db: Db) {
    if (!config.julesApiKey) {
      throw new Error('Jules API key is required');
    }
    this.client = connect({ apiKey: config.julesApiKey });
    this.sessions = new SessionRepository(db);
    this.activities = new ActivityRepository(db);
  }

  // ─── DB-only operations ────────────────────────────────────────────

  async listSessions(
    filters?: { state?: string; repo?: string; limit?: number },
  ): Promise<SessionRow[]> {
    if (filters?.state) {
      return this.sessions.findByState(filters.state);
    }
    if (filters?.repo) {
      return this.sessions.findByRepoId(filters.repo, filters?.limit);
    }
    return this.sessions.findAll(filters?.limit);
  }

  async getActivities(
    sessionId: string,
    opts?: { type?: string; limit?: number; since?: string },
  ): Promise<ActivityRow[]> {
    if (opts?.since) {
      return this.activities.findSince(sessionId, opts.since, opts.limit);
    }
    if (opts?.type) {
      return this.activities.findBySessionAndType(
        sessionId,
        opts.type,
        opts.limit,
      );
    }
    return this.activities.findBySessionId(sessionId, opts?.limit);
  }

  async getBashOutputs(sessionId: string): Promise<ActivityRow[]> {
    return this.activities.findBySessionAndType(sessionId, 'bash_output');
  }

  // ─── SDK + DB operations ──────────────────────────────────────────

  async getSession(sessionId: string): Promise<SessionRow> {
    // Try local DB first
    const existing = await this.sessions.findById(sessionId);
    if (existing) return existing;

    // Fall back to SDK
    const sessionClient = this.client.session(sessionId);
    const info = await sessionClient.info();
    const now = new Date().toISOString();

    return this.sessions.upsert({
      id: info.id,
      title: info.title ?? null,
      prompt: info.prompt,
      state: mapSdkState(info.state),
      julesUrl: info.url,
      createdAt: info.createTime ?? now,
      updatedAt: now,
    });
  }

  async createSession(
    opts: CreateSessionOpts,
  ): Promise<{ sessionId: string; url: string }> {
    const sessionClient = await this.client.session({
      prompt: opts.prompt,
      title: opts.title,
      requireApproval: opts.requireApproval,
      autoPr: opts.autoPr,
      source: opts.repo
        ? { github: opts.repo, baseBranch: opts.branch ?? 'main' }
        : undefined,
    });

    const info = await sessionClient.info();
    const now = new Date().toISOString();
    const url = info.url;

    await this.sessions.upsert({
      id: info.id,
      title: opts.title ?? info.title ?? null,
      prompt: opts.prompt,
      state: mapSdkState(info.state),
      automationMode: opts.autoPr ? 'auto_pr' : null,
      requirePlanApproval: opts.requireApproval ?? false,
      julesUrl: url,
      createdAt: now,
      updatedAt: now,
    });

    return { sessionId: info.id, url };
  }

  async approvePlan(sessionId: string): Promise<void> {
    const sessionClient = this.client.session(sessionId);
    await sessionClient.approve();

    const info = await sessionClient.info();
    const now = new Date().toISOString();

    await this.sessions.upsert({
      id: sessionId,
      prompt: info.prompt,
      state: mapSdkState(info.state),
      planApprovedAt: now,
      createdAt: info.createTime ?? now,
      updatedAt: now,
    });
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const sessionClient = this.client.session(sessionId);
    await sessionClient.send(message);

    // Sync session to DB (ensures FK constraint for activities)
    const info = await sessionClient.info();
    const now = new Date().toISOString();
    await this.sessions.upsert({
      id: sessionId,
      prompt: info.prompt,
      state: mapSdkState(info.state),
      createdAt: info.createTime ?? now,
      updatedAt: now,
    });

    // Record outgoing message as activity
    await this.activities.insertMany([
      {
        id: randomUUID(),
        sessionId,
        activityType: 'message',
        content: message,
        timestamp: now,
      },
    ]);
  }

  async askAndWait(sessionId: string, question: string): Promise<void> {
    const sessionClient = this.client.session(sessionId);
    await sessionClient.ask(question);

    // Sync session state
    const info = await sessionClient.info();
    const now = new Date().toISOString();
    await this.sessions.upsert({
      id: sessionId,
      prompt: info.prompt,
      state: mapSdkState(info.state),
      createdAt: info.createTime ?? now,
      updatedAt: now,
    });
  }

  async getDiff(sessionId: string, file?: string): Promise<string> {
    const sessionClient = this.client.session(sessionId);
    const snapshot = await sessionClient.snapshot();
    const cs = snapshot.changeSet();
    const fullDiff = cs?.gitPatch?.unidiffPatch ?? '';

    if (!file) return fullDiff;

    // Filter diff to a specific file
    const lines = fullDiff.split('\n');
    const fileLines: string[] = [];
    let inFile = false;

    for (const line of lines) {
      if (line.startsWith('diff --git')) {
        inFile = line.includes(file);
      }
      if (inFile) {
        fileLines.push(line);
      }
    }

    return fileLines.join('\n');
  }

  async getSessionSnapshot(sessionId: string): Promise<{
    session: SessionRow;
    activities: ActivityRow[];
    currentDiff: string;
  }> {
    const session = await this.getSession(sessionId);
    const activities = await this.getActivities(sessionId);
    const currentDiff = await this.getDiff(sessionId);

    return { session, activities, currentDiff };
  }
}
