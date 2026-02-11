/**
 * PollManager — orchestrates polling cycles for Jules sessions and GitHub PRs.
 */

import type { Config } from '../config.js';
import type { Db } from '../db/index.js';
import type { StallInfo } from './stall-detector.js';
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
  constructor(
    private _jules: JulesService,
    private _github: GitHubService,
    private _config: Config,
    private _db: Db,
  ) {
    void this._jules;
    void this._github;
    void this._config;
    void this._db;
  }

  async pollSession(sessionId: string): Promise<PollResult> {
    return {
      sessionId,
      updated: false,
      stall: null,
      error: 'Not implemented',
    };
  }

  async pollAllActive(): Promise<PollSummary> {
    return {
      sessionsPolled: 0,
      sessionsUpdated: 0,
      stallsDetected: [],
      prsUpdated: 0,
      errors: [],
    };
  }
}
