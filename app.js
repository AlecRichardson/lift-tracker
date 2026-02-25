document.addEventListener("DOMContentLoaded", () => {

/* =====================
   WORKOUT DATA
===================== */

const workouts = {
  "Push A": [
    { name: "Barbell Bench Press", sets: 4 },
    { name: "Dumbbell Lateral Raise", sets: 4 },
    { name: "Incline Dumbbell Press", sets: 3 }
  ],
  "Push B": [
    { name: "Incline DB Press", sets: 4 },
    { name: "Dumbbell Lateral Raise", sets: 4 }
  ],
  "Pull A": [
    { name: "Barbell Row", sets: 4 },
    { name: "Hammer Curl", sets: 3 }
  ],
  "Pull B": [
    { name: "Lat Pulldown", sets: 4 },
    { name: "Barbell Curl", sets: 3 }
  ],
  "Legs": [
    { name: "Squat", sets: 4 },
    { name: "Leg Press", sets: 4 }
  ]
};

let currentWorkout = "Push A";
let chart;

/* =====================
   STORAGE
===================== */

function getLogs() {
  return JSON.parse(localStorage.getItem("workoutLogs") || "[]");
}

function saveLogs(logs) {
  localStorage.setItem("workoutLogs", JSON.stringify(logs));
}

/* =====================
   NAVIGATION
===================== */

const drawer = document.getElementById("drawer");

document.getElementById("hamburger-btn")
  .addEventListener("click", () => drawer.classList.add("open"));

document.getElementById("close-drawer")
  .addEventListener("click", () => drawer.classList.remove("open"));

function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById("page-" + id).classList.remove("hidden");
  drawer.classList.remove("open");
}

/* =====================
   RENDER WORKOUT
===================== */

function renderWorkout() {
  const container = document.getElementById("exercise-container");
  container.innerHTML = "";
  document.getElementById("workout-title").textContent = currentWorkout;

  workouts[currentWorkout].forEach(ex => {
    const row = document.createElement("div");
    row.className = "exercise-row";

    const header = document.createElement("div");
    header.className = "exercise-header";
    header.textContent = ex.name;

    const setsDiv = document.createElement("div");
    setsDiv.style.display = "none";

    header.addEventListener("click", () => {
      setsDiv.style.display =
        setsDiv.style.display === "none" ? "block" : "none";
    });

    for (let i = 0; i < ex.sets; i++) {
      const setRow = document.createElement("div");
      setRow.className = "set-row";

      setRow.innerHTML = `
        <input type="number" placeholder="Reps">
        <input type="number" placeholder="Weight">
      `;

      setsDiv.appendChild(setRow);
    }

    row.appendChild(header);
    row.appendChild(setsDiv);
    container.appendChild(row);
  });
}

/* =====================
   SAVE WORKOUT
===================== */

document.getElementById("save-workout")
  .addEventListener("click", () => {

    const exercises = [];

    document.querySelectorAll(".exercise-row").forEach(row => {
      const name = row.querySelector(".exercise-header").textContent;
      const sets = [];

      row.querySelectorAll(".set-row").forEach(setRow => {
        const inputs = setRow.querySelectorAll("input");
        sets.push({
          r: Number(inputs[0].value) || 0,
          w: Number(inputs[1].value) || 0
        });
      });

      exercises.push({ n: name, s: sets });
    });

    const logs = getLogs();

    logs.push({
      t: new Date().toISOString(),
      w: currentWorkout,
      e: exercises
    });

    saveLogs(logs);
    renderHistory();
    renderChart();

    alert("Workout Saved 💪");
  });

/* =====================
   HISTORY
===================== */

function renderHistory() {
  const container = document.getElementById("history-container");
  container.innerHTML = "";

  const logs = getLogs().reverse();

  logs.forEach(log => {
    const item = document.createElement("div");
    item.className = "history-item";
    item.textContent =
      `${new Date(log.t).toLocaleDateString()} - ${log.w}`;
    container.appendChild(item);
  });
}

/* =====================
   CHART
===================== */

function renderChart() {
  const logs = getLogs();
  const filter = document.getElementById("exercise-filter");

  filter.innerHTML = "";

  const exerciseSet = new Set();

  logs.forEach(log =>
    log.e.forEach(ex => exerciseSet.add(ex.n))
  );

  exerciseSet.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    filter.appendChild(opt);
  });

  if (!filter.value) return;

  const labels = logs.map(l =>
    new Date(l.t).toLocaleDateString()
  );

  const data = logs.map(log => {
    const ex = log.e.find(e => e.n === filter.value);
    if (!ex) return 0;
    return ex.s.reduce((sum, set) => sum + set.w, 0) / ex.s.length;
  });

  if (chart) chart.destroy();

  chart = new Chart(
    document.getElementById("progressChart"),
    {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: filter.value,
          data,
          borderColor: "#7289da"
        }]
      }
    }
  );
}

document.getElementById("exercise-filter")
  .addEventListener("change", renderChart);

/* =====================
   WORKOUT NAV BUTTONS
===================== */

document.querySelectorAll(".nav-workout")
  .forEach(btn => {
    btn.addEventListener("click", () => {
      currentWorkout = btn.dataset.workout;
      renderWorkout();
      showPage("workout");
    });
  });

document.getElementById("nav-progress")
  .addEventListener("click", () => {
    renderChart();
    showPage("progress");
  });

document.getElementById("nav-history")
  .addEventListener("click", () => {
    renderHistory();
    showPage("history");
  });

renderWorkout();

});
