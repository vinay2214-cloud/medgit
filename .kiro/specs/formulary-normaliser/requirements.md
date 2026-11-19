# Requirements: formulary-normaliser

## Introduction
Turn raw, messy medicine items from different sources into comparable normalised entries, using a small synthetic formulary. Nothing is guessed: whatever cannot be read is kept as written, flagged, and shown.

Read first: `.kiro/steering/clinical-safety.md`, `docs/MERGE_SEMANTICS.md` (sections 2 and 10), `data/formulary.json`, the `normalised` and `issues` blocks of `data/scenarios/*.json`. The executable oracle is `docs/reference/reference.py` (`python3 docs/reference/reference.py --item "..."`, `--check`).

Terms: a **raw item** is `{name, form?, strength?, frequency?, status?, note?}`. A **value string** is `"<strength>|<frequency>|<status>"`, for example `"800/160 mg|2/day|active"`, with `null` where a value is missing.

## Requirements

### Requirement 1: Formulary loading
**User Story:** As a developer, I want the formulary validated at load time, so that mapping can never silently depend on bad data.

#### Acceptance Criteria
1. WHEN `loadFormulary` receives JSON with schema `medgit.formulary/1`, THE function SHALL return an indexed formulary.
2. IF the schema field differs, the items list is empty, an item lacks a required field, or two items share an id, THEN THE function SHALL return the error `FORMULARY_INVALID` with a message naming the problem.
3. IF two different items have the same alias after normalisation, THEN THE function SHALL return `FORMULARY_INVALID` naming both items and the alias.
4. THE indexed formulary SHALL order aliases by token count descending, then alphabetically, so that the longest alias is tried first.

### Requirement 2: Drug mapping
**User Story:** As a pharmacist, I want brand names, spellings and forms mapped to one drug, so that the same medicine from two sources compares as the same.

#### Acceptance Criteria
1. THE mapper SHALL normalise text by lower-casing it, replacing every run of characters other than a to z and 0 to 9 with one space, and trimming.
2. WHEN mapping, THE mapper SHALL search the tokens of the raw name followed by the raw form for the first alias, in index order, that occurs as a contiguous token sequence anywhere in them.
3. THE mapper SHALL ignore letter case, punctuation and extra spaces, so that "GLUCOPHAGE", "glucophage" and "Gluco-phage" behave identically only where the normalised tokens are equal.
4. WHEN a brand name is an alias of a formulary item, THE entry SHALL receive that item's id as `drugKey` and its `display` as `displayName`.
5. IF no alias matches, THEN THE entry SHALL receive `drugKey` equal to `unmapped:` followed by the normalised name with spaces replaced by hyphens, `displayName` equal to the raw name trimmed, and the issue `UNMAPPED_DRUG`.
6. THE mapper SHALL NOT use fuzzy matching, edit distance, phonetic matching or any guess about near matches.

### Requirement 3: Strength parsing
**User Story:** As a pharmacist, I want "0.05 mg" and "50 mcg" treated as the same dose, so that unit differences are not reported as conflicts.

#### Acceptance Criteria
1. THE parser SHALL read a strength as one number or two numbers separated by a slash, followed by a unit among g, mg, mcg, ug, µg, ml, iu (case-insensitive), allowing spaces, found anywhere in the text.
2. WHEN the unit is a mass unit, THE parser SHALL convert the values to the formulary item's canonical unit (g to 1000 mg; mcg, ug and µg to 0.001 mg), and round each value to six decimal places.
3. WHEN the drug is unmapped and the unit is a mass unit, THE parser SHALL use mcg if the input unit is mcg, ug or µg, and mg otherwise.
4. WHEN the unit is ml or iu, THE parser SHALL accept it only if the drug is unmapped or its canonical unit equals that unit.
5. IF the raw `strength` is absent or blank, THEN THE parser SHALL try the raw `name` as the strength text.
6. IF no strength can be read, or the unit cannot be converted to the canonical unit, THEN THE entry SHALL have `strength` null and the issue `UNPARSED_STRENGTH`.
7. WHEN the drug is mapped, a strength was read, and the value list is not among the item's listed strengths, THE entry SHALL keep the value and carry the issue `STRENGTH_NOT_IN_FORMULARY`.
8. THE value string SHALL print strengths as numbers joined by `/`, a space, and the unit, with no trailing zeros (for example `0.4 mg`, `800/160 mg`, `50 mcg`).

