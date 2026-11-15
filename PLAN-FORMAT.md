# Portable Workout Plans

Open **Plans**:

- **New Plan** creates a separate, recoverable draft. Add days, then use **Add Exercises** to search and select several exercises or create your own.
- Open any plan, then its **Plan actions** menu to **Export Plan** or **Duplicate Plan**. Exports include the entire saved regimen and its day order. Save pending edits first.
- **Download Plan Template** downloads an editable six-day example, independent of your existing plan. Its sample exercises are examples, not a personalized prescription.
- **Import Plan** opens a file preview. Expand each day to inspect the exercises. **Save as New Plan** creates a separate saved plan; it never merges days, replaces the active plan, or imports workout history.
- Open a saved plan and choose **Make Active** to switch the dashboard and workout logging. The previous plan remains in the list. Unfinished workout drafts remain associated with their original plan, and other plan drafts are retained rather than discarded.

## Editing and Recovery

Open a day, then tap an exercise or its edit icon. **Exercise name** is the first field; sets, reps, and rest edit in place. More options includes notes, equipment, type, and a **Superset with** selector showing exercise names. Reordering moves linked exercises together. Days can be renamed, duplicated, and reordered.

There is one **Save Changes** action for the whole regimen, not a separate Save Exercise step. Draft changes are kept on this device for the signed-in account, including incomplete fields. Saved plans follow the account; device drafts do not sync across devices. Invalid fields prevent saving, and failed saves keep the draft for retry. The Plan actions menu can explicitly discard unsaved plan changes after confirmation.

Renaming keeps the exercise ID, preserves existing aliases, and remembers the previous name for older name-only history. Use **Replace Exercise** when choosing a genuinely different lift; it adopts that exercise's identity instead. Saving an inactive plan does not activate it. Editing an active plan while an entered workout is unfinished requires finishing or discarding that workout first; the plan draft remains available meanwhile.

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

Automated coverage includes real-default-plan round trips, template/history carryover, malformed imports, account/document identity exclusion, draft recovery, inline edits, catalogs, supersets, save retries, inactive-plan saving, activation, and workout discard. Browser access was unavailable during the builder redesign; verify its screens and file flows on iPhone. See `PLAN-BUILDER-REDESIGN.md`.
