import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/* ============================
   🔐 SIMPLE USER SYSTEM (NO AUTH)
============================ */

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

/* ============================
   📦 FIRESTORE HELPERS
============================ */

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

/* ============================
   🚀 WORKOUT DATA
============================ */

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
    { name: "Cable Curl", sets: "2–3", target: "12", superset: "C1", rest: "60–90 sec" }
  ],
  "Legs": [
    { name: "Squat", sets: 4, target: "8–10", superset: "", rest: "90 sec" },
    { name: "Leg Curl", sets: 4, target: "8–10", superset: "B1", rest: "60–90 sec" },
    { name: "Leg Press", sets: 4, target: "8–12", superset: "B1", rest: "60–90 sec" },
    { name: "Leg Extension", sets: "2–3", target: "12–15", superset: "", rest: "60–90 sec" }
  ]
};

document.addEventListener("DOMContentLoaded", () => {

  let currentDay = "Push A";
  let chart = null;

  /* ============================
     📝 DRAFT HELPERS
  ============================ */

  function saveDraft(draft) {
    localStorage.setItem("draftWorkout", JSON.stringify(draft));
  }

  function getDraft() {
    return JSON.parse(localStorage.getItem("draftWorkout") || "[]");
  }

  function clearDraft() {
    localStorage.removeItem("draftWorkout");
  }

  /* ============================
     🏋️ RENDER WORKOUT
  ============================ */

  function renderWorkout(loadLast = false) {
    const container = document.getElementById("exerciseContainer");
    if (!container) return;
    container.innerHTML = "";

    const template = [...(window.workouts[currentDay] || [])];

    // Load last workout from Firestore
    if (loadLast) {
      getLogs().then(logs => {
        const last = logs.filter(l => l.d === currentDay).pop();
        if (last) {
          template.forEach(ex => {
            const match = last.e.find(le => le.n === ex.name);
            if (match) ex.lastSets = match.s;
          });
          renderExercises(template);
        }
      });
    } else {
      renderExercises(template);
    }
  }

  function renderExercises(template) {
    const container = document.getElementById("exerciseContainer");
    container.innerHTML = "";

    let currentSuperset = "";

    template.forEach(ex => {
      // Superset label
      if (ex.superset && ex.superset !== currentSuperset) {
        const supDiv = document.createElement("div");
        supDiv.className = "exercise superset";
        supDiv.innerHTML = `<h4>Superset ${ex.superset}</h4>`;
        container.appendChild(supDiv);
        currentSuperset = ex.superset;
      }

      const div = document.createElement("div");
      div.className = "exercise";

      // Show sets x reps inline with exercise name
      div.innerHTML = `<h4>${ex.name} (${ex.sets}×${ex.target})</h4>`;

      for (let i = 0; i < ex.sets; i++) {
        const row = document.createElement("div");
        row.className = "setRow";

        const reps = document.createElement("input");
        reps.type = "number";
        reps.placeholder = "Reps";
        const weight = document.createElement("input");
        weight.type = "number";
        weight.placeholder = "Weight";

        // Prefill from last workout
        if (ex.lastSets && ex.lastSets[i]) {
          reps.value = ex.lastSets[i].reps || "";
          weight.value = ex.lastSets[i].weight || "";
        }

        row.appendChild(reps);
        row.appendChild(weight);
        div.appendChild(row);
      }

      container.appendChild(div);
    });
  }

  /* ============================
     💾 SAVE WORKOUT
  ============================ */

  document.getElementById("saveWorkout").addEventListener("click", async () => {
    const exercises = [];

    document.querySelectorAll(".exercise").forEach(exDiv => {
      const nameHeader = exDiv.querySelector("h4");
      if (!nameHeader) return;
      const name = nameHeader.textContent.split(" (")[0];
      if (!name || name.startsWith("Superset")) return;

      const setsArr = [];
      exDiv.querySelectorAll(".setRow").forEach(row => {
        const inputs = row.querySelectorAll("input");
        const reps = inputs[0].value ? +inputs[0].value : null;
        const weight = inputs[1].value ? +inputs[1].value : null;
        setsArr.push({ reps, weight });
      });

      exercises.push({ n: name, s: setsArr });
    });

    // Save to Firestore
    try {
      await addDoc(userWorkoutsCollection(), {
        t: new Date().toISOString(),
        d: currentDay,
        e: exercises
      });

      clearDraft();
      renderWorkout();
      animateSaveSuccess();
    } catch (err) {
      console.error("Save Error:", err);
      alert("Failed to save workout. Check console.");
    }
  });

  function animateSaveSuccess() {
    const btn = document.getElementById("saveWorkout");
    btn.textContent = "Saved!";
    btn.classList.add("saved");
    setTimeout(() => {
      btn.textContent = "Save Workout";
      btn.classList.remove("saved");
    }, 1500);
  }

  /* ============================
     🔄 AUTO SAVE DRAFT
  ============================ */

  document.addEventListener("input", () => {
    const draft = [];
    document.querySelectorAll(".setRow").forEach(row => {
      const inputs = row.querySelectorAll("input");
      draft.push({
        reps: inputs[0].value || null,
        weight: inputs[1].value || null
      });
    });
    saveDraft(draft);
  });

  /* ============================
     📜 HISTORY, DELETE BUTTON & SWIPE
  ============================ */

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
        exDiv.innerHTML = `<strong>${ex.n}</strong>: ${ex.s.map(s => `${s.reps}×${s.weight}`).join(", ")}`;
        details.appendChild(exDiv);
      });

      item.appendChild(details);
      wrapper.appendChild(item);
      wrapper.appendChild(deleteBtn);
      container.appendChild(wrapper);

      // Swipe functionality
      let startX = 0, currentX = 0, isSwiping = false;
      item.addEventListener("touchstart", e => startX = e.touches[0].clientX);
      item.addEventListener("touchmove", e => {
        const diff = e.touches[0].clientX - startX;
        if (diff < 0) {
          isSwiping = true;
          currentX = Math.max(diff, -90);
          item.style.transform = `translateX(${currentX}px)`;
        }
      });
      item.addEventListener("touchend", () => {
        if (isSwiping) {
          if (currentX < -45) item.style.transform = "translateX(-90px)";
          else item.style.transform = "translateX(0)";
        } else {
          details.classList.toggle("hidden");
        }
      });
    });
  }

  /* ============================
     📅 DATE FORMAT
  ============================ */

  function formatTimestamp(ts) {
    return new Date(ts).toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      weekday: "long",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  /* ============================
     📂 NAVIGATION
  ============================ */

  const drawer = document.getElementById("drawer");
  document.getElementById("hamburger")?.addEventListener("click", () => drawer?.classList.add("open"));
  document.getElementById("closeDrawer")?.addEventListener("click", () => drawer?.classList.remove("open"));

  function showPage(page) {
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    document.getElementById(page)?.classList.remove("hidden");
    drawer?.classList.remove("open");
  }

  document.querySelectorAll(".navWorkout").forEach(btn => btn.addEventListener("click", () => {
    currentDay = btn.dataset.day;
    renderWorkout();
    showPage("workoutPage");
  }));
  document.getElementById("navHistory")?.addEventListener("click", () => {
    renderHistory();
    showPage("historyPage");
  });

  /* ============================
     🚀 INITIAL LOAD
  ============================ */

  renderWorkout();
});
