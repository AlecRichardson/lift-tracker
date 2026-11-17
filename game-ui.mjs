import { batchOutput, defenseCost, DEMO_GAME_KEY, dropMessage, GAME_RULES,
  raidCost, raidPreview, readyBatch, rewardDay } from "./game-state.mjs";
import { createDemoStore } from "./game-store.mjs";

const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => globalThis.crypto?.randomUUID?.() || `demo-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const iconPaths = {
  supplies: '<path d="m3 7 9-4 9 4v11l-9 4-9-4Z"/><path d="m3 7 9 4 9-4M12 11v11M8 5l9 4v5"/>',
  cash: '<path d="m2 9 12-6 8 5-12 6Z"/><path d="m2 12 8 5 12-6M2 15l8 5 12-6M8 6l8 5"/>',
  lawyers: '<path d="M12 3v18M5 21h14M3 7h18M5 7l-4 9h8ZM19 7l-4 9h8Z"/>',
  tickets: '<path d="m3 8 14-5 4 12-14 5-1-4a3 3 0 0 0-2-6Z"/><path d="m14 5 4 12"/>',
  raids: '<circle cx="12" cy="12" r="7"/><path d="M12 1v6m0 10v6M1 12h6m10 0h6"/>',
  back: '<path d="m15 5-7 7 7 7"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>'
};
const icon = name => `<svg class="g-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconPaths[name] || iconPaths.raids}</svg>`;
const duration = ms => {
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
};
const money = amount => `$${amount}`;
const actionButton = (action, label, { disabled = false, secondary = false, extra = "" } = {}) =>
  `<button type="button" class="g-button${secondary ? " g-secondary" : ""}" data-game-action="${action}" ${disabled ? "disabled" : ""} ${extra}>${label}</button>`;

