/**
 * Dashboard — aggregates data from DB into a formatted markdown summary.
 */

import type { Db } from '../db/index.js';
import type { Config } from '../config.js';

export class DashboardService {
  constructor(
    private _db: Db,
    private _config: Config,
  ) {
    void this._db;
    void this._config;
  }

  async generate(_opts?: { includeCompleted?: boolean; hours?: number }): Promise<string> {
    return '# Dashboard\n\nStatus: [NOT IMPLEMENTED]';
  }

  async generateCompact(): Promise<string> {
    return 'Status: [NOT IMPLEMENTED]';
  }
}
