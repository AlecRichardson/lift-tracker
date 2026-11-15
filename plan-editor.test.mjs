import assert from "node:assert/strict";
import test from "node:test";
import { PlanBuilder } from "./plan-builder.mjs";

const base = { id: "active-plan", name: "Current Split", dayOrder: ["Push A"], workouts: {
  "Push A": [{ id: "bench", name: "Bench Press", sets: 4, target: "6-10", rest: "2 min",
    equipment: "barbell", type: "compound", superset: "", note: "", lastAlias: ["Barbell Bench Press"] }]
} };

function fixture({ storage = new Map(), failSave = false, userId = "owner" } = {}) {
  const fields = new Map();
  const root = { innerHTML: "", classList: { toggle() {} }, addEventListener() {},
    querySelector: selector => fields.get(selector) || null, querySelectorAll: () => [] };
  let active = structuredClone(base);
  const saved = [];
  const builder = new PlanBuilder({ root, userId,
    storage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    getActivePlan: () => active, starterPlans: [base], getPlans: async () => [active], getHistory: async () => [],
    savePlan: async plan => { if (failSave) throw new Error("Offline"); saved.push(structuredClone(plan)); return plan; },
    activatePlan: async id => { active = { ...builder.plans.get(id), id }; },
    scrollTop() {}, exportFile() {}, requestImport() {}
  });
  builder.open(base.id);
  return { builder, root, fields, storage, saved };
}

const editName = (builder, value) => builder.input({ target: { dataset: { exField: "name", index: "0" }, value, closest: () => null } });

test("exercise name edits immediately update the draft without changing ID or aliases", () => {
  const { builder, root } = fixture();
  editName(builder, "Bench Press Renamed");
  assert.equal(builder.plan.workouts["Push A"][0].name, "Bench Press Renamed");
  assert.equal(builder.plan.workouts["Push A"][0].id, "bench");
  assert.deepEqual(builder.plan.workouts["Push A"][0].lastAlias, ["Barbell Bench Press", "Bench Press"]);
  assert.equal(base.workouts["Push A"][0].name, "Bench Press");
  builder.day = "Push A"; builder.view = "day"; builder.edit = 0; builder.render();
  assert.match(root.innerHTML, /Exercise name/);
  assert.match(root.innerHTML, /Bench Press Renamed/);
  assert.doesNotMatch(root.innerHTML, /Save Exercise/);
});

test("unfinished edits survive navigation and recovery, including incomplete fields", async () => {
  const { builder, storage } = fixture();
  editName(builder, "");
  builder.input({ target: { dataset: { exField: "sets", index: "0" }, value: "", closest: () => null } });
  await builder.act("library");
  const recovered = fixture({ storage }).builder;
  assert.equal(recovered.plan.workouts["Push A"][0].name, "");
  assert.equal(recovered.plan.workouts["Push A"][0].sets, "");
  assert.equal(recovered.dirty, true);
  const otherAccount = fixture({ storage, userId: "another-account" }).builder;
  assert.equal(otherAccount.dirty, false);
});

test("one Save Changes commits the exercise form and clears only that plan's draft", async () => {
  const { builder, saved, storage } = fixture();
  editName(builder, "Updated Bench");
  builder.drafts.set("another", { ...structuredClone(base), id: "another" });
  await builder.save();
  assert.equal(saved[0].workouts["Push A"][0].name, "Updated Bench");
  assert.equal(saved[0].workouts["Push A"][0].id, "bench");
  assert.equal(builder.dirty, false);
  assert.equal(builder.drafts.has("another"), true);
  assert.equal(JSON.parse(storage.get(builder.key)).drafts.length, 1);
});

test("failed saves preserve draft identity and retry edits never duplicate exercises", async () => {
  const { builder, storage } = fixture({ failSave: true });
  editName(builder, "First Edit");
  await builder.save();
  assert.equal(builder.dirty, true);
  assert.match(builder.message, /draft is still available/);
  editName(builder, "Second Edit");
  const recovered = fixture({ storage }).builder;
  assert.equal(recovered.plan.workouts["Push A"].length, 1);
  assert.equal(recovered.plan.workouts["Push A"][0].name, "Second Edit");
});

