# MedGit UX specification

Companion to `docs/DESIGN_SYSTEM.md` (how it looks) and `.kiro/specs/review-ui/` (what is required). This file says what each screen contains, how it behaves, and what it says.

## 1. Experience in one paragraph
MedGit feels like a **medication chart that is being stitched shut**. Sources are columns, medicines are rows. Where all sources agree, the row is quiet. Where they disagree, a red dashed seam runs along the row, like an open suture. Deciding a conflict closes the seam: the dashes draw solid, the colour turns green, one short animation. That seam is the single bold idea. Everything else is calm, dense and legible.

## 2. Information architecture
Three views in one app shell. No routing library; view state lives in the store and mirrors to the URL hash (`#/start`, `#/reconcile`, `#/history`).

```
App shell
  Header: product mark, case title, synthetic notice chip, role switch, theme switch, export menu
  Start       choose a scenario or import a case file
  Reconcile   the working screen (chart, decision strip, merged list, commit panel)
  History     log, diff, last-changed
  Footer      "Synthetic data. Not for clinical use."
```

## 3. Header
- Left: mark (a small seam glyph) and "MedGit".
- Centre: patient label and scenario title (for example "Sample Patient A. Hospital discharge").
- Right: **Role** segmented control (Clinician | Pharmacist), **Theme** menu (System, Light, Dark), **Export** menu (Case file, FHIR bundle).
- A persistent chip: "Synthetic data". Visible at every width.
- Role is a demo control, not authentication. Its tooltip says: "Switches who is deciding. Escalated items need a pharmacist."

## 4. Start view
Layout: a centred column, max width 880 px.
- Title: "Reconcile medicine lists".
- One line: "Compare lists from every source, decide each difference, and sign off with a record."
- Three scenario rows in a ledger list, not a card grid (Hero, Clean, Messy). Each row shows: title, one-sentence blurb, counts (sources, medicines), and a primary button "Open". The Hero row is larger and first.
- Secondary: "Import a case file" (file picker, accepts `.json`, max 2 MB).
- Notice block: the scenario's `syntheticNotice` text.
- The Hero row has the focus on load.

## 5. Reconcile view

### 5.1 Layout (desktop 1024 and wider)
```
+--------------------------------------------------------------------------------+
| header                                                                          |
+--------------------------------------------------------------------------------+
| Summary bar:  6 to decide  |  1 escalated  |  3 agreed   [Chart | Markers]       |
|               filter: All  Open  Escalated  Resolved                              |
+--------------------------------------------+-----------------------------------+
| MEDICATION CHART (matrix)                  | DECISION STRIP (right, 360-420 px) |
|        Hospital  GP  Pharmacy  Patient     |  selected conflict                  |
| row    value     value ...                 |  claims list                        |
| ~~~~ seam ~~~~ (conflict rows)             |  options (radio group)              |
| row (agreed, quiet)                        |  reason (select)  note (optional)   |
|                                            |  [Apply decision]  [Escalate]       |
+--------------------------------------------+-----------------------------------+
| MERGED LIST (what will be signed off)                          | COMMIT PANEL     |
| lines with provenance chips                                    | message, role,   |
|                                                                | [Sign off]       |
+--------------------------------------------------------------------------------+
```
At 1440 px the chart and strip sit side by side and the merged list and commit panel sit below. At 1024 px the strip becomes a right-hand drawer that opens on row selection. At 390 px the chart becomes a stack of medicine cards (see 5.6).

### 5.2 Summary bar
- Counters are text plus icon: "6 to decide", "1 escalated", "3 agreed". Counters update with a polite live region announcement ("5 to decide").
- Filter is a segmented control. Keyboard: arrow keys. Filters change which rows show; they never change counts.
- View toggle: Chart | Markers. Selection persists while the case is open.

