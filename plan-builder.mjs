import { createPlanFile, createPlanTemplate, parsePlanFile } from "./plan-files.mjs";
import { exerciseSlug, normalizeExerciseName } from "./history-context.mjs";
import { addPlanDay, buildExerciseCatalog, clonePlan, duplicateDayName, movePlanExercise,
  pairPlanExercises, planDraft, removePlanExercise, renamePlanDay, restorePlanDrafts, updatePlanExercise } from "./plan-builder-state.mjs";

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
const human = value => String(value || "").replaceAll("_", " ");
const iconButton = (action, label, symbol, extra = "") => `<button type="button" class="pb-icon" data-pb="${action}" aria-label="${esc(label)}" title="${esc(label)}" ${extra}>${symbol}</button>`;

export class PlanBuilder {
  constructor(options) {
    this.options = options;
    this.root = options.root;
    this.storageError = false;
    try { this.storage = options.storage ?? window.localStorage; }
    catch { this.storage = { getItem: () => null, setItem: () => { throw new Error("Unavailable"); }, removeItem: () => {} }; this.storageError = true; }
    this.key = `planBuilderDraftsV1:${options.userId}`;
    this.drafts = new Map();
    const active = options.getActivePlan();
    this.plans = new Map(active?.id ? [[active.id, planDraft(active)]] : []);
    this.deletedIds = new Set(options.getDeletedPlanIds?.() || []);
    this.catalog = [];
    this.view = "library";
    this.id = "";
    this.day = "";
    this.edit = -1;
    this.query = "";
    this.selected = new Set();
    this.replaceIndex = null;
    this.message = "";
    this.error = false;
    this.busy = false;
    this.loading = false;
    this.catalogWarning = "";
    try { restorePlanDrafts(this.storage.getItem(this.key)).forEach(plan => { if (!this.deletedIds.has(plan.id)) this.drafts.set(plan.id, plan); }); }
    catch { this.storageError = true; }
    this.reportDirty();
    this.root.addEventListener("click", event => this.click(event));
    this.root.addEventListener("input", event => this.input(event));
    this.root.addEventListener("change", event => this.change(event));
    this.root.addEventListener("submit", event => {
      event.preventDefault();
      const action = event.target.dataset.pbForm;
      if (action) this.act(action);
    });
  }

  get plan() { return this.drafts.get(this.id) || this.plans.get(this.id); }
  get list() { return this.plan?.workouts[this.day] || []; }
  get dirty() { return this.drafts.has(this.id); }

  stageImport(plan) {
    if (!this.drafts.has(plan.id)) this.drafts.set(plan.id, planDraft(plan));
    this.persist();
    this.open(plan.id);
  }

  completeImport(plan) {
    if (this.deletedIds.has(plan.id)) return;
    if ((this.plans.get(plan.id)?.updatedAt || "") > (plan.updatedAt || "")) return;
    this.plans.set(plan.id, planDraft(plan));
    const draft = this.drafts.get(plan.id);
    const unchanged = draft && JSON.stringify(createPlanFile(draft)) === JSON.stringify(createPlanFile(plan));
    if (unchanged) this.drafts.delete(plan.id);
    this.persist();
    if (this.id === plan.id && unchanged) this.render();
    else this.updateStatus();
  }
  reportDirty() { this.options.onDirtyChange?.(this.drafts.size > 0); }

  persist() {
    try {
      if (this.drafts.size) this.storage.setItem(this.key, JSON.stringify({ version: 1, drafts: [...this.drafts.values()] }));
      else this.storage.removeItem(this.key);
      this.storageError = false;
    } catch { this.storageError = true; }
    this.reportDirty();
  }

  touch() {
    if (!this.dirty) this.drafts.set(this.id, clonePlan(this.plan));
    this.message = "";
    this.persist();
    this.updateStatus();
    return this.plan;
  }

  show() {
    this.render();
    if (!this.loading) this.refresh();
  }

