import assert from "node:assert/strict";
import test from "node:test";
import { getBestPreviousExerciseContext } from "./history-context.mjs";
import { applyRecommendationContext, getExerciseRecommendation } from "./recommendations.mjs";

const incline = {
  exerciseId: "incline_dumbbell_press",
  exerciseName: "Incline DB Press",
  aliases: ["Incline Dumbbell Press"],
  selectedGym: "Ultimate"
};

function log({ id, day, date, gym = "Ultimate", exercises }) {
  return {
    id,
    d: day,
    t: date,
    gym,
    e: exercises
  };
}

function exercise({ id = "incline_dumbbell_press", name = "Incline DB Press", reps, weight, pulley = "", plannedIndex }) {
  return {
    id,
    n: name,
    pulley,
    plannedIndex,
    s: reps.map(rep => ({ reps: rep, weight, done: true }))
  };
}

test("Push A Incline uses previous Push A context, not newer Push B global entry", () => {
  const context = getBestPreviousExerciseContext({
    ...incline,
    workoutDay: "Push A",
    plannedIndex: 1,
    logs: [
      log({
        id: "push-a-old",
        day: "Push A",
        date: "2026-06-01T12:00:00Z",
        exercises: [exercise({ reps: [10, 9, 6], weight: 55, plannedIndex: 1 })]
      }),
      log({
        id: "push-b-new",
        day: "Push B",
        date: "2026-06-03T12:00:00Z",
        exercises: [exercise({ reps: [10, 10, 10], weight: 60, plannedIndex: 0 })]
      })
    ]
  });

  assert.equal(context.selectedEntry.workoutDay, "Push A");
  assert.equal(context.selectedExercise.s[0].weight, 55);
  assert.equal(context.matchType, "same_workout_day_same_position");
  assert.equal(context.globalReferenceEntry.workoutDay, "Push B");
});

test("Push B Incline uses previous Push B context, not Push A", () => {
  const context = getBestPreviousExerciseContext({
    ...incline,
    workoutDay: "Push B",
    plannedIndex: 0,
    logs: [
      log({
        id: "push-a",
        day: "Push A",
        date: "2026-06-04T12:00:00Z",
        exercises: [exercise({ reps: [10, 9, 6], weight: 55, plannedIndex: 1 })]
      }),
      log({
        id: "push-b",
        day: "Push B",
        date: "2026-06-02T12:00:00Z",
        exercises: [exercise({ reps: [10, 10, 10], weight: 60, plannedIndex: 0 })]
      })
    ]
  });

  assert.equal(context.selectedEntry.workoutDay, "Push B");
  assert.equal(context.selectedExercise.s[0].weight, 60);
});

test("falls back to global exercise history when same-day history is missing", () => {
  const context = getBestPreviousExerciseContext({
    ...incline,
    workoutDay: "Push A",
    plannedIndex: 1,
    logs: [
      log({
        id: "push-b",
        day: "Push B",
        date: "2026-06-03T12:00:00Z",
        exercises: [exercise({ reps: [10, 10, 10], weight: 60, plannedIndex: 0 })]
      })
    ]
  });

  assert.equal(context.selectedEntry.workoutDay, "Push B");
  assert.equal(context.matchType, "global_fallback");
  assert.equal(context.confidence, "low");
});

test("planned index disambiguates the same exercise twice in one workout", () => {
  const context = getBestPreviousExerciseContext({
    exerciseId: "cable_row",
    exerciseName: "Cable Row",
    workoutDay: "Pull A",
    plannedIndex: 4,
    logs: [
      log({
        id: "pull-a",
        day: "Pull A",
        date: "2026-06-04T12:00:00Z",
        exercises: [
          exercise({ id: "cable_row", name: "Cable Row", reps: [10, 10, 10], weight: 80, plannedIndex: 1 }),
          exercise({ id: "cable_row", name: "Cable Row", reps: [12, 12], weight: 45, plannedIndex: 4 })
        ]
      })
    ]
  });

  assert.equal(context.selectedEntry.plannedIndex, 4);
  assert.equal(context.selectedExercise.s[0].weight, 45);
});

