import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("./app.js", import.meta.url), "utf8");
const handler = source.slice(source.indexOf("  function setupMobileViewport()"),
  source.indexOf("  function isRunningInstalled()"));

function viewportFixture() {
  const listeners = {};
  const classes = new Set();
  const viewport = { height: 956, offsetTop: 0, scale: 1,
    addEventListener: (event, callback) => { listeners[event] = callback; } };
  const document = {
    activeElement: { matches: () => true }, querySelector: () => null,
    body: { classList: {
      contains: name => classes.has(name),
      toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name)
    } },
    addEventListener: (event, callback) => { listeners[event] = callback; }
  };
  const context = vm.createContext({ document, window: { innerHeight: 956, visualViewport: viewport },
    requestAnimationFrame: callback => callback(), setTimeout: callback => callback() });
  vm.runInContext(handler, context);
  context.setupMobileViewport();
  return { listeners, viewport, document, classes };
}

test("notes keyboard enters hidden-dock mode without forcing a scroll or injecting keyboard padding", () => {
  const { listeners, viewport, classes } = viewportFixture();
  viewport.height = 550;
  listeners.resize();
  assert.equal(classes.has("keyboardOpen"), true);
  // No scroll or document-style stubs: either old side effect would throw here.
});

test("save dock stays hidden during keyboard dismissal and returns when the viewport recovers", () => {
  const { listeners, viewport, document, classes } = viewportFixture();
  viewport.height = 550;
  listeners.resize();
  document.activeElement = null;
  listeners.focusout();
  assert.equal(classes.has("keyboardOpen"), true);
  viewport.height = 956;
  listeners.resize();
  assert.equal(classes.has("keyboardOpen"), false);
});

test("normal input focus and pinch zoom do not activate keyboard layout", () => {
  const { listeners, viewport, classes } = viewportFixture();
  listeners.focusin();
  assert.equal(classes.has("keyboardOpen"), false);
  viewport.height = 550;
  viewport.scale = 2;
  listeners.resize();
  assert.equal(classes.has("keyboardOpen"), false);
});