### Requirement 4: Frequency parsing
**User Story:** As a pharmacist, I want "BD", "twice daily" and "1-0-1" read as the same frequency.

#### Acceptance Criteria
1. THE parser SHALL read patterns of the form `a-b-c` and `a-b-c-d` where each part is 0 or 1 as scheduled once to four times a day equal to the sum, and SHALL treat a sum of 0 or more than 4 as unreadable.
2. THE parser SHALL read `n/day` with n from 1 to 4 as scheduled n per day.
3. THE parser SHALL read the following (after lower-casing, removing full stops, and normalising as in 2.1) as scheduled once per day: od, qd, once daily, once a day, once, daily, hs, at night, nocte, night, mane, morning, every morning, in the morning, at bedtime, bedtime, 1 day.
4. THE parser SHALL read as scheduled twice per day: bd, bid, bds, twice daily, twice a day, 2 times a day, two times daily; as three per day: tds, tid, three times daily, three times a day, 3 times a day; as four per day: qid, qds, four times daily, 4 times a day.
5. THE parser SHALL read as as-needed (`prn`): prn, sos, as needed, when required, if needed, as required.
6. IF the text is absent or matches none of the above, THEN THE entry SHALL have `frequency` null and the issue `UNPARSED_FREQUENCY`.
7. THE value string SHALL print a scheduled frequency as `n/day` and as-needed as `prn`.

### Requirement 5: Status parsing
**User Story:** As a pharmacist, I want stopped and on-hold medicines shown as such.

#### Acceptance Criteria
1. WHEN the status is absent or blank, THE entry SHALL have status `active` and no issue.
2. THE parser SHALL read active, current, taking, continue, continuing, ongoing as `active`; stopped, discontinued, dc, ceased, not taking, stop as `stopped`; on hold, hold, held, paused, suspended as `on-hold`, using the normalisation of 2.1.
3. IF the status text is present and matches none of these, THEN THE entry SHALL have status `active` and the issue `UNPARSED_STATUS`.

### Requirement 6: Source list normalisation
**User Story:** As a user, I want each source list turned into a clean, sorted list with every problem reported.

#### Acceptance Criteria
1. THE function `normaliseSourceList` SHALL return a `SourceList` whose entries are sorted by `drugKey` ascending.
2. WHEN two raw items in one list map to the same `drugKey`, THE function SHALL keep the first, SHALL record the issue `DUPLICATE_DRUG` for the second, and SHALL mark the list `valid: false`.
3. THE function SHALL return every issue with its item index, its code, the field concerned, and the raw text.
4. THE function SHALL copy each entry's non-blocking issue codes into the entry's `flags`, sorted and unique.
5. THE function SHALL be pure and deterministic and SHALL NOT throw for any input of the correct type, including empty strings, very long strings and non-Latin characters.
6. WHEN given the `sources` of each scenario in `data/scenarios`, THE function SHALL produce exactly the `normalised` value strings and the per-source sorted unique issue codes recorded in the scenario's `expected` block.

### Requirement 7: Formatting and round trip
**User Story:** As a developer, I want a stable text form for values, so that the UI, exports and tests agree.

#### Acceptance Criteria
1. THE functions `formatStrength`, `formatFrequency` and `formatEntry` SHALL produce the value-string parts defined in 3.8, 4.7 and the status word, with `null` where the value is null.
2. THE function `renderRaw` SHALL turn an entry into a raw item whose `name` is the entry's display name, whose strength and frequency are the formatted forms (frequency `PRN` for as-needed), and whose status is the status word.
3. FOR ALL entries of mapped drugs with a strength, a frequency and a status, normalising `renderRaw(entry)` SHALL produce an entry with the same drugKey, strength, frequency and status.
