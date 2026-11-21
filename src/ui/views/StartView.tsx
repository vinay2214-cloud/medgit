/**
 * Start: open a scenario or import a case file.
 * Validates: review-ui 1.1, 1.2, 1.3, 1.4, 1.5, 11.3, 11.4
 */
import { useEffect, useRef } from 'react';
import { GitMerge, Upload } from 'lucide-react';
import { CASEFILE_LIMITS, importCaseFile } from '@core';
import { copy, copyForError } from '../copy';
import { scenarios, type Scenario } from '../data';
import { cn } from '../lib/utils';
import { useStore } from '../state/store';
import { Button } from '../components/ui/button';

const MAX_BYTES = 2 * 1024 * 1024;

function longest(s: Scenario): number {
  return Math.max(...s.sources.map((x) => x.items.length));
}

export function StartView() {
  const { state, dispatch } = useStore();
  const heroButton = useRef<HTMLButtonElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    heroButton.current?.focus();
  }, []);

  const onFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      dispatch({ type: 'IMPORT_FAILED', code: 'CASEFILE_INVALID', message: 'the file is larger than 2 MB' });
      return;
    }
    file
      .text()
      .then((text) => {
        if (text.length > CASEFILE_LIMITS.textLength) {
          dispatch({ type: 'IMPORT_FAILED', code: 'CASEFILE_INVALID', message: 'the file is larger than 2,000,000 characters' });
          return;
        }
        const r = importCaseFile(text);
        if (r.ok) dispatch({ type: 'IMPORT_CASEFILE', state: r.value });
        else dispatch({ type: 'IMPORT_FAILED', code: r.error.code, message: r.error.message });
      })
      .catch(() => dispatch({ type: 'IMPORT_FAILED', code: 'CASEFILE_INVALID', message: 'the file could not be read' }));
  };

  const importError = state.lastError?.where === 'import' ? state.lastError : null;

  return (
    <div className="max-w-[880px] mx-auto">
      <h1 className="text-display font-bold text-ink mb-2">{copy.start.title}</h1>
      <p className="text-body text-ink-muted mb-8 max-w-[70ch]">{copy.start.sub}</p>

      <ul className="border-y border-line divide-y divide-line bg-surface" aria-label="Scenarios">
        {scenarios.map((s, i) => {
          const hero = i === 0;
          return (
            <li key={s.id} className={cn('flex flex-col sm:flex-row sm:items-center gap-4 px-4 md:px-6', hero ? 'py-6' : 'py-4')}>
              <div className="flex-1 min-w-0">
                <h2 className={cn('font-bold text-ink wrap-anywhere', hero ? 'text-title' : 'text-heading')}>{s.title}</h2>
                <p className="text-body text-ink-muted mt-1">{s.blurb}</p>
                <p className="text-small text-ink-muted mt-2 tabular-nums">
                  {s.patient.label}. {copy.start.sources(s.sources.length)}. {copy.start.medicines(longest(s))}.
                </p>
              </div>
              <Button
                ref={hero ? heroButton : undefined}
                variant={hero ? 'primary' : 'secondary'}
                size={hero ? 'lg' : 'default'}
                data-testid={`scenario-open-${s.id}`}
                aria-label={`${copy.start.open} ${s.title}`}
                onClick={() => dispatch({ type: 'LOAD_SCENARIO', scenario: s })}
                className="self-start sm:self-center"
              >
                <GitMerge size={18} aria-hidden="true" />
                {copy.start.open}
              </Button>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="import-input"
          onChange={(e) => {
            onFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
        <Button variant="secondary" data-testid="import-button" onClick={() => fileInput.current?.click()}>
          <Upload size={16} aria-hidden="true" />
          {copy.start.import}
        </Button>
      </div>

      {importError && (
        <div role="alert" className="mt-4 p-4 rounded-[var(--radius-row)] bg-conflict-bg text-conflict border border-conflict" data-testid="import-error">
          <p className="font-semibold">{copyForError(importError.code)}</p>
          {importError.message && (
            <details className="mt-2 text-ink">
              <summary className="cursor-pointer text-small font-semibold text-conflict">{copy.err.details}</summary>
              <p className="text-small mt-1 wrap-anywhere">{importError.message}</p>
            </details>
          )}
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => dispatch({ type: 'CLEAR_ERROR' })}>
            {copy.strip.close}
          </Button>
        </div>
      )}

      <aside className="mt-8 p-4 border-l-4 border-line-strong bg-surface text-small text-ink-muted" aria-label="Data notice">
        {scenarios[0]?.syntheticNotice}
      </aside>
    </div>
  );
}