  async refresh(openId = "") {
    if (this.loading) { if (openId) this.pendingOpenId = openId; return; }
    this.loading = true;
    this.updateStatus();
    try {
      const plans = await this.options.getPlans();
      (this.options.getDeletedPlanIds?.() || []).forEach(id => this.deletedIds.add(id));
      this.deletedIds.forEach(id => this.drafts.delete(id));
      this.plans = new Map(plans.filter(plan => !this.deletedIds.has(plan.id)).map(plan => [plan.id, planDraft(plan)]));
      const active = this.options.getActivePlan();
      if (active.id && !this.deletedIds.has(active.id) && !this.plans.has(active.id)) this.plans.set(active.id, planDraft(active));
      this.persist();
      this.setCatalog(buildExerciseCatalog([...this.drafts.values(), ...this.plans.values(), ...(this.options.starterPlans || [])]));
      this.message = "";
      if (openId) this.open(openId);
      else if (this.view === "library") this.render();
      try {
        const logs = await this.options.getHistory();
        this.setCatalog(buildExerciseCatalog([...this.drafts.values(), ...this.plans.values(), ...(this.options.starterPlans || [])], logs));
        this.catalogWarning = "";
      } catch { this.catalogWarning = "Couldn't load your exercise history. Saved plan exercises are still available."; }
      if (this.view === "picker") this.renderResults();
    } catch {
      this.notify("Couldn't load saved plans. Try again.", true);
    } finally {
      this.loading = false;
      this.updateStatus();
      if (this.pendingOpenId) {
        const nextId = this.pendingOpenId;
        this.pendingOpenId = "";
        this.refresh(nextId);
      }
    }
  }

  setCatalog(catalog) {
    const previous = [...this.selected].map(index => this.catalog[index]).filter(Boolean);
    this.catalog = catalog;
    this.selected = new Set(previous.map(exercise => catalog.findIndex(entry => entry.id === exercise.id &&
      entry.name === exercise.name && entry.equipment === exercise.equipment)).filter(index => index >= 0));
  }

  open(id) {
    if (!this.plans.has(id) && !this.drafts.has(id)) return;
    this.id = id;
    this.day = this.plan.dayOrder[0] || "";
    this.edit = -1;
    this.view = "overview";
    this.message = "";
    this.render();
    this.scrollTop();
  }

  notify(message, error = false) {
    this.message = message;
    this.error = error;
    this.updateStatus();
    if (error) this.root.querySelector(".pb-message")?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }

  scrollTop() { this.options.scrollTop?.(); }

  back(action, label) {
    return `<button type="button" class="pb-back" data-pb="${action}">&#8592; ${esc(label)}</button>`;
  }

  footer() {
    return `<section class="builderSaveSimple pb-save"><p class="pb-saveStatus" role="status"></p><button type="button" class="primaryBtn" data-pb="save">Save Changes</button></section>`;
  }

