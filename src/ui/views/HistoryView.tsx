/**
 * History: log, chain status, and for the selected commit its changes, list (with last changed) and decisions.
 * Validates: review-ui 9.1 to 9.6
 */
import { useState } from 'react';
import { ArrowRight, Copy, Minus, Plus, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { Commit } from '@core';
import { copy, roleLabel } from '../copy';
import { showFrequency, showStatus, showStrength, showTime, shortId } from '../format';
import { cn } from '../lib/utils';
import { selectHistoryView } from '../state/selectors';
import { useStore } from '../state/store';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';

function CommitId({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-1">
      <code className="font-mono text-mono text-ink">{shortId(id)}</code>
      <Button
        variant="ghost"
        size="sm"
        className="h-10 w-10 p-0"
        aria-label={`${copy.commit.copy} ${shortId(id)}`}
        onClick={(e) => {
          e.stopPropagation();
          void navigator.clipboard?.writeText(id).then(() => setCopied(true), () => setCopied(false));
        }}
      >
        <Copy size={14} aria-hidden="true" />
      </Button>
      {copied && <span className="text-small text-ink-muted">{copy.commit.copied}</span>}
    </span>
  );
}

function names(commit: Commit | null, parent: Commit | null): Map<string, string> {
  return new Map([...(parent?.entries ?? []), ...(commit?.entries ?? [])].map((e) => [e.drugKey, e.displayName]));
}

const tabCls = 'h-10 data-[state=active]:shadow-none data-[state=active]:text-ink data-[state=active]:font-semibold data-[state=active]:bg-surface text-ink-muted';

export function HistoryView() {
  const { state, dispatch } = useStore();
  const view = selectHistoryView(state);
  const [lastChanged, setLastChanged] = useState(false);

  if (state.history.length === 0) {
    return (
      <div className="max-w-xl">
        <h1 className="text-title font-bold text-ink mb-2">{copy.history.title}</h1>
        <p className="text-body text-ink-muted">{copy.history.empty}</p>
        <a href="#/reconcile" className="text-violet underline underline-offset-4 font-semibold">{copy.history.emptyLink}</a>
      </div>
    );
  }

  const { selected, selectedIndex, diff } = view;
  const parent = selectedIndex > 0 ? (state.history[selectedIndex - 1] ?? null) : null;
  const nameOf = names(selected, parent);
  const blameByKey = new Map(view.blame.map((b) => [b.drugKey, b]));

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-bold text-ink">{copy.history.title}</h1>
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] items-start">
        <section aria-labelledby="log-title" className="bg-surface border border-line rounded-[var(--radius-row)]">
          <header className="px-4 py-3 border-b border-line flex flex-col gap-2">
            <h2 id="log-title" className="text-heading font-semibold text-ink">{copy.history.log}</h2>
            {view.chain.ok ? (
              <p className="inline-flex items-center gap-2 self-start h-7 px-2.5 rounded-[var(--radius-pill)] bg-resolved-bg text-resolved text-small font-semibold" data-testid="chain-status">
                <ShieldCheck size={16} aria-hidden="true" />
                {copy.history.chainOk}
              </p>
            ) : (
              <div role="alert" className="p-2 rounded-[var(--radius-row)] bg-conflict-bg text-conflict text-small" data-testid="chain-status">
                <p className="inline-flex items-center gap-2 font-semibold">
                  <ShieldAlert size={16} aria-hidden="true" />
                  {copy.history.chainBroken(view.chain.index + 1)}
                </p>
                <p>{copy.err.CHAIN_BROKEN}</p>
              </div>
            )}
          </header>
          <ol className="divide-y divide-line">
            {view.log.map((line, n) => {
              const isSel = selected?.id === line.id;
              return (
                <li key={line.id}>
                  <button
                    type="button"
                    data-testid={`log-item-${n}`}
                    aria-current={isSel ? 'true' : undefined}
                    onClick={() => dispatch({ type: 'SET_HISTORY_SELECTION', id: line.id })}
                    className={cn('w-full text-left px-4 py-3 flex flex-col gap-1 hover:bg-surface-2', isSel && 'bg-surface-2 shadow-[inset_3px_0_0_var(--violet)]')}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <code className="font-mono text-mono text-ink">{shortId(line.id)}</code>
                      <span className="text-small text-ink-muted tabular-nums">{showTime(line.at)}</span>
                    </span>
                    <span className="text-body font-semibold text-ink wrap-anywhere">{line.message}</span>
                    <span className="text-small text-ink-muted">
                      {roleLabel(line.author.role)}
                      {line.author.name ? `, ${line.author.name}` : ''}. {copy.history.counts(line.entryCount, line.resolutionCount)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </section>

        {selected && diff && (
          <section aria-labelledby="detail-title" className="bg-surface border border-line rounded-[var(--radius-row)] p-4 min-w-0">
            <h2 id="detail-title" className="text-heading font-semibold text-ink wrap-anywhere">{selected.message}</h2>
            <p className="text-small text-ink-muted mb-3 flex flex-wrap items-center gap-x-2">
              <CommitId id={selected.id} />
              <span>
                {roleLabel(selected.author.role)}
                {selected.author.name ? `, ${selected.author.name}` : ''}. {showTime(selected.at)}
              </span>
            </p>
            <Tabs defaultValue="changes">
              <TabsList className="bg-surface-2">
                <TabsTrigger value="changes" data-testid="tab-changes" className={tabCls}>{copy.history.changes}</TabsTrigger>
                <TabsTrigger value="list" data-testid="tab-list" className={tabCls}>{copy.history.list}</TabsTrigger>
                <TabsTrigger value="decisions" data-testid="tab-decisions" className={tabCls}>{copy.history.decisions}</TabsTrigger>
              </TabsList>

              <TabsContent value="changes" data-testid="changes-panel">
                {diff.added.length + diff.removed.length + diff.changed.length === 0 ? (
                  <p className="text-body text-ink-muted py-3">{copy.history.noChanges}</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {diff.added.map((k) => (
                      <li key={`a-${k}`} className="flex items-center gap-2 py-2" data-testid={`diff-added-${k}`}>
                        <Plus size={16} className="text-resolved" aria-hidden="true" />
                        <span className="sr-only">{copy.history.added}: </span>
                        <span className="font-semibold text-ink">{nameOf.get(k) ?? k}</span>
                      </li>
                    ))}
                    {diff.removed.map((k) => (
                      <li key={`r-${k}`} className="flex items-center gap-2 py-2" data-testid={`diff-removed-${k}`}>
                        <Minus size={16} className="text-conflict" aria-hidden="true" />
                        <span className="sr-only">{copy.history.removed}: </span>
                        <span className="font-semibold text-ink line-through">{nameOf.get(k) ?? k}</span>
                      </li>
                    ))}
                    {diff.changed.map((c) => (
                      <li key={`c-${c.drugKey}-${c.field}`} className="flex flex-wrap items-center gap-2 py-2" data-testid={`diff-changed-${c.drugKey}-${c.field}`}>
                        <span className="sr-only">{copy.history.changed}: </span>
                        <span className="font-semibold text-ink">{nameOf.get(c.drugKey) ?? c.drugKey}</span>
                        <span className="text-small text-ink-muted">{c.field}</span>
                        <span className="tabular-nums">{c.from}</span>
                        <ArrowRight size={16} aria-label="to" />
                        <span className="tabular-nums font-semibold">{c.to}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="list">
                <button
                  type="button"
                  aria-pressed={lastChanged}
                  data-testid="toggle-last-changed"
                  onClick={() => setLastChanged((v) => !v)}
                  className={cn('h-10 px-3 my-2 rounded-[var(--radius-row)] border border-line-strong text-small font-semibold', lastChanged ? 'bg-violet text-on-violet' : 'bg-surface text-ink')}
                >
                  {copy.history.lastChanged}
                </button>
                <ul className="divide-y divide-line" data-testid="commit-list">
                  {selected.entries.map((e) => {
                    const b = blameByKey.get(e.drugKey);
                    return (
                      <li key={e.drugKey} className="py-2 flex flex-col gap-0.5" data-testid={`list-line-${e.drugKey}`}>
                        <span className="flex flex-wrap gap-x-4">
                          <span className="font-semibold text-ink wrap-anywhere">{e.displayName}</span>
                          <span className="text-data tabular-nums text-ink">
                            {[showStrength(e.strength) ?? copy.cell.unreadable, showFrequency(e.frequency) ?? copy.cell.unreadable, showStatus(e.status)].join(', ')}
                          </span>
                        </span>
                        {lastChanged && b && (
                          <span className="text-small text-ink-muted" data-testid={`blame-${e.drugKey}`}>
                            <code className="font-mono text-mono" data-testid={`blame-commit-${e.drugKey}`}>{shortId(b.blamedCommitId)}</code>{' '}
                            {b.lastDecision && b.lastDecision.reasonCodes.length
                              ? copy.history.decidedIn(shortId(b.lastDecision.commitId), b.lastDecision.reasonCodes.map((r) => copy.reason[r]).join(', '))
                              : copy.history.agreedAll}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </TabsContent>

              <TabsContent value="decisions">
                {selected.resolutions.length === 0 ? (
                  <p className="text-body text-ink-muted py-3">{copy.history.noDecisions}</p>
                ) : (
                  <ul className="divide-y divide-line">
                    {selected.resolutions.map((r) => (
                      <li key={r.conflictId} className="py-2 flex flex-col gap-0.5" data-testid={`decision-${r.conflictId}`}>
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink">{nameOf.get(r.conflictId.slice(0, r.conflictId.lastIndexOf('::'))) ?? r.conflictId}</span>
                          <span className="text-small text-ink-muted">{copy.kind[r.conflictId.slice(r.conflictId.lastIndexOf('::') + 2) as keyof typeof copy.kind]}</span>
                          {r.manual && <span className="inline-flex h-6 px-2.5 items-center rounded-[var(--radius-pill)] bg-escalated-bg text-escalated text-small font-semibold">{copy.merged.manual}</span>}
                        </span>
                        <span className="text-small text-ink">{copy.reason[r.reasonCode]}{r.note ? `. ${r.note}` : ''}</span>
                        <span className="text-small text-ink-muted">
                          {roleLabel(r.by.role)}
                          {r.by.name ? `, ${r.by.name}` : ''}. {showTime(r.at)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            </Tabs>
          </section>
        )}
      </div>
    </div>
  );
}
