# Workout Raids — Phase 1 Proposal

Status: Phase 1 scope with confirmed mechanics and recommended starting defaults. The user asked the assistant to fill remaining planning gaps and keep the first pass simple. Values labeled defaults are assistant-selected tuning values, not individually approved user choices. No game implementation or deployment has been requested.

## Confirmed direction from the user

- Keep the first pass extremely simple, with one action/item per function.
- Completed workout sets contribute to drops; receiving loot together after saving is the current preference.
- Loot supports starting timed production, applying defense, and attacking another player.
- Production represents invested resources that friends can raid. Desirable loot, rivalry, showing off workouts, and PvP spoils are the appeal.
- The existing Embervault prototype is optional inspiration, not a selected dependency.
- Only finished, uncollected production can be stolen; running jobs are safe.
- Defense stacks to a cap with exponentially increasing construction costs.
- Defense raises the number of Raid Tickets needed; it does not also reduce the percentage stolen. This supersedes the earlier reduced-theft proposal.
- An attacker who can pay the displayed ticket cost succeeds. A successful raid consumes all applied defense, requiring the defender to rebuild it; unused inventory shields remain safe.
- Failed raids and partially destroying defenses are possible Phase 2 mechanics, not Phase 1 requirements.

## Proposed complete loop

Complete sets → save workout → receive items → start a job, apply a shield, or raid a friend → collect production or stolen gold → upgrade production.

The user selected a bodybuilding drug-lord theme: one fictional pharmaceutical lab covers peptides, steroids, and other PED-themed products. Defense is themed as lawyers, which the user liked. Phase 1 uses one generic batch and one production action; product names do not add recipes or distinct production systems. No dungeon or caravan is required.

Terminology mapping: Supplies → Lab Supplies; Shield/defense → Lawyers; Job → Batch; Gold → Cash. The mechanical descriptions below retain their original generic labels where useful. Proposed production/collection button wording is Produce Batch and Collect & Sell; collection converts the remaining finished goods into protected cash in one action. Raid Ticket remains a placeholder until naming is discussed. Pre-workout, apparel, storefronts, social-media content drops, and additional businesses remain later brainstorming ideas, not Phase 1 systems.

## Items and workout rewards

Three stackable item types, each with one use:

| Item | Action | Proposed effect |
| --- | --- | --- |
| Supplies | Start Job | Spend one to start the single production slot |
| Shield | Build Defense | Spend the displayed number to add the next defense level |
| Raid Ticket | Attack | Spend the displayed cost for the target's defense level |

- Only sets explicitly marked complete and containing a valid recorded effort qualify. Unchecked prefilled sets do not earn game rewards; existing workout-save/history/volume behavior stays intact.
- Starting default: each eligible set grants one item, up to 12 rewarded sets per account per calendar day in America/Chicago, using the reward claim time. Additional workouts share the same allowance. Offline saves claim against the day they reconnect; they do not backfill missed allowances. This is a tunable reward ceiling, not a workout recommendation.
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
- Keep one standard batch in Phase 1. Rare batches, rare equipment, and unique stealable collectibles are deferred; the initial trial tests the production-and-raid loop first.

## Stacked defense and one attack rule

- Default cap: three defense levels. Each Build Defense tap adds one level at the displayed cost. Defense persists across jobs and collection until a successful raid consumes all of it; it never expires just because the player rests.

| Defense level | Shields to reach this level from the previous level | Total shields invested | Tickets needed to raid |
| --- | --- | --- | --- |
| 0 | 0 | 0 | 1 |
| 1 | 1 | 1 | 2 |
| 2 | 2 | 3 | 4 |
| 3 | 4 | 7 | 8 |

- These are starting costs for testing. Build Defense is disabled at the cap or without the required inventory; an invalid tap consumes nothing. Shields are workout drops, not gold purchases, in this default economy.
- A valid attack spends the required Raid Tickets, succeeds immediately, and clears all applied defense. Insufficient tickets mean Attack is unavailable, not a failed raid. There is no way to pay fewer tickets to attempt a risky attack.
- Every successful attack steals 25% of the current ready output, rounded up, regardless of defense level. The stolen gold goes directly into the attacker's protected bank. There are no combat stats, random win rolls, troop selection, or repair screens.
- Default anti-pile-on rule: a successful raid gives the defender one hour of protection from everyone, shown as a timer. This temporary cooldown is separate from purchased defense. It replaces the earlier eight-hour proposal and can be tuned after testing. A second simultaneous attack cannot spend tickets or take loot after protection begins.
- Empty, unfinished, protected, self, or non-friend targets cannot be attacked; no ticket is spent for a rejected/stale target. A final check determines eligibility before consuming anything.
- Reports show attacker/defender, time, tickets spent, defense levels destroyed, and actual gold transferred. Only real transfers count toward stolen-gold totals.
- Permanent base destruction, repairs, rare item theft, and failed raid attempts stay outside this first trial.

