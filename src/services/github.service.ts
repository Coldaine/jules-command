/**
 * GitHubService — GitHub API integration via Octokit.
 *
 * Handles repo metadata sync, PR status tracking, and merge operations.
 */

import type { Config } from '../config.js';
import type { Db } from '../db/index.js';
import { RepoRepository } from '../db/repositories/repo.repo.js';
import { PrReviewRepository } from '../db/repositories/pr-review.repo.js';

export class GitHubService {
  private repoRepo: RepoRepository;
  private prReviewRepo: PrReviewRepository;

  constructor(
    private config: Config,
    private db: Db,
  ) {
    this.repoRepo = new RepoRepository(db);
    this.prReviewRepo = new PrReviewRepository(db);
  }

  async syncRepoMetadata(owner: string, name: string) {
    // TODO: Fetch via Octokit, persist to repos table
    throw new Error('Not implemented — Phase 4 Task 4.1');
  }

  async syncAllRepos() {
    // TODO: Sync all known repos
    throw new Error('Not implemented — Phase 4 Task 4.1');
  }

  async syncPrStatus(prUrl: string) {
    // TODO: Fetch PR state, CI checks, reviews from GitHub
    throw new Error('Not implemented — Phase 4 Task 4.2');
  }

  async mergePr(prUrl: string, method: 'merge' | 'squash' | 'rebase' = 'squash') {
    // TODO: Merge via GitHub API with validation
    throw new Error('Not implemented — Phase 4 Task 4.3');
  }
}
