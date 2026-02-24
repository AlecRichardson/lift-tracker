// ----------- Workout Data -----------
const workouts={
"Push A":[
{name:"Barbell Bench Press",sets:4,repRange:"8–10"},
{name:"Dumbbell Lateral Raise",sets:4,repRange:"12–15"},
{name:"Incline Dumbbell Press",sets:3,repRange:"8–10"},
{name:"Rope Tricep Pushdowns",sets:3,repRange:"10–12"},
{name:"Overhead DB Tricep Extension",sets:3,repRange:"10"},
{name:"Face Pulls",sets:3,repRange:"12–15"}],
"Push B":[
{name:"Incline DB Press",sets:4,repRange:"8–10"},
{name:"Dumbbell Lateral Raise",sets:4,repRange:"12–15"},
{name:"Machine Chest Press",sets:3,repRange:"10"},
{name:"Face Pulls",sets:3,repRange:"12–15"},
{name:"Assisted Dips",sets:3,repRange:"8–10"},
{name:"Rope Tricep Pushdowns",sets:2,repRange:"12"}],
"Pull A":[
{name:"Barbell Bent-Over Row",sets:4,repRange:"8–10"},
{name:"Dumbbell Hammer Curl",sets:4,repRange:"10"},
{name:"Lat Pulldown",sets:3,repRange:"8–10"},
{name:"Barbell Curl",sets:3,repRange:"10"},
{name:"Seated Cable Row",sets:3,repRange:"10"},
{name:"Cable Curl",sets:2,repRange:"12"}],
"Pull B":[
{name:"Lat Pulldown (diff grip)",sets:4,repRange:"8–10"},
{name:"Barbell Curl",sets:4,repRange:"8–10"},
{name:"Seated Row",sets:3,repRange:"10"},
{name:"Dumbbell Hammer Curl",sets:3,repRange:"10"},
{name:"Rear Delt Fly",sets:3,repRange:"12–15"}],
"Legs":[
{name:"Squat",sets:4,repRange:"8–10"},
{name:"Leg Curl",sets:4,repRange:"8–10"},
{name:"Leg Press",sets:4,repRange:"8–12"},
{name:"Leg Extension",sets:2,repRange:"12–15"}]
};

let currentWorkout="Push A";
let chart=null;

// ----------- Drawer -----------
const drawer=document.getElementById("hamburger-menu");
document.querySelector(".hamburger-btn").addEventListener("click",()=>drawer.classList.toggle("open"));
document.querySelector(".close-btn").addEventListener("click",()=>drawer.classList.remove("open"));
document.getElementById("drawer-workout").addEventListener("click",()=>{showPage("workout"); drawer.classList.remove("open");});
document.getElementById("drawer-progress").addEventListener("click",()=>{showPage("progress"); drawer.classList.remove("open");});
document.getElementById("drawer-history").addEventListener("click",()=>{showPage("history"); drawer.classList.remove("open");});

// ----------- Page Switch -----------
function showPage(page){
  document.querySelectorAll(".page").forEach(p=>p.style.display="none");
  document.getElementById("page-"+page).style.display="block";
}

// ----------- Workout Page -----------
function switchWorkout(name){currentWorkout=name;renderWorkout();prefillLastWorkout();}
function renderWorkout(){
  const container=document.getElementById("exercise-container");
  container.innerHTML="";
  workouts[currentWorkout].forEach((ex,i)=>{
    const row=document.createElement("div");
    row.className="exercise-row";
    row.innerHTML=`<label>${ex.name} (${ex.sets}x${ex.repRange})</label>
      <div class="set-container"></div>
      ${ex.custom?'<button class="remove-btn">Remove</button>':''}`;
    const setContainer=row.querySelector(".set-container");
    for(let s=0;s<ex.sets;s++){
      const setRow=document.createElement("div");
      setRow.className="set-row";
      setRow.innerHTML=`<span>Set ${s+1}:</span>
        <input type="number" placeholder="Reps" min="0">
        <input type="number" placeholder="Weight" min="0">
        <input type="checkbox">`;
      setContainer.appendChild(setRow);
    }
    if(ex.custom) row.querySelector(".remove-btn").addEventListener("click",()=>{
      workouts[currentWorkout].splice(i,1);
      renderWorkout();
    });
    container.appendChild(row);
  });
}

