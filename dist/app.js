// Signal Safari — Muscle Lab 6.1
// Simple EMG app for the OpenBCI Ganglion (via Web Bluetooth).
// Uses a standard Web Bluetooth Ganglion client (ganglion-ble), simplified to one channel.
import { Ganglion } from "./vendor/ganglion.js";

/* ---------- tiny SVG mascot: "Milo" the sensor ---------- */
document.getElementById("milo").innerHTML = `
<svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
  <line x1="32" y1="6" x2="32" y2="15" stroke="#1B2A41" stroke-width="3" stroke-linecap="round"/>
  <circle cx="32" cy="5" r="4.5" fill="#FFD23F" stroke="#1B2A41" stroke-width="3"/>
  <rect x="8" y="15" width="48" height="42" rx="14" fill="#0E7C7B" stroke="#1B2A41" stroke-width="3"/>
  <circle cx="23" cy="33" r="6" fill="#FFFDF7" stroke="#1B2A41" stroke-width="2.5"/>
  <circle cx="41" cy="33" r="6" fill="#FFFDF7" stroke="#1B2A41" stroke-width="2.5"/>
  <circle cx="24.5" cy="34" r="2.6" fill="#1B2A41"/>
  <circle cx="42.5" cy="34" r="2.6" fill="#1B2A41"/>
  <path d="M23 45 q9 8 18 0" fill="none" stroke="#FFFDF7" stroke-width="3" stroke-linecap="round"/>
</svg>`;

/* ---------- elements ---------- */
const $ = (id) => document.getElementById(id);
const dot = $("dot"), statusTxt = $("statusTxt"), bleNote = $("bleNote");
const graph = $("graph"), gctx = graph.getContext("2d");
const fillEl = $("fill"), strengthEl = $("strength");
const zoneEl = $("zone"), zoneLab = $("zonelab");
const scoreEl = $("score"), zoneTimeEl = $("zoneTime"), timeLeftEl = $("timeLeft"), starsEl = $("stars");
const trialsBody = $("trials");
const dp = $("dotplot"), dpctx = dp.getContext("2d");
const badges = { scout: $("bScout"), pattern: $("bPattern"), graph: $("bGraph") };

/* ---------- signal pipeline ---------- */
const SR = 200;                 // Ganglion sample rate (Hz)
let env = 0;                    // smoothed rectified envelope
let strength = 0;               // 0..100 (auto-ranged to the recent signal)
let caughtSpike = false;
const ALPHA = 0.18;             // envelope smoothing
const PR = 400;                 // rolling window (samples) for auto-range
const envWin = [];
const TRACE = new Array(700).fill(0);
function pushTrace(v){ TRACE.push(v); TRACE.shift(); }

function onRaw(raw){
  const v = Number(raw);
  if (!Number.isFinite(v)) return;            // ignore bad reads — guards NaN
  const a = Math.abs(v);
  env = env * (1 - ALPHA) + a * ALPHA;         // rectify + smooth → EMG envelope
  envWin.push(env); if (envWin.length > PR) envWin.shift();
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < envWin.length; i++){ const e = envWin[i]; if (e < lo) lo = e; if (e > hi) hi = e; }
  const s = Math.min(100, Math.max(0, 100 * (env - lo) / ((hi - lo) || 1)));   // auto-range, scale-agnostic
  strength = strength * 0.6 + s * 0.4;         // smooth for display
  if (strength >= 80) caughtSpike = true;
  pushTrace(strength);
  if (playing) tickGame(1 / SR);
  paint();
}

/* ---------- rendering ---------- */
function paint(){
  // live graph
  const W = graph.width, H = graph.height, n = TRACE.length;
  gctx.clearRect(0,0,W,H);
  gctx.strokeStyle = "#eef1f5"; gctx.lineWidth = 1;
  for (let i=1;i<4;i++){ gctx.beginPath(); gctx.moveTo(0, H*i/4); gctx.lineTo(W, H*i/4); gctx.stroke(); }
  // target band on the graph too
  const zTop = H*(1-zHi/100), zBot = H*(1-zLo/100);
  gctx.fillStyle = "rgba(255,210,63,.25)"; gctx.fillRect(0,zTop,W,zBot-zTop);
  gctx.beginPath();
  gctx.strokeStyle = "#0E7C7B"; gctx.lineWidth = 2.5;
  for (let i=0;i<n;i++){
    const x = (i/(n-1))*W, y = H - (TRACE[i]/100)*H;
    i ? gctx.lineTo(x,y) : gctx.moveTo(x,y);
  }
  gctx.stroke();
  // meter + number
  fillEl.style.height = strength.toFixed(1) + "%";
  strengthEl.textContent = Math.round(strength);
  // badges
  badges.scout.classList.toggle("on", caughtSpike);
  badges.pattern.classList.toggle("on", trials.length >= 3);
  badges.graph.classList.toggle("on", trials.length >= 3);
}

