# Requirements: review-ui

## Introduction
The interface: Start, Reconcile and History views, built on the core library. It renders state and dispatches actions; it decides nothing. The look is defined in `docs/DESIGN_SYSTEM.md`, the behaviour and copy in `docs/UX_SPEC.md`. When those documents are more specific than a criterion here, follow them.

Read first: `.kiro/steering/ui-ux.md`, `docs/UX_SPEC.md`, `docs/DESIGN_SYSTEM.md`, `docs/ARCHITECTURE.md` (sections 5 and 6).

Priority: criteria for requirements 1 to 9, 13 and 14 are **ship**. Requirement 10 (marker view) and the dark theme polish in 15 are **should**. Everything else here is ship unless marked.

## Requirements

### Requirement 1: Start view
**User Story:** As a user, I want to open a scenario or a saved case in one click, and see that the data is synthetic.

#### Acceptance Criteria
1. WHEN the application loads with no case open, THE application SHALL show the Start view with the title, subtitle and notice from the copy deck.
2. THE Start view SHALL list the scenarios Hero, Clean and Messy, in that order, each with its title, blurb, number of sources and number of medicines in the longest source.
3. WHEN the user activates a scenario's "Open" button, THE application SHALL load it (normalising its sources and replaying its prior commits) and show the Reconcile view.
4. THE Start view SHALL show the scenario's synthetic notice text.
5. WHEN the page loads, THE focus SHALL be on the Hero scenario's "Open" button.

### Requirement 2: Application state
**User Story:** As a developer, I want predictable state, so that the interface is easy to test and cannot disagree with the core.

#### Acceptance Criteria
1. THE application SHALL keep state in one reducer whose actions are listed in `docs/ARCHITECTURE.md` section 5, and the reducer SHALL be pure: no clock, no random numbers, no storage, no network.
2. THE application SHALL derive the merge result and the draft from the state with the core functions, and SHALL NOT store them.
3. WHEN a `RESOLVE` action fails core validation, THE reducer SHALL leave the resolutions unchanged and record the error code for the interface to show.
4. WHEN a `COMMIT` action is dispatched while `canCommit` is false or the message is invalid, THE reducer SHALL leave the history unchanged and record the error code.
5. WHEN a `COMMIT` succeeds, THE reducer SHALL append the commit to the history, clear the working resolutions and clear the commit message.
6. THE application SHALL mirror the current view in the URL hash (`#/start`, `#/reconcile`, `#/history`) and SHALL show the Start view if the hash names a view that needs a case when none is open.
7. IF merging fails (for example a source lists the same medicine twice), THEN THE Reconcile view SHALL show the error text for that code from the copy deck instead of the chart.

### Requirement 3: Summary bar
**User Story:** As a pharmacist, I want to see at a glance how much is left to decide.

#### Acceptance Criteria
1. THE Reconcile view SHALL show three counters: conflicts to decide, conflicts escalated, and medicines agreed, each with an icon, a number and text.
2. THE counter "to decide" SHALL equal the number of conflicts in state `open`, "escalated" those in state `escalated`, and "agreed" the number of clean entries.
3. WHEN a counter changes because of a decision, THE application SHALL announce the new "to decide" count in the polite live region.
4. THE view SHALL provide a filter with the options All, Open, Escalated and Resolved that changes which rows the chart shows and never changes the counters.
5. THE view SHALL provide a toggle between Chart and Markers, and SHALL keep the choice while the case is open.

### Requirement 4: Medication chart
**User Story:** As a pharmacist, I want one row per medicine and one column per source, so that I can see every disagreement side by side.