document.getElementById("add-exercise").addEventListener("click",()=>{
  const name=prompt("Exercise name:");
  if(!name) return;
  const sets=Number(prompt("Number of sets:"))||1;
  const repRange=prompt("Rep range:")||"";
  workouts[currentWorkout].push({name:name,sets:sets,repRange:repRange,custom:true});
  renderWorkout();
});
document.getElementById("reset-workout").addEventListener("click",()=>document.querySelectorAll("#exercise-container input").forEach(input=>{input.value=""; if(input.type==="checkbox") input.checked=false;}));
document.getElementById("save-workout").addEventListener("click",saveWorkout);

function saveWorkout(){
  const rows=document.querySelectorAll("#exercise-container .exercise-row");
  const exercises=[];
  rows.forEach(row=>{
    const exName=row.querySelector("label").innerText.split(" (")[0];
    const sets=[];
    row.querySelectorAll(".set-row").forEach(setRow=>{
      const inputs=setRow.querySelectorAll("input");
      sets.push({r:Number(inputs[0].value)||0,w:Number(inputs[1].value)||0,c:inputs[2].checked});
    });
    exercises.push({n:exName,s:sets});
  });
  const log={t:new Date().toISOString(),w:currentWorkout,e:exercises};
  let logs=JSON.parse(localStorage.getItem("workoutLogs")||"[]");
  logs.push(log);
  localStorage.setItem("workoutLogs",JSON.stringify(logs));
  alert("Workout saved!");
  renderHistory();
  updateChart();
}

function prefillLastWorkout(){
  const logs=JSON.parse(localStorage.getItem("workoutLogs")||"[]").reverse();
  const last=logs.find(l=>l.w===currentWorkout);
  if(!last) return;
  const rows=document.querySelectorAll("#exercise-container .exercise-row");
  rows.forEach((row,i)=>{
    const setContainer=row.querySelector(".set-container");
    last.e[i].s.forEach((s,j)=>{
      const inputs=setContainer.querySelectorAll(".set-row")[j].querySelectorAll("input");
      inputs[0].value=s.r;
      inputs[1].value=s.w;
      inputs[2].checked=s.c;
    });
  });
}

// ----------- History Page -----------
function renderHistory(){
  const container=document.getElementById("history-container");
  container.innerHTML="";
  const logs=JSON.parse(localStorage.getItem("workoutLogs")||"[]").reverse();
  logs.forEach((log,i)=>{
    const div=document.createElement("div");
    div.className="history-item";
    div.innerHTML=`<span><strong>${log.w}</strong> - ${new Date(log.t).toLocaleString()}</span>
      <button onclick="removeHistory(${i})">Remove</button>`;
    container.appendChild(div);
  });
}

function removeHistory(index){
  let logs=JSON.parse(localStorage.getItem("workoutLogs")||"[]");
  logs.splice(logs.length-1-index,1);
  localStorage.setItem("workoutLogs",JSON.stringify(logs));
  renderHistory();
  updateChart();
}

// ----------- Progress Page -----------
function updateChart(){
  const filter=document.getElementById("exercise-filter").value;
  const logs=JSON.parse(localStorage.getItem("workoutLogs")||"[]");
  const labels=logs.map(l=>new Date(l.t).toLocaleDateString());
  let datasets=[];
  if(filter==="all"){
    const allEx=new Set();
    logs.forEach(l=>l.e.forEach(ex=>allEx.add(ex.n)));
    datasets=Array.from(allEx).map(name=>{
      const data=logs.map(l=>{
        const ex=l.e.find(e=>e.n===name);
        if(!ex) return null;
        return Math.max(...ex.s.map(s=>s.w));
      });
      return {label:name,data:data,borderColor:getRandomColor(),fill:false};
    });
  }else{
    const data=logs.map(l=>{
      const ex=l.e.find(e=>e.n===filter);
      if(!ex) return null;
      return Math.max(...ex.s.map(s=>s.w));
    });
    datasets=[{label:filter,data:data,borderColor:"blue",fill:false}];
  }
  if(chart) chart.destroy();
  const ctx=document.getElementById("progressChart").getContext("2d");
  chart=new Chart(ctx,{type:"line",data:{labels,datasets},options:{responsive:true,scales:{y:{beginAtZero:true}}}});
}

// ----------- Helpers -----------
function getRandomColor(){const letters='0123456789ABCDEF';let color='#';for(let i=0;i<6;i++)color+=letters[Math.floor(Math.random()*16)];return color;}

// ----------- Init -----------
showPage("workout");
renderWorkout();
renderHistory();
updateChart();
