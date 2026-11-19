import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { getSessionExercises, workoutDraftKey } from "./workout-state.mjs";

const source = await readFile(new URL("./app.js", import.meta.url), "utf8");

test("extra exercise survives the actual draft and workout save paths without editing the plan", async () => {
  const template = { id: "shrugs", name: "Shrugs", sets: 1, sessionKey: "extra-a", target: "Any reps", rest: "" };
  const button = { dataset: { done: "true" } };
  const row = { querySelector: selector => selector.includes("reps") ? { value: "15", dataset: { edited: "true" } }
    : selector.includes("weight") ? { value: "60", dataset: { edited: "true" } } : button };
  const card = {
    dataset: { exerciseKey: "shrugs", exerciseInstanceKey: "extra-a", exerciseName: "Shrugs",
      plannedExerciseId: "shrugs", plannedExerciseName: "Shrugs", plannedIndex: "-1", sessionTemplate: JSON.stringify(template) },
    querySelector: () => ({ value: "Extra today" }),
    querySelectorAll: () => [row]
  };
  const plan = { id: "plan-a", name: "My plan", workouts: { Optional: [{ name: "Calf Raise", sets: 2 }] } };
  const before = JSON.stringify(plan);
  let draft, saved, handler, cleared = false, page;
  const saveButton = { addEventListener: (_, callback) => { handler = callback; } };
  const context = vm.createContext({
    userId: "test-user", selectedGym: "Gym A", currentDay: "Optional", activePlan: plan,
    workoutDraftKey, activeRestTimers: new Map([[button, { endsAt: 123456 }]]),
    localStorage: { setItem: (_, value) => { draft = JSON.parse(value); } },
    updateWorkoutCompletion() {}, clearDraft() { cleared = true; }, stopAllRestTimers() {},
    userWorkoutsCollection: () => "workouts", addDoc: async (_, value) => { saved = value; },
    renderHome: async () => {}, showPage: value => { page = value; }, pageSubtitle: {},
    exerciseSlug: name => name.toLowerCase(), titleCaseExerciseName: value => value,
    document: { querySelectorAll: () => [card], getElementById: id => id === "saveWorkout" ? saveButton : null },
    setTimeout() {}, console
  });
  vm.runInContext(source.slice(source.indexOf("  function currentDraftKey("),
    source.indexOf("  function updateWorkoutCompletion(")), context);
  context.saveDraft("Optional");
  assert.equal(getSessionExercises(draft)[0].sessionKey, "extra-a");
  assert.equal(draft.exercises["extra-a"].sets[0].restEndsAt, 123456);
  assert.equal(draft.exercises["extra-a"].sets[0].weight, "60");

  const start = source.indexOf('  document.getElementById("saveWorkout")?.addEventListener');
  vm.runInContext(source.slice(start, source.indexOf("  /* =====================================================", start)), context);
  await handler();
  assert.equal(saved.e[0].n, "Shrugs");
  assert.equal(saved.e[0].sessionOnly, true);
  assert.equal(saved.e[0].swapped, false);
  assert.equal(saved.e[0].s[0].weight, 60);
  assert.equal(saved.e[0].s[0].reps, 15);
  assert.equal(saved.e[0].s[0].done, true);
  assert.equal(saved.e[0].note, "Extra today");
  assert.equal(cleared, true);
  assert.equal(page, "homePage");
  assert.equal(JSON.stringify(plan), before);
});
