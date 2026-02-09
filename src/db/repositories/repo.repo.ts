/**
 * RepoRepository — CRUD for repos table.
 */

import { eq } from 'drizzle-orm';
import type { Db } from '../index.js';
import { repos } from '../schema.js';

export type RepoRow = typeof repos.$inferSelect;
export type RepoInsert = typeof repos.$inferInsert;

export class RepoRepository {
  constructor(private db: Db) {}

  async upsert(repo: RepoInsert): Promise<void> {
    await this.db
      .insert(repos)
      .values(repo)
      .onConflictDoUpdate({
        target: repos.id,
        set: { ...repo, id: undefined },
      });
  }

  async findById(id: string): Promise<RepoRow | undefined> {
    const rows = await this.db
      .select()
      .from(repos)
      .where(eq(repos.id, id))
      .limit(1);
    return rows[0];
  }

  async findAll(): Promise<RepoRow[]> {
    return this.db.select().from(repos);
  }

  async findJulesConnected(): Promise<RepoRow[]> {
    return this.db
      .select()
      .from(repos)
      .where(eq(repos.julesConnected, true));
  }
}
