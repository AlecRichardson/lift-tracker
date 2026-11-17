import assert from "node:assert/strict";
import test from "node:test";
import { createDemoGame, DEMO_GAME_KEY, dropMessage, eligibleSetCount, GAME_RULES,
  raidPreview, rewardDay, runDemoCommand, validDemoGame } from "./game-state.mjs";
import { createDemoStore } from "./game-store.mjs";

const now = Date.parse("2026-11-17T18:00:00Z");
let seq = 0;
const command = (type, rest = {}) => ({ id: `action-${++seq}`, playerId: "alex", type, ...rest });
const sets = (count = 12) => Array.from({ length: count }, () => ({ done: true, reps: 10, weight: 50 }));
const workout = (id = `workout-${++seq}`, count = 12) => ({ id, name: "Sample", sets: sets(count) });
const run = (s, c, options = {}) => runDemoCommand(s, c, { now, random: () => .9, ...options });
const storageFixture = initial => {
  const values = new Map(initial || []);
  const writes = [];
  return { values, writes, getItem: key => values.get(key) ?? null,
    setItem: (key, value) => { writes.push(key); values.set(key, value); } };
};

test("demo starts isolated: Alex earns inventory, Mike is an immediately scoutable rival", () => {
  const state = createDemoGame(now);
  assert.ok(validDemoGame(state));
  assert.equal(state.players.alex.supplies, 0);
  assert.deepEqual(raidPreview(state, "alex", "mike", now), {
    available: false, reason: "You need 2 raid tickets.", cost: 2, loot: 5, low: 1, high: 5,
    defense: 1, batchId: "starter-batch", remaining: 20
  });
});

test("set eligibility excludes unchecked prefill and invalid effort, supports bodyweight", () => {
  assert.equal(eligibleSetCount([{ done: false, reps: 10, weight: 100 },
    { done: true, reps: 10, weight: 0 }, { done: true, reps: 0, weight: 10 },
    { done: true, reps: 10, weight: -1 }, { done: true, reps: NaN, weight: 1 },
    { done: "true", reps: 10, weight: 10 }, { done: true, reps: 10, weight: Infinity }]), 1);
});

test("saving earns one drop per completed set with guaranteed starter types and daily cap", () => {
  const state = createDemoGame(now);
  const first = run(state, command("save-workout", { workout: workout() }));
  assert.equal(first.result.count, 12);
  assert.deepEqual(first.result.drops, { supplies: 1, lawyers: 1, tickets: 10 });
  assert.equal(state.players.alex.tickets, 0, "input was not mutated");
  const next = run(first.state, command("save-workout", { workout: workout() }));
  assert.equal(next.result.count, 0);
  assert.equal(next.state.players.alex.workouts.length, 2);
  assert.match(dropMessage(next.result), /already collected/);
});

test("partial workouts share the starter sequence across saves, not a new trio per workout", () => {
  let state = createDemoGame(now);
  for (const key of ["supplies", "lawyers", "tickets"]) {
    const result = run(state, command("save-workout", { workout: workout(undefined, 1) }));
    assert.equal(result.result.drops[key], 1);
    state = result.state;
  }
  assert.equal(state.players.alex.dailyRewards[rewardDay(now)], 3);
});

test("unchecked saved sample sets produce no rewards without claiming daily allowance", () => {
  const result = run(createDemoGame(now), command("save-workout", { workout: { id: "unchecked", sets: sets().map(s => ({ ...s, done: false })) } }));
  assert.equal(result.result.count, 0);
  assert.equal(result.state.players.alex.workouts.length, 1);
  assert.match(dropMessage(result.result), /Complete sets/);
});

test("a repeated workout cannot earn again even with a new action ID or on a later day", () => {
  const c = command("save-workout", { workout: workout("same-workout") });
  const first = run(createDemoGame(now), c);
  const repeated = run(first.state, c);
  assert.equal(repeated.result.repeated, true);
  assert.strictEqual(repeated.state, first.state);
  const edited = run(first.state, { ...c, id: "edited" }, { now: now + 86400000 });
  assert.equal(edited.result.ok, false);
  assert.strictEqual(edited.state, first.state);
});

test("daily limits and Chicago day boundaries are per player", () => {
  let state = run(createDemoGame(now), command("save-workout", { workout: workout() })).state;
  const mike = run(state, command("save-workout", { playerId: "mike", workout: workout() }));
  assert.equal(mike.result.count, 12);
  const tomorrow = run(state, command("save-workout", { workout: workout() }), { now: now + 86400000 });
  assert.equal(tomorrow.result.count, 12);
  assert.equal(rewardDay(Date.parse("2026-11-18T05:59:59Z")), "2026-11-17");
  assert.equal(rewardDay(Date.parse("2026-11-18T06:00:00Z")), "2026-11-18");
});

