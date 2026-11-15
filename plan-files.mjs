import { exerciseSlug } from "./history-context.mjs";

export const PLAN_FILE_LIMIT = 512 * 1024;

export async function waitForPlanSave(write, timeoutMs = 15000) {
  let timer;
  try {
    return await Promise.race([write, new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error("Plan save confirmation is delayed.");
        error.code = "plan-save-pending";
        reject(error);
      }, timeoutMs);
    })]);
  } finally { clearTimeout(timer); }
}
const plain = value => value && typeof value === "object" && !Array.isArray(value);
const safeKey = value => !["__proto__", "prototype", "constructor"].includes(value);

export function createPlanFile(plan) {
  return { format: "lift-tracker-plan", version: 1, name: plan.name,
    dayOrder: [...plan.dayOrder], workouts: structuredClone(plan.workouts) };
}

export function parsePlanFile(text) {
  if (new TextEncoder().encode(text).length > PLAN_FILE_LIMIT) throw new Error("Choose a plan file smaller than 512 KB.");
  let file;
  try { file = JSON.parse(text); } catch { throw new Error("Couldn't read this plan file. Check the file and try again."); }
  // Also accept the active-plan section of a complete workout export.
  const plan = file?.app === "Lift Tracker" && plain(file.activePlan) ? file.activePlan : file;
  if (plan?.format && (plan.format !== "lift-tracker-plan" || plan.version !== 1)) {
    throw new Error("This plan file version isn't supported.");
  }
  if (!plain(plan) || typeof plan.name !== "string" || !plan.name.trim() || plan.name.length > 120 || !plain(plan.workouts)) {
    throw new Error("The file needs a plan name and workout days.");
  }
  const days = Object.keys(plan.workouts);
  if (!days.length || days.length > 50 || days.some(day => !safeKey(day) || !day.trim() || day.length > 100)) {
    throw new Error("Use 1-50 named workout days.");
  }
  const dayOrder = plan.dayOrder ?? days;
  if (!Array.isArray(dayOrder) || dayOrder.length !== days.length || new Set(dayOrder).size !== days.length ||
    dayOrder.some(day => !days.includes(day))) throw new Error("Day order must include each workout day once.");
  const workouts = {};
  for (const day of dayOrder) {
    const list = plan.workouts[day];
    if (!Array.isArray(list) || !list.length || list.length > 40) throw new Error(`${day} needs 1-40 exercises.`);
    workouts[day] = list.map(exercise => {
      if (!plain(exercise) || typeof exercise.name !== "string" || !exercise.name.trim() || exercise.name.length > 160 ||
        !Number.isInteger(Number(exercise.sets)) || Number(exercise.sets) < 1 || Number(exercise.sets) > 50 ||
        typeof exercise.target !== "string" || !exercise.target.trim() || exercise.target.length > 80) {
        throw new Error(`${day}: each exercise needs a name, 1-50 sets, and target reps.`);
      }
      const normalized = { id: exercise.id ?? exerciseSlug(exercise.name), name: exercise.name.trim(),
        sets: Number(exercise.sets), target: exercise.target.trim() };
      if (typeof normalized.id !== "string" || !normalized.id.trim() || normalized.id.length > 160) {
        throw new Error(`${day}: an exercise has an invalid identifier.`);
      }
      for (const key of ["rest", "superset", "type", "equipment", "note"]) {
        const value = exercise[key] ?? "";
        if (typeof value !== "string" || value.length > (key === "note" ? 3000 : 160)) throw new Error(`${day}: check the exercise details.`);
        normalized[key] = value;
      }
      const aliases = exercise.lastAlias ?? [];
      if (!Array.isArray(aliases) || aliases.length > 40 || aliases.some(alias => typeof alias !== "string" || alias.length > 160)) {
        throw new Error(`${day}: check the exercise's alternative names.`);
      }
      normalized.lastAlias = [...aliases];
      return normalized;
    });
  }
  return { name: plan.name.trim(), dayOrder: [...dayOrder], workouts };
}

export function createPlanTemplate() {
  const days = ["Push A", "Pull A", "Legs A", "Push B", "Pull B", "Legs B"];
  const examples = [
    ["barbell_bench_press", "Barbell Bench Press", "barbell"],
    ["barbell_row", "Barbell Row", "barbell"],
    ["barbell_squat", "Barbell Squat", "barbell"],
    ["incline_dumbbell_press", "Incline Dumbbell Press", "dumbbell"],
    ["neutral_grip_lat_pulldown", "Neutral Grip Lat Pulldown", "cable"],
    ["leg_press", "Leg Press", "machine"]
  ];
  return createPlanFile({ name: "New Plan", dayOrder: days,
    workouts: Object.fromEntries(days.map((day, index) => {
      const [id, name, equipment] = examples[index];
      return [day, [{ id, name, sets: 3, target: "8-10", rest: "2 min", equipment,
        type: "compound", superset: "", note: "", lastAlias: [] }]];
    })) });
}