## One permanent upgrade

- Upgrade spends 50 banked gold to increase base job output by 5, up to level 5. Cost stays fixed for this first experiment; no branching choices.
- Job output is fixed at job start. Upgrading affects the next job, not an existing timer or ready batch.
- Upgrades are never lost in raids. No additional spending systems are included yet; the finite upgrade cap is sufficient for a short friend-group trial, not a permanent economy.

## Friends and showing off

- Start with a private, mutually accepted friend group. An invitation code can create a pending request; the recipient accepts before either player can raid or view shared activity.
- Only players who opt into the game appear as targets. Leaving disables both attacking and being attacked and removes the player from target lists. Existing game state is retained. If the player later rejoins, preserve existing raid protection, defense, inventories, and production but grant no new rewards or protection merely for rejoining. Repeated opting out or removing friends to evade raids is a known limitation of the private friend-group trial; broader competitive abuse prevention is deferred rather than adding participation timers to Phase 1.
- Shared information: display name, game base level, production availability, shield/protection, actual stolen-gold total, and a latest-workout summary with date and completed-set count. Do not expose exercise details, notes, body metrics, or weights by default.
- Keep a short raid activity list and an all-time friends ranking by actual gold stolen. No public matchmaking, chat, push notifications, seasons, or separate social feed in Phase 1.
- Solo players can produce and upgrade; PvP becomes available when a friend joins.

## App flow

- Saving a workout still returns Home. If opted in, Home can show the new loot summary with a single Open Base action. Reward calculation delays must not hold the save screen open.
- One optional Base screen contains item counts, the production slot, bank/upgrade button, and friend targets/raid results. Game actions each resolve with a short result; selecting a raid target is the only required choice before attacking.
- Production and raiding require a connection for shared state. Workout logging and drafts keep their existing behavior.
- No game UI or interruptions between sets in Phase 1; the idle-during-workout idea stays available for a later phase.

## Example

Alex saves a workout containing 12 eligible completed sets and receives 12 items, including at least one of each type under the daily starter sequence. Alex spends one Supplies to start a job, then spends one Shield and two more Shields to build level-2 defense.

Four hours later the level-1 production job holds 20 gold. Mike sees that Alex has level-2 defense and that Attack costs four tickets. Mike spends four tickets, steals five gold, and clears all applied defense. Alex has 15 gold left to collect, gets one hour of protection, and can rebuild defense with unused inventory Shields. Neither workout record is affected.

## Verification needed before any first release

- Workout saves succeed independently of game errors or connectivity, retain drafts/history semantics, and still route Home.
- Retries, edits, imported history, deleted workouts, multiple devices, and day boundaries cannot duplicate rewards or reroll items.
- Production inputs, bank balances, tickets, shields, gold transfers, protection, and upgrades are checked by the shared game service rather than trusted from a player's screen. Concurrent collect/raid/upgrade actions cannot duplicate or lose resources.
- Timers survive closing/reopening and use authoritative time; a phone clock change cannot accelerate production.
- Rejected raids consume nothing; successful raids spend exactly the displayed defense-dependent ticket cost, clear applied defense only, transfer the correct gold, and start protection together. Stale prices must refresh without silently charging more or spending against an empty/collected job. Friend removal and completed game withdrawal prevent later raids.
- iPhone checks cover loot summary on Home, timer restoration, single-action controls, and clear empty/offline/protected states. Existing History, Progress, Plan Builder, logging, and existing account data remain intact.

## Trial scope and defaults

- One Base screen, three item types, one job slot, three defense levels, one production upgrade path, direct friend raids, and a small results list/ranking complete this first-pass specification.
- Job duration/output, reward ceiling/distribution, defense and ticket prices, theft percentage, upgrade prices, and raid cooldown are adjustable defaults. They do not require adding more mechanics to run the first trial.
- Use the pharmaceutical-lab/lawyers theme above. Exact artwork and screen layout remain open and should be discussed with the user before UI implementation.
- First trial success: friends can each complete the loop and understand why a target costs more to raid, what was stolen, and how to rebuild. Observe whether ready goods actually remain available long enough to create raid opportunities; finished-output-only may produce too few targets and should be tested before expanding the game.
- Deferred: live workout drops/idle dungeon, classes, caravans, gear, trading, rare collectibles, failed raids, partial defense destruction, multiple businesses, public matchmaking, and seasons.

This completes the planning gaps with explicit defaults while distinguishing confirmed user mechanics from recommended tuning. Building and deploying remain separate, unrequested work.

## Next: screen and interaction brainstorming

The user explicitly wants to discuss their own expectations for how the screens look and interact. Do this before treating the earlier one-Base-screen proposal as an approved layout. Walk through workout save → loot reveal → lab/base → produce/defend → select a friend → raid result, including returning Home. Explore the user's visual and interaction preferences rather than choosing a finished design for them. No mockup or UI implementation has been requested yet.