  library() {
    const ids = [...new Set([...this.plans.keys(), ...this.drafts.keys()])];
    const activeId = this.options.getActivePlan().id;
    ids.sort((a, b) => a === activeId ? -1 : b === activeId ? 1 :
      (this.drafts.get(a) || this.plans.get(a)).name.localeCompare((this.drafts.get(b) || this.plans.get(b)).name));
    return `<div class="pb-title"><h3>Your plans</h3><button type="button" class="secondaryBtn" data-pb="refresh">Refresh</button></div>
      <div class="pb-primaryActions"><button type="button" class="primaryBtn" data-pb="new">+ New Plan</button><button type="button" class="secondaryBtn" data-pb="import">Import Plan</button></div>
      <div class="pb-library">${ids.map(id => {
        const plan = this.drafts.get(id) || this.plans.get(id);
        const count = Object.values(plan.workouts).reduce((sum, list) => sum + list.length, 0);
        const status = [id === activeId ? "Active" : this.plans.has(id) ? "Saved" : "", this.drafts.has(id) ? "Draft" : ""].filter(Boolean).join(" / ");
        return `<button type="button" class="pb-planRow" data-pb="open" data-id="${esc(id)}"><span><strong>${esc(plan.name || "Unnamed Plan")}</strong><small>${plan.dayOrder.length} days / ${count} exercises</small></span><span class="pb-label">${status}</span><span aria-hidden="true">&#8250;</span></button>`;
      }).join("") || '<p class="historyEmpty">No plans yet.</p>'}</div>
      <button type="button" class="pb-textAction" data-pb="template">Download Plan Template</button>`;
  }

  overview() {
    const plan = this.plan;
    return `${this.back("library", "Plans")}<div class="pb-title"><h3>Plan details</h3>${this.menu("planMenu", "Plan actions", `
      <button type="button" data-pb="duplicate-plan">Duplicate Plan</button><button type="button" data-pb="export">Export Plan</button>
      <button type="button" class="pb-danger" data-pb="delete-plan">Delete Plan</button>
      ${this.dirty ? '<button type="button" class="pb-danger" data-pb="discard-plan">Discard Unsaved Changes</button>' : ""}`)}</div>
      <label class="builderField"><span>Plan name</span><input data-plan-field="name" maxlength="120" value="${esc(plan.name)}" /></label>
      <div class="pb-planStatus">${this.id === this.options.getActivePlan().id ? '<span class="pb-label">Active plan</span>' : '<button type="button" class="secondaryBtn" data-pb="activate">Make Active</button>'}</div>
      <h3 class="pb-sectionTitle">Workout days</h3>
      <div>${plan.dayOrder.map((day, index) => `<div class="pb-dayRow"><span class="pb-order">${index + 1}</span><button type="button" class="pb-dayOpen" data-pb="day" data-day="${esc(day)}"><strong>${esc(day)}</strong><small>${plan.workouts[day].length} exercises / ${plan.workouts[day].reduce((sum, ex) => sum + (Number(ex.sets) || 0), 0)} sets</small></button>
        ${iconButton("day-up", `Move ${day} up`, "&#8593;", `data-day="${esc(day)}" ${index === 0 ? "disabled" : ""}`)}
        ${iconButton("day-down", `Move ${day} down`, "&#8595;", `data-day="${esc(day)}" ${index === plan.dayOrder.length - 1 ? "disabled" : ""}`)}</div>`).join("")}</div>
      <form class="pb-addDay" data-pb-form="add-day"><label class="srOnly" for="pb-day-name">New day name</label><input id="pb-day-name" placeholder="New day name" maxlength="100" required /><button type="submit" class="secondaryBtn">Add Day</button></form>`;
  }

  menu(id, label, content) {
    return `<details class="pb-menu" id="${id}"><summary aria-label="${esc(label)}" title="${esc(label)}">&#8943;</summary><div>${content}</div></details>`;
  }

  exerciseEditor(exercise, index) {
    const equipment = [...new Set([exercise.equipment || "", "barbell", "dumbbell", "cable", "machine", "bodyweight", "barbell_or_machine"])];
    const partner = this.list.findIndex((other, i) => i !== index && exercise.superset && other.superset === exercise.superset);
    return `<div class="pb-editor" id="pb-exercise-${index}">
      <label class="builderField"><span>Exercise name</span><input data-ex-field="name" data-index="${index}" value="${esc(exercise.name)}" maxlength="160" /></label>
      <div class="pb-prescription"><label>Sets<input type="number" min="1" max="50" inputmode="numeric" data-ex-field="sets" data-index="${index}" value="${esc(exercise.sets)}" /></label>
      <label>Reps<input data-ex-field="target" data-index="${index}" value="${esc(exercise.target)}" placeholder="8-10" maxlength="80" /></label>
      <label>Rest<input data-ex-field="rest" data-index="${index}" value="${esc(exercise.rest)}" placeholder="90 sec" maxlength="160" /></label></div>
      <details class="pb-more"><summary>More options</summary><div class="pb-moreFields">
      <label>Equipment<select data-ex-field="equipment" data-index="${index}">${equipment.map(value => `<option value="${esc(value)}" ${value === exercise.equipment ? "selected" : ""}>${esc(human(value) || "Not specified")}</option>`).join("")}</select></label>
      <label>Superset with<select data-pair-index="${index}"><option value="">None</option>${this.list.map((other, i) => i === index ? "" : `<option value="${i}" ${partner === i ? "selected" : ""}>${i + 1}. ${esc(other.name || `Exercise ${i + 1}`)}</option>`).join("")}</select></label>
      <label>Type<select data-ex-field="type" data-index="${index}">${[...new Set([exercise.type || "", "compound", "accessory"])].map(value => `<option value="${esc(value)}" ${value === exercise.type ? "selected" : ""}>${esc(value || "Not specified")}</option>`).join("")}</select></label>
      <label>Note<textarea data-ex-field="note" data-index="${index}" maxlength="3000">${esc(exercise.note)}</textarea></label></div></details>
      <div class="pb-rowActions"><button type="button" class="secondaryBtn" data-pb="replace" data-index="${index}">Replace Exercise</button><button type="button" class="secondaryBtn pb-danger" data-pb="remove" data-index="${index}">Remove</button></div>
    </div>`;
  }

  dayView() {
    return `${this.back("overview", this.plan.name || "Plan")}<div class="pb-title"><h3>${esc(this.day)}</h3>${this.menu("pb-day-menu", "Day actions", `
      <form data-pb-form="rename-day"><label>Day name<input id="pb-rename-day" value="${esc(this.day)}" maxlength="100" required /></label><button type="submit">Rename Day</button></form>
      <button type="button" data-pb="duplicate-day">Duplicate Day</button><button type="button" class="pb-danger" data-pb="delete-day">Delete Day</button>`)}</div>
      <div class="pb-exercises">${this.list.map((exercise, index) => `<article class="pb-exercise ${exercise.superset ? "pb-paired" : ""}">
        <div class="pb-exerciseRow"><button type="button" class="pb-exerciseOpen" data-pb="edit" data-index="${index}" aria-expanded="${this.edit === index}" aria-controls="pb-exercise-${index}"><strong>${esc(exercise.name || "Unnamed exercise")}</strong><small>${esc(exercise.sets || "-")} sets / ${esc(exercise.target || "-")} reps${exercise.rest ? ` / ${esc(exercise.rest)}` : ""}${exercise.superset ? ` / Superset ${esc(exercise.superset)}` : ""}</small></button>
        ${iconButton("edit", `Edit ${exercise.name || "exercise"}`, "&#9998;", `data-index="${index}"`)}
        ${iconButton("exercise-up", `Move ${exercise.name} up`, "&#8593;", `data-index="${index}" ${index === 0 ? "disabled" : ""}`)}
        ${iconButton("exercise-down", `Move ${exercise.name} down`, "&#8595;", `data-index="${index}" ${index === this.list.length - 1 ? "disabled" : ""}`)}</div>
        ${this.edit === index ? this.exerciseEditor(exercise, index) : `<div id="pb-exercise-${index}" hidden></div>`}</article>`).join("")}</div>
      <button type="button" class="secondaryBtn pb-addExercises" data-pb="picker">+ Add Exercises</button>`;
  }

  picker() {
    return `${this.back("day-back", this.day)}<h3>${this.replaceIndex === null ? "Add exercises" : "Replace exercise"}</h3>
      <label class="builderField"><span>Search exercises</span><input id="pb-search" type="search" value="${esc(this.query)}" placeholder="Name or equipment" autocomplete="off" /></label>
      <p class="historySource pb-catalogWarning">${esc(this.catalogWarning)}</p><div id="pb-picker-results"></div>
      <details class="pb-custom"><summary>Create Exercise</summary><form data-pb-form="custom"><label>Exercise name<input id="pb-custom-name" maxlength="160" required /></label>
      <label>Equipment<select id="pb-custom-equipment">${["barbell", "dumbbell", "cable", "machine", "bodyweight", ""].map(value => `<option value="${value}">${human(value) || "Not specified"}</option>`).join("")}</select></label>
      <button type="submit" class="secondaryBtn">${this.replaceIndex === null ? "Add Exercise" : "Replace Exercise"}</button></form></details>`;
  }

  render() {
    const editing = ["overview", "day"].includes(this.view);
    const body = this.view === "library" ? this.library() : this.view === "overview" ? this.overview() : this.view === "day" ? this.dayView() : this.view === "picker" ? this.picker() :
      `${this.back("library", "Plans")}<h3>New Plan</h3><form data-pb-form="create"><label class="builderField"><span>Plan name</span><input id="pb-new-name" placeholder="My new split" maxlength="120" required /></label><button type="submit" class="primaryBtn pb-create">Create Plan</button></form>`;
    this.root.innerHTML = `<div class="builderGrid pb"><div class="pb-message hidden" role="status"></div><div class="pb-content">${body}</div>
      ${editing ? this.footer() : this.view === "picker" ? '<section class="builderSaveSimple pb-save"><button type="button" class="primaryBtn" data-pb="add-selected"></button></section>' : ""}</div>`;
    this.root.classList.toggle("pb-noDock", !editing && this.view !== "picker");
    if (this.view === "picker") this.renderResults();
    this.updateStatus();
  }

  updateStatus() {
    const message = this.root.querySelector(".pb-message");
    if (message) {
      const text = this.message || (this.storageError ? "Couldn't keep your draft on this device. Save Changes before closing." : "");
      message.textContent = text;
      message.classList.toggle("hidden", !text);
      message.classList.toggle("pb-error", this.error || this.storageError);
      message.setAttribute("role", this.error || this.storageError ? "alert" : "status");
    }
    const status = this.root.querySelector(".pb-saveStatus");
    if (status) status.textContent = this.busy ? "Saving..." : this.dirty ? "Unsaved changes" : "All changes saved";
    this.root.querySelectorAll('[data-pb="save"]').forEach(button => { button.disabled = this.busy || !this.dirty; });
    this.root.querySelectorAll('[data-pb="activate"]').forEach(button => { button.disabled = this.busy || this.dirty; });
    this.root.querySelectorAll('[data-pb="refresh"]').forEach(button => { button.disabled = this.loading; });
  }

  renderResults() {
    const target = this.root.querySelector("#pb-picker-results");
    if (!target) return;
    const query = normalizeExerciseName(this.query);
    const visible = this.catalog.map((exercise, index) => ({ exercise, index })).filter(({ exercise }) =>
      normalizeExerciseName(`${exercise.name} ${exercise.equipment} ${(exercise.lastAlias || []).join(" ")}`).includes(query));
    target.innerHTML = visible.map(({ exercise, index }) => `<button type="button" class="pb-pickerRow" data-pb="pick" data-index="${index}" aria-pressed="${this.selected.has(index)}"><span class="pb-check" aria-hidden="true">${this.selected.has(index) ? "&#10003;" : "+"}</span><span><strong>${esc(exercise.name)}</strong><small>${esc(human(exercise.equipment) || "Equipment not specified")}</small></span></button>`).join("") || '<p class="historyEmpty">No matching exercises.</p>';
    const button = this.root.querySelector('[data-pb="add-selected"]');
    if (button) {
      button.disabled = !this.selected.size;
      button.textContent = this.replaceIndex === null ? `Add ${this.selected.size || ""} ${this.selected.size === 1 ? "Exercise" : "Exercises"}` : "Replace Exercise";
    }
  }

  input(event) {
    if (this.busy) return;
    const input = event.target;
    if (input.id === "pb-search") { this.query = input.value; this.renderResults(); return; }
    if (input.dataset.planField === "name") {
      this.touch().name = input.value;
      this.persist();
    }
    if (input.dataset.exField) {
      this.touch();
      const index = Number(input.dataset.index);
      if (input.dataset.exField === "name" && !input.dataset.renameTracked) {
        const exercise = this.list[index];
        const aliases = exercise.lastAlias || [];
        if (exercise.name.trim() && !aliases.includes(exercise.name) && aliases.length < 40) exercise.lastAlias = [...aliases, exercise.name];
        input.dataset.renameTracked = "true";
      }
      updatePlanExercise(this.list[index], input.dataset.exField, input.value);
      this.persist();
      const title = input.closest(".pb-exercise")?.querySelector(".pb-exerciseOpen strong");
      if (title) title.textContent = this.list[index].name || "Unnamed exercise";
    }
    this.updateStatus();
  }

  change(event) {
    if (this.busy || event.target.dataset.pairIndex === undefined) return;
    this.touch();
    const index = Number(event.target.dataset.pairIndex);
    this.edit = pairPlanExercises(this.list, index, event.target.value === "" ? null : Number(event.target.value));
    this.persist();
    this.render();
  }

  click(event) {
    const button = event.target.closest("[data-pb]");
    if (!button || button.disabled || this.busy) return;
    this.act(button.dataset.pb, button.dataset).catch(error => this.notify(error.message || "Couldn't update this plan.", true));
  }

  async act(action, data = {}) {
    if (this.busy) return;
    const value = id => this.root.querySelector(`#${id}`)?.value || "";
    try {
      if (action === "save") return await this.save();
      if (action === "activate") {
        if (this.dirty) return this.notify("Save Changes before activating this plan.", true);
        this.busy = true;
        this.root.inert = true;
        try { await this.options.activatePlan(this.id); this.notify("Plan activated."); }
        finally { this.busy = false; this.root.inert = false; }
        this.render();
        return;
      }
      if (action === "refresh") return await this.refresh();
      if (action === "delete-plan") {
        const id = this.id;
        const isActive = id === this.options.getActivePlan().id;
        const alternatives = [...this.plans.values()].filter(plan => plan.id !== id).sort((a, b) => a.name.localeCompare(b.name));
        const next = isActive ? alternatives.find(plan => { try { parsePlanFile(JSON.stringify(plan)); return true; } catch { return false; } }) : null;
        const warning = isActive ? next ? ` ${next.name} will become active.` : " No plan will be active until you create or choose another one." : "";
        const message = `Delete ${this.plan.name}?${warning}${this.dirty ? " Unsaved edits to this plan will also be removed." : ""} Saved workouts and exercise history will be kept.`;
        if (!(this.options.confirm ? this.options.confirm(message) : confirm(message))) return;
        this.busy = true;
        this.root.inert = true;
        try {
          await this.options.deletePlan(id, next?.id || "");
          this.deletedIds.add(id);
          this.plans.delete(id);
          this.drafts.delete(id);
          this.persist();
          this.id = ""; this.day = ""; this.edit = -1; this.view = "library";
          this.message = "Plan deleted. Workout history kept.";
          this.error = false;
          this.render();
          this.scrollTop();
        } catch (error) {
          this.notify(error.code === "plan-save-pending" ? "Delete confirmation is delayed. Reopen the app after reconnecting to check whether it completed." : "Couldn't delete this plan. Finish any current workout, check your connection, and try again.", true);
        } finally { this.busy = false; this.root.inert = false; this.updateStatus(); }
        return;
      }
      if (action === "open") return this.open(data.id);
      if (action === "import") return this.options.requestImport();
      if (action === "template") return this.options.exportFile("lift-tracker-plan-template.json", createPlanTemplate());
      if (action === "export") {
        if (this.dirty) return this.notify("Save Changes before exporting this plan.", true);
        return this.options.exportFile(`lift-tracker-plan-${exerciseSlug(this.plan.name) || "plan"}.json`, createPlanFile(this.plan));
      }
      if (action === "create") {
        const name = value("pb-new-name").trim();
        if (!name) return this.notify("Enter a plan name.", true);
        this.id = crypto.randomUUID();
        this.drafts.set(this.id, { id: this.id, name, dayOrder: [], workouts: {}, createdAt: "" });
        this.view = "overview";
        this.persist();
      } else if (action === "duplicate-plan") {
        const plan = clonePlan(this.plan);
        this.id = crypto.randomUUID();
        this.drafts.set(this.id, { ...plan, id: this.id, name: `${plan.name} Copy`.slice(0, 120), createdAt: "" });
        this.persist();
      } else if (action === "discard-plan") {
        if (!confirm("Discard this plan's unsaved changes? Saved workouts will not be changed.")) return;
        this.drafts.delete(this.id);
        this.view = this.plans.has(this.id) ? "overview" : "library";
        this.persist();
      } else if (action === "add-day") {
        const name = value("pb-day-name");
        this.touch();
        this.day = addPlanDay(this.plan, name);
        this.edit = -1;
        this.view = "day";
        this.persist();
      } else if (action === "rename-day") {
        this.touch();
        this.day = renamePlanDay(this.plan, this.day, value("pb-rename-day"));
        this.persist();
      } else if (action === "duplicate-day") {
        this.touch();
        this.day = addPlanDay(this.plan, duplicateDayName(this.plan, this.day), this.day);
        this.edit = -1;
        this.persist();
      } else if (action === "delete-day") {
        if (!confirm(`Remove ${this.day} from this plan? Saved workout history will be kept.`)) return;
        this.touch();
        delete this.plan.workouts[this.day];
        this.plan.dayOrder = this.plan.dayOrder.filter(day => day !== this.day);
        this.day = "";
        this.view = "overview";
        this.edit = -1;
        this.persist();
      } else if (action === "day-up" || action === "day-down") {
        this.touch();
        const i = this.plan.dayOrder.indexOf(data.day);
        const next = i + (action === "day-up" ? -1 : 1);
        if (i >= 0 && next >= 0 && next < this.plan.dayOrder.length) [this.plan.dayOrder[i], this.plan.dayOrder[next]] = [this.plan.dayOrder[next], this.plan.dayOrder[i]];
        this.persist();
      } else if (action === "day") {
        this.day = data.day;
        this.view = "day";
        this.edit = -1;
      } else if (action === "edit") {
        const index = Number(data.index);
        this.edit = this.edit === index ? -1 : index;
      } else if (["exercise-up", "exercise-down", "remove"].includes(action)) {
        this.touch();
        const i = Number(data.index);
        if (action === "remove") {
          removePlanExercise(this.list, i);
          this.edit = -1;
        } else this.edit = movePlanExercise(this.list, i, action === "exercise-up" ? -1 : 1);
        this.persist();
      } else if (action === "picker" || action === "replace") {
        this.setCatalog(buildExerciseCatalog([...this.drafts.values(), ...this.plans.values(), { workouts: { Catalog: this.catalog } }]));
        this.view = "picker";
        this.replaceIndex = action === "replace" ? Number(data.index) : null;
        this.query = "";
        this.selected.clear();
      } else if (action === "pick") {
        const i = Number(data.index);
        if (this.selected.has(i)) this.selected.delete(i);
        else { if (this.replaceIndex !== null) this.selected.clear(); this.selected.add(i); }
        this.renderResults();
        return;
      } else if (action === "add-selected" || action === "custom") {
        let additions;
        if (action === "custom") {
          const name = value("pb-custom-name").trim();
          const equipment = value("pb-custom-equipment");
          if (!name) return this.notify("Enter an exercise name.", true);
          const found = this.catalog.find(ex => normalizeExerciseName(ex.name) === normalizeExerciseName(name) && ex.equipment === equipment);
          additions = [found || { id: `${exerciseSlug(equipment)}_${exerciseSlug(name)}`.replace(/^_/, ""), name,
            sets: 3, target: "8-10", rest: "90 sec", equipment, type: "", note: "", superset: "", lastAlias: [] }];
        } else additions = [...this.selected].map(i => this.catalog[i]).filter(Boolean);
        if (!additions.length) return;
        if (this.replaceIndex === null && this.list.length + additions.length > 40) return this.notify("Use up to 40 exercises per day.", true);
        this.touch();
        if (this.replaceIndex !== null) {
          const index = this.replaceIndex;
          removePlanExercise(this.list, index);
          this.list.splice(index, 0, clonePlan(additions[0]));
          this.edit = index;
        } else {
          this.list.push(...clonePlan(additions));
          this.edit = action === "custom" ? this.list.length - 1 : -1;
        }
        this.view = "day";
        this.persist();
      } else if (["library", "overview", "new"].includes(action)) this.view = action;
      else if (action === "day-back") this.view = "day";
      this.message = "";
      this.error = false;
      this.render();
      if (["library", "overview", "new", "day", "picker", "add-day", "day-back", "create", "add-selected", "custom"].includes(action)) this.scrollTop();
      if (action === "edit" && this.edit >= 0) this.root.querySelector(`#pb-exercise-${this.edit}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch (error) { this.notify(error.message || "Couldn't update this plan.", true); }
  }

  async save() {
    if (!this.dirty || this.busy) return;
    let parsed;
    try { parsed = parsePlanFile(JSON.stringify(this.plan)); }
    catch (error) {
      if (!this.plan.name.trim() || !this.plan.dayOrder.length) this.view = "overview";
      else {
        const invalidDay = this.plan.dayOrder.find(day => !this.plan.workouts[day].length || this.plan.workouts[day].some(ex =>
          !String(ex.name || "").trim() || !String(ex.target || "").trim() || !Number.isInteger(Number(ex.sets)) || Number(ex.sets) < 1 || Number(ex.sets) > 50));
        if (invalidDay) {
          this.day = invalidDay;
          this.view = "day";
          this.edit = this.list.findIndex(ex => !String(ex.name || "").trim() || !String(ex.target || "").trim() || !Number.isInteger(Number(ex.sets)) || Number(ex.sets) < 1 || Number(ex.sets) > 50);
        }
      }
      this.render();
      this.notify(error.message.includes("Choose a plan file") ? "This plan is too large. Reduce its size before saving." : error.message, true);
      return;
    }
    const plan = { ...clonePlan(this.plan), ...parsed };
    this.busy = true;
    this.root.inert = true;
    this.updateStatus();
    try {
      const saved = await this.options.savePlan(plan);
      this.plans.set(plan.id, planDraft(saved || plan));
      this.drafts.delete(plan.id);
      this.persist();
      this.message = "Plan saved.";
      this.error = false;
    } catch (error) {
      this.message = error.code === "workout-in-progress" ? "Finish or discard your current workout before saving changes to the active plan. Your plan draft has been kept."
        : error.code === "plan-save-pending" ? "Saving is taking longer than expected. Your draft is kept. Check your connection before retrying."
        : "Couldn't save your plan. Your draft is still available.";
      this.error = true;
    } finally {
      this.busy = false;
      this.root.inert = false;
      this.render();
      if (this.error) this.root.querySelector(".pb-message")?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    }
  }
}
