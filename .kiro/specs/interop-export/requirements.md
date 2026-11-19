# Requirements: interop-export

## Introduction
Let a person save and reload their work (case file) and hand the signed-off list to other systems (a FHIR R4 `MedicationStatement` bundle). Everything is generated in the browser. All exported data carries the synthetic marker.

Read first: `docs/ARCHITECTURE.md` (sections 4 and 10), `docs/MERGE_SEMANTICS.md` (types), `.kiro/steering/clinical-safety.md`.

Priority: requirements 1 to 3 are **ship**. Requirement 4 (FHIR import) is **cut first**: build it only after everything else in this spec and the review-ui spec is done and tested.

## Requirements

### Requirement 1: Case file export
**User Story:** As a user, I want to save my work to a file, so that I can continue later or share it.

#### Acceptance Criteria
1. THE function `exportCaseFile` SHALL return JSON text with schema `medgit.case/1` containing: the synthetic notice, the export time from the injected clock, the scenario id (or null), the patient label, age and sex as given by the scenario, the raw source lists, the commit history, and the working resolutions not yet committed.
2. THE exported text SHALL be pretty-printed with two-space indentation and a fixed key order.
3. THE function SHALL be deterministic: the same state and clock give the same text.
4. THE function SHALL NOT include browser state, theme, role or any other interface setting.

### Requirement 2: Case file import
**User Story:** As a user, I want to load a saved case file, with clear errors when it is wrong.

#### Acceptance Criteria
1. THE function `importCaseFile` SHALL return a `CaseState` equal to the exported state when given text produced by `exportCaseFile`.
2. IF the text is longer than 2,000,000 characters, is not valid JSON, has a different schema, lacks a required field, has a field of the wrong type, or exceeds the limits (8 sources, 200 items per source, 100 commits, 500 resolutions), THEN THE function SHALL return `CASEFILE_INVALID` with a message naming the first problem.
3. THE function SHALL validate the shape of every raw source list, commit and resolution before returning, and SHALL NOT trust any field it has not checked.
4. THE function SHALL NOT throw for any input string.
5. THE function SHALL NOT reject a file merely because its commit chain fails verification; the caller shows the result of `verifyChain`.
6. THE function SHALL ignore unknown extra fields.

### Requirement 3: FHIR bundle export
**User Story:** As an integrator, I want the signed-off list as a FHIR R4 bundle, so that other systems can read it.

#### Acceptance Criteria
1. THE function `toFhirBundle` SHALL return a Bundle of type `collection` with one `MedicationStatement` resource per entry of the given commit, in drugKey order.
2. EACH bundle and each resource SHALL carry a `meta.tag` with system `urn:medgit:tags`, code `synthetic`, and the display "Synthetic data, not for clinical use".
3. THE bundle SHALL carry the commit id as an identifier with system `urn:medgit:commit`, the timestamp of the commit's `at`, and no other time.
4. EACH `MedicationStatement` SHALL set `status` to the entry's status (`active`, `stopped` or `on-hold`), `dateAsserted` to the commit's `at`, and a `subject.display` of the patient label.
5. FOR a mapped drug, THE `medicationCodeableConcept` SHALL have one coding with system `urn:medgit:formulary`, the formulary id as code and the display name as display, and `text` equal to the display name; FOR an unmapped drug it SHALL have `text` only.
6. THE strength SHALL be exported as an extension with url `urn:medgit:ext:strength` and `valueString` equal to the formatted strength, omitted when the strength is null.
7. THE frequency SHALL be exported in `dosage[0]`: a scheduled frequency of n per day as `timing.repeat` with `frequency` n, `period` 1, `periodUnit` `d`, and `asNeededBoolean` false; an as-needed frequency as `asNeededBoolean` true with no timing; a null frequency with no timing and no `asNeededBoolean`. `dosage[0].text` SHALL be the formatted strength and frequency.
8. THE decision reason SHALL be exported in `note[0].text` as "Agreed by all sources" for an agreed entry, or "Decided: " followed by the reason label, or "Entered by hand: " followed by the reason label for a `custom` decision.
9. THE function SHALL NOT use random numbers or the clock; resource ids SHALL be `<first 7 characters of the commit id>-<drugKey>`, and `fullUrl` SHALL be `urn:medgit:<resource id>`.
10. THE function SHALL be deterministic.

### Requirement 4: FHIR bundle import (cut first)
**User Story:** As an integrator, I want to read back a bundle MedGit wrote.

#### Acceptance Criteria
1. THE function `fromFhirBundle` SHALL return the medicine entries from a Bundle that `toFhirBundle` produced, with the same drugKey, strength, frequency and status as in the commit.
2. IF the input is not a Bundle of type `collection` containing only `MedicationStatement` resources with the MedGit coding or text, or lacks `status`, THEN THE function SHALL return `FHIR_INVALID` with a message.
3. THE function SHALL NOT throw for any input value.
4. THE function SHALL NOT claim clinical validity; it reads only what MedGit writes.
