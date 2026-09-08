import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import {
  createSnapshot,
  exportCsv,
  exportDataset,
  normalizeUsername,
} from '@mutuallens/core';
import type {
  AccountRecord,
  Comparison,
  Dataset,
  Snapshot,
  SnapshotComparison,
} from '@mutuallens/core';
import {
  deleteSnapshots,
  loadSnapshots,
  saveSnapshot,
} from './local-snapshots';
import { DifferenceList } from './DifferenceList';

type Report = { dataset: Dataset; comparison: Comparison; elapsedMs: number };
type Category =
  | 'notFollowingBack'
  | 'mutuals'
  | 'notFollowedBackByYou'
  | 'followers'
  | 'following';
type Capability = {
  release: 'preview';
  automatic: { enabled: false; status: 'blocked'; reason: string };
  ads: false;
};
type Scope = 'entry' | 'import' | 'results' | 'history';
const categories: { key: Category; label: string }[] = [
  { key: 'notFollowingBack', label: 'Not following you back' },
  { key: 'mutuals', label: 'Mutuals' },
  { key: 'notFollowedBackByYou', label: 'You don’t follow back' },
  { key: 'followers', label: 'All followers' },
  { key: 'following', label: 'All following' },
];
const number = (value: number) => value.toLocaleString();
const date = (value: string | null) =>
  value ? new Date(value).toLocaleString() : 'Unknown';
