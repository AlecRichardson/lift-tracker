// Practice-only rules. Never reads/writes workout accounts or shared game data.
export const DEMO_GAME_KEY = "lift-tracker:game-practice:v1";
export const GAME_RULES = Object.freeze({ dailyLimit: 12, batchMs: 4 * 60 * 60 * 1000,
  protectionMs: 60 * 60 * 1000, maxDefense: 3, upgradeCost: 50, maxLab: 5 });

const integer = (value, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= 0 && value <= max;
const record = value => value && typeof value === "object" && !Array.isArray(value);
const idPattern = /^[a-zA-Z0-9_-]{1,100}$/;
const dayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" });
export function rewardDay(now) {
  const parts = Object.fromEntries(dayFormatter.formatToParts(new Date(now)).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function createDemoGame(now = Date.now()) {
  const player = (id, name) => ({ id, name, cash: 0, supplies: 0, lawyers: 0, tickets: 0,
    defense: 0, labLevel: 1, batch: null, protectedUntil: 0, stolen: 0,
    dailyRewards: {}, workoutClaims: {}, workouts: [] });
  const alex = player("alex", "Alex");
  const mike = player("mike", "Mike");
  Object.assign(mike, { cash: 50, supplies: 4, lawyers: 7, tickets: 8, defense: 1,
    batch: { id: "starter-batch", startedAt: now - GAME_RULES.batchMs, readyAt: now,
      output: 20, remaining: 20 } });
  return { version: 1, revision: 0, activePlayerId: "alex", clockOffsetMs: 0,
    players: { alex, mike }, events: [], receipts: {} };
}

export function validDemoGame(state) {
  if (!record(state) || state.version !== 1 || !integer(state.revision) ||
    !["alex", "mike"].includes(state.activePlayerId) || !integer(state.clockOffsetMs) ||
    !record(state.players) || !Array.isArray(state.events) || !record(state.receipts)) return false;
  for (const id of ["alex", "mike"]) {
    const p = state.players[id];
    if (!record(p) || p.id !== id || p.name !== (id === "alex" ? "Alex" : "Mike") ||
      !["cash", "supplies", "lawyers", "tickets", "stolen", "protectedUntil"].every(key => integer(p[key])) ||
      !integer(p.defense, 3) || !integer(p.labLevel, 5) || p.labLevel < 1 ||
      !record(p.dailyRewards) || !record(p.workoutClaims) || !Array.isArray(p.workouts)) return false;
    if (Object.entries(p.dailyRewards).some(([day, count]) => !/^\d{4}-\d{2}-\d{2}$/.test(day) || !integer(count, 12))) return false;
    if (Object.entries(p.workoutClaims).some(([id, value]) => !idPattern.test(id) || value !== true)) return false;
    if (p.workouts.some(w => !record(w) || !idPattern.test(w.id) || typeof w.name !== "string" ||
      !integer(w.savedAt) || !integer(w.completedSets, 1000))) return false;
    if (p.batch !== null && (!record(p.batch) || !idPattern.test(p.batch.id) ||
      !integer(p.batch.startedAt) || !integer(p.batch.readyAt) || p.batch.readyAt < p.batch.startedAt ||
      !integer(p.batch.output, 40) || p.batch.output < 20 || !integer(p.batch.remaining, p.batch.output))) return false;
  }
  return state.events.every(e => record(e) && typeof e.text === "string" && e.text.length < 300 &&
    integer(e.at) && ["alex", "mike"].includes(e.playerId)) &&
    Object.entries(state.receipts).every(([id, r]) => idPattern.test(id) && record(r) && r.ok === true);
}

export const defenseCost = level => 2 ** level;
export const raidCost = player => 2 ** player.defense;
export const batchOutput = player => 20 + (player.labLevel - 1) * 5;
export const readyBatch = (player, now) => Boolean(player.batch && player.batch.readyAt <= now && player.batch.remaining > 0);

export function raidPreview(state, actorId, targetId, now) {
  const actor = state.players[actorId], target = state.players[targetId];
  if (!actor || !target || actorId === targetId) return { available: false, reason: "Choose another player." };
  const cost = raidCost(target);
  const loot = readyBatch(target, now) ? Math.ceil(target.batch.remaining * 0.25) : 0;
  // Scout range is deliberately coarse; it is not a random payout roll.
  const low = loot ? Math.floor((loot - 1) / 5) * 5 + 1 : 0;
  let reason = "";
  if (target.protectedUntil > now) reason = "Protected after a recent raid.";
  else if (!loot) reason = target.batch && target.batch.readyAt > now ? "Their batch is still running." : "No finished goods to steal.";
  else if (actor.tickets < cost) reason = `You need ${cost} raid ticket${cost === 1 ? "" : "s"}.`;
  return { available: !reason, reason, cost, loot, low, high: loot ? low + 4 : 0,
    defense: target.defense, batchId: target.batch?.id || "", remaining: target.batch?.remaining || 0 };
}

export function eligibleSetCount(sets) {
  return (Array.isArray(sets) ? sets : []).filter(set => set?.done === true &&
    Number.isFinite(set.reps) && set.reps > 0 && Number.isFinite(set.weight) && set.weight >= 0).length;
}

// A transition either succeeds in full or returns the exact untouched input.
export function runDemoCommand(input, command, { now = Date.now(), random = Math.random } = {}) {
  const fail = message => ({ state: input, result: { ok: false, message } });
  if (!validDemoGame(input)) return fail("Your practice game couldn’t be opened. Your saved copy has been kept.");
  if (!record(command) || !idPattern.test(command.id || "")) return fail("Please try that action again.");
  if (Object.hasOwn(input.receipts, command.id)) return { state: input, result: { ...input.receipts[command.id], repeated: true } };
  const state = structuredClone(input);
  const p = state.players[command.playerId];
  if (!p) return fail("Choose a practice player first.");
  const time = now + state.clockOffsetMs;
  if (!integer(time)) return fail("The practice clock is unavailable.");
  let result = { ok: true };
  const event = (playerId, text) => state.events.unshift({ playerId, text, at: time });
  switch (command.type) {
    case "switch-player": {
      if (!state.players[command.targetId]) return fail("That practice player isn’t available.");
      state.activePlayerId = command.targetId;
      break;
    }
    case "save-workout": {
      const workout = command.workout;
      if (!record(workout) || !idPattern.test(workout.id || "")) return fail("Start a new sample workout.");
      if (Object.hasOwn(p.workoutClaims, workout.id)) return fail("That sample workout has already received its drops.");
      if (!Array.isArray(workout.sets) || workout.sets.length > 1000) return fail("That sample workout couldn’t be saved.");
      const completedSets = eligibleSetCount(workout.sets), day = rewardDay(time);
      const used = p.dailyRewards[day] || 0;
      const count = Math.min(completedSets, GAME_RULES.dailyLimit - used);
      const drops = { supplies: 0, lawyers: 0, tickets: 0 };
      for (let i = 0; i < count; i++) {
        const position = used + i;
        const roll = position < 3 ? 0 : random();
        if (!Number.isFinite(roll) || roll < 0 || roll >= 1) return fail("The drops couldn’t be prepared. Try again.");
        const item = position < 3 ? ["supplies", "lawyers", "tickets"][position] : roll < .6 ? "supplies" : roll < .8 ? "lawyers" : "tickets";
        drops[item]++;
      }
      for (const key of Object.keys(drops)) p[key] += drops[key];
      p.dailyRewards[day] = used + count;
      p.workoutClaims[workout.id] = true;
      p.workouts.unshift({ id: workout.id, name: String(workout.name || "Sample workout").slice(0, 80), savedAt: time, completedSets });
      p.workouts = p.workouts.slice(0, 30);
      event(p.id, `Saved a sample workout · ${completedSets} completed sets · ${count} drops`);
      result = { ok: true, type: "drops", drops, count, completedSets, limitReached: used + count >= 12 };
      break;
    }
    case "start-batch": {
      if (p.batch) return fail("Collect your current batch before starting another.");
      if (!p.supplies) return fail("Earn supplies by saving a sample workout.");
      p.supplies--;
      p.batch = { id: command.id, startedAt: time, readyAt: time + GAME_RULES.batchMs,
        output: batchOutput(p), remaining: batchOutput(p) };
      event(p.id, "Started a batch · 1 supply used");
      result.message = "Batch started. Ready in 4 hours.";
      break;
    }
    case "collect": {
      if (command.batchId !== p.batch?.id) return fail("Your batch changed. Check the lab and try again.");
      if (!p.batch || p.batch.readyAt > time) return fail("Your batch isn’t ready yet.");
      const amount = p.batch.remaining;
      p.cash += amount;
      p.batch = null;
      event(p.id, `Collected & sold a batch · $${amount} banked`);
      result.message = `$${amount} collected & sold. Your cash is safe.`;
      break;
    }
    case "defend": {
      if (command.expectedLevel !== p.defense) return fail("Your defense changed. Check the new cost.");
      if (p.defense >= GAME_RULES.maxDefense) return fail("Defense is already at its maximum level.");
      const cost = defenseCost(p.defense);
      if (p.lawyers < cost) return fail(`You need ${cost} lawyer item${cost === 1 ? "" : "s"} to reinforce.`);
      p.lawyers -= cost;
      p.defense++;
      event(p.id, `Built defense level ${p.defense} · ${cost} lawyer items used`);
      result.message = `Defense level ${p.defense}. Raiding you now costs ${raidCost(p)} tickets.`;
      break;
    }
    case "upgrade": {
      if (command.expectedLevel !== p.labLevel) return fail("Your lab level changed. Check it before upgrading.");
      if (p.labLevel >= GAME_RULES.maxLab) return fail("Your lab is fully upgraded.");
      if (p.cash < GAME_RULES.upgradeCost) return fail("Collect or steal $50 to upgrade the lab.");
      p.cash -= GAME_RULES.upgradeCost;
      p.labLevel++;
      event(p.id, `Upgraded lab to level ${p.labLevel}`);
      result.message = `Lab upgraded. Future batches produce $${batchOutput(p)}.`;
      break;
    }
    case "raid": {
      const preview = raidPreview(state, p.id, command.targetId, time);
      if (!preview.available) return fail(preview.reason);
      if (command.expectedDefense !== preview.defense || command.batchId !== preview.batchId ||
        command.expectedRemaining !== preview.remaining) return fail("This target changed. Review the updated raid before spending tickets.");
      const target = state.players[command.targetId];
      p.tickets -= preview.cost;
      p.cash += preview.loot;
      p.stolen += preview.loot;
      target.batch.remaining -= preview.loot;
      target.defense = 0;
      target.protectedUntil = time + GAME_RULES.protectionMs;
      event(p.id, `Raided ${target.name} · $${preview.loot} stolen · ${preview.cost} tickets spent`);
      event(target.id, `${p.name} raided your lab · $${preview.loot} stolen · all applied defense cleared`);
      result = { ok: true, type: "raid", targetName: target.name, loot: preview.loot,
        cost: preview.cost, defenseDestroyed: preview.defense, ticketsLeft: p.tickets };
      break;
    }
    case "advance-time": {
      if (!integer(command.hours, 24) || command.hours < 1) return fail("Choose 1, 4, or 24 practice hours.");
      state.clockOffsetMs += command.hours * 60 * 60 * 1000;
      result.message = `Practice time advanced by ${command.hours} hour${command.hours === 1 ? "" : "s"} for both players.`;
      break;
    }
    default: return fail("That action isn’t available.");
  }
  state.events = state.events.slice(0, 60);
  state.revision++;
  state.receipts[command.id] = result;
  for (const key of Object.keys(state.receipts).slice(0, -200)) delete state.receipts[key];
  if (!validDemoGame(state)) return fail("That action couldn’t be saved. Your previous game has been kept.");
  return { state, result };
}

export function dropMessage(result) {
  if (!result.count) return result.completedSets === 0 ? "Sample workout saved. Complete sets to earn drops." : "Sample workout saved. Today’s 12 drops are already collected.";
  const { supplies, lawyers, tickets } = result.drops;
  return `Drops received: ${[supplies && `${supplies} ${supplies === 1 ? "supply" : "supplies"}`, lawyers && `${lawyers} lawyer${lawyers === 1 ? "" : "s"}`, tickets && `${tickets} raid ticket${tickets === 1 ? "" : "s"}`].filter(Boolean).join(" · ")}`;
}
