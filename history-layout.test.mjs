import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("./app.js", import.meta.url), "utf8");
const css = await readFile(new URL("./style.css", import.meta.url), "utf8");
const filterSource = source.slice(source.indexOf("    const logDays = logs.map"), source.indexOf("    filterOptions.forEach"));

test("History filters only offer saved workout days, not unrelated days from a new plan", () => {
  const context = vm.createContext({ logs: [{ d: "Pull A" }, { d: "Legs" }, { d: "Pull A" }],
    workoutDays: ["Upper A", "Lower A"], historyFilter: "All" });
  vm.runInContext(`${filterSource}\nglobalThis.options = filterOptions;`, context);
  assert.deepEqual(Array.from(context.options), ["All", "Pull A", "Legs"]);
});

test("deleting the last workout in a filter resets the filter instead of stranding History", () => {
  const context = vm.createContext({ logs: [{ d: "Legs" }], historyFilter: "Pull A" });
  vm.runInContext(filterSource, context);
  assert.equal(context.historyFilter, "All");
});

test("History row separates title, volume and full-width metadata without losing saved details", () => {
  const history = source.slice(source.indexOf("  async function renderHistory()"));
  const headerSource = history.slice(history.indexOf("        header.innerHTML ="), history.indexOf("        const details ="));
  const header = {};
  vm.runInNewContext(headerSource, { header, log: { d: "Pull A", t: "date" }, gymText: " / Ultimate",
    exerciseCount: 6, workingSets: 17, totalVolume: 14650,
    escapeHtml: value => value, formatCompactTime: () => "2:24 PM", formatLargeNumber: () => "14,650" });
  assert.match(header.innerHTML, /Pull A/);
  assert.match(header.innerHTML, /<span>2:24 PM \/ Ultimate<\/span>/);
  assert.match(header.innerHTML, /6 exercises \/ 17 sets/);
  assert.match(header.innerHTML, /14,650 lb/);
  assert.match(css, /\.historyCardMeta \{[^}]*grid-column: 1\/-1/);
});

test("revealed Delete slides a stable-width front without squeezing or rewrapping its contents", () => {
  assert.match(css, /\.swipeFront \{[^}]*width: 100%;[^}]*transform: translateX/);
  assert.doesNotMatch(css, /transition: width/);
  assert.match(css, /\.swipeDelete \{[^}]*min-height: 44px/);
  assert.match(css, /\.historyFilterChip \{[^}]*min-height: 44px/);
});
