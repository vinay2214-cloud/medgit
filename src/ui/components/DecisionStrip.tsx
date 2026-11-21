/**
 * The decision strip: every source's claim for the selected conflict, the options, a reason and a note.
 * The interface never decides; Apply dispatches RESOLVE and the core validates it.
 * Validates: review-ui 6.1 to 6.11
 */
import { useId, useState } from 'react';
import { UserRoundCheck } from 'lucide-react';
import {
  isValidCustomValue,
  NOTE_MAX,
  REASON_CODES,
  type ConflictId,
  type Decision,
  type Frequency,
  type ReasonCode,
  type Resolution,
  type Status,
  type Strength,
  type Unit,
} from '@core';
import { copy, copyForError, roleLabel } from '../copy';
import { showEntry, showFrequency, showStatus, showStrength, showTime } from '../format';
import { cn } from '../lib/utils';
import type { StripView } from '../state/selectors';
import type { UiError } from '../state/types';
import { KindPill, SourceChip } from './Primitives';
import { Button } from './ui/button';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Textarea } from './ui/textarea';

export interface StripProps {
  view: StripView;
  error: UiError | null;
  onResolve: (conflictId: ConflictId, decision: Decision, reasonCode: ReasonCode, note: string) => void;
  onUndo: (conflictId: ConflictId) => void;
  onSelectConflict: (id: ConflictId) => void;
  headingLevel?: 'h2' | 'h3';
}

const HUMAN_REASONS = REASON_CODES.filter((r) => r !== 'NEEDS_PHARMACIST_REVIEW');
const inputCls = 'h-10 w-full rounded-[var(--radius-cell)] border border-line-strong bg-surface px-3 text-body text-ink';

function fieldValue(view: StripView, entry: NonNullable<StripView['conflict']['claims'][number]['entry']>): string {
  const k = view.conflict.kind;
  if (k === 'DOSE') return showStrength(entry.strength) ?? copy.cell.unreadable;
  if (k === 'FREQUENCY') return showFrequency(entry.frequency) ?? copy.cell.unreadable;
  if (k === 'STATUS') return showStatus(entry.status);
  return showEntry(entry, copy.cell.unreadable);
}

function describeDecision(view: StripView, d: Decision): string {
  switch (d.type) {
    case 'include':
      return copy.strip.include;
    case 'exclude':
      return copy.strip.exclude;
    case 'escalate':
      return copy.strip.escalate;
    case 'choose': {
      const label = view.sources.find((s) => s.id === d.source)?.label ?? d.source;
      const entry = view.conflict.claims.find((c) => c.source === d.source)?.entry;
      return copy.strip.use(label, entry ? fieldValue(view, entry) : '');
    }
    case 'custom': {
      const v = d.value;
      const text = typeof v === 'string' ? showStatus(v) : 'values' in v ? showStrength(v) : showFrequency(v);
      return `${copy.merged.manual}: ${text ?? ''}`;
    }
  }
}

/** Typed input for "Enter a different value". Returns null while the value is not valid. */
function ValueInput({ kind, onChange, describedBy, invalid }: { kind: 'DOSE' | 'FREQUENCY' | 'STATUS'; onChange: (v: Strength | Frequency | Status | null) => void; describedBy: string; invalid: boolean }) {
  const id = useId();
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [unit, setUnit] = useState<Unit>('mg');
  const emitDose = (na: string, nb: string, u: Unit) => {
    const values = [na, nb].filter((x) => x.trim() !== '').map(Number);
    const v: Strength = { values, unit: u };
    onChange(na.trim() !== '' && isValidCustomValue('DOSE', v) ? v : null);
  };
  if (kind === 'DOSE') {
    return (
      <div className="grid grid-cols-[1fr_1fr_88px] gap-2 mt-2">
        <label className="text-small text-ink" htmlFor={`${id}-a`}>
          {copy.strip.strength}
          <input id={`${id}-a`} data-testid="custom-strength" className={inputCls} type="number" step="any" min="0" inputMode="decimal" aria-invalid={invalid} aria-describedby={describedBy} value={a} onChange={(e) => { setA(e.target.value); emitDose(e.target.value, b, unit); }} />
        </label>
        <label className="text-small text-ink" htmlFor={`${id}-b`}>
          {copy.strip.secondValue}
          <input id={`${id}-b`} className={inputCls} type="number" step="any" min="0" inputMode="decimal" aria-describedby={describedBy} value={b} onChange={(e) => { setB(e.target.value); emitDose(a, e.target.value, unit); }} />
        </label>
        <label className="text-small text-ink" htmlFor={`${id}-u`}>
          {copy.strip.unit}
          <select id={`${id}-u`} className={inputCls} value={unit} onChange={(e) => { const u = e.target.value as Unit; setUnit(u); emitDose(a, b, u); }}>
            {(['mg', 'mcg', 'ml', 'iu'] as const).map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </label>
      </div>
    );
  }
  if (kind === 'FREQUENCY') {
    return (
      <label className="block text-small text-ink mt-2" htmlFor={`${id}-f`}>
        {copy.strip.frequency}
        <select id={`${id}-f`} data-testid="custom-frequency" className={inputCls} defaultValue="" aria-describedby={describedBy} onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : v === 'prn' ? { kind: 'prn' } : { kind: 'scheduled', perDay: Number(v) as 1 | 2 | 3 | 4 });
        }}>
          <option value="">{copy.strip.chooseFrequency}</option>
          {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{showFrequency({ kind: 'scheduled', perDay: n as 1 })}</option>)}
          <option value="prn">{showFrequency({ kind: 'prn' })}</option>
        </select>
      </label>
    );
  }
  return (
    <label className="block text-small text-ink mt-2" htmlFor={`${id}-s`}>
      {copy.strip.status}
      <select id={`${id}-s`} data-testid="custom-status" className={inputCls} defaultValue="" aria-describedby={describedBy} onChange={(e) => onChange(e.target.value === '' ? null : (e.target.value as Status))}>
        <option value="">{copy.strip.chooseStatus}</option>
        {(['active', 'stopped', 'on-hold'] as const).map((s) => <option key={s} value={s}>{showStatus(s)}</option>)}
      </select>
    </label>
  );
}

