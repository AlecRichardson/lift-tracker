import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("./app.js", import.meta.url), "utf8");
const handlers = source.slice(source.indexOf("  function buildWorkoutDataExport("),
  source.indexOf("  function downloadJsonFile("));
const context = vm.createContext({
  displayName: "Test", usernameKey: "test", selectedGym: "Test Gym", gymOptions: ["Test Gym"],
  activePlan: null, workoutDays: [], workouts: {},
  normalizeGymOptions: values => values, deepClone: value => structuredClone(value),
  workoutVolume: () => 0, countWorkingSets: () => 0,
  getProgressExerciseKey: exercise => exercise.id, getProgressExerciseLabel: exercise => exercise.n,
  bestSetText: () => "", calculateMetric: () => 0
});
vm.runInContext(handlers, context);

test("export all preserves 1000 workouts and every exercise and set without mutating history", () => {
  const logs = Array.from({ length: 1000 }, (_, index) => ({
    id: String(index), d: "Push A", gym: "Test Gym",
    t: new Date(Date.UTC(2023, 0, index + 1)).toISOString(),
    e: Array.from({ length: 6 }, (_, exercise) => ({
      id: `exercise_${exercise}`, n: `Exercise ${exercise}`,
      s: Array.from({ length: 4 }, () => ({ reps: 10, weight: 155, done: true }))
    }))
  })).reverse();
  const before = JSON.stringify(logs);
  const result = context.buildWorkoutDataExport(logs);
  assert.equal(result.exportScope.range, "all");
  assert.equal(result.exportScope.workoutLimit, null);
  assert.equal(result.workoutLogs.length, 1000);
  assert.equal(result.workoutLogs[0].id, "0");
  assert.equal(result.workoutLogs[999].id, "999");
  assert.equal(result.workoutLogs.flatMap(log => log.e).flatMap(exercise => exercise.s).length, 24000);
  assert.equal(result.analysis.exerciseTimelines.length, 6);
  assert.equal(result.analysis.exerciseTimelines[0].sessions.length, 1000);
  assert.equal(JSON.stringify(logs), before);
});

test("export all handles empty accounts", () => {
  const result = context.buildWorkoutDataExport([]);
  assert.equal(result.exportScope.includedWorkouts, 0);
  assert.equal(result.workoutLogs.length, 0);
});