### 5.3 Medication chart (matrix)
- Columns: Medicine, then one column per source in sorted id order (Hospital, GP, Pharmacy, Patient), then Status.
- Each source cell shows the value this source holds as strength and frequency on two lines: "500 mg" and "2 / day". Status shows only if not active ("stopped"). "Not listed" in muted italics for a source that omits the medicine.
- Each source column header has a coloured thread chip (the source colour) and the source's `asOf` date.
- **Agreed row**: normal surface, a small check icon with the text "Agreed by all". One value cell only spanning source columns is not used; keep the four cells so the eye can verify.
- **Conflict row**: the cells that disagree get a thick underline in their source colour. A **seam** (dashed line, `--seam-open`) runs under the row from the first source cell to the last. The Status column shows a pill: "Dose", "Frequency", "Status" or "Not on every list" (OMISSION), with an icon.
- **Escalated row**: seam amber, pill "With pharmacist".
- **Resolved row**: seam solid green; the chosen value gets a check mark; the pill reads "Decided".
- **Superseded** (drug excluded): row struck through with "Left off the list" and no seam.
- Row selection: click, or Up/Down arrows when the chart has focus; Enter selects. Selected row has the focus ring and a 2 px left bar in `--violet`.
- A row with several conflicts (for example Omission and Dose) shows one pill per conflict; the strip lists them as tabs.

### 5.4 Seam behaviour
- Open: dashed, `--seam-open`, static. Never animate while idle.
- Closing: on `RESOLVE` success, the dashes' `stroke-dashoffset` animates to a solid line over `--seam-close-ms` (360 ms) while the stroke colour crossfades to `--seam-closed`. Runs once per resolution.
- Escalating: colour changes to amber with a 160 ms crossfade, dashes stay.
- Reopening (a resolved conflict gets a new decision, or the base changes): no animation, state change only.
- Reduced motion: `--seam-close-ms` is 0, state changes are immediate.
- All seam state is also readable as text (pill) and as an accessible name (see 9).

### 5.5 Decision strip
Header: medicine display name and kind pill ("Dose conflict").
Body:
1. **Claims**: one row per claimant with the thread chip, source label, value, `asOf`. For OMISSION, sources that omit show "Not listed".
2. **Options** (radio group, labelled "Decision"):
   - For field conflicts: one radio per claimant "Use hospital value: 5 mg" plus "Enter a different value".
   - For OMISSION: "Include on reconciled list" and "Leave off the list".
   - "Enter a different value" reveals a typed input (strength, frequency or status control by kind). Validation message appears inline.
3. **Reason** (select, required): Verified with prescriber, Confirmed with patient, Per dispensing record, Per discharge summary, Clinical judgement. (Needs pharmacist review is only used by Escalate.)
4. **Note** (optional textarea, 280 character counter).
5. Actions: **Apply decision** (primary) and **Escalate to pharmacist** (secondary). Escalate needs no extra fields; it records the reason "Needs pharmacist review".
6. If the conflict is escalated and the current role is Clinician: options and Apply are disabled with a message "Waiting for a pharmacist." If the current role is Pharmacist: enabled.
7. After applying: focus moves to the next open conflict row (or to the Commit panel if none). A live region announces the result.
8. An "Undo last decision" text button appears only when the conflict has more than one decision event. It re-records the previous decision as a new event (the log keeps all of them). With a single decision, change it by choosing another option.

### 5.6 Mobile layout (390 px)
- Chart rows become cards: medicine name, pill, and a vertical list of the four source values with thread chips. Tapping a card opens the Decision strip as a bottom sheet.
- Summary bar stays at the top and is sticky.
- Commit panel is a sticky bottom bar showing "3 to decide" or "Sign off".

### 5.7 Marker view
A read-only monospaced view that renders each conflict like a git conflict, with source labels in the markers:

```
metformin-tab  FREQUENCY
<<<<<<< hospital, gp, pharmacy
2/day
=======
1/day
>>>>>>> patient
```
Each block shows only the field in conflict, using the value-string forms (`500 mg`, `2/day`, `prn`, `stopped`). Claimants who hold the same value are grouped under one header, ordered by their first source id; the groups are separated by `=======`; the last group's source list sits after `>>>>>>>`. An OMISSION block shows `listed: <strength>, <frequency>, <status>` for the listing sources and `(not listed)` for the sources that omit the medicine. One block per conflict, grouped by medicine. The text is generated by a pure function `renderMarkers(conflicts)` in the core, so it can be tested and exported. Selecting a block selects the same conflict in the strip. This is the "it really is git" moment for the demo. Use the mono token font. Marker view shows the same state pills as the chart.

