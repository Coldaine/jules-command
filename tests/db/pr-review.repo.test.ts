import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../setup.js';
import { PrReviewRepository } from '@/db/repositories/pr-review.repo.js';
import { SessionRepository } from '@/db/repositories/session.repo.js';
import { makePrReview, makeAutoMergeEligiblePR } from '../fixtures/pr-reviews.js';
import { makeSession } from '../fixtures/sessions.js';

describe('PrReviewRepository', () => {
  let db: any;
  let prReview: PrReviewRepository;
  let session: SessionRepository;

  beforeEach(() => {
    const { db: drizzleDb } = createTestDb();
    prReview = new PrReviewRepository(drizzleDb);
    session = new SessionRepository(drizzleDb);
  });

  describe('upsert', () => {
    it('creates a new PR review with complexity score', async () => {
      const reviewData = makePrReview({
        prUrl: 'https://github.com/test/repo/pull/1',
        prNumber: 1,
        complexityScore: 0.25,
        complexityDetails: JSON.stringify({ risk: 'low', factors: ['small-diff'] }),
      });

      await prReview.upsert(reviewData);

      const found = await prReview.findByPrUrl('https://github.com/test/repo/pull/1');
      expect(found).toBeDefined();
      expect(found?.complexityScore).toBe(0.25);
      expect(found?.complexityDetails).toBe(JSON.stringify({ risk: 'low', factors: ['small-diff'] }));
    });

    it('updates an existing PR review', async () => {
      const initial = makePrReview({
        prUrl: 'https://github.com/test/repo/pull/1',
        complexityScore: 0.3,
      });

      await prReview.upsert(initial);

      const updated = makePrReview({
        prUrl: 'https://github.com/test/repo/pull/1',
        complexityScore: 0.5,
        reviewStatus: 'approved',
      });

      await prReview.upsert(updated);

      const found = await prReview.findByPrUrl('https://github.com/test/repo/pull/1');
      expect(found?.complexityScore).toBe(0.5);
      expect(found?.reviewStatus).toBe('approved');
    });
  });

  describe('findByPrUrl', () => {
    it('returns the PR review when found', async () => {
      const reviewData = makePrReview({ prUrl: 'https://github.com/test/repo/pull/42' });
      await prReview.upsert(reviewData);

      const found = await prReview.findByPrUrl('https://github.com/test/repo/pull/42');
      expect(found?.prUrl).toBe('https://github.com/test/repo/pull/42');
    });

    it('returns undefined when not found', async () => {
      const found = await prReview.findByPrUrl('https://github.com/test/repo/pull/999');
      expect(found).toBeUndefined();
    });
  });

  describe('findBySessionId', () => {
    it('returns the PR review for a given session', async () => {
      // Create a session first to satisfy foreign key constraint
      const sessionData = makeSession({ id: 'session-123' });
      await session.upsert(sessionData);

      const reviewData = makePrReview({
        sessionId: 'session-123',
        prUrl: 'https://github.com/test/repo/pull/1',
      });
      await prReview.upsert(reviewData);

      const found = await prReview.findBySessionId('session-123');
      expect(found?.sessionId).toBe('session-123');
      expect(found?.prUrl).toBe('https://github.com/test/repo/pull/1');
    });

    it('returns undefined when session has no PR', async () => {
      const found = await prReview.findBySessionId('nonexistent-session');
      expect(found).toBeUndefined();
    });
  });

  describe('findAutoMergeEligible', () => {
    it('returns only PRs that are auto-merge eligible and pending', async () => {
      const eligible = makeAutoMergeEligiblePR({
        prUrl: 'https://github.com/test/repo/pull/1',
      });
      const notEligible = makePrReview({
        prUrl: 'https://github.com/test/repo/pull/2',
        autoMergeEligible: false,
        reviewStatus: 'pending',
      });
      const alreadyReviewed = makeAutoMergeEligiblePR({
        prUrl: 'https://github.com/test/repo/pull/3',
        reviewStatus: 'approved',
      });

      await prReview.upsert(eligible);
      await prReview.upsert(notEligible);
      await prReview.upsert(alreadyReviewed);

      const results = await prReview.findAutoMergeEligible();
      expect(results).toHaveLength(1);
      expect(results[0].prUrl).toBe('https://github.com/test/repo/pull/1');
      expect(results[0].autoMergeEligible).toBe(true);
      expect(results[0].reviewStatus).toBe('pending');
    });

    it('returns empty array when no eligible PRs exist', async () => {
      const results = await prReview.findAutoMergeEligible();
      expect(results).toHaveLength(0);
    });
  });

  describe('findPending', () => {
    it('returns all PRs with pending review status', async () => {
      const pending1 = makePrReview({
        prUrl: 'https://github.com/test/repo/pull/1',
        reviewStatus: 'pending',
      });
      const pending2 = makePrReview({
        prUrl: 'https://github.com/test/repo/pull/2',
        reviewStatus: 'pending',
      });
      const approved = makePrReview({
        prUrl: 'https://github.com/test/repo/pull/3',
        reviewStatus: 'approved',
      });

      await prReview.upsert(pending1);
      await prReview.upsert(pending2);
      await prReview.upsert(approved);

      const results = await prReview.findPending();
      expect(results).toHaveLength(2);
      expect(results.every(pr => pr.reviewStatus === 'pending')).toBe(true);
    });

    it('returns empty array when no pending reviews exist', async () => {
      const results = await prReview.findPending();
      expect(results).toHaveLength(0);
    });
  });
});
