# Plan Builder Redesign

## Implemented Flow

1. **Plans:** active and saved plans, local drafts, New Plan, Import Plan, and Download Plan Template.
2. **Plan details:** editable plan name, ordered days with exercise/set counts, Add Day, Make Active, and plan actions for duplicate/export/discard.
3. **Day:** compact exercise rows that expand in place. Exercise name is always the first editable field. Sets, reps, and rest are prominent; notes, equipment, type, and named superset partners are under More options.
4. **Add Exercises:** searchable catalog from saved plans, starter exercises, and actual performed history (including swaps). Multi-selection adds several exercises at once. Custom exercises remain available.
5. **Save Changes:** one plan-level save, not a separate exercise save. Activation stays explicit.

Home's Edit Plan action opens the active plan directly; the bottom Plans tab preserves the builder's current view while refreshing available plans/history.

## Data and State Rules

- Controller/UI: `plan-builder.mjs`; pure state operations: `plan-builder-state.mjs`; styles: `plan-builder.css`.
- Existing plan file parsing, workout-history matching, progression advice, and workout logging remain separate.
- Per-account drafts are stored on this device by plan ID. Blank/incomplete edits survive navigation and refresh, but cannot be saved as complete plans until valid.
- Switching plans does not discard another plan's draft. New plans have independent generated IDs. Save retries reuse the same ID.
- Saving an inactive plan writes only that plan. Activation changes the active-plan pointer and checkpoints the prior workout session.
- Renaming exercises preserves IDs and aliases, adding the prior name once per edit field. Replace Exercise changes identity deliberately.
- Superset selection uses named partners, keeps members adjacent, and moves them as a group. Removing a partner cleans up orphan labels.
- Catalog history includes actual performed exercises, not original planned swap names. Different known equipment variants stay separate. Catalog refreshes preserve selected exercise identity.
- Actual weights, completion flags, and session notes are not copied into new exercise prescriptions.
- Saving active-plan changes is blocked while entered workout data is unfinished. The plan draft is retained; other plans can still be edited.
- No saved workout records are rewritten, deleted, or migrated by the builder.

## Verification

Automated tests cover state transformations, inline rename/prescription edits, plan creation and day duplication, multi-select/replace, malformed drafts, per-account recovery, failed saves, inactive-plan saving, activation, catalog refresh selection, legacy equipment conflicts, and superset reorder safety. Existing history, progression, export, PWA, and workout-state regressions remain in the full suite.

Browser access was unavailable in this chat. No new screenshot or real-iPhone verification is claimed.

## iPhone Check

- Create a new plan, add Push A, select several exercises, edit an exercise name, and duplicate the day as Push B.
- Change sets/reps/rest; link two exercises with Superset with; reorder the group.
- Leave incomplete fields, switch plans, refresh, and confirm the draft is still present. Fix the fields and Save Changes.
- Save an inactive plan and confirm Home still uses the original active plan. Then Make Active and confirm Home changes.
- Export the saved plan, import it as a separate plan, and switch back to the prior one.
- Confirm previous exercise history/preload still follows shared IDs and respects gym/setup compatibility.
- Check small and large iPhone widths, keyboard dismissal, inline editor positioning, and the save dock.
