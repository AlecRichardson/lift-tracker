import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("./app.js", import.meta.url), "utf8");
// Exercise the actual editor handlers without starting authentication or the app.
const handlers = source.slice(source.indexOf("  function keepPendingExerciseEdit()"),
  source.indexOf("  async function saveBuilderPlan()"));
const saveButtonHandler = source.slice(source.indexOf("  function updateBuilderSaveButtons()"),
  source.indexOf("  function moveBuilderDay("));

function editor({ dirty = true, editing = true, values = {} } = {}) {
  const fields = {
    exerciseNameInput: "Bench Press", exerciseSetsInput: "4", exerciseTargetInput: "6-10",
    exerciseRestInput: "2 min", exerciseSupersetInput: "", exerciseTypeInput: "compound",
    exerciseEquipmentInput: "barbell", exerciseNoteInput: "Controlled reps", ...values
  };
  const elements = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, {
    value, focus() { this.focused = true; }
  }]));
  elements.savePlanBottomBtn = {};
  elements.builderDockStatus = {};
  const context = vm.createContext({
    document: { getElementById: id => elements[id] || null },
    exerciseFormDirty: dirty, builderDirty: false, selectedBuilderDay: "Push A",
    editingExerciseIndex: editing ? 0 : null,
    builderWorkouts: { "Push A": [{ id: "bench", name: "Old bench", sets: 4, lastAlias: ["Bench"] }] },
    markBuilderDirty() { context.builderDirty = true; },
    renderPlanPage() { context.renders = (context.renders || 0) + 1; },
    showBuilderMessage(message) { context.message = message; },
    createUniqueExerciseId: () => "new_exercise"
  });
  vm.runInContext(handlers + saveButtonHandler, context);
  return { context, elements };
}

test("switching days retains a valid pending exercise without changing its identity", () => {
  const { context } = editor();
  assert.equal(context.keepPendingExerciseEdit(), true);
  const exercise = context.builderWorkouts["Push A"][0];
  assert.equal(exercise.name, "Bench Press");
  assert.equal(exercise.id, "bench");
  assert.equal(exercise.lastAlias[0], "Bench");
  assert.equal(context.exerciseFormDirty, false);
  assert.equal(context.builderDirty, true);
  assert.equal(context.renders, undefined);
});

test("retaining a new exercise twice does not duplicate it", () => {
  const { context } = editor({ editing: false });
  assert.equal(context.keepPendingExerciseEdit(), true);
  assert.equal(context.keepPendingExerciseEdit(), true);
  assert.equal(context.builderWorkouts["Push A"].length, 2);
});

test("editing again after an unsuccessful plan save updates the same exercise", () => {
  const { context, elements } = editor({ editing: false });
  context.keepPendingExerciseEdit();
  elements.exerciseNameInput.value = "Bench Press Updated";
  context.exerciseFormDirty = true;
  context.keepPendingExerciseEdit();
  assert.equal(context.builderWorkouts["Push A"].length, 2);
  assert.equal(context.builderWorkouts["Push A"][1].name, "Bench Press Updated");
});

test("invalid pending edits block switching and focus the field without losing the edit", () => {
  for (const [field, value] of Object.entries({ exerciseNameInput: "", exerciseSetsInput: "0", exerciseTargetInput: "" })) {
    const { context, elements } = editor({ values: { [field]: value } });
    assert.equal(Boolean(context.keepPendingExerciseEdit()), false);
    assert.equal(elements[field].focused, true);
    assert.equal(context.exerciseFormDirty, true);
    assert.equal(context.builderWorkouts["Push A"][0].name, "Old bench");
  }
});

test("Save Changes enables for pending exercise fields and remains enabled until the plan is saved", () => {
  const { context, elements } = editor();
  context.updateBuilderSaveButtons();
  assert.equal(elements.savePlanBottomBtn.disabled, false);
  assert.equal(elements.builderDockStatus.textContent, "Exercise changes not saved");
  context.keepPendingExerciseEdit();
  context.updateBuilderSaveButtons();
  assert.equal(elements.savePlanBottomBtn.disabled, false);
  context.builderDirty = false;
  context.updateBuilderSaveButtons();
  assert.equal(elements.savePlanBottomBtn.disabled, true);
  assert.equal(elements.builderDockStatus.textContent, "All changes saved");
});
