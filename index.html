document.addEventListener("DOMContentLoaded", () => {

/* =====================
   WORKOUT TEMPLATES
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

function saveLogs(logs) {
  localStorage.setItem("workoutLogs", JSON.stringify(logs));
}

/* =====================
   NAVIGATION
===================== */

const drawer = document.getElementById("drawer");
const pages = {
  workout: document.getElementById("page-workout"),
  progress: document.getElementById("page-progress"),
  history: document.getElementById("page-history")
};

function showPage(page) {
  Object.values(pages).forEach(p => p.classList.add("hidden"));
  pages[page].classList.remove("hidden");
  drawer.classList.remove("open");
}

document.getElementById("hamburger-btn")
  .addEventListener("click", () => drawer.classList.toggle("open"));

document.querySelectorAll(".nav-workout").forEach(btn => {
  btn.addEventListener("click", () => {
    currentWorkout = btn.dataset.workout;
    renderWorkout();
    showPage("workout");
  });
});

document.getElementById("nav-progress")
  .addEventListener("click", () => showPage("progress"));

document.getElementById("nav-history")
  .addEventListener("click", () => showPage("history"));

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
    header.textContent = `${ex.name} (${ex.sets}x${ex.repRange})`;

    const setContainer = document.createElement("div");
    setContainer.style.display = "none";

    header.addEventListener("click", () => {
      setContainer.style.display =
        setContainer.style.display === "none" ? "block" : "none";
    });

    for (let i = 0; i < ex.sets; i++) {
      const setRow = document.createElement("div");
      setRow.className = "set-row";

      setRow.innerHTML = `
        <input type="number" placeholder="Reps">
        <input type="number" placeholder="Weight">
      `;

      setContainer.appendChild(setRow);
    }

    row.appendChild(header);
    row.appendChild(setContainer);
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
      const name = row.querySelector(".exercise-header")
        .textContent.split(" (")[0];

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

    alert("Workout Saved 💪");
  });

renderWorkout();
showPage("workout");

});
