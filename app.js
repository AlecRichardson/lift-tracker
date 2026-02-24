// ---------- Workout Data ----------
const workouts = {
  "Push A": [
    "Barbell Bench Press", "Dumbbell Lateral Raise",
    "Incline Dumbbell Press", "Rope Tricep Pushdowns",
    "Overhead DB Tricep Extension", "Face Pulls"
  ],
  "Push B": [
    "Incline DB Press", "Dumbbell Lateral Raise",
    "Machine Chest Press", "Face Pulls",
    "Assisted Dips", "Rope Tricep Pushdowns"
  ],
  "Pull A": [
    "Barbell Bent-Over Row", "Dumbbell Hammer Curl",
    "Lat Pulldown", "Barbell Curl",
    "Seated Cable Row", "Cable Curl"
  ],
  "Pull B": [
    "Lat Pulldown (diff grip)", "Barbell Curl",
    "Seated Row", "Dumbbell Hammer Curl",
    "Rear Delt Fly"
  ],
  "Legs": [
    "Squat", "Leg Curl", "Leg Press", "Leg Extension"
  ]
};

let currentWorkout = "Push A";
let chart = null;

// ---------- UI Rendering ----------
function switchWorkout(name) {
  currentWorkout = name;
  document.getElementById("workout-title").innerText = name;
  renderExercises();
  prefillLastWorkout();
}

function renderExercises() {
  const container = document.getElementById("exercise-container");
  container.innerHTML = "";
  workouts[currentWorkout].forEach(ex => {
    const row = document.createElement("div");
    row.className = "exercise-row";
    row.innerHTML = `
      <label>${ex}</label>
      <input type="number" placeholder="Reps" min="0">
      <input type="number" placeholder="Weight" min="0">
      <input type="checkbox">
    `;
    container.appendChild(row);
  });
}

// ---------- Add Custom Exercise ----------
function addCustomExercise() {
  const name = prompt("Enter exercise name:");
  if (!name) return;
  workouts[currentWorkout].push(name);
  renderExercises();
}

// ---------- Reset Workout ----------
function resetWorkout() {
  document.querySelectorAll("#exercise-container .exercise-row").forEach(row => {
    row.querySelectorAll("input").forEach(input => {
      if (input.type === "checkbox") input.checked = false;
      else input.value = "";
    });
  });
}

// ---------- Save Workout ----------
function saveWorkout() {
  const rows = document.querySelectorAll("#exercise-container .exercise-row");
  const exercises = [];
  rows.forEach(row => {
    const [nameLabel, repsInput, weightInput, checkbox] = row.children;
    exercises.push({
      n: nameLabel.innerText,
      r: Number(repsInput.value) || 0,
      w: Number(weightInput.value) || 0,
      c: checkbox.checked
    });
  });

  const log = {
    t: new Date().toISOString(),
    w: currentWorkout,
    e: exercises
  };

  // Save to localStorage
  let logs = JSON.parse(localStorage.getItem("workoutLogs") || "[]");
  logs.push(log);
  localStorage.setItem("workoutLogs", JSON.stringify(logs));

  // Download small .txt file
  const blob = new Blob([JSON.stringify(log)], {type: "text/plain"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${currentWorkout}_${Date.now()}.txt`;
  a.click();

  alert("Workout saved!");
  updateChart();
}

// ---------- Pre-fill Last Workout ----------
function prefillLastWorkout() {
  const logs = JSON.parse(localStorage.getItem("workoutLogs") || "[]").reverse();
  for (let log of logs) {
    if (log.w === currentWorkout) {
      const rows = document.querySelectorAll("#exercise-container .exercise-row");
      rows.forEach((row, i) => {
        if (log.e[i]) {
          const [_, repsInput, weightInput, checkbox] = row.children;
          repsInput.value = log.e[i].r || "";
          weightInput.value = log.e[i].w || "";
          checkbox.checked = log.e[i].c || false;
        }
      });
      break;
    }
  }
}

// ---------- Chart Progress ----------
function updateChart() {
  const filter = document.getElementById("exercise-filter").value;
  const logs = JSON.parse(localStorage.getItem("workoutLogs") || "[]");

  let datasets = [];
  let labels = logs.map(l => new Date(l.t).toLocaleDateString());

  if (filter === "all") {
    // Show all exercises (simplified: last 3 exercises per workout)
    const allEx = new Set();
    logs.forEach(l => l.e.forEach(ex => allEx.add(ex.n)));
    datasets = Array.from(allEx).map(name => {
      return {
        label: name,
        data: logs.map(l => {
          const ex = l.e.find(e => e.n === name);
          return ex ? ex.w : null;
        }),
        borderColor: getRandomColor(),
        fill: false
      };
    });
  } else {
    datasets = [{
      label: filter,
      data: logs.map(l => {
        const ex = l.e.find(e => e.n === filter);
        return ex ? ex.w : null;
      }),
      borderColor: "blue",
      fill: false
    }];
  }

  if (chart) chart.destroy();
  const ctx = document.getElementById("progressChart").getContext("2d");
  chart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  updateExerciseFilter();
}

// ---------- Exercise Filter Dropdown ----------
function updateExerciseFilter() {
  const filter = document.getElementById("exercise-filter");
  const allEx = new Set();
  const logs = JSON.parse(localStorage.getItem("workoutLogs") || "[]");
  logs.forEach(l => l.e.forEach(ex => allEx.add(ex.n)));
  const currentOptions = Array.from(filter.options).map(o => o.value);
  allEx.forEach(name => {
    if (!currentOptions.includes(name)) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.text = name;
      filter.appendChild(opt);
    }
  });
}

// ---------- Helpers ----------
function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i=0;i<6;i++) color += letters[Math.floor(Math.random()*16)];
  return color;
}

// ---------- Init ----------
switchWorkout(currentWorkout);
updateChart();
