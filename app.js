import { db, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy } from "./firebase.js";

document.addEventListener("DOMContentLoaded", () => {

  // ------------------------------
  // SIMPLE USER SYSTEM
  // ------------------------------
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

  // ------------------------------
  // WORKOUT TEMPLATES
  // ------------------------------
  const workouts = {
    "Push A": ["Barbell Bench Press","Dumbbell Lateral Raise","Incline Dumbbell Press","Rope Tricep Pushdowns","Overhead Dumbbell Tricep Extension","Face Pulls"],
    "Pull A": ["Barbell Bent-Over Row","Dumbbell Hammer Curl","Lat Pulldown","Barbell Curl","Seated Cable Row","Cable Curl"],
    "Legs": ["Squat","Leg Curl","Leg Press","Leg Extension"],
    "Push B": ["Incline DB Press","Dumbbell Lateral Raise","Machine Chest Press","Face Pulls","Assisted Dips","Rope Tricep Pushdowns"],
    "Pull B": ["Lat Pulldown (diff grip)","Barbell Curl","Seated Row","Dumbbell Hammer Curl","Rear Delt Fly"]
  };

  let currentDay = "Push A";
  let chart = null;

  // ------------------------------
  // LOCAL DRAFT HELPERS
  // ------------------------------
  function saveDraft(data){ localStorage.setItem("draftWorkout",JSON.stringify(data)); }
  function getDraft(){ return JSON.parse(localStorage.getItem("draftWorkout")||"[]"); }
  function clearDraft(){ localStorage.removeItem("draftWorkout"); }

  // ------------------------------
  // FIRESTORE HELPERS
  // ------------------------------
  function userWorkoutsCollection(){ return collection(db,"users",userId,"workouts"); }

  async function getLogs() {
    const q = query(userWorkoutsCollection(), orderBy("t"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d=>({id:d.id,...d.data()}));
  }

  async function deleteLog(id){ await deleteDoc(doc(db,"users",userId,"workouts",id)); }

  // ------------------------------
  // DRAWER & NAV
  // ------------------------------
  const drawer=document.getElementById("drawer");
  document.getElementById("hamburger").onclick=()=>drawer.classList.add("open");
  document.getElementById("closeDrawer").onclick=()=>drawer.classList.remove("open");

  function showPage(page){
    document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
    document.getElementById(page).classList.remove("hidden");
    drawer.classList.remove("open");
  }

  document.querySelectorAll(".navWorkout").forEach(btn=>{
    btn.onclick=()=>{ currentDay=btn.dataset.day; renderWorkout(); showPage("workoutPage"); };
  });
  document.getElementById("navProgress").onclick=()=>{ renderChart(); showPage("progressPage"); };
  document.getElementById("navHistory").onclick=()=>{ renderHistory(); showPage("historyPage"); };

  // ------------------------------
  // RENDER WORKOUT
  // ------------------------------
  function renderWorkout(){
    const container=document.getElementById("exerciseContainer");
    if(!container) return;
    container.innerHTML="";
    const template=workouts[currentDay]||[];
    const draft=getDraft();

    template.forEach((exName,exIndex)=>{
      const div=document.createElement("div");
      div.className="exercise";
      div.innerHTML=`<h4>${exName}</h4>`;
      for(let i=0;i<3;i++){
        const row=document.createElement("div");
        row.className="setRow";
        const reps=document.createElement("input");
        reps.placeholder="Reps"; reps.type="number";
        const weight=document.createElement("input");
        weight.placeholder="Weight"; weight.type="number";
        const draftVal=draft[exIndex*3+i];
        if(draftVal){ reps.value=draftVal.reps||""; weight.value=draftVal.weight||""; }
        row.appendChild(reps); row.appendChild(weight); div.appendChild(row);
      }
      container.appendChild(div);
    });
  }

  // ------------------------------
  // AUTO SAVE DRAFT
  // ------------------------------
  document.addEventListener("input",()=>{
    const draft=[];
    document.querySelectorAll(".setRow").forEach(row=>{
      const inputs=row.querySelectorAll("input");
      draft.push({reps:inputs[0].value,weight:inputs[1].value});
    });
    saveDraft(draft);
  });

  // ------------------------------
  // SAVE WORKOUT
  // ------------------------------
  document.getElementById("saveWorkout").onclick=async()=>{
    const exercises=[];
    document.querySelectorAll(".exercise").forEach(ex=>{
      const name=ex.querySelector("h4")?.textContent;
      const sets=[];
      ex.querySelectorAll(".setRow").forEach(row=>{
        const inputs=row.querySelectorAll("input");
        sets.push({reps:+inputs[0].value||0,weight:+inputs[1].value||0});
      });
      exercises.push({n:name,s:sets});
    });

    await addDoc(userWorkoutsCollection(),{t:new Date().toISOString(),d:currentDay,e:exercises});
    clearDraft(); renderWorkout(); alert("Workout Saved 💪");
  };

  // ------------------------------
  // HISTORY
  // ------------------------------
  async function renderHistory(){
    const container=document.getElementById("historyList");
    container.innerHTML="";
    const logs=(await getLogs()).reverse();

    logs.forEach(log=>{
      const wrapper=document.createElement("div"); wrapper.className="historyWrapper";

      const deleteBtn=document.createElement("button");
      deleteBtn.className="deleteBtn"; deleteBtn.textContent="Delete";
      deleteBtn.onclick=async(e)=>{ e.stopPropagation(); await deleteLog(log.id); renderHistory(); };

      const item=document.createElement("div"); item.className="historyItem";
      item.innerHTML=`<strong>${new Date(log.t).toLocaleString()} - ${log.d}</strong>`;

      const details=document.createElement("div"); details.className="historyDetails hidden";
      log.e.forEach(ex=>{
        const exDiv=document.createElement("div");
        exDiv.innerHTML=`<strong>${ex.n}</strong>: ${ex.s.map(s=>`${s.reps}x${s.weight}`).join(", ")}`;
        details.appendChild(exDiv);
      });
      item.appendChild(details);
      item.onclick=()=>details.classList.toggle("hidden");

      wrapper.appendChild(item); wrapper.appendChild(deleteBtn);
      container.appendChild(wrapper);
    });
  }

  // ------------------------------
  // CHART
  // ------------------------------
  async function renderChart(){
    const logs=await getLogs();
    const dataPoints=[];
    logs.forEach(log=>{
      let best=0;
      log.e.forEach(ex=>ex.s.forEach(set=>{ const est=set.weight*(1+set.reps/30); if(est>best) best=est; }));
      if(best>0) dataPoints.push({x:new Date(log.t),y:Math.round(best)});
    });

    const ctx=document.getElementById("chart")?.getContext("2d");
    if(!ctx) return;
    if(chart) chart.destroy();
    chart=new Chart(ctx,{
      type:"line",
      data:{datasets:[{label:"Estimated 1RM (Best Set per Workout)",data:dataPoints,borderColor:"#7289da",tension:0.3}]}
    });
  }

  // ------------------------------
  // INITIAL RENDER
  // ------------------------------
  renderWorkout();

});