test("pulley variants stay separated for context suggestions", () => {
  const context = getBestPreviousExerciseContext({
    exerciseId: "seated_row",
    exerciseName: "Seated Row",
    workoutDay: "Pull B",
    plannedIndex: 1,
    pulleyVariant: "single",
    logs: [
      log({
        id: "double-new",
        day: "Pull A",
        date: "2026-06-05T12:00:00Z",
        exercises: [exercise({ id: "seated_row", name: "Seated Row", reps: [10, 10, 10], weight: 120, pulley: "double" })]
      }),
      log({
        id: "single-old",
        day: "Pull A",
        date: "2026-06-01T12:00:00Z",
        exercises: [exercise({ id: "seated_row", name: "Seated Row", reps: [10, 10, 10], weight: 70, pulley: "single" })]
      })
    ]
  });

  assert.equal(context.selectedExercise.pulley, "single");
  assert.equal(context.selectedExercise.s[0].weight, 70);
  assert.equal(context.matchType, "same_variant");
  assert.equal(context.globalReferenceExercise.pulley, "double");
});

test("machine rear delt does not use newer dumbbell rear delt history", () => {
  const context = getBestPreviousExerciseContext({
    exerciseId: "machine_rear_delt_fly",
    exerciseName: "Machine Rear Delt Fly",
    aliases: ["Rear Delt Fly", "Dumbbell Rear Delt Fly"],
    equipment: "machine",
    workoutDay: "Pull A",
    plannedIndex: 3,
    logs: [
      log({
        id: "machine-old",
        day: "Pull A",
        date: "2026-06-01T12:00:00Z",
        exercises: [
          exercise({
            id: "machine_rear_delt_fly",
            name: "Machine Rear Delt Fly",
            reps: [15, 15, 12],
            weight: 70,
            plannedIndex: 3
          })
        ]
      }),
      log({
        id: "dumbbell-new",
        day: "Pull B",
        date: "2026-06-05T12:00:00Z",
        exercises: [
          exercise({
            id: "dumbbell_rear_delt_fly",
            name: "Dumbbell Rear Delt Fly",
            reps: [15, 15, 15],
            weight: 15,
            plannedIndex: 3
          })
        ]
      })
    ]
  });

  assert.equal(context.selectedExercise.id, "machine_rear_delt_fly");
  assert.equal(context.selectedExercise.s[0].weight, 70);
  assert.equal(context.globalReferenceExercise.id, "machine_rear_delt_fly");
});

test("machine rear delt has no fallback when only dumbbell rear delt exists", () => {
  const context = getBestPreviousExerciseContext({
    exerciseId: "machine_rear_delt_fly",
    exerciseName: "Machine Rear Delt Fly",
    aliases: ["Rear Delt Fly", "Dumbbell Rear Delt Fly"],
    equipment: "machine",
    workoutDay: "Pull A",
    plannedIndex: 3,
    logs: [
      log({
        id: "dumbbell-only",
        day: "Pull B",
        date: "2026-06-05T12:00:00Z",
        exercises: [
          exercise({
            id: "dumbbell_rear_delt_fly",
            name: "Dumbbell Rear Delt Fly",
            reps: [15, 15, 15],
            weight: 15,
            plannedIndex: 3
          })
        ]
      })
    ]
  });

  assert.equal(context.selectedExercise, null);
  assert.equal(context.matchType, "none");
});

test("context helper does not mutate existing saved workout logs", () => {
  const logs = [
    log({
      id: "push-b",
      day: "Push B",
      date: "2026-06-03T12:00:00Z",
      exercises: [exercise({ reps: [10, 10, 10], weight: 60, plannedIndex: 0 })]
    })
  ];
  const before = JSON.stringify(logs);

  getBestPreviousExerciseContext({
    ...incline,
    workoutDay: "Push A",
    plannedIndex: 1,
    logs
  });

  assert.equal(JSON.stringify(logs), before);
});

