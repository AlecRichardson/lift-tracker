import assert from "node:assert/strict";
import test from "node:test";
import { getBestPreviousExerciseContext } from "./history-context.mjs";
import { getExerciseRecommendation } from "./recommendations.mjs";

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
