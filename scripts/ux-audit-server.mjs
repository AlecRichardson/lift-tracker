// Local-only UI audit: real screens, isolated synthetic account and in-browser data.
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const authModule = `
export const auth = {currentUser:{uid:'ux-audit',displayName:'Alec / UI Audit',email:'alec.richardson.audit@example.test'}};
export const db = {};
export class GoogleAuthProvider {}
export const browserLocalPersistence = {};
export const setPersistence = async () => {};
export const getRedirectResult = async () => null;
export const onAuthStateChanged = (auth, callback) => {queueMicrotask(()=>callback(auth.currentUser)); return ()=>{};};
export const signInWithPopup = async () => {};
export const signOut = async () => {auth.currentUser = null;};
`;
const dataModule = `
const key = 'ux-audit-records-v2';
let records = JSON.parse(sessionStorage.getItem(key) || 'null');
if (!records) {
  records = {'users/ux-audit/settings/app':{activePlanId:'current_plan',lastGym:'Ultimate',gyms:['Ultimate','Downtown Fitness']},
    'users/ux-audit/plans/current_plan':{name:'Clean Final Split',workouts:window.workouts,dayOrder:Object.keys(window.workouts)}};
  for (let i=0; i<20; i++) {
    const day=Object.keys(window.workouts)[i%5];
    records['users/ux-audit/workouts/session-'+i] = {d:day,t:new Date(Date.now()-(22-i)*86400000).toISOString(),gym:i%3?'Ultimate':'Downtown Fitness',
      e:window.workouts[day].map((ex,index)=>({id:ex.id,n:ex.name,plannedIndex:index,
        pulley:ex.equipment==='cable'?'single':'',note:index===0?'Last set felt hard. Keep the reps controlled.':'',
        s:Array.from({length:ex.sets},(_,set)=>({reps:Math.max(6,10-set),weight:ex.equipment==='dumbbell'?55:ex.equipment==='barbell'?155:90,done:true}))}))};
  }
  const ex=window.workouts['Pull A'].find(ex=>ex.id==='machine_rear_delt_fly');
  records['users/ux-audit/workouts/swap']={d:'Pull A',gym:'Ultimate',t:new Date(Date.now()-86400000).toISOString(),e:[{id:'dumbbell_rear_delt_fly',n:'Dumbbell Rear Delt Fly',originalId:ex.id,originalName:ex.name,swapped:true,s:[{reps:15,weight:15,done:true}]}]};
}
const persist=()=>sessionStorage.setItem(key,JSON.stringify(records));
persist();
const snapshot=(p)=>({id:p.split('/').pop(),exists:()=>Boolean(records[p]),data:()=>structuredClone(records[p])});
export const doc=(db,...parts)=>({path:parts.join('/')});
export const collection=doc;
export const orderBy=field=>field;
export const query=ref=>ref;
export const getDoc=async ref=>snapshot(ref.path);
export const getDocs=async ref=>({docs:Object.keys(records).filter(p=>p.startsWith(ref.path+'/')).map(snapshot).sort((a,b)=>new Date(a.data().t)-new Date(b.data().t))});
export const setDoc=async(ref,data,options)=>{records[ref.path]=options?.merge?{...records[ref.path],...data}:data;persist();};
export const addDoc=async(ref,data)=>{const id=crypto.randomUUID();const result={id,path:ref.path+'/'+id};records[result.path]=data;persist();return result;};
export const deleteDoc=async ref=>{delete records[ref.path];persist();};
`;
const types = { ".html":"text/html", ".js":"text/javascript", ".mjs":"text/javascript", ".css":"text/css", ".png":"image/png", ".json":"application/json" };
http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1:8001");
    const name = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const filename = path.resolve(root, `.${name}`);
    if (!filename.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    let content;
    if (name === "/firebase.js" || name === "/__audit__/auth.mjs") content = authModule;
    else if (name === "/__audit__/data.mjs") content = dataModule;
    else if (name === "/service-worker.js") content = "self.addEventListener('install',()=>self.skipWaiting());";
    else {
      content = await readFile(filename);
      if (name === "/app.js") content = content.toString()
        .replaceAll("https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js", "/__audit__/auth.mjs")
        .replaceAll("https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js", "/__audit__/data.mjs");
      if (name === "/index.html") content = content.toString().replace("<title>Lift Tracker</title>","<title>Lift Tracker / Synthetic UI Audit</title>");
    }
    response.writeHead(200, { "Content-Type": types[path.extname(name)] || "text/plain", "Cache-Control":"no-store" });
    response.end(content);
  } catch { response.writeHead(404).end("Not found"); }
}).listen(8001,"127.0.0.1",()=>console.log("Synthetic UI audit: http://127.0.0.1:8001"));
