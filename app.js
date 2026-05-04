import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  getDoc,
  setDoc
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

function userSettingsDoc() {
  return doc(db, "users", userId, "settings", "app");
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
  const defaultValidation = validateWorkoutObject(window.workouts || {});
  let activePlan = null;
  let workouts = {};
  let workoutDays = [];

  let currentDay = "";
  let currentPage = "homePage";
  let chart = null;
  let historyFilter = "All";
  let activeRestTimer = null;

  let builderPlanName = "";
  let builderWorkouts = null;
  let selectedBuilderDay = "";
  let editingExerciseIndex = null;

  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const appMessage = document.getElementById("appMessage");

  if (defaultValidation.errors.length) {
    showMessage(
      `Your starter workout plan has issues:\n${defaultValidation.errors.map(e => `• ${e}`).join("\n")}`,
      "error"
    );
  }

  try {
    activePlan = await loadOrCreateActivePlan(defaultValidation.workouts);
    workouts = activePlan.workouts;
    workoutDays = Object.keys(workouts);
  } catch (error) {
    console.error(error);
    showMessage("Couldn’t load your workout plan.", "error");
    activePlan = {
      id: "local_fallback",
      name: "Local Fallback Plan",
      workouts: defaultValidation.workouts
    };
    workouts = activePlan.workouts;
    workoutDays = Object.keys(workouts);
  }

  if (!workoutDays.length) {
    showMessage("No workouts found. Go to Plan and add a workout day.", "error");
  }

  setupBottomNav();
  await renderHome();
  showPage("homePage");

  /* =====================================================
     PLAN LOADING
  ===================================================== */
  async function loadOrCreateActivePlan(defaultWorkouts) {
    const settingsRef = userSettingsDoc();
    const settingsSnap = await getDoc(settingsRef);
    const activePlanId = settingsSnap.exists() ? settingsSnap.data().activePlanId : "";

    if (activePlanId) {
      const activePlanRef = doc(db, "users", userId, "plans", activePlanId);
      const activePlanSnap = await getDoc(activePlanRef);

      if (activePlanSnap.exists()) {
        const data = activePlanSnap.data();
        const validation = validateWorkoutObject(data.workouts || {});

        return {
          id: activePlanSnap.id,
          name: data.name || "Current Plan",
          workouts: validation.workouts,
          createdAt: data.createdAt || "",
          updatedAt: data.updatedAt || ""
        };
      }
    }

    const now = new Date().toISOString();
    const seedPlanId = "current_plan";
    const seedPlanRef = doc(db, "users", userId, "plans", seedPlanId);

    await setDoc(seedPlanRef, {
      name: "Current Plan",
      workouts: defaultWorkouts,
      createdAt: now,
      updatedAt: now
    });

    await setDoc(settingsRef, {
      activePlanId: seedPlanId,
      updatedAt: now
    }, { merge: true });

    return {
      id: seedPlanId,
      name: "Current Plan",
      workouts: defaultWorkouts,
      createdAt: now,
      updatedAt: now
    };
  }

  async function saveActivePlanToStorage(nextWorkouts, planName = "Current Plan") {
    const validation = validateWorkoutObject(nextWorkouts);

    if (validation.errors.length) {
      throw new Error(validation.errors.join("\n"));
    }

    const now = new Date().toISOString();
    const planId = activePlan?.id || "current_plan";
    const planRef = doc(db, "users", userId, "plans", planId);

    await setDoc(planRef, {
      name: planName,
      workouts: validation.workouts,
      updatedAt: now,
      createdAt: activePlan?.createdAt || now
    }, { merge: true });

    await setDoc(userSettingsDoc(), {
      activePlanId: planId,
      updatedAt: now
    }, { merge: true });

    activePlan = {
      ...(activePlan || {}),
      id: planId,
      name: planName,
      workouts: validation.workouts,
      updatedAt: now,
      createdAt: activePlan?.createdAt || now
    };

    workouts = validation.workouts;
    workoutDays = Object.keys(workouts);

    if (!workoutDays.includes(currentDay)) {
      currentDay = "";
    }

    historyFilter = "All";
  }

  /* =====================================================
     NAVIGATION
  ===================================================== */
  function setupBottomNav() {
    document.getElementById("bottomHome")?.addEventListener("click", async () => {
      await renderHome();
      showPage("homePage");
    });

    document.getElementById("bottomWorkout")?.addEventListener("click", async () => {
      if (!currentDay) {
        await renderHome();
        showPage("homePage");
        return;
      }

      await renderWorkout();
      showPage("workoutPage");
    });

    document.getElementById("bottomHistory")?.addEventListener("click", async () => {
      await renderHistory();
      showPage("historyPage");
    });

    document.getElementById("bottomPlan")?.addEventListener("click", () => {
      initBuilderFromActivePlan();
      renderPlanPage();
      showPage("planPage");
    });
  }

  async function startWorkout(day) {
    currentDay = day;
    await renderWorkout();
    showPage("workoutPage");
  }

  function showPage(pageId) {
    currentPage = pageId;

    document.querySelectorAll(".page").forEach(page => page.classList.add("hidden"));
    document.getElementById(pageId)?.classList.remove("hidden");

    if (pageId === "homePage") {
      pageTitle.textContent = "Lift Tracker";
      pageSubtitle.textContent = activePlan ? `Active plan: ${activePlan.name}` : "Home";
    }

    if (pageId === "workoutPage") {
      pageTitle.textContent = currentDay || "Workout";
      pageSubtitle.textContent = currentDay ? workoutSummaryText(currentDay) : "No workout selected";
    }

    if (pageId === "progressPage") {
      pageTitle.textContent = "Progress";
      pageSubtitle.textContent = "Charts and strength trends";
    }

    if (pageId === "historyPage") {
      pageTitle.textContent = "History";
      pageSubtitle.textContent = "Saved workouts";
    }

    if (pageId === "planPage") {
      pageTitle.textContent = "Plan Builder";
      pageSubtitle.textContent = activePlan ? activePlan.name : "Create your plan";
    }

    updateBottomNav();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function updateBottomNav() {
    document.querySelectorAll(".bottomNavBtn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.page === currentPage);
    });
  }

  /* =====================================================
     HOME
  ===================================================== */
  async function renderHome() {
    const activePlanName = document.getElementById("activePlanName");
    const activePlanMeta = document.getElementById("activePlanMeta");
    const todayCard = document.getElementById("todayWorkoutCard");
    const allWorkoutsGrid = document.getElementById("allWorkoutsGrid");
    const recentCard = document.getElementById("recentWorkoutCard");
    const progressCard = document.getElementById("homeProgressCard");
    const planCard = document.getElementById("homePlanCard");

    if (!todayCard || !allWorkoutsGrid || !recentCard || !progressCard || !planCard) return;

    let logs = [];

    try {
      logs = await getLogs();
    } catch (error) {
      console.error(error);
      showMessage("Couldn’t load recent workout data.", "error");
    }

    const latestLog = logs.length ? logs[logs.length - 1] : null;
    const suggestedDay = getSuggestedNextWorkout(logs);

    if (activePlanName) {
      activePlanName.textContent = activePlan?.name || "Current Plan";
    }

    if (activePlanMeta) {
      const totalExercises = workoutDays.reduce((sum, day) => sum + workouts[day].length, 0);
      activePlanMeta.textContent = `${workoutDays.length} workout days • ${totalExercises} exercises`;
    }

    if (suggestedDay) {
      todayCard.innerHTML = `
        <div class="todayWorkoutTitle">
          <div>
            <p class="eyebrow">Today's Workout</p>
            <div class="todayWorkoutName">${escapeHtml(suggestedDay)}</div>
            <p>${escapeHtml(getSuggestionReason(latestLog, suggestedDay))}</p>
          </div>
          <div class="todayBadge">Next Up</div>
        </div>

        <div class="homeActions">
          <button id="startSuggestedWorkout" type="button" class="primaryBtn">Start ${escapeHtml(suggestedDay)}</button>
        </div>
      `;

      document.getElementById("startSuggestedWorkout")?.addEventListener("click", () => {
        startWorkout(suggestedDay);
      });
    } else {
      todayCard.innerHTML = `
        <p class="eyebrow">Today's Workout</p>
        <h3>No workouts yet</h3>
        <p>Go to Plan and add your first workout day.</p>
      `;
    }

    allWorkoutsGrid.innerHTML = "";

    if (workoutDays.length) {
      workoutDays.forEach(day => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "workoutPickBtn";
        btn.classList.toggle("suggested", day === suggestedDay);
        btn.innerHTML = `
          <div>${escapeHtml(day)}</div>
          <small>${escapeHtml(workoutSummaryText(day))}</small>
        `;

        btn.addEventListener("click", () => {
          startWorkout(day);
        });

        allWorkoutsGrid.appendChild(btn);
      });
    } else {
      allWorkoutsGrid.innerHTML = `<div class="historyEmpty">No workout days in this plan yet.</div>`;
    }

    if (latestLog) {
      recentCard.innerHTML = `
        <p class="eyebrow">Recent Workout</p>
        <h3>${escapeHtml(latestLog.d || "Workout")}</h3>
        <p>${escapeHtml(formatTimestamp(latestLog.t))}</p>

        <div class="statGrid">
          <div class="statTile">
            <strong>${countWorkingSets(latestLog)}</strong>
            <span>Working Sets</span>
          </div>
          <div class="statTile">
            <strong>${formatLargeNumber(workoutVolume(latestLog))}</strong>
            <span>Volume lb</span>
          </div>
        </div>
      `;
    } else {
      recentCard.innerHTML = `
        <p class="eyebrow">Recent Workout</p>
        <h3>No workouts yet</h3>
        <p>Save your first workout and your recent summary will appear here.</p>
      `;
    }

    progressCard.innerHTML = `
      <div class="cardHeaderRow">
        <div>
          <p class="eyebrow">Progress</p>
          <h3>Charts & trends</h3>
          <p>View estimated 1RM, volume, top weight, and more.</p>
        </div>
      </div>
      <div class="homeActions">
        <button id="openProgressFromHome" type="button" class="secondaryBtn">View Progress</button>
      </div>
    `;

    document.getElementById("openProgressFromHome")?.addEventListener("click", async () => {
      await renderChart();
      showPage("progressPage");
    });

    planCard.innerHTML = `
      <div class="cardHeaderRow">
        <div>
          <p class="eyebrow">Plan</p>
          <h3>${escapeHtml(activePlan?.name || "Current Plan")}</h3>
          <p>Create workout days and add exercises.</p>
        </div>
      </div>
      <div class="homeActions">
        <button id="openPlanFromHome" type="button" class="secondaryBtn">Open Plan Builder</button>
      </div>
    `;

    document.getElementById("openPlanFromHome")?.addEventListener("click", () => {
      initBuilderFromActivePlan();
      renderPlanPage();
      showPage("planPage");
    });
  }

  function getSuggestedNextWorkout(logs) {
    if (!workoutDays.length) return "";

    const latestLog = logs.length ? logs[logs.length - 1] : null;

    if (!latestLog?.d) {
      return workoutDays[0];
    }

    const index = workoutDays.indexOf(latestLog.d);

    if (index === -1) {
      return workoutDays[0];
    }

    return workoutDays[(index + 1) % workoutDays.length];
  }

  function getSuggestionReason(latestLog, suggestedDay) {
    if (!latestLog?.d) {
      return `${suggestedDay} is first in your active plan.`;
    }

    if (!workoutDays.includes(latestLog.d)) {
      return `Your last saved workout is not in this plan, so this starts from the top.`;
    }

    return `Next in rotation after ${latestLog.d}.`;
  }

  /* =====================================================
     PLAN BUILDER
  ===================================================== */
  function initBuilderFromActivePlan(force = false) {
    if (builderWorkouts && !force) return;

    builderPlanName = activePlan?.name || "Current Plan";
    builderWorkouts = deepClone(activePlan?.workouts || workouts || {});
    selectedBuilderDay = Object.keys(builderWorkouts)[0] || "";
    editingExerciseIndex = null;
  }

  function renderPlanPage() {
    initBuilderFromActivePlan();

    const planOverview = document.getElementById("planOverview");
    if (!planOverview) return;

    const builderDays = Object.keys(builderWorkouts || {});
    const selectedExercises = selectedBuilderDay ? (builderWorkouts[selectedBuilderDay] || []) : [];
    const editingExercise =
      editingExerciseIndex !== null && selectedExercises[editingExerciseIndex]
        ? selectedExercises[editingExerciseIndex]
        : null;

    planOverview.innerHTML = `
      <div class="builderGrid">
        <section class="dashboardCard">
          <p class="eyebrow">Plan Name</p>
          <h3>Active workout plan</h3>

          <div class="builderField">
            <label for="builderPlanName">Plan name</label>
            <input id="builderPlanName" class="builderInput" value="${escapeAttribute(builderPlanName)}" placeholder="Current Plan" />
          </div>

          <div id="builderMessage" class="builderMessage hidden"></div>
        </section>

        <section class="dashboardCard">
          <p class="eyebrow">Workout Days</p>
          <h3>Create days like Push A, Pull A, Legs</h3>

          <div id="builderDayChips" class="builderDayChips">
            ${builderDays.map(day => `
              <button
                type="button"
                class="builderDayChip ${day === selectedBuilderDay ? "active" : ""}"
                data-day="${escapeAttribute(day)}"
              >
                ${escapeHtml(day)}
              </button>
            `).join("")}
          </div>

          <div class="builderRow">
            <input id="newDayName" class="builderInput" placeholder="New day name, e.g. Pull A" />
            <button id="addDayBtn" type="button" class="secondaryBtn">Add Day</button>
          </div>
        </section>

        ${selectedBuilderDay ? `
          <section class="dashboardCard">
            <p class="eyebrow">Selected Day</p>
            <h3>${escapeHtml(selectedBuilderDay)}</h3>

            <div class="builderRow">
              <input id="renameDayInput" class="builderInput" value="${escapeAttribute(selectedBuilderDay)}" />
              <button id="renameDayBtn" type="button" class="secondaryBtn">Rename Day</button>
            </div>

            <div class="homeActions">
              <button id="deleteDayBtn" type="button" class="dangerBtn">Delete ${escapeHtml(selectedBuilderDay)}</button>
            </div>
          </section>

          <section class="dashboardCard">
            <p class="eyebrow">Exercises</p>
            <h3>${selectedExercises.length} exercises</h3>

            <div id="exerciseBuilderList" class="exerciseBuilderList">
              ${selectedExercises.length ? selectedExercises.map((exercise, index) => `
                <article class="builderExerciseCard">
                  <div class="builderExerciseHeader">
                    <div>
                      <strong>${escapeHtml(exercise.name)}</strong>
                      <p>
                        ${Number(exercise.sets) || 0} sets • Target ${escapeHtml(exercise.target || "")}
                        ${exercise.rest ? ` • Rest ${escapeHtml(exercise.rest)}` : ""}
                        ${exercise.superset ? ` • Superset ${escapeHtml(exercise.superset)}` : ""}
                        ${exercise.equipment ? ` • ${escapeHtml(exercise.equipment)}` : ""}
                      </p>
                    </div>
                  </div>

                  <div class="builderExerciseActions">
                    <button type="button" class="builderMiniBtn" data-action="edit" data-index="${index}">Edit</button>
                    <button type="button" class="builderMiniBtn" data-action="up" data-index="${index}">↑</button>
                    <button type="button" class="builderMiniBtn" data-action="down" data-index="${index}">↓</button>
                    <button type="button" class="builderMiniBtn danger" data-action="delete" data-index="${index}">Delete</button>
                  </div>
                </article>
              `).join("") : `
                <div class="historyEmpty">
                  <h4>No exercises yet.</h4>
                  <p>Add your first exercise below.</p>
                </div>
              `}
            </div>
          </section>

          <section class="dashboardCard">
            <p class="eyebrow">${editingExercise ? "Edit Exercise" : "Add Exercise"}</p>
            <h3>${editingExercise ? escapeHtml(editingExercise.name) : `New exercise for ${escapeHtml(selectedBuilderDay)}`}</h3>

            <div class="builderField">
              <label for="exerciseNameInput">Exercise name</label>
              <input id="exerciseNameInput" class="builderInput" value="${escapeAttribute(editingExercise?.name || "")}" placeholder="Lat Pulldown" />
            </div>

            <div class="builderTwoCol">
              <div class="builderField">
                <label for="exerciseSetsInput">Sets</label>
                <input id="exerciseSetsInput" class="builderInput" type="number" min="1" value="${escapeAttribute(editingExercise?.sets || 3)}" />
              </div>

              <div class="builderField">
                <label for="exerciseTargetInput">Target reps</label>
                <input id="exerciseTargetInput" class="builderInput" value="${escapeAttribute(editingExercise?.target || "")}" placeholder="8–10" />
              </div>
            </div>

            <div class="builderTwoCol">
              <div class="builderField">
                <label for="exerciseRestInput">Rest</label>
                <input id="exerciseRestInput" class="builderInput" value="${escapeAttribute(editingExercise?.rest || "")}" placeholder="60–90 sec" />
              </div>

              <div class="builderField">
                <label for="exerciseSupersetInput">Superset</label>
                <select id="exerciseSupersetInput" class="builderSelect">
                  ${["", "A", "B", "C", "D", "E", "F"].map(value => `
                    <option value="${value}" ${String(editingExercise?.superset || "") === value ? "selected" : ""}>
                      ${value ? `Superset ${value}` : "None"}
                    </option>
                  `).join("")}
                </select>
              </div>
            </div>

            <div class="builderTwoCol">
              <div class="builderField">
                <label for="exerciseTypeInput">Type</label>
                <select id="exerciseTypeInput" class="builderSelect">
                  ${["", "compound", "accessory"].map(value => `
                    <option value="${value}" ${String(editingExercise?.type || "") === value ? "selected" : ""}>
                      ${value || "None"}
                    </option>
                  `).join("")}
                </select>
              </div>

              <div class="builderField">
                <label for="exerciseEquipmentInput">Equipment</label>
                <input id="exerciseEquipmentInput" class="builderInput" value="${escapeAttribute(editingExercise?.equipment || "")}" placeholder="barbell, cable, machine..." />
              </div>
            </div>

            <div class="builderField">
              <label for="exerciseNoteInput">Note</label>
              <textarea id="exerciseNoteInput" class="builderTextarea" placeholder="Optional note">${escapeHtml(editingExercise?.note || "")}</textarea>
            </div>

            <div class="builderRow">
              <button id="saveExerciseBtn" type="button" class="primaryBtn">
                ${editingExercise ? "Save Exercise" : "Add Exercise"}
              </button>
              <button id="cancelExerciseBtn" type="button" class="secondaryBtn">Cancel</button>
            </div>
          </section>
        ` : `
          <section class="dashboardCard">
            <p class="eyebrow">No Day Selected</p>
            <h3>Add a workout day</h3>
            <p>Create a day like Push A, Pull A, Legs, Upper, or Lower.</p>
          </section>
        `}

        <section class="dashboardCard builderSaveSimple">
          <button id="savePlanBtn" type="button" class="primaryBtn">Save Plan</button>
        </section>
      </div>
    `;

    attachPlanBuilderEvents();
  }

  function attachPlanBuilderEvents() {
    const planNameInput = document.getElementById("builderPlanName");
    planNameInput?.addEventListener("input", () => {
      builderPlanName = planNameInput.value;
    });

    document.querySelectorAll(".builderDayChip").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedBuilderDay = btn.dataset.day || "";
        editingExerciseIndex = null;
        renderPlanPage();
      });
    });

    document.getElementById("addDayBtn")?.addEventListener("click", () => {
      const input = document.getElementById("newDayName");
      const name = input?.value.trim();

      if (!name) {
        showBuilderMessage("Enter a workout day name first.", "error");
        return;
      }

      if (builderWorkouts[name]) {
        showBuilderMessage("That workout day already exists.", "error");
        return;
      }

      builderWorkouts[name] = [];
      selectedBuilderDay = name;
      editingExerciseIndex = null;
      renderPlanPage();
    });

    document.getElementById("renameDayBtn")?.addEventListener("click", () => {
      const input = document.getElementById("renameDayInput");
      const nextName = input?.value.trim();

      if (!selectedBuilderDay || !nextName) {
        showBuilderMessage("Enter a valid day name.", "error");
        return;
      }

      if (nextName !== selectedBuilderDay && builderWorkouts[nextName]) {
        showBuilderMessage("That workout day already exists.", "error");
        return;
      }

      const renamed = {};
      Object.entries(builderWorkouts).forEach(([day, exercises]) => {
        renamed[day === selectedBuilderDay ? nextName : day] = exercises;
      });

      builderWorkouts = renamed;
      selectedBuilderDay = nextName;
      editingExerciseIndex = null;
      renderPlanPage();
    });

    document.getElementById("deleteDayBtn")?.addEventListener("click", () => {
      if (!selectedBuilderDay) return;

      const ok = confirm(`Delete ${selectedBuilderDay} and all exercises in it?`);
      if (!ok) return;

      delete builderWorkouts[selectedBuilderDay];
      selectedBuilderDay = Object.keys(builderWorkouts)[0] || "";
      editingExerciseIndex = null;
      renderPlanPage();
    });

    document.querySelectorAll(".builderMiniBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.dataset.action;
        const index = Number(btn.dataset.index);
        handleBuilderExerciseAction(action, index);
      });
    });

    document.getElementById("saveExerciseBtn")?.addEventListener("click", saveBuilderExercise);

    document.getElementById("cancelExerciseBtn")?.addEventListener("click", () => {
      editingExerciseIndex = null;
      renderPlanPage();
    });

    document.getElementById("savePlanBtn")?.addEventListener("click", saveBuilderPlan);
  }

  function handleBuilderExerciseAction(action, index) {
    const list = builderWorkouts[selectedBuilderDay] || [];

    if (!Number.isInteger(index) || !list[index]) return;

    if (action === "edit") {
      editingExerciseIndex = index;
      renderPlanPage();
      return;
    }

    if (action === "up" && index > 0) {
      [list[index - 1], list[index]] = [list[index], list[index - 1]];
      editingExerciseIndex = null;
      renderPlanPage();
      return;
    }

    if (action === "down" && index < list.length - 1) {
      [list[index + 1], list[index]] = [list[index], list[index + 1]];
      editingExerciseIndex = null;
      renderPlanPage();
      return;
    }

    if (action === "delete") {
      const ok = confirm(`Delete ${list[index].name}?`);
      if (!ok) return;

      list.splice(index, 1);
      editingExerciseIndex = null;
      renderPlanPage();
    }
  }

  function saveBuilderExercise() {
    if (!selectedBuilderDay) return;

    const name = document.getElementById("exerciseNameInput")?.value.trim() || "";
    const sets = Number(document.getElementById("exerciseSetsInput")?.value) || 0;
    const target = document.getElementById("exerciseTargetInput")?.value.trim() || "";
    const rest = document.getElementById("exerciseRestInput")?.value.trim() || "";
    const superset = document.getElementById("exerciseSupersetInput")?.value || "";
    const type = document.getElementById("exerciseTypeInput")?.value || "";
    const equipment = document.getElementById("exerciseEquipmentInput")?.value.trim() || "";
    const note = document.getElementById("exerciseNoteInput")?.value.trim() || "";

    if (!name) {
      showBuilderMessage("Exercise name is required.", "error");
      return;
    }

    if (!sets || sets < 1) {
      showBuilderMessage("Sets must be at least 1.", "error");
      return;
    }

    if (!target) {
      showBuilderMessage("Target reps are required.", "error");
      return;
    }

    const list = builderWorkouts[selectedBuilderDay] || [];
    const existing = editingExerciseIndex !== null ? list[editingExerciseIndex] : null;

    const exercise = {
      id: existing?.id || createUniqueExerciseId(name, list),
      name,
      sets,
      target,
      rest,
      type,
      equipment,
      note,
      superset,
      lastAlias: Array.isArray(existing?.lastAlias) ? existing.lastAlias : []
    };

    if (editingExerciseIndex !== null && list[editingExerciseIndex]) {
      list[editingExerciseIndex] = exercise;
    } else {
      list.push(exercise);
    }

    builderWorkouts[selectedBuilderDay] = list;
    editingExerciseIndex = null;
    renderPlanPage();
  }

  async function saveBuilderPlan() {
    const saveBtn = document.getElementById("savePlanBtn");
    const planName = (document.getElementById("builderPlanName")?.value || builderPlanName || "Current Plan").trim();

    const validation = validateWorkoutObject(builderWorkouts || {});

    if (validation.errors.length) {
      showBuilderMessage(
        `Fix these issues first:\n${validation.errors.map(error => `• ${error}`).join("\n")}`,
        "error"
      );
      return;
    }

    try {
      saveBtn.disabled = true;
      saveBtn.textContent = "Saving...";

      await saveActivePlanToStorage(validation.workouts, planName);

      builderPlanName = activePlan.name;
      builderWorkouts = deepClone(activePlan.workouts);
      selectedBuilderDay = Object.keys(builderWorkouts)[0] || "";
      editingExerciseIndex = null;

      await renderHome();
      renderPlanPage();
      showBuilderMessage("Plan saved.", "success");
    } catch (error) {
      console.error(error);
      showBuilderMessage(`Plan did not save:\n${error.message || error}`, "error");
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = "Save Plan";
    }
  }

  function showBuilderMessage(messageText, type = "error") {
    const message = document.getElementById("builderMessage");
    if (!message) return;

    message.textContent = messageText;
    message.dataset.type = type;
    message.classList.remove("hidden");
  }

  function createUniqueExerciseId(name, list) {
    const base = slugify(name) || "exercise";
    const existingIds = new Set((list || []).map(exercise => exercise.id));
    let id = base;
    let counter = 2;

    while (existingIds.has(id)) {
      id = `${base}_${counter}`;
      counter++;
    }

    return id;
  }

  /* =====================================================
     DRAFT HELPERS
  ===================================================== */
  const DRAFT_KEY = "draftWorkoutV4";

  function saveDraft(day) {
    const exercises = {};

    document.querySelectorAll(".exerciseCard").forEach(card => {
      const exerciseKey = card.dataset.exerciseKey;
      if (!exerciseKey) return;

      const sets = [];

      card.querySelectorAll(".setRow").forEach(row => {
        const repsInput = row.querySelector("input[data-field='reps']");
        const weightInput = row.querySelector("input[data-field='weight']");
        const setNumber = row.querySelector(".setNumber");

        sets.push({
          reps: repsInput?.value || "",
          weight: weightInput?.value || "",
          done: setNumber?.dataset.done === "true"
        });
      });

      exercises[exerciseKey] = {
        pulley: card.dataset.pulley || "",
        sets
      };
    });

    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        planId: activePlan?.id || "",
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

    return Object.values(draft.exercises).some(entry => {
      const sets = Array.isArray(entry) ? entry : entry?.sets || [];
      return sets.some(set =>
        String(set.reps || "").trim() ||
        String(set.weight || "").trim() ||
        set.done
      );
    });
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

    stopActiveRestTimer();

    if (!currentDay) {
      container.innerHTML = `
        <div class="dashboardCard">
          <p class="eyebrow">No Workout Selected</p>
          <h3>Pick a workout from Home</h3>
          <p>Use Today's Workout or choose from your workout list.</p>
          <div class="homeActions">
            <button id="goHomeForWorkout" type="button" class="secondaryBtn">Go Home</button>
          </div>
        </div>
      `;

      document.getElementById("goHomeForWorkout")?.addEventListener("click", async () => {
        await renderHome();
        showPage("homePage");
      });

      return;
    }

    pageTitle.textContent = currentDay;
    pageSubtitle.textContent = workoutSummaryText(currentDay);

    container.innerHTML = `<div class="exercise">Loading ${escapeHtml(currentDay)}...</div>`;

    let logs = [];

    try {
      logs = await getLogs();
    } catch (error) {
      container.innerHTML = "";
      showMessage("Couldn’t load your workout history.", "error");
      console.error(error);
      return;
    }

    hideMessage();

    const template = workouts[currentDay] || [];
    const lastLog = findLatestLogForDay(logs, currentDay);
    const draft = getDraft();
    const useDraft =
      draft?.day === currentDay &&
      draft?.planId === activePlan?.id &&
      draftHasValues(draft);

    container.innerHTML = "";

    let currentSuperset = "";

    template.forEach((exercise, index) => {
      if (!exercise.superset) {
        currentSuperset = "";
      }

      if (exercise.superset && exercise.superset !== currentSuperset) {
        const supersetDiv = document.createElement("div");
        supersetDiv.className = "exercise supersetHeader";
        supersetDiv.innerHTML = `
          <div>SUPERSET ${escapeHtml(exercise.superset)}</div>
          <small>Do these exercises back-to-back, then rest.</small>
        `;
        container.appendChild(supersetDiv);
        currentSuperset = exercise.superset;
      }

      const exerciseKey = getExerciseKey(exercise);
      const previousExercise = findExerciseInLog(lastLog, exercise);
      const previousSets = previousExercise?.s || [];
      const draftEntry = useDraft ? draft.exercises?.[exerciseKey] : null;
      const draftSets = Array.isArray(draftEntry) ? draftEntry : draftEntry?.sets || null;

      const nextExercise = template[index + 1];
      const isSupersetEnd =
        exercise.superset &&
        (!nextExercise || nextExercise.superset !== exercise.superset);

      const isCable = isCableExercise(exercise);
      const previousPulley = previousExercise?.pulley || "";
      const draftPulley = !Array.isArray(draftEntry) ? draftEntry?.pulley : "";
      const startingPulley = isCable ? (draftPulley || previousPulley || "single") : "";

      const exerciseCard = document.createElement("article");
      exerciseCard.className = [
        "exercise",
        "exerciseCard",
        exercise.superset ? "inSuperset" : "",
        isSupersetEnd ? "supersetEnd" : ""
      ].filter(Boolean).join(" ");

      exerciseCard.dataset.exerciseKey = exerciseKey;
      exerciseCard.dataset.exerciseName = exercise.name;
      exerciseCard.dataset.pulley = startingPulley;

      exerciseCard.innerHTML = `
        <div class="exerciseHeader">
          <div class="exerciseTitle">
            <h4>${escapeHtml(exercise.name)}</h4>
            <div class="exerciseMeta">
              <span class="pill target">Target ${escapeHtml(exercise.target)}</span>
              <span class="pill">${exercise.sets} sets</span>
              ${exercise.superset ? `<span class="pill supersetPill">Superset ${escapeHtml(exercise.superset)}</span>` : ""}
              ${exercise.rest ? `<span class="pill">Rest ${escapeHtml(exercise.rest)}</span>` : ""}
              ${exercise.type ? `<span class="pill">${escapeHtml(exercise.type)}</span>` : ""}
            </div>
            ${exercise.note ? `<p class="exerciseNote">${escapeHtml(exercise.note)}</p>` : ""}
            ${previousSets.length ? `<p class="lastHint">Last: ${escapeHtml(formatSets(previousSets))}${previousExercise?.pulley ? ` • ${escapeHtml(formatPulley(previousExercise.pulley))}` : ""}</p>` : ""}
          </div>
        </div>

        ${isCable ? `
          <div class="pulleyToggle" data-exercise-key="${escapeAttribute(exerciseKey)}">
            <div class="pulleyToggleLabel">Cable setup</div>
            <button type="button" class="pulleyBtn ${startingPulley === "single" ? "active" : ""}" data-pulley="single">Single</button>
            <button type="button" class="pulleyBtn ${startingPulley === "double" ? "active" : ""}" data-pulley="double">Double</button>
          </div>
        ` : ""}

        <div class="setGridHeader">
          <div>Set</div>
          <div>Reps</div>
          <div>Weight</div>
        </div>
      `;

      if (isCable) {
        exerciseCard.querySelectorAll(".pulleyBtn").forEach(btn => {
          btn.addEventListener("click", () => {
            exerciseCard.dataset.pulley = btn.dataset.pulley || "single";
            exerciseCard.querySelectorAll(".pulleyBtn").forEach(b => {
              b.classList.toggle("active", b === btn);
            });
            saveDraft(currentDay);
          });
        });
      }

      for (let i = 0; i < exercise.sets; i++) {
        const row = document.createElement("div");
        row.className = "setRow";

        const setNumber = document.createElement("button");
        setNumber.type = "button";
        setNumber.className = "setNumber";
        setNumber.textContent = String(i + 1);
        setNumber.dataset.setNumber = String(i + 1);
        setNumber.dataset.done = "false";

        setNumber.addEventListener("click", () => {
          toggleSetDone({
            button: setNumber,
            day: currentDay,
            restText: exercise.rest
          });
        });

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

        const draftSet = draftSets?.[i];
        const previousSet = previousSets?.[i];
        const valueSource = draftSet || previousSet;

        if (valueSource) {
          repsInput.value = valueSource.reps || "";
          weightInput.value = valueSource.weight || "";
        }

        if (draftSet?.done) {
          setNumber.dataset.done = "true";
          setNumber.textContent = "✓";
          row.classList.add("setDone");
        }

        row.appendChild(setNumber);
        row.appendChild(repsInput);
        row.appendChild(weightInput);
        exerciseCard.appendChild(row);
      }

      container.appendChild(exerciseCard);
    });
  }

  function toggleSetDone({ button, day, restText }) {
    const row = button.closest(".setRow");
    const isDone = button.dataset.done === "true";

    if (isDone) {
      if (activeRestTimer?.button === button) {
        stopActiveRestTimer();
      }

      button.dataset.done = "false";
      button.textContent = button.dataset.setNumber;
      button.classList.remove("timerActive", "timerComplete");
      row?.classList.remove("setDone");
      saveDraft(day);
      return;
    }

    button.dataset.done = "true";
    row?.classList.add("setDone");

    const seconds = parseRestSeconds(restText);

    if (seconds > 0) {
      startRestTimer(button, seconds);
    } else {
      button.textContent = "✓";
    }

    saveDraft(day);
  }

  function startRestTimer(button, seconds) {
    stopActiveRestTimer();

    let remaining = seconds;

    button.classList.remove("timerComplete");
    button.classList.add("timerActive");
    button.textContent = formatTimer(remaining);

    const intervalId = setInterval(() => {
      remaining -= 1;

      if (remaining <= 0) {
        clearInterval(intervalId);

        button.classList.remove("timerActive");
        button.classList.add("timerComplete");
        button.textContent = "✓";

        activeRestTimer = null;

        setTimeout(() => {
          button.classList.remove("timerComplete");
        }, 700);

        return;
      }

      button.textContent = formatTimer(remaining);
    }, 1000);

    activeRestTimer = {
      button,
      intervalId
    };
  }

  function stopActiveRestTimer() {
    if (!activeRestTimer) return;

    clearInterval(activeRestTimer.intervalId);

    const button = activeRestTimer.button;
    if (button?.isConnected && button.dataset.done === "true") {
      button.classList.remove("timerActive");
      button.textContent = "✓";
    }

    activeRestTimer = null;
  }

  /* =====================================================
     SAVE WORKOUT
  ===================================================== */
  document.getElementById("saveWorkout")?.addEventListener("click", async () => {
    if (!currentDay) {
      await renderHome();
      showPage("homePage");
      return;
    }

    const saveButton = document.getElementById("saveWorkout");
    const saveAnimation = document.getElementById("saveAnimation");

    const exercises = [];

    document.querySelectorAll(".exerciseCard").forEach(card => {
      const exerciseKey = card.dataset.exerciseKey;
      const exerciseName = card.dataset.exerciseName;
      const pulley = card.dataset.pulley || "";

      const sets = [];

      card.querySelectorAll(".setRow").forEach(row => {
        const repsInput = row.querySelector("input[data-field='reps']");
        const weightInput = row.querySelector("input[data-field='weight']");
        const setNumber = row.querySelector(".setNumber");

        sets.push({
          reps: Number(repsInput?.value) || 0,
          weight: Number(weightInput?.value) || 0,
          done: setNumber?.dataset.done === "true"
        });
      });

      exercises.push({
        id: exerciseKey,
        n: exerciseName,
        pulley,
        s: sets
      });
    });

    try {
      saveButton.disabled = true;
      saveButton.textContent = "Saving...";

      stopActiveRestTimer();

      await addDoc(userWorkoutsCollection(), {
        schemaVersion: 4,
        planId: activePlan?.id || "",
        planName: activePlan?.name || "",
        t: new Date().toISOString(),
        d: currentDay,
        e: exercises
      });

      clearDraft();

      saveAnimation?.classList.remove("hidden");
      setTimeout(() => saveAnimation?.classList.add("hidden"), 1200);

      const savedDay = currentDay;
      currentDay = "";

      await renderHome();
      showPage("homePage");
      pageSubtitle.textContent = `${savedDay} saved.`;
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
      container.innerHTML = `<div class="exercise">Couldn’t load history.</div>`;
      console.error(error);
      return;
    }

    container.innerHTML = "";

    if (!logs.length) {
      container.innerHTML = `
        <div class="historyEmpty">
          <h4>No saved workouts yet.</h4>
          <p>Save a workout and it will show up here.</p>
        </div>
      `;
      return;
    }

    const filterWrap = document.createElement("div");
    filterWrap.className = "historyFilters";

    const logDays = logs.map(log => log.d).filter(Boolean);
    const filterOptions = ["All", ...new Set([...workoutDays, ...logDays])];

    filterOptions.forEach(day => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "historyFilterChip";
      btn.classList.toggle("active", historyFilter === day);
      btn.textContent = day;

      btn.addEventListener("click", () => {
        historyFilter = day;
        renderHistory();
      });

      filterWrap.appendChild(btn);
    });

    container.appendChild(filterWrap);

    const filteredLogs =
      historyFilter === "All"
        ? logs
        : logs.filter(log => log.d === historyFilter);

    if (!filteredLogs.length) {
      const empty = document.createElement("div");
      empty.className = "historyEmpty";
      empty.innerHTML = `
        <h4>No ${escapeHtml(historyFilter)} workouts found.</h4>
        <p>Change the filter or save this workout day first.</p>
      `;
      container.appendChild(empty);
      return;
    }

    const groups = groupLogsByDate(filteredLogs);

    Object.entries(groups).forEach(([dateLabel, groupLogs]) => {
      const group = document.createElement("section");
      group.className = "historyDateGroup";

      const heading = document.createElement("h4");
      heading.className = "historyDateHeading";
      heading.textContent = dateLabel;
      group.appendChild(heading);

      groupLogs.forEach(log => {
        const card = document.createElement("article");
        card.className = "historyCard";

        const exerciseCount = Array.isArray(log.e) ? log.e.length : 0;
        const workingSets = countWorkingSets(log);
        const totalVolume = workoutVolume(log);

        const header = document.createElement("button");
        header.type = "button";
        header.className = "historyCardHeader";
        header.innerHTML = `
          <div class="historyCardMain">
            <div class="historyWorkoutName">${escapeHtml(log.d || "Workout")}</div>
            <div class="historyCardMeta">
              ${escapeHtml(formatCompactTime(log.t))} • ${exerciseCount} exercises • ${workingSets} sets
            </div>
          </div>
          <div class="historyCardSide">
            <div class="historyVolume">${formatLargeNumber(totalVolume)} lb</div>
            <div class="historyChevron">▾</div>
          </div>
        `;

        const details = document.createElement("div");
        details.className = "historyCardDetails hidden";

        const detailsTop = document.createElement("div");
        detailsTop.className = "historyDetailsTop";
        detailsTop.innerHTML = `
          <div>
            <strong>Total Volume</strong>
            <span>${formatLargeNumber(totalVolume)} lb</span>
          </div>
          <div>
            <strong>Working Sets</strong>
            <span>${workingSets}</span>
          </div>
        `;
        details.appendChild(detailsTop);

        const exerciseList = document.createElement("div");
        exerciseList.className = "historyExerciseList";

        (log.e || []).forEach(exercise => {
          const exerciseBlock = document.createElement("div");
          exerciseBlock.className = "historyExerciseBlock";

          const sets = Array.isArray(exercise.s) ? exercise.s : [];

          exerciseBlock.innerHTML = `
            <div class="historyExerciseHead">
              <div>
                <strong>${escapeHtml(exercise.n || "Exercise")}${exercise.pulley ? ` — ${escapeHtml(formatPulley(exercise.pulley))}` : ""}</strong>
                <p>Best: ${escapeHtml(bestSetText(sets))}</p>
              </div>
            </div>
          `;

          const setList = document.createElement("div");
          setList.className = "historySetList";

          sets.forEach((set, index) => {
            const reps = Number(set.reps) || 0;
            const weight = Number(set.weight) || 0;
            const volume = reps * weight;

            const row = document.createElement("div");
            row.className = "historySetRow";
            row.innerHTML = `
              <span>${set.done ? "✓" : ""} Set ${index + 1}</span>
              <span>${reps} reps</span>
              <span>${roundNumber(weight)} lb</span>
              <span>${formatLargeNumber(volume)} lb</span>
            `;

            setList.appendChild(row);
          });

          exerciseBlock.appendChild(setList);
          exerciseList.appendChild(exerciseBlock);
        });

        details.appendChild(exerciseList);

        const actions = document.createElement("div");
        actions.className = "historyActions";

        const copyBtn = document.createElement("button");
        copyBtn.type = "button";
        copyBtn.className = "historyActionBtn";
        copyBtn.textContent = "Copy Summary";

        copyBtn.addEventListener("click", async event => {
          event.stopPropagation();

          try {
            await navigator.clipboard.writeText(buildHistorySummary(log));
            copyBtn.textContent = "Copied!";
            setTimeout(() => {
              copyBtn.textContent = "Copy Summary";
            }, 1200);
          } catch (error) {
            copyBtn.textContent = "Copy Failed";
            setTimeout(() => {
              copyBtn.textContent = "Copy Summary";
            }, 1200);
            console.error(error);
          }
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "historyActionBtn danger";
        deleteBtn.textContent = "Delete";

        deleteBtn.addEventListener("click", async event => {
          event.stopPropagation();

          const ok = confirm(`Delete ${log.d} from ${formatTimestamp(log.t)}?`);
          if (!ok) return;

          await deleteDoc(doc(db, "users", userId, "workouts", log.id));
          renderHistory();
        });

        actions.appendChild(copyBtn);
        actions.appendChild(deleteBtn);
        details.appendChild(actions);

        header.addEventListener("click", () => {
          details.classList.toggle("hidden");
          card.classList.toggle("open");
        });

        card.appendChild(header);
        card.appendChild(details);
        group.appendChild(card);
      });

      container.appendChild(group);
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
      showMessage("Couldn’t load progress data.", "error");
      console.error(error);
      return;
    }

    const previousValue = select.value;
    const exerciseMap = new Map();

    logs.forEach(log => {
      (log.e || []).forEach(exercise => {
        const progressKey = getProgressExerciseKey(exercise);
        const label = getProgressExerciseLabel(exercise);

        if (!exerciseMap.has(progressKey)) {
          exerciseMap.set(progressKey, label);
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
        return getProgressExerciseKey(ex) === select.value;
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

  function isCableExercise(exercise) {
    const equipment = String(exercise?.equipment || "").toLowerCase();
    const name = String(exercise?.name || "").toLowerCase();

    return equipment.includes("cable") ||
      name.includes("cable") ||
      name.includes("pulldown") ||
      name.includes("pushdown") ||
      name.includes("rope");
  }

  function formatPulley(value) {
    if (value === "single") return "Single pulley";
    if (value === "double") return "Double pulley";
    return "";
  }

  function getProgressExerciseKey(exercise) {
    const base = exercise.id || slugify(exercise.n || "");

    if (exercise.pulley) {
      return `${base}::${exercise.pulley}`;
    }

    return base;
  }

  function getProgressExerciseLabel(exercise) {
    const label = exercise.n || exercise.id || "Exercise";

    if (exercise.pulley) {
      return `${label} — ${formatPulley(exercise.pulley)}`;
    }

    return label;
  }

  function formatSets(sets) {
    if (!sets?.length) return "No sets";

    return sets
      .map(set => {
        const reps = Number(set.reps) || 0;
        const weight = Number(set.weight) || 0;
        const done = set.done ? "✓" : "";
        return `${done}${reps}×${roundNumber(weight)}`;
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
        errors: ["Workout plan must be an object."]
      };
    }

    Object.entries(input).forEach(([day, exercises]) => {
      if (!day.trim()) {
        errors.push("A workout day has an empty name.");
        return;
      }

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

  function groupLogsByDate(logs) {
    return logs.reduce((groups, log) => {
      const label = formatDateGroup(log.t);

      if (!groups[label]) {
        groups[label] = [];
      }

      groups[label].push(log);
      return groups;
    }, {});
  }

  function formatDateGroup(ts) {
    const date = new Date(ts);
    const today = new Date();
    const yesterday = new Date();

    yesterday.setDate(today.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    }

    if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    }

    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric"
    });
  }

  function formatCompactTime(ts) {
    return new Date(ts).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function countWorkingSets(log) {
    return (log.e || []).reduce((total, exercise) => {
      return total + (exercise.s || []).filter(set => {
        return Number(set.reps) > 0 || Number(set.weight) > 0;
      }).length;
    }, 0);
  }

  function workoutVolume(log) {
    return (log.e || []).reduce((total, exercise) => {
      return total + (exercise.s || []).reduce((exerciseTotal, set) => {
        const reps = Number(set.reps) || 0;
        const weight = Number(set.weight) || 0;
        return exerciseTotal + reps * weight;
      }, 0);
    }, 0);
  }

  function bestSetText(sets) {
    const cleanSets = (sets || [])
      .map(set => ({
        reps: Number(set.reps) || 0,
        weight: Number(set.weight) || 0
      }))
      .filter(set => set.reps > 0 && set.weight > 0);

    if (!cleanSets.length) return "No completed sets";

    const best = cleanSets.sort((a, b) => {
      const volumeDiff = b.reps * b.weight - a.reps * a.weight;
      if (volumeDiff !== 0) return volumeDiff;
      return b.weight - a.weight;
    })[0];

    return `${best.reps}×${roundNumber(best.weight)}`;
  }

  function buildHistorySummary(log) {
    const lines = [];

    lines.push(`${log.d || "Workout"} — ${formatTimestamp(log.t)}`);
    lines.push(`Total volume: ${formatLargeNumber(workoutVolume(log))} lb`);
    lines.push(`Working sets: ${countWorkingSets(log)}`);
    lines.push("");

    (log.e || []).forEach(exercise => {
      const pulley = exercise.pulley ? ` — ${formatPulley(exercise.pulley)}` : "";
      lines.push(`${exercise.n || "Exercise"}${pulley}: ${formatSets(exercise.s || [])}`);
    });

    return lines.join("\n");
  }

  function parseRestSeconds(restText) {
    const text = String(restText || "").toLowerCase();

    if (!text.trim()) return 0;

    const numbers = [...text.matchAll(/(\d+(?:\.\d+)?)/g)]
      .map(match => Number(match[1]))
      .filter(number => Number.isFinite(number));

    if (!numbers.length) return 0;

    const maxNumber = Math.max(...numbers);

    if (text.includes("min")) {
      return Math.round(maxNumber * 60);
    }

    return Math.round(maxNumber);
  }

  function formatTimer(seconds) {
    if (seconds >= 60) {
      const minutes = Math.floor(seconds / 60);
      const remainder = seconds % 60;
      return `${minutes}:${String(remainder).padStart(2, "0")}`;
    }

    return String(seconds);
  }

  function formatLargeNumber(value) {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
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

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("`", "&#096;");
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
