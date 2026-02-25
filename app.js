document.addEventListener("DOMContentLoaded", () => {

  // ------------------------------
  // 1️⃣ WORKOUT TEMPLATES (with sets × reps + superset + rest)
  // ------------------------------
  const workouts = {
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
      { name: "Cable Curl", sets: "2–3", target: "12", superset: "C1", rest: "60–90 sec" }
    ],
    "Legs": [
      { name: "Squat", sets: 4, target: "8–10", superset: "", rest: "90 sec" },
      { name: "Leg Curl", sets: 4, target: "8–10", superset: "B1", rest: "60–90 sec" },
      { name: "Leg Press", sets: 4, target: "8–12", superset: "B1", rest: "60–90 sec" },
      { name: "Leg Extension", sets: "2–3", target: "12–15", superset: "", rest: "60–90 sec" }
    ],
    "Push B": [
      { name: "Incline DB Press", sets: 4, target: "8–10", superset: "A1", rest: "60–90 sec" },
      { name: "Dumbbell Lateral Raise", sets: 4, target: "12–15", superset: "A1", rest: "60–90 sec" },
      { name: "Machine Chest Press", sets: 3, target: "10", superset: "B1", rest: "60–90 sec" },
      { name: "Face Pulls", sets: 3, target: "12–15", superset: "B1", rest: "60–90 sec" },
      { name: "Assisted Dips", sets: 3, target: "8–10", superset: "C1", rest: "60–90 sec" },
      { name: "Rope Tricep Pushdowns", sets: "2–3", target: "12", superset: "C1", rest: "60–90 sec" }
    ],
    "Pull B": [
      { name: "Lat Pulldown (diff grip)", sets: 4, target: "8–10", superset: "A1", rest: "60–90 sec" },
      { name: "Barbell Curl", sets: 4, target: "8–10", superset: "A1", rest: "60–90 sec" },
      { name: "Seated Row", sets: 3, target: "10", superset: "B1", rest: "60–90 sec" },
      { name: "Dumbbell Hammer Curl", sets: 3, target: "10", superset: "B1", rest: "60–90 sec" },
      { name: "Rear Delt Fly", sets: 3, target: "12–15", superset: "", rest: "60–90 sec" }
    ]
  };

  let currentDay = "Push A";
  let chart = null;

  // ------------------------------
  // LocalStorage Helpers
  // ------------------------------
  function getLogs() { 
    try { return JSON.parse(localStorage.getItem("logs") || "[]"); } 
    catch { localStorage.setItem("logs","[]"); return []; }
  }
  function saveLogs(logs) { localStorage.setItem("logs", JSON.stringify(logs)); }

  // ------------------------------
  // Drawer
  // ------------------------------
  const drawer = document.getElementById("drawer");
  document.getElementById("hamburger").onclick = () => drawer.classList.add("open");
  document.getElementById("closeDrawer").onclick = () => drawer.classList.remove("open");

  // ------------------------------
  // Page Nav
  // ------------------------------
  function showPage(page){
    document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
    document.getElementById(page).classList.remove("hidden");
    drawer.classList.remove("open");
  }

  document.querySelectorAll(".navWorkout").forEach(btn => {
    btn.onclick = () => { currentDay = btn.dataset.day; renderWorkout(); showPage("workoutPage"); };
  });
  document.getElementById("navProgress").onclick = () => { renderChart(); showPage("progressPage"); };
  document.getElementById("navHistory").onclick = () => { renderHistory(); showPage("historyPage"); };

  // ------------------------------
  // Render Workout
  // ------------------------------
  function renderWorkout(loadLast=false){
    document.getElementById("pageTitle").textContent = currentDay;
    const container = document.getElementById("exerciseContainer");
    container.innerHTML = "";

    const template = [...(workouts[currentDay]||[])];

    // Load last workout auto-fill
    if(loadLast){
      const logs = getLogs().filter(l=>l.d===currentDay);
      if(logs.length>0){
        const last = logs[logs.length-1];
        template.forEach(ex=>{
          const match = last.e.find(le=>le.n===ex.name);
          if(match) ex.lastSets = match.s;
        });
      }
    }

    // Group by Supersets
    let currentSuperset = "";
    template.forEach(ex=>{
      if(ex.superset !== currentSuperset){
        if(ex.superset) {
          const supDiv = document.createElement("div");
          supDiv.className = "exercise";
          supDiv.innerHTML = `<h4>Superset ${ex.superset}</h4>`;
          container.appendChild(supDiv);
        }
        currentSuperset = ex.superset;
      }

      const div = document.createElement("div");
      div.className="exercise";
      div.innerHTML = `<h4>${ex.name} (${ex.sets}×${ex.target})</h4>`;
      for(let i=0;i<ex.sets;i++){
        const row = document.createElement("div");
        row.className="setRow";
        const lastReps = ex.lastSets ? ex.lastSets[i]?.reps || "" : "";
        const lastWeight = ex.lastSets ? ex.lastSets[i]?.weight || "" : "";
        row.innerHTML = `<input type="text" inputmode="numeric" pattern="[0-9]*" placeholder="Reps" value="${lastReps}"><input type="text" inputmode="decimal" pattern="[0-9]*" placeholder="Weight" value="${lastWeight}">`;
        div.appendChild(row);
      }
      container.appendChild(div);
    });
  }

  // ------------------------------
  // Save Workout
  // ------------------------------
  document.getElementById("saveWorkout").onclick = ()=>{
    const exercises=[];
    document.querySelectorAll(".exercise").forEach(ex=>{
      const name = ex.querySelector("h4")?.textContent.split(" (")[0];
      if(!name || name.startsWith("Superset")) return;
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
    alert("Workout Saved 💪");
  };

  // ------------------------------
  // History
  // ------------------------------
  function renderHistory(){
    const container=document.getElementById("historyList");
    container.innerHTML="";
    const logs=getLogs().slice().reverse();
    logs.forEach(log=>{
      const div=document.createElement("div");
      div.className="historyItem";
      div.innerHTML=`<strong>${new Date(log.t).toLocaleDateString()} - ${log.d}</strong>`;
      const details=document.createElement("div");
      details.className="historyDetails hidden";
      log.e.forEach(ex=>{
        const exDiv=document.createElement("div");
        exDiv.innerHTML=`<strong>${ex.n}</strong>: ${ex.s.map(s=>`${s.reps}x${s.weight}`).join(", ")}`;
        details.appendChild(exDiv);
      });
      div.appendChild(details);
      div.onclick=()=>details.classList.toggle("hidden");
      container.appendChild(div);
    });
  }

  // ------------------------------
  // Chart
  // ------------------------------
  function renderChart(){
    const logs=getLogs();
    const select=document.getElementById("exerciseSelect");
    select.innerHTML="";
    const exercisesSet=new Set();
    logs.forEach(l=>l.e.forEach(e=>exercisesSet.add(e.n)));
    exercisesSet.forEach(name=>{
      const opt=document.createElement("option");
      opt.value=name;
      opt.textContent=name;
      select.appendChild(opt);
    });
    if(!select.value && select.options.length>0) select.value=select.options[0].value;
    if(!select.value) return;

    const labels=[],data=[];
    logs.forEach(l=>{
      const ex=l.e.find(e=>e.n===select.value);
      if(!ex) return;
      const avg=ex.s.reduce((a,b)=>a+b.weight,0)/ex.s.length;
      labels.push(new Date(l.t).toLocaleDateString());
      data.push(avg);
    });

    if(chart) chart.destroy();
    chart=new Chart(document.getElementById("chart"),{
      type:"line",
      data:{labels,datasets:[{label:select.value,data,borderColor:"#7289da",tension:0.3}]},
      options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{ticks:{color:"#fff"}},x:{ticks:{color:"#fff"}}}}
    });
  }
  document.getElementById("exerciseSelect").onchange=renderChart;

  // ------------------------------
  // Load Last Workout
  // ------------------------------
  const loadLastBtn=document.createElement("button");
  loadLastBtn.textContent="Load Last Workout";
  loadLastBtn.className="primaryBtn";
  loadLastBtn.onclick=()=>renderWorkout(true);
  document.getElementById("workoutPage").prepend(loadLastBtn);

  // ------------------------------
  // Initial Render
  // ------------------------------
  renderWorkout();

});
