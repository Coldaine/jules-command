import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../setup.js';
import { ActivityRepository } from '@/db/repositories/activity.repo.js';
import { SessionRepository } from '@/db/repositories/session.repo.js';
import { makeActivity, makePlanActivity, makeAgentMessageActivity } from '../fixtures/activities.js';
import { makeSession } from '../fixtures/sessions.js';

describe('ActivityRepository', () => {
  let db: any;
  let repo: ActivityRepository;
  let sessionRepo: SessionRepository;

  beforeEach(() => {
    const { db: drizzleDb } = createTestDb();
    repo = new ActivityRepository(drizzleDb);
    sessionRepo = new SessionRepository(drizzleDb);
  });

  describe('insertMany', () => {
    it('inserts multiple activities', async () => {
      await sessionRepo.upsert(makeSession({ id: 'session-1' }));
      await sessionRepo.upsert(makeSession({ id: 'session-2' }));

      const activities = [
        makeActivity({ sessionId: 'session-1' }),
        makeActivity({ sessionId: 'session-1' }),
        makeActivity({ sessionId: 'session-2' }),
      ];

      await repo.insertMany(activities);

      const all = await repo.findBySessionId('session-1');
      expect(all).toHaveLength(2);
    });

    it('handles duplicates with INSERT OR IGNORE', async () => {
      await sessionRepo.upsert(makeSession({ id: 'session-1' }));

      const activity1 = makeActivity({ id: 'act-1', sessionId: 'session-1' });
      const activity2 = makeActivity({ id: 'act-1', sessionId: 'session-1' }); // duplicate id

      await repo.insertMany([activity1]);
      await repo.insertMany([activity2]); // should ignore

      const all = await repo.findBySessionId('session-1');
      expect(all).toHaveLength(1);
    });
  });

  describe('findBySessionId', () => {
    it('returns activities for a session ordered by timestamp', async () => {
      await sessionRepo.upsert(makeSession({ id: 'session-1' }));
      await sessionRepo.upsert(makeSession({ id: 'session-2' }));

      const early = makeActivity({
        sessionId: 'session-1',
        timestamp: '2026-02-09T10:00:00Z'
      });
      const late = makeActivity({
        sessionId: 'session-1',
        timestamp: '2026-02-09T11:00:00Z'
      });
      const otherSession = makeActivity({
        sessionId: 'session-2',
        timestamp: '2026-02-09T12:00:00Z'
      });

      await repo.insertMany([late, early, otherSession]);

      const results = await repo.findBySessionId('session-1');
      expect(results).toHaveLength(2);
      expect(results[0].timestamp).toBe('2026-02-09T11:00:00Z'); // latest first
      expect(results[1].timestamp).toBe('2026-02-09T10:00:00Z');
    });
  });

  describe('findSince', () => {
    it('returns activities after the cursor timestamp', async () => {
      await sessionRepo.upsert(makeSession({ id: 'session-1' }));

      const old = makeActivity({
        sessionId: 'session-1',
        timestamp: '2026-02-09T10:00:00Z'
      });
      const recent = makeActivity({
        sessionId: 'session-1',
        timestamp: '2026-02-09T11:00:00Z'
      });
      const future = makeActivity({
        sessionId: 'session-1',
        timestamp: '2026-02-09T12:00:00Z'
      });

      await repo.insertMany([old, recent, future]);

      const results = await repo.findSince('session-1', '2026-02-09T10:30:00Z');
      expect(results).toHaveLength(2);
      expect(results.map(a => a.timestamp)).toEqual([
        '2026-02-09T12:00:00Z',
        '2026-02-09T11:00:00Z'
      ]);
    });

    it('returns empty array when no activities after cursor', async () => {
      await sessionRepo.upsert(makeSession({ id: 'session-1' }));

      const old = makeActivity({
        sessionId: 'session-1',
        timestamp: '2026-02-09T10:00:00Z'
      });

      await repo.insertMany([old]);

      const results = await repo.findSince('session-1', '2026-02-09T11:00:00Z');
      expect(results).toHaveLength(0);
    });
  });

  describe('findBySessionAndType', () => {
    it('returns activities of specific type for a session', async () => {
      await sessionRepo.upsert(makeSession({ id: 'session-1' }));
      await sessionRepo.upsert(makeSession({ id: 'session-2' }));

      const plan = makePlanActivity('session-1');
      const progress = makeActivity({ sessionId: 'session-1', activityType: 'progress_updated' });
      const other = makeActivity({ sessionId: 'session-2', activityType: 'plan_generated' });

      await repo.insertMany([plan, progress, other]);

      const plans = await repo.findBySessionAndType('session-1', 'plan_generated');
      expect(plans).toHaveLength(1);
      expect(plans[0].activityType).toBe('plan_generated');
    });
  });
});