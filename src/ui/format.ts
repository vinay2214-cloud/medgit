/**
 * Display formatting for cells and lists: "500 mg", "2 / day", "as needed", "stopped".
 * Values only; never invents a value (null stays null and the caller shows "Unreadable").
 */
import { formatStrength, type Frequency, type MedEntry, type Status, type Strength } from '@core';

export function showStrength(s: Strength | null): string | null {
  return s === null ? null : formatStrength(s);
}

export function showFrequency(f: Frequency | null): string | null {
  if (f === null) return null;
  return f.kind === 'prn' ? 'as needed' : `${f.perDay} / day`;
}

export function showStatus(s: Status): string {
  return s === 'on-hold' ? 'on hold' : s;
}

/** One-line summary used in the strip and lists: "500 mg, 2 / day, stopped". */
export function showEntry(e: Pick<MedEntry, 'strength' | 'frequency' | 'status'>, unreadable: string): string {
  return [showStrength(e.strength) ?? unreadable, showFrequency(e.frequency) ?? unreadable, showStatus(e.status)].join(', ');
}

/** Short commit id shown in the UI. */
export const shortId = (id: string): string => id.slice(0, 7);

/** "20 Nov 2026, 10:00 UTC" from an ISO string; falls back to the raw text. */
export function showTime(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(iso);
  if (!m) return iso;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const date = `${Number(m[3])} ${months[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
  return m[4] ? `${date}, ${m[4]}:${m[5]} UTC` : date;
}
