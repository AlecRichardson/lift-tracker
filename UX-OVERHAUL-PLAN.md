# Lift Tracker UX Overhaul

Session started: 2026-11-13.

## Backup

- Starting commit: `d48f3c460b0a4afce62339a56cd3fc33793ec990`.
- Starting working tree was clean.
- Local backup directory: `C:/Users/16362/.codex/visualizations/2026/05/14/019e27b3-e830-7ad2-b8f2-1f6ff8b6b5db/lift-tracker-backups/before-ux-overhaul-2026-11-13-125158/`.
- `source/` contains all 19 original source/configuration/image files, verified against the originals using SHA-256.
- `repository.bundle` contains the complete Git history and refs; `git bundle verify` passed.
- This backs up code, not live Firestore records or browser drafts. Never overwrite live workout history during this project.

## Goal

Improve the everyday iPhone workout experience, starting with trustworthy previous-performance data. Preserve workout logging, plans, history, progress, session swaps, compact notes, timers, and authentication. Stay with vanilla HTML/CSS/JS unless a specific requirement justifies a change.

## Status

- [x] Inspect current backlog and gym/history implementation.
- [x] Reproduce conflicting gym and pulley selections using sample logs.
- [x] Create and verify local code/history backup before edits.
- [x] Agree on and implement history selection and gym-switch behavior.
- [ ] Verify milestone 1 on the user's iPhone with saved workouts.
- [x] Establish Workout screen layout and shared design tokens.
- [x] Apply the design to Home, History, Progress, Plan Builder, and account controls.
- [x] Implement install/update hardening and cache regression tests.
- [ ] Verify real workout flows and deployed updates on iPhone.

## Findings From Current Code

1. Gym selection saves the preference but does not refresh workout inputs, previous-performance text, or tips.
2. Workout drafts contain plan/day/exercise information but no gym or account identity. Restoring an existing draft can mask newly selected history.
3. Context lookup prioritizes workout day and position before gym and pulley setup. Reproduction: selecting Gym B returns 120 lb from Pull A at Gym A even when a 70 lb Pull B entry exists at Gym B.
4. Same-day lookup can ignore a selected pulley setup. Reproduction: selecting single pulley returns a newer 120 lb double-pulley entry instead of a 70 lb single-pulley entry from the same day.
5. The visible Last summary uses global exercise history, while input preload and tips use context-selected history. The difference is not clearly explained next to the values.
6. Gym lists deduplicate names without case sensitivity, but history lookup compares gym names with case sensitivity.
7. Current tests cover context selection and equipment-name conflicts, but do not cover gym switching or same-day pulley conflicts.

These are code-level findings using sample logs, not an inspection of the user's cloud workout records.

## Milestone 1: Reliable History and Gym Switching

Confirmed choices: allow clearly labeled free-weight fallback across gyms; changing gyms corrects the location for the whole session and preserves entered/completed sets.

Implemented rules:

- Match the actual performed exercise, including swaps. Keep machine, cable, dumbbell, and barbell identities distinct.
- Apply known incompatible pulley/equipment exclusions before selecting workout context.
- Prefer the selected gym, then the workout day, then position where needed to distinguish repeated exercises. Use the newest qualifying entry.
- Keep global last performance available separately with its date, day, gym, and setup.
- For machines/cables, show other-gym history as a labeled reference rather than silently treating it as a working-weight recommendation. Treat older entries without a gym as unknown.
- Free-weight history can prefill across gyms with a reference label and cautious advice rather than an automatic increase recommendation. Matching still requires the same exercise identity; no load conversion is inferred.
- Explain prefill provenance near the exercise, for example: Previous: Pull A / Ultimate / Nov 10. Show reference details without making the card bulky.
- Changing gyms refreshes untouched suggested values and tips in place. Typed values, completed sets, notes, swaps, and active timers are preserved. The selected location applies to the whole session.
- Associate drafts with the signed-in account, plan, workout day, and session gym. Handle legacy drafts deliberately; do not silently attribute them to a new account or gym.
- Preserve saved history. No destructive migration or automatic rewriting of past workouts.

Draft implementation: account/plan/day-scoped V5 drafts record the gym and edited fields, including deliberate blanks and zeroes. Opening a day resumes its unfinished draft. V4 drafts remain untouched and have an explicit restore action that asks the user to assign the account/gym; there is no automatic attribution.

Setup controls now follow the actual swapped exercise. Selecting a dumbbell replacement for a cable exercise removes the cable restriction from its lookup, and restoring a cable exercise restores the setup controls.

Validation: 32 tests pass across history-context, recommendations, and workout-state. JavaScript syntax checks and `git diff --check` pass. Browser/device interaction testing remains pending; the environment rejected starting the local preview server. Commit/push was attempted but staging failed because `.git/index.lock` cannot be written in this session.

Focused acceptance scenarios:

