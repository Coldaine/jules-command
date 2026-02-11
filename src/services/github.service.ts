/**
 * GitHubService — integrates with Octokit for PR and Repo metadata.
 */

import type { Config } from '../config.js';
import type { Db } from '../db/index.js';

export class GitHubService {
  constructor(
    private _config: Config,
    private _db: Db,
  ) {
    void this._config;
    void this._db;
  }

  async syncRepo(_owner: string, _name: string): Promise<void> {
  }

  async syncAllRepos(): Promise<void> {
  }

  async getPrStatus(_prUrl: string): Promise<any> {
  }

  async mergePr(_prUrl: string, _method: 'merge' | 'squash' | 'rebase'): Promise<void> {
  }
}
