/**
 * Shared domain types. Mirrors docs/MERGE_SEMANTICS.md section 2 exactly.
 * Pure type declarations: no runtime code.
 */

export type SourceId = string;
export type DrugKey = string;
export type Role = 'clinician' | 'pharmacist';
export type Status = 'active' | 'stopped' | 'on-hold';
export type Unit = 'mg' | 'mcg' | 'ml' | 'iu';

export interface Strength {
  values: number[];
  unit: Unit;
}

export type Frequency = { kind: 'scheduled'; perDay: 1 | 2 | 3 | 4 } | { kind: 'prn' };

export type IssueCode =
  | 'UNMAPPED_DRUG'
  | 'UNPARSED_STRENGTH'
  | 'STRENGTH_NOT_IN_FORMULARY'
  | 'UNPARSED_FREQUENCY'
  | 'UNPARSED_STATUS'
  | 'DUPLICATE_DRUG';

export type EntryFlag = Exclude<IssueCode, 'DUPLICATE_DRUG'>;

export interface MedEntry {
  drugKey: DrugKey;
  displayName: string;
  strength: Strength | null;
  frequency: Frequency | null;
  status: Status;
  /** Sorted, unique. Derived from the normaliser; never compared. */
  flags: EntryFlag[];
}

export interface RawItem {
  name: string;
  form?: string;
  strength?: string;
  frequency?: string;
  status?: string;
  note?: string;
}

export type SourceKind = 'prescriber' | 'dispenser' | 'patient';

export interface RawSourceList {
  id: SourceId;
  label: string;
  kind: SourceKind;
  asOf: string;
  items: RawItem[];
}

export interface SourceList {
  id: SourceId;
  label: string;
  kind: SourceKind;
  asOf: string;
  /** Sorted by drugKey; drugKeys unique. */
  entries: MedEntry[];
  /** False if a blocking normaliser issue exists. */
  valid: boolean;
}

export interface NormIssue {
  code: IssueCode;
  itemIndex: number;
  field: 'name' | 'strength' | 'frequency' | 'status';
  text: string;
}

export interface FormularyItem {
  id: string;
  ingredient: string;
  display: string;
  form: string;
  route: string;
  canonicalUnit: Unit;
  strengths: number[][];
  aliases: string[];
}

export interface Formulary {
  items: FormularyItem[];
  byId: Map<string, FormularyItem>;
  /** Ordered: token count descending, then tokens joined by a space ascending. */
  aliases: { tokens: string[]; id: string }[];
}

export type ConflictKind = 'OMISSION' | 'DOSE' | 'FREQUENCY' | 'STATUS';
export type ConflictId = `${DrugKey}::${ConflictKind}`;

/** entry is null only for OMISSION: "not listed". */
export interface Claim {
  source: SourceId;
  entry: MedEntry | null;
}

export interface Conflict {
  id: ConflictId;
  drugKey: DrugKey;
  kind: ConflictKind;
  claims: Claim[];
}

export type ChangeVsBase = 'added' | 'changed' | 'unchanged' | null;

export interface CleanEntry {
  entry: MedEntry;
  agreedBy: SourceId[];
  changeVsBase: ChangeVsBase;
}

export interface MergeSourceInfo {
  id: SourceId;
  label: string;
  kind: string;
  asOf: string;
}

export interface MergeResult {
  baseCommitId: string | null;
  /** Sorted by id. */
  sources: MergeSourceInfo[];
  /** Sorted by drugKey. */
  clean: CleanEntry[];
  /** Sorted by drugKey, then kind order OMISSION, DOSE, FREQUENCY, STATUS. */
  conflicts: Conflict[];
  /** In base, listed by no source. Sorted. */
  removedVsBase: DrugKey[];
}

export type ReasonCode =
  | 'VERIFIED_WITH_PRESCRIBER'
  | 'CONFIRMED_WITH_PATIENT'
  | 'PER_DISPENSING_RECORD'
  | 'PER_DISCHARGE_SUMMARY'
  | 'CLINICAL_JUDGEMENT'
  | 'NEEDS_PHARMACIST_REVIEW';

export type Decision =
  | { type: 'include' }
  | { type: 'exclude' }
  | { type: 'choose'; source: SourceId }
  | { type: 'custom'; value: Strength | Frequency | Status }
  | { type: 'escalate' };

export interface Actor {
  role: Role;
  name?: string;
}

export interface Resolution {
  seq: number;
  conflictId: ConflictId;
  decision: Decision;
  reasonCode: ReasonCode;
  note?: string;
  by: Actor;
  at: string;
}

export type EffectiveResolution = Resolution & { manual: boolean };

export type ConflictState = 'open' | 'escalated' | 'resolved' | 'superseded';

export interface Draft {
  states: Record<ConflictId, ConflictState>;
  /** Fully decided drugs only, sorted by drugKey. */
  entries: MedEntry[];
  /** Drugs a person chose to leave off. Sorted. */
  excluded: DrugKey[];
  /** Drugs with at least one open or escalated conflict. Sorted. */
  pendingDrugKeys: DrugKey[];
  /** Conflicts in state open or escalated. */
  pendingCount: number;
  canCommit: boolean;
  /** Latest event per conflict, sorted by conflictId. */
  effective: EffectiveResolution[];
}

export interface Commit {
  id: string;
  parentId: string | null;
  message: string;
  author: Actor;
  at: string;
  entries: MedEntry[];
  resolutions: EffectiveResolution[];
  agreements: { drugKey: DrugKey; agreedBy: SourceId[] }[];
  sourcesSeen: { id: SourceId; asOf: string }[];
}

export interface PriorCommit {
  message: string;
  author: Actor;
  at: string;
  items: RawItem[];
}

export interface LogLine {
  id: string;
  message: string;
  author: Actor;
  at: string;
  entryCount: number;
  resolutionCount: number;
}

export type DiffField = 'strength' | 'frequency' | 'status';

export interface CommitDiff {
  added: DrugKey[];
  removed: DrugKey[];
  /** Values as display strings. */
  changed: { drugKey: DrugKey; field: DiffField; from: string; to: string }[];
}

export interface BlameLine {
  drugKey: DrugKey;
  blamedCommitId: string;
  reasonCodes: ReasonCode[];
  lastDecision: { commitId: string; reasonCodes: ReasonCode[] } | null;
}
