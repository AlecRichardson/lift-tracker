import { db } from "./firebase.js";
import { collection, addDoc, getDocs, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

/* =====================================================
   🔐 SIMPLE USER SYSTEM (NO AUTH)
===================================================== */
let userId = localStorage.getItem("userId");
let displayName = localStorage.getItem("displayName");
if (!userId) { userId = crypto.randomUUID(); localStorage.setItem("userId", userId); }
if (!displayName) { displayName = prompt("Enter your name:") || "Lifter"; localStorage.setItem("displayName", displayName); }

/* =====================================================
   📦 FIRESTORE HELPERS
===================================================== */
function userWorkoutsCollection() { return collection(db, "users", userId, "workouts"); }
async function getLogs() { 
  const q = query(userWorkoutsCollection(), orderBy("t"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id:d.id, ...d.data() }));
}

/* =====================================================
   🚀 WORKOUT TEMPLATES
===================================================== */
window.workouts = {
  "Push A":[
    {name:"Barbell Bench Press", sets:4, target:"8–10", superset:"A1", rest:"60–90 sec"},
    {name:"Dumbbell Lateral Raise", sets:4, target:"12–15", superset:"A1", rest:"60–90 sec"},
    {name:"Incline Dumbbell Press", sets:3, target:"8–10", superset:"B1", rest:"60–90 sec"},
    {name:"Rope Tricep Pushdowns", sets:3, target:"10–12", superset:"B1", rest:"60–90 sec"},
    {name:"Overhead Dumbbell Tricep Extension", sets:3, target:"10", superset:"C1", rest:"60–90 sec"},
    {name:"Face Pulls", sets:3, target:"12–15", superset:"C1", rest:"60–90 sec"}
  ],
  "Pull A":[
    {name:"Barbell Bent-Over Row", sets:4, target:"8–10", superset:"A1", rest:"60–90 sec"},
    {name:"Dumbbell Hammer Curl", sets:4, target:"10", superset:"A1", rest:"60–90 sec"},
    {name:"Lat Pulldown", sets:3, target:"8–10", superset:"B1", rest:"60–90 sec"},
    {name:"Barbell Curl", sets:3, target:"10", superset:"B1", rest:"60–90 sec"},
    {name:"Seated Cable Row", sets:3, target:"10", superset:"C1", rest:"60–90 sec"},
    {name:"Cable Curl", sets:"2–3", target:"12", superset:"C1", rest:"60–90 sec"}
  ],
  "Legs":[
    {name:"Squat", sets:4, target:"8–10", superset:"", rest:"90 sec"},
    {name:"Leg Curl", sets:4, target:"8–10", superset:"B1", rest:"60–90 sec"},
    {name:"Leg Press", sets:4, target:"8–12", superset:"B1", rest:"60–90 sec"},
    {name:"Leg Extension", sets:"2–3", target:"12–15", superset:"", rest:"60–90 sec"}
  ],
  "Push B":[
    {name:"Incline DB Press", sets:4, target:"8–10", superset:"A1", rest:"60–90 sec"},
    {name:"Dumbbell Lateral Raise", sets:4, target:"12–15", superset:"A1", rest:"60–90 sec"},
    {name:"Machine Chest Press", sets:3, target:"10", superset:"B1", rest:"60–90 sec"},
    {name:"Face Pulls", sets:3, target:"12–15", superset:"B1", rest:"60–90 sec"},
    {name:"Assisted Dips", sets:3, target:"8–10", superset:"C1", rest:"60–90 sec"},
    {name:"Rope Tricep Pushdowns", sets:"2–3", target:"12", superset:"C1", rest:"60–90 sec"}
  ],
  "Pull B":[
    {name:"Lat Pulldown (diff grip)", sets:4, target:"8–10", superset:"A1", rest:"60–90 sec"},
    {name:"Barbell Curl", sets:4, target:"8–10", superset:"A1", rest:"60–90 sec"},
    {name:"Seated Row", sets:3, target:"10", superset:"B1", rest:"60–90 sec"},
    {name:"Dumbbell Hammer Curl", sets:3, target:"10", superset:"B1", rest:"60–90 sec"},
    {name:"Rear Delt Fly", sets:3, target:"12–15", superset:"", rest:"60–90 sec"}
  ]
};

