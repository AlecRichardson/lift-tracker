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

1. Add Plan Builder edit auto-scroll.
2. Add a compact Home Screen install prompt.
3. Add compact exercise notes during workouts.
4. Add session-only exercise swaps.

## Todo Later

- Prompt users to save the app to their Home Screen if they are not already running it as an installed app.
  - On iOS, detect the current launch mode with `window.navigator.standalone === true`.
  - In supporting browsers, also check `window.matchMedia("(display-mode: standalone)").matches`.
  - If neither signal is true, show a simple iPhone-friendly Home Screen install hint.
- Exercise notes during workout should stay compact because this is a niche feature.
- Exercise swaps during workout are for the current session only and should not permanently change the workout plan.
- Injury/reset-aware progression is on the back burner.

## UX Rules

- "Firebase", "JSON", "schema", and "localStorage" should not appear in normal user-facing UI.
- Plan Builder should say "Save Changes".
- Workout tab should open the current workout, or the suggested next workout if none is selected.
- Saved workout should route back to Home.
