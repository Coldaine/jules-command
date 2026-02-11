import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../setup.js';
import { SessionRepository } from '@/db/repositories/session.repo.js';
import { makeSession } from '../fixtures/sessions.js';

describe('SessionRepository', () => {
  let _db: any;
  let repo: SessionRepository;

  beforeEach(() => {
    const { db } = createTestDb();
    repo = new SessionRepository(db);
  });

  describe('upsert', () => {
    it('creates a new session row', async () => {
      const session = makeSession();

      const result = await repo.upsert(session);

      expect(result).toBeDefined();
      expect(typeof result.id).toBe('string');

      // Verify in database
      const row = await repo.findById(result.id);
      expect(row).toMatchObject({
        id: result.id,
        title: session.title,
        prompt: session.prompt,
        state: session.state,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it('updates an existing session (same external_id)', async () => {
      const session1 = makeSession({ id: 'ext-123' });
      const session2 = makeSession({
        id: 'ext-123',
        state: 'completed',
        updatedAt: '2026-02-09T21:00:00.000Z'
      });

      const result1 = await repo.upsert(session1);
      const result2 = await repo.upsert(session2);

      expect(result1.id).toBe(result2.id);

      const row = await repo.findById(result1.id);
      expect(row?.state).toBe('completed');
      expect(row?.updatedAt).toBe('2026-02-09T21:00:00.000Z');
    });
  });

  describe('findByState', () => {
    it('returns only sessions in the given state', async () => {
      const session1 = makeSession({ state: 'queued' });
      const session2 = makeSession({ state: 'in_progress' });
      const session3 = makeSession({ state: 'queued' });

      await repo.upsert(session1);
      await repo.upsert(session2);
      await repo.upsert(session3);

      const queued = await repo.findByState('queued');
      const inProgress = await repo.findByState('in_progress');

      expect(queued).toHaveLength(2);
      expect(inProgress).toHaveLength(1);
      expect(queued.map(s => s.state)).toEqual(['queued', 'queued']);
    });
  });

  describe('findActive', () => {
    it('returns sessions in non-terminal states', async () => {
      const queued = makeSession({ state: 'queued' });
      const planning = makeSession({ state: 'planning' });
      const inProgress = makeSession({ state: 'in_progress' });
      const awaitingApproval = makeSession({ state: 'awaiting_plan_approval' });
      const awaitingFeedback = makeSession({ state: 'awaiting_user_feedback' });
      const completed = makeSession({ state: 'completed' });
      const failed = makeSession({ state: 'failed' });

      await repo.upsert(queued);
      await repo.upsert(planning);
      await repo.upsert(inProgress);
      await repo.upsert(awaitingApproval);
      await repo.upsert(awaitingFeedback);
      await repo.upsert(completed);
      await repo.upsert(failed);

      const active = await repo.findActive();

      expect(active).toHaveLength(5);
      const states = active.map(s => s.state).sort();
      expect(states).toEqual(['awaiting_plan_approval', 'awaiting_user_feedback', 'in_progress', 'planning', 'queued']);
    });
  });

  describe('findAll', () => {
    it('returns all sessions ordered by created_at desc', async () => {
      const session1 = makeSession({ createdAt: new Date('2026-02-09T20:00:00Z').toISOString() });
      const session2 = makeSession({ createdAt: new Date('2026-02-09T21:00:00Z').toISOString() });
      const session3 = makeSession({ createdAt: new Date('2026-02-09T19:00:00Z').toISOString() });

      await repo.upsert(session1);
      await repo.upsert(session2);
      await repo.upsert(session3);

      const all = await repo.findAll();

      expect(all).toHaveLength(3);
      expect(new Date(all[0].createdAt).getTime()).toBeGreaterThan(new Date(all[1].createdAt).getTime());
      expect(new Date(all[1].createdAt).getTime()).toBeGreaterThan(new Date(all[2].createdAt).getTime());
    });
  });
});