test("batch consumes one supply, runs while closed, and cannot be restarted or collected early", () => {
  let state = createDemoGame(now);
  state.players.alex.supplies = 2;
  const start = run(state, command("start-batch"));
  assert.equal(start.state.players.alex.supplies, 1);
  assert.equal(start.state.players.alex.batch.readyAt, now + GAME_RULES.batchMs);
  assert.equal(run(start.state, command("start-batch")).result.ok, false);
  assert.equal(run(start.state, command("collect", { batchId: start.state.players.alex.batch.id })).result.ok, false);
  const reload = JSON.parse(JSON.stringify(start.state));
  const collect = run(reload, command("collect", { batchId: reload.players.alex.batch.id }), { now: now + GAME_RULES.batchMs });
  assert.equal(collect.state.players.alex.cash, 20);
  assert.equal(collect.state.players.alex.batch, null);
  assert.equal(collect.state.players.alex.supplies, 1);
});

test("stale collect requests cannot take a replacement batch", () => {
  const state = createDemoGame(now);
  const result = run(state, command("collect", { playerId: "mike", batchId: "old-batch" }));
  assert.equal(result.result.ok, false);
  assert.strictEqual(result.state, state);
});

test("defense stacks for 1, 2, 4 lawyer items, caps at three, and does not decay", () => {
  let state = createDemoGame(now);
  state.players.alex.lawyers = 8;
  for (let level = 0; level < 3; level++) state = run(state, command("defend", { expectedLevel: level })).state;
  assert.equal(state.players.alex.lawyers, 1);
  assert.equal(state.players.alex.defense, 3);
  assert.equal(run(state, command("defend", { expectedLevel: 3 })).result.ok, false);
  assert.equal(run(state, command("defend", { expectedLevel: 2 })).result.ok, false);
  const later = run(state, command("advance-time", { hours: 24 }));
  assert.equal(later.state.players.alex.defense, 3);
});

test("raids spend defense-dependent tickets, transfer 25%, clear applied defense, protect target", () => {
  for (let defense = 0; defense <= 3; defense++) {
    const state = createDemoGame(now);
    state.players.alex.tickets = 10;
    state.players.mike.defense = defense;
    const result = run(state, command("raid", { targetId: "mike", expectedDefense: defense,
      expectedRemaining: 20, batchId: "starter-batch" }));
    assert.equal(result.result.ok, true);
    assert.equal(result.result.loot, 5);
    assert.equal(result.state.players.alex.tickets, 10 - 2 ** defense);
    assert.equal(result.state.players.alex.cash, 5);
    assert.equal(result.state.players.alex.stolen, 5);
    assert.equal(result.state.players.mike.batch.remaining, 15);
    assert.equal(result.state.players.mike.defense, 0);
    assert.equal(result.state.players.mike.lawyers, 7, "inventory lawyers are safe");
    assert.equal(result.state.players.mike.cash, 50, "banked cash is safe");
    assert.equal(result.state.players.mike.protectedUntil, now + GAME_RULES.protectionMs);
    assert.equal(result.state.events.length, 2);
  }
});

test("invalid, protected, empty, running, self and stale raids consume nothing", () => {
  const base = createDemoGame(now);
  base.players.alex.tickets = 20;
  const c = command("raid", { targetId: "mike", expectedDefense: 1, expectedRemaining: 20, batchId: "starter-batch" });
  for (const mutate of [s => { s.players.alex.tickets = 0; },
    s => { s.players.mike.protectedUntil = now + 1000; }, s => { s.players.mike.batch.remaining = 0; },
    s => { s.players.mike.batch.readyAt = now + 1000; }, s => { s.players.mike.defense = 2; },
    s => { s.players.mike.batch.remaining = 10; }, s => { s.players.mike.batch = null; }]) {
    const state = structuredClone(base); mutate(state);
    const result = run(state, { ...c, id: `rejected-${++seq}` });
    assert.equal(result.result.ok, false);
    assert.strictEqual(result.state, state);
  }
  for (const targetId of ["alex", "missing"]) assert.equal(run(base, { ...c, targetId }).result.ok, false);
});

test("double raid cannot spend twice; a new attack stays blocked until protection expires", () => {
  const state = createDemoGame(now); state.players.alex.tickets = 20;
  const c = command("raid", { targetId: "mike", expectedDefense: 1, expectedRemaining: 20, batchId: "starter-batch" });
  const first = run(state, c);
  assert.equal(run(first.state, c).result.repeated, true);
  assert.equal(run(first.state, { ...c, id: "second-raid" }).result.ok, false);
  const next = run(first.state, { ...c, id: "after-cooldown", expectedDefense: 0, expectedRemaining: 15 }, { now: now + GAME_RULES.protectionMs });
  assert.equal(next.result.ok, true);
  assert.equal(next.result.loot, 4);
  assert.equal(next.state.players.mike.batch.remaining + next.state.players.alex.cash, 20, "cash is conserved");
});

