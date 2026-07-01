window.workouts = {
  "Push A": [
    {
      id: "barbell_bench_press",
      name: "Barbell Bench Press",
      sets: 4,
      target: "6-10",
      rest: "2-3 min",
      type: "compound",
      equipment: "barbell",
      note: "Bench priority. Use the same working weight across sets.",
      superset: "",
      lastAlias: ["Bench Press"]
    },
    {
      id: "incline_dumbbell_press",
      name: "Incline DB Press",
      sets: 3,
      target: "8-10",
      rest: "60-90 sec",
      type: "compound",
      equipment: "dumbbell",
      note: "Use 2-3 sets.",
      superset: "",
      lastAlias: ["Incline Dumbbell Press", "Incline DB Press"]
    },
    {
      id: "seated_dumbbell_shoulder_press",
      name: "Seated DB Shoulder Press",
      sets: 2,
      target: "6-10",
      rest: "60-90 sec",
      type: "compound",
      equipment: "dumbbell",
      note: "",
      superset: "",
      lastAlias: ["Seated Dumbbell Shoulder Press", "DB Shoulder Press", "Dumbbell Shoulder Press"]
    },
    {
      id: "dumbbell_lateral_raise",
      name: "DB Lateral Raise",
      sets: 3,
      target: "12-15",
      rest: "60-90 sec",
      type: "accessory",
      equipment: "dumbbell",
      note: "",
      superset: "A",
      lastAlias: ["Dumbbell Lateral Raise", "DB Lateral Raise", "Lateral Raise"]
    },
    {
      id: "rope_tricep_pushdown",
      name: "Rope Tricep Pushdown",
      sets: 3,
      target: "10-12",
      rest: "60-90 sec",
      type: "accessory",
      equipment: "cable",
      note: "Use 2-3 sets.",
      superset: "A",
      lastAlias: ["Rope Pushdown", "Tricep Pushdown"]
    },
    {
      id: "face_pull",
      name: "Face Pull",
      sets: 2,
      target: "12-15",
      rest: "60-90 sec",
      type: "accessory",
      equipment: "cable",
      note: "",
      superset: "",
      lastAlias: []
    }
  ],

  "Pull A": [
    {
      id: "barbell_row",
      name: "Barbell Row",
      sets: 4,
      target: "6-10",
      rest: "2-3 min",
      type: "compound",
      equipment: "barbell",
      note: "Row priority.",
      superset: "",
      lastAlias: []
    },
    {
      id: "wide_grip_lat_pulldown",
      name: "Wide Grip Lat Pulldown",
      sets: 3,
      target: "8-10",
      rest: "60-90 sec",
      type: "compound",
      equipment: "cable",
      note: "",
      superset: "",
      lastAlias: ["Lat Pulldown Wide Grip", "Lat Pulldown"]
    },
    {
      id: "t_bar_machine_row",
      name: "T-Bar Machine Row",
      sets: 3,
      target: "8-10",
      rest: "60-90 sec",
      type: "compound",
      equipment: "machine",
      note: "",
      superset: "",
      lastAlias: ["T Bar Row", "T-Bar Row", "Machine T-Bar Row"]
    },
    {
      id: "machine_rear_delt_fly",
      name: "Machine Rear Delt Fly",
      sets: 3,
      target: "12-15",
      rest: "60-90 sec",
      type: "accessory",
      equipment: "machine",
      note: "Use controlled reps.",
      superset: "A",
      lastAlias: ["Rear Delt Fly", "DB Rear Delt Fly", "Dumbbell Rear Delt Fly"]
    },
    {
      id: "barbell_curl",
      name: "Barbell Curl",
      sets: 2,
      target: "8-10",
      rest: "60-90 sec",
      type: "accessory",
      equipment: "barbell",
      note: "",
      superset: "A",
      lastAlias: []
    },
    {
      id: "standing_hammer_curl",
      name: "Standing Hammer Curl",
      sets: 2,
      target: "10-12",
      rest: "60-90 sec",
      type: "accessory",
      equipment: "dumbbell",
      note: "",
      superset: "",
      lastAlias: ["Hammer Curl"]
    }
  ],

  "Legs": [
    {
      id: "squat_or_leg_press",
      name: "Barbell Squat OR Leg Press",
      sets: 4,
      target: "6-10",
      rest: "2-3 min",
      type: "compound",
      equipment: "barbell_or_machine",
      note: "Choose one main leg press/squat pattern.",
      superset: "",
      lastAlias: ["Squat OR Leg Press", "Squat", "Leg Press"]
    },
    {
      id: "seated_leg_curl",
      name: "Seated Leg Curl",
      sets: 3,
      target: "10-12",
      rest: "60-90 sec",
      type: "accessory",
      equipment: "machine",
      note: "Controlled reps with full stretch.",
      superset: "A",
      lastAlias: ["Leg Curl"]
    },
    {
      id: "leg_extension",
      name: "Leg Extension",
      sets: 3,
      target: "12-15",
      rest: "60-90 sec",
      type: "accessory",
      equipment: "machine",
      note: "",
      superset: "A",
      lastAlias: []
    },
    {
      id: "optional_lower_accessory",
      name: "Optional Lower Accessory",
      sets: 4,
      target: "10-15",
      rest: "60-90 sec",
      type: "accessory",
      equipment: "machine",
      note: "Optional: choose calf raise, hip abductor, or back extension. Use 2-4 sets.",
      superset: "",
      lastAlias: ["Calf Raise", "Calf Raises", "Hip Abductor", "Back Extension"]
    }
  ],

  "Push B": [
    {
      id: "incline_dumbbell_press",
      name: "Incline DB Press",
      sets: 3,
      target: "8-10",
      rest: "2 min",
      type: "compound",
      equipment: "dumbbell",
      note: "Incline priority.",
      superset: "",
      lastAlias: ["Incline Dumbbell Press", "Incline DB Press"]
    },
    {
      id: "machine_chest_press",
      name: "Machine Chest Press",
      sets: 3,
      target: "10-12",
      rest: "60-90 sec",
      type: "compound",
      equipment: "machine",
      note: "Use 2-3 sets.",
      superset: "",
      lastAlias: ["Chest Press"]
    },
    {
      id: "seated_dumbbell_shoulder_press",
      name: "Seated DB Shoulder Press",
      sets: 2,
      target: "8-10",
      rest: "60-90 sec",
      type: "compound",
      equipment: "dumbbell",
      note: "",
      superset: "",
      lastAlias: ["Seated Dumbbell Shoulder Press", "DB Shoulder Press", "Dumbbell Shoulder Press"]
    },
    {
      id: "dumbbell_lateral_raise",
      name: "DB Lateral Raise",
      sets: 3,
      target: "12-15",
      rest: "60-90 sec",
      type: "accessory",
      equipment: "dumbbell",
      note: "",
      superset: "A",
      lastAlias: ["Dumbbell Lateral Raise", "DB Lateral Raise", "Lateral Raise"]
    },
    {
      id: "rope_tricep_pushdown",
      name: "Rope Tricep Pushdown",
      sets: 2,
      target: "10-12",
      rest: "60-90 sec",
      type: "accessory",
      equipment: "cable",
      note: "",
      superset: "A",
      lastAlias: ["Rope Pushdown", "Tricep Pushdown"]
    },
    {
      id: "assisted_dip",
      name: "Assisted Dip",
      sets: 2,
      target: "8-10",
      rest: "60-90 sec",
      type: "compound",
      equipment: "machine",
      note: "",
      superset: "",
      lastAlias: ["Assisted Dips"]
    },
    {
      id: "face_pull",
      name: "Face Pull",
      sets: 2,
      target: "12-15",
      rest: "60-90 sec",
      type: "accessory",
      equipment: "cable",
      note: "Optional.",
      superset: "",
      lastAlias: []
    }
  ],

  "Pull B": [
    {
      id: "neutral_grip_lat_pulldown",
      name: "Neutral Grip Lat Pulldown",
      sets: 4,
      target: "8-10",
      rest: "2 min",
      type: "compound",
      equipment: "cable",
      note: "Lat / cable row priority.",
      superset: "",
      lastAlias: ["Lat Pulldown Neutral", "Lat Pulldown"]
    },
    {
      id: "seated_row",
      name: "Seated Row",
      sets: 3,
      target: "10",
      rest: "60-90 sec",
      type: "compound",
      equipment: "cable",
      note: "",
      superset: "",
      lastAlias: ["Seated Cable Row", "Cable Row"]
    },
    {
      id: "single_arm_cable_row",
      name: "Single Arm Cable Row",
      sets: 3,
      target: "10-12",
      rest: "60-90 sec",
      type: "compound",
      equipment: "cable",
      note: "",
      superset: "",
      lastAlias: ["One Arm Cable Row"]
    },
    {
      id: "machine_rear_delt_fly",
      name: "Machine Rear Delt Fly",
      sets: 3,
      target: "12-15",
      rest: "60-90 sec",
      type: "accessory",
      equipment: "machine",
      note: "Use controlled reps.",
      superset: "A",
      lastAlias: ["Rear Delt Fly", "DB Rear Delt Fly", "Dumbbell Rear Delt Fly"]
    },
    {
      id: "barbell_curl",
      name: "Barbell Curl",
      sets: 2,
      target: "8-10",
      rest: "60-90 sec",
      type: "accessory",
      equipment: "barbell",
      note: "",
      superset: "A",
      lastAlias: []
    },
    {
      id: "standing_hammer_curl",
      name: "Standing Hammer Curl",
      sets: 2,
      target: "10-12",
      rest: "60-90 sec",
      type: "accessory",
      equipment: "dumbbell",
      note: "",
      superset: "B",
      lastAlias: ["Hammer Curl"]
    },
    {
      id: "straight_arm_pulldown",
      name: "Straight Arm Pulldown",
      sets: 2,
      target: "12-15",
      rest: "60-90 sec",
      type: "accessory",
      equipment: "cable",
      note: "",
      superset: "B",
      lastAlias: []
    }
  ]
};
