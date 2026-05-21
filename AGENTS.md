# Lift Tracker Instructions

This is a mobile-first workout tracking web app used mainly on iPhone/Home Screen PWA.

## Priorities

- Preserve existing user data.
- Do not use backend/developer terms in user-facing copy.
- Keep UI simple for iPhone.
- Make changes incrementally.
- Avoid breaking History, Progress, Plan Builder, and workout logging.

## Main Files

- `index.html`
- `style.css`
- `app.js`
- `workouts.js`
- `firebase.js`

## Current Focus

1. Mobile PWA UI polish pass.
2. PWA hardening for install/update behavior.
3. Deliberate old-data migration path if pre-Google data is missing.

## Todo Later

- Mobile PWA UI polish pass:
  - Tighten Workout and Plan Builder spacing from mobile screenshots.
  - Tighten Workout History item spacing; saved workout cards currently have too much vertical space between list items.
  - Keep desktop preview internally mobile-sized.
  - Keep Save Workout dock near the bottom nav without hiding workout rows.
  - Preserve existing features; this is a layout-density pass, not a behavior change.
- PWA hardening:
  - Keep the Home Screen install prompt hidden in standalone mode and non-annoying in Safari.
  - Review service worker cache versioning so deployed updates are picked up predictably.
  - Keep the update prompt clear and usable.
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
