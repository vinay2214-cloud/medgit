/**
 * Result helpers and error code unions. See docs/MERGE_SEMANTICS.md section 9.
 */

export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): { ok: true; value: T } {
  return { ok: true, value };
}

export function err<E>(error: E): { ok: false; error: E } {
  return { ok: false, error };
}

export type FormularyError = { code: 'FORMULARY_INVALID'; message: string };

export type MergeError =
  | { code: 'TOO_FEW_SOURCES' }
  | { code: 'DUPLICATE_SOURCE_ID'; id: string }
  | { code: 'INVALID_SOURCE'; id: string };

export type ResolveErrorCode = 'NOT_A_CLAIMANT' | 'REASON_REQUIRED' | 'NOT_AUTHORISED' | 'INVALID_DECISION';
export type ResolveError = { code: ResolveErrorCode; message: string };

export type CommitErrorCode = 'UNRESOLVED_CONFLICTS' | 'MESSAGE_REQUIRED' | 'CANONICAL_INVALID';
export type CommitError = { code: CommitErrorCode };

export type CanonicalError = { code: 'CANONICAL_INVALID'; path: string };

export type ChainError = { code: 'CHAIN_BROKEN'; index: number };

export type CaseFileError = { code: 'CASEFILE_INVALID'; message: string };

export type FhirError = { code: 'FHIR_INVALID'; message: string };