/* ---------- "Wake the Bar" game ---------- */
const ZLO = 60, ZHI = 80, zLo = ZLO, zHi = ZHI;   // target zone
const ROUND = 30;                                  // seconds
let playing = false, score = 0, inZone = 0, timeLeft = ROUND;
zoneEl.style.bottom = ZLO + "%"; zoneEl.style.height = (ZHI-ZLO) + "%";
zoneLab.style.bottom = (ZHI + 1) + "%";

function tickGame(dt){
  const inz = strength >= ZLO && strength <= ZHI;
  if (inz){ inZone += dt; score += Math.round(dt * 40); }
  timeLeft = Math.max(0, timeLeft - dt);
  scoreEl.textContent = score;
  zoneTimeEl.textContent = inZone.toFixed(1) + "s";
  timeLeftEl.textContent = Math.ceil(timeLeft) + "s";
  const stars = inZone > 15 ? 3 : inZone > 8 ? 2 : inZone > 3 ? 1 : 0;
  starsEl.innerHTML = [0,1,2].map(i => `<span class="${i<stars?"on":""}">★</span>`).join("");
  if (timeLeft <= 0) stopGame();
}
function startGame(){ playing = true; score = 0; inZone = 0; timeLeft = ROUND; $("btnPlay").textContent = "Stop"; }
function stopGame(){ playing = false; $("btnPlay").textContent = "Start"; }

/* ---------- trials + math ---------- */
const trials = [];                 // array of peak strengths
let rec = null;                    // {max}

function recordTrial(){
  rec = { max: 0, t: 0 };
}
function updateRecorder(dt, s){
  if (!rec) return;
  rec.t += dt; rec.max = Math.max(rec.max, s);
  if (rec.t >= 2){ trials.push(Math.round(rec.max)); rec = null; renderTrials(); updateStats(); drawDotPlot(); }
}

const mean = a => a.reduce((x,y)=>x+y,0)/a.length;
function median(a){ const b=[...a].sort((x,y)=>x-y), m=b.length>>1; return b.length%2?b[m]:(b[m-1]+b[m])/2; }
function mode(a){ const c={}; let best=0,bv=null; a.forEach(v=>{c[v]=(c[v]||0)+1; if(c[v]>best){best=c[v];bv=v;}}); return best>1?bv:null; }
function range(a){ return Math.max(...a)-Math.min(...a); }

function updateStats(){
  const t = trials;
  $("sMean").textContent  = t.length ? mean(t).toFixed(1) : "–";
  $("sMed").textContent   = t.length ? median(t) : "–";
  const m = t.length ? mode(t) : null;
  $("sMode").textContent  = m == null ? "–" : m;
  $("sRange").textContent = t.length > 1 ? range(t) : (t.length ? 0 : "–");
}
function renderTrials(){
  trialsBody.innerHTML = trials.map((v,i)=>`<tr><td>Trial ${i+1}</td><td class="num">${v}</td></tr>`).join("");
}
function drawDotPlot(){
  const W=dp.width,H=dp.height; dpctx.clearRect(0,0,W,H);
  const padX=16, base=H-26, top=14;
  // axis
  dpctx.strokeStyle="#cfd6de"; dpctx.lineWidth=2; dpctx.beginPath();
  dpctx.moveTo(padX, base+8); dpctx.lineTo(W-padX, base+8); dpctx.stroke();
  dpctx.fillStyle="#4a5a72"; dpctx.font="700 11px Nunito,sans-serif";
  if (!trials.length){ dpctx.fillText("Record 3+ trials to build your dot plot", padX, base-10); return; }
  const min=Math.min(...trials), max=Math.max(...trials);
  const lo=Math.max(0,min-4), hi=Math.min(100,Math.max(max+4, min+8));
  const X = v => padX + (W-2*padX)*((v-lo)/(hi-lo||1));
  // ticks
  for (let v=Math.ceil(lo/20)*20; v<=hi; v+=20){
    dpctx.fillStyle="#9aa6b4"; dpctx.fillText(v, X(v)-6, base+22);
    dpctx.strokeStyle="#eef1f5"; dpctx.beginPath(); dpctx.moveTo(X(v),top); dpctx.lineTo(X(v),base+8); dpctx.stroke();
  }
  // stack dots
  const stack={};
  trials.forEach(v=>{ const k=Math.round(v); stack[k]=(stack[k]||0)+1; });
  Object.entries(stack).forEach(([v,c])=>{
    const x=X(+v);
    for(let i=0;i<c;i++){
      dpctx.beginPath(); dpctx.arc(x, base-i*15-8, 6, 0, 7);
      dpctx.fillStyle="#FF6B6B"; dpctx.fill();
      dpctx.strokeStyle="#fff"; dpctx.lineWidth=2; dpctx.stroke();
    }
  });
  // mean line
  const mx = X(mean(trials));
  dpctx.strokeStyle="#0E7C7B"; dpctx.setLineDash([5,4]); dpctx.lineWidth=2;
  dpctx.beginPath(); dpctx.moveTo(mx, top); dpctx.lineTo(mx, base+8); dpctx.stroke(); dpctx.setLineDash([]);
  dpctx.fillStyle="#0E7C7B"; dpctx.fillText("mean", mx-12, top-3);
}

