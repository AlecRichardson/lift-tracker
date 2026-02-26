import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/* =====================================================
   🔐 SIMPLE USER SYSTEM (NO AUTH)
===================================================== */
let userId = localStorage.getItem("userId");
let displayName = localStorage.getItem("displayName");

if (!userId) {
  userId = crypto.randomUUID();
  localStorage.setItem("userId", userId);
}

if (!displayName) {
  displayName = prompt("Enter your name:") || "Lifter";
  localStorage.setItem("displayName", displayName);
}

/* =====================================================
   📦 FIRESTORE HELPERS
===================================================== */
function userWorkoutsCollection() {
  return collection(db, "users", userId, "workouts");
}

async function getLogs() {
  const q = query(userWorkoutsCollection(), orderBy("t"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}

/* =====================================================
   🚀 WORKOUT TEMPLATES
===================================================== */
window.workouts = {
  "Push A": [
    { name: "Barbell Bench Press", sets: 4, target: "8–10", superset: "A1", rest: "60–90 sec" },
    { name: "Dumbbell Lateral Raise", sets: 4, target: "12–15", superset: "A1", rest: "60–90 sec" },
    { name: "Incline Dumbbell Press", sets: 3, target: "8–10", superset: "B1", rest: "60–90 sec" },
    { name: "Rope Tricep Pushdowns", sets: 3, target: "10–12", superset: "B1", rest: "60–90 sec" },
    { name: "Overhead Dumbbell Tricep Extension", sets: 3, target: "10", superset: "C1", rest: "60–90 sec" },
    { name: "Face Pulls", sets: 3, target: "12–15", superset: "C1", rest: "60–90 sec" }
  ],
  "Pull A": [
    { name: "Barbell Bent-Over Row", sets: 4, target: "8–10", superset: "A1", rest: "60–90 sec" },
    { name: "Dumbbell Hammer Curl", sets: 4, target: "10", superset: "A1", rest: "60–90 sec" },
    { name: "Lat Pulldown", sets: 3, target: "8–10", superset: "B1", rest: "60–90 sec" },
    { name: "Barbell Curl", sets: 3, target: "10", superset: "B1", rest: "60–90 sec" },
    { name: "Seated Cable Row", sets: 3, target: "10", superset: "C1", rest: "60–90 sec" },
    { name: "Cable Curl", sets: 2, target: "12", superset: "C1", rest: "60–90 sec" }
  ],
  "Legs": [
    { name: "Squat", sets: 4, target: "8–10", superset: "", rest: "90 sec" },
    { name: "Leg Curl", sets: 4, target: "8–10", superset: "B1", rest: "60–90 sec" },
    { name: "Leg Press", sets: 4, target: "8–12", superset: "B1", rest: "60–90 sec" },
    { name: "Leg Extension", sets: 2, target: "12–15", superset: "", rest: "60–90 sec" }
  ],
  "Push B": [
    { name: "Incline DB Press", sets: 4, target: "8–10", superset: "A1", rest: "60–90 sec" },
    { name: "Dumbbell Lateral Raise", sets: 4, target: "12–15", superset: "A1", rest: "60–90 sec" },
    { name: "Machine Chest Press", sets: 3, target: "10", superset: "B1", rest: "60–90 sec" },
    { name: "Face Pulls", sets: 3, target: "12–15", superset: "B1", rest: "60–90 sec" },
    { name: "Assisted Dips", sets: 3, target: "8–10", superset: "C1", rest: "60–90 sec" },
    { name: "Rope Tricep Pushdowns", sets: 2, target: "12", superset: "C1", rest: "60–90 sec" }
  ],
  "Pull B": [
    { name: "Lat Pulldown (diff grip)", sets: 4, target: "8–10", superset: "A1", rest: "60–90 sec" },
    { name: "Barbell Curl", sets: 4, target: "8–10", superset: "A1", rest: "60–90 sec" },
    { name: "Seated Row", sets: 3, target: "10", superset: "B1", rest: "60–90 sec" },
    { name: "Dumbbell Hammer Curl", sets: 3, target: "10", superset: "B1", rest: "60–90 sec" },
    { name: "Rear Delt Fly", sets: 3, target: "12–15", superset: "", rest: "60–90 sec" }
  ]
};

/* =====================================================
   🏋️ MAIN APP
===================================================== */
document.addEventListener("DOMContentLoaded", async () => {
  let currentDay = "Push A";
  let chart = null;

  const drawer = document.getElementById("drawer");

  // Drawer
  document.getElementById("hamburger")?.addEventListener("click", () => {
    drawer?.classList.add("open");
  });
  document.getElementById("closeDrawer")?.addEventListener("click", () => {
    drawer?.classList.remove("open");
  });

  // ------------------------------
  // Navigation
  // ------------------------------
  function showPage(pageId) {
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    document.getElementById(pageId)?.classList.remove("hidden");
    drawer?.classList.remove("open");
  }

  document.querySelectorAll(".navWorkout").forEach(btn => {
    btn.addEventListener("click", () => {
      currentDay = btn.dataset.day;
      renderWorkout();
      showPage("workoutPage");
    });
  });

  document.getElementById("navHistory")?.addEventListener("click", () => {
    renderHistory();
    showPage("historyPage");
  });
  document.getElementById("navProgress")?.addEventListener("click", () => {
    renderChart();
    showPage("progressPage");
  });

  // ------------------------------
  // Draft helpers
  // ------------------------------
  function saveDraft(data) {
    localStorage.setItem("draftWorkout", JSON.stringify(data));
  }
  function getDraft() {
    return JSON.parse(localStorage.getItem("draftWorkout")) || null;
  }
  function clearDraft() {
    localStorage.removeItem("draftWorkout");
  }

  // ------------------------------
  // Render Workout
  // ------------------------------
  async function renderWorkout() {
    const container = document.getElementById("exerciseContainer");
    if (!container) return;

    container.innerHTML = "";
    const template = [...(window.workouts[currentDay] || [])];

    // Prefill last workout
    const logs = await getLogs();
    const lastLog = logs.filter(l => l.d === currentDay).pop();

    let currentSuperset = "";
    template.forEach(ex => {
      // Superset Header
      if (ex.superset && ex.superset !== currentSuperset) {
        const supDiv = document.createElement("div");
        supDiv.className = "exercise supersetHeader";
        supDiv.textContent = `Superset ${ex.superset}`;
        container.appendChild(supDiv);
        currentSuperset = ex.superset;
      }

      const exDiv = document.createElement("div");
      exDiv.className = "exercise";

      // Name + Sets x Reps
      const setsText = `${ex.sets}×${ex.target}`;
      exDiv.innerHTML = `<h4>${ex.name} (${setsText})</h4>`;

      for (let i = 0; i < ex.sets; i++) {
        const row = document.createElement("div");
        row.className = "setRow";

        const repsInput = document.createElement("input");
        repsInput.type = "number";
        repsInput.placeholder = "Reps";
        const weightInput = document.createElement("input");
        weightInput.type = "number";
        weightInput.placeholder = "Weight";

        // Prefill last workout
        if (lastLog) {
          const match = lastLog.e.find(le => le.n === ex.name);
          if (match && match.s[i]) {
            repsInput.value = match.s[i].reps || "";
            weightInput.value = match.s[i].weight || "";
          }
        }

        row.appendChild(repsInput);
        row.appendChild(weightInput);
        exDiv.appendChild(row);
      }

      container.appendChild(exDiv);
    });
  }

  // ------------------------------
  // Auto Save Draft
  // ------------------------------
  document.addEventListener("input", () => {
    const draft = [];
    document.querySelectorAll(".setRow").forEach(row => {
      const inputs = row.querySelectorAll("input");
      draft.push({
        reps: inputs[0].value || 0,
        weight: inputs[1].value || 0
      });
    });
    saveDraft(draft);
  });

  // ------------------------------
  // Save Workout
  // ------------------------------
  document.getElementById("saveWorkout")?.addEventListener("click", async () => {
    const exercises = [];
    document.querySelectorAll(".exercise").forEach(ex => {
      const name = ex.querySelector("h4")?.textContent.split(" (")[0];
      if (!name || ex.classList.contains("supersetHeader")) return;

      const sets = [];
      ex.querySelectorAll(".setRow").forEach(row => {
        const inputs = row.querySelectorAll("input");
        sets.push({
          reps: Number(inputs[0].value) || 0,
          weight: Number(inputs[1].value) || 0
        });
      });
      exercises.push({ n: name, s: sets });
    });

    await addDoc(userWorkoutsCollection(), {
      t: new Date().toISOString(),
      d: currentDay,
      e: exercises
    });

    clearDraft();
    renderWorkout();
  });

  // ------------------------------
  // History
  // ------------------------------
  async function renderHistory() {
    const container = document.getElementById("historyList");
    if (!container) return;

    container.innerHTML = "";
    const logs = (await getLogs()).reverse();
    let openItem = null;

    logs.forEach(log => {
      const wrapper = document.createElement("div");
      wrapper.className = "historyWrapper";

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "deleteBtn";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", async e => {
        e.stopPropagation();
        await deleteDoc(doc(db, "users", userId, "workouts", log.id));
        renderHistory();
      });

      const item = document.createElement("div");
      item.className = "historyItem";
      item.innerHTML = `<strong>${formatTimestamp(log.t)} - ${log.d}</strong>`;

      const details = document.createElement("div");
      details.className = "historyDetails hidden";
      log.e.forEach(ex => {
        const exDiv = document.createElement("div");
        exDiv.innerHTML = `<strong>${ex.n}</strong>: ${ex.s.map(s => `${s.reps}x${s.weight}`).join(", ")}`;
        details.appendChild(exDiv);
      });

      item.appendChild(details);
      wrapper.appendChild(deleteBtn);
      wrapper.appendChild(item);
      container.appendChild(wrapper);

      let startX = 0, currentX = 0, isSwiping = false;

      item.addEventListener("touchstart", e => {
        startX = e.touches[0].clientX;
        isSwiping = false;
      });

      item.addEventListener("touchmove", e => {
        const diff = e.touches[0].clientX - startX;
        if (diff < 0) {
          isSwiping = true;
          if (openItem && openItem !== item) openItem.style.transform = "translateX(0)";
          currentX = Math.max(diff, -90);
          item.style.transform = `translateX(${currentX}px)`;
          openItem = item;
        }
      });

      item.addEventListener("touchend", () => {
        if (isSwiping) {
          if (currentX < -45) item.style.transform = "translateX(-90px)";
          else {
            item.style.transform = "translateX(0)";
            openItem = null;
          }
        } else {
          details.classList.toggle("hidden");
        }
      });
    });
  }

  // ------------------------------
  // Progress Chart
  // ------------------------------
  async function renderChart() {
    const logs = await getLogs();
    const select = document.getElementById("exerciseSelect");
    if (!select) return;

    select.innerHTML = "";
    const exerciseSet = new Set();
    logs.forEach(l => l.e.forEach(e => exerciseSet.add(e.n)));
    exerciseSet.forEach(name => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    });
    if (!select.value && select.options.length) select.value = select.options[0].value;

    const labels = [], data = [];
    logs.forEach(l => {
      const ex = l.e.find(e => e.n === select.value);
      if (!ex) return;
      const avg = ex.s.reduce((a, b) => a + (b.weight || 0), 0) / ex.s.length;
      labels.push(new Date(l.t).toLocaleDateString());
      data.push(avg);
    });

    if (chart) chart.destroy();
    const ctx = document.getElementById("chart")?.getContext("2d");
    if (!ctx) return;

    chart = new Chart(ctx, {
      type: "line",
      data: { labels, datasets: [{ label: select.value, data, borderColor: "#7289da", tension: 0.3 }] },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: "#fff" } }, x: { ticks: { color: "#fff" } } } }
    });
  }
  document.getElementById("exerciseSelect")?.addEventListener("change", renderChart);

  // ------------------------------
  // Helpers
  // ------------------------------
  function formatTimestamp(ts) {
    const date = new Date(ts);
    return date.toLocaleString("en-US", { month: "long", day: "numeric", weekday: "long", hour: "numeric", minute: "2-digit" });
  }

  // ------------------------------
  // Initial Render
  // ------------------------------
  renderWorkout();
});
