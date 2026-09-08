import { useEffect, useRef, useState } from 'react';
import { normalizeUsername, validId } from '@mutuallens/core';
import type { AccountRecord, Dataset } from '@mutuallens/core';

type Progress = {
  id: string;
  status:
    | 'queued'
    | 'running'
    | 'complete'
    | 'partial'
    | 'cancelled'
    | 'failed'
    | 'uncertain';
  message: string;
  nextPollMs: number;
  expiresAt: string;
  followers: { observed: number; pages: number; complete: boolean };
  following: { observed: number; pages: number; complete: boolean };
};
const STORAGE_KEY = 'mutuallens-automatic-job';
const PAGE_BYTES = 4 * 1024 * 1024;
const RESULT_BYTES = 64 * 1024 * 1024;
const jobId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{8,120}$/.test(value);
function remember(id: string | null) {
  try {
    if (id) sessionStorage.setItem(STORAGE_KEY, id);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* In-memory scans remain usable when storage is unavailable. */
  }
}
function progress(value: unknown): Progress {
  const p = value as Progress;
  if (
    !p ||
    !jobId(p.id) ||
    ![
      'queued',
      'running',
      'complete',
      'partial',
      'cancelled',
      'failed',
      'uncertain',
    ].includes(p.status) ||
    typeof p.message !== 'string' ||
    !Number.isFinite(Date.parse(p.expiresAt))
  )
    throw new Error(
      'The service returned an unsupported progress response. Resume to check the saved job.',
    );
  for (const list of [p.followers, p.following])
    if (
      !list ||
      !Number.isSafeInteger(list.observed) ||
      list.observed < 0 ||
      !Number.isSafeInteger(list.pages) ||
      list.pages < 0 ||
      typeof list.complete !== 'boolean'
    )
      throw new Error(
        'The service returned invalid observed counts. No result was created.',
      );
  return p;
}
async function request(
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<{ value: unknown; bytes: number }> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const deadline = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
    });
    if (response.status === 204) return { value: null, bytes: 0 };
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let bytes = 0,
      text = '';
    if (!reader) throw new Error('The service returned an empty response.');
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > PAGE_BYTES) {
        await reader.cancel();
        throw new Error(
          'A service response exceeded the 4 MiB page safety budget. No shortened result was created.',
        );
      }
      text += decoder.decode(part.value, { stream: true });
    }
    text += decoder.decode();
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error(
        'The service returned an unreadable response. Resume the saved job instead of starting another scan.',
      );
    }
    if (!response.ok) {
      const body = value as {
        message?: unknown;
        error?: { message?: unknown };
        code?: unknown;
      };
      throw new Error(
        typeof body?.message === 'string'
          ? body.message
          : typeof body?.error?.message === 'string'
            ? body.error.message
            : `The service could not complete that request (${response.status}). Your existing report is unchanged.`,
      );
    }
    return { value, bytes };
  } catch (error) {
    if (controller.signal.aborted && !signal?.aborted)
      throw new Error(
        'The service request timed out. Its outcome may be uncertain; resume or retry the same start rather than creating another scan.',
        { cause: error },
      );
    throw error;
  } finally {
    clearTimeout(deadline);
    signal?.removeEventListener('abort', abort);
  }
}
function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException('Canceled', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}

