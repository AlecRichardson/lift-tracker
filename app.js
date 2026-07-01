import { auth, db } from "./firebase.js";
import {
  exerciseMatchesCandidates,
  exerciseSlug,
  getBestPreviousExerciseContext,
  getExerciseMatchCandidates,
  normalizeExerciseName
} from "./history-context.mjs";
import { getExerciseRecommendation } from "./recommendations.mjs";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
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
let userEmail = localStorage.getItem("userEmail");
let usernameKey = localStorage.getItem("usernameKey");
const googleProvider = new GoogleAuthProvider();
let authPersistenceReady = null;

function isGithubPagesHost() {
  return window.location.hostname.endsWith("github.io");
}

function withTimeout(promise, timeoutMs, errorCode) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => {
        reject({ code: errorCode });
      }, timeoutMs);
    })
  ]);
}

function slugifyUser(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeUsername(value) {
  return slugifyUser(value || "lifter") || "lifter";
}

async function initializeUser() {
  const authUser = await getInitialAuthUser();

  if (!authUser) {
    userId = "";
    return null;
  }

  displayName = authUser.displayName || authUser.email || "Lifter";
  userEmail = authUser.email || "";
  usernameKey = normalizeUsername(displayName);
  userId = authUser.uid;

  localStorage.setItem("userId", userId);
  localStorage.setItem("displayName", displayName);
  localStorage.setItem("userEmail", userEmail);
  localStorage.setItem("usernameKey", usernameKey);
  localStorage.setItem("authUid", authUser.uid);

  return authUser;
}

async function getInitialAuthUser() {
  let redirectFailed = false;

  await ensureAuthPersistence();

  try {
    await getRedirectResult(auth);
  } catch (error) {
    console.error(error);
    redirectFailed = true;
  }

  if (auth.currentUser) {
    return auth.currentUser;
  }

  return new Promise(resolve => {
    let settled = false;
    const unsubscribe = onAuthStateChanged(auth, user => {
      settled = true;
      unsubscribe();
      resolve(user);
    });

    setTimeout(() => {
      if (settled) return;
      unsubscribe();
      resolve(null);
    }, redirectFailed ? 500 : 2500);
  });
}

function ensureAuthPersistence() {
  if (!authPersistenceReady) {
    authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch(error => {
      authPersistenceReady = null;
      throw error;
    });
  }

  return authPersistenceReady;
}

async function signInWithGoogle() {
  await ensureAuthPersistence();

  try {
    await withTimeout(
      signInWithPopup(auth, googleProvider),
      30000,
      "auth/popup-timeout"
    );
    window.location.reload();
  } catch (error) {
    console.error(error);
    if (isGithubPagesHost()) {
      throw error;
    }

    throw error;
  }
}

function authErrorMessage(error) {
  if (error?.code === "auth/configuration-not-found" || error?.code === "auth/operation-not-allowed") {
    return "Google sign-in is not enabled for this app yet.";
  }

  if (error?.code === "auth/popup-closed-by-user") {
    return "Sign-in was closed before it finished.";
  }

  if (error?.code === "auth/popup-blocked" || error?.code === "auth/cancelled-popup-request") {
    return "Google could not open. Allow pop-ups for this site, then try again.";
  }

  if (error?.code === "auth/popup-timeout") {
    return "Google sign-in did not finish. Close the blank sign-in page, return here, and try again.";
  }

  if (error?.code === "auth/unauthorized-domain") {
    return "This web address is not allowed for sign-in yet. Add alecrichardson.github.io to the app sign-in settings.";
  }

  if (error?.code === "auth/operation-not-supported-in-this-environment") {
    return "Google sign-in is not supported from this Home Screen install yet. Open the app in Safari and sign in there.";
  }

  if (isGithubPagesHost()) {
    return "Google sign-in could not open from this app. Try opening the site in Safari, allow pop-ups, and sign in again.";
  }

  return "Sign-in did not finish. Try again.";
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js")
      .then(registration => {
        if (registration.waiting && navigator.serviceWorker.controller) {
          showAppUpdatePrompt(registration);
        }

        registration.addEventListener("updatefound", () => {
          const nextWorker = registration.installing;
          if (!nextWorker) return;

          nextWorker.addEventListener("statechange", () => {
            if (nextWorker.state === "installed" && navigator.serviceWorker.controller) {
              showAppUpdatePrompt(registration);
            }
          });
        });
      })
      .catch(error => {
        console.error(error);
      });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (window.__liftTrackerRefreshing) return;
    window.__liftTrackerRefreshing = true;
    window.location.reload();
  });
}

function showAppUpdatePrompt(registration) {
  const existingPrompt = document.getElementById("appUpdatePrompt");
  existingPrompt?.remove();

  const prompt = document.createElement("div");
  prompt.id = "appUpdatePrompt";
  prompt.className = "appUpdatePrompt";
  prompt.innerHTML = `
    <div>
      <strong>Update ready</strong>
      <span>Refresh to use the latest version.</span>
    </div>
    <button id="applyAppUpdate" type="button">Refresh</button>
  `;

  document.body.appendChild(prompt);
  document.getElementById("applyAppUpdate")?.addEventListener("click", () => {
    registration.waiting?.postMessage({ type: "SKIP_WAITING" });
  });
}

