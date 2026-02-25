document.addEventListener("DOMContentLoaded", () => {

/* =========================
   WORKOUT TEMPLATES
========================= */

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

/* =========================
   PAGE NAVIGATION
========================= */

function showPage(page) {
  document.querySelectorAll(".page").forEach(p => p.style.display = "none");
  document.getElementById("page-" + page).style.display = "block";
}

const drawer = document.getElementById("hamburger-menu");

document.querySelector(".hamburger-btn").addEventListener("click", () => {
  drawer.classList.toggle("open");
});

document.querySelector(".close-btn").addEventListener("click", () => {
  drawer.classList.remove("open");
});

document.querySelectorAll(".template-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    saveTempWorkout();
    currentWorkout = btn.dataset.workout;
    renderWorkout();
    loadTempWorkout();
    showPage("workout");
    drawer.classList.remove("open");
  });
});

document.getElementById("drawer-history").addEventListener("click", () => {
  saveTempWorkout();
  renderHistory();
  showPage("history");
  drawer.classList.remove("open");
});

document.getElementById("drawer-progress").addEventListener("click", () => {
  saveTempWorkout();
  updateChart();
  showPage("progress");
  drawer.classList.remove("open");
});

/* =========================
   WORKOUT RENDER
========================= */

function renderWorkout() {
  document.getElementById("workout-title").textContent = currentWorkout;
  const container = document.getElementById("exercise-container");
  container.innerHTML = "";

  workouts[currentWorkout].forEach(ex => {

    const row = document.createElement("div");
    row.className = "exercise-row";

    const header = document.createElement("div");
    header.className = "exercise-header";

    header.innerHTML = `
      <span>${ex.name} (${ex.sets}x${ex.repRange})</span>
      <span class="progress-link">View Progress</span>
    `;

    const setContainer = document.createElement("div");
    setContainer.className = "set-container";
    setContainer.style.display = "none"; // collapsed default

    for (let i = 0; i < ex.sets; i++) {
      const setRow = document.createElement("div");
      setRow.className = "set-row";

      setRow.innerHTML = `
        <span>Set ${i + 1}</span>
        <input type="number" placeholder="Reps" min="0">
        <input type="number" placeholder="Weight" min="0">
        <input type="checkbox">
      `;

      setContainer.appendChild(setRow);
    }

    header.addEventListener("click", () => {
      setContainer.style.display =
        setContainer.style.display === "none" ? "block" : "none";
    });

    header.querySelector(".progress-link").addEventListener("click", (e) => {
      e.stopPropagation();
      saveTempWorkout();
      document.getElementById("exercise-filter").value = ex.name;
      updateChart();
      showPage("progress");
    });

    row.appendChild(header);
    row.appendChild(setContainer);
    container.appendChild(row);
  });
}

/* =========================
   TEMP WORKOUT SAVE / LOAD
========================= */

function saveTempWorkout() {
  const rows = document.querySelectorAll("#exercise-container .exercise-row");
  const exercises = [];

  rows.forEach(row => {
    const exName = row.querySelector(".exercise-header span").innerText.split(" (")[0];
    const sets = [];

    row.querySelectorAll(".set-row").forEach(setRow => {
      const inputs = setRow.querySelectorAll("input");
      sets.push({
        r: Number(inputs[0].value) || 0,
        w: Number(inputs[1].value) || 0,
        c: inputs[2].checked
      });
    });

    exercises.push({ n: exName, s: sets });
  });

  const tempWorkout = {
    w: currentWorkout,
    e: exercises
  };

  localStorage.setItem("tempWorkout", JSON.stringify(tempWorkout));
}

function loadTempWorkout() {
  const temp = JSON.parse(localStorage.getItem("tempWorkout") || "null");
  if (!temp || temp.w !== currentWorkout) return;

  const rows = document.querySelectorAll("#exercise-container .exercise-row");

  rows.forEach((row, i) => {
    if (!temp.e[i]) return;

    temp.e[i].s.forEach((set, j) => {
      const inputs = row.querySelectorAll(".set-row")[j].querySelectorAll("input");
      inputs[0].value = set.r;
      inputs[1].value = set.w;
      inputs[2].checked = set.c;
    });
  });
}

