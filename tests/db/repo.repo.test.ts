import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDb } from '../setup.js';
import { RepoRepository } from '@/db/repositories/repo.repo.js';
import { makeRepo } from '../fixtures/repos.js';

describe('RepoRepository', () => {
  let db: any;
  let repo: RepoRepository;

  beforeEach(() => {
    const { db: drizzleDb } = createTestDb();
    repo = new RepoRepository(drizzleDb);
  });

  describe('upsert', () => {
    it('creates a new repo with all fields', async () => {
      const repoData = makeRepo({
        id: 'test-owner/test-repo',
        owner: 'test-owner',
        name: 'test-repo',
        description: 'A test repository',
        stars: 42,
        isPrivate: true,
        julesConnected: false,
      });

      await repo.upsert(repoData);

      const found = await repo.findById('test-owner/test-repo');
      expect(found).toMatchObject({
        id: 'test-owner/test-repo',
        owner: 'test-owner',
        name: 'test-repo',
        description: 'A test repository',
        stars: 42,
        isPrivate: true,
        julesConnected: false,
      });
    });

    it('updates an existing repo', async () => {
      const initial = makeRepo({
        id: 'test-owner/test-repo',
        stars: 10,
        julesConnected: false,
      });

      await repo.upsert(initial);

      const updated = makeRepo({
        id: 'test-owner/test-repo',
        stars: 20,
        julesConnected: true,
      });

      await repo.upsert(updated);

      const found = await repo.findById('test-owner/test-repo');
      expect(found?.stars).toBe(20);
      expect(found?.julesConnected).toBe(true);
    });
  });

  describe('findById', () => {
    it('returns the repo when found', async () => {
      const repoData = makeRepo({ id: 'test-owner/test-repo' });
      await repo.upsert(repoData);

      const found = await repo.findById('test-owner/test-repo');
      expect(found?.id).toBe('test-owner/test-repo');
    });

    it('returns undefined when not found', async () => {
      const found = await repo.findById('nonexistent/repo');
      expect(found).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('returns all repos', async () => {
      const repo1 = makeRepo({ id: 'owner1/repo1' });
      const repo2 = makeRepo({ id: 'owner2/repo2' });

      await repo.upsert(repo1);
      await repo.upsert(repo2);

      const all = await repo.findAll();
      expect(all).toHaveLength(2);
      expect(all.map(r => r.id)).toEqual(['owner1/repo1', 'owner2/repo2']);
    });
  });

  describe('findJulesConnected', () => {
    it('returns only repos with jules_connected = true', async () => {
      const connected = makeRepo({
        id: 'owner1/connected-repo',
        julesConnected: true,
      });
      const disconnected = makeRepo({
        id: 'owner2/disconnected-repo',
        julesConnected: false,
      });

      await repo.upsert(connected);
      await repo.upsert(disconnected);

      const julesRepos = await repo.findJulesConnected();
      expect(julesRepos).toHaveLength(1);
      expect(julesRepos[0].id).toBe('owner1/connected-repo');
    });
  });
});