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

let currentDay = "Push";
let chart;

/* ================================
   🔹 DRAFT STORAGE (localStorage)
================================ */

function saveDraft(data){
  localStorage.setItem("draftWorkout", JSON.stringify(data));
}

function getDraft(){
  return JSON.parse(localStorage.getItem("draftWorkout")) || null;
}

function clearDraft(){
  localStorage.removeItem("draftWorkout");
}

/* ================================
   🔹 FIRESTORE
================================ */

async function getLogs(){
  const q = query(collection(db, "workouts"), orderBy("t"));
  const snapshot = await getDocs(q);

  return snapshot.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}

/* ================================
   🔹 SAVE WORKOUT
================================ */

document.getElementById("saveWorkout").addEventListener("click", async ()=>{

  const exercises=[];

  document.querySelectorAll(".exercise").forEach(ex=>{
    const name=ex.querySelector("h4").textContent;
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

  await addDoc(collection(db,"workouts"),{
    t:new Date().toISOString(),
    d:currentDay,
    e:exercises
  });

  clearDraft();
  renderWorkout();
  alert("Workout Saved 💪");
});

/* ================================
   🔹 RENDER WORKOUT
================================ */

function renderWorkout(){
  const container=document.getElementById("workoutContainer");
  container.innerHTML="";

  const draft=getDraft();
  const template=window.templates[currentDay];

  template.forEach((exerciseName, exIndex)=>{

    const exDiv=document.createElement("div");
    exDiv.className="exercise";

    exDiv.innerHTML=`<h4>${exerciseName}</h4>`;

    for(let i=0;i<3;i++){

      const row=document.createElement("div");
      row.className="setRow";

      const reps=document.createElement("input");
      reps.type="number";
      reps.placeholder="Reps";

      const weight=document.createElement("input");
      weight.type="number";
      weight.placeholder="Weight";

      if(draft && draft[exIndex*3+i]){
        reps.value=draft[exIndex*3+i].reps || "";
        weight.value=draft[exIndex*3+i].weight || "";
      }

      row.appendChild(reps);
      row.appendChild(weight);
      exDiv.appendChild(row);
    }

    container.appendChild(exDiv);
  });
}

/* ================================
   🔹 AUTO SAVE DRAFT
================================ */

document.addEventListener("input", ()=>{
  const draft=[];

  document.querySelectorAll(".setRow").forEach(row=>{
    const inputs=row.querySelectorAll("input");
    draft.push({
      reps:inputs[0].value,
      weight:inputs[1].value
    });
  });

  saveDraft(draft);
});

/* ================================
   🔹 HISTORY (Swipe + Expand)
================================ */

async function renderHistory(){
  const container=document.getElementById("historyList");
  container.innerHTML="";

  const logs=(await getLogs()).reverse();

  let openItem=null;

  logs.forEach(log=>{

    const wrapper=document.createElement("div");
    wrapper.className="historyWrapper";

    const deleteBtn=document.createElement("button");
    deleteBtn.className="deleteBtn";
    deleteBtn.textContent="Delete";

    deleteBtn.addEventListener("click", async (e)=>{
      e.stopPropagation();
      await deleteDoc(doc(db,"workouts",log.id));
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

    let startX=0;
    let currentX=0;
    let isSwiping=false;

    item.addEventListener("touchstart",e=>{
      startX=e.touches[0].clientX;
      isSwiping=false;
    });

    item.addEventListener("touchmove",e=>{
      const diff=e.touches[0].clientX-startX;

      if(diff<0){
        isSwiping=true;

        if(openItem && openItem!==item){
          openItem.style.transform="translateX(0)";
        }

        currentX=Math.max(diff,-90);
        item.style.transform=`translateX(${currentX}px)`;
        openItem=item;
      }

      if(diff>0 && openItem===item){
        isSwiping=true;
        currentX=Math.min(diff-90,0);
        item.style.transform=`translateX(${currentX}px)`;
      }
    });

    item.addEventListener("touchend",()=>{
      if(isSwiping){
        if(currentX<-45){
          item.style.transform="translateX(-90px)";
          openItem=item;
        } else {
          item.style.transform="translateX(0)";
          openItem=null;
        }
      } else {
        details.classList.toggle("hidden");
      }
    });
  });
}

/* ================================
   🔹 PROGRESS CHART (Best 1RM per workout)
================================ */

async function renderChart(){
  const logs=await getLogs();

  const dataPoints=[];

  logs.forEach(log=>{
    let best=0;

    log.e.forEach(ex=>{
      ex.s.forEach(set=>{
        const est1RM=set.weight*(1+set.reps/30);
        if(est1RM>best) best=est1RM;
      });
    });

    if(best>0){
      dataPoints.push({
        x:new Date(log.t),
        y:Math.round(best)
      });
    }
  });

  if(chart) chart.destroy();

  const ctx=document.getElementById("progressChart").getContext("2d");

  chart=new Chart(ctx,{
    type:"line",
    data:{
      datasets:[{
        label:"Estimated 1RM (Best Set per Workout)",
        data:dataPoints,
        borderWidth:2,
        tension:0.3
      }]
    },
    options:{
      scales:{
        x:{ type:"time", time:{ unit:"day" } }
      }
    }
  });
}

/* ================================
   🔹 FORMAT DATE
================================ */

function formatTimestamp(ts){
  const date=new Date(ts);
  return date.toLocaleString("en-US",{
    month:"long",
    day:"numeric",
    weekday:"long",
    hour:"numeric",
    minute:"2-digit"
  });
}

/* ================================
   🔹 DRAWER NAVIGATION
================================ */

const drawer=document.getElementById("drawer");

document.getElementById("hamburger")
  .addEventListener("click",()=>drawer.classList.add("open"));

document.getElementById("closeDrawer")
  .addEventListener("click",()=>drawer.classList.remove("open"));

function showPage(page){
  document.querySelectorAll(".page")
    .forEach(p=>p.classList.add("hidden"));

  document.getElementById(page)
    .classList.remove("hidden");

  drawer.classList.remove("open");
}

document.querySelectorAll(".navWorkout").forEach(btn=>{
  btn.addEventListener("click",()=>{
    currentDay=btn.dataset.day;
    renderWorkout();
    showPage("workoutPage");
  });
});

document.getElementById("navHistory")
  .addEventListener("click",()=>{
    renderHistory();
    showPage("historyPage");
  });

document.getElementById("navProgress")
  .addEventListener("click",()=>{
    renderChart();
    showPage("progressPage");
  });

/* ================================
   🔹 INIT
================================ */

renderWorkout();
