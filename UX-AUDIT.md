# Mobile UI/UX Audit

Date: 2026-11-13

## Scope and Approach

Browser-driven review of the real application screens and interaction handlers at 440x956 (large-iPhone target), 375x812 (smaller iPhone), and 1280x900 (centered desktop preview). These are viewport checks, not physical iPhone or Safari emulation.

The local audit server substitutes an isolated synthetic account, plan, workout history, and writes. Production credentials, rules, and saved workouts were not changed. The production service worker is deliberately not used in the audit harness, so local edits remain visible without stale caches.

Run `node scripts/ux-audit-server.mjs`, then open `http://127.0.0.1:8001/`. Data is synthetic and scoped to the browser tab; this is not the live app. Stop and restart the server after editing the server itself.

## Design Assessment

The restrained graphite theme and centered mobile shell suit repeated gym use. The main set grid is the right visual priority; decorative cards, larger headings, and animation would add little. Keep the bottom navigation, collapsed utilities, 16px input text, 44px control targets, and plain cable-setup row.

The weakest areas were small secondary text, unclear utility-button affordances, redundant history metadata, an overloaded Plan Builder, and inconsistent handling of unfinished work. These were addressed incrementally without another visual rewrite.

## Findings and Fixes

| Priority | Finding | Resolution |
| --- | --- | --- |
| High | Switching Plan Builder days discarded the exercise form without warning. | Valid pending edits stay in the unsaved plan before switching days, reordering, or editing another item. Invalid edits block the action and focus the relevant field. |
| High | Save Changes was disabled for exercise-form edits and could omit them. | The dock enables immediately, includes the pending exercise in the save, and announces unsaved/saved state. A failed save keeps the editor attached to the same exercise rather than creating duplicates on retry. |
| High | Replacing an exercise retained its completed checkmarks and rest timer. | Actual identity changes ask before resetting completed sets and stop the old timer. Cancelling preserves the original exercise. Re-selecting the same exercise preserves deliberate entries. |
| Medium | Gym label broke into `Gy` / `m` because the select consumed the flex row. | Fixed label sizing and flexible select width. No extra machine/station selector added. |
| Medium | Header email was tiny and could wrap its final suffix onto a third line. | Increased to 12px, added a preferred break at `@`, and restored a subtle visible account-button boundary. Full email remains available. |
| Medium | Note, Swap, and Tip looked like faint labels rather than actions. | Improved text size, contrast, spacing, and restrained boundaries while retaining 44px targets and compact placement. |
| Medium | Last sets repeated long source metadata, competing with the values. | Kept Last values on one plain, horizontally scrollable line. Source labels are separate; both sources remain visible when global Last and context-selected starting sets differ. History-selection logic itself is unchanged. |
| Medium | Home offered both Start and Resume for the same unfinished day. | Today's action becomes Resume when that day has an unfinished session. A separate resume section appears only for a different unfinished day. |
| Medium | Plan rename/delete controls consumed the main flow and made deletion overly prominent. | Moved them into collapsed Day settings. The exercise list is closer to the day selection. |
| Low | Progress had no selected bottom-nav destination. | Home stays highlighted as its parent destination. |
| Low | History used incorrect singular copy and tiny set/source text. | Corrected singular/plural wording and slightly increased secondary text without expanding list spacing. |

Added an unsaved-plan browser-exit warning, plain-language plan-save failure copy, and correct performed-exercise accessibility labels after swaps. Updated the shell cache from v6 to v7 for deployment.

## Browser Verification

- Visually inspected Home, Workout, History, Progress, Plan Builder, account dialog, and the swap menu at mobile widths.
- Confirmed header, shell, and navigation share the same 460px centered bounds on desktop.
- Confirmed no document-level horizontal overflow at the tested widths. Long Last values scroll within their own line.
- Confirmed save dock and navigation align without overlapping one another (94px and 68px respectively at the large viewport).
- Edited a workout weight, completed a set, switched gym, and confirmed manual values/completion were preserved.
- Saved a synthetic workout, returned Home, inspected it in History, and reopened it: weight restored and completion started unchecked.
- Opened notes and selected a previous swap from the custom dropdown; the planned identity remained visible and the performed history loaded.
- Reproduced completed-swap carryover before the fix; confirmed replacement now clears completion. Cancel and same-selection behavior are additionally covered by automated tests.
- Edited a plan exercise, switched away and back, and confirmed the edit survived. Saved directly from the exercise form and confirmed the plan after refresh.
- Confirmed editor auto-scroll still operates, day settings start collapsed, chart renders, gym filtering works, and account dialog fits.
- No warning/error console entries were recorded in the final walkthrough.

## Automated Checks

`node --test`: 51 passing tests. Nine new regressions cover pending plan edits, retry identity, validation, save-button state, and swap resets; three additional tests protect distinct global/context source labels. Existing history, progression, draft/gym, and service-worker tests remain intact.

Syntax checks: `app.js`, `firebase.js`, `service-worker.js`, and the audit server. `git diff --check`.

## Limits and Follow-Up

- Physical iPhone Safari and Home Screen keyboard, safe areas, browser chrome, and touch-edge gestures still need hardware validation. Viewport resizing cannot prove those behaviors.
- Real Google sign-in, live account reads/writes, deployed offline/update behavior, and install prompts were not exercised against the real account in this audit.
- Export download was blocked by the browser's download permission. No alternate download mechanism was attempted. History action controls were inspected, but live deletion was not performed.
- Product decision remains: currently all valid entered/prefilled sets can be saved and counted even when unchecked. Saving a synthetic one-checked-set workout retained the other entered rows as the existing app does. Changing whether unchecked sets count would affect historical totals and progression; that policy was not silently changed during a UI pass.

## Screenshot Artifacts

Saved locally under `C:/Users/16362/.codex/visualizations/2026/05/14/019e27b3-e830-7ad2-b8f2-1f6ff8b6b5db/ux-audit/`:

- `workout-mobile.jpg`
- `history-mobile.jpg`
- `progress-small.jpg`
- `plan-mobile.jpg`
- `home-desktop.jpg`

Screenshots contain synthetic data, not the live account.

## Gesture and Density Follow-Up

- Plan details now align the plan-name input and Make Active action in one row. Active plans show their status in that same position.
- Note, Swap, and Tip use quieter text actions without box borders; cable setup uses an underline for the selected mode. All retain at least 44px touch targets.
- History uses flat, separated rows aligned with Plans, retaining expandable sets, copy, filters, and the existing Delete action.
- Plan and History row swipes reveal Delete but never execute deletion directly. Confirmation, plan/history separation, and existing menu alternatives remain intact. Only one row stays revealed; right swipe or tapping the front closes it.
- Plan back/forward swipes preserve drafts and picker selections. Screen edges, vertical movement, controls, active editing, dialogs, and row-delete gestures are guarded. A focused idle navigation button no longer blocks later page swipes.
- Shell cache v15 includes the new row-gesture module. Automated checks: 140 passing tests, syntax checks, and clean whitespace checks. Browser access was unavailable for this follow-up; physical iPhone Safari/Home Screen gestures, visual alignment, and deployed update behavior remain pending. No new screenshots or live-account deletion tests were performed.
