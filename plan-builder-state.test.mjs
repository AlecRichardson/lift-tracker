import assert from "node:assert/strict";
import test from "node:test";
import { addPlanDay, buildExerciseCatalog, duplicateDayName, movePlanExercise, pairPlanExercises,
  planDraft, removePlanExercise, renamePlanDay, restorePlanDrafts, updatePlanExercise } from "./plan-builder-state.mjs";

const exercise = (id, superset = "") => ({ id, name: id, sets: 3, target: "8-10", superset, lastAlias: ["Existing alias"] });
const original = { id: "plan", name: "Split", dayOrder: ["Pull A", "Push A"],
  workouts: { "Push A": [exercise("bench")], "Pull A": [exercise("row")] } };

test("plan drafts retain defined day ordering and do not mutate saved plans", () => {
  const draft = planDraft(original);
  draft.workouts["Push A"][0].name = "Edited";
  assert.deepEqual(draft.dayOrder, ["Pull A", "Push A"]);
  assert.equal(original.workouts["Push A"][0].name, "bench");
});

test("day duplication preserves prescriptions and IDs with independent editable exercises", () => {
  const draft = planDraft(original);
  const name = duplicateDayName(draft, "Push A");
  addPlanDay(draft, name, "Push A");
  draft.workouts[name][0].target = "12-15";
  assert.equal(draft.workouts[name][0].id, "bench");
  assert.equal(draft.workouts["Push A"][0].target, "8-10");
  assert.equal(duplicateDayName(draft, "Push A"), "Push A Copy 2");
});

test("renaming a day keeps position and exercise history identity", () => {
  const draft = planDraft(original);
  renamePlanDay(draft, "Pull A", "Row Day");
  assert.deepEqual(draft.dayOrder, ["Row Day", "Push A"]);
  assert.equal(draft.workouts["Row Day"][0].id, "row");
  assert.equal(draft.workouts["Pull A"], undefined);
});

test("day names reject collisions, blank names, and prototype keys", () => {
  for (const name of ["Push A", "", "__proto__", "constructor"]) assert.throws(() => addPlanDay(planDraft(original), name));
  assert.throws(() => renamePlanDay(planDraft(original), "Push A", "Pull A"));
});

test("editing exercise name or prescription never changes its ID or aliases", () => {
  const entry = exercise("bench");
  updatePlanExercise(entry, "name", "My Bench Press");
  updatePlanExercise(entry, "sets", "");
  updatePlanExercise(entry, "id", "new-id");
  assert.equal(entry.id, "bench");
  assert.equal(entry.name, "My Bench Press");
  assert.equal(entry.sets, "");
  assert.deepEqual(entry.lastAlias, ["Existing alias"]);
});

test("superset linking uses partner identity, joins groups, and keeps members adjacent", () => {
  const list = [exercise("a"), exercise("between"), exercise("b")];
  const index = pairPlanExercises(list, 2, 0);
  assert.equal(index, 1);
  assert.deepEqual(list.map(ex => ex.id), ["a", "b", "between"]);
  assert.equal(list[0].superset, list[1].superset);
  pairPlanExercises(list, 2, 0);
  assert.equal(list.filter(ex => ex.superset === list[0].superset).length, 3);
});

test("removing or unlinking a partner clears orphaned superset labels", () => {
  const list = [exercise("a", "A"), exercise("b", "A")];
  removePlanExercise(list, 0);
  assert.equal(list[0].superset, "");
  const pair = [exercise("a", "A"), exercise("b", "A")];
  pairPlanExercises(pair, 0, null);
  assert.deepEqual(pair.map(ex => ex.superset), ["", ""]);
});

test("reordering moves a superset as a unit without losing or duplicating exercises", () => {
  const list = [exercise("first"), exercise("a", "A"), exercise("b", "A"), exercise("last")];
  movePlanExercise(list, 2, -1);
  assert.deepEqual(list.map(ex => ex.id), ["a", "b", "first", "last"]);
  movePlanExercise(list, 0, 1);
  assert.deepEqual(list.map(ex => ex.id), ["first", "a", "b", "last"]);
});

test("legacy noncontiguous supersets reorder without deleting unrelated exercises", () => {
  const list = [exercise("a", "A"), exercise("middle"), exercise("b", "A"), exercise("last")];
  movePlanExercise(list, 0, 1);
  assert.deepEqual(list.map(ex => ex.id), ["middle", "a", "b", "last"]);
});

test("catalog includes performed swaps but keeps different equipment identities separate", () => {
  const machine = { ...exercise("machine_rear_delt_fly"), name: "Machine Rear Delt Fly", equipment: "machine" };
  const catalog = buildExerciseCatalog([{ workouts: { Pull: [machine] } }], [{ t: "2026-11-15", e: [
    { id: machine.id, n: "Dumbbell Rear Delt Fly", swapped: true, s: [{ reps: 15, weight: 15 }] }
  ] }]);
  assert.equal(catalog.length, 2);
  assert.equal(catalog.find(ex => ex.equipment === "machine").id, machine.id);
  assert.equal(catalog.find(ex => ex.equipment === "dumbbell").id, "dumbbell_rear_delt_fly");
});

test("legacy conflicting equipment IDs do not contaminate the exercise picker", () => {
  const machine = { ...exercise("rear_fly"), name: "Machine Rear Delt Fly", equipment: "machine" };
  const catalog = buildExerciseCatalog([{ workouts: { Pull: [machine] } }], [{ e: [{ id: "rear_fly", n: "DB Rear Delt Fly" }] }]);
  assert.equal(catalog.find(ex => ex.equipment === "dumbbell").id, "dumbbell_rear_delt_fly");
});

test("catalog deduplicates shared exercises and DB aliases without copying logged weights or notes", () => {
  const entry = { ...exercise("incline"), name: "Incline Dumbbell Press", equipment: "dumbbell" };
  const catalog = buildExerciseCatalog([{ workouts: { A: [entry], B: [{ ...entry, name: "Incline DB Press" }] } }],
    [{ e: [{ id: "incline", n: "Incline DB Press", note: "Private session note", s: [{ weight: 155 }] }] }]);
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].weight, undefined);
  assert.equal(catalog[0].note, "");
});

test("draft recovery retains incomplete edits while rejecting corrupt or unsafe records", () => {
  const draft = planDraft(original);
  draft.workouts["Push A"][0].name = "";
  draft.workouts["Push A"][0].sets = "";
  const restored = restorePlanDrafts(JSON.stringify({ version: 1, drafts: [draft, { id: "bad" }] }));
  assert.equal(restored.length, 1);
  assert.equal(restored[0].workouts["Push A"][0].sets, "");
  assert.deepEqual(restorePlanDrafts("bad content"), []);
});
