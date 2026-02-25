document.addEventListener("DOMContentLoaded", () => {

  // ------------------------------
  // 1️⃣ WORKOUT TEMPLATES
  // ------------------------------
  const workouts = {
    "Push A": [
      { name: "Barbell Bench Press", sets: 4 },
      { name: "Dumbbell Lateral Raise", sets: 4 },
      { name: "Incline Dumbbell Press", sets: 3 },
      { name: "Rope Tricep Pushdowns", sets: 3 },
      { name: "Overhead Dumbbell Tricep Extension", sets: 3 },
      { name: "Face Pulls", sets: 3 }
    ],
    "Pull A": [
      { name: "Barbell Bent-Over Row", sets: 4 },
      { name: "Dumbbell Hammer Curl", sets: 4 },
      { name: "Lat Pulldown", sets: 3 },
      { name: "Barbell Curl", sets: 3 },
      { name: "Seated Cable Row", sets: 3 },
      { name: "Cable Curl", sets: 3 }
    ],
    "Legs": [
      { name: "Squat", sets: 4 },
      { name: "Leg Curl", sets: 4 },
      { name: "Leg Press", sets: 4 },
      { name: "Leg Extension", sets: 3 }
    ],
    "Push B": [
      { name: "Incline DB Press", sets: 4 },
      { name: "Dumbbell Lateral Raise", sets: 4 },
      { name: "Machine Chest Press", sets: 3 },
      { name: "Face Pulls", sets: 3 },
      { name: "Assisted Dips", sets: 3 },
      { name: "Rope Tricep Pushdowns", sets: 3 }
    ],
    "Pull B": [
      { name: "Lat Pulldown (diff grip)", sets: 4 },
      { name: "Barbell Curl", sets: 4 },
      { name: "Seated Row", sets: 3 },
      { name: "Dumbbell Hammer Curl", sets: 3 },
      { name: "Rear Delt Fly", sets: 3 }
    ]
  };

  let currentDay = "Push A";
  let chart = null;

  // ------------------------------
  // 2️⃣ SAFE LOCALSTORAGE WRAPPERS
  // ------------------------------
  function getLogs() {
    try {
      return JSON.parse(localStorage.getItem("logs") || "[]");
    } catch (e) {
      console.error("Corrupted logs, resetting.");
      localStorage.setItem("logs", "[]");
      return [];
    }
  }

  function saveLogs(logs) {
    localStorage.setItem("logs", JSON.stringify(logs));
  }

  function getCustomWorkouts() {
    try {
      return JSON.parse(localStorage.getItem("customWorkouts") || "[]");
    } catch (e) {
      localStorage.setItem("customWorkouts", "[]");
      return [];
    }
  }

  function saveCustomWorkouts(customs) {
    localStorage.setItem("customWorkouts", JSON.stringify(customs));
  }

  // ------------------------------
  // 3️⃣ DRAWER TOGGLE
  // ------------------------------
  const drawer = document.getElementById("drawer");
  document.getElementById("hamburger").onclick = () => drawer.classList.add("open");
  document.getElementById("closeDrawer").onclick = () => drawer.classList.remove("open");

  // ------------------------------
  // 4️⃣ PAGE NAVIGATION
  // ------------------------------
  function showPage(page) {
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    document.getElementById(page).classList.remove("hidden");
    drawer.classList.remove("open");
  }

  document.querySelectorAll(".navWorkout").forEach(btn => {
    btn.onclick = () => {
      currentDay = btn.dataset.day;
      renderWorkout();
      showPage("workoutPage");
    };
  });

  document.getElementById("navProgress").onclick = () => {
    renderChart();
    showPage("progressPage");
  };

  document.getElementById("navHistory").onclick = () => {
    renderHistory();
    showPage("historyPage");
  };

  // ------------------------------
  // 5️⃣ RENDER WORKOUT
  // ------------------------------
  function renderWorkout(loadLast=false) {
    document.getElementById("pageTitle").textContent = currentDay;
    const container = document.getElementById("exerciseContainer");
    container.innerHTML = "";

    // Copy workout template
    const template = [...(workouts[currentDay] || [])];

    // If loadLast, populate previous weights
    if (loadLast) {
      const logs = getLogs().filter(l => l.d === currentDay);
      if (logs.length > 0) {
        const last = logs[logs.length - 1];
        template.forEach(ex => {
          const match = last.e.find(le => le.n === ex.name);
          if (match) ex.lastSets = match.s;
        });
      }
    }

    template.forEach(ex => {
      const div = document.createElement("div");
      div.className = "exercise";

      div.innerHTML = `<h4>${ex.name}</h4>`;

      for (let i = 0; i < ex.sets; i++) {
        const row = document.createElement("div");
        row.className = "setRow";
        const lastReps = ex.lastSets ? ex.lastSets[i]?.reps || "" : "";
        const lastWeight = ex.lastSets ? ex.lastSets[i]?.weight || "" : "";
        row.innerHTML = `
          <input type="number" placeholder="Reps" value="${lastReps}">
          <input type="number" placeholder="Weight" value="${lastWeight}">
        `;
        div.appendChild(row);
      }

      container.appendChild(div);
    });
  }

  // ------------------------------
  // 6️⃣ SAVE WORKOUT
  // ------------------------------
  document.getElementById("saveWorkout").onclick = () => {
    const exercises = [];
    document.querySelectorAll(".exercise").forEach(ex => {
      const name = ex.querySelector("h4").textContent;
      const sets = [];
      ex.querySelectorAll(".setRow").forEach(row => {
        const inputs = row.querySelectorAll("input");
        sets.push({
          reps: +inputs[0].value || 0,
          weight: +inputs[1].value || 0
        });
      });
      exercises.push({ n: name, s: sets });
    });

    const logs = getLogs();
    logs.push({ t: new Date().toISOString(), d: currentDay, e: exercises });
    saveLogs(logs);

    alert("Workout Saved 💪");
  };

  // ------------------------------
  // 7️⃣ RENDER HISTORY
  // ------------------------------
  function renderHistory() {
    const container = document.getElementById("historyList");
    container.innerHTML = "";
    const logs = getLogs().slice().reverse();

    logs.forEach((log, idx) => {
      const div = document.createElement("div");
      div.className = "historyItem";
      div.innerHTML = `<strong>${new Date(log.t).toLocaleDateString()} - ${log.d}</strong>`;

      const details = document.createElement("div");
      details.className = "historyDetails hidden";
      log.e.forEach(ex => {
        const exDiv = document.createElement("div");
        exDiv.innerHTML = `<strong>${ex.n}</strong>: ${ex.s.map(s => `${s.reps}x${s.weight}`).join(", ")}`;
        details.appendChild(exDiv);
      });

      div.appendChild(details);
      div.onclick = () => details.classList.toggle("hidden");
      container.appendChild(div);
    });
  }

  // ------------------------------
  // 8️⃣ CHART.JS PROGRESS
  // ------------------------------
  function renderChart() {
    const logs = getLogs();
    const select = document.getElementById("exerciseSelect");
    select.innerHTML = "";

    const exercisesSet = new Set();
    logs.forEach(l => l.e.forEach(e => exercisesSet.add(e.n)));

    exercisesSet.forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });

    if (!select.value && select.options.length > 0) select.value = select.options[0].value;
    if (!select.value) return;

    const labels = [];
    const data = [];

    logs.forEach(l => {
      const ex = l.e.find(e => e.n === select.value);
      if (!ex) return;
      const avg = ex.s.reduce((sum, s) => sum + s.weight, 0) / ex.s.length;
      labels.push(new Date(l.t).toLocaleDateString());
      data.push(avg);
    });

    if (chart) chart.destroy();
    chart = new Chart(document.getElementById("chart"), {
      type: "line",
      data: { labels, datasets: [{ label: select.value, data, borderColor: "#7289da", tension: 0.3 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: "#fff" } }, x: { ticks: { color: "#fff" } } } }
    });
  }

  document.getElementById("exerciseSelect").onchange = renderChart;

  // ------------------------------
  // 9️⃣ LOAD LAST WORKOUT BUTTON
  // ------------------------------
  const loadLastBtn = document.createElement("button");
  loadLastBtn.textContent = "Load Last Workout";
  loadLastBtn.className = "primaryBtn";
  loadLastBtn.onclick = () => renderWorkout(true);
  document.getElementById("workoutPage").prepend(loadLastBtn);

  // ------------------------------
  //  🔟 CUSTOM WORKOUT MANAGEMENT
  // ------------------------------
  function addCustomWorkout(name, exercises) {
    const customs = getCustomWorkouts();
    customs.push({ name, exercises });
    saveCustomWorkouts(customs);
    alert("Custom workout added ✅");
  }

  function removeCustomWorkout(name) {
    let customs = getCustomWorkouts();
    customs = customs.filter(c => c.name !== name);
    saveCustomWorkouts(customs);
    alert("Custom workout removed ❌");
  }

  // Example usage:
  // addCustomWorkout("My Push", [{name:"Pushup",sets:3},{name:"Plank",sets:2}])
  // removeCustomWorkout("My Push")

  // ------------------------------
  // 1️⃣1️⃣ INITIAL RENDER
  // ------------------------------
  renderWorkout();
});
