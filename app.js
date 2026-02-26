document.addEventListener("DOMContentLoaded", () => {

  const workouts = {
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

  let currentDay = "Push A";

  const drawer = document.getElementById("drawer");

  function showPage(page){
    document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
    document.getElementById(page)?.classList.remove("hidden");
    drawer.classList.remove("open");
  }

  // Drawer open/close
  document.getElementById("hamburger").onclick = ()=>drawer.classList.add("open");
  document.getElementById("closeDrawer").onclick = ()=>drawer.classList.remove("open");

  // Page nav
  document.querySelectorAll(".navWorkout").forEach(btn=>{
    btn.onclick=()=>{
      currentDay=btn.dataset.day;
      renderWorkout();
      showPage("workoutPage");
    }
  });
  document.getElementById("navProgress").onclick=()=>{ showPage("progressPage"); };
  document.getElementById("navHistory").onclick=()=>{ renderHistory(); showPage("historyPage"); };

  // ------------------------------
  // Render workout
  // ------------------------------
  function renderWorkout(loadLast=false){
    const container=document.getElementById("exerciseContainer");
    if(!container) return;
    container.innerHTML="";

    const template=[...(workouts[currentDay]||[])];

    template.forEach(ex=>{
      const div=document.createElement("div");
      div.className="exercise";
      div.innerHTML=`<h4>${ex.name}</h4> <span>${ex.sets}x${ex.target} ${ex.superset?ex.superset:""} (${ex.rest})</span>`;

      for(let i=0;i<ex.sets;i++){
        const row=document.createElement("div");
        row.className="setRow";
        const repsInput=document.createElement("input");
        repsInput.type="number";
        repsInput.placeholder="Reps";
        const weightInput=document.createElement("input");
        weightInput.type="number";
        weightInput.placeholder="Weight";
        row.appendChild(repsInput);
        row.appendChild(weightInput);
        div.appendChild(row);
      }

      container.appendChild(div);
    });
  }

  renderWorkout();

});
