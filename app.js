document.addEventListener("DOMContentLoaded", () => {

/* =====================
   TEMPLATES
===================== */

const workouts = {
  "Push A": [
    { name: "Barbell Bench Press", sets: 4, repRange: "8–10" },
    { name: "Dumbbell Lateral Raise", sets: 4, repRange: "12–15" },
    { name: "Incline Dumbbell Press", sets: 3, repRange: "8–10" }
  ],
  "Push B": [
    { name: "Incline DB Press", sets: 4, repRange: "8–10" },
    { name: "Dumbbell Lateral Raise", sets: 4, repRange: "12–15" }
  ],
  "Pull A": [
    { name: "Barbell Row", sets: 4, repRange: "8–10" },
    { name: "Hammer Curl", sets: 3, repRange: "10" }
  ],
  "Pull B": [
    { name: "Lat Pulldown", sets: 4, repRange: "8–10" },
    { name: "Barbell Curl", sets: 3, repRange: "10" }
  ],
  "Legs": [
    { name: "Squat", sets: 4, repRange: "8–10" },
    { name: "Leg Press", sets: 4, repRange: "8–12" }
  ]
};

let currentWorkout = "Push A";
let chart = null;

/* =====================
   UTIL
===================== */

function getLogs() {
  return JSON.parse(localStorage.getItem("workoutLogs") || "[]");
}

function toggleDrawer() {
  document.getElementById("drawer").classList.toggle("open");
}

function saveLogs(logs) {
  localStorage.setItem("workoutLogs", JSON.stringify(logs));
}

/* =====================
   AUTO SAVE (LIVE)
===================== */

function saveTempWorkout() {
  const rows = document.querySelectorAll(".exercise-row");
  const exercises = [];

  rows.forEach(row => {
    const name = row.dataset.name;
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

  localStorage.setItem("tempWorkout", JSON.stringify({
    w: currentWorkout,
    e: exercises
  }));
}

function loadTempWorkout() {
  const temp = JSON.parse(localStorage.getItem("tempWorkout") || "null");
  if (!temp || temp.w !== currentWorkout) return;

  document.querySelectorAll(".exercise-row").forEach((row, i) => {
    temp.e[i]?.s.forEach((set, j) => {
      const inputs = row.querySelectorAll(".set-row")[j].querySelectorAll("input");
      inputs[0].value = set.r;
      inputs[1].value = set.w;
    });
  });
}

/* =====================
   WORKOUT RENDER
===================== */

function renderWorkout() {
  const container = document.getElementById("exercise-container");
  container.innerHTML = "";
  document.getElementById("workout-title").textContent = currentWorkout;

  workouts[currentWorkout].forEach(ex => {

    const row = document.createElement("div");
    row.className = "exercise-row";
    row.dataset.name = ex.name;

    const header = document.createElement("div");
    header.className = "exercise-header";
    header.innerHTML = `<span>${ex.name} (${ex.sets}x${ex.repRange})</span>
                        <span class="progress-link">View Progress</span>`;

    const setContainer = document.createElement("div");
    setContainer.className = "set-container";
    setContainer.style.display = "none";

    header.addEventListener("click", () => {
      setContainer.style.display =
        setContainer.style.display === "none" ? "block" : "none";
    });

    header.querySelector(".progress-link").addEventListener("click", e => {
      e.stopPropagation();
      saveTempWorkout();
      document.getElementById("exercise-filter").value = ex.name;
      updateChart();
      showPage("progress");
    });

    for (let i = 0; i < ex.sets; i++) {
      const setRow = document.createElement("div");
      setRow.className = "set-row";
      setRow.innerHTML = `
        <span>Set ${i+1}</span>
        <input type="number" placeholder="Reps">
        <input type="number" placeholder="Weight">
      `;

      setRow.querySelectorAll("input").forEach(input => {
        input.addEventListener("input", saveTempWorkout);
      });

      setContainer.appendChild(setRow);
    }

    row.appendChild(header);
    row.appendChild(setContainer);
    container.appendChild(row);
  });

  loadTempWorkout();
}

/* =====================
   SAVE WORKOUT
===================== */

document.getElementById("save-workout").addEventListener("click", () => {

  const rows = document.querySelectorAll(".exercise-row");
  const exercises = [];

  rows.forEach(row => {
    const sets = [];

    row.querySelectorAll(".set-row").forEach(setRow => {
      const inputs = setRow.querySelectorAll("input");
      sets.push({
        r: Number(inputs[0].value) || 0,
        w: Number(inputs[1].value) || 0
      });
    });

    exercises.push({ n: row.dataset.name, s: sets });
  });

  const logs = getLogs();
  logs.push({
    t: new Date().toISOString(),
    w: currentWorkout,
    e: exercises
  });

  saveLogs(logs);
  localStorage.removeItem("tempWorkout");

  alert("Workout Saved 💪");
  updateChart();
});

/* =====================
   CHART
===================== */

function calculateMetric(ex, type) {
  if (type === "avg")
    return ex.s.reduce((a,b)=>a+b.w,0)/ex.s.length;

  if (type === "volume")
    return ex.s.reduce((a,b)=>a+(b.w*b.r),0);

  if (type === "max")
    return Math.max(...ex.s.map(s=>s.w));
}

function updateChart() {
  const filter = document.getElementById("exercise-filter").value;
  const type = document.getElementById("chart-type")?.value || "avg";
  const logs = getLogs();

  const labels = logs.map(l => new Date(l.t).toLocaleDateString());

  const data = logs.map(l => {
    const ex = l.e.find(e=>e.n===filter);
    if(!ex) return null;
    return calculateMetric(ex,type);
  });

  if (chart) chart.destroy();

  chart = new Chart(document.getElementById("progressChart"), {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: filter,
        data,
        borderColor: "#7289DA"
      }]
    },
    options: {
      responsive:true,
      scales:{ y:{ beginAtZero:false } }
    }
  });
}

/* =====================
   EXPORT / IMPORT
===================== */

document.getElementById("export-data")?.addEventListener("click", () => {
  const blob = new Blob([localStorage.getItem("workoutLogs")], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "workouts.json";
  a.click();
});

document.getElementById("import-data")?.addEventListener("change", e => {
  const reader = new FileReader();
  reader.onload = function() {
    localStorage.setItem("workoutLogs", reader.result);
    alert("Imported!");
    updateChart();
  };
  reader.readAsText(e.target.files[0]);
});

/* =====================
   NAV
===================== */

function showPage(page){
  document.querySelectorAll(".page").forEach(p=>p.style.display="none");
  document.getElementById("page-"+page).style.display="block";
}

renderWorkout();
showPage("workout");

});
