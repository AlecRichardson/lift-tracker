import { db } from "./firebase.js";
import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  setDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// ======================
// User Setup (No Auth)
// ======================
let userId = localStorage.getItem("userId") || crypto.randomUUID();
localStorage.setItem("userId", userId);

let displayName = localStorage.getItem("displayName") || prompt("Enter your name:") || "Lifter";
localStorage.setItem("displayName", displayName);

// ======================
// Firestore Helpers
// ======================
function userWorkoutsCollection() {
  return collection(db, "users", userId, "workouts");
}

function userTemplatesCollection() {
  return collection(db, "users", userId, "templates");
}

async function getLogs() {
  const q = query(userWorkoutsCollection(), orderBy("t"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getTemplates() {
  const q = query(userTemplatesCollection());
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ======================
// Default Templates
// ======================
window.workouts = {
  "Push A":[
    {name:"Barbell Bench Press",sets:4,target:"8–10",superset:"A1",rest:"60–90 sec"},
    {name:"Dumbbell Lateral Raise",sets:4,target:"12–15",superset:"A1",rest:"60–90 sec"},
    {name:"Incline Dumbbell Press",sets:3,target:"8–10",superset:"B1",rest:"60–90 sec"},
    {name:"Rope Tricep Pushdowns",sets:3,target:"10–12",superset:"B1",rest:"60–90 sec"},
    {name:"Overhead Dumbbell Tricep Extension",sets:3,target:"10",superset:"C1",rest:"60–90 sec"},
    {name:"Face Pulls",sets:3,target:"12–15",superset:"C1",rest:"60–90 sec"}
  ],
  "Pull A":[
    {name:"Barbell Bent-Over Row",sets:4,target:"8–10",superset:"A1",rest:"60–90 sec"},
    {name:"Dumbbell Hammer Curl",sets:4,target:"10",superset:"A1",rest:"60–90 sec"},
    {name:"Lat Pulldown",sets:3,target:"8–10",superset:"B1",rest:"60–90 sec"},
    {name:"Barbell Curl",sets:3,target:"10",superset:"B1",rest:"60–90 sec"},
    {name:"Seated Cable Row",sets:3,target:"10",superset:"C1",rest:"60–90 sec"},
    {name:"Cable Curl",sets:"2–3",target:"12",superset:"C1",rest:"60–90 sec"}
  ],
  "Legs":[
    {name:"Squat",sets:4,target:"8–10",superset:"",rest:"90 sec"},
    {name:"Leg Curl",sets:4,target:"8–10",superset:"B1",rest:"60–90 sec"},
    {name:"Leg Press",sets:4,target:"8–12",superset:"B1",rest:"60–90 sec"},
    {name:"Leg Extension",sets:"2–3",target:"12–15",superset:"",rest:"60–90 sec"}
  ],
  "Push B":[
    {name:"Incline DB Press",sets:4,target:"8–10",superset:"A1",rest:"60–90 sec"},
    {name:"Dumbbell Lateral Raise",sets:4,target:"12–15",superset:"A1",rest:"60–90 sec"},
    {name:"Machine Chest Press",sets:3,target:"10",superset:"B1",rest:"60–90 sec"},
    {name:"Face Pulls",sets:3,target:"12–15",superset:"B1",rest:"60–90 sec"},
    {name:"Assisted Dips",sets:3,target:"8–10",superset:"C1",rest:"60–90 sec"},
    {name:"Rope Tricep Pushdowns",sets:"2–3",target:"12",superset:"C1",rest:"60–90 sec"}
  ],
  "Pull B":[
    {name:"Lat Pulldown (diff grip)",sets:4,target:"8–10",superset:"A1",rest:"60–90 sec"},
    {name:"Barbell Curl",sets:4,target:"8–10",superset:"A1",rest:"60–90 sec"},
    {name:"Seated Row",sets:3,target:"10",superset:"B1",rest:"60–90 sec"},
    {name:"Dumbbell Hammer Curl",sets:3,target:"10",superset:"B1",rest:"60–90 sec"},
    {name:"Rear Delt Fly",sets:3,target:"12–15",superset:"",rest:"60–90 sec"}
  ]
};

// ======================
// DOMContentLoaded
// ======================
document.addEventListener("DOMContentLoaded", () => {
  let currentDay = "Push A";
  let chart;
  let openHistoryItem = null;

  // -------------------- Drawer --------------------
  const drawer = document.getElementById("drawer");
  document.getElementById("hamburger")?.addEventListener("click", () => drawer?.classList.add("open"));
  document.getElementById("closeDrawer")?.addEventListener("click", () => drawer?.classList.remove("open"));

  function showPage(page) {
    document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
    document.getElementById(page)?.classList.remove("hidden");
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

  document.getElementById("navManageTemplates")?.addEventListener("click", () => {
    renderTemplates();
    showPage("manageTemplatesPage");
  });

  // -------------------- Draft Storage --------------------
  function saveDraft(data) { localStorage.setItem("draftWorkout", JSON.stringify(data)); }
  function getDraft() { return JSON.parse(localStorage.getItem("draftWorkout")) || null; }
  function clearDraft() { localStorage.removeItem("draftWorkout"); }

  // -------------------- Render Workout --------------------
  async function renderWorkout(loadLast=false) {
    const container = document.getElementById("exerciseContainer");
    if (!container) return;
    container.innerHTML = "";
    document.getElementById("pageTitle").textContent = currentDay;

    // Load last workout if requested
    let lastSetsMap = {};
    if(loadLast){
      const logs = (await getLogs()).filter(l=>l.d===currentDay);
      if(logs.length>0){
        const last = logs[logs.length-1];
        last.e.forEach(ex => { lastSetsMap[ex.n] = ex.s; });
      }
    }

    // Merge default + user templates
    let template = window.workouts[currentDay] || [];
    const userTemplates = await getTemplates();
    const customTemplate = userTemplates.find(t=>t.name===currentDay);
    if(customTemplate) template = customTemplate.exercises;

    let currentSuperset = "";
    template.forEach(ex => {
      if(ex.superset && ex.superset !== currentSuperset){
        const supDiv = document.createElement("div");
        supDiv.className = "exercise";
        supDiv.innerHTML = `<h4>Superset ${ex.superset}</h4>`;
        container.appendChild(supDiv);
        currentSuperset = ex.superset;
      }

      const div = document.createElement("div");
      div.className = "exercise";
      div.innerHTML = `<h4>${ex.name} (${ex.sets}x${ex.target})</h4>`;

      const numSets = parseInt(ex.sets) || 1;
      for(let i=0;i<numSets;i++){
        const row = document.createElement("div");
        row.className = "setRow";

        const repsInput = document.createElement("input");
        repsInput.type="number";
        repsInput.placeholder="Reps";
        repsInput.value = lastSetsMap[ex.name]?.[i]?.reps ?? "";

        const weightInput = document.createElement("input");
        weightInput.type="number";
        weightInput.placeholder="Weight";
        weightInput.value = lastSetsMap[ex.name]?.[i]?.weight ?? "";

        row.appendChild(repsInput);
        row.appendChild(weightInput);
        div.appendChild(row);
      }

      container.appendChild(div);
    });
  }

  // -------------------- Save Workout --------------------
  document.getElementById("saveWorkout")?.addEventListener("click", async () => {
    const exercises=[];
    document.querySelectorAll(".exercise").forEach(ex=>{
      const name = ex.querySelector("h4")?.textContent.split(" (")[0];
      if(!name || name.startsWith("Superset")) return;
      const sets=[];
      ex.querySelectorAll(".setRow").forEach(row=>{
        const inputs=row.querySelectorAll("input");
        sets.push({ reps: +inputs[0].value||0, weight: +inputs[1].value||0 });
      });
      exercises.push({ n:name, s:sets });
    });

    await addDoc(userWorkoutsCollection(), { t:new Date().toISOString