/* ---------- connection (Ganglion over Web Bluetooth) ---------- */
let ganglion = null;
function setStatus(txt, cls){ statusTxt.textContent = txt; dot.className = "dot" + (cls?" "+cls:""); }

async function connectReal(){
  if (!navigator.bluetooth){
    bleNote.style.display="block";
    bleNote.textContent = "This browser can’t use Web Bluetooth. Use Chrome or Edge on a computer/Android (not Safari/iOS). Meanwhile, you can try practice data.";
    setStatus("No Bluetooth here", "err"); return;
  }
  try{
    setStatus("Connecting…","");
    ganglion = new Ganglion();
    await ganglion.connect();
    await ganglion.start();
    ganglion.stream.subscribe(sample => {
      stopMock();
      // ganglion-ble v1.0.0 emits `channelData` (the README's `data` is stale)
      const arr = sample.channelData || sample.data || [];
      onRaw(arr[0]);
    });
    setStatus("Connected — move a muscle!", "on");
    $("btnTrial").disabled = false;
    $("bleNote").style.display="none";
  }catch(e){
    console.warn(e);
    setStatus("Not connected", "err");
    if (String(e).match(/cancel|denied|No device/i)) return;
    bleNote.style.display="block";
    bleNote.textContent = "Couldn’t connect. Make sure the Ganglion is on and in range, then try again.";
  }
}

/* ---------- practice / mock data (no hardware) ---------- */
let mockTimer = null, mockT = 0;
function startMock(){
  if (mockTimer) return;
  setStatus("Practice data (no sensor)", "on");
  $("btnTrial").disabled = false;
  bleNote.style.display="block";
  bleNote.textContent = "Practice mode: this is simulated muscle data so you can try every step without a sensor.";
  let ph = Math.random()*6;
  mockTimer = setInterval(()=>{
    for (let i=0;i<SR/20;i++){                 // ~20 Hz update batches
      mockT += 1/SR;
      const cyc = 0.5 + 0.5*Math.sin(2*Math.PI*mockT/5 + ph);   // slow squeeze/relax
      const noise = (Math.random()-0.5) * 0.06;
      onRaw((cyc*0.85 + noise) * 60 - 8);      // bipolar-ish raw value
    }
  }, 50);
}
function stopMock(){ if (mockTimer){ clearInterval(mockTimer); mockTimer = null; } }

/* ---------- wire up UI ---------- */
$("btnConnect").onclick = connectReal;
$("btnMock").onclick = () => (mockTimer ? stopMock() : startMock());
$("btnPlay").onclick = () => (playing ? stopGame() : startGame());
$("btnReset").onclick = () => { stopGame(); score=0; inZone=0; timeLeft=ROUND; scoreEl.textContent=0; zoneTimeEl.textContent="0.0s"; timeLeftEl.textContent="30s"; };
$("btnTrial").onclick = () => { recordTrial(); $("trialHint").textContent = "Hold a squeeze for 2 seconds…"; };
$("btnClear").onclick = () => { trials.length=0; renderTrials(); updateStats(); drawDotPlot(); };
$("btnExport").onclick = () => {
  const rows = ["trial,peak", ...trials.map((v,i)=>`${i+1},${v}`)].join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([rows], {type:"text/csv"}));
  a.download = "signal-safari-trials.csv"; a.click();
};

// recorder ticking (piggybacks on the data rate)
setInterval(()=>{ if (rec) updateRecorder(2/SR, strength); }, 1000/SR);
setInterval(paint, 1000/30);

// first paint + browser capability note
paint(); drawDotPlot();
if (!navigator.bluetooth){
  bleNote.style.display="block";
  bleNote.textContent = "Heads up: this browser has no Web Bluetooth. If you have a sensor, open this page in Chrome or Edge (over HTTPS). Otherwise, press “Use practice data”.";
}
