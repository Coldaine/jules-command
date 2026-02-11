import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../setup.js';
import { PollCursorRepository } from '@/db/repositories/poll-cursor.repo.js';
import { makePollCursor } from '../fixtures/poll-cursors.js';

describe('PollCursorRepository', () => {
  let db: any;
  let pollCursor: PollCursorRepository;

  beforeEach(() => {
    const { db: drizzleDb } = createTestDb();
    pollCursor = new PollCursorRepository(drizzleDb);
  });

  describe('upsert', () => {
    it('creates a new poll cursor', async () => {
      const cursorData = makePollCursor({
        id: 'session-activity-cursor',
        pollType: 'session_activity',
        pollCount: 0,
      });

      await pollCursor.upsert(cursorData);

      const found = await pollCursor.findById('session-activity-cursor');
      expect(found).toBeDefined();
      expect(found?.id).toBe('session-activity-cursor');
      expect(found?.pollType).toBe('session_activity');
      expect(found?.pollCount).toBe(0);
    });

    it('updates an existing poll cursor', async () => {
      const initial = makePollCursor({
        id: 'test-cursor',
        pollCount: 5,
      });

      await pollCursor.upsert(initial);

      const updated = makePollCursor({
        id: 'test-cursor',
        pollCount: 10,
        consecutiveUnchanged: 3,
      });

      await pollCursor.upsert(updated);

      const found = await pollCursor.findById('test-cursor');
      expect(found?.pollCount).toBe(10);
      expect(found?.consecutiveUnchanged).toBe(3);
    });
  });

  describe('findById', () => {
    it('returns the cursor when found', async () => {
      const cursorData = makePollCursor({ id: 'test-cursor-123' });
      await pollCursor.upsert(cursorData);

      const found = await pollCursor.findById('test-cursor-123');
      expect(found?.id).toBe('test-cursor-123');
    });

    it('returns undefined when not found', async () => {
      const found = await pollCursor.findById('nonexistent-cursor');
      expect(found).toBeUndefined();
    });
  });

  describe('incrementPollCount', () => {
    it('increments poll count by 1 and updates lastPollAt', async () => {
      const cursorData = makePollCursor({
        id: 'increment-test',
        pollCount: 0,
      });

      await pollCursor.upsert(cursorData);

      const initialTimestamp = (await pollCursor.findById('increment-test'))?.lastPollAt;

      // Wait a tiny bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      await pollCursor.incrementPollCount('increment-test');

      const found = await pollCursor.findById('increment-test');
      expect(found?.pollCount).toBe(1);
      expect(found?.lastPollAt).not.toBe(initialTimestamp);
    });

    it('increments poll count multiple times correctly', async () => {
      const cursorData = makePollCursor({
        id: 'multi-increment',
        pollCount: 5,
      });

      await pollCursor.upsert(cursorData);

      await pollCursor.incrementPollCount('multi-increment');
      await pollCursor.incrementPollCount('multi-increment');
      await pollCursor.incrementPollCount('multi-increment');

      const found = await pollCursor.findById('multi-increment');
      expect(found?.pollCount).toBe(8);
    });

    it('throws when cursor does not exist', async () => {
      await expect(pollCursor.incrementPollCount('nonexistent-cursor'))
        .rejects.toThrow('Poll cursor not found: nonexistent-cursor');
    });
  });

  describe('findById after multiple increments', () => {
    it('returns correct cursor state after multiple operations', async () => {
      const cursorData = makePollCursor({
        id: 'complex-test',
        pollCount: 0,
        pollType: 'pr_check',
      });

      await pollCursor.upsert(cursorData);
      
      // Increment 3 times
      await pollCursor.incrementPollCount('complex-test');
      await pollCursor.incrementPollCount('complex-test');
      await pollCursor.incrementPollCount('complex-test');

      const found = await pollCursor.findById('complex-test');
      expect(found?.id).toBe('complex-test');
      expect(found?.pollCount).toBe(3);
      expect(found?.pollType).toBe('pr_check');
    });
  });
});
