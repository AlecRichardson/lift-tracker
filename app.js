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

function userPlansCollection() {
  return collection(db, "users", userId, "plans");
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

  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const appMessage = document.getElementById("appMessage");

  if (defaultValidation.errors.length) {
    showMessage(
      `Default workouts.js has issues:\n${defaultValidation.errors.map(e => `• ${e}`).join("\n")}`,
      "error"
    );
  }

  try {
    activePlan = await loadOrCreateActivePlan(defaultValidation.workouts);
    workouts = activePlan.workouts;
    workoutDays = Object.keys(workouts);
  } catch (error) {
    console.error(error);
    showMessage("Could not load your active plan from Firebase.", "error");
    activePlan = {
      id: "local_fallback",
      name: "Local Fallback Plan",
      workouts: defaultValidation.workouts
    };
    workouts = activePlan.workouts;
    workoutDays = Object.keys(workouts);
  }

  if (!workoutDays.length) {
    showMessage("No workouts found. Add workouts to workouts.js.", "error");
    return;
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

        if (!Object.keys(validation.workouts).length) {
          throw new Error("Active plan exists but has no valid workouts.");
        }

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
      pageTitle.textContent = "Plan";
      pageSubtitle.textContent = activePlan ? activePlan.name : "Active plan";
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
      showMessage("Could not load recent workout data.", "error");
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

    allWorkoutsGrid.innerHTML = "";

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
          <p>Manage your active workout plan. Builder is next.</p>
        </div>
      </div>
      <div class="homeActions">
        <button id="openPlanFromHome" type="button" class="secondaryBtn">Open Plan</button>
      </div>
    `;

    document.getElementById("openPlanFromHome")?.addEventListener("click", () => {
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
     PLAN PAGE
  ===================================================== */
  function renderPlanPage() {
    const planOverview = document.getElementById("planOverview");
    if (!planOverview) return;

    const totalExercises = workoutDays.reduce((sum, day) => sum + workouts[day].length, 0);

    planOverview.innerHTML = `
      <section class="dashboardCard">
        <p class="eyebrow">Active Firebase Plan</p>
        <h3>${escapeHtml(activePlan?.name || "Current Plan")}</h3>
        <p>${workoutDays.length} workout days • ${totalExercises} exercises</p>

        <div class="statGrid">
          <div class="statTile">
            <strong>${workoutDays.length}</strong>
            <span>Workout Days</span>
          </div>
          <div class="statTile">
            <strong>${totalExercises}</strong>
            <span>Exercises</span>
          </div>
        </div>
      </section>

      <section class="dashboardCard">
        <p class="eyebrow">Workout Days</p>
        <h3>Current plan layout</h3>
        <div class="planList">
          ${workoutDays.map(day => `
            <div class="planDayCard">
              <strong>${escapeHtml(day)}</strong>
              <span>${escapeHtml(workoutSummaryText(day))}</span>
            </div>
          `).join("")}
        </div>
      </section>

      <section class="dashboardCard">
        <p class="eyebrow">Coming Next</p>
        <h3>Plan Builder</h3>
        <p>
          Next step: add, edit, reorder, superset, import, and export workout plans directly in the app.
        </p>
      </section>
    `;
  }

  /* =====================================================
     DRAFT HELPERS
  ===================================================== */
  const DRAFT_KEY = "draftWorkoutV3";

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

      exercises[exerciseKey] = sets;
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

    return Object.values(draft.exercises).some(sets =>
      sets.some(set =>
        String(set.reps || "").trim() ||
        String(set.weight || "").trim() ||
        set.done
      )
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
      showMessage("Could not load saved workouts from Firestore. Check your connection or Firebase config.", "error");
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
      const draftSets = useDraft ? draft.exercises?.[exerciseKey] : null;

      const nextExercise = template[index + 1];
      const isSupersetEnd =
        exercise.superset &&
        (!nextExercise || nextExercise.superset !== exercise.superset);

      const exerciseCard = document.createElement("article");
      exerciseCard.className = [
        "exercise",
        "exerciseCard",
        exercise.superset ? "inSuperset" : "",
        isSupersetEnd ? "supersetEnd" : ""
      ].filter(Boolean).join(" ");

      exerciseCard.dataset.exerciseKey = exerciseKey;
      exerciseCard.dataset.exerciseName = exercise.name;

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

        const setNumber = document.createElement("button");
        setNumber.type = "button";
        setNumber.className = "setNumber";
        setNumber.textContent = String(i + 1);
        setNumber.dataset.setNumber = String(i + 1);
        setNumber.dataset.done = "false";

        setNumber.addEventListener("click", () => {
          const row = setNumber.closest(".setRow");
          const isDone = setNumber.dataset.done === "true";

          setNumber.dataset.done = isDone ? "false" : "true";
          setNumber.textContent = isDone ? setNumber.dataset.setNumber : "✓";
          row?.classList.toggle("setDone", !isDone);

          saveDraft(currentDay);
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

        const sourceSet = draftSets?.[i] || previousSets?.[i];

        if (sourceSet) {
          repsInput.value = sourceSet.reps || "";
          weightInput.value = sourceSet.weight || "";

          if (sourceSet.done) {
            setNumber.dataset.done = "true";
            setNumber.textContent = "✓";
            row.classList.add("setDone");
          }
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
        s: sets
      });
    });

    try {
      saveButton.disabled = true;
      saveButton.textContent = "Saving...";

      await addDoc(userWorkoutsCollection(), {
        schemaVersion: 3,
        planId: activePlan?.id || "",
        planName: activePlan?.name || "",
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
                <strong>${escapeHtml(exercise.n || "Exercise")}</strong>
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
      lines.push(`${exercise.n || "Exercise"}: ${formatSets(exercise.s || [])}`);
    });

    return lines.join("\n");
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

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
});