const site = import.meta.env.VITE_SITE_ORIGIN || 'http://localhost:4321';
const PAGE_SIZE = 50;
function downloadFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [capability, setCapability] = useState<Capability | null>(null);
  const [capabilityError, setCapabilityError] = useState(false);
  const [availabilityAttempt, setAvailabilityAttempt] = useState(0);
  const [feedbackScope, setFeedbackScope] = useState<Scope>('entry');
  const [importOpen, setImportOpen] = useState(true);
  const [replaceSample, setReplaceSample] = useState(false);
  const [storageBusy, setStorageBusy] = useState(false);
  const storagePending = useRef(false);
  const storageGeneration = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [notice, setNoticeText] = useState('');
  const [quietNotice, setQuietNotice] = useState(false);
  const [taskScope, setTaskScope] = useState<Scope>('entry');
  function setNotice(text: string, quiet = false) {
    setNoticeText(text);
    setQuietNotice(quiet);
  }
  const [busy, setBusy] = useState<
    'sample' | 'import' | 'compare' | 'history' | null
  >(null);
  const [report, setReport] = useState<Report | null>(null);
  const [category, setCategory] = useState<Category>('notFollowingBack');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('ascending');
  const [page, setPage] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [account, setAccount] = useState('');
  const [complete, setComplete] = useState(false);
  const [collectedAt, setCollectedAt] = useState('');
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [beforeId, setBeforeId] = useState('');
  const [afterId, setAfterId] = useState('');
  const [history, setHistory] = useState<SnapshotComparison | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const worker = useRef<Worker | null>(null);
  const taskId = useRef(0);
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const pageNavigation = useRef(false);
  function navigateResults(next: number) {
    pageNavigation.current = true;
    setPage(next);
  }
  useEffect(() => {
    if (pageNavigation.current) {
      pageNavigation.current = false;
      listHeading.current?.focus();
    }
  }, [page]);

  useEffect(() => {
    // Wait for React to commit the result DOM before moving keyboard focus.
    if (report) resultsHeading.current?.focus();
  }, [report]);

  useEffect(() => {
    if (error) errorBox.current?.focus();
  }, [error, feedbackScope]);

  useEffect(() => {
    let active = true;
    setCapability(null);
    setCapabilityError(false);
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      if (active) {
        setCapabilityError(true);
        controller.abort();
      }
    }, 8000);
    fetch('/api/capabilities', {
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unavailable');
        const payload: unknown = await response.json();
        const candidate = payload as Partial<Capability>;
        if (
          !candidate ||
          candidate.release !== 'preview' ||
          candidate.automatic?.enabled !== false ||
          candidate.automatic.status !== 'blocked' ||
          typeof candidate.automatic.reason !== 'string' ||
          candidate.ads !== false
        )
          throw new Error('Unsupported capability');
        if (active && !controller.signal.aborted)
          setCapability(candidate as Capability);
      })
      .catch((failure: Error) => {
        if (active && failure.name !== 'AbortError') setCapabilityError(true);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [availabilityAttempt]);

  useEffect(
    () => () => {
      ++taskId.current;
      worker.current?.terminate();
      ++storageGeneration.current;
    },
    [],
  );

  function process(
    kind: 'sample' | 'import' | 'compare' | 'history',
    payload: Record<string, unknown> = {},
  ) {
    worker.current?.terminate();
    const id = ++taskId.current;
    setBusy(kind);
    const scope: Scope =
      kind === 'history'
        ? 'history'
        : kind === 'import'
          ? 'import'
          : report
            ? 'results'
            : 'entry';
    setTaskScope(scope);
    setFeedbackScope(scope);
    setError('');
    setNotice('');
    try {
      const instance = new Worker(
        new URL('./processing.worker.ts', import.meta.url),
        { type: 'module' },
      );
      worker.current = instance;
      instance.onmessage = ({ data }) => {
        if (id !== taskId.current) return;
        setBusy(null);
        instance.terminate();
        worker.current = null;
        if (data.error) {
          setFeedbackScope(scope);
          setError(data.error);
          return;
        }
        if (kind === 'history') {
          setFeedbackScope('history');
          setHistory(data.result as SnapshotComparison);
          setNotice(
            'Snapshot comparison ready. Browse each difference list below.',
          );
          return;
        }
        const next = data.result as Report;
        setReport(next);
        setImportOpen(false);
        setReplaceSample(false);
        setFeedbackScope('results');
        setSort('ascending');
        setCategory(
          next.comparison.negativesWithheld ? 'mutuals' : 'notFollowingBack',
        );
        setQuery('');
        setPage(1);
        setHistory(null);
        setNotice(
          next.dataset.sample
            ? 'Synthetic sample loaded. No Instagram account was checked.'
            : 'Your selected files were processed locally. Review source completeness below.',
          true,
        );
      };
      const processingFailure = () => {
        if (id === taskId.current) {
          ++taskId.current;
          setFeedbackScope(scope);
          setBusy(null);
          setError(
            'Local processing could not start. Your data was not sent to a server. Try a browser that supports module workers.',
          );
          instance.terminate();
          worker.current = null;
        }
      };
      instance.onerror = processingFailure;
      instance.onmessageerror = processingFailure;
      instance.addEventListener?.('messageerror', processingFailure);
      instance.postMessage({ id, kind, ...payload });
    } catch {
      instanceCleanup();
      setBusy(null);
      setError(
        'This browser could not start local processing. Try a browser that supports module workers.',
      );
    }
  }
  function instanceCleanup() {
    ++taskId.current;
    worker.current?.terminate();
    worker.current = null;
  }
  function invalidate() {
    instanceCleanup();
    setBusy(null);
  }
  function cancel() {
    invalidate();
    setError('');
    setNotice('Local processing canceled. No new result was created.');
  }
  function importFiles(event: FormEvent) {
    event.preventDefault();
    setFeedbackScope('import');
    setNotice('');
    setError('');
    try {
      if (!files.length)
        throw new Error(
          'Select a ZIP archive or all relevant JSON files first.',
        );
      const normalized = normalizeUsername(account);
      const timestamp = collectedAt
        ? new Date(collectedAt).toISOString()
        : undefined;
      if (timestamp && new Date(timestamp).getTime() > Date.now())
        throw new Error('The source collection date cannot be in the future.');
      process('import', {
        files,
        options: {
          account: { username: normalized },
          confirmedComplete: complete,
          collectedAt: timestamp,
        },
      });
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Review the import details.',
      );
    }
  }
  function clearReport(startOver = false) {
    invalidate();
    ++storageGeneration.current;
    setReport(null);
    setHistory(null);
    setReplaceSample(false);
    setCategory('notFollowingBack');
    setQuery('');
    setSort('ascending');
    setPage(1);
    setError('');
    setFeedbackScope('entry');
    setImportOpen(true);
    window.history.replaceState(null, '', window.location.pathname);
    if (startOver) {
      setFiles([]);
      if (fileInput.current) fileInput.current.value = '';
      setAccount('');
      setCollectedAt('');
      setComplete(false);
      setUsername('');
      setBeforeId('');
      setAfterId('');
      setHistoryOpen(false);
      setConfirmDelete(false);
    }
    setNotice(
      startOver
        ? 'Started over. Current report, selected files, and form details cleared. Saved snapshots and downloaded files remain.'
        : 'Current report cleared. Import details, saved snapshots, and downloaded files remain. Use Start over to also clear the form.',
    );
    requestAnimationFrame(() =>
      document.getElementById('entry-title')?.focus(),
    );
  }
  function requestSample() {
    invalidate();
    setError('');
    setNotice('');
    if (report && !report.dataset.sample) {
      setReplaceSample(true);
      setFeedbackScope('results');
      requestAnimationFrame(() =>
        document.getElementById('replace-sample')?.focus(),
      );
    } else process('sample');
  }
  const enterMode = useEffectEvent(() => {
    if (window.location.hash === '#sample') requestSample();
    else {
      if (busy) cancel();
      setReplaceSample(false);
      if (window.location.hash === '#import') {
        setImportOpen(true);
        requestAnimationFrame(() =>
          document.getElementById('import-title')?.focus(),
        );
      }
      if (window.location.hash === '#history') {
        setHistoryOpen(true);
        void refreshSnapshots();
      }
    }
  });
  useEffect(() => {
    enterMode();
    const navigate = () => enterMode();
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);
  function sampleEntry() {
    if (window.location.hash === '#sample') requestSample();
    else window.location.hash = 'sample';
  }
  function openHistory() {
    if (busy) cancel();
    setHistoryOpen(true);
    void refreshSnapshots();
  }
  function openImport() {
    setImportOpen(true);
    if (busy) cancel();
    requestAnimationFrame(() =>
      document.getElementById('import-title')?.focus(),
    );
  }
  function download(
    content: string,
    filename: string,
    type: string,
    scope: Scope = 'results',
  ) {
    setFeedbackScope(scope);
    setError('');
    try {
      downloadFile(content, filename, type);
      setNotice(
        'Download prepared. Your browser controls where the file is saved.',
      );
    } catch {
      setNotice('');
      setError(
        'The download could not be prepared. Your result is still available. Please retry or check your browser’s download settings.',
      );
    }
  }
  function feedback(scope: Scope) {
    if (feedbackScope !== scope && (!busy || taskScope !== scope)) return null;
    return (
      <div className="workflow-feedback">
        {feedbackScope === scope && error && (
          <div
            ref={errorBox}
            tabIndex={-1}
            role="alert"
            className="notice error"
          >
            <strong>We couldn’t complete that action.</strong>
            <p>{error}</p>
            <button
              type="button"
              className="text-button"
              onClick={() => setError('')}
            >
              Dismiss
            </button>
          </div>
        )}
        <div role="status" aria-live="polite">
          {feedbackScope === scope && notice && (
            <p className={quietNotice ? 'sr-only' : 'notice'}>{notice}</p>
          )}
          {busy && taskScope === scope && (
            <div className="notice processing">
              <span>
                {busy === 'sample'
                  ? 'Preparing synthetic data on this device…'
                  : busy === 'history'
                    ? 'Comparing saved snapshots locally…'
                    : 'Reading and comparing files on this device…'}
              </span>
              <button type="button" className="button small" onClick={cancel}>
                Cancel processing
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
  const rowsByCategory = useMemo(
    (): Record<Category, AccountRecord[]> =>
      report
        ? {
            notFollowingBack: report.comparison.notFollowingBack,
            mutuals: report.comparison.mutuals,
            notFollowedBackByYou: report.comparison.notFollowedBackByYou,
            followers: report.dataset.followers.records,
            following: report.dataset.following.records,
          }
        : {
            notFollowingBack: [],
            mutuals: [],
            notFollowedBackByYou: [],
            followers: [],
            following: [],
          },
    [report],
  );
  const rows = useMemo(() => {
    const normalized = query.trim().replace(/^@/, '').toLowerCase();
    return rowsByCategory[category]
      .filter(
        (row) =>
          row.username.toLowerCase().includes(normalized) ||
          (row.displayName || '').toLowerCase().includes(normalized),
      )
      .sort((a, b) =>
        sort === 'ascending'
          ? a.username.localeCompare(b.username)
          : b.username.localeCompare(a.username),
      );
  }, [category, query, sort, rowsByCategory]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleRows = rows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const categoryLabel = categories.find((item) => item.key === category)!.label;
  const withheld =
    report?.comparison.negativesWithheld &&
    (category === 'notFollowingBack' || category === 'notFollowedBackByYou');

  async function refreshSnapshots() {
    const generation = storageGeneration.current;
    try {
      const found = await loadSnapshots();
      if (generation === storageGeneration.current)
        setSnapshots(found.sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
      return true;
    } catch (failure) {
      if (generation === storageGeneration.current) {
        setFeedbackScope('history');
        setError((failure as Error).message);
      }
      return false;
    }
  }
  async function saveCurrent() {
    if (!report || storagePending.current) return;
    storagePending.current = true;
    setStorageBusy(true);
    setFeedbackScope('results');
    setError('');
    setNotice('');
    const generation = storageGeneration.current;
    try {
      await saveSnapshot(createSnapshot(report.dataset));
      if (generation !== storageGeneration.current) return;
      const found = await loadSnapshots();
      if (generation !== storageGeneration.current) return;
      setSnapshots(found.sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
      setHistoryOpen(true);
      setFeedbackScope('results');
      setNotice(
        'Snapshot saved on this browser and checker origin. Anyone using this browser profile may access it.',
      );
    } catch (failure) {
      if (generation === storageGeneration.current) {
        setFeedbackScope('results');
        setError((failure as Error).message);
      }
    } finally {
      storagePending.current = false;
      setStorageBusy(false);
    }
  }
  async function deleteAll() {
    if (storagePending.current) return;
    storagePending.current = true;
    setStorageBusy(true);
    invalidate();
    ++storageGeneration.current;
    setHistory(null);
    setFeedbackScope('history');
    setError('');
    setNotice('');
    try {
      await deleteSnapshots();
      setSnapshots([]);
      setBeforeId('');
      setAfterId('');
      setConfirmDelete(false);
      setNotice(
        'All MutualLens local snapshots on this checker origin were deleted. Downloaded files remain on your device.',
      );
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      storagePending.current = false;
      setStorageBusy(false);
    }
  }
  function compareHistory(event: FormEvent) {
    event.preventDefault();
    setFeedbackScope('history');
    setError('');
    setNotice('');
    const before = snapshots.find((item) => item.id === beforeId),
      after = snapshots.find((item) => item.id === afterId);
    if (!before || !after || before.id === after.id) {
      setError('Select two different snapshots, earlier first.');
      return;
    }
    setHistory(null);
    process('history', { before, after });
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to checker
      </a>
      <header className="app-header">
        <a className="wordmark" href={site}>
          Mutual<span>Lens</span>
          <span className="wordmark-dot" aria-hidden="true" />
        </a>
        <nav aria-label="Main navigation">
          <a href={`${site}/guides/followers-vs-following/`}>How it works</a>
          <a href={`${site}/privacy/`}>Privacy</a>
          <span className="preview-label">Preview</span>
        </nav>
      </header>
      <main id="main" className={report ? 'app-main has-report' : 'app-main'}>
        {!report && (
          <>
            <div className="section-eyebrow">
              YOUR CONNECTIONS, WITH CONTEXT
            </div>
            <section className="entry-section" aria-labelledby="entry-title">
              <div className="intro">
                <h1 id="entry-title" tabIndex={-1}>
                  A clearer view of <br />
                  who follows you back.
                </h1>
                <p>
                  Understand the overlap between followers and following, with
                  readable lists and the source behind every result.
                </p>
              </div>
              <div className="entry-panel">
                <div className="panel-label">
                  <span className="status-dot" />
                  Automatic check{' '}
                  <span className="status-tag">
                    {capabilityError
                      ? 'Unverified'
                      : capability
                        ? 'Unavailable'
                        : 'Loading'}
                  </span>
                </div>
                <label htmlFor="automatic-username">Instagram username</label>
                <div className="username-field">
                  <span aria-hidden="true">@</span>
                  <input
                    id="automatic-username"
                    disabled
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="your.username"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-describedby="automatic-status"
                  />
                </div>
                <button
                  className="button primary full-width"
                  disabled
                  aria-describedby="automatic-status"
                >
                  Check automatically <span aria-hidden="true">↗</span>
                </button>
                <p id="automatic-status" className="availability-copy">
                  <strong>Preview only.</strong>{' '}
                  {capabilityError
                    ? 'Availability could not be verified. Automatic checking remains unavailable.'
                    : capability?.automatic.reason ||
                      'Checking availability… Automatic checking remains unavailable.'}
                </p>
                {capabilityError && (
                  <button
                    className="button small"
                    onClick={() => setAvailabilityAttempt((value) => value + 1)}
                  >
                    Retry availability
                  </button>
                )}
                <div className="entry-secondary">
                  <button
                    className="text-button"
                    onClick={sampleEntry}
                    disabled={!!busy}
                  >
                    Explore synthetic sample <span aria-hidden="true">→</span>
                  </button>
                  <a href="#import" onClick={openImport}>
                    Import your Instagram export
                  </a>
                </div>
              </div>
            </section>
            <div className="trust-strip">
              <span>
                <span aria-hidden="true">○</span> Ad-free checker
              </span>
              <span>
                <span aria-hidden="true">○</span> Local file processing
              </span>
              <span>
                <span aria-hidden="true">○</span> Saving is always your choice
              </span>
            </div>
          </>
        )}
        {!report && (
          <>
            {feedback('entry')}
            <button className="text-button" onClick={() => clearReport(true)}>
              Start over
            </button>
          </>
        )}
        {report && (
          <div className="workspace-bar">
            <h1>Your local report</h1>
            <nav aria-label="Report workspace">
              <button
                className="text-button"
                onClick={sampleEntry}
                disabled={!!busy}
              >
                Explore synthetic sample
              </button>
              <a href="#import" onClick={openImport}>
                Import local files
              </a>
              <a href="#history" onClick={openHistory}>
                Saved snapshots
              </a>
              <button className="text-button" onClick={() => clearReport(true)}>
                Start over
              </button>
            </nav>
          </div>
        )}
        {report && (
          <section className="results" aria-labelledby="results-title">
            <div className="section-header">
              <div>
                <div className="section-eyebrow">
                  {report.dataset.sample
                    ? 'SYNTHETIC SAMPLE · NOT A LIVE CHECK'
                    : 'LOCAL IMPORT REPORT'}
                </div>
                <h2 id="results-title" ref={resultsHeading} tabIndex={-1}>
                  @{report.dataset.account.username}
                </h2>
              </div>
              <div className="result-actions">
                <button
                  className="button small"
                  onClick={() =>
                    download(
                      exportDataset(report.dataset),
                      `mutuallens-${report.dataset.sample ? 'synthetic-' : ''}dataset.json`,
                      'application/json',
                    )
                  }
                >
                  Export JSON
                </button>
                <button
                  className="button small"
                  onClick={saveCurrent}
                  disabled={storageBusy}
                >
                  Save snapshot locally
                </button>
                <button className="text-button" onClick={() => clearReport()}>
                  Clear report
                </button>
              </div>
            </div>
            {feedback('results')}
            {replaceSample && (
              <div
                className="notice warning"
                id="replace-sample"
                tabIndex={-1}
                role="region"
                aria-label="Replace current report"
              >
                <p>
                  Replace this imported report with fictional sample data? Saved
                  snapshots remain available.
                </p>
                <div className="inline-actions">
                  <button className="button" onClick={() => process('sample')}>
                    Replace report with sample
                  </button>
                  <button
                    className="button"
                    onClick={() => {
                      setReplaceSample(false);
                      window.history.replaceState(
                        null,
                        '',
                        window.location.pathname,
                      );
                    }}
                  >
                    Keep current report
                  </button>
                </div>
              </div>
            )}
            {report.dataset.sample && (
              <p className="sample-note">
                Fictional records for exploring the interface. No Instagram
                account was checked.
              </p>
            )}
            <div className="report-overview">
              <div>
                <strong>
                  {number(report.dataset.followers.records.length)}
                </strong>
                <span>followers supplied</span>
              </div>
              <div>
                <strong>
                  {number(report.dataset.following.records.length)}
                </strong>
                <span>following supplied</span>
              </div>
              <div>
                <strong>{number(report.comparison.mutuals.length)}</strong>
                <span>observed mutuals</span>
              </div>
            </div>
            <p className="report-source">
              <strong>
                {report.comparison.negativesWithheld
                  ? 'Incomplete / unverified'
                  : 'Complete for supplied source'}
              </strong>
              <span>Imported {date(report.dataset.importedAt)}</span>
            </p>
            <details className="provenance">
              <summary>Source, timestamps & completeness</summary>
              <p>
                Completeness describes the supplied source, not a guaranteed
                live Instagram snapshot. Import time is not the time someone
                followed you.
              </p>
              <div className="metadata-grid">
                {(['followers', 'following'] as const).map((direction) => {
                  const metadata = report.dataset[direction].metadata;
                  return (
                    <dl key={direction}>
                      <dt className="metadata-heading">{direction}</dt>
                      <dd />
                      <dt>Source / version</dt>
                      <dd>
                        {metadata.source} / {metadata.version}
                      </dd>
                      <dt>Collected from</dt>
                      <dd>{date(metadata.startedAt)}</dd>
                      <dt>Collected through</dt>
                      <dd>{date(metadata.endedAt)}</dd>
                      <dt>Rows / unique</dt>
                      <dd>
                        {number(metadata.rawCount)} /{' '}
                        {number(metadata.uniqueCount)}
                      </dd>
                      <dt>Completeness</dt>
                      <dd>{metadata.completeness.replaceAll('_', ' ')}</dd>
                      <dt>Terminal source marker</dt>
                      <dd>
                        {metadata.terminal ? 'Present' : 'Not established'}
                      </dd>
                      <dt>Source pages / parts</dt>
                      <dd>{metadata.pages}</dd>
                      {metadata.warnings.length > 0 && (
                        <>
                          <dt>Warnings</dt>
                          <dd>{metadata.warnings.join(' ')}</dd>
                        </>
                      )}
                    </dl>
                  );
                })}
              </div>
              {!report.comparison.negativesWithheld &&
                report.comparison.warnings.length > 0 && (
                  <div className="notice warning">
                    <strong>Source notes</strong>
                    <ul>
                      {report.comparison.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              <p className="muted">
                Local processing: {report.elapsedMs.toFixed(1)} ms on this
                device. This is not automatic-scan performance.
              </p>
            </details>
            {report.comparison.negativesWithheld &&
              report.comparison.warnings.length > 0 && (
                <details
                  className="notice warning"
                  open={report.comparison.negativesWithheld || undefined}
                >
                  <summary>
                    {report.comparison.negativesWithheld
                      ? 'Incomplete source: negative categories are withheld.'
                      : 'Source notes — read before interpreting the list'}
                  </summary>
                  <ul>
                    {report.comparison.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </details>
              )}
            <div className="category-controls" aria-label="Result categories">
              {categories.map((item) => {
                const restricted =
                  report.comparison.negativesWithheld &&
                  (item.key === 'notFollowingBack' ||
                    item.key === 'notFollowedBackByYou');
                return (
                  <button
                    key={item.key}
                    className={
                      category === item.key ? 'category active' : 'category'
                    }
                    aria-pressed={category === item.key}
                    onClick={() => {
                      setCategory(item.key);
                      setPage(1);
                    }}
                  >
                    <span>{item.label}</span>
                    <span className="category-count">
                      {restricted
                        ? 'Withheld'
                        : number(rowsByCategory[item.key].length)}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="list-toolbar">
              <label className="search-label" htmlFor="search">
                <span className="sr-only">
                  Search accounts in {categoryLabel}
                </span>
                <input
                  id="search"
                  type="search"
                  placeholder="Search username or name"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                />
              </label>
              {query && (
                <button
                  className="text-button"
                  onClick={() => {
                    setQuery('');
                    setPage(1);
                    document.getElementById('search')?.focus();
                  }}
                >
                  Clear search
                </button>
              )}
              <label className="sort-label" htmlFor="sort">
                <span>Sort</span>
                <select
                  id="sort"
                  aria-label="Sort accounts"
                  value={sort}
                  onChange={(event) => {
                    setSort(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="ascending">Username A–Z</option>
                  <option value="descending">Username Z–A</option>
                </select>
              </label>
              <button
                className="button small"
                disabled={!!withheld}
                onClick={() =>
                  download(
                    exportCsv(rows),
                    `mutuallens-${report.dataset.sample ? 'synthetic-' : ''}${category}.csv`,
                    'text/csv;charset=utf-8',
                  )
                }
              >
                Export filtered CSV
              </button>
            </div>
            <div className="list-caption">
              <h3 id="list-title" ref={listHeading} tabIndex={-1}>
                {categoryLabel}
              </h3>
              <span aria-live="polite">
                {withheld
                  ? 'Absence cannot be established'
                  : `${number(rows.length)} ${query ? 'matching ' : ''}accounts`}
              </span>
            </div>
            {withheld ? (
              <div className="empty-state">
                <h3>Missing doesn’t mean not following.</h3>
                <p>
                  Both lists must be complete and compatible before an absence
                  can be classified. You can still inspect supplied lists and
                  observed mutuals.
                </p>
              </div>
            ) : rows.length === 0 ? (
              <div className="empty-state">
                <h3>
                  {query
                    ? 'No matching accounts'
                    : 'No accounts in this category'}
                </h3>
                <p>
                  {query
                    ? 'Try a different username or clear the search.'
                    : 'This result applies only to the supplied dataset.'}
                </p>
              </div>
            ) : (
              <ul className="account-list" aria-label={categoryLabel}>
                {visibleRows.map((row, index) => (
                  <li key={`${row.id || row.username}-${index}`}>
                    <div className="account-identity">
                      <span className="account-initial" aria-hidden="true">
                        {row.username[0]?.toUpperCase() || '·'}
                      </span>
                      <div>
                        <strong>@{row.username}</strong>
                        {row.displayName && <span>{row.displayName}</span>}
                      </div>
                    </div>
                    {report.dataset.sample ? (
                      <span className="synthetic-row">Synthetic</span>
                    ) : (
                      <a
                        className="profile-link"
                        href={`https://www.instagram.com/${encodeURIComponent(row.username)}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        referrerPolicy="no-referrer"
                        aria-label={`Open @${row.username} Instagram profile in a new tab`}
                      >
                        View profile <span aria-hidden="true">↗</span>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!withheld && (
              <nav className="pagination" aria-label="Result pages">
                <span>
                  Showing{' '}
                  {rows.length ? number((currentPage - 1) * PAGE_SIZE + 1) : 0}–
                  {number(Math.min(currentPage * PAGE_SIZE, rows.length))} of{' '}
                  {number(rows.length)}
                </span>
                <div>
                  <button
                    className="button small"
                    disabled={currentPage <= 1}
                    onClick={() => navigateResults(1)}
                  >
                    First
                  </button>
                  <button
                    className="button small"
                    disabled={currentPage <= 1}
                    onClick={() => navigateResults(currentPage - 1)}
                  >
                    Previous
                  </button>
                  <span>
                    Page {number(currentPage)} of {number(totalPages)}
                  </span>
                  <button
                    className="button small"
                    disabled={currentPage >= totalPages}
                    onClick={() => navigateResults(currentPage + 1)}
                  >
                    Next
                  </button>
                  <button
                    className="button small"
                    disabled={currentPage >= totalPages}
                    onClick={() => navigateResults(totalPages)}
                  >
                    Last
                  </button>
                </div>
              </nav>
            )}
          </section>
        )}

        <details
          id="import"
          className="import-disclosure"
          open={importOpen}
          onToggle={(event) => setImportOpen(event.currentTarget.open)}
        >
          <summary>
            Import local files <span>Optional · processed on this device</span>
          </summary>
          <section className="import-section" aria-labelledby="import-title">
            <div>
              <div className="section-eyebrow">SECONDARY WORKFLOW</div>
              <h2 id="import-title" tabIndex={-1}>
                Bring your own export.
              </h2>
              <p>
                Compare supported Instagram JSON files here in your browser.
                This optional preview feature is separate from the unavailable
                automatic workflow.
              </p>
              <p className="muted">
                Select a ZIP, or both directions’ JSON files including every
                split part. Files are not uploaded. Unsupported formats and
                incomplete data receive explicit errors or warnings.
              </p>
              <a href={`${site}/guides/download-instagram-followers/`}>
                Export preparation guide <span aria-hidden="true">↗</span>
              </a>
            </div>
            <form onSubmit={importFiles} className="import-form">
              <label htmlFor="import-account">
                Account these files belong to
              </label>
              <input
                id="import-account"
                required
                value={account}
                onChange={(event) => setAccount(event.target.value)}
                placeholder="@your.username"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
              />
              <label htmlFor="import-files">Instagram ZIP or JSON files</label>
              <input
                ref={fileInput}
                id="import-files"
                type="file"
                multiple
                accept=".zip,.json,application/zip,application/json"
                onChange={(event) => {
                  setFiles(Array.from(event.target.files || []));
                  setComplete(false);
                }}
              />
              <p className="field-help">
                {files.length
                  ? `${files.length} file${files.length === 1 ? '' : 's'} selected. Include all followers and following parts.`
                  : 'HTML exports are not supported. There is no follower-count cutoff.'}
              </p>
              <label htmlFor="collected-at">
                Source collection date <span className="muted">(optional)</span>
              </label>
              <input
                id="collected-at"
                type="datetime-local"
                value={collectedAt}
                onChange={(event) => setCollectedAt(event.target.value)}
              />
              <p className="field-help">
                Only enter a date you know from the source. Unknown dates
                prevent historical conclusions.
              </p>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={complete}
                  onChange={(event) => setComplete(event.target.checked)}
                />
                <span>
                  I confirm these files belong to this account and contain every
                  part of both followers and following from this export.
                </span>
              </label>
              <p className="field-help">
                Without confirmation, negative relationship categories are
                withheld. Confirmation cannot verify what Instagram included in
                the export.
              </p>
              {feedback('import')}
              <button
                className="button primary"
                type="submit"
                disabled={!!busy}
              >
                Compare local files <span aria-hidden="true">→</span>
              </button>
            </form>
          </section>
        </details>

        <section
          id="history"
          className="history-section"
          aria-labelledby="history-title"
        >
          <div className="section-header">
            <div>
              <div className="section-eyebrow">
                OPTIONAL · THIS BROWSER ONLY
              </div>
              <h2 id="history-title">Your saved snapshots</h2>
            </div>
            <button
              className="button small"
              onClick={() => {
                if (busy === 'history') cancel();
                setHistoryOpen(!historyOpen);
                if (!historyOpen) void refreshSnapshots();
              }}
            >
              {historyOpen ? 'Hide snapshots' : 'View saved snapshots'}
            </button>
          </div>
          <p>
            Nothing is saved automatically. Saved lists are visible to anyone
            using this browser profile. Private browsing, browser cleanup, or
            changing the checker address can make snapshots unavailable.
          </p>
          {historyOpen && (
            <>
              <div className="snapshot-list">
                {snapshots.length === 0 ? (
                  <p className="empty-inline">
                    No snapshots saved on this checker origin.
                  </p>
                ) : (
                  snapshots.map((snapshot) => (
                    <div className="snapshot-row" key={snapshot.id}>
                      <div>
                        <strong>
                          @{snapshot.dataset.account.username}
                          {snapshot.dataset.sample ? ' · Synthetic' : ''}
                        </strong>
                        <span>
                          Saved {date(snapshot.savedAt)} ·{' '}
                          {snapshot.dataset.followers.metadata.source}
                        </span>
                        <span>
                          Source date:{' '}
                          {date(snapshot.dataset.followers.metadata.endedAt)}
                        </span>
                      </div>
                      <button
                        className="button small"
                        onClick={() =>
                          download(
                            JSON.stringify(snapshot, null, 2),
                            `mutuallens-snapshot-${snapshot.dataset.sample ? 'synthetic-' : ''}${snapshot.id}.json`,
                            'application/json',
                            'history',
                          )
                        }
                      >
                        Export snapshot
                      </button>
                    </div>
                  ))
                )}
              </div>
              {snapshots.length > 1 && (
                <form className="history-form" onSubmit={compareHistory}>
                  <label>
                    Earlier snapshot
                    <select
                      required
                      value={beforeId}
                      onChange={(event) => {
                        if (busy === 'history') cancel();
                        setBeforeId(event.target.value);
                        setHistory(null);
                      }}
                    >
                      <option value="">Select earlier snapshot</option>
                      {snapshots.map((item) => (
                        <option key={item.id} value={item.id}>
                          @{item.dataset.account.username} ·{' '}
                          {date(item.dataset.followers.metadata.endedAt)} ·
                          saved {date(item.savedAt)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Later snapshot
                    <select
                      required
                      value={afterId}
                      onChange={(event) => {
                        if (busy === 'history') cancel();
                        setAfterId(event.target.value);
                        setHistory(null);
                      }}
                    >
                      <option value="">Select later snapshot</option>
                      {snapshots.map((item) => (
                        <option key={item.id} value={item.id}>
                          @{item.dataset.account.username} ·{' '}
                          {date(item.dataset.followers.metadata.endedAt)} ·
                          saved {date(item.savedAt)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit" className="button" disabled={!!busy}>
                    Compare snapshots
                  </button>
                </form>
              )}
              {feedback('history')}
              {history && (
                <div className="history-result">
                  <h3>Differences between supplied snapshots</h3>
                  <p>
                    These observations do not establish an exact unfollow time,
                    reason, or intent.
                  </p>
                  {history.warnings.map((warning, index) => (
                    <p className="notice warning" key={index}>
                      {warning}
                    </p>
                  ))}
                  {(
                    [
                      {
                        key: 'followersAdded',
                        label: 'Followers present later; absent earlier',
                      },
                      {
                        key: 'followersAbsent',
                        label: 'Followers present earlier; absent later',
                      },
                      {
                        key: 'followingAdded',
                        label: 'Following present later; absent earlier',
                      },
                      {
                        key: 'followingAbsent',
                        label: 'Following present earlier; absent later',
                      },
                    ] as const
                  ).map((item) => (
                    <DifferenceList
                      key={item.key}
                      label={item.label}
                      rows={history[item.key]}
                      onExport={() =>
                        download(
                          exportCsv(history[item.key]),
                          `mutuallens-${snapshots.find((snapshot) => snapshot.id === beforeId)?.dataset.sample ? 'synthetic-' : ''}${item.key}.csv`,
                          'text/csv;charset=utf-8',
                          'history',
                        )
                      }
                    />
                  ))}
                </div>
              )}
              {(snapshots.length > 0 || error) && (
                <div className="delete-area">
                  {confirmDelete ? (
                    <>
                      <p>
                        Delete all saved snapshots from this checker origin?
                        This cannot be undone. Exported files are not deleted.
                      </p>
                      <button
                        className="button danger"
                        onClick={deleteAll}
                        disabled={storageBusy}
                      >
                        Confirm delete all snapshots
                      </button>
                      <button
                        className="button"
                        onClick={() => setConfirmDelete(false)}
                      >
                        Keep snapshots
                      </button>
                    </>
                  ) : (
                    <button
                      className="text-button danger-text"
                      onClick={() => setConfirmDelete(true)}
                    >
                      Delete all local snapshots
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </main>
      <footer className="app-footer">
        <span>
          MutualLens <span className="muted">/ Clarity over assumptions.</span>
        </span>
        <div>
          <a href={`${site}/privacy/`}>Privacy</a>
          <a href={`${site}/terms/`}>Terms</a>
          <a href={`${site}/contact/`}>Contact</a>
        </div>
        <p>
          Preview only · Automatic checking unavailable · No ads · Not
          affiliated with Instagram or Meta.
        </p>
      </footer>
    </>
  );
}