test("progression tip uses context-selected entry instead of global latest", () => {
  const context = getBestPreviousExerciseContext({
    ...incline,
    workoutDay: "Push A",
    plannedIndex: 1,
    logs: [
      log({
        id: "push-a-old",
        day: "Push A",
        date: "2026-06-01T12:00:00Z",
        exercises: [exercise({ reps: [10, 9, 6], weight: 55, plannedIndex: 1 })]
      }),
      log({
        id: "push-b-new",
        day: "Push B",
        date: "2026-06-03T12:00:00Z",
        exercises: [exercise({ reps: [10, 10, 10], weight: 60, plannedIndex: 0 })]
      })
    ]
  });
  const tip = getExerciseRecommendation(
    { name: "Incline DB Press", target: "8-10", type: "compound" },
    context.selectedExercise
  );

  assert.equal(context.selectedExercise.s[0].weight, 55);
  assert.notEqual(tip.label, "Increase weight");
});

const cableRow = {
  exerciseId: "seated_row", exerciseName: "Seated Row", equipment: "cable",
  workoutDay: "Pull A", plannedIndex: 1, selectedGym: "Gym B", pulleyVariant: "single"
};

function rowLog(day, gym, pulley, weight, date = "2026-11-10T12:00:00Z") {
  return log({ id: `${day}-${gym}-${pulley}-${weight}`, day, gym, date,
    exercises: [exercise({ id: "seated_row", name: "Seated Row", reps: [10, 10], weight, pulley, plannedIndex: 1 })] });
}

test("same gym wins over same workout day at another gym", () => {
  const context = getBestPreviousExerciseContext({ ...cableRow, logs: [
    rowLog("Pull A", "Gym A", "single", 120, "2026-11-12T12:00:00Z"),
    rowLog("Pull B", "Gym B", "single", 70)
  ] });
  assert.equal(context.selectedExercise.s[0].weight, 70);
  assert.equal(context.selectedEntry.gym, "Gym B");
  assert.equal(context.globalReferenceExercise.s[0].weight, 120);
});

test("same-day lookup excludes conflicting pulley before position matching", () => {
  const context = getBestPreviousExerciseContext({ ...cableRow, logs: [
    rowLog("Pull A", "Gym B", "double", 120, "2026-11-12T12:00:00Z"),
    rowLog("Pull A", "Gym B", "single", 70)
  ] });
  assert.equal(context.selectedExercise.s[0].weight, 70);
  assert.equal(context.selectedExercise.pulley, "single");
});

test("cables at other gyms and unknown locations remain reference only", () => {
  for (const gym of ["Gym A", ""]) {
    const context = getBestPreviousExerciseContext({ ...cableRow, logs: [rowLog("Pull A", gym, "single", 120)] });
    assert.equal(context.selectedExercise, null);
    assert.equal(context.globalReferenceExercise.s[0].weight, 120);
    assert.equal(context.confidence, "none");
  }
});

test("unknown or conflicting pulley is reference only when a setup is selected", () => {
  for (const pulley of ["double", ""]) {
    const context = getBestPreviousExerciseContext({ ...cableRow, logs: [rowLog("Pull A", "Gym B", pulley, 120)] });
    assert.equal(context.selectedExercise, null);
    assert.ok(context.globalReferenceExercise);
  }
});

test("gym matching ignores case and extra spaces", () => {
  const context = getBestPreviousExerciseContext({ ...cableRow, selectedGym: "  GYM   B ",
    logs: [rowLog("Pull A", "gym b", "single", 70)] });
  assert.equal(context.selectedExercise.s[0].weight, 70);
});

