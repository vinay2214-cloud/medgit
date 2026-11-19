# Design: interop-export

## Overview
Two pure modules in `src/core`: `casefile.ts` and `fhir.ts`. Hand-written validators (no schema library) keep the core dependency-free. The UI calls the exporters, creates a `Blob`, and triggers a download; that part is UI code, not core.

## Types
```ts
interface CaseState {
  scenarioId: string | null;
  patient: { label: string; age: number; sex: string };
  syntheticNotice: string;
  rawSources: RawSourceList[];
  history: Commit[];                // root to head
  resolutions: Resolution[];        // uncommitted working events
}
exportCaseFile(state: CaseState, clock: Clock): string
importCaseFile(text: string): Result<CaseState, { code: 'CASEFILE_INVALID'; message: string }>
toFhirBundle(commit: Commit, ctx: { patientLabel: string }): FhirBundle      // no clock: uses commit.at
fromFhirBundle(bundle: unknown): Result<MedEntry[], { code: 'FHIR_INVALID'; message: string }>
```
`FhirBundle` and `FhirMedicationStatement` are minimal interfaces defined in `fhir.ts` (only the fields used).

## Case file layout (`medgit.case/1`)
```json
{
  "schema": "medgit.case/1",
  "syntheticNotice": "SYNTHETIC DATA. ...",
  "exportedAt": "2026-11-20T10:00:00Z",
  "scenarioId": "hero",
  "patient": { "label": "Sample Patient A", "age": 72, "sex": "F" },
  "sources": [ { "id": "...", "label": "...", "kind": "...", "asOf": "...", "items": [ ... ] } ],
  "history": [ { "id": "...", "parentId": null, "message": "...", "author": {...}, "at": "...", "entries": [...], "resolutions": [...], "agreements": [...], "sourcesSeen": [...] } ],
  "resolutions": [ ... ]
}
```
Top-level key order is exactly the order above. Nested objects use the key order of the TypeScript interfaces. Writing the object literal in that order and calling `JSON.stringify(obj, null, 2)` is enough; the `exportedAt` value comes from `clock.now()`. `exportedAt` is metadata and is not read back into `CaseState`.

## Import validation
A set of small guards in `casefile.ts`: `isRecord`, `isString`, `isArrayOf`, `isRole`, `isReasonCode`, `isDecision`, `isStrength`, `isFrequency`, `isStatus`, `isMedEntry`, `isRawItem`, `isRawSource`, `isResolution`, `isCommit`. Each returns a boolean, and an outer `check(label, condition)` records the first failing label so the error message reads, for example, `history[1].entries[3].strength is not valid`. Limits: text length 2,000,000; sources 8; items per source 200; commits 100; resolutions 500; strings up to 2,000 characters. Wrap `JSON.parse` in try and catch. Unknown extra fields are dropped by building a fresh object from the known fields.

## FHIR export
```json
{
  "resourceType": "Bundle", "type": "collection",
  "meta": { "tag": [ { "system": "urn:medgit:tags", "code": "synthetic", "display": "Synthetic data, not for clinical use" } ] },
  "identifier": { "system": "urn:medgit:commit", "value": "<commit id>" },
  "timestamp": "<commit.at>",
  "entry": [ { "fullUrl": "urn:medgit:3a9f21c-metformin-tab", "resource": {
      "resourceType": "MedicationStatement", "id": "3a9f21c-metformin-tab",
      "meta": { "tag": [ ... ] },
      "status": "active",
      "medicationCodeableConcept": { "coding": [ { "system": "urn:medgit:formulary", "code": "metformin-tab", "display": "Metformin tablet" } ], "text": "Metformin tablet" },
      "subject": { "display": "Sample Patient A" },
      "dateAsserted": "<commit.at>",
      "extension": [ { "url": "urn:medgit:ext:strength", "valueString": "500 mg" } ],
      "dosage": [ { "text": "500 mg, 2/day", "timing": { "repeat": { "frequency": 2, "period": 1, "periodUnit": "d" } }, "asNeededBoolean": false } ],
      "note": [ { "text": "Decided: Confirmed with patient" } ]
  } } ]
}
```
Notes:
- The reason label for the note comes from a small label map in `fhir.ts` for the five human reason codes. The label of the entry's decision is found by looking up the commit's `resolutions` for a conflict with that drugKey (prefer the one that is not an OMISSION `exclude`; if several, use the lowest conflictId order); if none, the entry is "Agreed by all sources" only when the drugKey is in `commit.agreements`, otherwise omit `note`. If the entry was reached by `custom`, use "Entered by hand: <label>".
- This is a deliberately small subset. It is not a validated FHIR profile and the README says so. Local code system URNs are used because no real terminology is bundled.
- `dosage[0].text` is `<strength>, <frequency>` with value-string forms, omitting parts that are null.

## FHIR import (requirement 4)
Read `entry[*].resource`; require `resourceType` MedicationStatement and `status` in `active|stopped|on-hold`; drugKey from the coding code, or `unmapped:` plus slug of `text` when there is no coding; displayName from coding display or text; strength by parsing the extension `valueString` with the normaliser's strength parser (canonical unit null); frequency from `dosage[0]` (`asNeededBoolean` true gives prn; `timing.repeat.frequency` with period 1 and unit `d` gives scheduled 1 to 4; otherwise null). Flags empty.

## Error handling
Both importers return `Result`. The exporters are total. The UI maps `CASEFILE_INVALID` and `FHIR_INVALID` to the copy deck strings and shows the message in a details expander.

## Correctness properties (fast-check)
Generators: `genCaseState` builds a state from `genChain` (history-audit) plus raw sources from the normaliser generators and a few uncommitted resolutions; `genAnyJson` for junk.

- **P-I1 Case file round trip.** `importCaseFile(exportCaseFile(s, clock))` returns `s` (deep equal) for any generated state. Exporting twice gives identical text. Validates: interop-export 1.1, 1.3, 2.1.
- **P-I2 Import totality.** For arbitrary strings, arbitrary JSON text, and generated case files with one random field deleted or retyped, `importCaseFile` never throws and returns either a valid state or `CASEFILE_INVALID`. Validates: interop-export 2.2, 2.3, 2.4.
- **P-I3 FHIR round trip.** For any generated commit, `fromFhirBundle(toFhirBundle(commit))` returns entries with the same drugKey, strength, frequency and status as `commit.entries`; and `toFhirBundle` is deterministic. Validates: interop-export 3.1, 3.7, 3.10, 4.1. (Only if requirement 4 is built; otherwise test determinism and structure.)

## Golden tests
- `tests/golden/casefile.test.ts`: export the hero state after the demo commit; assert schema, key order, the presence of the synthetic notice, and that import returns an equal state. Import the three scenario files as case states by wrapping them; assert a tampered commit survives import but `verifyChain` then fails.
- `tests/golden/fhir.test.ts`: from the hero demo commit, assert the bundle has nine `MedicationStatement` resources, the aspirin one has status `stopped`, the salbutamol one has `asNeededBoolean` true, the cotrimoxazole one has strength text `800/160 mg`, every resource and the bundle have the synthetic tag, and ids use the first seven characters of the commit id.

## Testing strategy
Round-trip and totality properties find most import bugs. Golden tests pin the shape that other systems will rely on. Do not validate against an external FHIR validator as a requirement; if the builder has time, run the HL7 validator manually and note the result in `docs/KIRO_LOG.md` without claiming conformance.