/* =========================
   SAVE WORKOUT (PERMANENT)
========================= */

document.getElementById("save-workout").addEventListener("click", () => {
  const rows = document.querySelectorAll("#exercise-container .exercise-row");
  const exercises = [];

  rows.forEach(row => {
    const exName = row.querySelector(".exercise-header span").innerText.split(" (")[0];
    const sets = [];

    row.querySelectorAll(".set-row").forEach(setRow => {
      const inputs = setRow.querySelectorAll("input");
      sets.push({
        r: Number(inputs[0].value) || 0,
        w: Number(inputs[1].value) || 0
      });
    });

    exercises.push({ n: exName, s: sets });
  });

  const log = {
    t: new Date().toISOString(),
    w: currentWorkout,
    e: exercises
  };

  const logs = JSON.parse(localStorage.getItem("workoutLogs") || "[]");
  logs.push(log);
  localStorage.setItem("workoutLogs", JSON.stringify(logs));

  localStorage.removeItem("tempWorkout");

  alert("Workout Saved!");
  updateExerciseFilter();
  updateChart();
});

/* =========================
   HISTORY
========================= */

function renderHistory() {
  const container = document.getElementById("history-container");
  container.innerHTML = "";

  const logs = JSON.parse(localStorage.getItem("workoutLogs") || "[]").reverse();

  logs.forEach(log => {
    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `${log.w} - ${new Date(log.t).toLocaleString()}`;

    const detail = document.createElement("div");
    detail.style.display = "none";
    detail.style.marginTop = "12px";

    div.addEventListener("click", () => {
      detail.style.display =
        detail.style.display === "none" ? "block" : "none";
    });

    log.e.forEach(ex => {
      const exDiv = document.createElement("div");
      exDiv.className = "exercise-row";
      exDiv.innerHTML = `<strong>${ex.n}</strong>`;

      ex.s.forEach((set, i) => {
        const row = document.createElement("div");
        row.className = "set-row";
        row.innerHTML = `
          Set ${i + 1}
          <input type="number" value="${set.r}">
          <input type="number" value="${set.w}">
        `;
        row.addEventListener("click", e => e.stopPropagation());
        exDiv.appendChild(row);
      });

      detail.appendChild(exDiv);
    });

    div.appendChild(detail);
    container.appendChild(div);
  });
}

/* =========================
   CHART
========================= */

function updateExerciseFilter() {
  const logs = JSON.parse(localStorage.getItem("workoutLogs") || "[]");
  const set = new Set();

  logs.forEach(l => l.e.forEach(ex => set.add(ex.n)));

  const filter = document.getElementById("exercise-filter");
  filter.innerHTML = `<option value="all">All Exercises</option>`;

  set.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    filter.appendChild(opt);
  });

  filter.addEventListener("change", updateChart);
}

function updateChart() {
  const filter = document.getElementById("exercise-filter").value;
  const logs = JSON.parse(localStorage.getItem("workoutLogs") || "[]");

  const labels = logs.map(l =>
    new Date(l.t).toLocaleDateString()
  );

  const data = logs.map(l => {
    const ex = l.e.find(e => e.n === filter);
    if (!ex) return null;
    return ex.s.reduce((a, b) => a + b.w, 0) / ex.s.length;
  });

  if (chart) chart.destroy();

  const ctx = document.getElementById("progressChart").getContext("2d");

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: filter,
        data: data,
        borderColor: "#7289DA",
        fill: false
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: false }
      }
    }
  });
}

/* =========================
   INIT
========================= */

renderWorkout();
loadTempWorkout();
renderHistory();
updateExerciseFilter();
updateChart();
showPage("workout");

});
