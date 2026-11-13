export function getBestPreviousExerciseContext({
  logs = [],
  exerciseId = "",
  exerciseName = "",
  aliases = [],
  workoutDay = "",
  plannedIndex = null,
  actualName = "",
  pulleyVariant = "",
  selectedGym = "",
  equipment = "",
  allowFreeWeightFallback = true
} = {}) {
  const queryName = String(actualName || "").trim() || exerciseName;
  const candidates = getExerciseMatchCandidates({
    id: actualName ? exerciseSlug(queryName) : exerciseId,
    name: queryName,
    lastAlias: actualName ? [] : aliases,
    equipment: actualName ? "" : equipment
  });
  const preferredGym = normalizeGymKey(selectedGym);
  const preferredDay = String(workoutDay || "").trim();
  const preferredPulley = String(pulleyVariant || "").trim();
  const preferredIndex = plannedIndex !== null && plannedIndex !== "" && Number.isFinite(Number(plannedIndex)) ? Number(plannedIndex) : null;
  const entries = flattenExerciseHistory(logs)
    .filter(entry => exerciseMatchesCandidates(entry.exercise, candidates));
  const globalReferenceEntry = entries[0] || null;

  // Setup and location compatibility must be resolved before day/position ranking.
  const compatibleEntries = preferredPulley
    ? entries.filter(entry => entry.exercise?.pulley === preferredPulley)
    : entries;
  const sameGymEntries = preferredGym
    ? compatibleEntries.filter(entry => normalizeGymKey(entry.gym) === preferredGym)
    : compatibleEntries;
  const freeWeight = [...candidates.equipment].some(value => value === "dumbbell" || value === "barbell") &&
    ![...candidates.equipment].some(value => value === "machine" || value === "cable") && !preferredPulley;
  const crossGymFallback = Boolean(preferredGym && !sameGymEntries.length && freeWeight && allowFreeWeightFallback);
  const eligibleEntries = sameGymEntries.length ? sameGymEntries : crossGymFallback ? compatibleEntries : [];

  if (!eligibleEntries.length) {
    return buildContextResult({
      selectedEntry: null,
      matchType: "none",
      confidence: "none",
      globalReferenceEntry,
      reason: entries.length
        ? "No previous sets for this gym and setup. Other sessions are available as reference only."
        : "No previous history for this exercise."
    });
  }

  const select = (selectedEntry, matchType, confidence, reason) => buildContextResult({
    selectedEntry,
    globalReferenceEntry,
    matchType: crossGymFallback ? "global_fallback" : matchType,
    confidence: crossGymFallback ? "low" : confidence,
    reason: crossGymFallback
      ? `No history at ${normalizeName(selectedGym)}. Free-weight reference from ${selectedEntry.gym || "an unspecified gym"}; check the load before lifting.`
      : reason
  });

  const sameDayEntries = preferredDay
    ? eligibleEntries.filter(entry => entry.workoutDay === preferredDay)
    : [];

  if (sameDayEntries.length && preferredIndex !== null) {
    const samePosition = sameDayEntries.filter(entry => entry.plannedIndex === preferredIndex);
    const selectedEntry = samePosition[0];

    if (selectedEntry) {
      return select(selectedEntry, "same_workout_day_same_position", "high", `Based on your last ${preferredDay} session at this position.`);
    }
  }

  const sameDayEntry = sameDayEntries[0];
  if (sameDayEntry) {
    return select(sameDayEntry, "same_workout_day", "high", `Based on your last ${preferredDay} session.`);
  }

  if (preferredPulley) {
    const sameVariantEntry = eligibleEntries[0];

    if (sameVariantEntry) {
      return select(sameVariantEntry, "same_variant", "medium", `No ${preferredDay || "same-day"} history found, so this uses the same setup.`);
    }
  }

  return select(eligibleEntries[0], "global_fallback", "low", preferredDay
      ? `No ${preferredDay} history found, so this uses your latest matching entry.`
      : "Using your latest matching entry.");
}