/* =====================================================
   🚀 APP LOGIC
===================================================== */
document.addEventListener("DOMContentLoaded", () => {
  let currentDay="Push A", chart=null;

  /* ------------------------------
     DRAFT STORAGE
  ------------------------------ */
  function saveDraft(data){localStorage.setItem("draftWorkout",JSON.stringify(data));}
  function getDraft(){return JSON.parse(localStorage.getItem("draftWorkout")||"[]");}
  function clearDraft(){localStorage.removeItem("draftWorkout");}

  /* ------------------------------
     RENDER WORKOUT
  ------------------------------ */
  async function renderWorkout(){
    const container=document.getElementById("exerciseContainer");
    if(!container) return;
    container.innerHTML="";
    document.getElementById("pageTitle").textContent=currentDay;

    const template=[...window.workouts[currentDay]];
    template.forEach(ex=>{
      const div=document.createElement("div");
      div.className="exercise";
      div.innerHTML=`<h4>${ex.name} (${ex.sets}x${ex.target})</h4>`;
      let sets=parseInt(ex.sets)||3;
      for(let i=0;i<sets;i++){
        const row=document.createElement("div");
        row.className="setRow";
        const reps=document.createElement("input");
        reps.type="number";
        reps.placeholder="Reps";
        const weight=document.createElement("input");
        weight.type="number";
        weight.placeholder="Weight";
        row.appendChild(reps);
        row.appendChild(weight);
        div.appendChild(row);
      }
      container.appendChild(div);
    });

    // Prefill last workout
    const logs=(await getLogs()).filter(l=>l.d===currentDay);
    if(logs.length>0){
      const last=logs[logs.length-1];
      last.e.forEach(ex=>{
        const div=[...container.children].find(d=>d.querySelector("h4")?.textContent.startsWith(ex.n));
        if(!div) return;
        ex.s.forEach((set,i)=>{
          const row=div.querySelectorAll(".setRow")[i];
          if(!row) return;
          const inputs=row.querySelectorAll("input");
          inputs[0].value=set.reps||0;
          inputs[1].value=set.weight||0;
        });
      });
    }
  }

  /* ------------------------------
     AUTO SAVE DRAFT
  ------------------------------ */
  document.addEventListener("input",()=>{
    const draft=[];
    document.querySelectorAll(".setRow").forEach(row=>{
      const inputs=row.querySelectorAll("input");
      draft.push({reps:inputs[0].value||0,weight:inputs[1].value||0});
    });
    saveDraft(draft);
  });

  /* ------------------------------
     SAVE WORKOUT
  ------------------------------ */
  document.getElementById("saveWorkout")?.addEventListener("click",async ()=>{
    const exercises=[];
    document.querySelectorAll(".exercise").forEach(ex=>{
      const name=ex.querySelector("h4")?.textContent.split(" (")[0];
      if(!name) return;
      const sets=[];
      ex.querySelectorAll(".setRow").forEach(row=>{
        const inputs=row.querySelectorAll("input");
        sets.push({reps:+inputs[0].value||0,weight:+inputs[1].value||0});
      });
      exercises.push({n:name,s:sets});
    });
    await addDoc(userWorkoutsCollection(),{t:new Date().toISOString(),d:currentDay,e:exercises});
    clearDraft();
    renderWorkout();
    const anim=document.getElementById("saveAnimation");
    anim.classList.remove("hidden");
    setTimeout(()=>anim.classList.add("hidden"),1500);
  });

  /* ------------------------------
     HISTORY
  ------------------------------ */
  async function renderHistory(){
    const container=document.getElementById("historyList");
    if(!container) return;
    container.innerHTML="";
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
      item.innerHTML=`<strong>${formatTimestamp(log.t)} - ${log.d}</strong>`;

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
      container.appendChild(wrapper);

      // Swipe logic
      let startX=0,currentX=0,isSwiping=false;
      item.addEventListener("touchstart",e=>{startX=e.touches[0].clientX;isSwiping=false;});
      item.addEventListener("touchmove",e=>{
        const diff=e.touches[0].clientX-startX;
        if(diff<0){isSwiping=true;if(openItem&&openItem!==item) openItem.style.transform="translateX(0)";currentX=Math.max(diff,-80);item.style.transform=`translateX(${currentX}px)`;openItem=item;}
        if(diff>0&&openItem===item){isSwiping=true;currentX=Math.min(diff-80,0);item.style.transform=`translateX(${currentX}px)`;}
      });
      item.addEventListener("touchend",()=>{
        if(isSwiping){if(currentX<-40){item.style.transform="translateX(-80px)";openItem=item;}else{item.style.transform="translateX(0)";openItem=null;}} else{details.classList.toggle("hidden");}
      });
    });
  }

  /* ------------------------------
     PROGRESS CHART
  ------------------------------ */
  async function renderChart(){
    const logs=await getLogs();
    const select=document.getElementById("exerciseSelect");
    select.innerHTML="";
    const exercisesSet=new Set();
    logs.forEach