test("machine weight never silently falls back to another gym", () => {
  const context = getBestPreviousExerciseContext({ exerciseId: "machine_chest_press",
    exerciseName: "Machine Chest Press", equipment: "machine", selectedGym: "Gym B", workoutDay: "Push A",
    logs: [log({ id: "machine", day: "Push A", gym: "Gym A", date: "2026-11-10",
      exercises: [exercise({ id: "machine_chest_press", name: "Machine Chest Press", reps: [12], weight: 120 })] })] });
  assert.equal(context.selectedExercise, null);
  assert.ok(context.globalReferenceExercise);
});

test("free weights allow a clearly labeled low confidence cross-gym fallback", () => {
  const context = getBestPreviousExerciseContext({ ...incline, selectedGym: "Gym B", workoutDay: "Push A",
    logs: [log({ id: "incline", day: "Push A", gym: "Gym A", date: "2026-11-10",
      exercises: [exercise({ reps: [10, 10, 10], weight: 55 })] })] });
  assert.equal(context.selectedExercise.s[0].weight, 55);
  assert.equal(context.matchType, "global_fallback");
  assert.equal(context.confidence, "low");
  assert.match(context.reason, /Gym A/);
  assert.match(context.reason, /No history at Gym B/);
  const baseTip = getExerciseRecommendation({ name: "Incline DB Press", target: "8-10", type: "compound" }, context.selectedExercise);
  assert.equal(baseTip.label, "Increase weight");
  assert.equal(applyRecommendationContext(baseTip, context, "Gym B").label, "Check working weight");
  assert.equal(applyRecommendationContext(baseTip, context, "Gym A").label, "Increase weight");
});

test("swapped actual exercise finds same-gym history across workout days", () => {
  const context = getBestPreviousExerciseContext({ exerciseId: "machine_rear_delt_fly",
    exerciseName: "Machine Rear Delt Fly", equipment: "machine", actualName: "DB Rear Delt Fly",
    selectedGym: "Gym B", workoutDay: "Pull A", logs: [log({ id: "swap", day: "Pull B", gym: "Gym B", date: "2026-11-10",
      exercises: [exercise({ id: "dumbbell_rear_delt_fly", name: "Dumbbell Rear Delt Fly", reps: [15, 15, 15], weight: 15 })] })] });
  assert.equal(context.selectedExercise.id, "dumbbell_rear_delt_fly");
  assert.equal(context.selectedEntry.workoutDay, "Pull B");
});

test("free-weight same-gym history wins even when another gym matches the day", () => {
  const context = getBestPreviousExerciseContext({ ...incline, selectedGym: "Gym B", workoutDay: "Push A",
    logs: [
      log({ id: "other-gym", day: "Push A", gym: "Gym A", date: "2026-11-12",
        exercises: [exercise({ reps: [10, 10, 10], weight: 60 })] }),
      log({ id: "same-gym", day: "Push B", gym: "Gym B", date: "2026-11-10",
        exercises: [exercise({ reps: [10, 9, 8], weight: 55 })] })
    ] });
  assert.equal(context.selectedExercise.s[0].weight, 55);
  assert.equal(context.globalReferenceExercise.s[0].weight, 60);
});

test("an unspecified position uses latest same-day history rather than treating null as zero", () => {
  const context = getBestPreviousExerciseContext({ ...incline, workoutDay: "Push A", plannedIndex: null,
    logs: [
      log({ id: "new-position", day: "Push A", date: "2026-11-12",
        exercises: [exercise({ reps: [10, 9, 8], weight: 60, plannedIndex: 2 })] }),
      log({ id: "old-position", day: "Push A", date: "2026-11-10",
        exercises: [exercise({ reps: [10, 9, 8], weight: 55, plannedIndex: 0 })] })
    ] });
  assert.equal(context.selectedExercise.s[0].weight, 60);
  assert.equal(context.matchType, "same_workout_day");
});