async function migrateUserData(sourceUserId, targetUserId) {
  if (!sourceUserId || !targetUserId || sourceUserId === targetUserId) return;

  try {
    const now = new Date().toISOString();
    const sourceSettingsRef = doc(db, "users", sourceUserId, "settings", "app");
    const targetSettingsRef = doc(db, "users", targetUserId, "settings", "app");
    const sourceSettingsSnap = await getDoc(sourceSettingsRef);
    const sourceActivePlanId = sourceSettingsSnap.exists() ? sourceSettingsSnap.data().activePlanId : "";
    let migratedActivePlanId = "";

    const sourcePlansSnap = await getDocs(collection(db, "users", sourceUserId, "plans"));

    await Promise.all(sourcePlansSnap.docs.map(async planSnap => {
      let targetPlanId = planSnap.id;
      let targetPlanRef = doc(db, "users", targetUserId, "plans", targetPlanId);
      const targetPlanSnap = await getDoc(targetPlanRef);

      if (targetPlanSnap.exists() && planSnap.id === sourceActivePlanId) {
        targetPlanId = `migrated_${slugifyUser(sourceUserId)}_${planSnap.id}`;
        targetPlanRef = doc(db, "users", targetUserId, "plans", targetPlanId);
      }

      await setDoc(targetPlanRef, {
        ...planSnap.data(),
        migratedAt: now
      }, { merge: true });

      if (planSnap.id === sourceActivePlanId) {
        migratedActivePlanId = targetPlanId;
      }
    }));

    if (sourceSettingsSnap.exists()) {
      await setDoc(targetSettingsRef, {
        ...sourceSettingsSnap.data(),
        activePlanId: migratedActivePlanId || sourceActivePlanId,
        migratedAt: now,
        updatedAt: now
      }, { merge: true });
    }

    const sourceWorkoutsSnap = await getDocs(collection(db, "users", sourceUserId, "workouts"));

    await Promise.all(sourceWorkoutsSnap.docs.map(workoutSnap =>
      setDoc(
        doc(db, "users", targetUserId, "workouts", workoutSnap.id),
        {
          ...workoutSnap.data(),
          migratedAt: now
        },
        { merge: true }
      )
    ));

    await setDoc(doc(db, "users", targetUserId), {
      displayName,
      usernameKey: targetUserId,
      updatedAt: now
    }, { merge: true });

    return true;
  } catch (error) {
    if (error?.code === "permission-denied") {
      console.warn("Skipped legacy profile migration because the old profile is no longer readable.", error);
      return false;
    }

    throw error;
  }
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
  registerServiceWorker();

  const defaultValidation = validateWorkoutObject(window.workouts || {});
  let activePlan = null;
  let workouts = {};
  let workoutDays = [];
  let gymOptions = [];
  let selectedGym = "";

  let currentDay = "";
  let currentPage = "homePage";
  let chart = null;
  let historyFilter = "All";
  const activeRestTimers = new Map();
  const EXPORT_WORKOUT_LIMIT = 30;

  let builderPlanName = "";
  let builderWorkouts = null;
  let selectedBuilderDay = "";
  let editingExerciseIndex = null;
  let builderDirty = false;
  let builderSavedNotice = false;

  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");
  const appMessage = document.getElementById("appMessage");
  const accountBtn = document.getElementById("accountBtn");
  const INSTALL_PROMPT_DISMISSED_KEY = "installPromptDismissed";

  window.addEventListener("error", event => {
    console.error(event.error || event.message);
    showMessage("Something went wrong while loading the app. Try closing and reopening it.", "error");
  });

  window.addEventListener("unhandledrejection", event => {
    console.error(event.reason);
    showMessage("Something went wrong while loading data. Check your connection and try again.", "error");
  });

  try {
    const authUser = await initializeUser();
    if (!authUser) {
      renderSignInPage();
      return;
    }
    const migratedFrom = localStorage.getItem("profileMigratedFrom");
    if (migratedFrom) {
      localStorage.removeItem("profileMigratedFrom");
      showMessage("Your workouts are now tied to your sign-in.", "success");
    }
  } catch (error) {
    console.error(error);
    showMessage("Couldn’t load your account. Please sign in again.", "error");
    renderSignInPage();
    return;

    if (!userId) {
      userId = normalizeUsername(displayName || "lifter") || "lifter";
      localStorage.setItem("userId", userId);
    }
  }

  if (defaultValidation.errors.length) {
    showMessage(
      `Your starter workout plan has issues:\n${defaultValidation.errors.map(e => `- ${e}`).join("\n")}`,
      "error"
    );
  }

  try {
    activePlan = await loadOrCreateActivePlan(defaultValidation.workouts);
    activePlan = await applyAccountPlanUpdates(activePlan, defaultValidation.workouts);
    workouts = activePlan.workouts;
    workoutDays = getOrderedWorkoutDays(workouts, activePlan.dayOrder);
  } catch (error) {
    console.error(error);
    showMessage("Couldn’t load your workout plan.", "error");
    activePlan = {
      id: "local_fallback",
      name: "Local Fallback Plan",
      workouts: defaultValidation.workouts,
      dayOrder: Object.keys(defaultValidation.workouts)
    };
    workouts = activePlan.workouts;
    workoutDays = activePlan.dayOrder;
  }

  if (!workoutDays.length) {
    showMessage("No workouts found. Go to Plan and add a workout day.", "error");
  }

  setupBottomNav();
  setupAccountButton();
  setupGymControls();
  setupTimerResumeHandlers();
  await loadGymSettings();
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
        const dayOrder = getOrderedWorkoutDays(validation.workouts, data.dayOrder);

        return {
          id: activePlanSnap.id,
          name: data.name || "Current Plan",
          workouts: orderWorkoutObject(validation.workouts, dayOrder),
          dayOrder,
          templateId: data.templateId || "",
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
      dayOrder: Object.keys(defaultWorkouts),
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
      dayOrder: Object.keys(defaultWorkouts),
      createdAt: now,
      updatedAt: now
    };
  }

  async function applyAccountPlanUpdates(currentPlan, defaultWorkouts) {
    const targetEmail = "alecwrichardson@gmail.com";
    const templateId = "clean_final_split_2026_07_01";
    const accountEmail = String(userEmail || auth.currentUser?.email || "").toLowerCase();

    if (accountEmail !== targetEmail) {
      return currentPlan;
    }

    const settingsRef = userSettingsDoc();
    const settingsSnap = await getDoc(settingsRef);
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};

    if (settings.planTemplateId === templateId || currentPlan?.templateId === templateId) {
      return currentPlan;
    }

    const validation = validateWorkoutObject(defaultWorkouts);
    if (validation.errors.length) {
      throw new Error(validation.errors.join("\n"));
    }

    const now = new Date().toISOString();
    const planId = currentPlan?.id || "current_plan";
    const dayOrder = Object.keys(defaultWorkouts);
    const orderedDays = getOrderedWorkoutDays(validation.workouts, dayOrder);
    const orderedWorkouts = orderWorkoutObject(validation.workouts, orderedDays);

    await setDoc(doc(db, "users", userId, "plans", planId), {
      name: "Clean Final Split",
      workouts: orderedWorkouts,
      dayOrder: orderedDays,
      templateId,
      updatedAt: now,
      createdAt: currentPlan?.createdAt || now
    });

    await setDoc(settingsRef, {
      activePlanId: planId,
      planTemplateId: templateId,
      planTemplateAppliedAt: now,
      updatedAt: now
    }, { merge: true });

    return {
      ...(currentPlan || {}),
      id: planId,
      name: "Clean Final Split",
      workouts: orderedWorkouts,
      dayOrder: orderedDays,
      templateId,
      updatedAt: now,
      createdAt: currentPlan?.createdAt || now
    };
  }

  async function saveActivePlanToStorage(nextWorkouts, planName = "Current Plan", nextDayOrder = []) {
    const validation = validateWorkoutObject(nextWorkouts);

    if (validation.errors.length) {
      throw new Error(validation.errors.join("\n"));
    }

    const now = new Date().toISOString();
    const planId = activePlan?.id || "current_plan";
    const planRef = doc(db, "users", userId, "plans", planId);
    const orderedDays = getOrderedWorkoutDays(validation.workouts, nextDayOrder);
    const orderedWorkouts = orderWorkoutObject(validation.workouts, orderedDays);

    await setDoc(planRef, {
      name: planName,
      workouts: orderedWorkouts,
      dayOrder: orderedDays,
      updatedAt: now,
      createdAt: activePlan?.createdAt || now
    });

    await setDoc(userSettingsDoc(), {
      activePlanId: planId,
      updatedAt: now
    }, { merge: true });

    activePlan = {
      ...(activePlan || {}),
      id: planId,
      name: planName,
      workouts: orderedWorkouts,
      dayOrder: orderedDays,
      updatedAt: now,
      createdAt: activePlan?.createdAt || now
    };

    workouts = orderedWorkouts;
    workoutDays = orderedDays;

    if (!workoutDays.includes(currentDay)) {
      currentDay = "";
    }

    historyFilter = "All";
  }

  async function loadGymSettings() {
    try {
      const settingsSnap = await getDoc(userSettingsDoc());
      const data = settingsSnap.exists() ? settingsSnap.data() : {};
      const savedGyms = Array.isArray(data.gyms) ? data.gyms : [];
      const storedGym = localStorage.getItem("selectedGym") || "";

      selectedGym = normalizeGymName(data.lastGym || storedGym || "");
      gymOptions = normalizeGymOptions([
        ...savedGyms,
        selectedGym
      ]);
    } catch (error) {
      console.error(error);
      selectedGym = normalizeGymName(localStorage.getItem("selectedGym") || "");
      gymOptions = normalizeGymOptions([selectedGym]);
    }

    renderGymSelector();
  }

  function setupGymControls() {
    document.getElementById("gymSelect")?.addEventListener("change", async event => {
      selectedGym = normalizeGymName(event.target.value);

      if (selectedGym) {
        gymOptions = normalizeGymOptions([...gymOptions, selectedGym]);
      }

      renderGymSelector();
      await saveGymSettings();
    });

    document.getElementById("addGymBtn")?.addEventListener("click", async () => {
      const nextGym = normalizeGymName(prompt("Gym name", selectedGym || ""));
      if (!nextGym) return;

      selectedGym = nextGym;
      gymOptions = normalizeGymOptions([...gymOptions, nextGym]);
      renderGymSelector();
      await saveGymSettings();
    });
  }

  function renderGymSelector() {
    const gymSelect = document.getElementById("gymSelect");
    if (!gymSelect) return;

    const options = normalizeGymOptions(gymOptions);
    gymSelect.innerHTML = `<option value="">Not set</option>`;

    options.forEach(gym => {
      const option = document.createElement("option");
      option.value = gym;
      option.textContent = gym;
      gymSelect.appendChild(option);
    });

    gymSelect.value = selectedGym || "";
  }

  async function saveGymSettings() {
    const gyms = normalizeGymOptions([...gymOptions, selectedGym]);

    localStorage.setItem("selectedGym", selectedGym || "");

    try {
      await setDoc(userSettingsDoc(), {
        lastGym: selectedGym || "",
        gyms,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (error) {
      console.error(error);
      showMessage("Gym selection did not save. Check your connection and try again.", "error");
    }
  }

  function normalizeGymName(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function normalizeGymOptions(values) {
    const seen = new Set();

    return (values || [])
      .map(normalizeGymName)
      .filter(Boolean)
      .filter(gym => {
        const key = gym.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.localeCompare(b));
  }

  /* =====================================================
     NAVIGATION
  ===================================================== */
  const MAIN_PAGE_ORDER = ["homePage", "workoutPage", "historyPage", "planPage"];
  const SWIPE_MIN_DISTANCE = 70;
  const SWIPE_DOMINANCE_RATIO = 1.5;
  const SWIPE_EDGE_GUARD = 20;
  let swipeStart = null;
  let swipeNavigationBusy = false;

  function setupBottomNav() {
    document.getElementById("bottomHome")?.addEventListener("click", async () => {
      await navigateToMainPage("homePage");
    });

    document.getElementById("bottomWorkout")?.addEventListener("click", async () => {
      await navigateToMainPage("workoutPage");
    });

    document.getElementById("bottomHistory")?.addEventListener("click", async () => {
      await navigateToMainPage("historyPage");
    });

    document.getElementById("bottomPlan")?.addEventListener("click", async () => {
      await navigateToMainPage("planPage");
    });

    setupSwipeNavigation();
  }

  async function navigateToMainPage(pageId) {
    if (pageId === "homePage") {
      await renderHome();
      showPage("homePage");
      return;
    }

    if (pageId === "workoutPage") {
      if (!currentDay) {
        await openSuggestedWorkoutFromNav();
      } else {
        await renderWorkout();
        showPage("workoutPage");
      }
      return;
    }

    if (pageId === "historyPage") {
      await renderHistory();
      showPage("historyPage");
      return;
    }

    if (pageId === "planPage") {
      initBuilderFromActivePlan();
      renderPlanPage();
      showPage("planPage");
    }
  }

  function setupSwipeNavigation() {
    const shell = document.querySelector(".appShell");
    if (!shell) return;

    shell.addEventListener("touchstart", event => {
      if (event.touches.length !== 1 || shouldIgnoreSwipeTarget(event.target)) {
        swipeStart = null;
        return;
      }

      const touch = event.touches[0];
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

      if (touch.clientX <= SWIPE_EDGE_GUARD || touch.clientX >= viewportWidth - SWIPE_EDGE_GUARD) {
        swipeStart = null;
        return;
      }

      swipeStart = {
        x: touch.clientX,
        y: touch.clientY
      };
    }, { passive: true });

    shell.addEventListener("touchend", event => {
      handleSwipeEnd(event).catch(error => {
        console.error(error);
        showMessage("Couldn’t change pages. Try the bottom navigation.", "error");
      });
    }, { passive: true });

    shell.addEventListener("touchcancel", () => {
      swipeStart = null;
    }, { passive: true });
  }

  function shouldIgnoreSwipeTarget(target) {
    return Boolean(target?.closest?.(
      "button, input, textarea, select, a, canvas, .bottomNav, .saveDock, .noteEditor, .swapEditor, .pulleyToggle, [contenteditable='true']"
    ));
  }

  async function handleSwipeEnd(event) {
    if (!swipeStart || swipeNavigationBusy || event.changedTouches.length !== 1) {
      swipeStart = null;
      return;
    }

    if (shouldIgnoreSwipeTarget(document.activeElement)) {
      swipeStart = null;
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - swipeStart.x;
    const deltaY = touch.clientY - swipeStart.y;
    swipeStart = null;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < SWIPE_MIN_DISTANCE || absX < absY * SWIPE_DOMINANCE_RATIO) {
      return;
    }

    const currentIndex = MAIN_PAGE_ORDER.indexOf(currentPage);
    if (currentIndex === -1) return;

    const direction = deltaX < 0 ? 1 : -1;
    const nextPage = MAIN_PAGE_ORDER[currentIndex + direction];
    if (!nextPage) return;

    swipeNavigationBusy = true;
    try {
      await navigateToMainPage(nextPage);
    } finally {
      swipeNavigationBusy = false;
    }
  }

  async function startWorkout(day) {
    currentDay = day;
    clearDraft();
    await renderWorkout();
    showPage("workoutPage");
  }

  async function openSuggestedWorkoutFromNav() {
    if (!workoutDays.length) {
      await renderWorkout();
      showPage("workoutPage");
      showMessage("No workouts found. Go to Plan and add a workout day.", "error");
      return;
    }

    let logs = [];

    try {
      logs = await getLogs();
    } catch (error) {
      console.error(error);
      showMessage("Couldn’t load your workout history, so we opened the first workout in your plan.", "error");
    }

    const suggestedDay = getSuggestedNextWorkout(logs) || workoutDays[0];
    await startWorkout(suggestedDay);
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

  function renderSignInPage() {
    currentPage = "homePage";
    document.querySelectorAll(".page").forEach(page => page.classList.add("hidden"));
    document.getElementById("homePage")?.classList.remove("hidden");
    document.querySelector(".bottomNav")?.classList.add("hidden");

    pageTitle.textContent = "Lift Tracker";
    pageSubtitle.textContent = "Sign in to continue";

    const activePlanName = document.getElementById("activePlanName");
    const activePlanMeta = document.getElementById("activePlanMeta");
    const todayCard = document.getElementById("todayWorkoutCard");
    const allWorkoutsGrid = document.getElementById("allWorkoutsGrid");
    const recentCard = document.getElementById("recentWorkoutCard");
    const progressCard = document.getElementById("homeProgressCard");
    const planCard = document.getElementById("homePlanCard");

    if (activePlanName) activePlanName.textContent = "Welcome back";
    if (activePlanMeta) activePlanMeta.textContent = "Sign in to load your workouts.";

    if (todayCard) {
      todayCard.innerHTML = `
        <p class="eyebrow">Account</p>
        <h3>Sign in with Google</h3>
        <p>Your workouts and plan will follow this account across Safari and the Home Screen app.</p>
        <div class="homeActions">
          <button id="googleSignInBtn" type="button" class="primaryBtn">Continue with Google</button>
        </div>
      `;

      document.getElementById("googleSignInBtn")?.addEventListener("click", async () => {
        const btn = document.getElementById("googleSignInBtn");
        if (btn) {
          btn.disabled = true;
          btn.textContent = "Opening Google...";
        }

        try {
          await signInWithGoogle();
        } catch (error) {
          console.error(error);
          showMessage(authErrorMessage(error), "error");
          if (btn) {
            btn.disabled = false;
            btn.textContent = "Continue with Google";
          }
        }
      });
    }

    if (allWorkoutsGrid) allWorkoutsGrid.innerHTML = "";
    if (recentCard) recentCard.innerHTML = "";
    if (progressCard) progressCard.innerHTML = "";
    if (planCard) planCard.innerHTML = "";
    accountBtn?.classList.add("hidden");
  }

  function setupAccountButton() {
    if (!accountBtn) return;

    accountBtn.classList.remove("hidden");
    accountBtn.textContent = displayName || "Account";
    accountBtn.title = displayName ? `Signed in as ${displayName}` : "Account";
    accountBtn.setAttribute("aria-label", accountBtn.title);

    accountBtn.addEventListener("click", async () => {
      const ok = confirm(`Sign out of ${displayName || "this account"}?`);
      if (!ok) return;

      await signOut(auth);
      window.location.reload();
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
    renderInstallPrompt();

    if (activePlanName) {
      activePlanName.textContent = activePlan?.name || "Current Plan";
    }

    if (activePlanMeta) {
      const totalExercises = workoutDays.reduce((sum, day) => sum + workouts[day].length, 0);
      activePlanMeta.textContent = `${workoutDays.length} workout days / ${totalExercises} exercises`;
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

  function renderInstallPrompt() {
    const existingPrompt = document.getElementById("installPrompt");
    existingPrompt?.remove();

    if (isRunningInstalled() || localStorage.getItem(INSTALL_PROMPT_DISMISSED_KEY) === "true") {
      return;
    }

    const homeHero = document.querySelector(".homeHero");
    if (!homeHero) return;

    const prompt = document.createElement("section");
    prompt.id = "installPrompt";
    prompt.className = "installPrompt";
    prompt.innerHTML = `
      <div>
        <strong>Add to Home Screen</strong>
        <p>For the best workout experience, open Lift Tracker from your iPhone Home Screen. In Safari, tap Share, then Add to Home Screen.</p>
      </div>
      <button id="dismissInstallPrompt" type="button" aria-label="Dismiss Home Screen reminder">x</button>
    `;

    homeHero.insertAdjacentElement("afterend", prompt);
    document.getElementById("dismissInstallPrompt")?.addEventListener("click", () => {
      localStorage.setItem(INSTALL_PROMPT_DISMISSED_KEY, "true");
      prompt.remove();
    });
  }

  function isRunningInstalled() {
    return window.navigator.standalone === true ||
      window.matchMedia?.("(display-mode: standalone)")?.matches === true;
  }

  function getSuggestedNextWorkout(logs) {
    if (!workoutDays.length) return "";

    const latestLog = getLatestWorkoutLog(logs);

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
    const orderedDays = getOrderedWorkoutDays(activePlan?.workouts || workouts || {}, activePlan?.dayOrder || workoutDays);
    builderWorkouts = orderWorkoutObject(
      deepClone(activePlan?.workouts || workouts || {}),
      orderedDays
    );
    selectedBuilderDay = orderedDays[0] || "";
    editingExerciseIndex = null;
    builderDirty = false;
    builderSavedNotice = false;
  }

  function markBuilderDirty() {
    builderDirty = true;
    builderSavedNotice = false;
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

    const statusHtml = builderDirty
      ? `<div class="builderStatus">Unsaved changes</div>`
      : builderSavedNotice
        ? `<div class="builderStatus saved">Plan saved</div>`
        : "";

    planOverview.innerHTML = `
      <div class="builderGrid">
        <section class="dashboardCard">
          <p class="eyebrow">Plan Name</p>
          <h3>Active workout plan</h3>

          <div class="builderField">
            <label for="builderPlanName">Plan name</label>
            <input id="builderPlanName" class="builderInput" value="${escapeAttribute(builderPlanName)}" placeholder="Current Plan" />
          </div>

          ${statusHtml}
          <div id="builderMessage" class="builderMessage hidden"></div>
        </section>

        <section class="dashboardCard">
          <button id="savePlanTopBtn" type="button" class="primaryBtn">Save Changes</button>
        </section>

        <section class="dashboardCard">
          <p class="eyebrow">Workout Days</p>
          <h3>Create days like Push A, Pull A, Legs</h3>

          <div id="builderDayChips" class="builderDayChips">
            ${builderDays.map((day, index) => `
              <div class="builderDayOrderItem ${day === selectedBuilderDay ? "active" : ""}">
                <button
                  type="button"
                  class="builderDayChip ${day === selectedBuilderDay ? "active" : ""}"
                  data-day="${escapeAttribute(day)}"
                >
                  <span>${index + 1}</span>
                  ${escapeHtml(day)}
                </button>
                <div class="builderDayOrderActions">
                  <button type="button" class="builderDayMoveBtn" data-action="day-up" data-day="${escapeAttribute(day)}" ${index === 0 ? "disabled" : ""} aria-label="Move ${escapeAttribute(day)} up">Up</button>
                  <button type="button" class="builderDayMoveBtn" data-action="day-down" data-day="${escapeAttribute(day)}" ${index === builderDays.length - 1 ? "disabled" : ""} aria-label="Move ${escapeAttribute(day)} down">Down</button>
                </div>
              </div>
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
                        ${Number(exercise.sets) || 0} sets / Target ${escapeHtml(exercise.target || "")}
                        ${exercise.rest ? ` / Rest ${escapeHtml(exercise.rest)}` : ""}
                        ${exercise.superset ? ` / Superset ${escapeHtml(exercise.superset)}` : ""}
                        ${exercise.equipment ? ` / ${escapeHtml(exercise.equipment)}` : ""}
                      </p>
                    </div>
                  </div>

                  <div class="builderExerciseActions">
                    <button type="button" class="builderMiniBtn" data-action="edit" data-index="${index}">Edit</button>
                    <button type="button" class="builderMiniBtn" data-action="up" data-index="${index}">Up</button>
                    <button type="button" class="builderMiniBtn" data-action="down" data-index="${index}">Down</button>
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

          <section id="exerciseEditorCard" class="dashboardCard">
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
          <button id="savePlanBottomBtn" type="button" class="primaryBtn">Save Changes</button>
        </section>
      </div>
    `;

    attachPlanBuilderEvents();
  }

  function attachPlanBuilderEvents() {
    const planNameInput = document.getElementById("builderPlanName");
    planNameInput?.addEventListener("input", () => {
      builderPlanName = planNameInput.value;
      markBuilderDirty();
      updateBuilderSaveButtons();
    });

    document.querySelectorAll(".builderDayChip").forEach(btn => {
      btn.addEventListener("click", () => {
        selectedBuilderDay = btn.dataset.day || "";
        editingExerciseIndex = null;
        renderPlanPage();
      });
    });

    document.querySelectorAll(".builderDayMoveBtn").forEach(btn => {
      btn.addEventListener("click", () => {
        moveBuilderDay(btn.dataset.day || "", btn.dataset.action);
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
      markBuilderDirty();
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
      markBuilderDirty();
      renderPlanPage();
    });

    document.getElementById("deleteDayBtn")?.addEventListener("click", () => {
      if (!selectedBuilderDay) return;

      const dayToDelete = selectedBuilderDay;
      const ok = confirm(`Delete ${dayToDelete} and all exercises in it?`);
      if (!ok) return;

      const nextWorkouts = {};

      Object.entries(builderWorkouts || {}).forEach(([day, exercises]) => {
        if (day !== dayToDelete) {
          nextWorkouts[day] = exercises;
        }
      });

      builderWorkouts = nextWorkouts;
      selectedBuilderDay = Object.keys(builderWorkouts)[0] || "";
      editingExerciseIndex = null;
      markBuilderDirty();
      renderPlanPage();

      setTimeout(() => {
        showBuilderMessage(`${dayToDelete} removed. Tap Save Changes to keep this change.`, "success");
      }, 0);
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

    document.getElementById("savePlanTopBtn")?.addEventListener("click", saveBuilderPlan);
    document.getElementById("savePlanBottomBtn")?.addEventListener("click", saveBuilderPlan);

    updateBuilderSaveButtons();
  }

  function updateBuilderSaveButtons() {
    const text = builderDirty ? "Save Changes" : "Saved";
    const disabled = !builderDirty;

    ["savePlanTopBtn", "savePlanBottomBtn"].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.textContent = text;
      btn.disabled = disabled;
    });
  }

  function moveBuilderDay(day, action) {
    const days = Object.keys(builderWorkouts || {});
    const index = days.indexOf(day);

    if (index === -1) return;

    const nextIndex = action === "day-up" ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= days.length) return;

    [days[index], days[nextIndex]] = [days[nextIndex], days[index]];

    const reordered = {};
    days.forEach(dayName => {
      reordered[dayName] = builderWorkouts[dayName];
    });

    builderWorkouts = reordered;
    selectedBuilderDay = day;
    editingExerciseIndex = null;
    markBuilderDirty();
    renderPlanPage();
  }

  function handleBuilderExerciseAction(action, index) {
    const list = builderWorkouts[selectedBuilderDay] || [];

    if (!Number.isInteger(index) || !list[index]) return;

    if (action === "edit") {
      editingExerciseIndex = index;
      renderPlanPage();
      requestAnimationFrame(() => {
        document.getElementById("exerciseEditorCard")?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
        document.getElementById("exerciseNameInput")?.focus({ preventScroll: true });
      });
      return;
    }

    if (action === "up" && index > 0) {
      [list[index - 1], list[index]] = [list[index], list[index - 1]];
      editingExerciseIndex = null;
      markBuilderDirty();
      renderPlanPage();
      return;
    }

    if (action === "down" && index < list.length - 1) {
      [list[index + 1], list[index]] = [list[index], list[index + 1]];
      editingExerciseIndex = null;
      markBuilderDirty();
      renderPlanPage();
      return;
    }

    if (action === "delete") {
      const ok = confirm(`Delete ${list[index].name}?`);
      if (!ok) return;

      list.splice(index, 1);
      editingExerciseIndex = null;
      markBuilderDirty();
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
    markBuilderDirty();
    renderPlanPage();
  }

  async function saveBuilderPlan() {
    const topBtn = document.getElementById("savePlanTopBtn");
    const bottomBtn = document.getElementById("savePlanBottomBtn");
    const planName = (document.getElementById("builderPlanName")?.value || builderPlanName || "Current Plan").trim();

    const validation = validateWorkoutObject(builderWorkouts || {});

    if (validation.errors.length) {
      showBuilderMessage(
        `Fix these issues first:\n${validation.errors.map(error => `- ${error}`).join("\n")}`,
        "error"
      );
      return;
    }

    try {
      [topBtn, bottomBtn].forEach(btn => {
        if (!btn) return;
        btn.disabled = true;
        btn.textContent = "Saving...";
      });

      await saveActivePlanToStorage(validation.workouts, planName, Object.keys(builderWorkouts || {}));

      builderPlanName = activePlan.name;
      builderWorkouts = deepClone(activePlan.workouts);
      selectedBuilderDay = workoutDays[0] || "";
      editingExerciseIndex = null;
      builderDirty = false;
      builderSavedNotice = true;

      await renderHome();
      renderPlanPage();

      setTimeout(() => {
        showBuilderMessage("Plan saved.", "success");
      }, 0);
    } catch (error) {
      console.error(error);
      showBuilderMessage(`Plan did not save:\n${error.message || error}`, "error");
    } finally {
      updateBuilderSaveButtons();
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
      const exerciseInstanceKey = card.dataset.exerciseInstanceKey || exerciseKey;

      const sets = [];
      const note = card.querySelector(".sessionNoteInput")?.value.trim() || "";

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

      exercises[exerciseInstanceKey] = {
        pulley: card.dataset.pulley || "",
        note,
        actualName: card.dataset.exerciseName || "",
        plannedName: card.dataset.plannedExerciseName || "",
        plannedIndex: Number(card.dataset.plannedIndex),
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
      return String(entry?.note || "").trim() ||
        Boolean(entry?.actualName && entry.actualName !== entry?.plannedName) ||
        sets.some(set =>
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

    stopAllRestTimers();

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
      const exerciseInstanceKey = `${exerciseKey}__${index}`;
      const swapListId = `swapOptions-${exerciseKey}`;
      const swapSuggestions = getSwapSuggestions(logs, exercise);
      const draftEntry = useDraft ? (draft.exercises?.[exerciseInstanceKey] || draft.exercises?.[exerciseKey]) : null;
      const draftSets = Array.isArray(draftEntry) ? draftEntry : draftEntry?.sets || null;
      const draftNote = !Array.isArray(draftEntry) ? draftEntry?.note || "" : "";
      const draftActualName = !Array.isArray(draftEntry) ? draftEntry?.actualName || "" : "";
      const sessionExerciseName = draftActualName || exercise.name;
      const isSwapped = sessionExerciseName !== exercise.name;
      const isCable = isCableExercise(exercise);
      const draftPulley = !Array.isArray(draftEntry) ? draftEntry?.pulley : "";
      const historyContext = getPreviousExerciseContext(logs, exercise, {
        actualName: isSwapped ? sessionExerciseName : "",
        plannedIndex: index,
        pulleyVariant: isCable ? draftPulley : ""
      });
      const previousExercise = historyContext.selectedExercise;
      const globalPreviousExercise = historyContext.globalReferenceExercise;
      const previousSets = previousExercise?.s || [];
      const previousNote = previousExercise?.note || "";
      const recommendation = getRecommendationWithContext(
        getExerciseRecommendation(exercise, previousExercise),
        historyContext
      );

      const nextExercise = template[index + 1];
      const isSupersetEnd =
        exercise.superset &&
        (!nextExercise || nextExercise.superset !== exercise.superset);

      const previousPulley = previousExercise?.pulley || globalPreviousExercise?.pulley || "";
      const startingPulley = isCable ? (draftPulley || previousPulley || "single") : "";

      const exerciseCard = document.createElement("article");
      exerciseCard.className = [
        "exercise",
        "exerciseCard",
        exercise.superset ? "inSuperset" : "",
        isSupersetEnd ? "supersetEnd" : ""
      ].filter(Boolean).join(" ");

      exerciseCard.dataset.exerciseKey = exerciseKey;
      exerciseCard.dataset.exerciseInstanceKey = exerciseInstanceKey;
      exerciseCard.dataset.exerciseName = sessionExerciseName;
      exerciseCard.dataset.plannedExerciseId = exerciseKey;
      exerciseCard.dataset.plannedExerciseName = exercise.name;
      exerciseCard.dataset.plannedIndex = String(index);
      exerciseCard.dataset.pulley = startingPulley;

      const globalPreviousSets = globalPreviousExercise?.s || [];
      const lastSummary = globalPreviousSets.length
        ? `Last: ${escapeHtml(formatSets(globalPreviousSets))}${globalPreviousExercise?.pulley ? ` / ${escapeHtml(formatPulley(globalPreviousExercise.pulley))}` : ""}`
        : "Last: No previous sets";

      exerciseCard.innerHTML = `
        <div class="exerciseHeader">
          <div class="exerciseTitle">
            <div class="exerciseNameRow">
              <h4 class="exerciseNameText">${escapeHtml(sessionExerciseName)}</h4>
              <div class="exerciseUtilityActions">
                <button type="button" class="noteToggleBtn ${draftNote ? "active" : ""}">${draftNote ? "Edit Note" : "Note"}</button>
                <button type="button" class="swapToggleBtn ${isSwapped ? "active" : ""}">${isSwapped ? "Edit Swap" : "Swap"}</button>
              </div>
            </div>
            <div class="exerciseMeta">
              <span class="pill target">Target ${escapeHtml(exercise.target)}</span>
              <span class="pill">${exercise.sets} sets</span>
              ${exercise.superset ? `<span class="pill supersetPill">Superset ${escapeHtml(exercise.superset)}</span>` : ""}
              ${exercise.rest ? `<span class="pill">Rest ${escapeHtml(exercise.rest)}</span>` : ""}
              ${exercise.type ? `<span class="pill">${escapeHtml(exercise.type)}</span>` : ""}
            </div>
            ${isSwapped ? `<p class="plannedExerciseHint">Planned: ${escapeHtml(exercise.name)}</p>` : ""}
            ${exercise.note ? `<p class="exerciseNote">${escapeHtml(exercise.note)}</p>` : ""}
            ${previousNote ? `<p class="lastHint">Previous note: ${escapeHtml(previousNote)}</p>` : ""}
          </div>
        </div>

        <div class="exerciseUtilityRow">
          <p class="lastHint exerciseLastHint" data-role="last-summary">${lastSummary}</p>
          <button type="button" class="recommendationBtn" aria-expanded="false">Tip</button>
        </div>

        <div class="recommendationPanel hidden" data-role="recommendation-panel">
          ${renderRecommendationContent(recommendation)}
        </div>

        <div class="noteEditor ${draftNote ? "" : "hidden"}">
          <textarea class="sessionNoteInput" rows="2" placeholder="Session note">${escapeHtml(draftNote)}</textarea>
        </div>

        <div class="swapEditor ${isSwapped ? "" : "hidden"}">
          <div class="swapCombo">
            <input class="swapInput" value="${escapeAttribute(sessionExerciseName)}" placeholder="Exercise for this session" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="${escapeAttribute(swapListId)}" />
            <button type="button" class="swapMenuBtn ${swapSuggestions.length ? "" : "hidden"}" aria-label="Show previous swaps"></button>
            <div class="swapOptionList hidden" id="${escapeAttribute(swapListId)}" role="listbox">
              ${swapSuggestions.map(name => `<button type="button" class="swapOption" role="option" data-swap-name="${escapeAttribute(name)}">${escapeHtml(name)}</button>`).join("")}
            </div>
          </div>
          <button type="button" class="swapResetBtn">Use planned</button>
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
            applySwapSelection({
              card: exerciseCard,
              exercise,
              logs,
              nextName: exerciseCard.dataset.exerciseName || exercise.name,
              overwriteSets: true
            });
            saveDraft(currentDay);
          });
        });
      }

      exerciseCard.querySelector(".noteToggleBtn")?.addEventListener("click", () => {
        const noteEditor = exerciseCard.querySelector(".noteEditor");
        const noteInput = exerciseCard.querySelector(".sessionNoteInput");
        const isHidden = noteEditor?.classList.toggle("hidden");
        if (!isHidden) {
          noteInput?.focus();
        }
      });

      exerciseCard.querySelector(".recommendationBtn")?.addEventListener("click", event => {
        const panel = exerciseCard.querySelector("[data-role='recommendation-panel']");
        const isHidden = panel?.classList.toggle("hidden");
        event.currentTarget.setAttribute("aria-expanded", String(!isHidden));
      });

      exerciseCard.querySelector(".swapToggleBtn")?.addEventListener("click", () => {
        const swapEditor = exerciseCard.querySelector(".swapEditor");
        const swapInput = exerciseCard.querySelector(".swapInput");
        const isHidden = swapEditor?.classList.toggle("hidden");
        if (!isHidden) {
          setSwapMenuOpen(exerciseCard, true);
          swapInput?.focus();
          swapInput?.select();
        }
      });

      const setSwapMenuOpen = (card, open) => {
        const input = card.querySelector(".swapInput");
        const optionList = card.querySelector(".swapOptionList");
        const options = [...card.querySelectorAll(".swapOption")];
        if (!input || !optionList) return;

        const inputName = normalizeExerciseName(input.value);
        const plannedName = normalizeExerciseName(exercise.name);
        const query = inputName === plannedName ? "" : inputName;
        let visibleCount = 0;

        options.forEach(option => {
          const name = option.dataset.swapName || "";
          const isVisible = !query || normalizeExerciseName(name).includes(query);
          option.classList.toggle("hidden", !isVisible);
          if (isVisible) visibleCount++;
        });

        const shouldOpen = open && visibleCount > 0;
        optionList.classList.toggle("hidden", !shouldOpen);
        input.setAttribute("aria-expanded", String(shouldOpen));
      };

      const swapInput = exerciseCard.querySelector(".swapInput");
      swapInput?.addEventListener("focus", () => {
        setSwapMenuOpen(exerciseCard, true);
      });

      swapInput?.addEventListener("input", event => {
        const nextName = event.target.value.trim();
        setSwapMenuOpen(exerciseCard, true);
        const matchesSuggestion = swapSuggestions.some(name => normalizeExerciseName(name) === normalizeExerciseName(nextName));
        if (matchesSuggestion) {
          applySwapSelection({ card: exerciseCard, exercise, logs, nextName, overwriteSets: true });
          saveDraft(currentDay);
        }
      });

      const commitSwapInput = event => {
        const nextName = titleCaseExerciseName(event.target.value.trim() || exercise.name);
        event.target.value = nextName;
        applySwapSelection({
          card: exerciseCard,
          exercise,
          logs,
          nextName,
          overwriteSets: true,
          clearWhenMissing: true
        });
        saveDraft(currentDay);
      };

      swapInput?.addEventListener("change", commitSwapInput);
      swapInput?.addEventListener("blur", event => {
        setTimeout(() => setSwapMenuOpen(exerciseCard, false), 120);
        commitSwapInput(event);
      });

      exerciseCard.querySelector(".swapMenuBtn")?.addEventListener("pointerdown", event => {
        event.preventDefault();
        setSwapMenuOpen(exerciseCard, true);
        swapInput?.focus();
      });

      exerciseCard.querySelectorAll(".swapOption").forEach(option => {
        option.addEventListener("pointerdown", event => {
          event.preventDefault();
          const nextName = titleCaseExerciseName(option.dataset.swapName || exercise.name);
          if (swapInput) {
            swapInput.value = nextName;
          }
          applySwapSelection({
            card: exerciseCard,
            exercise,
            logs,
            nextName,
            overwriteSets: true,
            clearWhenMissing: true
          });
          setSwapMenuOpen(exerciseCard, false);
          saveDraft(currentDay);
        });
      });

      exerciseCard.querySelector(".swapResetBtn")?.addEventListener("click", () => {
        if (swapInput) {
          swapInput.value = exercise.name;
        }
        applySwapSelection({
          card: exerciseCard,
          exercise,
          logs,
          nextName: exercise.name,
          overwriteSets: true,
          clearWhenMissing: true
        });
        saveDraft(currentDay);
      });

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

        repsInput.value = draftSet?.reps || previousSet?.reps || "";
        weightInput.value = draftSet?.weight || previousSet?.weight || "";

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
      stopRestTimer(button);

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
    stopRestTimer(button);

    const endsAt = Date.now() + seconds * 1000;

    button.classList.remove("timerComplete");
    button.classList.add("timerActive");

    const timer = {
      button,
      endsAt,
      intervalId: null
    };

    activeRestTimers.set(button, timer);
    updateRestTimer(button);

    timer.intervalId = setInterval(() => updateRestTimer(button), 1000);
  }

  function updateRestTimer(button) {
    const timer = activeRestTimers.get(button);
    if (!timer?.button) return;

    if (!timer.button.isConnected) {
      stopRestTimer(timer.button, { resetText: false });
      return;
    }

    const remainingMs = timer.endsAt - Date.now();
    const remainingSeconds = Math.ceil(remainingMs / 1000);

    if (remainingSeconds <= 0) {
      completeRestTimer(timer.button);
      return;
    }

    timer.button.classList.add("timerActive");
    timer.button.textContent = formatTimer(remainingSeconds);
  }

  function updateAllRestTimers() {
    [...activeRestTimers.keys()].forEach(updateRestTimer);
  }

  function completeRestTimer(button) {
    const timer = activeRestTimers.get(button);
    if (!timer?.button) return;

    if (timer.intervalId) {
      clearInterval(timer.intervalId);
    }

    timer.button.classList.remove("timerActive");
    timer.button.classList.add("timerComplete");
    timer.button.textContent = "✓";

    activeRestTimers.delete(button);

    setTimeout(() => {
      timer.button.classList.remove("timerComplete");
    }, 700);
  }

  function stopRestTimer(button, options = {}) {
    const { resetText = true } = options;
    const timer = activeRestTimers.get(button);
    if (!timer) return;

    if (timer.intervalId) {
      clearInterval(timer.intervalId);
    }

    if (timer.button?.isConnected && timer.button.dataset.done === "true") {
      timer.button.classList.remove("timerActive");
      if (resetText) {
        timer.button.textContent = "✓";
      }
    }

    activeRestTimers.delete(button);
  }

  function stopAllRestTimers() {
    [...activeRestTimers.keys()].forEach(button => stopRestTimer(button));
  }

  function setupTimerResumeHandlers() {
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        updateAllRestTimers();
      }
    });

    window.addEventListener("focus", updateAllRestTimers);
    window.addEventListener("pageshow", updateAllRestTimers);
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
      const rawExerciseName = card.dataset.exerciseName;
      const plannedExerciseId = card.dataset.plannedExerciseId || exerciseKey;
      const plannedExerciseName = card.dataset.plannedExerciseName || rawExerciseName;
      const plannedIndex = Number(card.dataset.plannedIndex);
      const pulley = card.dataset.pulley || "";
      const note = card.querySelector(".sessionNoteInput")?.value.trim() || "";
      const isSwapped = rawExerciseName && plannedExerciseName && exerciseSlug(rawExerciseName) !== exerciseSlug(plannedExerciseName);
      const exerciseName = isSwapped ? titleCaseExerciseName(rawExerciseName) : plannedExerciseName;

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
        id: isSwapped ? exerciseSlug(exerciseName) : exerciseKey,
        n: exerciseName,
        swapped: isSwapped,
        originalId: isSwapped ? plannedExerciseId : "",
        originalName: isSwapped ? plannedExerciseName : "",
        plannedId: isSwapped ? plannedExerciseId : "",
        plannedName: isSwapped ? plannedExerciseName : "",
        plannedIndex: Number.isFinite(plannedIndex) ? plannedIndex : 0,
        pulley,
        note,
        s: sets
      });
    });

    try {
      saveButton.disabled = true;
      saveButton.textContent = "Saving...";

      stopAllRestTimers();

      await addDoc(userWorkoutsCollection(), {
        schemaVersion: 4,
        planId: activePlan?.id || "",
        planName: activePlan?.name || "",
        gym: selectedGym || "",
        t: new Date().toISOString(),
        d: currentDay,
        e: exercises
      });

      clearDraft();

      if (saveAnimation) {
        saveAnimation.textContent = "Saved";
      }
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
        <div class="historyToolbar">
          <button id="exportWorkoutData" type="button" class="historyActionBtn">Export Last ${EXPORT_WORKOUT_LIMIT}</button>
        </div>
        <div class="historyEmpty">
          <h4>No saved workouts yet.</h4>
          <p>Save a workout and it will show up here.</p>
        </div>
      `;
      setupHistoryExportButton();
      return;
    }

    const toolbar = document.createElement("div");
    toolbar.className = "historyToolbar";
    toolbar.innerHTML = `
      <button id="exportWorkoutData" type="button" class="historyActionBtn">Export Last ${EXPORT_WORKOUT_LIMIT}</button>
    `;
    container.appendChild(toolbar);
    setupHistoryExportButton();

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
        const gymText = log.gym ? `${log.gym} / ` : "";

        const header = document.createElement("button");
        header.type = "button";
        header.className = "historyCardHeader";
        header.innerHTML = `
          <div class="historyCardMain">
            <div class="historyWorkoutName">${escapeHtml(log.d || "Workout")}</div>
            <div class="historyCardMeta">
              ${escapeHtml(formatCompactTime(log.t))} / ${escapeHtml(gymText)}${exerciseCount} exercises / ${workingSets} sets
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
          ${log.gym ? `
            <div>
              <strong>Gym</strong>
              <span>${escapeHtml(log.gym)}</span>
            </div>
          ` : ""}
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
                ${exercise.plannedName ? `<p>Planned: ${escapeHtml(exercise.plannedName)}</p>` : ""}
                <p>Best: ${escapeHtml(bestSetText(sets))}</p>
                ${exercise.note ? `<p class="historyExerciseNote">${escapeHtml(exercise.note)}</p>` : ""}
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

  function setupHistoryExportButton() {
    const exportButton = document.getElementById("exportWorkoutData");
    if (!exportButton) return;

    exportButton.addEventListener("click", async () => {
      await exportWorkoutData(exportButton);
    });
  }

  async function exportWorkoutData(button) {
    const originalText = button.textContent;

    try {
      button.disabled = true;
      button.textContent = "Exporting...";

      const logs = await getLogs();
      const exportData = buildWorkoutDataExport(logs, EXPORT_WORKOUT_LIMIT);
      const dateStamp = new Date().toISOString().slice(0, 10);
      const namePart = slugify(displayName || "lifter") || "lifter";

      downloadJsonFile(`lift-tracker-${namePart}-last-${EXPORT_WORKOUT_LIMIT}-${dateStamp}.json`, exportData);

      button.textContent = "Exported";
      setTimeout(() => {
        button.textContent = originalText;
      }, 1400);
    } catch (error) {
      console.error(error);
      button.textContent = "Export Failed";
      setTimeout(() => {
        button.textContent = originalText;
      }, 1400);
    } finally {
      button.disabled = false;
    }
  }

  function buildWorkoutDataExport(logs, workoutLimit = EXPORT_WORKOUT_LIMIT) {
    const allChronologicalLogs = [...(logs || [])].sort((a, b) => new Date(a.t) - new Date(b.t));
    const chronologicalLogs = allChronologicalLogs.slice(-workoutLimit);
    const exerciseTimelines = buildExerciseTimelines(chronologicalLogs);

    return {
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      app: "Lift Tracker",
      exportScope: {
        workoutLimit,
        totalSavedWorkouts: allChronologicalLogs.length,
        includedWorkouts: chronologicalLogs.length,
        includesEveryExerciseInIncludedWorkouts: true
      },
      profile: {
        name: displayName || "",
        userKey: usernameKey || ""
      },
      gymSettings: {
        selectedGym: selectedGym || "",
        gyms: normalizeGymOptions(gymOptions)
      },
      activePlan: {
        id: activePlan?.id || "",
        name: activePlan?.name || "Current Plan",
        dayOrder: [...workoutDays],
        workouts: deepClone(workouts)
      },
      summary: {
        totalSavedWorkouts: allChronologicalLogs.length,
        includedWorkouts: chronologicalLogs.length,
        firstWorkoutAt: chronologicalLogs[0]?.t || "",
        latestWorkoutAt: chronologicalLogs[chronologicalLogs.length - 1]?.t || "",
        totalVolume: chronologicalLogs.reduce((sum, log) => sum + workoutVolume(log), 0),
        workingSets: chronologicalLogs.reduce((sum, log) => sum + countWorkingSets(log), 0),
        workoutDays: [...new Set(chronologicalLogs.map(log => log.d).filter(Boolean))],
        exerciseCount: exerciseTimelines.length
      },
      analysis: {
        exerciseTimelines
      },
      workoutLogs: chronologicalLogs.map(log => deepClone(log))
    };
  }

  function buildExerciseTimelines(logs) {
    const exerciseMap = new Map();

    logs.forEach(log => {
      (log.e || []).forEach(exercise => {
        const key = getProgressExerciseKey(exercise);
        const label = getProgressExerciseLabel(exercise);
        const sets = Array.isArray(exercise.s) ? exercise.s : [];
        const cleanSets = sets
          .map((set, index) => ({
            set: index + 1,
            reps: Number(set.reps) || 0,
            weight: Number(set.weight) || 0,
            done: Boolean(set.done),
            volume: (Number(set.reps) || 0) * (Number(set.weight) || 0)
          }))
          .filter(set => set.reps > 0 || set.weight > 0);

        if (!exerciseMap.has(key)) {
          exerciseMap.set(key, {
            key,
            name: label,
            sessions: []
          });
        }

        exerciseMap.get(key).sessions.push({
          workoutId: log.id || "",
          workoutDay: log.d || "",
          workoutAt: log.t || "",
          gym: log.gym || "",
          plannedName: exercise.plannedName || exercise.originalName || "",
          swapped: Boolean(exercise.swapped),
          pulley: exercise.pulley || "",
          note: exercise.note || "",
          sets: cleanSets,
          metrics: {
            bestSet: bestSetText(cleanSets),
            estimatedOneRepMax: calculateMetric(cleanSets, "est1rm"),
            totalVolume: calculateMetric(cleanSets, "volume"),
            topWeight: calculateMetric(cleanSets, "topWeight"),
            workingSets: cleanSets.length
          }
        });
      });
    });

    return [...exerciseMap.values()]
      .map(exercise => ({
        ...exercise,
        sessionCount: exercise.sessions.length,
        latestWorkoutAt: exercise.sessions[exercise.sessions.length - 1]?.workoutAt || ""
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function downloadJsonFile(filename, data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    return `${list.length} exercises / ${setCount} sets`;
  }

  function getOrderedWorkoutDays(workoutMap, preferredOrder = []) {
    const days = Object.keys(workoutMap || {});
    const seen = new Set();
    const ordered = [];

    (Array.isArray(preferredOrder) ? preferredOrder : []).forEach(day => {
      if (days.includes(day) && !seen.has(day)) {
        ordered.push(day);
        seen.add(day);
      }
    });

    days.forEach(day => {
      if (!seen.has(day)) {
        ordered.push(day);
      }
    });

    return ordered;
  }

  function orderWorkoutObject(workoutMap, dayOrder) {
    const ordered = {};

    getOrderedWorkoutDays(workoutMap, dayOrder).forEach(day => {
      ordered[day] = workoutMap[day];
    });

    return ordered;
  }

  function getLatestWorkoutLog(logs) {
    return [...(logs || [])]
      .filter(log => log?.t)
      .sort((a, b) => new Date(a.t) - new Date(b.t))
      .pop() || null;
  }

  function getSwapSuggestions(logs, exerciseTemplate) {
    const plannedCandidates = getExerciseMatchCandidates(exerciseTemplate);
    const suggestions = new Map();

    [...(logs || [])]
      .sort((a, b) => new Date(b.t) - new Date(a.t))
      .flatMap(log => log.e || [])
      .forEach(savedExercise => {
        const name = String(savedExercise.n || "").trim();
        if (!name || name === exerciseTemplate.name) return;

        const savedPlannedName = savedExercise.originalName || savedExercise.plannedName || "";
        const savedPlannedId = savedExercise.originalId || savedExercise.plannedId || "";
        const hasPlannedReference =
          savedPlannedId === getExerciseKey(exerciseTemplate) ||
          normalizeExerciseName(savedPlannedName) === normalizeExerciseName(exerciseTemplate.name) ||
          exerciseSlug(savedPlannedName) === exerciseSlug(exerciseTemplate.name);
        const wasSwapForThisExercise =
          savedExercise.swapped && hasPlannedReference;

        const matchesThisExercise = exerciseMatchesCandidates(savedExercise, plannedCandidates, {
          includePlannedNames: true
        });

        if (!wasSwapForThisExercise && !hasPlannedReference && !matchesThisExercise) return;

        const key = exerciseSlug(name);
        if (!suggestions.has(key)) {
          suggestions.set(key, name);
        }
      });

    return [...suggestions.values()].slice(0, 8);
  }

  function getExerciseKey(exercise) {
    return exercise.id || slugify(exercise.name || "");
  }

  function updatePreviousExerciseDisplay(card, previousExercise) {
    const summary = card.querySelector("[data-role='last-summary']");
    if (!summary) return;

    const sets = previousExercise?.s || [];
    summary.textContent = sets.length
      ? `Last: ${formatSets(sets)}${previousExercise?.pulley ? ` / ${formatPulley(previousExercise.pulley)}` : ""}`
      : "Last: No previous sets";
  }

  function getPreviousExerciseContext(logs, exercise, options = {}) {
    return getBestPreviousExerciseContext({
      logs,
      exerciseId: getExerciseKey(exercise),
      exerciseName: exercise.name,
      aliases: Array.isArray(exercise.lastAlias) ? exercise.lastAlias : [],
      workoutDay: currentDay,
      plannedIndex: options.plannedIndex,
      actualName: options.actualName || "",
      pulleyVariant: options.pulleyVariant || "",
      selectedGym
    });
  }

  function getRecommendationWithContext(recommendation, historyContext) {
    return {
      ...recommendation,
      context: historyContext?.reason || "",
      reference: buildGlobalReferenceText(historyContext)
    };
  }

  function buildGlobalReferenceText(historyContext) {
    const selected = historyContext?.selectedEntry;
    const global = historyContext?.globalReferenceEntry;

    if (!selected || !global || selected === global) return "";

    const globalSets = global.exercise?.s || [];
    if (!globalSets.length) return "";

    const dayText = global.workoutDay ? ` on ${global.workoutDay}` : "";
    return `Global latest${dayText}: ${formatSets(globalSets)}.`;
  }

  function renderRecommendationContent(recommendation) {
    return `
      <div class="recommendationPanelHeader">
        <strong>${escapeHtml(recommendation.label)}</strong>
        <span>${escapeHtml(recommendation.confidence)}</span>
      </div>
      ${recommendation.context ? `<p>${escapeHtml(recommendation.context)}</p>` : ""}
      <p>${escapeHtml(recommendation.reason)}</p>
      <p>${escapeHtml(recommendation.action)}</p>
      ${recommendation.reference ? `<p>${escapeHtml(recommendation.reference)}</p>` : ""}
    `;
  }

  function applySwapSelection({
    card,
    exercise,
    logs,
    nextName,
    overwriteSets = false,
    clearWhenMissing = false
  }) {
    const actualName = String(nextName || exercise.name).trim() || exercise.name;
    const plannedIndex = Number(card.dataset.plannedIndex);
    const historyContext = getPreviousExerciseContext(logs, exercise, {
      actualName: actualName !== exercise.name ? actualName : "",
      plannedIndex,
      pulleyVariant: card.dataset.pulley || ""
    });
    const previousExercise = historyContext.selectedExercise;
    const globalPreviousExercise = historyContext.globalReferenceExercise;

    updateSwapVisualState(card, exercise, actualName);
    updatePreviousExerciseDisplay(card, globalPreviousExercise);
    updateRecommendationDisplay(
      card,
      getRecommendationWithContext(getExerciseRecommendation(exercise, previousExercise), historyContext)
    );
    applyPreviousSetsToInputs(card, previousExercise, { overwrite: overwriteSets, clearWhenMissing });
  }

  function updateRecommendationDisplay(card, recommendation) {
    const panel = card.querySelector("[data-role='recommendation-panel']");
    if (panel) {
      panel.innerHTML = renderRecommendationContent(recommendation);
    }
  }

  function updateSwapVisualState(card, exercise, actualName) {
    const plannedName = exercise.name;
    const isSwapped = exerciseSlug(actualName) !== exerciseSlug(plannedName);
    const title = card.querySelector(".exerciseNameText");
    const swapButton = card.querySelector(".swapToggleBtn");
    const meta = card.querySelector(".exerciseMeta");
    let plannedHint = card.querySelector(".plannedExerciseHint");

    card.dataset.exerciseName = actualName;
    if (title) {
      title.textContent = actualName;
    }

    if (swapButton) {
      swapButton.classList.toggle("active", isSwapped);
      swapButton.textContent = isSwapped ? "Edit Swap" : "Swap";
    }

    if (isSwapped) {
      if (!plannedHint && meta) {
        plannedHint = document.createElement("p");
        plannedHint.className = "plannedExerciseHint";
        meta.insertAdjacentElement("afterend", plannedHint);
      }
      if (plannedHint) {
        plannedHint.textContent = `Planned: ${plannedName}`;
      }
    } else {
      plannedHint?.remove();
    }
  }

  function applyPreviousSetsToInputs(card, previousExercise, options = {}) {
    const overwrite = Boolean(options.overwrite);
    const clearWhenMissing = Boolean(options.clearWhenMissing);
    const sets = previousExercise?.s || [];
    if (!sets.length && !(overwrite && clearWhenMissing)) return;

    card.querySelectorAll(".setRow").forEach((row, index) => {
      const previousSet = sets[index];
      if (!previousSet && !(overwrite && clearWhenMissing)) return;

      const repsInput = row.querySelector("input[data-field='reps']");
      const weightInput = row.querySelector("input[data-field='weight']");
      const repsValue = previousSet?.reps || "";
      const weightValue = previousSet?.weight || "";

      if (repsInput && (overwrite || !String(repsInput.value || "").trim())) {
        repsInput.value = repsValue;
      }

      if (weightInput && (overwrite || !String(weightInput.value || "").trim())) {
        weightInput.value = weightValue;
      }
    });
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
    if (log.gym) {
      lines.push(`Gym: ${log.gym}`);
    }
    lines.push(`Total volume: ${formatLargeNumber(workoutVolume(log))} lb`);
    lines.push(`Working sets: ${countWorkingSets(log)}`);
    lines.push("");

    (log.e || []).forEach(exercise => {
      const pulley = exercise.pulley ? ` — ${formatPulley(exercise.pulley)}` : "";
      lines.push(`${exercise.n || "Exercise"}${pulley}: ${formatSets(exercise.s || [])}`);
      if (exercise.plannedName) {
        lines.push(`Planned: ${exercise.plannedName}`);
      }
      if (exercise.note) {
        lines.push(`Note: ${exercise.note}`);
      }
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


  function titleCaseExerciseName(name) {
    const smallWords = new Set(["and", "or", "of", "the", "to", "with", "for"]);

    return String(name || "")
      .trim()
      .replace(/\s+/g, " ")
      .split(" ")
      .map((word, index) => {
        const lower = word.toLowerCase();
        if (lower === "db") return "DB";
        if (lower === "bb") return "BB";
        if (smallWords.has(lower) && index > 0) return lower;

        return lower
          .split("-")
          .map(part => part ? part[0].toUpperCase() + part.slice(1) : part)
          .join("-");
      })
      .join(" ");
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
