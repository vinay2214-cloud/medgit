/**
 * UI state and actions (docs/ARCHITECTURE.md section 5, review-ui design).
 * The merge result and the draft are never stored; selectors derive them.
 */
import type { CasePatient, CaseState, Commit, ConflictId, Decision, NormIssue, RawSourceList, ReasonCode, Resolution, Role, SourceId, SourceList } from '@core';
import type { Scenario } from '../data';

export type View = 'start' | 'reconcile' | 'history';
export type Filter = 'all' | 'open' | 'escalated' | 'resolved';
export type BoardView = 'chart' | 'markers';

export interface UiError {
  code: string;
  message?: string;
  /** Where the interface shows it. */
  where: 'strip' | 'commit' | 'import' | 'merge';
  conflictId?: ConflictId;
}

export interface AppState {
  view: View;
  role: Role;
  scenarioId: string | null;
  scenarioTitle: string | null;
  patient: CasePatient | null;
  syntheticNotice: string | null;
  rawSources: RawSourceList[];
  sources: SourceList[];
  issues: Record<SourceId, NormIssue[]>;
  /** Root to head. */
  history: Commit[];
  /** Working events since the last sign-off, append-only. */
  resolutions: Resolution[];
  ui: {
    selectedConflictId: ConflictId | null;
    filter: Filter;
    boardView: BoardView;
    commitMessage: string;
    historySelection: string | null;
    lastCommitId: string | null;
    /** True once a commit was made in this session or a case file with history was imported. */
    fhirReady: boolean;
  };
  lastError: UiError | null;
  /** id increments so the same text is announced again. */
  announcement: { id: number; text: string } | null;
}

export type Action =
  | { type: 'LOAD_SCENARIO'; scenario: Scenario }
  | { type: 'IMPORT_CASEFILE'; state: CaseState }
  | { type: 'IMPORT_FAILED'; code: string; message?: string }
  | { type: 'SET_ROLE'; role: Role }
  | { type: 'SET_VIEW'; view: View }
  | { type: 'SELECT_CONFLICT'; id: ConflictId | null }
  | { type: 'SET_FILTER'; filter: Filter }
  | { type: 'SET_BOARD_VIEW'; view: BoardView }
  | { type: 'RESOLVE'; conflictId: ConflictId; decision: Decision; reasonCode: ReasonCode; note?: string; at: string }
  | { type: 'UNDO_LAST'; conflictId: ConflictId; at: string }
  | { type: 'SET_COMMIT_MESSAGE'; text: string }
  | { type: 'COMMIT'; at: string }
  | { type: 'RESET_CASE' }
  | { type: 'SET_HISTORY_SELECTION'; id: string | null }
  | { type: 'CLEAR_ERROR' };
