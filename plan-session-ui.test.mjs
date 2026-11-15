import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { createPlanTemplate, parsePlanFile } from "./plan-files.mjs";

const source = await readFile(new URL("./app.js", import.meta.url), "utf8");
const handler = source.slice(source.indexOf("  function setupPlanFileControls()"), source.indexOf("  function initBuilderFromActivePlan("));

test("discard confirmation clears only current draft, stops timers, and returns Home", async () => {
  for (const accepted of [false, true]) {
    const callbacks = {};
    const calls = [];
    const elements = new Map();
    const element = id => {
      if (!elements.has(id)) elements.set(id, { disabled: false, dataset: { renderedDay: "Push A" },
        addEventListener: (event, callback) => { callbacks[`${id}:${event}`] = callback; },
        replaceChildren: () => calls.push("clear-current-screen") });
      return elements.get(id);
    };
    const context = vm.createContext({
      document: { getElementById: element }, currentDay: "Push A", confirm: () => accepted,
      clearDraft: () => calls.push("clear-current-draft"), stopAllRestTimers: () => calls.push("stop-timers"),
      renderHome: async () => calls.push("render-home"), showPage: page => calls.push(page),
      showMessage: () => assert.fail("Unexpected error"), console
    });
    vm.runInContext(handler, context);
    context.setupPlanFileControls();
    await callbacks["discardWorkout:click"]();
    assert.deepEqual(calls, accepted ? ["clear-current-draft", "stop-timers", "clear-current-screen", "render-home", "homePage"] : []);
    assert.equal(context.currentDay, accepted ? "" : "Push A");
  }
});

test("saving an import creates a separate plan and never writes active settings or workout history", async () => {
  const callbacks = {};
  const elements = new Map();
  const calls = [];
  const plan = parsePlanFile(JSON.stringify(createPlanTemplate()));
  const element = id => {
    if (!elements.has(id)) elements.set(id, { disabled: false,
      addEventListener: (event, callback) => { callbacks[`${id}:${event}`] = callback; },
      close: () => callbacks["planImportDialog:close"]() });
    return elements.get(id);
  };
  const context = vm.createContext({ document: { getElementById: element }, pendingPlanImport: plan,
    db: {}, userId: "owner", collection: (_db, ...parts) => parts.join("/"),
    addDoc: async (path, data) => { calls.push({ path, data }); return { id: "new-random-plan" }; },
    refreshPlanLibrary: async id => calls.push({ selected: id }), planFilesStatus: () => {}, console });
  vm.runInContext(handler, context);
  context.setupPlanFileControls();
  await callbacks["confirmPlanImport:click"]({ currentTarget: element("confirmPlanImport") });
  assert.equal(calls[0].path, "users/owner/plans");
  assert.equal(calls[0].data.name, "New Plan");
  assert.equal(calls[1].selected, "new-random-plan");
  assert.equal(context.pendingPlanImport, null);
  assert.equal(element("confirmPlanImport").disabled, false);
});

const activateHandler = source.slice(source.indexOf("  async function activateSavedPlan(id)"), source.indexOf("  function setupPlanFileControls()"));
function activation({ fail = false, dirty = false, accepted = true } = {}) {
  const calls = [];
  const container = { dataset: { renderedDay: "Push A" }, replaceChildren: () => calls.push("clear-screen") };
  const elements = { savedPlanSelect: { value: "new-plan" }, activatePlanBtn: {}, exerciseContainer: container };
  const context = vm.createContext({
    document: { getElementById: id => elements[id], querySelector: () => true },
    activePlan: { id: "old-plan" }, builderDirty: dirty, currentDay: "Push A", currentPage: "homePage",
    confirm: () => accepted, db: {}, userId: "owner", workouts: {}, workoutDays: [], parsePlanFile,
    doc: (_db, ...parts) => parts.join("/"), getDoc: async path => {
      calls.push(path); return { exists: () => true, data: () => createPlanTemplate() };
    }, userSettingsDoc: () => "users/owner/settings/app",
    setDoc: async (path, data) => { if (fail) throw new Error("Offline"); calls.push({ path, data }); },
    saveDraft: day => calls.push(`checkpoint-${day}`), stopAllRestTimers: () => calls.push("stop-timers"),
    initBuilderFromActivePlan: () => {}, renderHome: async () => {}, renderPlanPage: () => {},
    showPage: () => {}, showBuilderMessage: () => {}, planFilesStatus: () => {}, console: { error: () => {} }
  });
  vm.runInContext(activateHandler, context);
  return { context, calls, container };
}

test("activation changes only the active pointer and checkpoints the old plan's session", async () => {
  const { context, calls, container } = activation();
  await context.activateSavedPlan("new-plan");
  assert.equal(context.activePlan.id, "new-plan");
  assert.equal(context.workoutDays.length, 6);
  assert.equal(calls[1], "checkpoint-Push A");
  const writes = calls.filter(call => typeof call === "object");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, "users/owner/settings/app");
  assert.equal(writes[0].data.activePlanId, "new-plan");
  assert.equal(container.dataset.renderedDay, undefined);
});

test("activation adapter does not discard builder drafts or require destructive confirmation", async () => {
  const { context, calls } = activation({ dirty: true, accepted: false });
  await context.activateSavedPlan("new-plan");
  assert.equal(context.activePlan.id, "new-plan");
  assert.equal(context.builderDirty, true);
  assert.equal(calls.includes("checkpoint-Push A"), true);
});

test("failed activation leaves the old plan and current workout intact", async () => {
  const { context, calls, container } = activation({ fail: true });
  await assert.rejects(context.activateSavedPlan("new-plan"));
  assert.equal(context.activePlan.id, "old-plan");
  assert.equal(context.currentDay, "Push A");
  assert.equal(container.dataset.renderedDay, "Push A");
  assert.equal(calls.includes("stop-timers"), false);
});

test("builder save adapter writes inactive plans to their own document without activating them", async () => {
  const start = source.indexOf("      savePlan: async plan => {");
  const end = source.indexOf("      activatePlan: activateSavedPlan,", start);
  const writes = [];
  const context = vm.createContext({ parsePlanFile, activePlan: { id: "active" }, db: {}, userId: "owner",
    doc: (_db, ...parts) => parts.join("/"), setDoc: async (path, data) => writes.push({ path, data }) });
  vm.runInContext(`globalThis.adapter = { ${source.slice(start, end)} };`, context);
  const saved = await context.adapter.savePlan({ ...createPlanTemplate(), id: "inactive" });
  assert.equal(saved.id, "inactive");
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, "users/owner/plans/inactive");
  assert.equal(writes[0].data.name, "New Plan");
  assert.equal(context.activePlan.id, "active");
});

test("active-plan saves cannot invalidate an entered workout session", async () => {
  const start = source.indexOf("      savePlan: async plan => {");
  const end = source.indexOf("      activatePlan: activateSavedPlan,", start);
  const context = vm.createContext({ parsePlanFile, activePlan: { id: "active" }, currentDay: "Push A",
    getDraft: () => ({ entered: true }), draftHasValues: () => true });
  vm.runInContext(`globalThis.adapter = { ${source.slice(start, end)} };`, context);
  await assert.rejects(context.adapter.savePlan({ ...createPlanTemplate(), id: "active" }), error => error.code === "workout-in-progress");
  assert.equal(context.currentDay, "Push A");
});
