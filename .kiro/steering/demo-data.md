---
inclusion: manual
---
# MedGit: working with demo data (include manually with #demo-data)

## Files
- `data/formulary.json`: 43 synthetic items. Fields: `id`, `ingredient`, `display`, `form`, `route`, `canonicalUnit`, `strengths` (array of arrays; combinations have two numbers), `aliases`.
- `data/scenarios/hero.json`, `clean.json`, `messy.json`: each has `sources[]` (raw items), `priorCommits[]` (replayed through the normaliser to build history), `demoScript[]` (the decisions used by the demo and the e2e test) and `expected` (golden results).

## Value strings used in `expected`
- strength: `"500 mg"`, `"800/160 mg"`, `"50 mcg"`, or `"null"`.
- frequency: `"2/day"`, `"prn"`, or `"null"`.
- status: `"active"`, `"stopped"`, `"on-hold"`.
- entry summary: `"500 mg|2/day|active"`.
- OMISSION claims map each source id to an entry summary or `null` (not listed). Field conflicts map only the listing sources to the field value.

## Adding a scenario
1. Write raw items the way real lists look (brands, `1-0-1`, grams).
2. Work out the expected conflicts by hand from `docs/MERGE_SEMANTICS.md`.
3. Write the `expected` block by hand. Do not copy output from the implementation.
4. Run `npm run validate:data`, then add a golden test.

## Reminders
- Everything is synthetic and carries the notice. Keep it.
- Patients are labelled "Sample Patient A/B/C". No real names.
