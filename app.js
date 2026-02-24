// ---------- Workout Data with Sets × Rep Ranges ----------
const workouts = {
  "Push A": [
    { name: "Barbell Bench Press", sets: 4, repRange: "8–10" },
    { name: "Dumbbell Lateral Raise", sets: 4, repRange: "12–15" },
    { name: "Incline Dumbbell Press", sets: 3, repRange: "8–10" },
    { name: "Rope Tricep Pushdowns", sets: 3, repRange: "10–12" },
    { name: "Overhead DB Tricep Extension", sets: 3, repRange: "10" },
    { name: "Face Pulls", sets: 3, repRange: "12–15" }
  ],
  "Push B": [
    { name: "Incline DB Press", sets: 4, repRange: "8–10" },
    { name: "Dumbbell Lateral Raise", sets: 4, repRange: "12–15" },
    { name: "Machine Chest Press", sets: 3, repRange: "10" },
    { name: "Face Pulls", sets: 3, repRange: "12–15" },
    { name: "Assisted Dips", sets: 3, repRange: "8–10" },
    { name: "Rope Tricep Pushdowns", sets: 2, repRange: "12" }
  ],
  "Pull A": [
    { name: "Barbell Bent-Over Row", sets: 4, repRange: "8–10" },
    { name: "Dumbbell Hammer Curl", sets: 4, repRange: "10" },
    { name: "Lat Pulldown", sets: 3, repRange: "8–10" },
    { name: "Barbell Curl", sets: 3, repRange: "10" },
    { name: "Seated Cable Row", sets: 3, repRange: "10" },
    { name: "Cable Curl", sets: 2, repRange: "12" }
  ],
  "Pull B": [
    { name: "Lat Pulldown (diff grip)", sets: 4, repRange: "8–10" },
    { name: "Barbell Curl", sets: 4, repRange: "8–10" },
    { name: "Seated Row", sets: 3, repRange: "10" },
    { name: "Dumbbell Hammer Curl", sets: 3, repRange: "10" },
    { name: "Rear Delt Fly", sets: 3, repRange: "12–15" }
  ],
  "Legs": [
    { name: "Squat", sets: 4, repRange: "8–10" },
    { name: "Leg Curl", sets: 4, repRange: "8–10" },
    { name: "Leg Press", sets: 4, repRange: "8–12" },
    { name: "Leg Extension", sets: 2, repRange: "12–15" }
  ]
};

// ---------- Global Variables ----------
let currentWorkout = "Push A";
let chart = null;

// ---------- Switch Workout ----------
function switchWorkout(name) {
  currentWorkout = name;
  document.getElementById("workout-title").innerText = name;
  renderExercises();
  prefillLastWorkout();
}

// ---------- Render Exercises ----------
function renderExercises() {
  const container = document.getElementById("exercise-container");
  container.innerHTML = "";

  workouts[currentWorkout].forEach((ex, i) => {
    const row = document.createElement("div");
    row.className = "exercise-row";

    let isCustom = typeof ex === "object" && ex.custom;
    let name = ex.name;
    let sets = ex.sets || "";
    let repRange = ex.repRange || "";

    row.innerHTML = `
      <label>${name} ${sets ? `(${sets}x${repRange})` : ""}</label>
      <input type="number" placeholder="Reps" min="0">
      <input type="number" placeholder="Weight" min="0">
      <input type="checkbox">
      ${isCustom ? '<button class="remove-btn">Remove</button>' : ''}
    `;

    if (isCustom) {
      row.querySelector(".remove-btn").addEventListener("click", () => {
        workouts[currentWorkout].splice(i, 1);
        renderExercises();
      });
    }

    container.appendChild(row);
  });
}

// ---------- Add Custom Exercise ----------
function addCustomExercise() {
  const name = prompt("Enter exercise name:");
  if (!name) return;

  workouts[currentWorkout].push({ name: name, custom: true, sets: "", repRange: "" });
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

// ---------- Chart Progress with PR Highlight ----------
function updateChart() {
  const filter = document.getElementById("exercise-filter").value;
  const logs = JSON.parse(localStorage.getItem("workoutLogs") || "[]");

  let datasets = [];
  let labels = logs.map(l => new Date(l.t).toLocaleDateString());

  const prMap = {};

  if (filter === "all") {
    const allEx = new Set();
    logs.forEach(l => l.e.forEach(ex => allEx.add(ex.n)));
    datasets = Array.from(allEx).map(name => {
      const data = logs.map(l => {
        const ex = l.e.find(e => e.n === name);
        if (!ex) return null;
        if (ex.w > (prMap[name] || 0)) prMap[name] = ex.w;
        return ex.w;
      });
      return {
        label: `${name} (PR: ${prMap[name] || 0})`,
        data,
        borderColor: getRandomColor(),
        fill: false
      };
    });
  } else {
    let maxWeight = 0;
    const data = logs.map(l => {
      const ex = l.e.find(e => e.n === filter);
      if (!ex) return null;
      if (ex.w > maxWeight) maxWeight = ex.w;
      return ex.w;
    });
    datasets = [{
      label: `${filter} (PR: ${maxWeight})`,
      data,
      borderColor: "blue",
      fill: false
    }];
  }

  if (chart) chart.destroy();
  const ctx = document.getElementById("progressChart").getContext("2d");
  chart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: { responsive: true, scales: { y: { beginAtZero: true } } }
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
