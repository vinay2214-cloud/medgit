/**
 * Status parsing. An absent or blank status is active (the only default the safety rules allow).
 * An unreadable status is shown as active with the UNPARSED_STATUS flag, so it still takes part
 * in comparison and a stopped-versus-active disagreement is surfaced rather than hidden.
 * Validates formulary-normaliser 5.1, 5.2, 5.3.
 */

import { norm } from '../text';
import type { Status } from '../types';

export const STATUS_SYNONYMS: Readonly<Record<Status, readonly string[]>> = {
  active: ['active', 'current', 'taking', 'continue', 'continuing', 'ongoing'],
  stopped: ['stopped', 'discontinued', 'dc', 'ceased', 'not taking', 'stop'],
  'on-hold': ['on hold', 'hold', 'held', 'paused', 'suspended'],
};

export function parseStatus(text: string | undefined): { status: Status; issue?: 'UNPARSED_STATUS' } {
  if (text === undefined || text.trim() === '') return { status: 'active' };
  const n = norm(text);
  for (const status of ['active', 'stopped', 'on-hold'] as const) {
    if (STATUS_SYNONYMS[status].includes(n)) return { status };
  }
  return { status: 'active', issue: 'UNPARSED_STATUS' };
}
