import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("./app.js", import.meta.url), "utf8");
const handler = source.slice(source.indexOf("  function formatHistorySource("),
  source.indexOf("  function formatGlobalLast("));
const context = vm.createContext({
  selectedGym: "Gym A", normalizeGymKey: value => value.toLowerCase(),
  formatEntrySource: entry => `${entry.day} / ${entry.gym}`
});
vm.runInContext(handler, context);

test("same-entry global reference and starting sets do not repeat source metadata", () => {
  const entry = { day: "Push A", gym: "Gym A" };
  assert.equal(context.formatHistorySource({ selectedEntry: entry, globalReferenceEntry: entry }),
    "Based on: Push A / Gym A");
});

test("different global and context entries retain both visible sources", () => {
  const selectedEntry = { day: "Push A", gym: "Gym A" };
  const globalReferenceEntry = { day: "Push B", gym: "Gym A" };
  assert.equal(context.formatHistorySource({ selectedEntry, globalReferenceEntry }),
    "Last performed: Push B / Gym A\nBased on: Push A / Gym A");
});

test("reference-only other-gym history is distinguished from no compatible starting sets", () => {
  assert.equal(context.formatHistorySource({ selectedEntry: null,
    globalReferenceEntry: { day: "Pull A", gym: "Gym B" } }),
  "Last performed: Pull A / Gym B\nNo previous sets at this gym and setup");
});
