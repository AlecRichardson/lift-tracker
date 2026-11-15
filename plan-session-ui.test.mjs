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

function importFixture({ write = async () => {}, wait = write => write } = {}) {
  const callbacks = {};
  const elements = new Map();
  const writes = [], staged = [], completed = [];
  let sequence = 0;
  const element = id => {
    if (!elements.has(id)) elements.set(id, { disabled: false, open: false,
      addEventListener: (event, callback) => { callbacks[`${id}:${event}`] = callback; },
      close() { this.open = false; callbacks["planImportDialog:close"](); },
      showModal() { this.open = true; }
    });
    return elements.get(id);
  };
  const context = vm.createContext({
    document: { getElementById: element }, pendingPlanImport: null, parsePlanFile, PLAN_FILE_LIMIT: 512 * 1024,
    crypto: { randomUUID: () => `import-${++sequence}` }, escapeHtml: value => String(value),
    db: {}, userId: "owner", doc: (_db, ...parts) => parts.join("/"),
    setDoc: async (path, data) => { writes.push({ path, data }); return write(); },
    waitForPlanSave: wait,
    initBuilderFromActivePlan: () => ({
      stageImport: plan => staged.push(plan), completeImport: plan => completed.push(plan)
    }),
    planFilesStatus() {}, console: { error() {} }
  });
  vm.runInContext(handler, context);
  context.setupPlanFileControls();
  return { callbacks, element, context, writes, staged, completed,
    async choose(plan = createPlanTemplate()) {
      await callbacks["planFileInput:change"]({ target: { files: [{ size: 1000, text: async () => JSON.stringify(plan) }], value: "file" } });
    },
    save() { return callbacks["confirmPlanImport:click"]({ currentTarget: element("confirmPlanImport") }); }
  };
}

test("saving an import stages recovery first and writes only its own plan document", async () => {
  const f = importFixture();
  await f.choose(); await f.save();
  assert.equal(f.writes[0].path, "users/owner/plans/import-1");
  assert.equal(f.writes[0].data.name, "New Plan");
  assert.equal(f.staged[0].id, "import-1");
  assert.equal(f.completed[0].id, "import-1");
  assert.equal(f.context.pendingPlanImport, null);
  assert.equal(f.element("planImportDialog").open, false);
});

test("Close remains available while saving; late completion does not reopen the modal", async () => {
  let finish;
  const f = importFixture({ write: () => new Promise(resolve => { finish = resolve; }) });
  await f.choose();
  const saving = f.save();
  assert.equal(f.element("confirmPlanImport").textContent, "Saving...");
  assert.equal(f.element("confirmPlanImport").disabled, true);
  assert.equal(f.element("cancelPlanImport").disabled, false);
  assert.equal(f.element("cancelPlanImport").textContent, "Close");
  f.callbacks["cancelPlanImport:click"]();
  assert.equal(f.element("planImportDialog").open, false);
  finish(); await saving;
  assert.equal(f.element("planImportDialog").open, false);
  assert.equal(f.completed.length, 1);
});

test("delayed confirmation offers a retry using the same plan ID, not a duplicate", async () => {
  const f = importFixture({ wait: async () => { const error = new Error("Delayed"); error.code = "plan-save-pending"; throw error; } });
  await f.choose(); await f.save();
  assert.equal(f.element("confirmPlanImport").disabled, false);
  assert.equal(f.element("confirmPlanImport").textContent, "Retry Save");
  assert.match(f.element("planImportError").textContent, /draft is kept/);
  await f.save();
  assert.equal(f.writes.length, 2);
  assert.equal(f.writes[0].path, f.writes[1].path);
  assert.equal(f.element("cancelPlanImport").disabled, false);
});

test("late save from a closed preview cannot close a different import preview", async () => {
  let finish;
  const f = importFixture({ write: () => new Promise(resolve => { finish = resolve; }) });
  await f.choose();
  const saving = f.save();
  f.callbacks["cancelPlanImport:click"]();
  const second = createPlanTemplate(); second.name = "Second Import";
  await f.choose(second);
  finish(); await saving;
  assert.equal(f.element("planImportDialog").open, true);
  assert.equal(f.element("planImportName").textContent, "Second Import");
  assert.equal(f.context.pendingPlanImport.name, "Second Import");
  assert.equal(f.element("confirmPlanImport").disabled, false);
});

test("rejected save keeps the preview open and allows closing or retrying", async () => {
  const f = importFixture({ write: async () => { throw new Error("Network failed"); } });
  await f.choose(); await f.save();
  assert.equal(f.element("planImportDialog").open, true);
  assert.equal(f.element("confirmPlanImport").disabled, false);
  assert.equal(f.element("cancelPlanImport").disabled, false);
  assert.equal(f.completed.length, 0);
  assert.match(f.element("planImportError").textContent, /draft is kept/);
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
  const context = vm.createContext({ parsePlanFile, waitForPlanSave: write => write, activePlan: { id: "active" }, db: {}, userId: "owner",
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
