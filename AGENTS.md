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

1. Verify physical iPhone Safari/Home Screen keyboard and safe-area behavior; save docks now hide during keyboard editing instead of being lifted above it. Desktop browser mobile-width audit is complete (see `UX-AUDIT.md`).
2. Verify gym/history selection, draft resume, and timers with actual saved workouts.
3. Verify the new install/update behavior after deployment.
4. Deliberate old-data migration path if pre-Google data is missing.

Session plan and verified local backup details: `UX-OVERHAUL-PLAN.md`. Browser audit findings, fixes, and limitations: `UX-AUDIT.md`.

## Todo Later

- UX overhaul and PWA hardening are implemented; use actual iPhone feedback for follow-up refinements rather than repeating the overhaul.
- Keep desktop as a centered mobile preview and retain compact notes/session-only swaps.
- Bump the service-worker shell cache version whenever bundled HTML/CSS/JS changes (current version: v9).
- Browser validation now covers 440x956, 375x812, and 1280x900 layouts with isolated synthetic data. Physical iPhone, real auth/update flow, and download verification remain pending. 59 automated tests pass.
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

## UX Rules

- "Firebase", "JSON", "schema", and "localStorage" should not appear in normal user-facing UI.
- Plan Builder should say "Save Changes".
- Workout tab should open the current workout, or the suggested next workout if none is selected.
- Saved workout should route back to Home.
