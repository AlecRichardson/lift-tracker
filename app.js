document.addEventListener("DOMContentLoaded", () => {

  // ------------------------------
  // WORKOUT TEMPLATES
  // ------------------------------
  window.workouts = {
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
    // Legs, Push B, Pull B omitted for brevity, include all as before
  };

  let currentDay = "Push A";

  const drawer = document.getElementById("drawer");

  // ------------------------------
  // NAVIGATION
  // ------------------------------
  document.getElementById("hamburger")?.addEventListener("click", () => drawer?.classList.add("open"));
  document.getElementById("closeDrawer")?.addEventListener("click", () => drawer?.classList.remove("open"));

  function showPage(page){
    document.querySelectorAll(".page").forEach(p=>p.classList.add("hidden"));
    document.getElementById(page)?.classList.remove("hidden");
    drawer?.classList.remove("open");
  }

  document.querySelectorAll(".navWorkout").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      currentDay = btn.dataset.day;
      renderWorkout();
      showPage("workoutPage");
    });
  });

  document.getElementById("navProgress")?.addEventListener("click", ()=>{ showPage("progressPage"); });
  document.getElementById("navHistory")?.addEventListener("click", ()=>{ showPage("historyPage"); });

  // ------------------------------
  // RENDER WORKOUT
  // ------------------------------
  function renderWorkout(){
    const container = document.getElementById("exerciseContainer");
    if(!container) return;
    container.innerHTML="";

    let currentSuperset="";
    window.workouts[currentDay].forEach(ex=>{
      if(ex.superset!==currentSuperset && ex.superset){
        const supDiv=document.createElement("div");
        supDiv.className="supersetLabel";
        supDiv.textContent="Superset "+ex.superset;
        container.appendChild(supDiv);
        currentSuperset=ex.superset;
      }

      const div=document.createElement("div");
      div.className="exercise";
      div.innerHTML=`<h4>${ex.name} <span>${ex.sets}x${ex.target}</span></h4>`;

      for(let i=0;i<ex.sets;i++){
        const row=document.createElement("div");
        row.className="setRow";
        row.innerHTML=`<input type="text" placeholder="Reps"><input type="text" placeholder="Weight">`;
        div.appendChild(row);
      }

      container.appendChild(div);
    });
  }

  document.getElementById("saveWorkout")?.addEventListener("click", ()=>{
    // animate save instead of alert, restore logic as needed
  });

  // Initial render
  renderWorkout();
});
