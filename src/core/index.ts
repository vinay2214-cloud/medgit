/**
 * MedGit core public API. The UI imports from this file only.
 * Pure TypeScript. No React, no browser APIs, no clock, no randomness, no network.
 */

export * from './types';
export * from './errors';
export { fixedClock, type Clock } from './clock';
export { norm, tokens, compareCodeUnits } from './text';
export { loadFormulary } from './formulary';
export {
  normaliseItem,
  normaliseSourceList,
  formatEntry,
  renderRaw,
  mapDrug,
  parseStrength,
  formatStrength,
  parseFrequency,
  formatFrequency,
  parseStatus,
  round6,
  FREQUENCY_SYNONYMS,
  STATUS_SYNONYMS,
  ISSUE_CODES,
} from './normalise/index';
export {
  mergeSources,
  equalStrength,
  equalFrequency,
  equalValues,
  formatField,
  fieldOfKind,
  KIND_ORDER,
  FIELD_KINDS,
  type FieldKind,
  type EntryField,
} from './merge';
export {
  validateResolution,
  applyResolutions,
  effectiveResolutions,
  isValidCustomValue,
  isValidStrength,
  isValidFrequency,
  isValidStatus,
  REASON_CODES,
  NOTE_MAX,
} from './resolve';
export { renderMarkers, renderConflictMarkers } from './markers';
export { canonicalise, sha256Hex, deepClone } from './canonical';
export { commitDraft, commitId, verifyChain, log, diffCommits, blame, replayPriorCommits, MESSAGE_MAX, type CommitBody } from './history';
export {
  exportCaseFile,
  importCaseFile,
  CASEFILE_SCHEMA,
  CASEFILE_LIMITS,
  DEFAULT_SYNTHETIC_NOTICE,
  type CaseState,
  type CasePatient,
} from './casefile';
export {
  toFhirBundle,
  fromFhirBundle,
  REASON_LABELS,
  SYNTHETIC_TAG,
  type FhirBundle,
  type FhirMedicationStatement,
} from './fhir';
