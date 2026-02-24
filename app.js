document.addEventListener("DOMContentLoaded",()=>{

const workouts={
"Push A":[{name:"Barbell Bench Press",sets:4,repRange:"8–10"},{name:"Dumbbell Lateral Raise",sets:4,repRange:"12–15"},{name:"Incline Dumbbell Press",sets:3,repRange:"8–10"},{name:"Rope Tricep Pushdowns",sets:3,repRange:"10–12"},{name:"Overhead DB Tricep Extension",sets:3,repRange:"10"},{name:"Face Pulls",sets:3,repRange:"12–15"}],
"Push B":[{name:"Incline DB Press",sets:4,repRange:"8–10"},{name:"Dumbbell Lateral Raise",sets:4,repRange:"12–15"},{name:"Machine Chest Press",sets:3,repRange:"10"},{name:"Face Pulls",sets:3,repRange:"12–15"},{name:"Assisted Dips",sets:3,repRange:"8–10"},{name:"Rope Tricep Pushdowns",sets:2,repRange:"12"}],
"Pull A":[{name:"Barbell Bent-Over Row",sets:4,repRange:"8–10"},{name:"Dumbbell Hammer Curl",sets:4,repRange:"10"},{name:"Lat Pulldown",sets:3,repRange:"8–10"},{name:"Barbell Curl",sets:3,repRange:"10"},{name:"Seated Cable Row",sets:3,repRange:"10"},{name:"Cable Curl",sets:2,repRange:"12"}],
"Pull B":[{name:"Lat Pulldown (diff grip)",sets:4,repRange:"8–10"},{name:"Barbell Curl",sets:4,repRange:"8–10"},{name:"Seated Row",sets:3,repRange:"10"},{name:"Dumbbell Hammer Curl",sets:3,repRange:"10"},{name:"Rear Delt Fly",sets:3,repRange:"12–15"}],
"Legs":[{name:"Squat",sets:4,repRange:"8–10"},{name:"Leg Curl",sets:4,repRange:"8–10"},{name:"Leg Press",sets:4,repRange:"8–12"},{name:"Leg Extension",sets:2,repRange:"12–15"}]
};

let currentWorkout="Push A", chart=null;

// ---------------- Drawer ----------------
const drawer=document.getElementById("hamburger-menu");
document.querySelector(".hamburger-btn").addEventListener("click",()=>drawer.classList.toggle("open"));
document.querySelector(".close-btn").addEventListener("click",()=>drawer.classList.remove("open"));
document.querySelectorAll(".template-btn").forEach(btn=>{btn.addEventListener("click",()=>{currentWorkout=btn.dataset.workout;showPage("workout");renderWorkout();drawer.classList.remove("open");});});
document.getElementById("drawer-history").addEventListener("click",()=>{showPage("history");drawer.classList.remove("open");renderHistory();});
document.getElementById("drawer-progress").addEventListener("click",()=>{showPage("progress");drawer.classList.remove("open");updateChart();});

// ---------------- Page Switch ----------------
function showPage(page){document.querySelectorAll(".page").forEach(p=>p.style.display="none");document.getElementById("page-"+page).style.display="block";}

// ---------------- Workout Page ----------------
function renderWorkout(){
  document.getElementById("workout-title").textContent=currentWorkout;
  const container=document.getElementById("exercise-container"); container.innerHTML="";
  workouts[currentWorkout].forEach((ex,i)=>{
    const row=document.createElement("div"); row.className="exercise-row";
    const header=document.createElement("div"); header.className="exercise-header"; header.textContent=`${ex.name} (${ex.sets}x${ex.repRange})`;
    const setContainer=document.createElement("div"); setContainer.className="set-container"; setContainer.style.display="block";
    header.addEventListener("click",()=>{setContainer.style.display=setContainer.style.display==="none"?"block":"none";});
    ex.scontainer=setContainer;
    for(let s=0;s<ex.sets;s++){
      const setRow=document.createElement("div"); setRow.className="set-row";
      setRow.innerHTML=`<span>Set ${s+1}:</span><input type="number" placeholder="Reps" min="0"><input type="number" placeholder="Weight" min="0"><input type="checkbox">`;
      setContainer.appendChild(setRow);
    }
    row.appendChild(header); row.appendChild(setContainer); container.appendChild(row);
  });
}

// Load Last Workout
document.getElementById("load-last").addEventListener("click",()=>{
  if(!confirm("Are you sure you want to load the last workout? This will overwrite current inputs.")) return;
  const logs=JSON.parse(localStorage.getItem("workoutLogs")||"[]").reverse();
  const last=logs.find(l=>l.w===currentWorkout);
  if(!last){alert("No previous workout found.");return;}
  renderWorkout();
  const rows=document.querySelectorAll("#exercise-container .exercise-row");
  rows.forEach((row,i)=>{
    last.e[i].s.forEach((s,j)=>{
      const inputs=row.querySelectorAll(".set-row")[j].querySelectorAll("input");
      inputs[0].value=s.r; inputs[1].value=s.w; inputs[2].checked=s.c;
    });
  });
});

// Add / Reset / Save Workout
document.getElementById("add-exercise").addEventListener("click",()=>{
  const name=prompt("Exercise name:"); if(!name) return;
  const sets=Number(prompt("Number of sets:"))||1; const repRange=prompt("Rep range:")||"";
  workouts[currentWorkout].push({name:name,sets:sets,repRange:repRange,custom:true}); renderWorkout();
});
document.getElementById("reset-workout").addEventListener("click",()=>document.querySelectorAll("#exercise-container input").forEach(input=>{input.value=""; if(input.type==="checkbox") input.checked=false;}));

document.getElementById("save-workout").addEventListener("click",()=>{const rows=document.querySelectorAll("#exercise-container .exercise-row");const exercises=[];rows.forEach(row=>{const exName=row.querySelector(".exercise-header").innerText.split(" (")[0];const sets=[];row.querySelectorAll(".set-row").forEach(setRow=>{const inputs=setRow.querySelectorAll("input");sets.push({r:Number(inputs[0].value)||0,w:Number(inputs[1].value)||0,c:inputs[2].checked});});exercises.push({n:exName,s:sets});});const log={t:new Date().toISOString(),w:currentWorkout,e:exercises};let logs=JSON.parse(localStorage.getItem("workoutLogs")||"[]");logs.push(log);localStorage.setItem("workoutLogs",JSON.stringify(logs));alert("Workout saved!");renderHistory();updateExerciseFilter();updateChart();});

// ---------------- History Page ----------------
let expandedLogIndex=null;
function renderHistory(){
  const container=document.getElementById("history-container"); container.innerHTML="";
  const logs=JSON.parse(localStorage.getItem("workoutLogs")||"[]").reverse();
  logs.forEach((log,i)=>{
    const div=document.createElement("div"); div.className="history-item"; div.textContent=`${log.w} - ${new Date(log.t).toLocaleString()}`;
    const exContainer=document.createElement("div"); exContainer.style.display="none"; div.exContainer=exContainer;
    div.addEventListener("click",()=>{
      if(expandedLogIndex===i){exContainer.style.display="none"; expandedLogIndex=null;}
      else{document.querySelectorAll("#history-container .history-item").forEach(h=>h.exContainer.style.display="none"); exContainer.style.display="block"; expandedLogIndex=i; renderSelectedWorkout(log,exContainer);}
    });
    div.appendChild(exContainer); container.appendChild(div);
  });
}
function renderSelectedWorkout(log,container){
  container.innerHTML="";
  log.e.forEach((ex,j)=>{
    const exDiv=document.createElement("div"); exDiv.className="exercise-row";
    const title=document.createElement("div"); title.textContent=ex.n; exDiv.appendChild(title);
    ex.s.forEach((set,k)=>{
      const row=document.createElement("div"); row.className="set-row";
      row.innerHTML=`Set ${k+1}: <input type="number" value="${set.r}" min="0"> <input type="number" value="${set.w}" min="0">`;
      row.querySelectorAll("input").forEach((input,idx)=>{
        input.addEventListener("change",()=>{
          const logs=JSON.parse(localStorage.getItem("workoutLogs")||"[]").reverse();
          if(idx===0) logs[logs.length-1-j].e[j].s[k].r=Number(input.value);
          else logs[logs.length-1-j].e[j].s[k].w=Number(input.value);
          localStorage.setItem("workoutLogs",JSON.stringify(logs.reverse())); updateExerciseFilter(); updateChart();
        });
      });
      exDiv.appendChild(row);
    });
    container.appendChild(exDiv);
  });
}

// ---------------- Exercise Filter & Progress ----------------
function updateExerciseFilter(){
  const logs=JSON.parse(localStorage.getItem("workoutLogs")||"[]");
  const exSet=new Set();
  logs.forEach(l=>l.e.forEach(ex=>exSet.add(ex.n)));
  const filter=document.getElementById("exercise-filter"); filter.innerHTML='<option value="all">All Exercises</option>';
  Array.from(exSet).forEach(name=>{const opt=document.createElement("option"); opt.value=name; opt.text=name; filter.appendChild(opt);});
  filter.addEventListener("change",updateChart);
}
function updateChart(){
  const filter=document.getElementById("exercise-filter").value;
  const logs=JSON.parse(localStorage.getItem("workoutLogs")||"[]");
  const labels=logs.map(l=>new Date(l.t).toLocaleDateString());
  let datasets=[];
  if(filter==="all"){
    const allEx=new Set(); logs.forEach(l=>l.e.forEach(ex=>allEx.add(ex.n)));
    datasets=Array.from(allEx).map(name=>{
      const data=logs.map(l=>{const ex=l.e.find(e=>e.n===name);if(!ex)return null;return ex.s.reduce((a,b)=>a+b.w,0)/ex.s.length;});
      return {label:name,data:data,borderColor:getRandomColor(),fill:false};
    });
  } else {
    const data=logs.map(l=>{const ex=l.e.find(e=>e.n===filter);if(!ex)return null;return ex.s.reduce((a,b)=>a+b.w,0)/ex.s.length;});
    datasets=[{label:filter,data:data,borderColor:"#7289DA",fill:false}];
  }
  if(chart) chart.destroy(); const ctx=document.getElementById("progressChart").getContext("2d");
  chart=new Chart(ctx,{type:"line",data:{labels,datasets},options:{responsive:true,scales:{y:{beginAtZero:true}}}});
}
function getRandomColor(){const letters='0123456789ABCDEF';let color='#';for(let i=0;i<6;i++)color+=letters[Math.floor(Math.random()*16)];return color;}

// ---------------- Init ----------------
showPage("workout"); renderWorkout(); renderHistory(); updateExerciseFilter(); updateChart();
