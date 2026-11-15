import { canonicalExerciseName, exerciseSlug, normalizeExerciseName } from "./history-context.mjs";

export const clonePlan = value => structuredClone(value);
const forbidden = new Set(["__proto__", "prototype", "constructor"]);
export const validDayName = name => typeof name === "string" && Boolean(name.trim()) && name.length <= 100 && !forbidden.has(name);

export function planDraft(plan) {
  const workouts = clonePlan(plan.workouts || {});
  const days = Object.keys(workouts);
  const order = [...new Set([...(plan.dayOrder || []).filter(day => days.includes(day)), ...days])];
  return { id: plan.id, name: plan.name || "New Plan", workouts, dayOrder: order, createdAt: plan.createdAt || "" };
}

export function addPlanDay(plan, name, copyFrom = "") {
  name = name.trim();
  if (!validDayName(name)) throw new Error("Enter a valid day name.");
  if (plan.dayOrder.length >= 50) throw new Error("Use up to 50 days per plan.");
  if (Object.hasOwn(plan.workouts, name)) throw new Error("That day name is already in this plan.");
  plan.workouts[name] = copyFrom ? clonePlan(plan.workouts[copyFrom]) : [];
  plan.dayOrder.push(name);
  return name;
}

export function renamePlanDay(plan, oldName, name) {
  name = name.trim();
  if (!validDayName(name)) throw new Error("Enter a valid day name.");
  if (name !== oldName && Object.hasOwn(plan.workouts, name)) throw new Error("That day name is already in this plan.");
  plan.workouts = Object.fromEntries(plan.dayOrder.map(day => [day === oldName ? name : day, plan.workouts[day]]));
  plan.dayOrder = plan.dayOrder.map(day => day === oldName ? name : day);
  return name;
}

export function duplicateDayName(plan, day) {
  const base = day.slice(0, 90);
  let name = `${base} Copy`;
  let count = 2;
  while (Object.hasOwn(plan.workouts, name)) name = `${base} Copy ${count++}`;
  return name;
}

export function updatePlanExercise(exercise, field, value) {
  if (!["name", "sets", "target", "rest", "note", "type", "equipment"].includes(field)) return;
  exercise[field] = value;
}

function cleanSupersets(list) {
  for (const exercise of list) {
    if (exercise.superset && list.filter(other => other.superset === exercise.superset).length < 2) exercise.superset = "";
  }
}

export function pairPlanExercises(list, index, partnerIndex) {
  const exercise = list[index];
  if (!exercise) return index;
  exercise.superset = "";
  cleanSupersets(list);
  if (!Number.isInteger(partnerIndex) || !list[partnerIndex] || partnerIndex === index) return index;
  const partner = list[partnerIndex];
  const used = new Set(list.map(entry => entry.superset).filter(Boolean));
  let group = partner.superset;
  if (!group) {
    let n = 0;
    while (used.has(String.fromCharCode(65 + n))) n++;
    group = String.fromCharCode(65 + n);
  }
  partner.superset = group;
  exercise.superset = group;
  // Group members stay adjacent because workout logging renders contiguous supersets.
  const members = list.filter(entry => entry.superset === group);
  const insertAt = list.findIndex(entry => entry.superset === group);
  const rest = list.filter(entry => entry.superset !== group);
  rest.splice(insertAt, 0, ...members);
  list.splice(0, list.length, ...rest);
  return list.indexOf(exercise);
}

export function removePlanExercise(list, index) {
  list.splice(index, 1);
  cleanSupersets(list);
}

export function movePlanExercise(list, index, direction) {
  const exercise = list[index];
  if (!exercise) return index;
  const units = [];
  const seen = new Set();
  for (const item of list) {
    if (item.superset) {
      if (seen.has(item.superset)) continue;
      seen.add(item.superset);
      units.push(list.filter(other => other.superset === item.superset));
    } else units.push([item]);
  }
  const position = units.findIndex(unit => unit.includes(exercise));
  const next = position + direction;
  if (next < 0 || next >= units.length) return index;
  [units[position], units[next]] = [units[next], units[position]];
  list.splice(0, list.length, ...units.flat());
  return list.indexOf(exercise);
}

function equipmentLabel(exercise) {
  const explicit = exercise.equipment || "";
  if (explicit) return explicit;
  return ["dumbbell", "barbell", "cable", "machine", "bodyweight"].find(word => normalizeExerciseName(exercise.name).includes(word)) || "";
}

export function buildExerciseCatalog(plans, logs = []) {
  const entries = new Map();
  const identities = new Set();
  const add = exercise => {
    if (typeof exercise?.name !== "string" || !exercise.name.trim()) return;
    const equipment = equipmentLabel(exercise);
    const key = `${canonicalExerciseName(exercise.name)}::${normalizeExerciseName(equipment)}`;
    const id = exercise.id || exerciseSlug(exercise.name);
    const identity = `${id}::${normalizeExerciseName(equipment)}`;
    if (entries.has(key) || identities.has(identity)) return;
    identities.add(identity);
    entries.set(key, { id, name: exercise.name,
      sets: Number(exercise.sets) || 3, target: exercise.target || "8-10", rest: exercise.rest || "90 sec",
      equipment, type: exercise.type || "", note: exercise.note || "", superset: "",
      lastAlias: Array.isArray(exercise.lastAlias) ? [...exercise.lastAlias] : [] });
  };
  plans.forEach(plan => Object.values(plan.workouts || {}).forEach(list => list.forEach(add)));
  [...logs].sort((a, b) => new Date(b.t) - new Date(a.t)).forEach(log => (log.e || []).forEach(exercise => {
    const actualEquipment = equipmentLabel({ name: exercise.n });
    const known = [...entries.values()].find(entry => entry.id === exercise.id);
    const conflict = known?.equipment && actualEquipment && normalizeExerciseName(known.equipment) !== normalizeExerciseName(actualEquipment);
    add({ id: exercise.swapped || conflict ? exerciseSlug(exercise.n) : exercise.id,
      name: exercise.n, equipment: actualEquipment || known?.equipment || "", sets: exercise.s?.length || 3 });
  }));
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function restorePlanDrafts(text) {
  if (!text || text.length > 2000000) return [];
  try {
    const value = JSON.parse(text);
    if (value.version !== 1 || !Array.isArray(value.drafts)) return [];
    return value.drafts.filter(plan => typeof plan?.id === "string" && Boolean(plan.id.trim()) && !plan.id.includes("/") && plan.id.length <= 160 &&
      typeof plan.name === "string" && plan.name.length <= 120 && Array.isArray(plan.dayOrder) && plan.dayOrder.length <= 50 &&
      plan.workouts && !Array.isArray(plan.workouts) && new Set(plan.dayOrder).size === plan.dayOrder.length &&
      Object.keys(plan.workouts).length === plan.dayOrder.length && plan.dayOrder.every(day => validDayName(day) &&
        Object.hasOwn(plan.workouts, day) && Array.isArray(plan.workouts[day]) && plan.workouts[day].length <= 40 &&
        plan.workouts[day].every(exercise => exercise && typeof exercise.id === "string" && exercise.id.length <= 160 && typeof exercise.name === "string" && exercise.name.length <= 160 &&
          ["number", "string"].includes(typeof exercise.sets) &&
          ["target", "rest", "type", "equipment", "note", "superset"].every(key => exercise[key] == null || typeof exercise[key] === "string") &&
          (!exercise.lastAlias || (Array.isArray(exercise.lastAlias) && exercise.lastAlias.every(alias => typeof alias === "string"))))));
  } catch { return []; }
}
