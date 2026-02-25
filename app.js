document.addEventListener("DOMContentLoaded", () => {

  const workouts = { /* SAME WORKOUT OBJECT AS BEFORE */ 
    "Push A":[
      {name:"Barbell Bench Press",sets:4,target:"8–10"},
      {name:"Dumbbell Lateral Raise",sets:4,target:"12–15"},
      {name:"Incline Dumbbell Press",sets:3,target:"8–10"},
      {name:"Rope Tricep Pushdowns",sets:3,target:"10–12"},
      {name:"Overhead Dumbbell Tricep Extension",sets:3,target:"10"},
      {name:"Face Pulls",sets:3,target:"12–15"}
    ],
    "Pull A":[
      {name:"Barbell Bent-Over Row",sets:4,target:"8–10"},
      {name:"Dumbbell Hammer Curl",sets:4,target:"10"},
      {name:"Lat Pulldown",sets:3,target:"8–10"},
      {name:"Barbell Curl",sets:3,target:"10"},
      {name:"Seated Cable Row",sets:3,target:"10"},
      {name:"Cable Curl",sets:3,target:"12"}
    ],
    "Legs":[
      {name:"Squat",sets:4,target:"8–10"},
      {name:"Leg Curl",sets:4,target:"8–10"},
      {name:"Leg Press",sets:4,target:"8–12"},
      {name:"Leg Extension",sets:3,target:"12–15"}
    ],
    "Push B":[
      {name:"Incline DB Press",sets:4,target:"8–10"},
      {name:"Dumbbell Lateral Raise",sets:4,target:"12–15"},
      {name:"Machine Chest Press",sets:3,target:"10"},
      {name:"Face Pulls",sets:3,target:"12–15"},
      {name:"Assisted Dips",sets:3,target:"8–10"},
      {name:"Rope Tricep Pushdowns",sets:3,target:"12"}
    ],
    "Pull B":[
      {name:"Lat Pulldown (diff grip)",sets:4,target:"8–10"},
      {name:"Barbell Curl",sets:4,target:"8–10"},
      {name:"Seated Row",sets:3,target:"10"},
      {name:"Dumbbell Hammer Curl",sets:3,target:"10"},
      {name:"Rear Delt Fly",sets:3,target:"12–15"}
    ]
  };

  let currentDay="Push A";
  let chart=null;

  function getLogs(){return JSON.parse(localStorage.getItem("logs")||"[]");}
  function saveLogs(logs){localStorage.setItem("logs",JSON.stringify(logs));}

  function formatTimestamp(iso){
    const date=new Date(iso);
    return date.toLocaleString(undefined,{
      month:"long",
      day:"numeric",
      weekday:"long",
      hour:"numeric",
      minute:"2-digit"
    });
  }
  document.querySelectorAll(".navWorkout").forEach(btn=>{
  btn.addEventListener("click",()=>{
    currentDay = btn.dataset.day;
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
const drawer = document.getElementById("drawer");

document.getElementById("hamburger")
  .addEventListener("click", () => {
    drawer.classList.add("open");
  });

document.getElementById("closeDrawer")
  .addEventListener("click", () => {
    drawer.classList.remove("open");
  });

function showPage(page){
  document.querySelectorAll(".page")
    .forEach(p => p.classList.add("hidden"));

  document.getElementById(page)
    .classList.remove("hidden");

  drawer.classList.remove("open");
}
  function saveDraft(){
    const draft=[];
    document.querySelectorAll(".exercise").forEach(ex=>{
      const name=ex.querySelector("h4").textContent.split(" (")[0];
      const sets=[];
      ex.querySelectorAll(".setRow").forEach(row=>{
        const inputs=row.querySelectorAll("input");
        sets.push({reps:inputs[0].value,weight:inputs[1].value});
      });
      draft.push({n:name,s:sets});
    });
    localStorage.setItem("draft_"+currentDay,JSON.stringify(draft));
  }

  function loadDraft(){
    return JSON.parse(localStorage.getItem("draft_"+currentDay)||"null");
  }

  function clearDraft(){
    localStorage.removeItem("draft_"+currentDay);
  }

  function renderWorkout(){
    document.getElementById("pageTitle").textContent=currentDay;
    const container=document.getElementById("exerciseContainer");
    container.innerHTML="";

    const last=getLogs().filter(l=>l.d===currentDay).pop();
    const draft=loadDraft();

    workouts[currentDay].forEach(ex=>{
      const div=document.createElement("div");
      div.className="exercise";
      div.innerHTML=`<h4>${ex.name} (${ex.sets}×${ex.target})</h4>`;

      let source=null;
      if(draft) source=draft.find(e=>e.n===ex.name);
      else if(last) source=last.e.find(e=>e.n===ex.name);

      for(let i=0;i<ex.sets;i++){
        const repsVal=source?.s[i]?.reps||"";
        const weightVal=source?.s[i]?.weight||"";
        const row=document.createElement("div");
        row.className="setRow";
        row.innerHTML=`
          <input type="number" placeholder="Reps" value="${repsVal}">
          <input type="number" placeholder="Weight" value="${weightVal}">
        `;
        row.querySelectorAll("input").forEach(inp=>{
          inp.addEventListener("input",saveDraft);
        });
        div.appendChild(row);
      }

      container.appendChild(div);
    });
  }

  document.getElementById("saveWorkout").addEventListener("click",()=>{
    const exercises=[];
    document.querySelectorAll(".exercise").forEach(ex=>{
      const name=ex.querySelector("h4").textContent.split(" (")[0];
      const sets=[];
      ex.querySelectorAll(".setRow").forEach(row=>{
        const inputs=row.querySelectorAll("input");
        sets.push({reps:+inputs[0].value||0,weight:+inputs[1].value||0});
      });
      exercises.push({n:name,s:sets});
    });

    const logs=getLogs();
    logs.push({t:new Date().toISOString(),d:currentDay,e:exercises});
    saveLogs(logs);
    clearDraft();
    renderWorkout();

    const btn=document.getElementById("saveWorkout");
    btn.textContent="Saved ✅";
    setTimeout(()=>btn.textContent="Save Workout 💪",1500);
  });

  function renderHistory(){
  const container=document.getElementById("historyList");
  container.innerHTML="";
  const logs=getLogs().slice().reverse();

  let openItem = null; // track currently swiped open item

  logs.forEach((log,index)=>{
    const wrapper=document.createElement("div");
    wrapper.className="historyWrapper";

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

    // Create inline delete button (hidden initially)
    const deleteBtn=document.createElement("button");
    deleteBtn.textContent="Delete";
    deleteBtn.className="deleteBtn";
    deleteBtn.style.display="none";

    deleteBtn.addEventListener("click",(e)=>{
      e.stopPropagation();
      const all=getLogs();
      all.splice(all.length-1-index,1);
      saveLogs(all);
      renderHistory();
    });

    wrapper.appendChild(item);
    wrapper.appendChild(deleteBtn);
    container.appendChild(wrapper);

    let startX=0;
    let moved=false;

    item.addEventListener("touchstart",e=>{
      startX=e.touches[0].clientX;
      moved=false;
    });

    item.addEventListener("touchmove",e=>{
      const diff=e.touches[0].clientX-startX;

      if(diff<-50){ // swipe left
        moved=true;

        // close any open item first
        if(openItem && openItem!==item){
          openItem.style.transform="translateX(0)";
          openItem.nextSibling.style.display="none";
        }

        item.style.transform="translateX(-80px)";
        deleteBtn.style.display="inline-block";
        openItem=item;
      }

      if(diff>50){ // swipe right
        moved=true;
        item.style.transform="translateX(0)";
        deleteBtn.style.display="none";
        openItem=null;
      }
    });

    item.addEventListener("touchend",()=>{
      if(!moved){
        // treat as normal tap
        details.classList.toggle("hidden");
      }
    });
  });
}

  function renderChart(){
    const logs=getLogs();
    const select=document.getElementById("exerciseSelect");
    select.innerHTML="";

    const set=new Set();
    logs.forEach(l=>l.e.forEach(e=>set.add(e.n)));
    set.forEach(name=>{
      const opt=document.createElement("option");
      opt.value=name;
      opt.textContent=name;
      select.appendChild(opt);
    });

    if(!select.value) return;

    const labels=[],data=[];
    logs.forEach(l=>{
      const ex=l.e.find(e=>e.n===select.value);
      if(!ex) return;
      const top=Math.max(...ex.s.map(s=>s.weight));
      labels.push(new Date(l.t).toLocaleDateString());
      data.push(top);
    });

    document.getElementById("chartInfo").textContent=
      "This chart displays your top set weight for the selected exercise in each workout. " +
      "We calculate this by taking the heaviest weight lifted in that session.";

    if(chart) chart.destroy();
    chart=new Chart(document.getElementById("chart"),{
      type:"line",
      data:{labels,datasets:[{data,borderColor:"#7289da",tension:0.3,fill:true}]},
      options:{plugins:{legend:{display:false}}}
    });
  }

  document.querySelectorAll(".navWorkout").forEach(btn=>{
    btn.addEventListener("click",()=>{
      currentDay=btn.dataset.day;
      renderWorkout();
    });
  });

  document.getElementById("navHistory").addEventListener("click",renderHistory);
  document.getElementById("navProgress").addEventListener("click",renderChart);
  document.getElementById("exerciseSelect").addEventListener("change",renderChart);

  renderWorkout();
});
