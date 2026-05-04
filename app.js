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
   USER SYSTEM
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
   FIRESTORE HELPERS
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
   MAIN APP
===================================================== */
document.addEventListener("DOMContentLoaded", async () => {
  const rawWorkouts = window.workouts || {};
  const validation = validateWorkoutObject(rawWorkouts);

  const workouts = validation.workouts;
  const workoutDays = Object.keys(workouts);

  let currentDay = workoutDays[0] || "";
  let currentPage = "workoutPage";
  let chart = null;

  const drawer = document.getElementById("drawer");
  const drawerOverlay = document.getElementById("drawerOverlay");
  const workoutNavList = document.getElementById("workoutNavList");
  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const drawerUser = document.getElementById("drawerUser");
  const appMessage = document.getElementById("appMessage");

  if (drawerUser) {
    drawerUser.textContent = displayName ? `Logged as ${displayName}` : "";
  }

  if (validation.errors.length) {
    showMessage(
      `Workout file has issues:\n${validation.errors.map(e => `• ${e}`).join("\n")}`,
      "error"
    );
  }

  if (!workoutDays.length) {
    showMessage("No workouts found. Add workouts to workouts.js.", "error");
    return;
  }

  setupDrawer();
  renderWorkoutNav();
  await renderWorkout();

  /* =====================================================
     DRAWER / NAV
  ===================================================== */
  function setupDrawer() {
    document.getElementById("hamburger")?.addEventListener("click", openDrawer);
    document.getElementById("closeDrawer")?.addEventListener("click", closeDrawer);
    drawerOverlay?.addEventListener("click", closeDrawer);

    document.getElementById("navHistory")?.addEventListener("click", () => {
      renderHistory();
      showPage("historyPage");
    });

    document.getElementById("navProgress")?.addEventListener("click", () => {
      renderChart();
      showPage("progressPage");
    });
  }

  function openDrawer() {
    drawer?.classList.add("open");
    drawerOverlay?.classList.remove("hidden");
  }

  function closeDrawer() {
    drawer?.classList.remove("open");
    drawerOverlay?.classList.add("hidden");
  }

  function renderWorkoutNav() {
    if (!workoutNavList) return;

    workoutNavList.innerHTML = "";

    workoutDays.forEach(day => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "navWorkout";
      btn.dataset.day = day;
      btn.textContent = day;

      btn.addEventListener("click", async () => {
        currentDay = day;
        await renderWorkout();
        showPage("workoutPage");
      });

      workoutNavList.appendChild(btn);
    });

    updateActiveNav();
  }

  function updateActiveNav() {
    document.querySelectorAll(".navWorkout").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.day === currentDay && currentPage === "workoutPage");
    });

    document.getElementById("navProgress")?.classList.toggle("active", currentPage === "progressPage");
    document.getElementById("navHistory")?.classList.toggle("active", currentPage === "historyPage");
  }

  function showPage(pageId) {
    currentPage = pageId;

    document.querySelectorAll(".page").forEach(page => page.classList.add("hidden"));
    document.getElementById(pageId)?.classList.remove("hidden");

    if (pageId === "workoutPage") {
      pageTitle.textContent = currentDay;
      pageSubtitle.textContent = workoutSummaryText(currentDay);
    }

    if (pageId === "progressPage") {
      pageTitle.textContent = "Progress";
      pageSubtitle.textContent = "Charts and strength trends";
    }

    if (pageId === "historyPage") {
      pageTitle.textContent = "History";
      pageSubtitle.textContent = "Saved workouts";
    }

    updateActiveNav();
    closeDrawer();
  }

  /* =====================================================
     DRAFT HELPERS
  ===================================================== */
  const DRAFT_KEY = "draftWorkoutV2";

  function saveDraft(day) {
    const exercises = {};

    document.querySelectorAll(".exerciseCard").forEach(card => {
      const exerciseKey = card.dataset.exerciseKey;
      if (!exerciseKey) return;

      const sets = [];

      card.querySelectorAll(".setRow").forEach(row => {
        const repsInput = row.querySelector("input[data-field='reps']");
        const weightInput = row.querySelector("input[data-field='weight']");

        sets.push({
          reps: repsInput?.value || "",
          weight: weightInput?.value || ""
        });
      });

      exercises[exerciseKey] = sets;
    });

    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        day,
        updatedAt: new Date().toISOString(),
        exercises
      })
    );
  }

  function getDraft() {
    try {
      return JSON.parse(localStorage.getItem(DRAFT_KEY)) || null;
    } catch {
      return null;
    }
  }

  function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
  }

  function draftHasValues(draft) {
    if (!draft?.exercises) return false;

    return Object.values(draft.exercises).some(sets =>
      sets.some(set => String(set.reps || "").trim() || String(set.weight || "").trim())
    );
  }

  document.addEventListener("input", event => {
    if (!event.target.closest?.("#exerciseContainer")) return;
    saveDraft(currentDay);
  });

  /* =====================================================
     RENDER WORKOUT
  ===================================================== */
  async function renderWorkout() {
    const container = document.getElementById("exerciseContainer");
    if (!container) return;

    pageTitle.textContent = currentDay;
    pageSubtitle.textContent = workoutSummaryText(currentDay);
    updateActiveNav();

    container.innerHTML = `<div class="exercise">Loading ${escapeHtml(currentDay)}...</div>`;

    let logs = [];

    try {
      logs = await getLogs();
    } catch (error) {
      container.innerHTML = "";
      showMessage("Could not load saved workouts from Firestore. Check your connection or Firebase config.", "error");
      console.error(error);
      return;
    }

    hideMessage();

    const template = workouts[currentDay] || [];
    const lastLog = findLatestLogForDay(logs, currentDay);
    const draft = getDraft();
    const useDraft = draft?.day === currentDay && draftHasValues(draft);

    container.innerHTML = "";

    let currentSuperset = "";

    template.forEach(exercise => {
      if (exercise.superset && exercise.superset !== currentSuperset) {
        const supersetDiv = document.createElement("div");
        supersetDiv.className = "exercise supersetHeader";
        supersetDiv.textContent = `Superset ${exercise.superset}`;
        container.appendChild(supersetDiv);
        currentSuperset = exercise.superset;
      }

      const exerciseKey = getExerciseKey(exercise);
      const previousExercise = findExerciseInLog(lastLog, exercise);
      const previousSets = previousExercise?.s || [];
      const draftSets = useDraft ? draft.exercises?.[exerciseKey] : null;

      const exerciseCard = document.createElement("article");
      exerciseCard.className = "exercise exerciseCard";
      exerciseCard.dataset.exerciseKey = exerciseKey;
      exerciseCard.dataset.exerciseName = exercise.name;

      exerciseCard.innerHTML = `
        <div class="exerciseHeader">
          <div class="exerciseTitle">
            <h4>${escapeHtml(exercise.name)}</h4>
            <div class="exerciseMeta">
              <span class="pill target">Target ${escapeHtml(exercise.target)}</span>
              <span class="pill">${exercise.sets} sets</span>
              ${exercise.rest ? `<span class="pill">Rest ${escapeHtml(exercise.rest)}</span>` : ""}
              ${exercise.type ? `<span class="pill">${escapeHtml(exercise.type)}</span>` : ""}
            </div>
            ${exercise.note ? `<p class="exerciseNote">${escapeHtml(exercise.note)}</p>` : ""}
            ${previousSets.length ? `<p class="lastHint">Last: ${escapeHtml(formatSets(previousSets))}</p>` : ""}
          </div>
        </div>

        <div class="setGridHeader">
          <div>Set</div>
          <div>Reps</div>
          <div>Weight</div>
        </div>
      `;

      for (let i = 0; i < exercise.sets; i++) {
        const row = document.createElement("div");
        row.className = "setRow";

        const setNumber = document.createElement("div");
        setNumber.className = "setNumber";
        setNumber.textContent = String(i + 1);

        const repsInput = document.createElement("input");
        repsInput.type = "number";
        repsInput.inputMode = "numeric";
        repsInput.min = "0";
        repsInput.placeholder = "Reps";
        repsInput.dataset.field = "reps";
        repsInput.dataset.setIndex = String(i);

        const weightInput = document.createElement("input");
        weightInput.type = "number";
        weightInput.inputMode = "decimal";
        weightInput.min = "0";
        weightInput.step = "0.5";
        weightInput.placeholder = "Weight";
        weightInput.dataset.field = "weight";
        weightInput.dataset.setIndex = String(i);

        const sourceSet = draftSets?.[i] || previousSets?.[i];

        if (sourceSet) {
          repsInput.value = sourceSet.reps || "";
          weightInput.value = sourceSet.weight || "";
        }

        row.appendChild(setNumber);
        row.appendChild(repsInput);
        row.appendChild(weightInput);
        exerciseCard.appendChild(row);
      }

      container.appendChild(exerciseCard);
    });
  }

  /* =====================================================
     SAVE WORKOUT
  ===================================================== */
  document.getElementById("saveWorkout")?.addEventListener("click", async () => {
    const saveButton = document.getElementById("saveWorkout");
    const saveAnimation = document.getElementById("saveAnimation");

    const exercises = [];

    document.querySelectorAll(".exerciseCard").forEach(card => {
      const exerciseKey = card.dataset.exerciseKey;
      const exerciseName = card.dataset.exerciseName;

      const sets = [];

      card.querySelectorAll(".setRow").forEach(row => {
        const repsInput = row.querySelector("input[data-field='reps']");
        const weightInput = row.querySelector("input[data-field='weight']");

        sets.push({
          reps: Number(repsInput?.value) || 0,
          weight: Number(weightInput?.value) || 0
        });
      });

      exercises.push({
        id: exerciseKey,
        n: exerciseName,
        s: sets
      });
    });

    try {
      saveButton.disabled = true;
      saveButton.textContent = "Saving...";

      await addDoc(userWorkoutsCollection(), {
        schemaVersion: 2,
        t: new Date().toISOString(),
        d: currentDay,
        e: exercises
      });

      clearDraft();

      saveAnimation?.classList.remove("hidden");
      setTimeout(() => saveAnimation?.classList.add("hidden"), 1400);

      await renderWorkout();
    } catch (error) {
      showMessage("Workout did not save. Check your connection and try again.", "error");
      console.error(error);
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Save Workout";
    }
  });

  /* =====================================================
     HISTORY
  ===================================================== */
  async function renderHistory() {
    const container = document.getElementById("historyList");
    if (!container) return;

    container.innerHTML = `<div class="exercise">Loading history...</div>`;

    let logs = [];

    try {
      logs = (await getLogs()).reverse();
    } catch (error) {
      container.innerHTML = `<div class="exercise">Could not load history.</div>`;
      console.error(error);
      return;
    }

    container.innerHTML = "";

    if (!logs.length) {
      container.innerHTML = `<div class="exercise">No saved workouts yet.</div>`;
      return;
    }

    let openItem = null;

    logs.forEach(log => {
      const wrapper = document.createElement("div");
      wrapper.className = "historyWrapper";

      const deleteBtn = document.createElement("button");
      deleteBtn.className = "deleteBtn";
      deleteBtn.type = "button";
      deleteBtn.textContent = "Delete";

      deleteBtn.addEventListener("click", async event => {
        event.stopPropagation();

        const ok = confirm(`Delete ${log.d} from ${formatTimestamp(log.t)}?`);
        if (!ok) return;

        await deleteDoc(doc(db, "users", userId, "workouts", log.id));
        renderHistory();
      });

      const item = document.createElement("div");
      item.className = "historyItem";

      item.innerHTML = `
        <div class="historyTitle">
          <div>
            <div>${escapeHtml(log.d || "Workout")}</div>
            <div class="historyDate">${escapeHtml(formatTimestamp(log.t))}</div>
          </div>
          <div>▾</div>
        </div>
      `;

      const details = document.createElement("div");
      details.className = "historyDetails hidden";

      (log.e || []).forEach(exercise => {
        const exDiv = document.createElement("div");
        exDiv.innerHTML = `<strong>${escapeHtml(exercise.n || "Exercise")}</strong>: ${escapeHtml(formatSets(exercise.s || []))}`;
        details.appendChild(exDiv);
      });

      item.appendChild(details);
      wrapper.appendChild(deleteBtn);
      wrapper.appendChild(item);
      container.appendChild(wrapper);

      let startX = 0;
      let currentX = 0;
      let isSwiping = false;

      item.addEventListener("touchstart", event => {
        startX = event.touches[0].clientX;
        currentX = 0;
        isSwiping = false;
      }, { passive: true });

      item.addEventListener("touchmove", event => {
        const diff = event.touches[0].clientX - startX;

        if (diff < -8) {
          isSwiping = true;

          if (openItem && openItem !== item) {
            openItem.style.transform = "translateX(0)";
          }

          currentX = Math.max(diff, -98);
          item.style.transform = `translateX(${currentX}px)`;
          openItem = item;
        }
      }, { passive: true });

      item.addEventListener("touchend", () => {
        if (isSwiping) {
          if (currentX < -45) {
            item.style.transform = "translateX(-98px)";
          } else {
            item.style.transform = "translateX(0)";
            openItem = null;
          }
        } else {
          details.classList.toggle("hidden");
        }
      });

      item.addEventListener("click", () => {
        details.classList.toggle("hidden");
      });
    });
  }

  /* =====================================================
     PROGRESS CHART
  ===================================================== */
  async function renderChart() {
    const select = document.getElementById("exerciseSelect");
    const metricSelect = document.getElementById("metricSelect");
    const canvas = document.getElementById("chart");

    if (!select || !metricSelect || !canvas) return;

    let logs = [];

    try {
      logs = await getLogs();
    } catch (error) {
      showMessage("Could not load progress data.", "error");
      console.error(error);
      return;
    }

    const previousValue = select.value;
    const exerciseMap = new Map();

    logs.forEach(log => {
      (log.e || []).forEach(exercise => {
        const key = exercise.id || slugify(exercise.n || "");
        const label = exercise.n || key;
        if (!exerciseMap.has(key)) {
          exerciseMap.set(key, label);
        }
      });
    });

    select.innerHTML = "";

    [...exerciseMap.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .forEach(([key, label]) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = label;
        select.appendChild(option);
      });

    if (previousValue && exerciseMap.has(previousValue)) {
      select.value = previousValue;
    }

    if (!select.value && select.options.length) {
      select.value = select.options[0].value;
    }

    const labels = [];
    const data = [];

    logs.forEach(log => {
      const exercise = (log.e || []).find(ex => {
        const key = ex.id || slugify(ex.n || "");
        return key === select.value;
      });

      if (!exercise) return;

      const metric = calculateMetric(exercise.s || [], metricSelect.value);

      if (metric === null) return;

      labels.push(new Date(log.t).toLocaleDateString());
      data.push(metric);
    });

    if (chart) chart.destroy();

    const ctx = canvas.getContext("2d");
    const metricLabel = metricSelect.options[metricSelect.selectedIndex]?.textContent || "Progress";
    const exerciseLabel = select.options[select.selectedIndex]?.textContent || "Exercise";

    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: `${exerciseLabel} — ${metricLabel}`,
            data,
            borderColor: "#7289da",
            backgroundColor: "rgba(114, 137, 218, 0.18)",
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: {
              color: "#f2f3f5"
            }
          },
          tooltip: {
            callbacks: {
              label: context => `${metricLabel}: ${roundNumber(context.raw)}`
            }
          }
        },
        scales: {
          y: {
            ticks: { color: "#b5bac1" },
            grid: { color: "rgba(255,255,255,0.08)" }
          },
          x: {
            ticks: { color: "#b5bac1" },
            grid: { color: "rgba(255,255,255,0.04)" }
          }
        }
      }
    });
  }

  document.getElementById("exerciseSelect")?.addEventListener("change", renderChart);
  document.getElementById("metricSelect")?.addEventListener("change", renderChart);

  /* =====================================================
     HELPERS
  ===================================================== */
  function workoutSummaryText(day) {
    const list = workouts[day] || [];
    const setCount = list.reduce((sum, exercise) => sum + Number(exercise.sets || 0), 0);
    return `${list.length} exercises • ${setCount} sets`;
  }

  function findLatestLogForDay(logs, day) {
    return [...logs]
      .filter(log => log.d === day)
      .sort((a, b) => new Date(a.t) - new Date(b.t))
      .pop() || null;
  }

  function findExerciseInLog(log, exerciseTemplate) {
    if (!log?.e?.length) return null;

    const wantedId = getExerciseKey(exerciseTemplate);
    const wantedNames = [
      exerciseTemplate.name,
      ...(Array.isArray(exerciseTemplate.lastAlias) ? exerciseTemplate.lastAlias : [])
    ]
      .filter(Boolean)
      .map(normalizeName);

    return log.e.find(savedExercise => {
      const savedId = savedExercise.id || slugify(savedExercise.n || "");
      const savedName = normalizeName(savedExercise.n || "");

      return savedId === wantedId || wantedNames.includes(savedName);
    }) || null;
  }

  function getExerciseKey(exercise) {
    return exercise.id || slugify(exercise.name || "");
  }

  function formatSets(sets) {
    if (!sets?.length) return "No sets";

    return sets
      .map(set => {
        const reps = Number(set.reps) || 0;
        const weight = Number(set.weight) || 0;
        return `${reps}×${roundNumber(weight)}`;
      })
      .join(", ");
  }

  function calculateMetric(sets, metricName) {
    const cleanSets = sets
      .map(set => ({
        reps: Number(set.reps) || 0,
        weight: Number(set.weight) || 0
      }))
      .filter(set => set.reps > 0 && set.weight > 0);

    if (!cleanSets.length) return null;

    if (metricName === "volume") {
      return cleanSets.reduce((sum, set) => sum + set.reps * set.weight, 0);
    }

    if (metricName === "topWeight") {
      return Math.max(...cleanSets.map(set => set.weight));
    }

    if (metricName === "bestSetVolume") {
      return Math.max(...cleanSets.map(set => set.reps * set.weight));
    }

    if (metricName === "avgWeight") {
      return cleanSets.reduce((sum, set) => sum + set.weight, 0) / cleanSets.length;
    }

    if (metricName === "est1rm") {
      return Math.max(...cleanSets.map(set => set.weight * (1 + set.reps / 30)));
    }

    return null;
  }

  function validateWorkoutObject(input) {
    const errors = [];
    const workouts = {};

    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return {
        workouts,
        errors: ["window.workouts must be an object."]
      };
    }

    Object.entries(input).forEach(([day, exercises]) => {
      if (!Array.isArray(exercises)) {
        errors.push(`${day} must be an array.`);
        return;
      }

      workouts[day] = exercises
        .map((exercise, index) => {
          if (!exercise || typeof exercise !== "object") {
            errors.push(`${day} exercise ${index + 1} must be an object.`);
            return null;
          }

          if (!exercise.name || typeof exercise.name !== "string") {
            errors.push(`${day} exercise ${index + 1} is missing a valid name.`);
          }

          if (!Number.isFinite(Number(exercise.sets)) || Number(exercise.sets) <= 0) {
            errors.push(`${day} ${exercise.name || `exercise ${index + 1}`} needs a valid sets number.`);
          }

          if (!exercise.target || typeof exercise.target !== "string") {
            errors.push(`${day} ${exercise.name || `exercise ${index + 1}`} needs a target rep range.`);
          }

          return {
            id: exercise.id || slugify(exercise.name || `${day}-${index + 1}`),
            name: exercise.name || `Exercise ${index + 1}`,
            sets: Number(exercise.sets) || 1,
            target: exercise.target || "",
            superset: exercise.superset || "",
            rest: exercise.rest || "",
            note: exercise.note || "",
            type: exercise.type || "",
            equipment: exercise.equipment || "",
            lastAlias: Array.isArray(exercise.lastAlias) ? exercise.lastAlias : []
          };
        })
        .filter(Boolean);
    });

    return { workouts, errors };
  }

  function showMessage(message, type = "error") {
    if (!appMessage) return;

    appMessage.textContent = message;
    appMessage.classList.remove("hidden");
    appMessage.dataset.type = type;
  }

  function hideMessage() {
    appMessage?.classList.add("hidden");
  }

  function formatTimestamp(ts) {
    const date = new Date(ts);

    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      weekday: "short",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function normalizeName(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }

  function roundNumber(value) {
    const number = Number(value) || 0;
    return Number.isInteger(number) ? number : Number(number.toFixed(1));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
});
