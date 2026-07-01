import assert from "node:assert/strict";
import test from "node:test";
import { getExerciseRecommendation } from "./recommendations.mjs";

function previousExercise(reps, weight = 155, note = "") {
  return {
    note,
    s: reps.map(rep => ({
      reps: rep,
      weight,
      done: true
    }))
  };
}

const bench = {
  name: "Bench Press",
  target: "6-10",
  type: "compound",
  note: ""
};

const lateralRaise = {
  name: "Dumbbell Lateral Raise",
  target: "12-15",
  type: "accessory",
  note: ""
};

const rearDeltFly = {
  name: "Rear Delt Fly",
  target: "12-15",
  type: "accessory",
  note: ""
};

test("bench 10/10/10/7 repeats instead of increasing", () => {
  const tip = getExerciseRecommendation(bench, previousExercise([10, 10, 10, 7]));

  assert.equal(tip.label, "Repeat weight");
  assert.match(tip.action, /final set reaches 8-10 clean reps/i);
});

test("bench 10/10/10/10 increases", () => {
  const tip = getExerciseRecommendation(bench, previousExercise([10, 10, 10, 10]));

  assert.equal(tip.label, "Increase weight");
});

test("bench 10/10/10/9 is almost ready, not an automatic increase", () => {
  const tip = getExerciseRecommendation(bench, previousExercise([10, 10, 10, 9]));

  assert.equal(tip.label, "Almost ready");
  assert.match(tip.action, /repeat once/i);
});

test("lateral raise 15/15/10 repeats", () => {
  const tip = getExerciseRecommendation(lateralRaise, previousExercise([15, 15, 10], 15));

  assert.equal(tip.label, "Repeat or reduce");
});

test("rear delt fly 15/15/15 clean increases", () => {
  const tip = getExerciseRecommendation(rearDeltFly, previousExercise([15, 15, 15], 15));

  assert.equal(tip.label, "Increase weight");
});

test("any set below minimum warns to repeat or reduce", () => {
  const tip = getExerciseRecommendation(bench, previousExercise([10, 8, 6, 5]));

  assert.equal(tip.label, "Repeat or reduce");
  assert.equal(tip.confidence, "Caution");
});

test("form-warning notes override increase", () => {
  const tip = getExerciseRecommendation(bench, previousExercise([10, 10, 10, 10], 155, "Last set was sloppy"));

  assert.equal(tip.label, "Repeat weight");
  assert.equal(tip.confidence, "Form");
});
