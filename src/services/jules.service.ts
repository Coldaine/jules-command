/**
 * JulesService — integrates with @anthropic-ai/jules SDK.
 */

import type { Config } from '../config.js';
import type { Db } from '../db/index.js';

export interface CreateSessionOpts {
  prompt: string;
  repo?: string;
  branch?: string;
  autoPr?: boolean;
  requireApproval?: boolean;
  title?: string;
}

export class JulesService {
  constructor(
    private _config: Config,
    private _db: Db,
  ) {
    void this._config;
    void this._db;
  }

  async listSessions(_opts?: { state?: string; repo?: string; limit?: number }): Promise<any[]> {
    return [];
  }

  async getSession(_sessionId: string): Promise<any> {
    return { error: 'Not implemented' };
  }

  async getActivities(_sessionId: string, _filters: { type?: string; limit?: number; since?: string } = {}): Promise<any[]> {
    return [];
  }

  async createSession(_opts: CreateSessionOpts): Promise<any> {
    return { error: 'Not implemented' };
  }

  async approvePlan(_sessionId: string): Promise<void> {
  }

  async sendMessage(_sessionId: string, _message: string): Promise<void> {
  }

  async askAndWait(_sessionId: string, _message: string): Promise<void> {
  }

  async getDiff(_sessionId: string, _file?: string): Promise<string> {
    return '';
  }

  async getBashOutputs(_sessionId: string): Promise<any[]> {
    return [];
  }

  async getSessionSnapshot(_sessionId: string): Promise<any> {
    return { error: 'Not implemented' };
  }
}
