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
  equipment = ""
} = {}) {
  const queryName = String(actualName || "").trim() || exerciseName;
  const candidates = getExerciseMatchCandidates({
    id: actualName ? exerciseSlug(queryName) : exerciseId,
    name: queryName,
    lastAlias: actualName ? [] : aliases,
    equipment: actualName ? "" : equipment
  });
  const preferredGym = normalizeName(selectedGym);
  const preferredDay = String(workoutDay || "").trim();
  const preferredPulley = String(pulleyVariant || "").trim();
  const preferredIndex = Number.isFinite(Number(plannedIndex)) ? Number(plannedIndex) : null;
  const entries = flattenExerciseHistory(logs)
    .filter(entry => exerciseMatchesCandidates(entry.exercise, candidates));
  const globalReferenceEntry = entries[0] || null;

  if (!entries.length) {
    return {
      selectedEntry: null,
      selectedExercise: null,
      matchType: "none",
      confidence: "none",
      globalReferenceEntry: null,
      globalReferenceExercise: null,
      reason: "No previous history for this exercise."
    };
  }

  const sameDayEntries = preferredDay
    ? entries.filter(entry => entry.workoutDay === preferredDay)
    : [];

  if (sameDayEntries.length && preferredIndex !== null) {
    const samePosition = sameDayEntries.filter(entry => entry.plannedIndex === preferredIndex);
    const selectedEntry = pickPreferredEntry(samePosition, preferredGym);

    if (selectedEntry) {
      return buildContextResult({
        selectedEntry,
        globalReferenceEntry,
        matchType: "same_workout_day_same_position",
        confidence: "high",
        reason: `Based on your last ${preferredDay} session at this position.`
      });
    }
  }

  const sameDayEntry = pickPreferredEntry(sameDayEntries, preferredGym);
  if (sameDayEntry) {
    return buildContextResult({
      selectedEntry: sameDayEntry,
      globalReferenceEntry,
      matchType: "same_workout_day",
      confidence: "high",
      reason: `Based on your last ${preferredDay} session.`
    });
  }

  if (preferredPulley) {
    const sameVariantEntry = pickPreferredEntry(
      entries.filter(entry => String(entry.exercise?.pulley || "") === preferredPulley),
      preferredGym
    );

    if (sameVariantEntry) {
      return buildContextResult({
        selectedEntry: sameVariantEntry,
        globalReferenceEntry,
        matchType: "same_variant",
        confidence: "medium",
        reason: `No ${preferredDay || "same-day"} history found, so this uses the same setup.`
      });
    }
  }

  const fallbackEntry = pickPreferredEntry(entries, preferredGym) || globalReferenceEntry;

  return buildContextResult({
    selectedEntry: fallbackEntry,
    globalReferenceEntry,
    matchType: "global_fallback",
    confidence: "low",
    reason: preferredDay
      ? `No ${preferredDay} history found, so this uses your latest matching entry.`
      : "Using your latest matching entry."
  });
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
      plannedIndex: Number.isFinite(Number(exercise.plannedIndex))
        ? Number(exercise.plannedIndex)
        : index
    })));
}

function pickPreferredEntry(entries, preferredGym = "") {
  if (!entries.length) return null;

  if (preferredGym) {
    const sameGymEntry = entries.find(entry => entry.gym === preferredGym);
    if (sameGymEntry) return sameGymEntry;
  }

  return entries[0] || null;
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