export function DecisionStrip({ view, error, onResolve, onUndo, onSelectConflict, headingLevel = 'h2' }: StripProps) {
  // Form state resets when the conflict changes (the parent keys this component by conflict id).
  const [choice, setChoice] = useState<string>('');
  const [custom, setCustom] = useState<Strength | Frequency | Status | null>(null);
  const [reason, setReason] = useState<ReasonCode | ''>('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const ids = { reason: useId(), note: useId(), err: useId(), custom: useId(), noteCount: useId(), waiting: useId() };
  const { conflict } = view;
  const H = headingLevel;
  const field = conflict.kind === 'OMISSION' ? null : conflict.kind;
  const disabled = !view.mayDecide;

  const decision: Decision | null =
    choice === 'include' || choice === 'exclude'
      ? { type: choice }
      : choice.startsWith('choose:')
        ? { type: 'choose', source: choice.slice(7) }
        : choice === 'custom' && custom !== null
          ? { type: 'custom', value: custom }
          : null;
  const customInvalid = choice === 'custom' && custom === null;
  const canApply = !disabled && decision !== null && reason !== '' && note.length <= NOTE_MAX;
  const myError = error && error.where === 'strip' && error.conflictId === conflict.id ? error : null;

  const apply = () => {
    if (!canApply || decision === null || !reason) return;
    onResolve(conflict.id, decision, reason, note);
  };

  const listing = conflict.claims.filter((c) => c.entry !== null);
  const omitting = conflict.claims.filter((c) => c.entry === null);
  const sourceIndex = (id: string) => view.sources.findIndex((s) => s.id === id);
  const sourceLabel = (id: string) => view.sources.find((s) => s.id === id)?.label ?? id;

  return (
    <section aria-labelledby={`${ids.reason}-title`} className="flex flex-col gap-4" data-testid="strip" data-conflict={conflict.id}>
      <header className="flex flex-col gap-2">
        <H id={`${ids.reason}-title`} className="text-title font-bold text-ink wrap-anywhere">
          {view.displayName}
        </H>
        {view.drugConflicts.length > 1 ? (
          <div role="tablist" aria-label="Differences for this medicine" className="flex flex-wrap gap-1">
            {view.drugConflicts.map((c) => (
              <button
                key={c.id}
                role="tab"
                type="button"
                aria-selected={c.id === conflict.id}
                data-testid={`strip-tab-${c.kind}`}
                onClick={() => onSelectConflict(c.id)}
                className={cn('rounded-[var(--radius-pill)] p-0.5 border-2', c.id === conflict.id ? 'border-violet' : 'border-transparent')}
              >
                <KindPill kind={c.kind} state={c.state} />
              </button>
            ))}
          </div>
        ) : (
          <div>
            <KindPill kind={conflict.kind} state={view.state} />
          </div>
        )}
      </header>

      <div>
        <h3 className="text-small font-semibold text-ink-muted mb-2">{copy.strip.claims}</h3>
        <ul className="flex flex-col divide-y divide-line border-y border-line">
          {[...listing, ...omitting].map((c) => (
            <li key={c.source} className="flex items-start justify-between gap-3 py-2" data-testid={`claim-${c.source}`}>
              <span className="min-w-0">
                <SourceChip sourceId={c.source} index={sourceIndex(c.source)} label={sourceLabel(c.source)} className="text-small" />
                <span className="block text-small text-ink-muted">{copy.chart.asOf(showTime(view.sources.find((s) => s.id === c.source)?.asOf ?? ''))}</span>
              </span>
              <span className={cn('text-data font-semibold text-right tabular-nums wrap-anywhere', c.entry === null && 'italic font-normal text-ink-muted')}>
                {c.entry ? fieldValue(view, c.entry) : copy.row.notListed}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {view.effective && (
        <p className="text-small text-ink" data-testid="current-decision">
          <span className="font-semibold">{copy.strip.current}: </span>
          {describeDecision(view, view.effective.decision)} ({copy.reason[view.effective.reasonCode]}, {roleLabel(view.effective.by.role)})
        </p>
      )}

      {view.state === 'escalated' && disabled && (
        <p id={ids.waiting} className="flex items-center gap-2 p-3 rounded-[var(--radius-row)] bg-escalated-bg text-escalated font-semibold" data-testid="waiting">
          <UserRoundCheck size={18} aria-hidden="true" />
          {copy.strip.waiting}
        </p>
      )}

      <fieldset disabled={disabled} className={cn("flex flex-col gap-4 min-w-0 border-0 p-0 m-0", disabled && "opacity-60")}>
        <div>
          <p id={`${ids.reason}-decision`} className="text-body font-semibold text-ink mb-2">
            {copy.strip.decision}
          </p>
          <RadioGroup name="decision" aria-labelledby={`${ids.reason}-decision`} value={choice} onValueChange={(v) => { setChoice(v); setCustom(null); setTouched(false); }} disabled={disabled} className="gap-1">
            {field === null ? (
              <>
                <Option value="include" testId="option-include" label={copy.strip.include} />
                <Option value="exclude" testId="option-exclude" label={copy.strip.exclude} />
              </>
            ) : (
              <>
                {listing.map((c) => (
                  <Option key={c.source} value={`choose:${c.source}`} testId={`option-choose-${c.source}`} label={copy.strip.use(sourceLabel(c.source), c.entry ? fieldValue(view, c.entry) : '')} />
                ))}
                <Option value="custom" testId="option-custom" label={copy.strip.custom} />
              </>
            )}
          </RadioGroup>
          {choice === 'custom' && field !== null && (
            <div id={ids.custom}>
              <ValueInput kind={field} onChange={(v) => { setCustom(v); setTouched(true); }} describedBy={ids.err} invalid={touched && customInvalid} />
              {customInvalid && touched && (
                <p id={ids.err} className="text-small text-conflict mt-1" role="alert">
                  {copy.err.INVALID_DECISION}
                </p>
              )}
            </div>
          )}
        </div>

        <label htmlFor={ids.reason} className="flex flex-col gap-1 text-body font-semibold text-ink">
          {copy.strip.reason}
          <select
            id={ids.reason}
            data-testid="reason-select"
            className={cn(inputCls, 'font-normal')}
            value={reason}
            required
            onChange={(e) => setReason(e.target.value as ReasonCode | '')}
          >
            <option value="">{copy.strip.reasonPlaceholder}</option>
            {HUMAN_REASONS.map((r) => (
              <option key={r} value={r}>
                {copy.reason[r]}
              </option>
            ))}
          </select>
        </label>

        <label htmlFor={ids.note} className="flex flex-col gap-1 text-body font-semibold text-ink">
          {copy.strip.note}
          <Textarea id={ids.note} data-testid="note-input" rows={2} maxLength={NOTE_MAX} value={note} aria-describedby={ids.noteCount} onChange={(e) => setNote(e.target.value)} className="font-normal" />
          <span id={ids.noteCount} className="text-small font-normal text-ink-muted text-right tabular-nums">
            {note.length} / {NOTE_MAX}
          </span>
        </label>
      </fieldset>

      {myError && (
        <p role="alert" className="p-3 rounded-[var(--radius-row)] bg-conflict-bg text-conflict text-small font-semibold" data-testid="strip-error">
          {copyForError(myError.code)}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button data-testid="apply" onClick={apply} disabled={!canApply} aria-describedby={disabled && view.state === 'escalated' ? ids.waiting : undefined}>
          {copy.strip.apply}
        </Button>
        <Button
          variant="secondary"
          data-testid="escalate"
          disabled={view.state === 'superseded'}
          onClick={() => onResolve(conflict.id, { type: 'escalate' }, 'NEEDS_PHARMACIST_REVIEW', note)}
        >
          {copy.strip.escalate}
        </Button>
        {view.canUndo && (
          <Button variant="ghost" data-testid="undo" onClick={() => onUndo(conflict.id)}>
            {copy.strip.undo}
          </Button>
        )}
      </div>
    </section>
  );
}

function Option({ value, label, testId }: { value: string; label: string; testId: string }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex items-center gap-3 min-h-10 px-2 rounded-[var(--radius-cell)] hover:bg-surface-2 cursor-pointer has-[:disabled]:cursor-not-allowed">
      <RadioGroupItem id={id} value={value} data-testid={testId} />
      <span className="text-body text-ink wrap-anywhere">{label}</span>
    </label>
  );
}

export type { Resolution };