test("empty raided batch can be cleared, and upgrade affects only future production", () => {
  let state = createDemoGame(now);
  state.players.mike.batch.remaining = 0;
  const cleared = run(state, command("collect", { playerId: "mike", batchId: "starter-batch" }));
  assert.equal(cleared.state.players.mike.batch, null);
  assert.equal(cleared.state.players.mike.cash, 50);
  state = createDemoGame(now);
  const upgraded = run(state, command("upgrade", { playerId: "mike", expectedLevel: 1 }));
  assert.equal(upgraded.state.players.mike.labLevel, 2);
  assert.equal(upgraded.state.players.mike.batch.output, 20);
  assert.equal(upgraded.state.players.mike.cash, 0);
  assert.equal(run(upgraded.state, command("upgrade", { playerId: "mike", expectedLevel: 2 })).result.ok, false);
});

test("practice clock advances both players without modifying real-world time", () => {
  const state = createDemoGame(now);
  const outcome = run(state, command("advance-time", { hours: 4 }));
  assert.equal(outcome.state.clockOffsetMs, 14400000);
  assert.equal(state.clockOffsetMs, 0);
  assert.equal(run(state, command("advance-time", { hours: -1 })).result.ok, false);
  assert.equal(run(state, command("advance-time", { hours: 1000 })).result.ok, false);
});

test("store touches one game key only, persists across reload, and serializes concurrent actions", async () => {
  const storage = storageFixture([["workoutDraft:real", "KEEP"], ["userId", "REAL"]]);
  let queued = Promise.resolve(), lockCalls = 0;
  const locks = { request: (_key, action) => { lockCalls++; const result = queued.then(action); queued = result.catch(() => {}); return result; } };
  const store = createDemoStore({ storage, locks, now: () => now, random: () => .9 });
  const saved = await store.transact(command("save-workout", { workout: workout() }));
  const started = await store.transact(command("start-batch"));
  assert.ok(started.result.ok);
  assert.ok(saved.result.ok);
  const before = store.load().players.alex.tickets;
  const raider = command("raid", { targetId: "mike", expectedDefense: 1, expectedRemaining: 20, batchId: "starter-batch" });
  const results = await Promise.all([store.transact(raider), store.transact({ ...raider, id: "concurrent-raid" })]);
  assert.equal(results.filter(r => r.result.ok).length, 1);
  const reload = createDemoStore({ storage, now: () => now, locks });
  assert.equal(reload.load().players.alex.tickets, before - 2);
  assert.equal(storage.values.get("userId"), "REAL");
  assert.equal(storage.values.get("workoutDraft:real"), "KEEP");
  assert.ok(storage.writes.every(key => key === DEMO_GAME_KEY));
  assert.equal(lockCalls, 4);
});

test("corrupt/unknown game snapshots are preserved until an explicit reset", async () => {
  for (const raw of ["broken", JSON.stringify({ version: 99 }), JSON.stringify({ ...createDemoGame(now), players: null })]) {
    const storage = storageFixture([[DEMO_GAME_KEY, raw]]);
    const store = createDemoStore({ storage, now: () => now });
    assert.throws(() => store.load());
    await assert.rejects(store.transact(command("start-batch")));
    assert.equal(storage.values.get(DEMO_GAME_KEY), raw);
    assert.equal(storage.writes.length, 0);
    assert.ok(validDemoGame(await store.reset()));
    assert.equal(storage.writes.length, 1);
  }
});

test("failed persistence never reports a successful drop or consumes the saved inventory", async () => {
  const storage = storageFixture([[DEMO_GAME_KEY, JSON.stringify(createDemoGame(now))]]);
  const before = storage.values.get(DEMO_GAME_KEY);
  storage.setItem = () => { throw new Error("quota"); };
  const store = createDemoStore({ storage, now: () => now });
  await assert.rejects(store.transact(command("save-workout", { workout: workout() })), /quota/);
  assert.equal(storage.values.get(DEMO_GAME_KEY), before);
});

test("invalid random source and malformed stored balances cannot introduce partial writes", () => {
  const state = createDemoGame(now);
  const outcome = run(state, command("save-workout", { workout: workout() }), { random: () => 2 });
  assert.equal(outcome.result.ok, false);
  assert.strictEqual(outcome.state, state);
  const broken = structuredClone(state); broken.players.alex.cash = -10;
  assert.equal(validDemoGame(broken), false);
  assert.equal(run(broken, command("start-batch")).result.ok, false);
});
