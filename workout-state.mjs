export function workoutDraftKey(userId, planId, day) {
  return `draftWorkoutV5:${JSON.stringify([userId, planId, day])}`;
}

// Extra exercises belong only to the session draft, never to the saved plan.
export function getSessionExercises(draft) {
  return Object.entries(draft?.exercises || {}).flatMap(([sessionKey, entry]) => {
    const exercise = entry?.sessionTemplate;
    if (!exercise || typeof exercise.name !== "string" || !exercise.name.trim() ||
      !Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 20) return [];
    return [{ name: exercise.name, id: exercise.id, sets: exercise.sets,
      target: "Any reps", rest: "", sessionKey }];
  });
}

export function getWeightFillTargets(sets, sourceIndex) {
  const source = sets[sourceIndex];
  if (!source || !(source.editedWeight || source.done) || String(source.weight ?? "").trim() === "" ||
    !Number.isFinite(Number(source.weight)) || Number(source.weight) < 0) return [];
  return sets.flatMap((set, index) => index > sourceIndex && !set.done && !set.editedWeight &&
    (String(set.weight ?? "").trim() === "" || Number(set.weight) !== Number(source.weight)) ? [index] : []);
}

export function isMatchingWorkoutDraft(draft, { userId, planId, day }) {
  return Boolean(userId && draft && draft.userId === userId &&
    draft.planId === planId && draft.day === day && typeof draft.gym === "string");
}

// Preserve deliberate blanks and zeroes as well as entered/completed values.
export function getSetPrefill(previousSet, draftSet) {
  const done = Boolean(draftSet?.done);
  const editedReps = Boolean(draftSet && (done || draftSet.editedReps));
  const editedWeight = Boolean(draftSet && (done || draftSet.editedWeight));
  return {
    reps: (editedReps ? draftSet.reps : previousSet?.reps) ?? "",
    weight: (editedWeight ? draftSet.weight : previousSet?.weight) ?? "",
    editedReps,
    editedWeight,
    done
  };
}

// Called only after the user explicitly assigns an old draft to this account/gym.
export function claimLegacyWorkoutDraft(legacy, { userId, planId, day, gym }) {
  if (!userId || legacy?.day !== day || legacy?.planId !== planId || !legacy.exercises || typeof gym !== "string") return null;
  return {
    userId, planId, day, gym,
    exercises: Object.fromEntries(Object.entries(legacy.exercises).map(([key, entry]) => [key, {
      ...(Array.isArray(entry) ? {} : entry),
      sets: (Array.isArray(entry) ? entry : entry?.sets || []).map(set => ({
        ...set, editedReps: true, editedWeight: true
      }))
    }]))
  };
}
