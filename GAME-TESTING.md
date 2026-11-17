# Phase 1 practice preview

## Open it

- In the signed-in app, **Game** is the last button in the bottom tray.
- Without signing in, open `game-test.html` beside `index.html`. On the current Pages site this is https://alecrichardson.github.io/lift-tracker/game-test.html after deployment.
- The app and standalone page share the same practice game on the same browser/origin. Alex and Mike are built-in demo profiles, not real Google accounts. Progress does not follow you to another device.

## Try the full loop

1. Start as **Alex · demo**, tap **Sample Workout**, and mark some sets complete. Use **Mark all complete** for a quick trial.
2. Tap **Save Sample Workout**. The page returns to the game overview and shows a drop toast. Only explicitly completed sets with valid reps/weight earn drops. The first three daily drops include supplies, a lawyer, and a raid ticket. Subsequent drops use the current 60/20/20 default, with a 12-drop daily cap.
3. Enter **Pharmaceutical Lab**. Tap the tank hotspot to reach production controls; start a batch with one supply. Tap the lawyers/entrance hotspot to reach defense; each level costs 1, 2, then 4 additional lawyer items.
4. Open **Practice controls** and tap **+4h** to finish production immediately. **Collect & Sell** banks remaining goods; cash, unused items, and upgrades cannot be raided.
5. From the overview, open **Raids**, scout Mike, and inspect the estimate and exact ticket cost. Mike begins with a ready $20 batch and level-1 defense, costing two tickets to raid. If Alex needs more tickets after the first workout, advance **+24h** and save another sample workout, or switch to Mike to test the other side.
6. A raid spends the displayed ticket cost, takes 25% rounded up, clears all applied defense, and gives the target one hour of protection. Estimates are coarse $5 scouting bands around the actual 25% amount, not random payouts. The result shows actual cash stolen, tickets spent/remaining, and levels cleared.
7. Switch the player selector to **Mike · demo** to see the loss, remaining batch, and cleared defense. You can rebuild, collect, start another batch, or raid Alex when Alex has ready goods.
8. **+1h** ends recent-raid protection. **+24h** opens the next practice reward day. Time changes affect both players, use Chicago reward-day boundaries, and never change the phone's actual clock.
9. Collect or steal enough cash to **Upgrade Lab · $50**. Each level adds $5 to future batches; running batches retain their original output. Maximum level is 5.
10. Reload to check saved progress/timers. **Reset Practice Game** confirms before replacing only the two demo profiles and their sample data.

## Scope and data protection

- This is a functional local practice preview, not the production multiplayer release. Its controls intentionally allow time manipulation for testing.
- Real workout saves, history, plans, drafts, Google authentication, and existing account rules are untouched. No fake drops are announced for real workout saves. The requested drop-toast behavior is implemented for sample workout saves here; connecting real workout rewards requires the shared game service next.
- The separate game key is `lift-tracker:game-practice:v1`. No test-page module imports Firebase or reads actual workout storage. Corrupt/unknown practice saves are preserved until an explicit reset; failed persistence does not report successful drops.
- Supported browsers use Web Locks to serialize practice actions across tabs. Without Web Locks, avoid simultaneous play in multiple tabs; this local fallback is not a shared multiplayer transaction system.
- The realistic lab scene is one original generated illustration with HTML touch controls and a small CSS vapor animation during production. It does not import Embervault or Phaser. Responsive/reduced-motion styles are included; physical iPhone and visual validation remain pending.

## Validation

- `node --test`: 166 tests pass (146 existing tests, 19 practice-rule/storage tests, and one additional shell-asset installation check).
- Coverage includes completed-set eligibility, reward caps/day boundaries, repeated saves, immutable rejected actions, production timing/reload, defense costs/cap, raid conservation/costs/protection/stale requests, failed storage writes, corrupt-save preservation, and account-key isolation.
- JavaScript syntax and whitespace checks pass. Service-worker shell v19 includes all game modules and the scene; worker lifecycle/coherent-cache checks remain covered.
- Browser inventory reported no browser access. A native Chrome launch was attempted for visual checking, but the app approval timed out. No browser/device screenshots or actual touch walkthrough were completed; automated checks do not establish visual correctness.
- A local server was started for a route check, but local HTTP requests were blocked in the sandbox and timed out when retried with approval. The added shell-asset check verifies every cached file exists; HTTP delivery remains unverified locally.

## Art provenance

`assets/game/lab-scene.png` was created with the built-in image generation tool from the selected A-v2 mockup. Prompt: render only the right-phone industrial lab as a portrait 3:4 cutaway scene, matching its realistic concrete/steel and warm amber lighting; tank on the left, supplies rack on the right, two suited lawyers near the entrance. No phone frame, labels, icons, UI, recipes, or manufacturing instructions. The image is original concept artwork, not a Rob Run asset.
