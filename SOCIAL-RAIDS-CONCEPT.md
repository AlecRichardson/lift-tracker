# Workout-Powered Social Raids

Status: future idea, saved for discussion. Not an implementation plan or a commitment to particular rules.

## Core Idea

Give Lift Tracker an optional social/game layer for friends. Logging a real workout creates opportunities to compete, interact, and make progress in an asynchronous game together.

The desired feeling is a base raid or conquest game: you train, challenge a friend, invade their base, and potentially take fictional resources, claim territory, or chip away at their defenses. The user mentioned Clash Royale and base-invasion games as inspiration for the feeling, not as a specification to copy a particular game's rules.

This should be more engaging than a static leaderboard. Each workout should create an opportunity for a meaningful game action and a reason to interact with friends.

## Example

Mike logs bench press. Later, I do my own bench workout, such as four sets of ten. Completing and saving that workout earns some amount of game power or resources. I can use that progress to challenge or raid Mike.

Possible outcomes, still undecided:

- Deal damage to Mike's base or hit points.
- Chip away at a score or defensive total.
- Steal fictional loot or resources in a raid.
- Earn points, rewards, or territory for myself.
- Combine some of these mechanics rather than choosing only one.

The bench-versus-bench connection could make challenges personal: "You trained bench; now I'm answering with my bench workout." Whether attacks must match exercises, match movement categories, or use any completed workout is an open design question.

## Social Layer

- Friends sign in and log their own workouts.
- Friends can see opted-in workout activity and respond to one another.
- Communication could include messages, reactions, challenge invitations, or raid-result exchanges; the exact scope is not decided.
- Workouts and game turns need not happen at the same time. Asynchronous play fits friends training on different schedules.

## Fairness Is Essential

Friends have different strength levels, training experience, equipment, and gym schedules. A raw total-weight or total-volume contest would favor stronger people and would not be a sufficient scoring system.

The game needs a handicap or normalization system. Possible directions to explore, not selected formulas:

- Performance relative to each person's own recent baseline.
- Personal progression and completion of planned work rather than absolute pounds lifted.
- Bounded game rewards per workout, turn, or time period so more sets or more sessions do not automatically dominate.
- Fair treatment of different exercises, equipment, gyms, and pulley setups, where weights are not directly comparable.

## Guardrails to Explore

These are suggested design constraints, not additional user requirements:

- Keep the social game optional; solo tracking must remain useful and uncomplicated.
- Raids steal only fictional game resources, never workout history, personal records, actual strength statistics, account access, money, or real possessions.
- Preserve the actual training record regardless of game results.
- Reward sensible training and consistency, not excessive volume, skipped rest, inflated logs, or risky weight increases.
- Consider cooldowns, protection periods, and limits on repeatedly targeting one friend.
- Use explicit friend/privacy permissions rather than making everyone's workouts public by default.
- Define how edits, deleted workouts, duplicate saves, and suspicious logs affect rewards so the same training cannot repeatedly earn loot.

## Questions for a Future Session

1. What is the main objective: defend a base, capture territory, collect loot, or win a season?
2. Does a completed workout automatically trigger a raid, or earn a resource the player spends on a chosen action?
3. Are challenges tied to the same exercise, a movement category, or the whole workout?
4. What can be won or stolen, and how much can a defender lose?
5. How do we normalize strength differences without making deliberate underperformance or exaggerated logs advantageous?
6. How do rest days, different splits, missed weeks, and unequal training frequency stay fair?
7. What is the smallest satisfying social feature: a private friends group, one challenge type, and a simple attack/defense loop?
8. How much communication is needed initially, and how are unwanted interactions handled?

## Additional Brainstorming — November 16, 2026

- Keep exploring mechanics before choosing a game style. The first pass should stay very simple; no implementation direction has been selected.
- Possible inspirations include Diablo-style random gear and stat rolls, roguelike runs, idle dungeon adventures, and Clash of Clans-style competitive friend raids. Workout results could earn power, rewards, attack opportunities, or equipment upgrades; the mapping is undecided.
- An optional idle adventure could run during a workout, offering occasional interactions between sets: collecting loot, inspecting or sorting items, or making a small choice. Whether attention should affect rewards is undecided; do not treat it as a settled requirement.
- The user already built **Embervault — Dungeon Idle** through Codex on their Texas computer. Its public repository is https://github.com/AlecRichardson/dungeon-idle and its published game is https://alecrichardson.github.io/dungeon-idle/ (page responded successfully when checked this session).
- Its README describes a Mage automatically traversing dungeon floors, random equipment, inventory/stash management, two equipment loadouts, and a Bling Gnome action for selling ground loot. This is a reference for the idle combat and loot interactions, not evidence that workout integration or friend raids already exist.
- **The user explicitly said we may or may not use this prototype.** Remember it as an optional reference only. Do not assume a decision to reuse, integrate, or modify its code. The original prototype conversation has not been recovered or read in this session.

### More ideas from the user

- Each completed set could trigger a loot drop or a chance at one; guaranteed versus random drops is undecided.
- After a workout, the earned items/rewards could build a caravan used to attack another player.
- Workout drops could also build defenses.
- Defenses might "slowly trickle the longer between your workouts." The intended meaning is unresolved: do not assume this means defense decay, resource production, or a particular timing rule.
- Rare fictional items worth stealing are a major attraction. The desired feeling is looting and destroying buddies in PvP, showing off workouts, and bragging about victories and spoils.
- These remain brainstorming possibilities, not selected mechanics. The user reiterated that the first pass should remain simple.

## Next Discussion

First choose one coherent game loop and work through an example between two friends with very different strength levels. Then sketch the workout-to-reward-to-raid experience before deciding on scoring formulas, visual themes, or implementation.

The idea is parked for later. Do not start building it or add it to the current plan-builder redesign without a new request.
