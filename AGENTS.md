# Lift Tracker Instructions

This is a mobile-first workout tracking web app used mainly on iPhone/Home Screen PWA.

## Priorities

- Preserve existing user data.
- Do not use backend/developer terms in user-facing copy.
- Keep UI simple for iPhone.
- Make changes incrementally.
- After making code or repo changes, commit and push them once checks pass unless the user explicitly says not to.
- Avoid breaking History, Progress, Plan Builder, and workout logging.

## Main Files

- `index.html`
- `style.css`
- `app.js`
- `workouts.js`
- `firebase.js`

## Current Focus

1. Verify the new Plans > Plan > Day > Exercises workflow on iPhone, including inline exercise-name editing, drafts, file actions, and save dock. See `PLAN-BUILDER-REDESIGN.md`. Physical Safari/Home Screen keyboard and safe-area checks remain pending.
2. Verify gym/history selection, draft resume, and timers with actual saved workouts.
3. Verify the new install/update behavior after deployment.
4. Deliberate old-data migration path if pre-Google data is missing.

Session plan and verified local backup details: `UX-OVERHAUL-PLAN.md`. Browser audit findings, fixes, and limitations: `UX-AUDIT.md`.

## Todo Later

- UX overhaul and PWA hardening are implemented; use actual iPhone feedback for follow-up refinements rather than repeating the overhaul.
- Keep desktop as a centered mobile preview and retain compact notes/session-only swaps.
- Bump the service-worker shell cache version whenever bundled HTML/CSS/JS changes (current version: v19).
- Browser validation previously covered 440x956, 375x812, and 1280x900 layouts with isolated synthetic data. Browser access was unavailable for the plan-builder redesign, gesture polish, and History density follow-up; verify these screens on iPhone. Physical iPhone, real auth/update flow, and download verification remain pending. 166 automated tests pass, including the isolated game preview checks.
- Plans supports guarded swipe-right back navigation through picker/day/plan/library and swipe-left forward after going back; draft edits and picker selections are preserved. Plan and History rows reveal confirmed Delete on a left swipe and close on a right swipe or tap. Row gestures must not also navigate pages. Existing back/menu/delete controls remain available without gestures.
- Plan actions include confirmed Delete Plan. Active deletion names an available replacement in the prompt, or warns that no plan will remain active. Zero plans are supported and are not reseeded on reload. Plan deletion never deletes completed workout history. A persistent deletion marker prevents delayed imports/writes from resurrecting deleted plans.
- Import saves stage a recoverable draft first, keep Close available, and stop waiting after 15 seconds without claiming that a pending write was cancelled. Retries use the same plan ID. Late acknowledgements must not clear newer edits or close another preview.
- Plans supports manual creation, day duplication, searchable multi-exercise selection, inline name/prescription edits, named supersets, per-account device drafts, and one Save Changes action. Rename preserves history identity; Replace Exercise changes it. Social/game functionality is not part of this redesign.
- Plans exports saved regimens through each plan's actions menu, downloads a standalone template, previews imports, and stores each import as a new plan. Make Active switches plans without overwriting old plans or completed history. Saving an inactive plan never activates it. See `PLAN-FORMAT.md`.
- The close button beside Workout gym controls confirms before discarding only the current unfinished draft and stopping its timers.
- Account and History exports include all saved workouts, without a count or date cutoff. Synthetic 1000-workout coverage verifies retained exercise/set data.
- Weight-row down arrows copy a deliberately entered weight to untouched unfinished sets below. Preserve historical Last/placeholder values and manually edited weights; copied weights are session edits saved in drafts.
- Investigate the reported phone startup hang on "Checking your workouts" if still occurring; investigation was interrupted to address the keyboard/save-dock jump.
- Per-machine identities were discussed and deferred as excessive; do not add a station selector without a new explicit request.
- Decide whether unchecked prefilled sets should count in a saved workout. Existing save/volume semantics were preserved during the UI audit.
- Data/account follow-up:
  - Keep Google UID as the primary user path going forward.
  - If old pre-Google data is missing, add a deliberate one-time migration path rather than weakening Firestore rules.
- Exercise notes during workout should stay compact because this is a niche feature.
- Exercise swaps during workout are for the current session only and should not permanently change the workout plan.
- Injury/reset-aware progression is on the back burner.
- Future social/game idea: workout-powered friend raids, conquest, fictional loot, and strength-normalized competition. Summary and open questions are saved in `SOCIAL-RAIDS-CONCEPT.md`; revisit only when requested.
- Game now has an isolated practice preview: trailing Game nav button, plus `game-test.html` with built-in Alex/Mike demo players. Sample workout saves award drop toasts; production, lawyers, raids, and practice time controls use only `lift-tracker:game-practice:v1`. Real workout rewards, live friend accounts, and shared multiplayer are not connected. See `GAME-TESTING.md` and `GAME-PHASE-1.md`. Never connect demo balances to real accounts or weaken existing account rules.

## UX Rules

- "Firebase", "JSON", "schema", and "localStorage" should not appear in normal user-facing UI.
- Plan Builder should say "Save Changes".
- Workout tab should open the current workout, or the suggested next workout if none is selected.
- Saved workout should route back to Home.
