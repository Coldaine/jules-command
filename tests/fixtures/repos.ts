/**
 * Test fixtures — repo factories.
 */

import type { RepoInsert } from '../../src/db/repositories/repo.repo.js';

let counter = 0;

export function makeRepo(overrides: Partial<RepoInsert> = {}): RepoInsert {
  counter++;
  const owner = overrides.owner ?? 'test-owner';
  const name = overrides.name ?? `repo-${counter}`;
  return {
    id: `${owner}/${name}`,
    owner,
    name,
    fullName: `${owner}/${name}`,
    description: `Test repo ${counter}`,
    defaultBranch: 'main',
    primaryLanguage: 'TypeScript',
    stars: 0,
    isPrivate: false,
    julesSourceName: `sources/github/${owner}/${name}`,
    julesConnected: true,
    syncedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}
