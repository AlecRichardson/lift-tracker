# Workout Raids — Phase 1 Proposal

Status: discussion draft, November 17, 2026. The user requested filling planning gaps, not implementation. Rules and numbers below are assistant proposals unless explicitly identified as user direction. Nothing here authorizes building or deploying the game.

## Confirmed direction from the user

- Keep the first pass extremely simple, with one action/item per function.
- Completed workout sets contribute to drops; receiving loot together after saving is the current preference.
- Loot supports starting timed production, applying defense, and attacking another player.
- Production represents invested resources that friends can raid. Desirable loot, rivalry, showing off workouts, and PvP spoils are the appeal.
- The existing Embervault prototype is optional inspiration, not a selected dependency.

## Proposed complete loop

Complete sets → save workout → receive items → start a job, apply a shield, or raid a friend → collect production or stolen gold → upgrade production.

All names are placeholders. Production theme remains open. No dungeon or caravan is required for this proposal.

## Items and workout rewards

Three stackable item types, each with one use:

| Item | Action | Proposed effect |
| --- | --- | --- |
| Supplies | Start Job | Spend one to start the single production slot |
| Shield | Apply Defense | Spend one to block the next raid; only one can be active |
| Raid Ticket | Attack | Spend one to resolve one raid against a chosen friend |

- Only sets explicitly marked complete and containing a valid recorded effort qualify. Unchecked prefilled sets do not earn game rewards; existing workout-save/history/volume behavior stays intact.
- Proposed first experiment: each eligible set grants one item, up to 12 rewarded sets per account per calendar day in one fixed game timezone. Additional workouts share the same allowance. This is a tunable reward ceiling, not a workout recommendation.
- To make the first rewarded workout useful, the first three rewarded sets each day give Supplies, Shield, and Raid Ticket in that order. Remaining rewarded sets roll 60% Supplies, 20% Shield, 20% Raid Ticket. A workout with fewer sets still earns its corresponding rewards; no minimum workout length is required.
- Sets never receive extra power for heavier weights, longer sessions, personal records, or more total volume. The ceiling limits, but does not eliminate, advantages from training frequency. This is a friend-group prototype, not a fully normalized competitive system.
- Past workouts and imports are not eligible. A reward is issued once for a newly saved eligible workout. Edits, deletion, retries, and a different device do not reroll or reissue that workout's loot. Deleting workout history remains available and never restores the daily allowance.
- Offline saves must still work; rewards can wait until a connection is available. Do not show unconfirmed loot as spendable. Game failures must never prevent workout saving.

## One timed production slot

- Start Job consumes one Supplies and starts a four-hour timer. Only one job can run or await collection at once; no queue, restarting, or automatic repeated production.
- The timer continues while the app is closed. At completion, the job contains 20 gold at level 1.
- Gold is the only currency. Collect moves the remaining output into a protected bank and frees the slot. Banked gold, unused items, and permanent upgrades cannot be stolen in this proposal.
- Only finished, uncollected output can be raided. Inputs and unfinished jobs are safe. Opponents see whether a target has output, its current amount, and its defenses/protection before committing a raid.
- A ready job remains until collected; no spoilage or obligation to return on time. Rest days do not decay upgrades or defenses.
- Optional rarity within the same action: a 10% chance when starting a job creates a visibly rare batch with double output. Its appearance is visible to friends. This is a candidate way to preserve desirable targets without adding another inventory system; a unique stealable collectible is deferred.

## One defense and one attack rule

- Apply Defense activates a shield indefinitely until hit. Applying another while shielded is disabled and consumes nothing.
- A valid attack costs one Raid Ticket. An active shield blocks the attack and is consumed; the attacker gains nothing. This deliberate outcome is visible before attacking, so friends can decide whether stripping a shield is worthwhile.
- Without a shield, an attack steals 25% of the current ready output, rounded up. There are no combat stats, random win rolls, troop selection, or repair screens. The stolen gold goes directly into the attacker's protected bank.
- A resolved raid, including a blocked raid, gives the defender eight hours of protection from everyone. A second simultaneous attack cannot spend a ticket or take loot after protection begins.
- Empty, unfinished, protected, self, or non-friend targets cannot be attacked; no ticket is spent for a rejected/stale target. A final check determines eligibility before consuming anything.
- Reports show attacker/defender, time, shield result, and actual gold transferred. Only a real transfer counts as a win or gold stolen; stripping a shield is reported separately.
- There is no destruction/repair or rare item theft in this initial proposal. This consciously narrows the user's larger PvP fantasy and needs discussion before the scope is treated as accepted.