test("invalid exercise fields do not reach saved storage", async () => {
  const { builder, saved } = fixture();
  editName(builder, "");
  await builder.save();
  assert.equal(saved.length, 0);
  assert.equal(builder.dirty, true);
  assert.equal(builder.error, true);
});

test("create new plan and add a day without changing or activating the original", async () => {
  const { builder, fields, saved } = fixture();
  fields.set("#pb-new-name", { value: "New Split" });
  await builder.act("create");
  const newId = builder.id;
  assert.notEqual(newId, base.id);
  assert.equal(builder.plan.dayOrder.length, 0);
  fields.set("#pb-day-name", { value: "Legs A" });
  await builder.act("add-day");
  assert.equal(builder.day, "Legs A");
  assert.equal(builder.view, "day");
  assert.deepEqual(builder.plans.get(base.id).dayOrder, ["Push A"]);
  assert.equal(saved.length, 0);
  await builder.act("activate");
  assert.equal(builder.options.getActivePlan().id, base.id);
  assert.match(builder.message, /Save Changes/);
});

test("exercise picker supports selecting several and preserves shared history IDs", async () => {
  const { builder } = fixture();
  await builder.refresh();
  builder.day = "Push A";
  builder.setCatalog([{ ...base.workouts["Push A"][0], id: "incline", name: "Incline Press" },
    { ...base.workouts["Push A"][0], id: "row", name: "Barbell Row" }]);
  builder.selected = new Set([0, 1]);
  await builder.act("add-selected");
  assert.deepEqual(builder.list.map(ex => ex.id), ["bench", "incline", "row"]);
});

test("catalog refresh cannot change the meaning of a selected exercise", () => {
  const { builder } = fixture();
  const first = { ...base.workouts["Push A"][0], name: "Bench Press", id: "bench" };
  const second = { ...first, name: "Row", id: "row" };
  builder.setCatalog([first, second]);
  builder.selected.add(1);
  builder.setCatalog([second, first]);
  assert.deepEqual([...builder.selected], [0]);
  assert.equal(builder.catalog[[...builder.selected][0]].id, "row");
});

test("replacing an exercise changes identity without mutating the original saved plan", async () => {
  const { builder } = fixture();
  builder.day = "Push A";
  builder.replaceIndex = 0;
  builder.setCatalog([{ ...base.workouts["Push A"][0], id: "dumbbell_press", name: "Dumbbell Press", equipment: "dumbbell" }]);
  builder.selected.add(0);
  await builder.act("add-selected");
  assert.equal(builder.list[0].id, "dumbbell_press");
  assert.equal(builder.plans.get(base.id).workouts["Push A"][0].id, "bench");
});

test("local draft storage failure is visible and does not erase the working draft", () => {
  const { builder } = fixture();
  builder.storage.setItem = () => { throw new Error("Quota"); };
  editName(builder, "Unsaved Bench");
  assert.equal(builder.storageError, true);
  assert.equal(builder.dirty, true);
  assert.equal(builder.plan.workouts["Push A"][0].name, "Unsaved Bench");
});

test("editing and saving an inactive plan does not activate it or change the active plan", async () => {
  const { builder, saved } = fixture();
  const inactive = { ...structuredClone(base), id: "inactive", name: "Old Split" };
  builder.plans.set(inactive.id, inactive);
  builder.open(inactive.id);
  editName(builder, "Inactive Bench");
  await builder.save();
  assert.equal(saved[0].id, "inactive");
  assert.equal(builder.options.getActivePlan().id, base.id);
  assert.equal(builder.options.getActivePlan().workouts["Push A"][0].name, "Bench Press");
});

