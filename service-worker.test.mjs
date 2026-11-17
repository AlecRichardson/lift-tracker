import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("./service-worker.js", import.meta.url), "utf8");

function worker({ cached = null, response = { ok: true, clone() { return this; } }, failNetwork = false } = {}) {
  const handlers = {};
  const calls = { fetch: [], put: [], deleted: [], precached: [], claimed: 0, skipped: 0 };
  const cache = {
    match: async () => cached,
    put: async (...args) => calls.put.push(args),
    addAll: async urls => { calls.precached = urls; }
  };
  vm.runInNewContext(source, {
    URL, Response,
    self: {
      location: { origin: "https://example.com" },
      registration: { scope: "https://example.com/lift-tracker/" },
      clients: { claim: async () => { calls.claimed++; } },
      skipWaiting: () => { calls.skipped++; },
      addEventListener: (type, handler) => { handlers[type] = handler; }
    },
    caches: {
      open: async () => cache,
      keys: async () => ["unrelated-cache", ...[4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map(version => `lift-tracker-shell-v${version}`)],
      delete: async key => { calls.deleted.push(key); }
    },
    fetch: async request => {
      calls.fetch.push(request);
      if (failNetwork) throw new Error("Offline");
      return response;
    }
  });
  const lifecycle = async name => {
    let pending;
    handlers[name]({ waitUntil: promise => { pending = promise; } });
    await pending;
  };
  const request = async (path, mode = "cors", method = "GET") => {
    let pending;
    handlers.fetch({ request: { url: new URL(path, "https://example.com/lift-tracker/").href, mode, method },
      respondWith: promise => { pending = promise; } });
    return pending ? await pending : undefined;
  };
  return { handlers, calls, lifecycle, request };
}

test("new workers precache all app modules and wait for explicit activation", async () => {
  const app = worker();
  await app.lifecycle("install");
  for (const path of ["./index.html", "./style.css", "./app.js", "./history-context.mjs", "./workout-state.mjs", "./recommendations.mjs"]) {
    assert.ok(app.calls.precached.includes(path));
  }
  assert.equal(app.calls.skipped, 0);
  assert.ok(app.calls.precached.includes("./plan-files.mjs"));
  for (const path of ["./plan-builder.mjs", "./plan-builder-state.mjs", "./plan-builder.css", "./swipe-rows.mjs"]) assert.ok(app.calls.precached.includes(path));
  app.handlers.message({ data: { type: "SKIP_WAITING" } });
  assert.equal(app.calls.skipped, 1);
});

test("activation removes only obsolete Lift Tracker caches", async () => {
  const app = worker();
  await app.lifecycle("activate");
  assert.deepEqual(app.calls.deleted, [4, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16].map(version => `lift-tracker-shell-v${version}`));
  assert.equal(app.calls.claimed, 1);
});

test("installed shell stays coherent even when the network has a newer asset", async () => {
  const installed = { version: "installed" };
  const app = worker({ cached: installed });
  assert.equal(await app.request("app.js"), installed);
  assert.equal(app.calls.fetch.length, 0);
});

test("offline navigation uses the installed index under the hosting subpath", async () => {
  const installed = { html: "installed index" };
  const app = worker({ cached: installed, failNetwork: true });
  assert.equal(await app.request("./?from=homescreen", "navigate"), installed);
});

test("auth, unrelated files and writes are not cached or intercepted", async () => {
  const app = worker();
  for (const [path, method] of [["https://accounts.google.com/auth", "GET"], ["./private-export.json", "GET"], ["./app.js", "POST"]]) {
    assert.equal(await app.request(path, "cors", method), undefined);
  }
  assert.equal(app.calls.fetch.length, 0);
  assert.equal(app.calls.put.length, 0);
  for (const path of ["/__/auth/handler", "./__/auth/handler", "./unrelated-page"]) {
    assert.equal(await app.request(path, "navigate"), undefined);
  }
});

test("missing assets cache successful responses but never cache an error page", async () => {
  const ok = worker();
  await ok.request("style.css");
  assert.equal(ok.calls.put.length, 1);
  const bad = worker({ response: { ok: false } });
  await bad.request("style.css");
  assert.equal(bad.calls.put.length, 0);
});

test("an unavailable uncached asset fails instead of returning unrelated HTML", async () => {
  const app = worker({ failNetwork: true });
  const response = await app.request("app.js");
  assert.equal(response.type, "error");
});