#### Acceptance Criteria
1. THE chart SHALL show one row per medicine (clean entries and every drugKey with conflicts), ordered by display name, and one column per source in id order, each column headed with the source's thread chip, label and as-of date.
2. EACH source cell SHALL show the strength and frequency that source holds, "Not listed" when the source omits the medicine, and the status when it is not active.
3. FOR a conflict row, THE value text in conflict in each claimant's cell (the strength for Dose, the frequency for Frequency, the status for Status, and the "Not listed" text for Not on every list) SHALL be underlined with that source's thread colour, and the row SHALL show a pill for each conflict (Dose, Frequency, Status, Not on every list).
4. FOR a clean row, THE row SHALL show "Agreed by all" with an icon.
5. THE row state SHALL be shown as a pill with an icon and text: To decide, With pharmacist, Decided, or Left off the list for a superseded or excluded medicine.
6. WHEN the user selects a row by click, or by Enter or Space on a focused row, THE application SHALL select that medicine's first open conflict (or its first conflict if none is open) and SHALL show it in the decision strip.
7. THE chart SHALL be one tab stop, with Up, Down, Home and End moving between rows (roving tabindex).
8. EACH row SHALL have an accessible name of the form "<medicine>. <kind or Agreed>. <state>.", with several kinds joined by "and".
9. THE chart SHALL never truncate a medicine name; long names SHALL wrap.
10. WHEN a source cell value is null because the normaliser could not read it, THE cell SHALL show "Unreadable" and a link to the Problems panel.

### Requirement 5: The seam
**User Story:** As a user, I want a clear, memorable signal that a difference is open or closed.

#### Acceptance Criteria
1. THE chart SHALL draw a dashed seam under every conflict row in the open colour, an amber dashed seam under escalated rows, and a solid green seam under resolved rows, using only the seam tokens.
2. WHEN a conflict becomes resolved, THE seam SHALL change from dashed to solid and from the open colour to the resolved colour over the duration `--seam-close-ms`, once.
3. WHERE the user's system requests reduced motion, THE seam SHALL change state immediately.
4. THE seam SHALL be hidden from assistive technology, and the same state SHALL always be available as text in the row pill and the accessible name.
5. THE seam SHALL appear only under conflict rows, on the top edge of the commit panel, and in the product mark.
6. WHEN the application is idle, NO element SHALL animate.

### Requirement 6: Decision strip
**User Story:** As a pharmacist, I want to see every source's claim for the selected conflict and decide it with a reason.

#### Acceptance Criteria
1. THE strip SHALL show the medicine's display name, a pill for the conflict kind, and, for each claimant, the source thread chip, label, value and as-of date; for an OMISSION it SHALL also show "Not listed" for each source that omits the medicine.
2. FOR a field conflict, THE strip SHALL offer one radio option per claimant ("Use <source> value: <value>") and a radio option "Enter a different value"; FOR an OMISSION, it SHALL offer "Include on reconciled list" and "Leave off the list".
3. WHEN the user chooses "Enter a different value", THE strip SHALL show an input suitable for the field and SHALL show an inline error and disable Apply until the value is valid.
4. THE strip SHALL require a reason from the list in the copy deck, and SHALL offer an optional note with a character counter limited to 280.
5. WHEN the user activates Apply with a valid decision, THE application SHALL dispatch `RESOLVE` with the current role and the current time, and, if the core accepts it, announce the result, close the seam on that row and move focus to the next open conflict row, or to the commit message field if none remain and the list can be signed off.
6. WHEN the user activates "Escalate to pharmacist", THE application SHALL dispatch `RESOLVE` with the `escalate` decision and reason "Needs pharmacist review", with no other input required.
7. WHILE the selected conflict is escalated and the role is Clinician, THE strip SHALL disable the options and Apply and show "Waiting for a pharmacist."
8. WHILE the selected conflict is escalated and the role is Pharmacist, THE strip SHALL enable them.
9. IF the core rejects a decision, THEN THE strip SHALL show the message for the error code from the copy deck next to the control concerned.
10. WHERE the selected conflict has more than one earlier decision event, THE strip SHALL offer "Undo last decision", which SHALL re-record the previous decision as a new event.
11. WHERE a medicine has several conflicts, THE strip SHALL show one tab per conflict.

