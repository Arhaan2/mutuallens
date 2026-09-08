import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import type { SqlDriver, SqlQuery, SqlResult } from '../src/store';
/** Real SQLite transaction semantics; no live Cloudflare or provider claim. */
export class TestSqlite implements SqlDriver {
  readonly db = new DatabaseSync(':memory:');
  constructor() {
    this.db.exec(
      readFileSync(
        new URL('../migrations/0001_jobs.sql', import.meta.url),
        'utf8',
      ),
    );
  }
  async batch(queries: SqlQuery[]): Promise<SqlResult[]> {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const results = queries.map((q) => {
        const rows = this.db.prepare(q.sql).all(...q.values);
        const changes = this.db.prepare('SELECT changes() AS n').get()!;
        return { rows, changes: Number(changes.n) };
      });
      this.db.exec('COMMIT');
      return results;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
