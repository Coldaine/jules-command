# GitHub Integration

[← Back to Architecture](./architecture.md)

## Overview

`GitHubService` uses `@octokit/rest` to sync repo metadata and manage PR lifecycle. The GitHub PAT is stored in Bitwarden Secrets Manager and loaded at startup.

## Capabilities

### Repo Metadata Sync (`syncRepoMetadata`)

Fetches repo information from GitHub API and persists to `repos` table.

```typescript
async syncRepoMetadata(owner: string, name: string): Promise<RepoRow>;
async syncAllRepos(): Promise<RepoRow[]>;  // syncs all known repos
```

**Data fetched:**
- `GET /repos/{owner}/{repo}` → description, default_branch, language, stars, private
- Cross-reference with Jules `sources` → set `jules_connected`

### PR Status Sync (`syncPrStatus`)

Fetches PR state from GitHub and updates `pr_reviews` table.

```typescript
async syncPrStatus(prUrl: string): Promise<PrReviewRow>;
```

**Data fetched:**
- `GET /repos/{owner}/{repo}/pulls/{number}` → state, title, description, mergeable
- `GET /repos/{owner}/{repo}/pulls/{number}/reviews` → review decisions
- `GET /repos/{owner}/{repo}/commits/{ref}/check-runs` → CI status
- `GET /repos/{owner}/{repo}/pulls/{number}/files` → files changed, additions, deletions

**Computed on sync:**
- `lines_changed` = sum of additions + deletions
- `files_changed` = count of files
- `test_files_changed` = files matching `*.test.*`, `*.spec.*`, `__tests__/**`
- `critical_files_touched` = any file matching critical patterns
- `complexity_score` via `ComplexityScorer`
- `auto_merge_eligible` via `AutoMergeEvaluator`

### Merge PR (`mergePr`)

```typescript
async mergePr(prUrl: string, method?: 'merge' | 'squash' | 'rebase'): Promise<MergeResult>;
```

Pre-merge checks:
1. PR is open
2. CI status is `success`
3. No merge conflicts (`mergeable` is true)
4. Review status is `approved` or `auto_merge_eligible`

Post-merge:
- Update `pr_reviews.merged_at`
- Update `pr_reviews.review_status = 'merged'`

## Authentication

GitHub token retrieval flow:

```
1. Check GITHUB_TOKEN env var
2. If not set, attempt Bitwarden Secrets Manager:
   bws get secret <secret-id> --access-token <BWS_ACCESS_TOKEN>
3. Cache token in memory for session lifetime
```

Required env vars:
- `GITHUB_TOKEN` (direct) OR
- `BWS_ACCESS_TOKEN` + `BWS_GITHUB_SECRET_ID` (from Bitwarden)

## Rate Limiting

- GitHub API allows 5000 req/hr for authenticated requests
- Check `X-RateLimit-Remaining` header after each call
- If remaining < 10: pause until `X-RateLimit-Reset` time
- Log warnings at remaining < 100
