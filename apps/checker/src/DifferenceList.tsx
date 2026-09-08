import { useState, useRef, useEffect } from 'react';
import type { AccountRecord } from '@mutuallens/core';

/** Page only the rendering; every observed difference remains browsable and exportable. */
export function DifferenceList({
  label,
  rows,
  onExport,
}: {
  label: string;
  rows: AccountRecord[];
  onExport: () => void;
}) {
  const [page, setPage] = useState(1);
  const heading = useRef<HTMLElement>(null);
  const navigated = useRef(false);
  function navigate(next: number) {
    navigated.current = true;
    setPage(next);
  }
  useEffect(() => {
    if (navigated.current) {
      navigated.current = false;
      heading.current?.focus();
    }
  }, [page]);
  const pages = Math.max(1, Math.ceil(rows.length / 50));
  const current = Math.min(page, pages);
  return (
    <details className="difference-list">
      <summary ref={heading}>
        {label} · {rows.length.toLocaleString()}
      </summary>
      {rows.length ? (
        <ul aria-label={label}>
          {rows.slice((current - 1) * 50, current * 50).map((row, index) => (
            <li key={`${row.id || row.username}-${index}`}>@{row.username}</li>
          ))}
        </ul>
      ) : (
        <p>No observed differences.</p>
      )}
      <nav className="pagination" aria-label={`${label} pages`}>
        <span aria-live="polite">
          Page {current} of {pages} · {rows.length.toLocaleString()} differences
        </span>
        <div>
          <button
            className="button small"
            disabled={current === 1}
            onClick={() => navigate(1)}
          >
            First
          </button>
          <button
            className="button small"
            disabled={current === 1}
            onClick={() => navigate(current - 1)}
          >
            Previous
          </button>
          <button
            className="button small"
            disabled={current === pages}
            onClick={() => navigate(current + 1)}
          >
            Next
          </button>
          <button
            className="button small"
            disabled={current === pages}
            onClick={() => navigate(pages)}
          >
            Last
          </button>
        </div>
      </nav>
      <button className="button small" onClick={onExport}>
        Export full difference CSV
      </button>
    </details>
  );
}
