/**
 * GitHubService — GitHub API integration via Octokit.
 *
 * Handles repo metadata sync, PR status tracking, and merge operations.
 */

import type { Config } from '../config.js';
import type { Db } from '../db/index.js';


export class GitHubService {
  constructor(
    _config: Config,
    _db: Db,
  ) {
    // Repositories will be created when methods are implemented.
  }

  async syncRepoMetadata(_owner: string, _name: string) {
    // TODO: Fetch via Octokit, persist to repos table
    throw new Error('Not implemented — Phase 4 Task 4.1');
  }

  async syncAllRepos() {
    // TODO: Sync all known repos
    throw new Error('Not implemented — Phase 4 Task 4.1');
  }

  async syncPrStatus(_prUrl: string) {
    // TODO: Fetch PR state, CI checks, reviews from GitHub
    throw new Error('Not implemented — Phase 4 Task 4.2');
  }

  async mergePr(_prUrl: string, _method: 'merge' | 'squash' | 'rebase' = 'squash') {
    // TODO: Merge via GitHub API with validation
    throw new Error('Not implemented — Phase 4 Task 4.3');
  }
} 
