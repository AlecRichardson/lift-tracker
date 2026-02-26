/* =====================================================
   🏋️ LIFT TRACKER FEATURE LIST
=====================================================

1. User System (No Auth)
2. Workout Templates (Push A/B, Pull A/B, Legs)
3. Draft Storage
4. Save Workout
5. History (click to toggle sets, swipe to delete)
6. Progress Chart (Top Set / 1RM / Volume toggle)
7. Responsive UI / Styling
8. Navigation (drawer + hamburger)
9. Manage Templates (custom workout creation placeholder)
10. Smooth UX Enhancements

===================================================== */

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

// ------------------------------
// 1️⃣ SIMPLE USER SYSTEM
// ------------------------------
let userId = localStorage.getItem("userId");
let displayName = localStorage.getItem("displayName");

if (!userId) {
  userId = crypto.randomUUID();
  localStorage.setItem("userId", userId);
}

if (!displayName) {
  displayName = prompt("Enter your name:");
  if (!displayName) displayName = "Lifter";
  localStorage.setItem("displayName", displayName);
}

// ------------------------------
// 2️⃣ FIRESTORE HELPERS
// ------------------------------
function userWorkoutsCollection() {
  return collection(db, "users", userId, "workouts");
}

async function getLogs() {
  const q = query(userWorkoutsCollection(), orderBy("t"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ------------------------------
// 3️⃣ WORKOUT TEMPLATES
// ------------------------------
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

// ------------------------------
// 4️⃣ APP LOGIC
// ------------------------------
document.addEventListener("DOMContentLoaded", () => {
  let currentDay = "Push A";
  let chart = null;

  const container = document.getElementById("exerciseContainer");
  const saveBtn = document.getElementById("saveWorkout");
  const drawer = document.getElementById("drawer");

  // ------------------------------
  // DRAFT WORKOUT
  // ------------------------------
  function saveDraft(data) { localStorage.setItem("draftWorkout", JSON.stringify(data)); }
  function getDraft() { return JSON.parse(localStorage.getItem("draftWorkout") || "[]"); }
  function clearDraft() { localStorage.removeItem("draftWorkout"); }

  // ------------------------------
  // RENDER WORKOUT
  // ------------------------------
  async function renderWorkout() {
    if (!container) return;
    container.innerHTML = "";
    const logs = await getLogs();
    const lastLog = logs.reverse().find(l => l.d === currentDay);
    const draft = getDraft();

    let currentSuperset = "";
    const exercises = window.workouts[currentDay] || [];
    exercises.forEach(ex => {
      if (ex.superset && ex.superset !== currentSuperset) {
        const supDiv = document.createElement("div");
        supDiv.className = "exercise superset";
        supDiv.innerHTML = `<h4>Superset ${ex.superset}</h4>`;
        container.appendChild(supDiv);
        currentSuperset = ex.superset;
      }

      const div = document.createElement("div");
      div.className = "exercise";
      div.innerHTML = `<h4>${ex.name} (${ex.sets}×${ex.target})</h4>`;

      for (let i = 0; i < ex.sets; i++) {
        const row = document.createElement("div");
        row.className = "setRow";

        const repsInput = document.createElement("input");
        repsInput.type = "number";
        repsInput.placeholder = "Reps";
        const weightInput = document.createElement("input");
        weightInput.type = "number";
        weightInput.placeholder = "Weight";

        // Prefill from last workout
        if (lastLog) {
          const matchEx = lastLog.e.find(e => e.n === ex.name);
          if (matchEx && matchEx.s[i]) {
            repsInput.value = matchEx.s[i].reps || 0;
            weightInput.value = matchEx.s[i].weight || 0;
          }
        }

        // Prefill from draft
        const draftSet = draft.shift();
        if (draftSet) {
          repsInput.value = draftSet.reps || repsInput.value;
          weightInput.value = draftSet.weight || weightInput.value;
        }

        row.appendChild(repsInput);
        row.appendChild(weightInput);
        div.appendChild(row);
      }
      container.appendChild(div);
    });
  }

  // ------------------------------
  // AUTO SAVE DRAFT
  // ------------------------------
  container.addEventListener("input", () => {
    const data = [];
    container.querySelectorAll(".setRow").forEach(row => {
      const [reps, weight] = row.querySelectorAll("input");
      data.push({ reps: +reps.value || 0, weight: +weight.value || 0 });
    });
    saveDraft(data);
  });

  // ------------------------------
  // SAVE WORKOUT
  // ------------------------------
  saveBtn?.addEventListener("click", async () => {
    const exercises = [];
    container.querySelectorAll(".exercise").forEach(exDiv => {
      if (exDiv.classList.contains("superset")) return;
      const name = exDiv.querySelector("h4")?.textContent.split(" (")[0];
      if (!name) return;

      const sets = [];
      exDiv.querySelectorAll(".setRow").forEach(row => {
        const [reps, weight] = row.querySelectorAll("input");
        sets.push({ reps: +reps.value || 0, weight: +weight.value || 0 });
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
  // HISTORY
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
      deleteBtn.style.height = "90%";
      deleteBtn.addEventListener("click", async e => {
        e.stopPropagation();
        await deleteDoc(doc(db, "users", userId, "workouts", log.id));
        renderHistory();
      });

      const item = document.createElement("div");
      item.className = "historyItem";
      item.innerHTML = `<strong>${log.d} - ${new Date(log.t).toLocaleString()}</strong>`;

      const details = document.createElement("div");
      details.className = "historyDetails hidden";
      log.e.forEach(ex => {
        const exDiv = document.createElement("div");
        exDiv.textContent = `${ex.n}: ${ex.s.map(s => `${s.reps}x${s.weight}`).join(", ")}`;
        details.appendChild(exDiv);
      });

      item.appendChild(details);
      wrapper.appendChild(item);
      wrapper.appendChild(deleteBtn);
      container.appendChild(wrapper);

      let startX = 0;
      let currentX = 0;
      let isSwiping = false;

      item.addEventListener("touchstart", e => { startX = e.touches[0].clientX; isSwiping = false; });
      item.addEventListener("touchmove", e => {
        const diff = e.touches[0].clientX - startX;
        if (diff < 0) {
          isSwiping = true;
          if (openItem && openItem !== item) openItem.style.transform = "translateX(0)";
          currentX = Math.max(diff, -90);
          item.style.transform = `translateX(${currentX}px)`;
          openItem = item;
        }
        if (diff > 0 && openItem === item) {
          isSwiping = true;
          currentX = Math.min(diff - 90, 0);
          item.style.transform = `translateX(${currentX}px)`;
        }
      });
      item.addEventListener("touchend", () => {
        if (isSwiping) {
          if (currentX < -45) { item.style.transform = "translateX(-90px)"; openItem = item; }
          else { item.style.transform = "translateX(0)"; openItem = null; }
        } else { details.classList.toggle("hidden"); }
      });
    });
  }

  // ------------------------------
  // PROGRESS CHART PLACEHOLDER
  // ------------------------------
  async function renderChart() {
    // Implementation can toggle Top Set / 1RM / Volume
    // Left as placeholder, can reimplement previous logic
  }

  // ------------------------------
  // NAVIGATION
  // ------------------------------
  document.getElementById("hamburger")?.addEventListener("click", () => drawer?.classList.add("open"));
  document.getElementById("closeDrawer")?.addEventListener("click", () => drawer?.classList.remove("open"));

  document.querySelectorAll(".navWorkout").forEach(btn => {
    btn.addEventListener("click", () => { currentDay = btn.dataset.day; renderWorkout(); document.getElementById("pageTitle").textContent = currentDay; drawer?.classList.remove("open"); });
  });
  document.getElementById("navHistory")?.addEventListener("click", () => { renderHistory(); showPage("historyPage"); });
  document.getElementById("navProgress")?.addEventListener("click", () => { renderChart(); showPage("progressPage"); });

  function showPage(pageId) {
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    document.getElementById(pageId)?.classList.remove("hidden");
  }

  // ------------------------------
  // INITIAL RENDER
  // ------------------------------
  renderWorkout();
});
