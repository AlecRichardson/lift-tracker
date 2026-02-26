import { db } from "./firebase.js";
import { collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/* =====================================================
   🔐 SIMPLE USER SYSTEM
===================================================== */
let userId = localStorage.getItem("userId") || crypto.randomUUID();
localStorage.setItem("userId", userId);
let displayName = localStorage.getItem("displayName") || prompt("Enter your name:") || "Lifter";
localStorage.setItem("displayName", displayName);

/* =====================================================
   📦 FIRESTORE HELPERS
===================================================== */
function userWorkoutsCollection() { return collection(db, "users", userId, "workouts"); }
async function getLogs() { const q = query(userWorkoutsCollection(), orderBy("t")); const snap = await getDocs(q); return snap.docs.map(d => ({ id: d.id, ...d.data() })); }

/* =====================================================
   🏋️ TEMPLATES
===================================================== */
const templates = {
  "Push A":["Barbell Bench Press","Dumbbell Lateral Raise","Incline Dumbbell Press","Rope Tricep Pushdowns","Overhead Dumbbell Tricep Extension","Face Pulls"],
  "Pull A":["Barbell Bent-Over Row","Dumbbell Hammer Curl","Lat Pulldown","Barbell Curl","Seated Cable Row","Cable Curl"],
  "Legs":["Squat","Leg Curl","Leg Press","Leg Extension"],
  "Push B":["Incline DB Press","Dumbbell Lateral Raise","Machine Chest Press","Face Pulls","Assisted Dips","Rope Tricep Pushdowns"],
  "Pull B":["Lat Pulldown (diff grip)","Barbell Curl","Seated Row","Dumbbell Hammer Curl","Rear Delt Fly"]
};

document.addEventListener("DOMContentLoaded", () => {
  let currentDay = "Push A", chart;

  /* ===============================
     📝 DRAFT STORAGE
  =============================== */
  function saveDraft(data){ localStorage.setItem("draftWorkout",JSON.stringify(data)); }
  function getDraft(){ return JSON.parse(localStorage.getItem("draftWorkout")) || null; }
  function clearDraft(){ localStorage.removeItem("draftWorkout"); }

  /* ===============================
     🏋️ RENDER WORKOUT
  =============================== */
  async function renderWorkout(){
    const container = document.getElementById("workoutContainer"); if(!container) return; container.innerHTML="";
    const draft=getDraft();
    let lastWorkout=null; try{ const logs = await getLogs(); lastWorkout=logs.filter(l=>l.d===currentDay).pop(); }catch{}
    
    templates[currentDay].forEach((exName,exIndex)=>{
      const exDiv=document.createElement("div"); exDiv.className="exercise"; exDiv.innerHTML=`<h4>${exName}</h4>`;
      for(let i=0;i<3;i++){
        const row=document.createElement("div"); row.className="setRow";
        const labelReps=document.createElement("label"); labelReps.textContent="Reps"; const reps=document.createElement("input"); reps.type="number"; reps.placeholder="0";
        const labelWeight=document.createElement("label"); labelWeight.textContent="Weight"; const weight=document.createElement("input"); weight.type="number"; weight.placeholder="0";
        
        // Prefill
        if(lastWorkout){ const match=lastWorkout.e.find(e=>e.n===exName); if(match&&match.s[i]){ reps.value=match.s[i].reps; weight.value=match.s[i].weight; } }
        else if(draft){ const draftIndex=exIndex*3+i; if(draft[draftIndex]){ reps.value=draft[draftIndex].reps||""; weight.value=draft[draftIndex].weight||""; } }

        row.appendChild(labelReps); row.appendChild(reps);
        row.appendChild(labelWeight); row.appendChild(weight);
        exDiv.appendChild(row);
      }
      container.appendChild(exDiv);
    });
  }

  /* ===============================
     🔄 AUTO SAVE DRAFT
  =============================== */
  document.addEventListener("input",()=>{
    const draft=[];
    document.querySelectorAll(".setRow").forEach(row=>{
      const inputs=row.querySelectorAll("input"); draft.push({reps:inputs[0].value, weight:inputs[1].value});
    });
    saveDraft(draft);
  });

  /* ===============================
     💾 SAVE WORKOUT
  =============================== */
  const feedback = document.getElementById("saveFeedback");
  document.getElementById("saveWorkout").addEventListener("click", async()=>{
    const exercises=[];
    document.querySelectorAll(".exercise").forEach(ex=>{
      const name=ex.querySelector("h4").textContent;
      const sets=[];
      ex.querySelectorAll(".setRow").forEach(row=>{
        const inputs=row.querySelectorAll("input"); sets.push({reps:+inputs[0].value||0, weight:+inputs[1].value||0});
      });
      exercises.push({n:name,s:sets});
    });
    await addDoc(userWorkoutsCollection(),{t:new Date().toISOString(), d:currentDay, e:exercises});
    clearDraft(); renderWorkout();
    feedback.style.display="block"; setTimeout(()=>feedback.style.display="none",1200);
  });

  /* ===============================
     📜 HISTORY
  =============================== */
  async function renderHistory(){
    const container=document.getElementById("historyList"); if(!container)return; container.innerHTML="";
    const logs=(await getLogs()).reverse(); let openItem=null;
    logs.forEach(log=>{
      const wrapper=document.createElement("div"); wrapper.className="historyWrapper";
      const deleteBtn=document.createElement("button"); deleteBtn.className="deleteBtn"; deleteBtn.textContent="Delete";
      deleteBtn.addEventListener("click",async e=>{ e.stopPropagation(); await deleteDoc(doc(db,"users",userId,"workouts",log.id)); renderHistory(); });

      const item=document.createElement("div"); item.className="historyItem"; item.innerHTML=`<strong>${formatTimestamp(log.t)} - ${log.d}</strong>`;
      const details=document.createElement("div"); details.className="historyDetails hidden";
      log.e.forEach(ex=>{ const exDiv=document.createElement("div"); exDiv.innerHTML=`<strong>${ex.n}</strong>: ${ex.s.map(s=>`${s.reps}x${s.weight}`).join(", ")}`; details.appendChild(exDiv); });

      item.appendChild(details); wrapper.appendChild(deleteBtn); wrapper.appendChild(item); container.appendChild(wrapper);

      let startX=0,currentX=0,isSwiping=false;
      item.addEventListener("touchstart",e=>{startX=e.touches[0].clientX;isSwiping=false;});
      item.addEventListener("touchmove",e=>{
        const diff=e.touches[0].clientX-startX;
        if(diff<0){isSwiping=true;if(openItem&&openItem!==item)openItem.style.transform="translateX(0)"; currentX=Math.max(diff,-90); item.style.transform=`translateX(${currentX}px)`; openItem=item;}
        if(diff>0&&openItem===item){isSwiping=true; currentX=Math.min(diff-90,0); item.style.transform=`translateX(${currentX}px)`;}
      });
      item.addEventListener("touchend",()=>{if(isSwiping){if(currentX<-45){item.style.transform="translateX(-90px)"; openItem=item;}else{item.style.transform="translateX(0)"; openItem=null;}} else{details.classList.toggle("hidden");}});
    });
  }

  /* ===============================
     📈 PROGRESS
  =============================== */
  async function renderChart() {
  const logs = await getLogs();
  const exSet = new Set();
  logs.forEach(l => l.e.forEach(e => exSet.add(e.n)));

  const select = document.getElementById("exerciseSelect");
  select.innerHTML = "";
  exSet.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    select.appendChild(opt);
  });

  if (!select.value && select.options.length > 0) select.value = select.options[0].value;
  if (!select.value) return;

  const labels = [];
  const data = [];

  logs.forEach(l => {
    const ex = l.e.find(e => e.n === select.value);
    if (!ex) return;
    const top = Math.max(...ex.s.map(s => s.weight));
    labels.push(new Date(l.t).toLocaleDateString());
    data.push(top);
  });

  if (chart) chart.destroy();

  const ctx = document.getElementById("progressChart")?.getContext("2d");
  if (!ctx) return;

  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: select.value,
        data,
        borderColor: "#7289da",
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { ticks: { color: "#fff" } },
        x: { ticks: { color: "#fff" } }
      }
    }
  });
}
  document.getElementById("exerciseSelect")?.addEventListener("change",renderChart);

  function formatTimestamp(ts){ const date=new Date(ts); return date.toLocaleString("en-US",{month:"long",day:"numeric",weekday:"long",hour:"numeric",minute:"2-digit"}); }

  /* ===============================
     📂 NAVIGATION
  =============================== */
  const drawer=document.getElementById("drawer");
  document.getElementById("hamburger")?.addEventListener("click",()=>drawer?.classList.add("open"));
  document.getElementById("closeDrawer")?.addEventListener("click",()=>drawer?.classList.remove("open"));

  function showPage(page){ document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden")); document.getElementById(page)?.classList.remove("hidden"); drawer?.classList.remove("open"); }
  document.querySelectorAll(".navWorkout").forEach(btn=>{ btn.addEventListener("click",()=>{ currentDay=btn.dataset.day; renderWorkout(); showPage("workoutPage"); });});
  document.getElementById("navHistory")?.addEventListener("click",()=>{ renderHistory(); showPage("historyPage"); });
  document.getElementById("navProgress")?.addEventListener("click",()=>{ renderChart(); showPage("progressPage"); });

  renderWorkout();
});