### 5.8 Merged list
- Title: "Reconciled list". Subtitle: "{n} medicines decided, {m} waiting" (m is `pendingDrugKeys.length`).
- One line per decided medicine: name, strength, frequency, status, provenance chip: "Agreed by all" or "Decided: {reason}" or "Entered by hand" (manual).
- Waiting medicines show as ghost lines "Waiting: {name}" with the seam colour. They are never filled in provisionally.
- Lines excluded by a person are not listed here; a footnote counts them: "1 left off by decision".

### 5.9 Commit panel
- Disabled until `canCommit`. When disabled, it states why: "Resolve 3 more differences to sign off."
- Fields: message (required, max 200, counter), author role (read from header), optional name.
- Primary button: **Sign off**. Success: the panel shows the short id with a copy button and "Signed off by {role} at {time}". Focus moves to a "View history" link.
- After a commit, the working resolutions clear and the chart re-merges against the new head: everything agreed shows "Agreed by all" and nothing is open.

## 6. History view
Layout: two columns (log left 360 px, detail right).
- **Log**: reverse chronological list. Each item: short id, message, author role and name, time, counts ("9 medicines, 6 decisions"). Chain status line at the top: "Chain verified" with a check, or "Chain broken at commit 2" in conflict colours (only appears if state was edited in storage or an import was tampered with).
- **Detail** (selected commit), three tabs:
  - **Changes**: added (green plus), removed (red minus), changed (from to, with an arrow icon). Empty states say "No changes from the previous list".
  - **List**: the commit's entries.
  - **Decisions**: resolutions with reason, note, role, time. Manual entries are labelled.
- **Last changed** (a toggle on the List tab): each line shows blamed commit short id, "Last decided in {id}: {reason}" or "Agreed by all sources".
- All ids are monospace and copyable.

## 7. Import and export
- Export menu: "Case file (.json)", "FHIR bundle (.json)". Filenames: `medgit-case-{scenarioId}-{shortId|draft}.json`, `medgit-fhir-{shortId}.json`. FHIR export is disabled until there is a commit.
- Import (Start view): file picker. Errors show in a dismissible alert with the code mapped to copy (section 8).

## 8. Copy deck (use these strings; do not invent new ones)

Voice: plain, active, sentence case, no jokes, no apologies, no clinical advice.

