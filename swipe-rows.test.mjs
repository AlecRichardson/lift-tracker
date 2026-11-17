import assert from "node:assert/strict";
import test from "node:test";
import { rowSwipeDirection, setupSwipeRows } from "./swipe-rows.mjs";

test("row gestures require clear horizontal travel in either direction", () => {
  assert.equal(rowSwipeDirection(-80, 10), -1);
  assert.equal(rowSwipeDirection(80, 10), 1);
  assert.equal(rowSwipeDirection(-59, 0), 0);
  assert.equal(rowSwipeDirection(-80, 60), 0);
  assert.equal(rowSwipeDirection(10, 100), 0);
});

function fixture() {
  globalThis.window = { innerWidth: 440 };
  const handlers = {};
  const rows = Array.from({ length: 2 }, () => {
    const classes = new Set();
    const button = { hidden: true, disabled: true };
    const properties = new Map();
    return { dataset: {}, button, style: {
      setProperty: (name, value) => properties.set(name, value),
      removeProperty: name => properties.delete(name),
      getPropertyValue: name => properties.get(name) || ""
    }, querySelector: () => button,
      classList: { contains: name => classes.has(name), toggle(name, on) { if (on) classes.add(name); else classes.delete(name); } } };
  });
  const root = { addEventListener: (name, fn) => { handlers[name] = fn; },
    querySelectorAll: () => rows.filter(row => row.classList.contains("swipeOpen")) };
  setupSwipeRows(root);
  const target = (row, interactive = false, front = true) => ({ closest: selector =>
    selector === ".swipeRow" ? row : selector === ".swipeFront" ? front && row : interactive ? {} : null });
  const swipe = (row, dx, dy = 0, { x = 220, interactive = false } = {}) => {
    handlers.touchstart({ target: target(row, interactive), touches: [{ clientX: x, clientY: 200 }] });
    handlers.touchend({ changedTouches: [{ clientX: x + dx, clientY: 200 + dy }] });
  };
  return { rows, handlers, target, swipe };
}

test("left swipe only reveals an enabled delete action, right closes, and one row stays open", () => {
  const { rows: [first, second], swipe } = fixture();
  swipe(first, -80);
  assert.equal(first.classList.contains("swipeOpen"), true);
  assert.equal(first.button.hidden, false);
  assert.equal(first.button.disabled, false);
  swipe(second, -80);
  assert.equal(first.button.disabled, true);
  assert.equal(second.button.hidden, false);
  swipe(second, 80);
  assert.equal(second.classList.contains("swipeOpen"), false);
  assert.equal(second.button.disabled, true);
});

test("scrolls, edge gestures, editing controls and cancellation never reveal Delete", () => {
  const { rows: [row], swipe, handlers, target } = fixture();
  swipe(row, -80, 80);
  swipe(row, -80, 0, { x: 430 });
  swipe(row, 80, 0, { x: 10 });
  swipe(row, -80, 0, { interactive: true });
  handlers.touchstart({ target: target(row), touches: [{ clientX: 200, clientY: 200 }] });
  handlers.touchcancel();
  handlers.touchend({ changedTouches: [{ clientX: 100, clientY: 200 }] });
  assert.equal(row.button.disabled, true);
  assert.equal(row.classList.contains("swipeOpen"), false);
});

test("swipe-generated clicks cannot open rows and tapping an open row closes it", () => {
  const { rows: [row], swipe, handlers, target } = fixture();
  swipe(row, -80);
  let prevented = 0;
  const click = { target: target(row), preventDefault: () => { prevented++; }, stopPropagation() {} };
  handlers.click(click);
  assert.equal(prevented, 1);
  assert.equal(row.button.hidden, false);
  row.dataset.swipeClickUntil = "0";
  handlers.click(click);
  assert.equal(prevented, 2);
  assert.equal(row.button.disabled, true);
  assert.equal(row.classList.contains("swipeOpen"), false);
});

test("revealed Delete clicks are not consumed by row navigation guards", () => {
  const { rows: [row], swipe, handlers, target } = fixture();
  swipe(row, -80);
  handlers.click({ target: target(row, false, false), preventDefault() { assert.fail("Delete click blocked"); }, stopPropagation() {} });
  assert.equal(row.button.hidden, false);
});

test("drag follows the finger, clamps at the action width, and settles without opening the row", () => {
  const { rows: [row], handlers, target } = fixture();
  handlers.touchstart({ target: target(row), touches: [{ clientX: 220, clientY: 200 }] });
  let prevented = 0;
  const move = x => handlers.touchmove({ touches: [{ clientX: x, clientY: 200 }], cancelable: true,
    preventDefault() { prevented++; } });
  move(190);
  assert.equal(row.style.getPropertyValue("--swipe-offset"), "-30px");
  assert.equal(row.classList.contains("swipeDragging"), true);
  assert.equal(row.button.disabled, true);
  move(100);
  assert.equal(row.style.getPropertyValue("--swipe-offset"), "-84px");
  assert.equal(prevented, 2);
  handlers.touchend({ changedTouches: [{ clientX: 100, clientY: 200 }] });
  assert.equal(row.classList.contains("swipeOpen"), true);
  assert.equal(row.classList.contains("swipeDragging"), false);
  assert.equal(row.style.getPropertyValue("--swipe-offset"), "");
  assert.equal(row.button.disabled, false);
});

test("short drags snap back, vertical scroll stays scrolling, and cancellation restores an open row", () => {
  const { rows: [row], handlers, target, swipe } = fixture();
  const begin = () => handlers.touchstart({ target: target(row), touches: [{ clientX: 220, clientY: 200 }] });
  const move = (x, y) => handlers.touchmove({ touches: [{ clientX: x, clientY: y }], cancelable: true,
    preventDefault() {} });
  begin(); move(195, 200);
  handlers.touchend({ changedTouches: [{ clientX: 195, clientY: 200 }] });
  assert.equal(row.classList.contains("swipeOpen"), false);
  begin(); move(215, 225); move(120, 230);
  handlers.touchend({ changedTouches: [{ clientX: 120, clientY: 230 }] });
  assert.equal(row.classList.contains("swipeOpen"), false);
  swipe(row, -80);
  begin(); move(250, 200);
  handlers.touchcancel();
  assert.equal(row.classList.contains("swipeOpen"), true);
  assert.equal(row.button.disabled, false);
  assert.equal(row.style.getPropertyValue("--swipe-offset"), "");
  handlers.keydown({ key: "Escape" });
  assert.equal(row.classList.contains("swipeOpen"), false);
  begin(); move(150, 200);
  handlers.touchstart({ target: target(row), touches: [{ clientX: 150, clientY: 200 }, { clientX: 200, clientY: 200 }] });
  assert.equal(row.classList.contains("swipeDragging"), false);
  assert.equal(row.button.disabled, true);
});
