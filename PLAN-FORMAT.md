# Portable Workout Plans

Open **Plan > Plans & files**:

- **Export Active Plan** downloads the complete saved regimen, including all days and their order. Save pending edits first.
- **Download Template** downloads an editable six-day example, independent of your existing plan. Its sample exercises are examples, not a personalized prescription.
- **Import Plan** opens a file preview. Expand each day to inspect the exercises. **Save as New Plan** creates a separate saved plan; it never merges days, replaces the active plan, or imports workout history.
- Choose a saved plan and **Make Active** to switch the dashboard and workout logging. The previous plan remains in the list. Unfinished workout drafts remain associated with their original plan; unsaved plan edits require confirmation before switching.

The existing complete workout-data export can also be imported: only its `activePlan` section is used, never its history or account identity.

## File Format

The downloadable template uses JSON with this structure:

```json
{
  "format": "lift-tracker-plan",
  "version": 1,
  "name": "My New Split",
  "dayOrder": ["Push A"],
  "workouts": {
    "Push A": [
      {
        "id": "barbell_bench_press",
        "name": "Barbell Bench Press",
        "sets": 4,
        "target": "6-10",
        "rest": "2-3 min",
        "type": "compound",
        "equipment": "barbell",
        "superset": "",
        "note": "",
        "lastAlias": ["Bench Press"]
      }
    ]
  }
}
```

Day order must contain every day exactly once. Each day contains 1-40 exercises, each with 1-50 integer sets and text target reps. Files support up to 50 days and 512 KB. Optional exercise fields default to empty values. Missing IDs are generated from the exercise name; existing IDs are preserved exactly.

## Revising in Another Conversation

Attach your exported plan or starter template and ask:

> Revise this regimen and return an importable Lift Tracker plan file in the same format. Keep the existing IDs and aliases for unchanged exercises. Give genuinely different exercises their own IDs, especially different equipment variants. Preserve all day names/order unless intentionally changing them. Do not include workout history or account IDs.

Exercise history is still looked up across plans. Gym, pulley, equipment, and workout-day/position safeguards continue to determine starting weights and tips. A different plan does not reset completed history, but a genuinely different exercise or incompatible setup must not inherit unrelated weights.

## Discarding a Session

The Workout screen has a close button beside the gym controls. It asks for confirmation, then clears only that day/plan/account's unfinished draft, stops its timers, and returns Home. Previously saved workouts and other drafts are not deleted.

## Verification

Automated coverage includes real-default-plan round trips, the standalone template, history carryover, malformed/oversized imports, account/document identity exclusion, import saving, activation success/failure/cancellation, and workout discard/cancellation. Browser access was unavailable during this implementation; verify the file picker, preview, downloads, saved-plan switching, and discard confirmation on iPhone.
