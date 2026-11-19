# Design: formulary-normaliser

## Overview
Pure functions in `src/core` that load the formulary and turn raw items into `MedEntry` values. The reference implementation in `docs/reference/reference.py` has the same rules and produced the golden data; use it to settle any doubt.

## Modules
```
src/core/formulary.ts     loadFormulary, index types
src/core/text.ts          norm(s), tokens(s)
src/core/normalise/mapDrug.ts
src/core/normalise/strength.ts
src/core/normalise/frequency.ts
src/core/normalise/status.ts
src/core/normalise/index.ts    normaliseItem, normaliseSourceList, formatStrength, formatFrequency, formatEntry, renderRaw
```
Types (`MedEntry`, `RawItem`, `RawSourceList`, `SourceList`, `IssueCode`, `Strength`, `Frequency`, `Status`, `Result`) live in `src/core/types.ts` and `errors.ts` exactly as in `docs/MERGE_SEMANTICS.md` section 2.

```ts
interface Formulary { items: FormularyItem[]; byId: Map<string, FormularyItem>; aliases: { tokens: string[]; id: string }[] }
interface FormularyItem { id: string; ingredient: string; display: string; form: string; route: string;
                          canonicalUnit: 'mg' | 'mcg' | 'ml' | 'iu'; strengths: number[][]; aliases: string[] }
type FormularyError = { code: 'FORMULARY_INVALID'; message: string };
interface NormIssue { code: IssueCode; itemIndex: number; field: 'name' | 'strength' | 'frequency' | 'status'; text: string }
```

## Algorithms (all rules are in requirements 2 to 5; this is the shape)

`norm(s)`: `s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()`. Non-ASCII letters therefore become separators. This is intentional and matches the reference.

Alias index: for each item and each alias, `tokens = norm(alias).split(' ')`. Reject collisions. Sort by `tokens.length` descending, then by the tokens joined with a space, ascending.

`mapDrug(name, form)`: `toks = norm((name ?? '') + ' ' + (form ?? '')).split(' ')`, drop empty tokens. For each alias in index order, scan for a contiguous match; first hit wins.

`parseStrength(text, canonicalUnit | null)`:
- regex `/(\d+(?:\.\d+)?)(?:\s*\/\s*(\d+(?:\.\d+)?))?\s*(mg|mcg|µg|ug|g|ml|iu)\b/i`, first match in the text.
- Mass factors to mg: g 1000, mg 1, mcg and ug and µg 0.001.
- Mass unit: target is the canonical unit if known, else `mcg` for mcg-type input and `mg` otherwise. If the target is not a mass unit (canonical ml or iu), return null. Converted value is `round6(v * factor(input) / factor(target))`, where `round6(x) = Math.round(x * 1e6) / 1e6` computed on a value that avoids binary noise (compute in integers where possible or use `Number(x.toFixed(6))`).
- ml or iu: valid only if canonical is null or equal; value `round6(v)`.
- Note the `\b` after the unit: "500mg." and "500 mg tablets" match; "500 mgs" does not.

`formatStrength`: values joined with `/` using `String(v)` (JS prints 0.4, 800, 60000 without trailing zeros), then a space and the unit.

`parseFrequency(text)`: trim and lower-case; try `^([01])-([01])-([01])(?:-([01]))?$`; then `^([1-4])\s*\/\s*day$`; then `norm(text.replace(/\./g, ''))` in the synonym sets of requirement 4; return `{kind:'scheduled', perDay}` or `{kind:'prn'}` or `null`. Keep the synonym sets in one exported constant object so tests can iterate them.

`parseStatus(text)`: `undefined` or blank returns `{status:'active'}`; otherwise `norm(text)` against the three sets; unknown returns `{status:'active', issue:'UNPARSED_STATUS'}`. Design note: defaulting an unreadable status to active is deliberate (the value is shown to the person with a flag, and it still participates in comparison, so a stopped-versus-active disagreement is surfaced rather than hidden). It is recorded in the Problems panel.

`normaliseItem(raw, formulary)`: map drug; parse strength (from `strength`, else from `name` when `strength` is blank); check formulary strengths (exact list equality after rounding); parse frequency; parse status; return `{entry, issues}`; entry flags are the non-blocking issue codes, sorted unique.

`normaliseSourceList(raw, formulary)`: normalise every item, keep first of each drugKey, add `DUPLICATE_DRUG` for later ones, sort by drugKey, set `valid = !issues.some(i => i.code === 'DUPLICATE_DRUG')`.

`renderRaw(entry)`: `{ name: entry.displayName, strength: formatStrength(entry.strength) or undefined, frequency: scheduled ? `${n}/day` : 'PRN' or undefined, status: entry.status }`.

## Error handling
Only `loadFormulary` returns an error. Everything else is total: any problem becomes an issue on the entry. Never throw.

## Data used
`data/formulary.json` has 43 items. Tests load it with `loadFormulary` through a helper `tests/helpers/formulary.ts`. UI loads the same file by import (`resolveJsonModule`) so the bundle contains it.

## Correctness properties (fast-check)
Generators in `tests/helpers/gen.ts`: `genFormularyItem`, `genStrengthOf(item)` (picks a listed strength), `genFreqCanonical`, `genStatusWord`, `genUnitSpelling`, `genMessyCase(s)` (random upper and lower case, random separators from ` -_/.`), `genRawItemFrom(item)`.

- **P-N1 Round trip.** For every formulary item, listed strength, frequency (1 to 4 per day or prn) and status, `normaliseItem(renderRaw(entry))` has the same drugKey, strength, frequency and status as `entry`, and no issues. Validates: formulary-normaliser 7.3.
- **P-N2 Name robustness.** For any alias of any item, any case change and any run of separators between tokens still maps to that item's id. Validates: formulary-normaliser 2.2, 2.3, 2.4.
- **P-N3 Unit equivalence.** For any listed mass strength, expressing it in mg, mcg (or ug, µg) or g (where that is exact in six decimals) normalises to the same value list. Validates: formulary-normaliser 3.2.
- **P-N4 Frequency synonyms.** Every phrase in a synonym class normalises to that class; `a-b-c` patterns with sum 1 to 4 normalise to the sum. Validates: formulary-normaliser 4.1 to 4.5.
- **P-N5 Totality and honesty.** For arbitrary strings (including empty, very long and non-Latin) in every raw field, `normaliseItem` does not throw; whenever strength is null the issues contain `UNPARSED_STRENGTH`; whenever frequency is null they contain `UNPARSED_FREQUENCY`; whenever the drug is unmapped they contain `UNMAPPED_DRUG`; all issue codes are valid. Validates: formulary-normaliser 2.5, 3.6, 4.6, 5.3, 6.5.
- **P-N6 No near-match guessing.** For any alias with one character changed so that it is no longer an alias of any item, the result is unmapped. Validates: formulary-normaliser 2.6. (Skip generated strings that happen to equal another alias.)

## Golden tests (`tests/golden/normalise.test.ts`)
For each scenario file, normalise each source and compare, per source, `{drugKey: valueString}` with `expected.normalised` and sorted unique issue codes with `expected.issues`. Validates: formulary-normaliser 6.6. Add a few hand-written table tests: `"Glucophage 500 BD"` style probes copied from `python3 docs/reference/reference.py --item`.

## Testing strategy
Unit tests for each parser with table-driven cases taken from requirements 3 to 5; the properties above; golden tests. Run `npm run test:props:fast` during development and `npm run test:props` (100 runs) before finishing a task. When a property fails, fix the code or the generator, never weaken the property (see `.kiro/steering/testing-pbt.md`).