- Gym B machine history wins over Gym A history even when the Gym A entry matches the workout day.
- A selected single-pulley setup never silently preloads double-pulley weights.
- Push A and Push B retain their useful fatigue/position context within compatible gym/setup history.
- Selecting a previously used swap finds that actual exercise's history across workout days.
- Switching gym before editing refreshes suggestions; switching after editing preserves manual work.
- Refresh/resume restores the intended session gym and unfinished sets.
- No matching history produces neutral inputs/advice rather than unrelated weights.
- Global references remain available and correctly labeled.

## Milestone 2: Workout Screen Design

Implemented: a consolidated neutral graphite stylesheet replaces the accumulated layout overrides. The shell is centered and capped at 460px, with responsive constraints for smaller iPhones. The header displays the full email and measures its height for scroll positioning. Exercise actions stay beside the title; previous-set values stay on one horizontally scrollable line. All text inputs use at least 16px; primary controls have 44px or larger targets. Notes, swaps, and tips start collapsed. The dock includes completed-set counts and responds to the visual keyboard viewport. Navigation back to an active workout preserves its DOM and timers; draft checkpoints now retain rest end timestamps.

- Design for one-handed use on iPhone 17 Pro Max, then check smaller iPhones and centered desktop preview.
- Use restrained graphite surfaces, readable contrast, clear selected/completed states, and consistent spacing.
- Establish a compact header and gym/session control, exercise title/actions, source-labeled previous performance, set grid, and Save Workout dock.
- Keep notes, swap search, and tip explanations collapsed until needed.
- Keep inputs legible at 16px or larger, touch controls practical, and row dimensions stable.
- Ensure the keyboard, safe areas, bottom navigation, and save dock do not hide active controls or final sets.
- Use the Workout screen to settle shared components before redesigning the remaining pages.

## Milestone 3: Remaining Screens

Implemented: Home includes a Resume entry for the latest unfinished workout; dashboard sections are unframed and denser. History has compact date groups and rows, unframed expanded details, gym labels, and accessible expansion state. Progress has exercise/gym/metric controls, a latest-value summary, and explicit no-data/chart-unavailable states. Its gym filter includes older entries without a recorded location. Plan Builder uses flatter ordered lists, arrow controls, and a fixed Save Changes dock; existing editor auto-scroll remains. The account dialog provides full identity, export, install guidance, and sign-out. Swap options now support keyboard selection as well as touch.

- Home: clear next workout and resume action, compact plan/history/progress entry points.
- History: inspect the existing density pass before further changes; readable date groups, gym labels, expanded sets, and existing actions.
- Progress: clear exercise/setup selection and mobile chart layout. Decide how gym-specific comparisons are presented.
- Plan Builder: clear day order, selected day, exercise editing, and Save Changes feedback; preserve auto-scroll to the edit form.
- Account: readable identity, existing export, sign-out, and settings access.

## Milestone 4: PWA and Verification

Implemented: install prompts are limited to relevant devices, respect dismissal, and hide in standalone mode. Supported browsers can use their installation prompt. Update prompts offer Later, checkpoint the workout before activation, and block updating while plan/exercise form changes are unsaved. Activating an update in another tab does not force this tab to reload. Versioned cache-first shell assets remain coherent until the next worker is activated; only the app's obsolete caches are deleted. Auth callbacks, unrelated navigation, external services, and failed responses are excluded from shell caching.

Original implementation checks: 39 automated tests passed while browser access was unavailable. Follow-up browser access is now working: see `UX-AUDIT.md` for the mobile/desktop walkthrough, findings, fixes, screenshots, and remaining physical-device limitations. No live workout records were modified.

Release rule: bump the service-worker shell version whenever bundled HTML/CSS/JS changes. Current version: v7. The PWA identity and icon assets were retained.

- Review install-prompt dismissal and standalone detection.
- Review service-worker update behavior; ensure updates do not discard an unfinished workout.
- Run focused automated checks for history selection and state changes. Keep visual verification proportionate and ask the user to verify real iPhone behavior when available.
- Test save/reopen, swaps, gym/setup switching, drafts, timers, history, progress, and plan editing.
- Commit and push completed increments when filesystem/network permissions allow; report failures accurately.

## Deferred

- Injury/reset-aware progression remains on the back burner.
- Legacy pre-Google data migration is conditional on missing data being reported.
- App Store packaging and subscriptions are a separate project.

## Next Session Input

The implementation pass is complete; verification on the user's iPhone remains. Check full-email header wrapping, keyboard/dock positioning, gym-switch preservation, resume/timers, history actions, progress gym filtering, Plan Builder save/reorder after refresh, and deployed update acceptance/defer. Cross-gym free-weight fallback and whole-session gym correction were confirmed on 2026-11-13.

Per-machine identities were discussed after implementation and deferred as excessive. Keep gym/pulley separation without adding another station selector unless explicitly requested.
