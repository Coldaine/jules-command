/**
 * Test fixtures — PR review factories.
 */

import type { PrReviewInsert } from '../../src/db/repositories/pr-review.repo.js';

let counter = 0;

export function makePrReview(overrides: Partial<PrReviewInsert> = {}): PrReviewInsert {
  counter++;
  return {
    prUrl: overrides.prUrl ?? `https://github.com/test/repo/pull/${counter}`,
    prNumber: overrides.prNumber ?? counter,
    repoId: overrides.repoId ?? null,
    sessionId: overrides.sessionId ?? null,
    prTitle: overrides.prTitle ?? `PR #${counter}`,
    prDescription: overrides.prDescription ?? `Test PR description ${counter}`,
    prState: overrides.prState ?? 'open',
    reviewStatus: overrides.reviewStatus ?? 'pending',
    complexityScore: overrides.complexityScore ?? null,
    complexityDetails: overrides.complexityDetails ?? null,
    linesChanged: overrides.linesChanged ?? 100,
    filesChanged: overrides.filesChanged ?? 5,
    testFilesChanged: overrides.testFilesChanged ?? 2,
    criticalFilesTouched: overrides.criticalFilesTouched ?? false,
    ciStatus: overrides.ciStatus ?? 'pending',
    autoMergeEligible: overrides.autoMergeEligible ?? false,
    autoMergeReason: overrides.autoMergeReason ?? null,
    reviewNotes: overrides.reviewNotes ?? null,
    prCreatedAt: overrides.prCreatedAt ?? new Date().toISOString(),
    firstSeenAt: overrides.firstSeenAt ?? new Date().toISOString(),
    lastCheckedAt: overrides.lastCheckedAt ?? new Date().toISOString(),
    mergedAt: overrides.mergedAt ?? null,
  };
}

export function makeAutoMergeEligiblePR(overrides: Partial<PrReviewInsert> = {}): PrReviewInsert {
  return makePrReview({
    complexityScore: 0.15,
    complexityDetails: JSON.stringify({ risk: 'low', factors: [] }),
    autoMergeEligible: true,
    autoMergeReason: 'Low complexity, all tests pass, no critical files',
    ciStatus: 'success',
    reviewStatus: 'pending',
    ...overrides,
  });
}