| Key | String |
|---|---|
| app.title | MedGit |
| app.tagline | Reconcile medicine lists the way git merges branches. |
| notice.synthetic | Synthetic data. Not for clinical use. |
| start.title | Reconcile medicine lists |
| start.sub | Compare lists from every source, decide each difference, and sign off with a record. |
| start.import | Import a case file |
| summary.toDecide | {n} to decide |
| summary.escalated | {n} escalated |
| summary.agreed | {n} agreed |
| row.agreed | Agreed by all |
| row.notListed | Not listed |
| row.left | Left off the list |
| kind.OMISSION | Not on every list |
| kind.DOSE | Dose |
| kind.FREQUENCY | Frequency |
| kind.STATUS | Status |
| state.open | To decide |
| state.escalated | With pharmacist |
| state.resolved | Decided |
| strip.decision | Decision |
| strip.reason | Reason |
| strip.note | Note (optional) |
| strip.apply | Apply decision |
| strip.escalate | Escalate to pharmacist |
| strip.waiting | Waiting for a pharmacist. |
| strip.custom | Enter a different value |
| strip.undo | Undo last decision |
| reason.VERIFIED_WITH_PRESCRIBER | Verified with prescriber |
| reason.CONFIRMED_WITH_PATIENT | Confirmed with patient |
| reason.PER_DISPENSING_RECORD | Per dispensing record |
| reason.PER_DISCHARGE_SUMMARY | Per discharge summary |
| reason.CLINICAL_JUDGEMENT | Clinical judgement |
| reason.NEEDS_PHARMACIST_REVIEW | Needs pharmacist review |
| merged.title | Reconciled list |
| merged.provenance.agreed | Agreed by all |
| merged.provenance.decided | Decided: {reason} |
| merged.provenance.manual | Entered by hand |
| commit.disabled | Resolve {n} more differences to sign off. |
| commit.cta | Sign off |
| commit.message | Message |
| commit.done | Signed off by {role} at {time} |
| history.chainOk | Chain verified |
| history.chainBroken | Chain broken at commit {n} |
| history.noChanges | No changes from the previous list |
| err.NOT_A_CLAIMANT | That source does not hold a value for this medicine. |
| err.REASON_REQUIRED | Choose a reason. |
| err.NOT_AUTHORISED | Only a pharmacist can decide an escalated difference. |
| err.INVALID_DECISION | Enter a valid value. |
| err.UNRESOLVED_CONFLICTS | Decide every difference before signing off. |
| err.MESSAGE_REQUIRED | Write a short message. |
| err.CHAIN_BROKEN | The history does not verify. Do not rely on this record. |
| err.CASEFILE_INVALID | This file is not a valid MedGit case file. |
| err.FHIR_INVALID | This file is not a valid medication bundle. |
| err.generic | Something went wrong. Reload the page and try again. |
| err.TOO_FEW_SOURCES | Add at least two source lists to compare. |
| err.DUPLICATE_SOURCE_ID | Two source lists have the same name. Rename one and import again. |
| err.INVALID_SOURCE | {source} lists the same medicine twice. Fix that list and import again. |
| cell.unreadable | Unreadable |
| problems.title | Problems found |
| problems.link | See problems |
| role.tooltip | Switches who is deciding. Escalated items need a pharmacist. |
| export.fhirDisabled | Sign off a list first to export a FHIR bundle. |
| history.empty | Nothing signed off yet. |
| history.empty.link | Go to reconcile |
| empty.noConflicts | All sources agree. Nothing to decide. |
| empty.noIssues | No problems found in the source lists. |

Normaliser issues text (messy scenario): "Could not recognise '{name}'. It is kept as written and compared by name." / "Could not read the strength '{text}'." / "Could not read the frequency '{text}'." / "Could not read the status '{text}'."

## 9. Accessibility
- Keyboard: every action reachable. Tab order: header, summary, chart, strip, merged list, commit. In the chart, a single tab stop with arrow-key row navigation (roving tabindex). Escape closes drawers and sheets.
- Names: each chart row has an accessible name: "{medicine}. {kind or Agreed}. {state}." For example "Metformin. Frequency conflict. To decide."
- Live region (polite): decision applied, counter changes, commit success. Errors use an assertive alert.
- Contrast: tokens verified for AA. Focus ring 2 px `--focus` with 2 px offset, visible in both themes.
- Colour is never the only signal: every state has a pill with icon and text.
- Targets at least 40 x 40 px on touch.
- Motion: the seam close animation only; respects `prefers-reduced-motion`. No auto-playing or looping animation.
- Forms: labels always visible; errors tied with `aria-describedby`; required fields marked in text.
- Language: `lang="en"`. Drug names are never abbreviated except as the formulary does.

## 10. States to design and test
Empty (no case loaded), loading (instant; no spinners needed), clean case (zero conflicts), messy case (issues list visible above the chart in a collapsible "Problems found" section), many conflicts, long drug names, escalated waiting, commit success, import error, chain broken (only via a crafted import), narrow viewport, dark theme, reduced motion.

## 11. Definition of done for any screen
1. Matches this spec and the design system.
2. Keyboard-only run-through done.
3. Playwright screenshots at 1440x900, 1024x768, 390x844, light and dark, reviewed by the `ui-critic` agent and by the human.
4. axe check passes with no serious or critical issues.
5. No new hard-coded colour.
6. Copy comes from the copy deck.
