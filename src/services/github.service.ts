/**
 * GitHubService — GitHub API integration via Octokit.
 *
 * Handles repo metadata sync, PR status tracking, and merge operations.
 */

import { Octokit } from '@octokit/rest';
import type { Config } from '../config.js';
import type { Db } from '../db/index.js';
import { RepoRepository } from '../db/repositories/repo.repo.js';
import { PrReviewRepository } from '../db/repositories/pr-review.repo.js';
import { parsePrUrl } from '../utils/pr-url.js';
import { ComplexityScorer } from './complexity-scorer.js';

export class GitHubService {
  private octokit: Octokit;
  private repos: RepoRepository;
  private prReviews: PrReviewRepository;
  private complexityScorer: ComplexityScorer;

  constructor(
    config: Config,
    db: Db,
  ) {
    if (!config.githubToken) {
      throw new Error('GitHub token is required');
    }
    
    this.octokit = new Octokit({ auth: config.githubToken });
    this.repos = new RepoRepository(db);
    this.prReviews = new PrReviewRepository(db);
    this.complexityScorer = new ComplexityScorer(config);
  }

  async syncRepoMetadata(owner: string, name: string) {
    try {
      const { data } = await this.octokit.repos.get({ owner, repo: name });
      
      await this.repos.upsert({
        id: `${owner}/${name}`,
        owner,
        name,
        fullName: data.full_name,
        description: data.description,
        defaultBranch: data.default_branch,
        primaryLanguage: data.language,
        stars: data.stargazers_count,
        isPrivate: data.private,
        syncedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(`Repository ${owner}/${name} not found`);
      }
      if (error.status === 429) {
        throw new Error('GitHub API rate limit exceeded');
      }
      throw error;
    }
  }

  async syncAllRepos() {
    const allRepos = await this.repos.findAll();

    for (const repo of allRepos) {
      try {
        await this.syncRepoMetadata(repo.owner, repo.name);
      } catch (error: any) {
        // Continue on individual failures - log error message only for security
        const errorMessage = error?.message || 'Unknown error';
        console.error(`Failed to sync ${repo.owner}/${repo.name}: ${errorMessage}`);
      }
    }
  }

  async syncPrStatus(prUrl: string) {
    const { owner, repo, number } = parsePrUrl(prUrl);
    
    try {
      // Ensure repo exists in DB (upsert with minimal data)
      const repoId = `${owner}/${repo}`;
      await this.repos.upsert({
        id: repoId,
        owner,
        name: repo,
        fullName: `${owner}/${repo}`,
      });
      
      // Fetch PR details
      const { data: pr } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: number,
      });
      
      // Fetch CI status
      const ciStatus = await this.extractCiStatus(owner, repo, pr.head.sha);
      
      // Fetch review state (default to 'pending' if null)
      const reviewStatus = (await this.extractReviewStatus(owner, repo, number)) ?? 'pending';
      
      // Fetch files to calculate complexity metrics
      const { data: files } = await this.octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: number,
      });

      const linesChanged = pr.additions + pr.deletions;
      // Use files.length for consistency with other file-based metrics
      const filesChanged = files.length;
      const testFilesChanged = files.filter(f =>
        f.filename.includes('.test.') ||
        f.filename.includes('.spec.') ||
        f.filename.includes('__tests__')
      ).length;
      
      const criticalFilesTouched = files.some(f =>
        f.filename === 'package.json' ||
        f.filename === 'package-lock.json' ||
        f.filename === 'yarn.lock' ||
        f.filename === 'pnpm-lock.yaml' ||
        f.filename.endsWith('.config.js') ||
        f.filename.endsWith('.config.ts') ||
        f.filename === 'Dockerfile' ||
        f.filename === 'docker-compose.yml'
      );
      
      const dependencyFilesTouched = files.some(f =>
        f.filename === 'package.json' ||
        f.filename === 'package-lock.json' ||
        f.filename === 'yarn.lock' ||
        f.filename === 'pnpm-lock.yaml'
      );
      
      // Calculate complexity
      const complexity = this.complexityScorer.score({
        linesChanged,
        filesChanged,
        testFilesChanged,
        criticalFilesTouched,
        dependencyFilesTouched,
      });
      
      await this.prReviews.upsert({
        prUrl,
        prNumber: number,
        repoId: `${owner}/${repo}`,
        prTitle: pr.title,
        prDescription: pr.body || undefined,
        prState: pr.state,
        reviewStatus,
        ciStatus,
        linesChanged,
        filesChanged,
        testFilesChanged,
        criticalFilesTouched,
        complexityScore: complexity.score,
        complexityDetails: JSON.stringify(complexity.details),
        prCreatedAt: pr.created_at,
        lastCheckedAt: new Date().toISOString(),
      });
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(`Pull request ${prUrl} not found`);
      }
      if (error.status === 429) {
        throw new Error('GitHub API rate limit exceeded');
      }
      throw error;
    }
  }

  private async extractCiStatus(owner: string, repo: string, ref: string): Promise<string | null> {
    try {
      const { data: checks } = await this.octokit.checks.listForRef({
        owner,
        repo,
        ref,
      });

      if (checks.total_count === 0) {
        return null;
      }

      const conclusions = checks.check_runs.map(run => run.conclusion);

      if (conclusions.some(c => c === 'failure' || c === 'cancelled')) {
        return 'failure';
      }

      if (conclusions.every(c => c === 'success')) {
        return 'success';
      }

      return 'pending';
    } catch (error: any) {
      // Log error message for debugging without exposing sensitive details
      const errorMessage = error?.message || 'Unknown error';
      console.error(`Failed to extract CI status for ${owner}/${repo}@${ref}: ${errorMessage}`);
      return null;
    }
  }

  private async extractReviewStatus(owner: string, repo: string, pullNumber: number): Promise<string | null> {
    try {
      const { data: reviews } = await this.octokit.pulls.listReviews({
        owner,
        repo,
        pull_number: pullNumber,
      });

      if (reviews.length === 0) {
        return null;
      }

      // Get the latest review from each reviewer
      const latestReviews = new Map<string, string>();
      for (const review of reviews) {
        if (review.user?.login) {
          latestReviews.set(review.user.login, review.state);
        }
      }

      const states = Array.from(latestReviews.values());

      if (states.some(s => s === 'CHANGES_REQUESTED')) {
        return 'changes_requested';
      }

      if (states.some(s => s === 'APPROVED')) {
        return 'approved';
      }

      return null;
    } catch (error: any) {
      // Log error message for debugging without exposing sensitive details
      const errorMessage = error?.message || 'Unknown error';
      console.error(`Failed to extract review status for ${owner}/${repo}#${pullNumber}: ${errorMessage}`);
      return null;
    }
  }

  async mergePr(prUrl: string, method: 'merge' | 'squash' | 'rebase' = 'squash') {
    const { owner, repo, number } = parsePrUrl(prUrl);

    try {
      // Check if PR is mergeable
      const { data: pr } = await this.octokit.pulls.get({
        owner,
        repo,
        pull_number: number,
      });

      if (pr.mergeable === false) {
        throw new Error('Pull request is not mergeable due to conflicts');
      }

      if (pr.mergeable === null) {
        throw new Error('Pull request mergeable status is not yet determined');
      }

      if (pr.state !== 'open') {
        throw new Error(`Pull request is ${pr.state}, not open`);
      }

      // Merge the PR - log audit trail
      const mergedAt = new Date().toISOString();
      console.log(`Merging PR ${prUrl} using ${method} method at ${mergedAt}`);

      await this.octokit.pulls.merge({
        owner,
        repo,
        pull_number: number,
        merge_method: method,
      });

      // Update DB
      await this.prReviews.upsert({
        prUrl,
        prNumber: number,
        repoId: `${owner}/${repo}`,
        mergedAt,
      });
    } catch (error: any) {
      if (error.status === 404) {
        throw new Error(`Pull request ${prUrl} not found`);
      }
      if (error.status === 405) {
        throw new Error('Pull request merge not allowed');
      }
      if (error.status === 409) {
        throw new Error('Pull request has merge conflicts');
      }
      if (error.status === 429) {
        throw new Error('GitHub API rate limit exceeded');
      }
      throw error;
    }
  }
} 
