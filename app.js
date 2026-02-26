import { db } from "./firebase.js";
import {
  collection, addDoc, getDocs, deleteDoc, doc, query, orderBy
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/* ===============================
   USER SETUP
=============================== */
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

/* ===============================
   WORKOUT TEMPLATES
=============================== */
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
    { name: "Leg Extension", sets: 3, target: "12–15", superset: "", rest: "60–90 sec" }
  ]
};

document.addEventListener("DOMContentLoaded", () => {
  let currentDay = "Push A";
  let chart = null;

  /* --------------------
     LOCAL STORAGE DRAFTS
  -------------------- */
  function saveDraft(data){ localStorage.setItem("draftWorkout", JSON.stringify(data)); }
  function getDraft(){ return JSON.parse(localStorage.getItem("draftWorkout") || "[]"); }

  /* --------------------
     FIRESTORE HELPERS
  -------------------- */
  const userCollection = () => collection(db, "users", userId, "workouts");
  async function getLogs() {
    const q = query(userCollection(), orderBy("t"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d=>({id:d.id,...d.data()}));
  }

  /* --------------------
     RENDER WORKOUT
  -------------------- */
  const container = document.getElementById("exerciseContainer");
  const pageTitle = document.getElementById("pageTitle");

  async function renderWorkout() {
    container.innerHTML = "";
    pageTitle.textContent = currentDay;

    const template = [...(window.workouts[currentDay]||[])];

    // Prefill last workout
    const logs = await getLogs();
    const lastLog = logs.reverse().find(l=>l.d===currentDay);
    
    template.forEach(ex=>{
      const div = document.createElement("div");
      div.className="exercise";

      let setsReps = `${ex.sets}x${ex.target}`;
      if(ex.superset) {
        const supLabel = document.createElement("div");
        supLabel.className="supersetLabel";
        supLabel.textContent = `Superset ${ex.superset}`;
        container.appendChild(supLabel);
      }

      div.innerHTML=`<h4>${ex.name} (${setsReps})</h4>`;

      for(let i=0;i<ex.sets;i++){
        const row=document.createElement("div");
        row.className="setRow";

        const reps=document.createElement("input");
        reps.type="number";
        reps.placeholder="Reps";
        reps.value = lastLog?.e?.find(le=>le.n===ex.name)?.s[i]?.reps || 0;

        const weight=document.createElement("input");
        weight.type="number";
        weight.placeholder="Weight";
        weight.value = lastLog?.e?.find(le=>le.n===ex.name)?.s[i]?.weight || 0;

        row.appendChild(reps);
        row.appendChild(weight);
        div.appendChild(row);
      }

      container.appendChild(div);
    });
  }

  /* --------------------
     SAVE WORKOUT
  -------------------- */
  document.getElementById("saveWorkout").addEventListener("click", async ()=>{
    const exercises=[];
    document.querySelectorAll(".exercise").forEach(ex=>{
      const name = ex.querySelector("h4").textContent.split(" (")[0];
      const sets=[];
      ex.querySelectorAll(".setRow").forEach(row=>{
        const inputs=row.querySelectorAll("input");
        sets.push({
          reps:+inputs[0].value||0,
          weight:+inputs[1].value||0
        });
      });
      exercises.push({n:name,s:sets});
    });

    await addDoc(userCollection(),{
      t:new Date().toISOString(),
      d:currentDay,
      e:exercises
    });
    alert("Workout Saved 💪");
    renderWorkout();
  });

  /* --------------------
     DRAWER
  -------------------- */
  const drawer=document.getElementById("drawer");
  document.getElementById("hamburger")?.addEventListener("click",()=>drawer.classList.add("open"));
  document.getElementById("closeDrawer")?.addEventListener("click",()=>drawer.classList.remove("open"));

  document.querySelectorAll(".navWorkout").forEach(btn=>{
    btn.addEventListener("click",()=>{
      currentDay=btn.dataset.day;
      renderWorkout();
      drawer.classList.remove("open");
    });
  });

  /* --------------------
     HISTORY
  -------------------- */
  const historyList=document.getElementById("historyList");
  async function renderHistory(){
    historyList.innerHTML="";
    const logs=(await getLogs()).reverse();
    let openItem=null;

    logs.forEach(log=>{
      const wrapper=document.createElement("div");
      wrapper.className="historyWrapper";

      const deleteBtn=document.createElement("button");
      deleteBtn.className="deleteBtn";
      deleteBtn.textContent="Delete";
      deleteBtn.addEventListener("click",async e=>{
        e.stopPropagation();
        await deleteDoc(doc(db,"users",userId,"workouts",log.id));
        renderHistory();
      });

      const item=document.createElement("div");
      item.className="historyItem";
      item.innerHTML=`<strong>${new Date(log.t).toLocaleString()} - ${log.d}</strong>`;

      const details=document.createElement("div");
      details.className="historyDetails hidden";
      log.e.forEach(ex=>{
        const exDiv=document.createElement("div");
        exDiv.innerHTML=`<strong>${ex.n}</strong>: ${ex.s.map(s=>`${s.reps}x${s.weight}`).join(", ")}`;
        details.appendChild(exDiv);
      });

      item.appendChild(details);
      wrapper.appendChild(deleteBtn);
      wrapper.appendChild(item);
      historyList.appendChild(wrapper);

      let startX=0, currentX=0, isSwiping=false;

      item.addEventListener("touchstart",e=>{
        startX=e.touches[0].clientX;
        isSwiping=false;
      });

      item.addEventListener("touchmove",e=>{
        const diff=e.touches[0].clientX-startX;
        if(diff<0){
          isSwiping=true;
          if(openItem && openItem!==item) openItem.style.transform="translateX(0)";
          currentX=Math.max(diff,-80);
          item.style.transform=`translateX(${currentX}px)`;
          openItem=item;
        } else if(diff>0 && openItem===item){
          currentX=Math.min(diff-80,0);
          item.style.transform=`translateX(${currentX}px)`;
        }
      });

      item.addEventListener("touchend",()=>{
        if(isSwiping){
          if(currentX<-40) { item.style.transform="translateX(-80px)"; openItem=item; }
          else { item.style.transform="translateX(0)"; openItem=null; }
        } else { details.classList.toggle("hidden"); }
      });
    });
  }

  document.getElementById("navHistory")?.addEventListener("click",()=>{
    renderHistory();
    document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
    document.getElementById("historyPage").classList.remove("hidden");
    drawer.classList.remove("open");
  });

  /* --------------------
     CHART
  -------------------- */
  const chartSelect=document.getElementById("exerciseSelect");
  const chartMode=document.getElementById("chartMode");

  async function renderChart(){
    const logs = await getLogs();
    const dataPoints=[];
    const selected=chartSelect.value;
    const mode=chartMode.value;

   