## One permanent upgrade

- Upgrade spends 50 banked gold to increase base job output by 5, up to level 5. Cost stays fixed for this first experiment; no branching choices.
- Job output, including any rare multiplier, is fixed at job start. Upgrading affects the next job, not an existing timer or ready batch.
- Upgrades are never lost in raids. No additional spending systems are included yet; the finite upgrade cap is sufficient for a short friend-group trial, not a permanent economy.

## Friends and showing off

- Start with a private, mutually accepted friend group. An invitation code can create a pending request; the recipient accepts before either player can raid or view shared activity.
- Only players who opt into the game appear as targets. Leaving disables both attacking and being attacked and removes the player from target lists. Existing game state is retained; rejoining uses the later of any existing protection expiry or eight hours from rejoining, and prevents attacks in either direction during that interval. This simple rule needs validation against toggle abuse before broader play.
- Shared information: display name, game base level, production availability, shield/protection, actual stolen-gold total, and a latest-workout summary with date and completed-set count. Do not expose exercise details, notes, body metrics, or weights by default.
- Keep a short raid activity list and an all-time friends ranking by actual gold stolen. No public matchmaking, chat, push notifications, seasons, or separate social feed in Phase 1.
- Solo players can produce and upgrade; PvP becomes available when a friend joins.

## App flow

- Saving a workout still returns Home. If opted in, Home can show the new loot summary with a single Open Base action. Reward calculation delays must not hold the save screen open.
- One optional Base screen contains item counts, the production slot, bank/upgrade button, and friend targets/raid results. Game actions each resolve with a short result; selecting a raid target is the only required choice before attacking.
- Production and raiding require a connection for shared state. Workout logging and drafts keep their existing behavior.
- No game UI or interruptions between sets in Phase 1; the idle-during-workout idea stays available for a later phase.

## Example

Alex saves a workout containing 12 eligible completed sets and receives 12 items, including at least one of each type under the proposed daily starter sequence. Alex spends one Supplies to start a job, and one Shield to protect it.

Four hours later the normal level-1 job holds 20 gold. Mike spends a Raid Ticket and breaks the shield, receiving no gold. Alex gets eight hours of protection. If Alex leaves the job uncollected past protection, a later unblocked raid takes 5 gold from the 20 remaining; Alex can still bank the remaining 15. Alternatively, Alex can collect all 20 before another valid raid. Neither workout record is affected.

## Verification needed before any first release

- Workout saves succeed independently of game errors or connectivity, retain drafts/history semantics, and still route Home.
- Retries, edits, imported history, deleted workouts, multiple devices, and day boundaries cannot duplicate rewards or reroll items.
- Production inputs, bank balances, tickets, shields, gold transfers, protection, and upgrades are checked by the shared game service rather than trusted from a player's screen. Concurrent collect/raid/upgrade actions cannot duplicate or lose resources.
- Timers survive closing/reopening and use authoritative time; a phone clock change cannot accelerate production.
- Rejected raids consume nothing; resolved raids consistently consume one ticket and at most one shield. Friend removal and game opt-out prevent later raids.
- iPhone checks cover loot summary on Home, timer restoration, single-action controls, and clear empty/offline/protected states. Existing History, Progress, Plan Builder, logging, and existing account data remain intact.

## Decisions to settle first

1. Is raiding finished output enough, or must ongoing production also be vulnerable?
2. Does a shield that blocks one attack feel useful/fun, versus reducing theft while still rewarding the attacker?
3. Is a rare double-value batch enough for Phase 1, or is a rare collectible that changes owners essential to the appeal?

All numerical values, reward rules, privacy defaults, and the proposed simplified combat/economy are starting hypotheses for discussion. Do not treat this document as accepted implementation requirements until the user selects the rules.
