import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { createPlanFile, createPlanTemplate, parsePlanFile } from "./plan-files.mjs";
import { getBestPreviousExerciseContext } from "./history-context.mjs";

const fixture = vm.createContext({ window: {} });
vm.runInContext(await readFile(new URL("./workouts.js", import.meta.url), "utf8"), fixture);
const workouts = JSON.parse(JSON.stringify(fixture.window.workouts));
const original = { name: "My Split", workouts, dayOrder: Object.keys(workouts).reverse() };

test("whole-plan round trip preserves ordered days, exercise identities, aliases, and details", () => {
  const before = JSON.stringify(original);
  const imported = parsePlanFile(JSON.stringify(createPlanFile(original)));
  assert.deepEqual(imported.dayOrder, original.dayOrder);
  for (const day of original.dayOrder) assert.deepEqual(imported.workouts[day], original.workouts[day]);
  assert.equal(JSON.stringify(original), before);
});

test("standalone starter template has six valid editable days", () => {
  const plan = parsePlanFile(JSON.stringify(createPlanTemplate()));
  assert.equal(plan.dayOrder.length, 6);
  assert.equal(plan.name, "New Plan");
});

test("complete workout export provides its active plan without importing history", () => {
  const result = parsePlanFile(JSON.stringify({ app: "Lift Tracker", activePlan: original, workoutLogs: [{ id: "private-history" }] }));
  assert.equal(result.name, original.name);
  assert.equal(result.workoutLogs, undefined);
});

test("imports ignore file-provided account and plan document identities", () => {
  const result = parsePlanFile(JSON.stringify({ ...createPlanTemplate(), id: "current_plan", userId: "other-user" }));
  assert.equal(result.id, undefined);
  assert.equal(result.userId, undefined);
});

test("new plan bench exercise still retrieves existing exercise history", () => {
  const plan = parsePlanFile(JSON.stringify(createPlanFile(original)));
  const exercise = plan.workouts["Push A"][0];
  const logs = [{ id: "old-log", d: "Old Bench Day", gym: "Ultimate", t: "2026-11-01T12:00:00Z",
    planId: "old-plan", e: [{ id: exercise.id, n: exercise.name, s: [{ reps: 10, weight: 155 }] }] }];
  const before = JSON.stringify(logs);
  const result = getBestPreviousExerciseContext({ logs, exerciseId: exercise.id, exerciseName: exercise.name,
    equipment: exercise.equipment, workoutDay: "New Bench Day", selectedGym: "Ultimate" });
  assert.equal(result.selectedExercise.s[0].weight, 155);
  assert.equal(JSON.stringify(logs), before);
});

test("missing exercise IDs are generated but existing IDs are never replaced", () => {
  const file = createPlanTemplate();
  delete file.workouts["Push A"][0].id;
  const plan = parsePlanFile(JSON.stringify(file));
  assert.equal(plan.workouts["Push A"][0].id, "barbell_bench_press");
  assert.equal(plan.workouts["Push B"][0].id, "incline_dumbbell_press");
});

test("malformed, unsupported, oversized, or dangerous files are rejected", () => {
  for (const text of ["not a plan", "null", '[]', JSON.stringify({ ...createPlanTemplate(), version: 99 }),
    JSON.stringify({ name: "Bad", workouts: JSON.parse('{"__proto__":[]}') }), " ".repeat(512 * 1024 + 1)]) {
    assert.throws(() => parsePlanFile(text));
  }
});

test("invalid day order, empty exercises, invalid sets, and non-text aliases are rejected", () => {
  for (const mutate of [
    plan => { plan.dayOrder[1] = plan.dayOrder[0]; },
    plan => { plan.workouts["Push A"] = []; },
    plan => { plan.workouts["Push A"][0].sets = 2.5; },
    plan => { plan.workouts["Push A"][0].lastAlias = [{}]; },
    plan => { plan.workouts["Push A"][0].note = {}; }
  ]) {
    const plan = createPlanTemplate();
    mutate(plan);
    assert.throws(() => parsePlanFile(JSON.stringify(plan)));
  }
});
