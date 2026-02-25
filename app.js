document.addEventListener("DOMContentLoaded", () => {

const workouts = {
"Push A":[
{name:"Barbell Bench Press",sets:4},
{name:"Dumbbell Lateral Raise",sets:4},
{name:"Incline Dumbbell Press",sets:3},
{name:"Rope Tricep Pushdowns",sets:3},
{name:"Overhead Dumbbell Tricep Extension",sets:3},
{name:"Face Pulls",sets:3}
],
"Pull A":[
{name:"Barbell Bent-Over Row",sets:4},
{name:"Dumbbell Hammer Curl",sets:4},
{name:"Lat Pulldown",sets:3},
{name:"Barbell Curl",sets:3},
{name:"Seated Cable Row",sets:3},
{name:"Cable Curl",sets:3}
],
"Legs":[
{name:"Squat",sets:4},
{name:"Leg Curl",sets:4},
{name:"Leg Press",sets:4},
{name:"Leg Extension",sets:3}
],
"Push B":[
{name:"Incline DB Press",sets:4},
{name:"Dumbbell Lateral Raise",sets:4},
{name:"Machine Chest Press",sets:3},
{name:"Face Pulls",sets:3},
{name:"Assisted Dips",sets:3},
{name:"Rope Tricep Pushdowns",sets:3}
],
"Pull B":[
{name:"Lat Pulldown (diff grip)",sets:4},
{name:"Barbell Curl",sets:4},
{name:"Seated Row",sets:3},
{name:"Dumbbell Hammer Curl",sets:3},
{name:"Rear Delt Fly",sets:3}
]
};

let currentDay="Push A";
let chart=null;

const drawer=document.getElementById("drawer");

document.getElementById("hamburger").onclick=()=>drawer.classList.add("open");
document.getElementById("closeDrawer").onclick=()=>drawer.classList.remove("open");

function showPage(page){
document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
document.getElementById(page).classList.remove("hidden");
drawer.classList.remove("open");
}

document.querySelectorAll(".navWorkout").forEach(btn=>{
btn.onclick=()=>{
currentDay=btn.dataset.day;
renderWorkout();
showPage("workoutPage");
};
});

document.getElementById("navProgress").onclick=()=>{
renderChart();
showPage("progressPage");
};

document.getElementById("navHistory").onclick=()=>{
renderHistory();
showPage("historyPage");
};

function renderWorkout(){
document.getElementById("pageTitle").textContent=currentDay;
const container=document.getElementById("exerciseContainer");
container.innerHTML="";

workouts[currentDay].forEach(ex=>{
const div=document.createElement("div");
div.className="exercise";

div.innerHTML=`<h4>${ex.name}</h4>`;

for(let i=0;i<ex.sets;i++){
const row=document.createElement("div");
row.className="setRow";
row.innerHTML=`<input type="number" placeholder="Reps">
<input type="number" placeholder="Weight">`;
div.appendChild(row);
}

container.appendChild(div);
});
}

document.getElementById("saveWorkout").onclick=()=>{
const exercises=[];
document.querySelectorAll(".exercise").forEach(ex=>{
const name=ex.querySelector("h4").textContent;
const sets=[];
ex.querySelectorAll(".setRow").forEach(row=>{
const inputs=row.querySelectorAll("input");
sets.push({r:+inputs[0].value||0,w:+inputs[1].value||0});
});
exercises.push({n:name,s:sets});
});

const logs=JSON.parse(localStorage.getItem("logs")||"[]");
logs.push({t:new Date().toISOString(),d:currentDay,e:exercises});
localStorage.setItem("logs",JSON.stringify(logs));

alert("Workout Saved 💪");
};

function renderHistory(){
const container=document.getElementById("historyList");
container.innerHTML="";
const logs=JSON.parse(localStorage.getItem("logs")||"[]").reverse();

logs.forEach(log=>{
const div=document.createElement("div");
div.className="historyItem";
div.textContent=`${new Date(log.t).toLocaleDateString()} - ${log.d}`;
container.appendChild(div);
});
}

function renderChart(){
const logs=JSON.parse(localStorage.getItem("logs")||"[]");
const select=document.getElementById("exerciseSelect");
select.innerHTML="";

const exercises=new Set();
logs.forEach(l=>l.e.forEach(e=>exercises.add(e.n)));

exercises.forEach(name=>{
const opt=document.createElement("option");
opt.value=name;
opt.textContent=name;
select.appendChild(opt);
});

if(!select.value)return;

const labels=logs.map(l=>new Date(l.t).toLocaleDateString());
const data=logs.map(l=>{
const ex=l.e.find(e=>e.n===select.value);
if(!ex)return 0;
return ex.s.reduce((a,b)=>a+b.w,0)/ex.s.length;
});

if(chart)chart.destroy();
chart=new Chart(document.getElementById("chart"),{
type:"line",
data:{labels,datasets:[{label:select.value,data,borderColor:"#7289da"}]}
});
}

document.getElementById("exerciseSelect").onchange=renderChart;

renderWorkout();

});