test("switching to another saved plan preserves unfinished edits in the previous plan", async () => {
  const { builder } = fixture();
  editName(builder, "Unfinished Bench");
  const inactive = { ...structuredClone(base), id: "inactive", name: "Old Split" };
  builder.plans.set(inactive.id, inactive);
  builder.open(inactive.id);
  await builder.act("activate");
  assert.equal(builder.options.getActivePlan().id, "inactive");
  assert.equal(builder.drafts.get(base.id).workouts["Push A"][0].name, "Unfinished Bench");
});

test("unsafe exercise text is escaped in editor markup", () => {
  const { builder, root } = fixture();
  editName(builder, '<img src=x onerror="alert(1)">');
  builder.day = "Push A"; builder.view = "day"; builder.edit = 0; builder.render();
  assert.doesNotMatch(root.innerHTML, /<img src/);
  assert.match(root.innerHTML, /&lt;img/);
});

test("an unfinished-workout save guard leaves plan edits recoverable with actionable feedback", async () => {
  const { builder, storage } = fixture();
  editName(builder, "Edited Bench");
  builder.options.savePlan = async () => { const error = new Error("Blocked"); error.code = "workout-in-progress"; throw error; };
  await builder.save();
  assert.equal(builder.dirty, true);
  assert.match(builder.message, /Finish or discard your current workout/);
  assert.equal(fixture({ storage }).builder.plan.workouts["Push A"][0].name, "Edited Bench");
});

test("renaming remembers the original name once, not intermediate keystrokes", () => {
  const { builder } = fixture();
  const input = { dataset: { exField: "name", index: "0" }, value: "Bench P", closest: () => null };
  builder.input({ target: input });
  input.value = "Bench Press New Name";
  builder.input({ target: input });
  assert.deepEqual(builder.plan.workouts["Push A"][0].lastAlias, ["Barbell Bench Press", "Bench Press"]);
  assert.equal(builder.plan.workouts["Push A"][0].id, "bench");
});

test("import staging keeps a recoverable draft before any cloud acknowledgement", () => {
  const { builder, storage, saved } = fixture();
  builder.stageImport({ ...structuredClone(base), id: "imported", name: "Imported" });
  assert.equal(builder.dirty, true);
  assert.equal(builder.id, "imported");
  assert.equal(saved.length, 0);
  assert.equal(fixture({ storage }).builder.drafts.get("imported").name, "Imported");
  assert.equal(builder.options.getActivePlan().id, base.id);
});

test("confirmed import clears an unchanged draft and retains its saved plan", () => {
  const { builder } = fixture();
  const plan = { ...structuredClone(base), id: "imported", name: "Imported", updatedAt: "2026-11-15T12:00:00Z" };
  builder.stageImport(plan);
  builder.completeImport(plan);
  assert.equal(builder.dirty, false);
  assert.equal(builder.plans.get("imported").name, "Imported");
});

test("late import confirmation never erases subsequent draft edits", () => {
  const { builder, storage } = fixture();
  const plan = { ...structuredClone(base), id: "imported", name: "Imported", updatedAt: "2026-11-15T12:00:00Z" };
  builder.stageImport(plan);
  editName(builder, "Edited after closing preview");
  builder.completeImport(plan);
  assert.equal(builder.dirty, true);
  assert.equal(builder.plan.workouts["Push A"][0].name, "Edited after closing preview");
  assert.equal(fixture({ storage }).builder.drafts.get("imported").workouts["Push A"][0].name, "Edited after closing preview");
});

test("older import acknowledgement cannot roll back a newer successful save", () => {
  const { builder } = fixture();
  const plan = { ...structuredClone(base), id: "imported", name: "Imported", updatedAt: "2026-11-15T12:00:00Z" };
  builder.plans.set(plan.id, { ...plan, name: "Newer saved name", updatedAt: "2026-11-15T13:00:00Z" });
  builder.completeImport(plan);
  assert.equal(builder.plans.get(plan.id).name, "Newer saved name");
});