export function getExerciseMatchCandidates(exerciseTemplate) {
  const names = [
    exerciseTemplate.name,
    ...(Array.isArray(exerciseTemplate.lastAlias) ? exerciseTemplate.lastAlias : [])
  ].filter(Boolean);
  const ids = [
    exerciseTemplate.id,
    exerciseSlug(exerciseTemplate.name)
  ].filter(Boolean);
  const equipment = equipmentTokens([
    exerciseTemplate.equipment,
    exerciseTemplate.name
  ].filter(Boolean).join(" "));
  const normalizedNames = names.flatMap(name => [
    normalizeExerciseName(name),
    canonicalExerciseName(name)
  ]).filter(Boolean);

  return {
    ids: new Set(ids),
    names: new Set(normalizedNames),
    equipment
  };
}

export function exerciseMatchesCandidates(savedExercise, candidates, options = {}) {
  const savedId = savedExercise.id || exerciseSlug(savedExercise.n || "");
  const savedNames = [savedExercise.n];

  if (options.includePlannedNames) {
    savedNames.push(savedExercise.plannedName, savedExercise.originalName);
  }

  if (savedId && candidates.ids.has(savedId)) {
    return true;
  }

  return savedNames.filter(Boolean).some(name =>
    !hasConflictingEquipment(name, candidates.equipment) && (
      candidates.names.has(normalizeExerciseName(name)) ||
      candidates.names.has(canonicalExerciseName(name)) ||
      candidates.ids.has(exerciseSlug(name))
    )
  );
}

export function normalizeExerciseName(name) {
  return String(name || "")
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/&/g, "and")
    .replace(/\bdb\b/g, "dumbbell")
    .replace(/\bbb\b/g, "barbell")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function exerciseSlug(name) {
  return normalizeExerciseName(name).replace(/\s+/g, "_");
}

export function canonicalExerciseName(name) {
  const tokens = normalizeExerciseName(name).split(" ").filter(Boolean);
  const equipment = tokens.filter(token => EQUIPMENT_WORDS.has(token));
  const rest = tokens.filter(token => !EQUIPMENT_WORDS.has(token));

  return [...equipment, ...rest].join(" ");
}

const EQUIPMENT_WORDS = new Set(["dumbbell", "barbell", "cable", "machine", "bodyweight"]);

function equipmentTokens(value) {
  return new Set(
    normalizeExerciseName(value)
      .split(" ")
      .filter(token => EQUIPMENT_WORDS.has(token))
  );
}

function hasConflictingEquipment(savedName, candidateEquipment = new Set()) {
  const savedEquipment = equipmentTokens(savedName);

  if (!savedEquipment.size || !candidateEquipment?.size) return false;

  return ![...savedEquipment].some(token => candidateEquipment.has(token));
}

function flattenExerciseHistory(logs) {
  return [...(logs || [])]
    .sort((a, b) => new Date(b.t) - new Date(a.t))
    .flatMap(log => (log.e || []).map((exercise, index) => ({
      exercise,
      workoutId: log.id || "",
      workoutDay: String(log.d || "").trim(),
      workoutAt: log.t || "",
      gym: normalizeName(log.gym || ""),
      plannedIndex: exercise.plannedIndex != null && exercise.plannedIndex !== "" && Number.isFinite(Number(exercise.plannedIndex))
        ? Number(exercise.plannedIndex)
        : index
    })));
}

function buildContextResult({ selectedEntry, globalReferenceEntry, matchType, confidence, reason }) {
  return {
    selectedEntry,
    selectedExercise: selectedEntry?.exercise || null,
    matchType,
    confidence,
    globalReferenceEntry,
    globalReferenceExercise: globalReferenceEntry?.exercise || null,
    reason
  };
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

export function normalizeGymKey(value) {
  return normalizeName(value).toLowerCase();
}