### Requirement 7: Reconciled list
**User Story:** As a user, I want to see exactly what will be signed off, and what is still missing.

#### Acceptance Criteria
1. THE view SHALL show one line per draft entry with name, strength, frequency, status and a provenance chip: "Agreed by all", "Decided: <reason>" or "Entered by hand".
2. FOR each pending medicine, THE view SHALL show a ghost line "Waiting: <name>" in the seam colour and SHALL NOT show any provisional value for it.
3. THE view SHALL show a count of medicines decided and of medicines waiting, and a footnote counting medicines left off by decision.
4. THE list SHALL equal the draft's entries, in drugKey order, and SHALL never contain a value the core did not put in the draft.

### Requirement 8: Commit panel
**User Story:** As a pharmacist, I want to sign off only when everything is decided, with a message.

#### Acceptance Criteria
1. WHILE `canCommit` is false, THE panel SHALL disable Sign off and state "Resolve <n> more differences to sign off.", with the correct singular or plural.
2. WHEN `canCommit` is true, THE panel SHALL enable the message field and Sign off, and the top-edge seam SHALL be solid green.
3. THE message field SHALL show a counter limited to 200 characters and an error when empty on submit.
4. WHEN the user activates Sign off, THE application SHALL dispatch `COMMIT` with the current role and time and, on success, show the short commit id with a copy button, "Signed off by <role> at <time>" and a link to the History view, and move focus to that link.
5. AFTER a successful commit, THE Reconcile view SHALL re-merge against the new head, show every medicine as agreed, and show zero to decide.

### Requirement 9: History view
**User Story:** As a reviewer, I want the log, the changes and who decided what.

