import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("./app.js", import.meta.url), "utf8");
const handler = source.slice(source.indexOf("  function applySwapSelection({"),
  source.indexOf("  function updateRecommendationDisplay("));

function swap({ completed = true, accept = true, same = false } = {}) {
  const button = {
    dataset: { done: String(completed), setNumber: "1" },
    setAttribute(key, value) { this[key] = value; },
    closest: () => ({ classList: { remove() {} } })
  };
  const input = { value: "New Exercise" };
  const card = {
    dataset: { plannedIndex: "0", exerciseName: "Old Exercise" },
    querySelector: selector => selector === '.setNumber[data-done="true"]' ? (completed ? button : null)
      : selector === ".swapInput" ? input : null,
    querySelectorAll: selector => selector === ".setNumber" ? [button] : []
  };
  const calls = { prompts: 0, stopped: 0, lookup: 0, prefill: null };
  const context = vm.createContext({
    exerciseSlug: name => name.toLowerCase(),
    confirm: () => { calls.prompts++; return accept; },
    stopRestTimer: () => { calls.stopped++; },
    updateWorkoutCompletion: () => {},
    refreshWeightFillButtons: () => {},
    getPreviousExerciseContext: () => { calls.lookup++; return {}; },
    isCableExercise: () => false,
    updateSwapVisualState: () => {}, updatePreviousExerciseDisplay: () => {},
    updateRecommendationDisplay: () => {}, getExerciseRecommendation: () => ({}),
    getRecommendationWithContext: () => ({}),
    applyPreviousSetsToInputs: (_card, _exercise, options) => { calls.prefill = options; }
  });
  vm.runInContext(handler, context);
  context.applySwapSelection({ card, exercise: { name: "Old Exercise" }, logs: [],
    nextName: same ? "Old Exercise" : "New Exercise", overwriteSets: true, clearWhenMissing: true });
  return { button, input, calls };
}

test("cancelling a completed-exercise swap preserves values and completion", () => {
  const { button, input, calls } = swap({ accept: false });
  assert.equal(input.value, "Old Exercise");
  assert.equal(button.dataset.done, "true");
  assert.equal(calls.lookup, 0);
  assert.equal(calls.prefill, null);
});

test("confirmed replacement resets completion and stops its old rest timer", () => {
  const { button, calls } = swap();
  assert.equal(calls.prompts, 1);
  assert.equal(calls.stopped, 1);
  assert.equal(button.dataset.done, "false");
  assert.equal(button["aria-pressed"], "false");
  assert.equal(button.textContent, "1");
  assert.equal(calls.prefill.preserveEdited, false);
});

test("reselecting the same exercise preserves edited sets without a prompt", () => {
  const { button, calls } = swap({ same: true });
  assert.equal(calls.prompts, 0);
  assert.equal(button.dataset.done, "true");
  assert.equal(calls.prefill.preserveEdited, true);
});

test("swapping an untouched exercise does not prompt", () => {
  assert.equal(swap({ completed: false }).calls.prompts, 0);
});