export function mountGamePreview(root, { standalone = false, store = createDemoStore() } = {}) {
  if (root.dataset.gameMounted) return;
  root.dataset.gameMounted = "true";
  root.classList.add("game-preview");
  let state, screen = "overview", targetId = "mike", busy = false, lastRaid = null, toastTimeout;
  let statusSignature = "";
  const drafts = new Map();
  const content = document.createElement("div");
  const toast = document.createElement("div");
  toast.className = "g-toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.setAttribute("aria-atomic", "true");
  toast.hidden = true;
  root.replaceChildren(content, toast);
  const time = () => Date.now() + (state?.clockOffsetMs || 0);
  const player = () => state.players[state.activePlayerId];
  const notify = message => {
    clearTimeout(toastTimeout);
    toast.hidden = false;
    toast.textContent = message;
    toastTimeout = setTimeout(() => { toast.hidden = true; }, 8000);
  };
  function draft() {
    const id = state.activePlayerId;
    if (!drafts.has(id)) drafts.set(id, { id: uid(), name: "Upper body · sample", sets: Array.from({ length: 12 }, (_, i) => ({
      done: false, reps: 10, weight: [50, 40, 20][Math.floor(i / 4)] })) });
    return drafts.get(id);
  }
  function batchStatus(p) {
    if (!p.batch) return "No batch running";
    if (p.batch.readyAt > time()) return `Ready in ${duration(p.batch.readyAt - time())}`;
    return p.batch.remaining ? `Batch ready · ${money(p.batch.remaining)}` : "Batch empty · clear the slot";
  }
  function header(title, back = "") {
    return `<div class="g-heading">${back ? `<button type="button" class="g-back" data-game-action="view-${back}" aria-label="Back to ${back === "raids" ? "raids" : "game overview"}">${icon("back")}</button>` : ""}<h2 data-game-heading tabindex="-1">${title}</h2><span class="g-cash" aria-label="Banked cash ${player().cash} dollars">${icon("cash")}${money(player().cash)}</span></div>`;
  }
  function inventory() {
    const p = player();
    return `<div class="g-inventory" aria-label="Practice inventory">${[["supplies", "Supplies"], ["lawyers", "Lawyers"], ["tickets", "Tickets"]].map(([key, label]) =>
      `<div>${icon(key)}<span>${label}<strong>${p[key]}</strong></span></div>`).join("")}</div>`;
  }
  function recent() {
    const events = state.events.filter(e => e.playerId === player().id).slice(0, 5);
    return `<section class="g-section"><h3>Recent activity</h3>${events.length ? `<ul class="g-activity">${events.map(e => `<li>${escape(e.text)}</li>`).join("")}</ul>` : '<p class="g-muted">Save a sample workout to earn your first drops.</p>'}</section>`;
  }
  function overview() {
    const p = player(), used = p.dailyRewards[rewardDay(time())] || 0;
    return `${header("Overview")}${inventory()}
      <section class="g-section"><h3>Your businesses</h3>
        <button type="button" class="g-business" data-game-action="view-lab">
          <img src="./assets/game/lab-scene.png" width="90" height="112" alt="" loading="lazy" />
          <span><strong>Pharmaceutical Lab</strong><span class="g-batch-status" data-batch-player="${p.id}">${batchStatus(p)}</span><span class="g-enter">Enter Lab ${icon("arrow")}</span></span>
        </button>
      </section>
      <button type="button" class="g-raid-link" data-game-action="view-raids">${icon("raids")}<span><strong>Raids</strong><small>Scout your practice rival</small></span>${icon("arrow")}</button>
      <section class="g-workout-prompt"><div><strong>Earn drops from completed sets</strong><p>${used} of 12 daily drops received · practice clock</p></div>${actionButton("view-workout", "Sample Workout", { secondary: true })}</section>
      ${recent()}`;
  }
  function lab() {
    const p = player(), canCollect = Boolean(p.batch && p.batch.readyAt <= time()), cost = defenseCost(p.defense);
    const protectedText = p.protectedUntil > time() ? `Protected for ${duration(p.protectedUntil - time())}` : "Finished goods can be raided until collected.";
    return `${header("Pharmaceutical Lab", "overview")}
      <div class="g-scene${p.batch && !canCollect ? " is-producing" : ""}" aria-label="Interactive pharmaceutical lab">
        <img src="./assets/game/lab-scene.png" width="1088" height="1448" alt="Angled cutaway industrial lab: mixing tank on the left, supplies on the right, lawyers by the entrance." />
        <span class="g-vapor" aria-hidden="true"></span>
        <button type="button" class="g-hotspot g-tank" data-game-action="focus-batch">${icon("supplies")}<span class="g-batch-status" data-batch-player="${p.id}">${batchStatus(p)}</span></button>
        <button type="button" class="g-hotspot g-shelf" data-game-action="show-supplies">${icon("supplies")}Supplies ${p.supplies}</button>
        <button type="button" class="g-hotspot g-door" data-game-action="focus-defense">${icon("lawyers")}Defense ${p.defense}</button>
      </div>
      <section id="gameBatchActions" class="g-controls"><h3 ${p.batch ? `data-batch-player="${p.id}"` : ""}>${p.batch ? batchStatus(p) : "Produce your first batch"}</h3>
        <p class="g-muted">${p.batch ? "Collect & sell to bank the remaining goods as safe cash." : `1 supply · 4 hours · ${money(batchOutput(p))} per batch`}</p>
        ${p.batch ? actionButton("collect", p.batch.remaining ? `Collect & Sell · ${money(p.batch.remaining)}` : "Clear Empty Batch", { disabled: !canCollect, extra: `data-batch-id="${escape(p.batch.id)}"` }) : actionButton("start-batch", "Produce Batch · 1 Supply", { disabled: p.supplies < 1 })}
        <p class="g-muted g-protection" ${p.protectedUntil > time() ? `data-protection-until="${p.protectedUntil}"` : ""}>${protectedText}</p>
      </section>
      <section id="gameDefenseActions" class="g-section"><div class="g-row"><h3>Lawyers · defense ${p.defense} of 3</h3><span>${raidCost(p)} ticket${raidCost(p) === 1 ? "" : "s"} to raid you</span></div>
        <p class="g-muted">Higher defense raises the raid cost. A successful raid clears all applied defense.</p>
        ${actionButton("defend", p.defense === 3 ? "Defense at Maximum" : `Hire Lawyers · ${cost}`, { disabled: p.defense === 3 || p.lawyers < cost, secondary: true, extra: `data-level="${p.defense}"` })}
      </section>
      <section class="g-section"><h3>Lab level ${p.labLevel} of 5</h3><p class="g-muted">${money(batchOutput(p))} per new batch. Each upgrade adds $5 to future batches.</p>
        ${actionButton("upgrade", p.labLevel === 5 ? "Lab Fully Upgraded" : "Upgrade Lab · $50", { disabled: p.labLevel === 5 || p.cash < 50, secondary: true, extra: `data-level="${p.labLevel}"` })}
      </section>`;
  }
  function raids() {
    const p = player(), others = Object.values(state.players).filter(other => other.id !== p.id);
    return `${header("Raids", "overview")}<p class="g-muted">Practice rivals only. Scout their defense and estimated loot before spending tickets.</p>
      <section class="g-section"><h3>Choose a target</h3>${others.map(other => {
        const preview = raidPreview(state, p.id, other.id, time());
        return `<button type="button" class="g-target-card" data-game-action="scout" data-target="${other.id}"><div class="g-row"><strong>${other.name}</strong><span>Defense ${other.defense}</span></div><p>${preview.loot ? `Estimated loot ${money(preview.low)}–${money(preview.high)}` : batchStatus(other)}</p><small>${preview.reason || `${preview.cost} tickets to raid`}</small><span class="g-enter">Scout Lab ${icon("arrow")}</span></button>`;
      }).join("")}</section>
      <section class="g-section"><h3>Cash stolen</h3><p class="g-muted">Practice standings · successful raids only</p><ol class="g-standings">${Object.values(state.players).sort((a, b) => b.stolen - a.stolen).map(p => `<li><span>${p.name}</span><strong>${money(p.stolen)}</strong></li>`).join("")}</ol></section>`;
  }
  function scout() {
    const p = player(), other = state.players[targetId];
    const preview = raidPreview(state, p.id, other.id, time());
    return `${header(`${other.name}’s Lab`, "raids")}
      <div class="g-scout-art"><img src="./assets/game/lab-scene.png" width="1088" height="1448" alt="Your practice rival’s pharmaceutical lab" /></div>
      <div class="g-scout-stats"><div><span>Defense</span><strong>Level ${other.defense}</strong></div><div><span>Estimated loot</span><strong>${preview.loot ? `${money(preview.low)}–${money(preview.high)}` : "$0"}</strong></div></div>
      <p class="g-muted">Estimates are rounded scouting ranges. A successful raid takes 25% of the finished goods available when you attack.</p>
      <section class="g-controls"><div class="g-row"><strong>Raid cost: ${preview.cost} ticket${preview.cost === 1 ? "" : "s"}</strong><span>You have ${p.tickets}</span></div>
        ${actionButton("raid", `Raid ${other.name} · ${preview.cost} Tickets`, { disabled: !preview.available, extra: `data-target="${other.id}" data-level="${preview.defense}" data-batch-id="${escape(preview.batchId)}" data-remaining="${preview.remaining}"` })}
        <p class="g-muted">${preview.reason || "Guaranteed raid at this cost. All applied defense is cleared."}</p>
        ${other.protectedUntil > time() ? `<p class="g-muted" data-protection-until="${other.protectedUntil}">Protected for ${duration(other.protectedUntil - time())}.</p>` : ""}
      </section>`;
  }
  function result() {
    if (!lastRaid) return raids();
    return `${header("Raid Complete", "raids")}<section class="g-result"><span class="g-result-icon">${icon("cash")}</span><h3>You raided ${escape(lastRaid.targetName)}</h3><strong class="g-result-amount">${money(lastRaid.loot)} stolen</strong><dl><div><dt>Tickets spent</dt><dd>${lastRaid.cost}</dd></div><div><dt>Defense levels cleared</dt><dd>${lastRaid.defenseDestroyed}</dd></div><div><dt>Tickets remaining</dt><dd>${lastRaid.ticketsLeft}</dd></div></dl><p class="g-muted">The stolen cash is banked. Your rival has 1 hour of protection.</p>${actionButton("view-raids", "Back to Raids")}${actionButton("view-overview", "Your Overview", { secondary: true })}</section>`;
  }
  function workout() {
    const d = draft(), done = d.sets.filter(s => s.done).length;
    return `${header("Sample Workout", "overview")}<p class="g-muted">These sets belong only to ${player().name}’s practice game. They never enter your workout history.</p>
      <form class="g-sample-form" data-game-workout><div class="g-row"><h3>${escape(d.name)}</h3><span data-game-completed>${done} of 12 completed</span></div>
      <button type="button" class="g-text-button" data-game-action="complete-all">Mark all complete</button>
      ${["Bench Press", "Cable Row", "Dumbbell Curl"].map((name, group) => `<fieldset><legend>${name}</legend><div class="g-set-labels"><span>Done</span><span>Reps</span><span>Weight (lb)</span></div>${d.sets.slice(group * 4, group * 4 + 4).map((set, position) => {
        const index = group * 4 + position;
        return `<div class="g-set-row"><button type="button" class="g-set-check" aria-label="Set ${position + 1} of ${name} completed" aria-pressed="${set.done}" data-game-action="toggle-set" data-set="${index}">${set.done ? "✓" : position + 1}</button><input type="number" min="0" max="999" inputmode="numeric" value="${set.reps}" data-set="${index}" data-game-field="reps" aria-label="Reps for ${name} set ${position + 1}" /><input type="number" min="0" max="9999" step="0.5" inputmode="decimal" value="${set.weight}" data-set="${index}" data-game-field="weight" aria-label="Weight for ${name} set ${position + 1}" /></div>`;
      }).join("")}</fieldset>`).join("")}
      <p class="g-muted">Only completed sets with reps earn drops. First three daily drops include one of each item. Daily limit: 12 drops.</p>
      <div class="g-sample-save">${actionButton("save-workout", "Save Sample Workout")}</div></form>`;
  }
  function testControls() {
    const date = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(time());
    return `<details class="g-tools"><summary>Practice controls</summary><p>Time changes affect both demo players. Your real workouts and account are never changed.</p><p>Practice clock: <span data-practice-clock>${date}</span> · Chicago</p><div class="g-time-actions">${[1, 4, 24].map(hours => actionButton("advance-time", `+${hours}h`, { secondary: true, extra: `data-hours="${hours}" aria-label="Advance practice time ${hours} hours"` })).join("")}</div><p>Use +4h to finish a batch, +1h to end raid protection, or +24h to earn another day’s drops.</p>${actionButton("reset", "Reset Practice Game", { secondary: true })}${standalone ? '<a class="g-text-link" href="./index.html">Back to Lift Tracker</a>' : '<a class="g-text-link" href="./game-test.html">Open standalone test page</a>'}</details>`;
  }
  function render({ focus = false } = {}) {
    const p = player();
    content.innerHTML = `<aside class="g-practice-banner"><span><strong>Game preview</strong>Practice only · saved on this device</span><label><span class="srOnly">Practice player</span><select data-game-player aria-label="Practice player"><option value="alex" ${p.id === "alex" ? "selected" : ""}>Alex · demo</option><option value="mike" ${p.id === "mike" ? "selected" : ""}>Mike · demo</option></select></label></aside>
      <div class="g-content">${({ overview, lab, raids, scout, result, workout }[screen] || overview)()}${testControls()}</div>`;
    statusSignature = getSignature();
    if (focus) content.querySelector("[data-game-heading]")?.focus({ preventScroll: true });
  }
  function getSignature() {
    return Object.values(state.players).map(p => `${p.id}:${p.batch ? p.batch.readyAt <= time() : "empty"}:${p.protectedUntil > time()}`).join("|");
  }
  function open(next) {
    screen = next;
    render({ focus: true });
    if (standalone || !root.closest(".hidden")) window.scrollTo({ top: 0, behavior: "instant" });
  }
  function failure(error) {
    console.error(error);
    notify("Your practice game couldn’t save. Try again; your real workouts are unaffected.");
  }
  function loadFailure(error) {
    content.innerHTML = `<div class="g-content"><h2>Practice game unavailable</h2><p>${escape(error.message)}</p><p class="g-muted">Your real account and workouts are unaffected. Reset only if you want to start the practice game over.</p>${actionButton("reset", "Reset Practice Game", { secondary: true })}</div>`;
  }
  async function transact(command) {
    if (busy) return null;
    busy = true;
    const focusedAction = document.activeElement?.dataset?.gameAction;
    root.setAttribute("aria-busy", "true");
    root.querySelectorAll("button, select").forEach(control => { control.disabled = true; });
    try {
      const outcome = await store.transact({ id: uid(), playerId: state.activePlayerId, ...command });
      state = outcome.state;
      if (!outcome.result.ok) notify(outcome.result.message);
      return outcome.result;
    } catch (error) { failure(error); return null; }
    finally {
      busy = false;
      root.removeAttribute("aria-busy");
      render();
      if (focusedAction) {
        const control = [...content.querySelectorAll("[data-game-action]")].find(button => button.dataset.gameAction === focusedAction && !button.disabled);
        (control || content.querySelector("[data-game-heading]"))?.focus({ preventScroll: true });
      }
    }
  }
  root.addEventListener("click", async event => {
    const button = event.target.closest("[data-game-action]");
    if (!button || button.disabled || busy) return;
    const action = button.dataset.gameAction;
    if (action === "reset") {
      if (!window.confirm("Reset both demo players, sample workouts, items, and practice timers? Your real workouts will be kept.")) return;
      if (busy) return;
      busy = true;
      try { state = await store.reset(); drafts.clear(); lastRaid = null; open("overview"); notify("Practice game reset. Mike has a batch ready to raid."); }
      catch (error) { failure(error); }
      finally { busy = false; }
      return;
    }
    if (!state) return;
    if (action.startsWith("view-")) { open(action.slice(5)); return; }
    if (action === "scout") { targetId = button.dataset.target; open("scout"); return; }
    if (action === "focus-batch" || action === "focus-defense") {
      const section = content.querySelector(action === "focus-batch" ? "#gameBatchActions" : "#gameDefenseActions");
      section?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
      section?.querySelector("button")?.focus({ preventScroll: true });
      return;
    }
    if (action === "show-supplies") { notify(`You have ${player().supplies} supplies. Each batch uses one. Save sample workouts to earn more.`); return; }
    if (action === "toggle-set") {
      const set = draft().sets[Number(button.dataset.set)];
      set.done = !set.done;
      button.setAttribute("aria-pressed", String(set.done));
      button.textContent = set.done ? "✓" : Number(button.dataset.set) % 4 + 1;
      content.querySelector("[data-game-completed]").textContent = `${draft().sets.filter(s => s.done).length} of 12 completed`;
      return;
    }
    if (action === "complete-all") { draft().sets.forEach(set => { set.done = true; }); render(); return; }
    let command;
    if (action === "save-workout") {
      const form = content.querySelector("form");
      if (!form.reportValidity()) return;
      command = { type: "save-workout", workout: structuredClone(draft()) };
    } else if (action === "raid") command = { type: "raid", targetId: button.dataset.target,
      expectedDefense: Number(button.dataset.level), expectedRemaining: Number(button.dataset.remaining), batchId: button.dataset.batchId };
    else if (action === "defend" || action === "upgrade") command = { type: action, expectedLevel: Number(button.dataset.level) };
    else if (action === "collect") command = { type: action, batchId: button.dataset.batchId };
    else if (action === "advance-time") command = { type: action, hours: Number(button.dataset.hours) };
    else if (action === "start-batch") command = { type: action };
    if (!command) return;
    const actor = state.activePlayerId;
    const outcome = await transact(command);
    if (!outcome?.ok) return;
    if (outcome.type === "drops") { drafts.delete(actor); open("overview"); notify(dropMessage(outcome)); }
    else if (outcome.type === "raid") { lastRaid = outcome; open("result"); }
    else notify(outcome.message);
  });
  root.addEventListener("input", event => {
    const input = event.target.closest("[data-game-field]");
    if (input && state) draft().sets[Number(input.dataset.set)][input.dataset.gameField] = input.value === "" ? NaN : Number(input.value);
  });
  root.addEventListener("submit", event => { event.preventDefault(); });
  root.addEventListener("change", async event => {
    if (!event.target.matches("[data-game-player]") || busy || !state) return;
    const outcome = await transact({ type: "switch-player", targetId: event.target.value });
    if (outcome?.ok) { lastRaid = null; open("overview"); }
  });
  window.addEventListener("storage", event => {
    if (event.key !== DEMO_GAME_KEY) return;
    try { state = store.load(); render(); notify("Practice game updated in another tab."); }
    catch (error) { loadFailure(error); }
  });
  const tick = () => {
    if (!state || document.hidden || root.closest(".hidden")) return;
    if (getSignature() !== statusSignature && screen !== "workout" && !busy) render();
    content.querySelectorAll("[data-batch-player]").forEach(label => { label.textContent = batchStatus(state.players[label.dataset.batchPlayer]); });
    content.querySelectorAll("[data-protection-until]").forEach(label => { label.textContent = `Protected for ${duration(Number(label.dataset.protectionUntil) - time())}.`; });
  };
  setInterval(tick, 15000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    try { state = store.load(); if (screen !== "workout" && !busy) render(); }
    catch (error) { loadFailure(error); }
  });
  try { state = store.load(); render(); }
  catch (error) { loadFailure(error); }
}
