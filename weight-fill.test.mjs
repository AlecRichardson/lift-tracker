import assert from "node:assert/strict";
import test from "node:test";
import { getWeightFillTargets, getSetPrefill } from "./workout-state.mjs";

test("increased first weight fills only untouched unfinished sets below", () => {
  const sets = [{ weight: 155, editedWeight: true }, { weight: 145 },
    { weight: 135, editedWeight: true }, { weight: 145, done: true }, { weight: 145 }];
  const before = JSON.stringify(sets);
  assert.deepEqual(getWeightFillTargets(sets, 0), [1, 4]);
  assert.equal(JSON.stringify(sets), before);
});

test("copying a later set does not affect earlier sets or equal weights", () => {
  assert.deepEqual(getWeightFillTargets([{ weight: 145 }, { weight: 155, done: true },
    { weight: 155 }, { weight: 145 }], 1), [3]);
});

test("blank invalid and negative source weights cannot propagate", () => {
  for (const weight of ["", " ", "bad", -5, Infinity]) {
    assert.deepEqual(getWeightFillTargets([{ weight, editedWeight: true }, { weight: 145 }], 0), []);
  }
});

test("zero and fractional weights are supported without overwriting deliberate blanks", () => {
  for (const weight of [0, 157.5]) {
    assert.deepEqual(getWeightFillTargets([{ weight, editedWeight: true }, { weight: "" },
      { weight: "", editedWeight: true }], 0), [1]);
  }
});

test("history alone does not offer propagation and copied draft weight survives refresh", () => {
  assert.deepEqual(getWeightFillTargets([{ weight: 155 }, { weight: 145 }], 0), []);
  const history = { weight: 145, reps: 10 };
  assert.equal(getSetPrefill(history, { weight: 155, editedWeight: true }).weight, 155);
  assert.equal(history.weight, 145);
});
