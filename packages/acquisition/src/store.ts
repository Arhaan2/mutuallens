import type { D1Database } from '@cloudflare/workers-types';
import type { AccountRecord, Direction } from '../../core/src/types';

export type SqlValue = string | number | null;
export interface SqlQuery {
  sql: string;
  values: SqlValue[];
}
export interface SqlResult {
  rows: Record<string, unknown>[];
  changes: number;
}
/** Small SQL driver contract, allowing the same transactional statements to be tested on SQLite. */
export interface SqlDriver {
  batch(queries: SqlQuery[]): Promise<SqlResult[]>;
}
export class D1Driver implements SqlDriver {
  constructor(private readonly db: D1Database) {}
  async batch(queries: SqlQuery[]): Promise<SqlResult[]> {
    const results = await this.db.batch<Record<string, unknown>>(
      queries.map((q) => this.db.prepare(q.sql).bind(...q.values)),
    );
    return results.map((result) => ({
      rows: result.results ?? [],
      changes: result.meta.changes,
    }));
  }
}
const query = (sql: string, ...values: SqlValue[]): SqlQuery => ({
  sql,
  values,
});
export interface StoredJob<T> {
  id: string;
  payload: T;
  expiresAt: number;
  leaseToken: string | null;
  cancelRequested: boolean;
}
export interface RecordInsertResult {
  total: number;
  conflictCount: number;
}
export class CapacityError extends Error {
  readonly code = 'SERVICE_CAPACITY';
  constructor() {
    super(
      'The free service capacity is currently in use or exhausted. Try later; no shortened scan was started.',
    );
  }
}
export class JobStore<T extends { spentMicros: number }> {
  constructor(private readonly sql: SqlDriver) {}
  async get(
    id: string,
    session: string,
    now: number,
  ): Promise<StoredJob<T> | null> {
    const [r] = await this.sql.batch([
      query(
        'SELECT id,payload,expires_at,lease_token,cancel_requested FROM jobs WHERE id=? AND session_hash=? AND expires_at>?',
        id,
        session,
        now,
      ),
    ]);
    const row = r!.rows[0];
    return row
      ? {
          id: String(row.id),
          cancelRequested: row.cancel_requested === 1,
          payload: JSON.parse(String(row.payload)) as T,
          expiresAt: Number(row.expires_at),
          leaseToken: row.lease_token === null ? null : String(row.lease_token),
        }
      : null;
  }
  async find(
    session: string,
    key: string,
    now: number,
  ): Promise<StoredJob<T> | null> {
    const [r] = await this.sql.batch([
      query(
        'SELECT id FROM jobs WHERE session_hash=? AND request_key=? AND expires_at>?',
        session,
        key,
        now,
      ),
    ]);
    return r!.rows[0] ? this.get(String(r!.rows[0].id), session, now) : null;
  }
  async create(input: {
    id: string;
    session: string;
    key: string;
    period: string;
    ceiling: number;
    reservation: number;
    payload: T;
    expiresAt: number;
    now: number;
  }): Promise<string> {
    const {
      id,
      session,
      key,
      period,
      ceiling,
      reservation,
      payload,
      expiresAt,
      now,
    } = input;
    const existing = await this.sql.batch([
      query(
        'SELECT id FROM jobs WHERE session_hash=? AND request_key=? AND expires_at>?',
        session,
        key,
        now,
      ),
      query(
        'SELECT request_key FROM receipts WHERE session_hash=? AND request_key=? AND expires_at>?',
        session,
        key,
        now,
      ),
    ]);
    if (existing[0]!.rows[0]) return String(existing[0]!.rows[0].id);
    if (existing[1]!.rows.length)
      throw new Error('This request has expired. Start a new scan explicitly.');
    const results = await this.sql.batch([
      query(
        'INSERT INTO capacity(period,ceiling) VALUES(?,?) ON CONFLICT(period) DO UPDATE SET ceiling=MIN(ceiling,excluded.ceiling)',
        period,
        ceiling,
      ),
      query(
        `INSERT INTO jobs(id,session_hash,request_key,period,reservation,payload,expires_at)
        SELECT ?,?,?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM jobs WHERE active=1)
        AND EXISTS(SELECT 1 FROM capacity WHERE period=? AND spent+reserved+?<=ceiling)
        AND NOT EXISTS(SELECT 1 FROM receipts WHERE session_hash=? AND request_key=? AND expires_at>?)
        ON CONFLICT(session_hash,request_key) DO NOTHING`,
        id,
        session,
        key,
        period,
        reservation,
        JSON.stringify(payload),
        expiresAt,
        period,
        reservation,
        session,
        key,
        now,
      ),
      query(
        'UPDATE capacity SET reserved=reserved+? WHERE period=? AND EXISTS(SELECT 1 FROM jobs WHERE id=? AND session_hash=? AND request_key=? AND active=1)',
        reservation,
        period,
        id,
        session,
        key,
      ),
      query(
        'SELECT id FROM jobs WHERE session_hash=? AND request_key=? AND expires_at>?',
        session,
        key,
        now,
      ),
    ]);
    const row = results[3]!.rows[0];
    if (!row) throw new CapacityError();
    return String(row.id);
  }
  async requestCancel(id: string, session: string, now: number): Promise<void> {
    await this.sql.batch([
      query(
        'UPDATE jobs SET cancel_requested=1 WHERE id=? AND session_hash=? AND expires_at>?',
        id,
        session,
        now,
      ),
    ]);
  }
  async claim(
    id: string,
    session: string,
    now: number,
  ): Promise<string | null> {
    const token = crypto.randomUUID();
    const [r] = await this.sql.batch([
      query(
        'UPDATE jobs SET lease_token=?,lease_until=? WHERE id=? AND session_hash=? AND expires_at>? AND lease_until<=? RETURNING id',
        token,
        now + 60000,
        id,
        session,
        now,
        now,
      ),
    ]);
    return r!.rows.length ? token : null;
  }
  async save(
    id: string,
    token: string,
    payload: T,
    now: number,
    release = true,
  ): Promise<void> {
    if (!Number.isSafeInteger(now)) throw new Error('Invalid checkpoint time.');
    const [r] = await this.sql.batch([
      query(
        'UPDATE jobs SET payload=?,lease_token=?,lease_until=CASE WHEN ? THEN 0 ELSE ? END WHERE id=? AND lease_token=? AND active=1 AND expires_at>? AND lease_until>?',
        JSON.stringify(payload),
        release ? null : token,
        release ? 1 : 0,
        now + 60000,
        id,
        token,
        now,
        now,
      ),
    ]);
    if (r!.changes !== 1)
      throw new Error(
        'The scan checkpoint lease changed; retry status before continuing.',
      );
  }
  async addRecords(
    id: string,
    token: string,
    direction: Direction,
    records: AccountRecord[],
    now: number,
  ): Promise<RecordInsertResult> {
    if (!Number.isSafeInteger(now)) throw new Error('Invalid checkpoint time.');
    const payload = JSON.stringify(records);
    const results = await this.sql.batch([
      query(
        'SELECT id FROM jobs WHERE id=? AND lease_token=? AND active=1 AND expires_at>? AND lease_until>?',
        id,
        token,
        now,
        now,
      ),
      query(
        `SELECT COUNT(DISTINCT incoming.key) AS n FROM json_each(?) AS incoming
        JOIN records AS existing ON existing.job_id=? AND existing.direction=?
        WHERE ((json_extract(existing.payload,'$.username')=json_extract(incoming.value,'$.username')
          AND json_extract(existing.payload,'$.id') IS NOT NULL
          AND json_extract(incoming.value,'$.id') IS NOT NULL
          AND json_extract(existing.payload,'$.id')<>json_extract(incoming.value,'$.id'))
        OR (json_extract(existing.payload,'$.id') IS NOT NULL
          AND json_extract(incoming.value,'$.id') IS NOT NULL
          AND json_extract(existing.payload,'$.id')=json_extract(incoming.value,'$.id')
          AND json_extract(existing.payload,'$.username')<>json_extract(incoming.value,'$.username')))
        AND EXISTS(SELECT 1 FROM jobs WHERE id=? AND lease_token=? AND active=1 AND expires_at>? AND lease_until>?)`,
        payload,
        id,
        direction,
        id,
        token,
        now,
        now,
      ),
      query(
        `UPDATE records AS existing SET payload=(
          SELECT incoming.value FROM json_each(?) AS incoming
          WHERE json_extract(incoming.value,'$.username')=json_extract(existing.payload,'$.username')
          AND json_extract(incoming.value,'$.id') IS NOT NULL LIMIT 1)
        WHERE existing.job_id=? AND existing.direction=?
        AND json_extract(existing.payload,'$.id') IS NULL
        AND EXISTS(SELECT 1 FROM json_each(?) AS incoming
          WHERE json_extract(incoming.value,'$.username')=json_extract(existing.payload,'$.username')
          AND json_extract(incoming.value,'$.id') IS NOT NULL)
        AND EXISTS(SELECT 1 FROM jobs WHERE id=? AND lease_token=? AND active=1 AND expires_at>? AND lease_until>?)`,
        payload,
        id,
        direction,
        payload,
        id,
        token,
        now,
        now,
      ),
      query(
        `INSERT INTO records(job_id,direction,identity,payload)
        SELECT ?,?,CASE WHEN json_extract(incoming.value,'$.id') IS NULL THEN 'u:'||json_extract(incoming.value,'$.username') ELSE 'id:'||json_extract(incoming.value,'$.id') END,incoming.value
        FROM json_each(?) AS incoming
        WHERE EXISTS(SELECT 1 FROM jobs WHERE id=? AND lease_token=? AND active=1 AND expires_at>? AND lease_until>?)
        AND NOT EXISTS(SELECT 1 FROM records AS existing
          WHERE existing.job_id=? AND existing.direction=?
          AND (json_extract(existing.payload,'$.username')=json_extract(incoming.value,'$.username')
            OR (json_extract(existing.payload,'$.id') IS NOT NULL
              AND json_extract(incoming.value,'$.id') IS NOT NULL
              AND json_extract(existing.payload,'$.id')=json_extract(incoming.value,'$.id'))))
        ON CONFLICT DO NOTHING`,
        id,
        direction,
        payload,
        id,
        token,
        now,
        now,
        id,
        direction,
      ),
      query(
        'SELECT COUNT(*) AS n FROM records WHERE job_id=? AND direction=?',
        id,
        direction,
      ),
    ]);
    if (!results[0]!.rows.length)
      throw new Error(
        'The scan checkpoint lease changed; retry status before continuing.',
      );
    return {
      conflictCount: Number(results[1]!.rows[0]!.n),
      total: Number(results[4]!.rows[0]!.n),
    };
  }
  async records(
    id: string,
    direction: Direction,
    offset: number,
    limit = 200,
  ): Promise<AccountRecord[]> {
    const [r] = await this.sql.batch([
      query(
        'SELECT payload FROM records WHERE job_id=? AND direction=? ORDER BY identity LIMIT ? OFFSET ?',
        id,
        direction,
        limit,
        offset,
      ),
    ]);
    return r!.rows.map(
      (row) => JSON.parse(String(row.payload)) as AccountRecord,
    );
  }
  async finish(
    id: string,
    token: string,
    payload: T,
    now: number,
    uncertain = false,
  ): Promise<void> {
    if (
      !Number.isSafeInteger(now) ||
      !Number.isSafeInteger(payload.spentMicros) ||
      payload.spentMicros < 0
    )
      throw new Error('Invalid capacity checkpoint.');
    const charged = uncertain ? null : payload.spentMicros;
    const results = await this.sql.batch([
      query(
        `UPDATE capacity SET reserved=reserved-(SELECT reservation FROM jobs WHERE id=?),
        spent=spent+CASE WHEN ? THEN (SELECT reservation FROM jobs WHERE id=?) ELSE ? END
        WHERE period=(SELECT period FROM jobs WHERE id=? AND lease_token=? AND active=1 AND expires_at>? AND lease_until>?)
        AND reserved>=(SELECT reservation FROM jobs WHERE id=?)
        AND (CASE WHEN ? THEN (SELECT reservation FROM jobs WHERE id=?) ELSE ? END)<=(SELECT reservation FROM jobs WHERE id=?)
        AND spent+(CASE WHEN ? THEN (SELECT reservation FROM jobs WHERE id=?) ELSE ? END)<=ceiling`,
        id,
        uncertain ? 1 : 0,
        id,
        charged,
        id,
        token,
        now,
        now,
        id,
        uncertain ? 1 : 0,
        id,
        charged,
        id,
        uncertain ? 1 : 0,
        id,
        charged,
      ),
      query(
        `UPDATE jobs SET payload=?,active=0,lease_token=NULL,lease_until=0
        WHERE id=? AND lease_token=? AND active=1 AND expires_at>? AND lease_until>?
        AND (CASE WHEN ? THEN reservation ELSE ? END)<=reservation`,
        JSON.stringify(payload),
        id,
        token,
        now,
        now,
        uncertain ? 1 : 0,
        charged,
      ),
    ]);
    if (results[0]!.changes !== 1 || results[1]!.changes !== 1)
      throw new Error(
        'The scan checkpoint lease changed or its capacity bound was exceeded; retry status before continuing.',
      );
  }
  /** Expiry denies reads immediately; a scheduled operator invokes cleanup even with no visitors. */
  async expired(now: number): Promise<{ id: string; payload: T }[]> {
    const [r] = await this.sql.batch([
      query(
        'SELECT id,payload FROM jobs WHERE expires_at<=? AND lease_until<=? ORDER BY active DESC,expires_at LIMIT 20',
        now,
        now,
      ),
    ]);
    return r!.rows.map((row) => ({
      id: String(row.id),
      cancelRequested: row.cancel_requested === 1,
      payload: JSON.parse(String(row.payload)) as T,
    }));
  }
  async removeExpired(
    id: string,
    now: number,
    cleanup: { id: string; payload: string }[] = [],
    spentMicros = 0,
    uncertain = true,
  ): Promise<void> {
    if (!Number.isSafeInteger(spentMicros) || spentMicros < 0)
      throw new Error('Invalid expired capacity checkpoint.');
    await this.sql.batch([
      ...cleanup.map((item) =>
        query(
          'INSERT INTO remote_cleanup(run_id,payload,created_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM jobs WHERE id=? AND expires_at<=?) ON CONFLICT DO NOTHING',
          item.id,
          item.payload,
          now,
          id,
          now,
        ),
      ),
      query(
        'INSERT INTO receipts(session_hash,request_key,expires_at) SELECT session_hash,request_key,? FROM jobs WHERE id=? AND expires_at<=? ON CONFLICT DO UPDATE SET expires_at=excluded.expires_at',
        now + 7 * 86400000,
        id,
        now,
      ),
      query(
        `UPDATE capacity SET spent=spent+CASE WHEN ? THEN (SELECT reservation FROM jobs WHERE id=?) ELSE ? END,
        reserved=reserved-(SELECT reservation FROM jobs WHERE id=?)
        WHERE period=(SELECT period FROM jobs WHERE id=? AND active=1)
        AND reserved>=(SELECT reservation FROM jobs WHERE id=?)
        AND (CASE WHEN ? THEN (SELECT reservation FROM jobs WHERE id=?) ELSE ? END)<=(SELECT reservation FROM jobs WHERE id=?)`,
        uncertain ? 1 : 0,
        id,
        uncertain ? null : spentMicros,
        id,
        id,
        id,
        uncertain ? 1 : 0,
        id,
        uncertain ? null : spentMicros,
        id,
      ),
      query(
        'DELETE FROM records WHERE job_id IN(SELECT id FROM jobs WHERE id=? AND expires_at<=?)',
        id,
        now,
      ),
      query('DELETE FROM jobs WHERE id=? AND expires_at<=?', id, now),
      query('DELETE FROM receipts WHERE expires_at<=?', now),
    ]);
  }
  async pendingCleanup(
    now: number,
  ): Promise<{ id: string; payload: string }[]> {
    const [r] = await this.sql.batch([
      query(
        'SELECT run_id,payload FROM remote_cleanup WHERE attempts<12 AND next_attempt<=? ORDER BY next_attempt,created_at LIMIT 20',
        now,
      ),
    ]);
    return r!.rows.map((row) => ({
      id: String(row.run_id),
      payload: String(row.payload),
    }));
  }
  async finishCleanup(id: string): Promise<void> {
    await this.sql.batch([
      query('DELETE FROM remote_cleanup WHERE run_id=?', id),
    ]);
  }
  async retryCleanup(id: string, now: number): Promise<void> {
    await this.sql.batch([
      query(
        'UPDATE remote_cleanup SET attempts=MIN(attempts+1,12),next_attempt=?+MIN(3600000,300000*(1<<MIN(attempts,4))) WHERE run_id=?',
        now,
        id,
      ),
    ]);
  }
  async failedCleanupCount(): Promise<number> {
    const [r] = await this.sql.batch([
      query('SELECT COUNT(*) AS n FROM remote_cleanup WHERE attempts>=12'),
    ]);
    return Number(r!.rows[0]!.n);
  }
  async pruneReceipts(now: number): Promise<void> {
    await this.sql.batch([
      query('DELETE FROM receipts WHERE expires_at<=?', now),
    ]);
  }
}
