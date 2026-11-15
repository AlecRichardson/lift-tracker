import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { createPlanTemplate, parsePlanFile } from "./plan-files.mjs";

const source = await readFile(new URL("./app.js", import.meta.url), "utf8");
const emptyHelper = source.slice(source.indexOf("  function emptyActivePlan()"), source.indexOf("  async function loadOrCreateActivePlan("));
const deleteHelper = source.slice(source.indexOf("  async function deleteSavedPlan("), source.indexOf("  function setupPlanFileControls()"));

function fixture({ activeId = "old", storedActiveId = activeId, deleted = [], currentDay = "", fail = false } = {}) {
  const writes = [], reads = [];
  const records = new Map([
    ["users/owner/settings/app", { activePlanId: storedActiveId, deletedPlanIds: deleted }],
    ["users/owner/plans/next", createPlanTemplate()]
  ]);
  const context = vm.createContext({
    db: {}, userId: "owner", activePlan: { id: activeId, name: "Old" }, deletedPlanIds: [], currentDay,
    currentPage: "planPage", pageSubtitle: {}, workouts: {}, workoutDays: [],
    doc: (_db, ...parts) => parts.join("/"), userSettingsDoc: () => "users/owner/settings/app",
    parsePlanFile, waitForPlanSave: write => write,
    runTransaction: async (_db, callback) => {
      const staged = [];
      const result = await callback({
        get: async path => { reads.push(path); return { exists: () => records.has(path), data: () => records.get(path) }; },
        delete: path => staged.push({ kind: "delete", path }),
        set: (path, data) => staged.push({ kind: "set", path, data })
      });
      if (fail) throw new Error("Failed commit");
      writes.push(...staged);
      return result;
    },
    stopAllRestTimers() {}, document: { getElementById: () => ({ replaceChildren() {}, dataset: {} }) }
  });
  vm.runInContext(emptyHelper + deleteHelper, context);
  return { context, writes, reads, records };
}

test("active-plan deletion atomically removes only the plan and selects the named replacement", async () => {
  const { context, writes } = fixture();
  await context.deleteSavedPlan("old", "next");
  assert.equal(writes[0].path, "users/owner/plans/old");
  assert.equal(writes[0].kind, "delete");
  assert.equal(writes[1].path, "users/owner/settings/app");
  assert.equal(writes[1].data.activePlanId, "next");
  assert.equal(writes[1].data.deletedPlanIds.includes("old"), true);
  assert.equal(context.activePlan.id, "next");
  assert.equal(writes.some(write => write.path.includes("workouts")), false);
});

test("last-plan deletion explicitly persists no active plan and preserves history paths", async () => {
  const { context, writes } = fixture();
  await context.deleteSavedPlan("old");
  assert.equal(writes[1].data.activePlanId, "");
  assert.equal(writes[1].data.planLibraryInitialized, true);
  assert.equal(context.activePlan.id, "");
  assert.equal(context.workoutDays.length, 0);
  assert.equal(writes.length, 2);
});

test("inactive-plan deletion leaves the active pointer and current workout unchanged", async () => {
  const { context, writes } = fixture({ currentDay: "Push A" });
  await context.deleteSavedPlan("inactive");
  assert.equal(writes[1].data.activePlanId, undefined);
  assert.equal(context.activePlan.id, "old");
  assert.equal(context.currentDay, "Push A");
});

test("active workout and changed active-pointer guards prevent destructive writes", async () => {
  const logging = fixture({ currentDay: "Push A" });
  await assert.rejects(logging.context.deleteSavedPlan("old"));
  assert.equal(logging.writes.length, 0);
  const changed = fixture({ storedActiveId: "other" });
  await assert.rejects(changed.context.deleteSavedPlan("old"));
  assert.equal(changed.writes.length, 0);
});

test("failed commits and missing replacements do not change the current plan", async () => {
  const failed = fixture({ fail: true });
  await assert.rejects(failed.context.deleteSavedPlan("old", "next"));
  assert.equal(failed.context.activePlan.id, "old");
  assert.equal(failed.writes.length, 0);
  const missing = fixture();
  await assert.rejects(missing.context.deleteSavedPlan("old", "missing"));
  assert.equal(missing.writes.length, 0);
});

test("retry after an acknowledged last-plan deletion reconciles without selecting another plan", async () => {
  const { context, writes } = fixture({ storedActiveId: "", deleted: ["old"] });
  await context.deleteSavedPlan("old");
  assert.equal(context.activePlan.id, "");
  assert.equal(writes[1].data.deletedPlanIds.length, 1);
});

test("startup keeps the intentional empty state instead of recreating a starter plan", async () => {
  const helper = source.slice(source.indexOf("  async function loadOrCreateActivePlan("), source.indexOf("  async function applyAccountPlanUpdates("));
  const context = vm.createContext({ deletedPlanIds: [], userSettingsDoc: () => "settings",
    getDoc: async () => ({ exists: () => true, data: () => ({ activePlanId: "", planLibraryInitialized: true }) }) });
  vm.runInContext(emptyHelper + helper, context);
  const result = await context.loadOrCreateActivePlan({ Default: [] });
  assert.equal(result.id, "");
  assert.equal(Object.keys(result.workouts).length, 0);
});

test("account-specific template updates cannot recreate an intentionally deleted final plan", async () => {
  const helper = source.slice(source.indexOf("  async function applyAccountPlanUpdates("), source.indexOf("  async function saveActivePlanToStorage("));
  const context = vm.createContext({});
  vm.runInContext(helper, context);
  const empty = { id: "", workouts: {}, dayOrder: [] };
  assert.equal(await context.applyAccountPlanUpdates(empty, {}), empty);
});
