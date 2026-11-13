import assert from "node:assert/strict";
import test from "node:test";
import { claimLegacyWorkoutDraft, getSetPrefill, isMatchingWorkoutDraft, workoutDraftKey } from "./workout-state.mjs";

test("changing gym refreshes untouched prefill but preserves typed fields", () => {
  const next = getSetPrefill({ reps: 12, weight: 70 }, {
    reps: "9", weight: "120", editedReps: true, editedWeight: false, done: false
  });
  assert.equal(next.reps, "9");
  assert.equal(next.weight, 70);
});

test("completed set values survive gym/setup changes", () => {
  const next = getSetPrefill({ reps: 12, weight: 70 }, { reps: "10", weight: "120", done: true });
  assert.equal(next.reps, "10");
  assert.equal(next.weight, "120");
  assert.equal(next.done, true);
});

test("no compatible history clears suggestions while preserving deliberate blank and zero", () => {
  assert.equal(getSetPrefill(null, { reps: "10", weight: "120" }).weight, "");
  const next = getSetPrefill({ reps: 12, weight: 70 }, {
    reps: "", weight: 0, editedReps: true, editedWeight: true
  });
  assert.equal(next.reps, "");
  assert.equal(next.weight, 0);
});

test("history does not pre-check completed sets or permanently pin previous suggestions", () => {
  const next = getSetPrefill({ reps: 12, weight: 70, done: true }, { reps: 10, weight: 120 });
  assert.equal(next.done, false);
  assert.equal(next.weight, 70);
});

test("draft restore requires the same account, plan, day and an explicit session gym", () => {
  const identity = { userId: "alec", planId: "plan-a", day: "Pull A" };
  const draft = { ...identity, gym: "Gym B" };
  assert.equal(isMatchingWorkoutDraft(draft, identity), true);
  for (const key of ["userId", "planId", "day"]) {
    assert.equal(isMatchingWorkoutDraft({ ...draft, [key]: "other" }, identity), false);
    assert.notEqual(workoutDraftKey(identity.userId, identity.planId, identity.day),
      workoutDraftKey(...["userId", "planId", "day"].map(field => field === key ? "other" : identity[field])));
  }
  assert.equal(isMatchingWorkoutDraft({ planId: "plan-a", day: "Pull A" }, identity), false);
  assert.equal(isMatchingWorkoutDraft({ ...identity }, identity), false);
  assert.equal(isMatchingWorkoutDraft({ ...identity, gym: "" }, identity), true);
});

test("explicit legacy recovery keeps entered values and leaves the original draft unchanged", () => {
  const legacy = { planId: "plan-a", day: "Pull A", exercises: {
    curl: [{ reps: "", weight: "0", done: false }],
    row: { actualName: "DB Row", note: "Slow reps", pulley: "", sets: [{ reps: "10", weight: "55", done: true }] }
  } };
  const before = JSON.stringify(legacy);
  const identity = { userId: "alec", planId: "plan-a", day: "Pull A", gym: "Gym B" };
  const restored = claimLegacyWorkoutDraft(legacy, identity);
  assert.equal(isMatchingWorkoutDraft(restored, identity), true);
  assert.equal(restored.gym, "Gym B");
  assert.equal(restored.exercises.row.actualName, "DB Row");
  assert.equal(restored.exercises.row.note, "Slow reps");
  assert.equal(getSetPrefill({ reps: 15, weight: 70 }, restored.exercises.curl.sets[0]).reps, "");
  assert.equal(getSetPrefill(null, restored.exercises.row.sets[0]).weight, "55");
  assert.equal(JSON.stringify(legacy), before);
  assert.equal(claimLegacyWorkoutDraft(legacy, { ...identity, day: "Push A" }), null);
});