export function AutomaticCheck({
  enabled,
  onResult,
  resetKey,
}: {
  enabled: boolean;
  onResult: (dataset: Dataset) => void;
  resetKey: number;
}) {
  const [username, setUsername] = useState('');
  const [savedId, setSavedId] = useState<string | null>(null);
  const [state, setState] = useState<Progress | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [cancelRequested, setCancelRequested] = useState(false);
  const [pendingStart, setPendingStart] = useState(false);
  const generation = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const activeId = useRef<string | null>(null);
  const completedId = useRef<string | null>(null);
  const creating = useRef<{ username: string; key: string } | null>(null);
  const working = useRef(false);
  const initialReset = useRef(resetKey);
  const resultHandler = useRef(onResult);
  resultHandler.current = onResult;

  useEffect(() => {
    try {
      const id = sessionStorage.getItem(STORAGE_KEY);
      if (jobId(id)) {
        setSavedId(id);
        activeId.current = id;
      }
    } catch {
      /* Storage is optional. */
    }
    return () => {
      ++generation.current;
      controller.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (initialReset.current === resetKey) return;
    initialReset.current = resetKey;
    ++generation.current;
    controller.current?.abort();
    const id = activeId.current;
    if (id && completedId.current !== id)
      void request(`/api/scans/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }).catch(() => {
        /* Server retention and capacity cleanup remain authoritative. */
      });
    activeId.current = null;
    creating.current = null;
    working.current = false;
    setRunning(false);
    setState(null);
    setSavedId(null);
    setError('');
    setMessage('');
    setPendingStart(false);
    setCancelRequested(false);
    remember(null);
  }, [resetKey]);

  const current = (epoch: number) => generation.current === epoch;
  function stop(messageText: string) {
    setRunning(false);
    working.current = false;
    setMessage(messageText);
  }
  async function result(id: string, signal: AbortSignal): Promise<Dataset> {
    const lists: Record<'followers' | 'following', AccountRecord[]> = {
      followers: [],
      following: [],
    };
    let dataset: Dataset | null = null,
      totalBytes = 0;
    for (const direction of ['followers', 'following'] as const) {
      let offset = 0;
      const offsets = new Set<number>();
      while (true) {
        if (offsets.has(offset))
          throw new Error(
            'The service repeated a results page. No shortened result was created.',
          );
        offsets.add(offset);
        const page = await request(
          `/api/scans/${encodeURIComponent(id)}/result?direction=${direction}&offset=${offset}`,
          {},
          signal,
        );
        totalBytes += page.bytes;
        if (totalBytes > RESULT_BYTES)
          throw new Error(
            'The downloaded result exceeded the 64 MiB result safety budget. No shortened report was created.',
          );
        const payload = page.value as {
          records: AccountRecord[];
          nextOffset: number | null;
          dataset: Dataset;
        };
        if (
          !payload ||
          !Array.isArray(payload.records) ||
          !payload.dataset ||
          payload.dataset.schemaVersion !== 1 ||
          payload.dataset.sample !== false ||
          !payload.dataset.followers?.metadata ||
          !payload.dataset.following?.metadata ||
          typeof payload.dataset.account?.username !== 'string'
        )
          throw new Error('The service returned an unsupported result format.');
        normalizeUsername(payload.dataset.account.username);
        if (
          dataset &&
          (dataset.account.username !== payload.dataset.account.username ||
            dataset.importedAt !== payload.dataset.importedAt)
        )
          throw new Error(
            'Result pages describe inconsistent snapshots. No combined report was created.',
          );
        dataset = payload.dataset;
        for (const row of payload.records) {
          if (
            !row ||
            typeof row.username !== 'string' ||
            typeof row.originalUsername !== 'string' ||
            typeof row.source !== 'string' ||
            normalizeUsername(row.username) !== row.username ||
            (row.displayName !== undefined &&
              typeof row.displayName !== 'string')
          )
            throw new Error('The service returned an invalid account record.');
          validId(row.id);
          lists[direction].push(row);
        }
        if (payload.nextOffset === null) break;
        if (
          !Number.isSafeInteger(payload.nextOffset) ||
          payload.nextOffset !== offset + payload.records.length ||
          payload.nextOffset <= offset
        )
          throw new Error('The service returned an invalid results cursor.');
        offset = payload.nextOffset;
      }
    }
    if (!dataset) throw new Error('No result was returned.');
    return {
      ...dataset,
      comparisonBasis: 'source_evidence',
      sample: false,
      followers: { ...dataset.followers, records: lists.followers },
      following: { ...dataset.following, records: lists.following },
    };
  }
  async function continueJob(
    id: string,
    epoch: number,
    signal: AbortSignal,
    cancellation = false,
  ) {
    const started = Date.now();
    while (current(epoch) && !signal.aborted) {
      if (Date.now() - started > 25 * 60 * 1000) {
        stop(
          'Automatic polling paused at its 25-minute time budget. Resume to check the saved job; no records were discarded.',
        );
        return;
      }
      const p = progress(
        (
          await request(
            `/api/scans/${encodeURIComponent(id)}/status`,
            {},
            signal,
          )
        ).value,
      );
      if (!current(epoch)) return;
      setState(p);
      if (p.status === 'complete' || p.status === 'partial') {
        if (cancellation) {
          remember(null);
          setSavedId(null);
          activeId.current = null;
          stop(
            'Cancellation requested after the source finished. No report was loaded.',
          );
          return;
        }
        const data = await result(id, signal);
        if (!current(epoch)) return;
        completedId.current = id;
        remember(null);
        setSavedId(null);
        activeId.current = null;
        stop(
          p.status === 'partial'
            ? 'Observed source records loaded. Incomplete automatic lists cannot establish non-followers.'
            : 'Source result loaded with its recorded completeness.',
        );
        resultHandler.current(data);
        return;
      }
      if (p.status === 'cancelled' || p.status === 'failed') {
        remember(null);
        setSavedId(null);
        activeId.current = null;
        stop(p.message);
        return;
      }
      if (p.status === 'uncertain') {
        stop(
          p.message ||
            'The source outcome is uncertain. Resume explicitly to check the existing job.',
        );
        return;
      }
      if (!cancellation) {
        const next = progress(
          (
            await request(
              `/api/scans/${encodeURIComponent(id)}/advance`,
              { method: 'POST' },
              signal,
            )
          ).value,
        );
        if (!current(epoch)) return;
        setState(next);
        if (next.status === 'uncertain') {
          stop(next.message);
          return;
        }
        if (
          ['complete', 'partial', 'failed', 'cancelled'].includes(next.status)
        )
          continue;
        await wait(
          Math.min(
            300000,
            Math.max(
              1000,
              Number.isFinite(next.nextPollMs) ? next.nextPollMs : 2000,
            ),
          ),
          signal,
        );
      } else {
        await wait(2000, signal);
      }
    }
  }
  async function run(resume = false) {
    if (!enabled || working.current) return;
    working.current = true;
    setRunning(true);
    setError('');
    setMessage('');
    const epoch = ++generation.current;
    controller.current?.abort();
    const control = new AbortController();
    controller.current = control;
    try {
      let id = resume ? activeId.current : null;
      if (!id) {
        const normalized = normalizeUsername(username);
        if (creating.current && creating.current.username !== normalized)
          throw new Error(
            'Retry the pending start with the same username before starting a different scan.',
          );
        creating.current ??= { username: normalized, key: crypto.randomUUID() };
        await request('/api/session', { method: 'POST' }, control.signal);
        if (!current(epoch)) return;
        setPendingStart(true);
        // Keep the bounded creation request alive on a UI reset: a late ID can be canceled before any advance.
        const created = progress(
          (
            await request('/api/scans', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                username: normalized,
                idempotencyKey: creating.current.key,
              }),
            })
          ).value,
        );
        if (!current(epoch)) {
          void request(`/api/scans/${encodeURIComponent(created.id)}`, {
            method: 'DELETE',
          }).catch(() => {});
          return;
        }
        id = created.id;
        creating.current = null;
        setPendingStart(false);
        setState(created);
        setCancelRequested(false);
        activeId.current = id;
        setSavedId(id);
        remember(id);
      }
      await continueJob(id, epoch, control.signal, resume && cancelRequested);
    } catch (failure) {
      if (current(epoch) && !control.signal.aborted) {
        setError(
          failure instanceof Error
            ? failure.message
            : 'The service request failed. Resume the existing job to retry.',
        );
        stop('Automatic polling stopped. Your current report is unchanged.');
      }
    } finally {
      if (current(epoch)) {
        working.current = false;
        setRunning(false);
      }
    }
  }
  async function cancel() {
    const id = activeId.current;
    if (!id) return;
    const epoch = ++generation.current;
    controller.current?.abort();
    working.current = true;
    setRunning(true);
    setError('');
    setCancelRequested(true);
    const control = new AbortController();
    controller.current = control;
    try {
      const p = progress(
        (
          await request(
            `/api/scans/${encodeURIComponent(id)}`,
            { method: 'DELETE' },
            control.signal,
          )
        ).value,
      );
      if (!current(epoch)) return;
      setState(p);
      setMessage(
        'Cancellation requested. An in-flight source request may need to finish before cancellation is confirmed.',
      );
      if (p.status === 'cancelled') {
        remember(null);
        setSavedId(null);
        activeId.current = null;
        stop(p.message);
      } else await continueJob(id, epoch, control.signal, true);
    } catch (failure) {
      if (current(epoch) && !control.signal.aborted) {
        setError(
          failure instanceof Error
            ? failure.message
            : 'Cancellation could not be confirmed.',
        );
        stop('Use Check cancellation to read the saved job state.');
      }
    } finally {
      if (current(epoch)) {
        working.current = false;
        setRunning(false);
      }
    }
  }
  return (
    <div className="automatic-job">
      <label htmlFor="automatic-username">Instagram username</label>
      <input
        id="automatic-username"
        disabled={!enabled || running || !!savedId}
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        placeholder="your.username"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-describedby="automatic-status"
      />
      <div className="inline-actions">
        <button
          type="button"
          className="button primary"
          disabled={!enabled || running || !!savedId}
          onClick={() => void run()}
        >
          {pendingStart ? 'Retry same start' : 'Check automatically'}
        </button>
        {savedId && (
          <button
            type="button"
            className="button"
            disabled={!enabled || running}
            onClick={() => void run(true)}
          >
            {cancelRequested ? 'Check cancellation' : 'Resume saved scan'}
          </button>
        )}
        {savedId && (
          <button
            type="button"
            className="button"
            disabled={!enabled || cancelRequested}
            onClick={() => void cancel()}
          >
            Cancel automatic scan
          </button>
        )}
      </div>
      {savedId && !state && (
        <p className="field-help">
          A scan ID was saved in this tab. Resume to retrieve its current
          status. No username or relationship records were saved.
        </p>
      )}
      <div role="status" aria-live="polite">
        {running && (
          <p>
            {cancelRequested
              ? 'Checking cancellation…'
              : 'Contacting the source and reading observed records…'}
          </p>
        )}
        {state && (
          <div className="automatic-counts">
            <p>
              Followers observed:{' '}
              <strong>{state.followers.observed.toLocaleString()}</strong> ·
              source pages {state.followers.pages.toLocaleString()}
            </p>
            <p>
              Following observed:{' '}
              <strong>{state.following.observed.toLocaleString()}</strong> ·
              source pages {state.following.pages.toLocaleString()}
            </p>
            <p>{state.message}</p>
          </div>
        )}
        {message && <p>{message}</p>}
      </div>
      {error && (
        <div role="alert" className="notice error">
          {error}
        </div>
      )}
    </div>
  );
}
