document.addEventListener("DOMContentLoaded", () => {

  const workouts = {
    "Push A": [
      { name: "Barbell Bench Press", sets: 4, target: "8–10", superset: "A1" },
      { name: "Dumbbell Lateral Raise", sets: 4, target: "12–15", superset: "A1" },
      { name: "Incline Dumbbell Press", sets: 3, target: "8–10", superset: "B1" },
      { name: "Rope Tricep Pushdowns", sets: 3, target: "10–12", superset: "B1" },
      { name: "Overhead Dumbbell Tricep Extension", sets: 3, target: "10", superset: "C1" },
      { name: "Face Pulls", sets: 3, target: "12–15", superset: "C1" }
    ],
    "Pull A": [
      { name: "Barbell Bent-Over Row", sets: 4, target: "8–10", superset: "A1" },
      { name: "Dumbbell Hammer Curl", sets: 4, target: "10", superset: "A1" },
      { name: "Lat Pulldown", sets: 3, target: "8–10", superset: "B1" },
      { name: "Barbell Curl", sets: 3, target: "10", superset: "B1" },
      { name: "Seated Cable Row", sets: 3, target: "10", superset: "C1" },
      { name: "Cable Curl", sets: 3, target: "12", superset: "C1" }
    ],
    "Legs": [
      { name: "Squat", sets: 4, target: "8–10", superset: "" },
      { name: "Leg Curl", sets: 4, target: "8–10", superset: "B1" },
      { name: "Leg Press", sets: 4, target: "8–12", superset: "B1" },
      { name: "Leg Extension", sets: 3, target: "12–15", superset: "" }
    ],
    "Push B": [
      { name: "Incline DB Press", sets: 4, target: "8–10", superset: "A1" },
      { name: "Dumbbell Lateral Raise", sets: 4, target: "12–15", superset: "A1" },
      { name: "Machine Chest Press", sets: 3, target: "10", superset: "B1" },
      { name: "Face Pulls", sets: 3, target: "12–15", superset: "B1" },
      { name: "Assisted Dips", sets: 3, target: "8–10", superset: "C1" },
      { name: "Rope Tricep Pushdowns", sets: 3, target: "12", superset: "C1" }
    ],
    "Pull B": [
      { name: "Lat Pulldown (diff grip)", sets: 4, target: "8–10", superset: "A1" },
      { name: "Barbell Curl", sets: 4, target: "8–10", superset: "A1" },
      { name: "Seated Row", sets: 3, target: "10", superset: "B1" },
      { name: "Dumbbell Hammer Curl", sets: 3, target: "10", superset: "B1" },
      { name: "Rear Delt Fly", sets: 3, target: "12–15", superset: "" }
    ]
  };

  let currentDay = "Push A";
  let chart = null;

  function getLogs() {
    return JSON.parse(localStorage.getItem("logs") || "[]");
  }

  function saveLogs(logs) {
    localStorage.setItem("logs", JSON.stringify(logs));
  }

  const drawer = document.getElementById("drawer");

  document.getElementById("hamburger")
    .addEventListener("click", () => drawer.classList.add("open"));

  document.getElementById("closeDrawer")
    .addEventListener("click", () => drawer.classList.remove("open"));

  function showPage(page){
    document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
    document.getElementById(page).classList.remove("hidden");
    drawer.classList.remove("open");
  }

  document.querySelectorAll(".navWorkout").forEach(btn => {
    btn.addEventListener("click", () => {
      currentDay = btn.dataset.day;
      renderWorkout();
      showPage("workoutPage");
    });
  });

  document.getElementById("navProgress")
    .addEventListener("click", () => {
      renderChart();
      showPage("progressPage");
    });

  document.getElementById("navHistory")
    .addEventListener("click", () => {
      renderHistory();
      showPage("historyPage");
    });

  function renderWorkout(){
    document.getElementById("pageTitle").textContent = currentDay;
    const container = document.getElementById("exerciseContainer");
    container.innerHTML = "";

    workouts[currentDay].forEach(ex=>{
      const div = document.createElement("div");
      div.className="exercise";
      div.innerHTML = `<h4>${ex.name} (${ex.sets}×${ex.target})</h4>`;

      for(let i=0;i<ex.sets;i++){
        const row = document.createElement("div");
        row.className="setRow";
        row.innerHTML = `
          <input type="number" placeholder="Reps">
          <input type="number" placeholder="Weight">
        `;
        div.appendChild(row);
      }

      container.appendChild(div);
    });
  }

  document.getElementById("saveWorkout")
    .addEventListener("click", ()=>{
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

      const logs=getLogs();
      logs.push({t:new Date().toISOString(),d:currentDay,e:exercises});
      saveLogs(logs);

      if(navigator.vibrate) navigator.vibrate(100);

      const btn = document.getElementById("saveWorkout");
      btn.textContent="Saved ✅";
      setTimeout(()=>btn.textContent="Save Workout 💪",1500);
    });

  function renderHistory(){
    const container=document.getElementById("historyList");
    container.innerHTML="";
    const logs=getLogs().slice().reverse();

    logs.forEach(log=>{
      const div=document.createElement("div");
      div.className="historyItem";
      div.innerHTML=`<strong>${new Date(log.t).toLocaleDateString()} - ${log.d}</strong>`;
      container.appendChild(div);
    });
  }

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

    if(!select.value) return;

    const labels=[],data=[];

    logs.forEach(l=>{
      const ex=l.e.find(e=>e.n===select.value);
      if(!ex) return;

      const topSet=Math.max(...ex.s.map(s=>s.weight));
      labels.push(new Date(l.t).toLocaleDateString());
      data.push(topSet);
    });

    if(chart) chart.destroy();

    chart=new Chart(document.getElementById("chart"),{
      type:"line",
      data:{
        labels,
        datasets:[{
          label:"Top Set Weight",
          data,
          borderColor:"#7289da",
          backgroundColor:"rgba(114,137,218,0.2)",
          tension:0.3,
          fill:true
        }]
      },
      options:{
        responsive:true,
        plugins:{legend:{display:false}},
        scales:{
          y:{ticks:{color:"#fff"}},
          x:{ticks:{color:"#fff"}}
        }
      }
    });
  }

  document.getElementById("exerciseSelect")
    .addEventListener("change", renderChart);

  renderWorkout();

});
