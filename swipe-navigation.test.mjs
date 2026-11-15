import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("./app.js", import.meta.url), "utf8");
const handlers = source.slice(source.indexOf("  function setupSwipeNavigation()"), source.indexOf("  async function startWorkout(day)"));

function fixture({ page = "planPage", editing = false, modal = false, local = true } = {}) {
  const events = {};
  const calls = { pages: [], local: [] };
  const context = vm.createContext({
    window: { innerWidth: 440 },
    document: {
      activeElement: { matches: () => editing },
      querySelector: selector => selector === ".appShell" ? { addEventListener: (name, fn) => { events[name] = fn; } } : modal ? {} : null
    },
    SWIPE_EDGE_GUARD: 20, SWIPE_MIN_DISTANCE: 70, SWIPE_DOMINANCE_RATIO: 1.5,
    MAIN_PAGE_ORDER: ["homePage", "workoutPage", "historyPage", "planPage"],
    currentPage: page, swipeStart: null, swipeNavigationBusy: false,
    planBuilder: { swipe: direction => { calls.local.push(direction); return local; } },
    navigateToMainPage: async next => { calls.pages.push(next); },
    showMessage() { assert.fail("Swipe handler threw"); }, console
  });
  vm.runInContext(handlers, context);
  context.setupSwipeNavigation();
  const gesture = async (dx, dy = 0, row = false) => {
    events.touchstart({ touches: [{ clientX: 220, clientY: 200 }], target: { closest: selector => row && selector.includes(".swipeRow") ? {} : null } });
    await context.handleSwipeEnd({ changedTouches: [{ clientX: 220 + dx, clientY: 200 + dy }] });
  };
  return { calls, gesture };
}

test("plan back and forward swipes stay within the builder when handled locally", async () => {
  const { calls, gesture } = fixture();
  await gesture(80);
  await gesture(-80);
  assert.deepEqual(calls.local, [-1, 1]);
  assert.deepEqual(calls.pages, []);
});

test("Plans library back gesture falls through to History and other pages retain nav order", async () => {
  const library = fixture({ local: false });
  await library.gesture(80);
  assert.deepEqual(library.calls.pages, ["historyPage"]);
  const home = fixture({ page: "homePage" });
  await home.gesture(-80);
  assert.deepEqual(home.calls.pages, ["workoutPage"]);
});

test("row swipes and vertical scrolling never also trigger page navigation", async () => {
  const { calls, gesture } = fixture({ page: "historyPage" });
  await gesture(-100, 0, true);
  await gesture(-80, 90);
  await gesture(-40);
  assert.deepEqual(calls.pages, []);
  assert.deepEqual(calls.local, []);
});

test("editing and dialogs block navigation, but an idle focused button does not", async () => {
  for (const options of [{ editing: true }, { modal: true }]) {
    const { calls, gesture } = fixture(options);
    await gesture(80);
    assert.deepEqual(calls.local, []);
  }
  const idle = fixture();
  await idle.gesture(80);
  assert.deepEqual(idle.calls.local, [-1]);
});