#### Acceptance Criteria
1. THE view SHALL show a log, newest first, with short id, message, author role and name, time, and counts of medicines and decisions.
2. THE view SHALL show "Chain verified" with an icon when `verifyChain` succeeds and "Chain broken at commit <n>" in the conflict colours when it fails.
3. WHEN the user selects a commit, THE view SHALL show three tabs: Changes (added, removed, changed lines, or "No changes from the previous list"), List (the commit's entries) and Decisions (each effective resolution with reason, note, role, time and a label "Entered by hand" for custom).
4. THE List tab SHALL offer a "Last changed" toggle that adds to each line the blamed commit's short id and either "Decided in <short id>: <reason>" or "Agreed by all sources".
5. EVERY commit id SHALL be shown in the monospace font and be copyable.
6. WHEN the history has no commits, THE view SHALL show a plain empty message and a link to the Reconcile view.

### Requirement 10: Marker view (should)
**User Story:** As a user, I want to see the disagreements as text markers, the way git shows them.

#### Acceptance Criteria
1. WHEN the toggle is set to Markers, THE view SHALL show the text produced by `renderMarkers` in the monospace font, one block per conflict grouped by medicine.
2. WHEN the user selects a block, THE application SHALL select the same conflict in the decision strip.
3. EACH block SHALL also show the conflict's state pill.

### Requirement 11: Import and export
**User Story:** As a user, I want to save my work and export the signed-off list.

#### Acceptance Criteria
1. THE header export menu SHALL offer "Case file (.json)" at any time and "FHIR bundle (.json)" only once the history has at least one commit made in this session or loaded from a case file; otherwise that item SHALL be disabled with an explanation.
2. WHEN the user chooses an export, THE application SHALL generate the text with the core function using the current time, and download it with the filename pattern in `docs/UX_SPEC.md` section 7.
3. WHEN the user chooses "Import a case file" and selects a file, THE application SHALL read it as text and pass it to `importCaseFile`; on success it SHALL load the state and show the Reconcile view; on failure it SHALL show the copy-deck message for the error code with the specific message in a details expander.
4. THE application SHALL refuse files larger than 2 MB before reading them and show the same error.

### Requirement 12: Problems panel
**User Story:** As a user, I want to see what the normaliser could not read.

#### Acceptance Criteria
1. WHEN any source list has normaliser issues, THE Reconcile view SHALL show a collapsible "Problems found" section listing, per source, each issue with the raw text and the copy-deck sentence for its code.
2. WHEN there are none, THE section SHALL be absent.
3. THE section SHALL never offer a way to dismiss or fix an issue (fixing is out of scope); it SHALL stay visible.

### Requirement 13: Responsive layout
**User Story:** As a user on any device, I want the product to remain usable.

#### Acceptance Criteria
1. AT widths of 1280 CSS pixels or more, THE decision strip SHALL sit beside the chart.
2. AT widths from 768 to 1279, THE strip SHALL open as a right-hand drawer when a row is selected, with focus moved into it and returned to the row on close, and Escape SHALL close it.
3. AT widths below 768, THE chart SHALL render each medicine as a card with the source values stacked, the strip SHALL open as a bottom sheet, and the commit panel SHALL be a sticky bar.
4. AT every width from 360 to 1920, THE page SHALL have no horizontal scrolling and no overlapping or clipped text.

### Requirement 14: Accessibility
**User Story:** As a user with assistive technology or only a keyboard, I want to do everything the same.

#### Acceptance Criteria
1. EVERY interactive element SHALL be reachable and operable by keyboard, and SHALL show a visible focus ring of at least 2 pixels with at least 3 to 1 contrast.
2. THE text and interface contrast SHALL meet WCAG 2.2 AA in both themes, using the tokens.
3. EVERY state SHALL be conveyed by text and icon as well as colour.
4. EVERY form control SHALL have a visible label, and errors SHALL be tied to their control with `aria-describedby`.
5. THE application SHALL announce decision results, counter changes and commit success through the polite live region, and errors through an assertive alert.
6. TOUCH targets SHALL be at least 40 by 40 CSS pixels.
7. WHEN an automated axe scan runs on the Start, Reconcile (with the Hero scenario open) and History views in both themes, THE scan SHALL report no violations of serious or critical impact.
8. THE `<html>` element SHALL have `lang="en"`, and each view SHALL have one `h1`.

### Requirement 15: Role and theme controls
**User Story:** As a demo user, I want to switch role and theme quickly.

#### Acceptance Criteria
1. THE header SHALL provide a Role control (Clinician, Pharmacist) and a Theme control (System, Light, Dark), both labelled and operable by keyboard.
2. THE Role control SHALL have a tooltip "Switches who is deciding. Escalated items need a pharmacist." and SHALL NOT be described as sign-in.
3. WHEN the role changes, THE application SHALL announce it and update the decision strip's enabled state.
4. THE Dark theme SHALL meet requirement 14 and use the same layout and seam behaviour.

### Requirement 16: Errors and robustness
**User Story:** As a user, I want clear messages if something goes wrong.

#### Acceptance Criteria
1. THE application SHALL wrap the view area in an error boundary that shows the copy-deck generic message and a reload button.
2. THE application SHALL take every user-facing string from the copy deck in `docs/UX_SPEC.md`, held in one module `src/ui/copy.ts`.
3. THE application SHALL not request any remote resource at runtime.

### Requirement 17: Hero flow end to end
**User Story:** As the builder, I want the demo flow proved by an automated test, so that the recording cannot surprise me.

#### Acceptance Criteria
1. WHEN an end-to-end test opens the Hero scenario and performs each step of `demoScript` through the interface (selecting the row, choosing the option, choosing the reason, applying, switching role where the step's role changes), THE application SHALL reach zero to decide.
2. WHEN the test then signs off with `demoCommit.message`, THE History view SHALL show three commits, the Changes tab of the newest SHALL show three added medicines and one changed line (aspirin status), and the List tab with "Last changed" SHALL match `expectedAfterDemoScript.blame` by medicine.
3. THE test SHALL save screenshots of the Start, Reconcile (before, midway and after) and History views at 1440 by 900 in the light theme, and of the Reconcile view at 1024 by 768 and 390 by 844 in both themes.
