const FORM_WARNING_WORDS = [
  "hard",
  "sloppy",
  "jerky",
  "bad form",
  "not clean"
];

export function getExerciseRecommendation(exercise, previousExercise) {
  const target = parseTargetRange(exercise?.target || "");
  const sets = getWorkingSets(previousExercise?.s || []);
  const noteText = `${exercise?.note || ""} ${previousExercise?.note || ""}`;
  const hasFormWarning = hasFormWarningNote(noteText);

  if (!previousExercise || !sets.length) {
    return {
      label: "No prior data",
      reason: "There is not enough saved history for this exercise yet.",
      action: "Use a conservative starting weight and save the workout.",
      confidence: "New"
    };
  }

  if (!target) {
    return {
      label: "Repeat and track",
      reason: `Last time: ${formatSetPattern(sets)}.`,
      action: "Use the last working weight and focus on clean reps.",
      confidence: "Basic"
    };
  }

  const profile = analyzeSetPattern(sets, target);
  const liftType = getLiftType(exercise);

  if (profile.anyBelowMinimum) {
    return {
      label: "Repeat or reduce",
      reason: `At least one set fell below the ${target.low}-${target.high} target range.`,
      action: "Repeat this weight only if form was solid; reduce slightly if reps broke down.",
      confidence: "Caution"
    };
  }

  if (hasFormWarning) {
    return {
      label: "Repeat weight",
      reason: "Your note suggests the last session was hard or form was not clean.",
      action: "Repeat this weight and make the reps cleaner before increasing.",
      confidence: "Form"
    };
  }

  if (profile.allAtTop && profile.consistentLoad) {
    return {
      label: "Increase weight",
      reason: `You hit ${formatRepPattern(profile.reps)} in the ${target.low}-${target.high} target range.`,
      action: "Try a small weight increase next time and keep reps clean.",
      confidence: "Strong"
    };
  }

  if (liftType === "compound" && profile.nearTop && profile.finalSet >= target.high - 1 && !profile.largeDropOff) {
    return {
      label: "Almost ready",
      reason: `You were near the top range, with the final set at ${profile.finalSet}.`,
      action: "A small increase is reasonable if form was clean; otherwise repeat once.",
      confidence: "Moderate"
    };
  }

  if (profile.largeDropOff) {
    const finalSetGoalLow = Math.max(target.low, target.high - 2);
    return {
      label: "Repeat weight",
      reason: `Early sets were strong, but the final set dropped to ${profile.finalSet}.`,
      action: `Repeat this weight until the final set reaches ${finalSetGoalLow}-${target.high} clean reps.`,
      confidence: "Moderate"
    };
  }

  if (liftType !== "compound" && profile.nearTop) {
    return {
      label: "Repeat weight",
      reason: `Accessory lifts need cleaner consistency before increasing. Last time: ${formatRepPattern(profile.reps)}.`,
      action: `Repeat this weight until every set is close to ${target.high} clean reps.`,
      confidence: "Form"
    };
  }

  return {
    label: "Repeat weight",
    reason: `Last time was ${formatRepPattern(profile.reps)} in the ${target.low}-${target.high} target range.`,
    action: "Repeat this weight and aim to add clean reps before increasing.",
    confidence: "Moderate"
  };
}

export function parseTargetRange(targetText) {
  const numbers = String(targetText || "")
    .match(/\d+/g)
    ?.map(Number)
    .filter(number => Number.isFinite(number)) || [];

  if (!numbers.length) return null;

  const low = Math.min(numbers[0], numbers[1] || numbers[0]);
  const high = Math.max(numbers[0], numbers[1] || numbers[0]);

  return { low, high };
}

export function getWorkingSets(sets) {
  return (sets || [])
    .map(set => ({
      reps: Number(set.reps) || 0,
      weight: Number(set.weight) || 0,
      done: Boolean(set.done)
    }))
    .filter(set => set.reps > 0 && set.weight > 0);
}

function analyzeSetPattern(sets, target) {
  const reps = sets.map(set => set.reps);
  const weights = sets.map(set => set.weight);
  const firstSet = reps[0] || 0;
  const finalSet = reps[reps.length - 1] || 0;
  const firstWeight = weights[0] || 0;

  return {
    reps,
    finalSet,
    anyBelowMinimum: reps.some(rep => rep < target.low),
    allAtTop: reps.every(rep => rep >= target.high),
    nearTop: reps.every(rep => rep >= target.high - 1),
    largeDropOff: firstSet >= target.high && firstSet - finalSet >= 3,
    consistentLoad: firstWeight > 0 && weights.every(weight => Math.abs(weight - firstWeight) < 0.001)
  };
}

function getLiftType(exercise) {
  return String(exercise?.type || "").toLowerCase().includes("compound")
    ? "compound"
    : "accessory";
}

function hasFormWarningNote(noteText) {
  const normalized = String(noteText || "").toLowerCase();
  return FORM_WARNING_WORDS.some(word => normalized.includes(word));
}

function formatRepPattern(reps) {
  return reps.join("/");
}

function formatSetPattern(sets) {
  return sets.map(set => `${set.reps}x${roundNumber(set.weight)}`).join(", ");
}

function roundNumber(value) {
  const number = Number(value) || 0;
  return Number.isInteger(number) ? number : Number(number.toFixed(1));
}
