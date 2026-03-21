
/* ─────────────────────────────────────────
   JAPAN 2026 — App Logic v3
   ───────────────────────────────────────── */

const firebaseConfig = {
  apiKey: "AIzaSyBCIaluRd8u7M88DbL59Cs_6_sfcb86f0E",
  authDomain: "japan-2026-gc.firebaseapp.com",
  projectId: "japan-2026-gc",
  storageBucket: "japan-2026-gc.firebasestorage.app",
  messagingSenderId: "661642949404",
  appId: "1:661642949404:web:c6a554f3c243171d5a00d9"
};

const ALLOWED_EMAILS  = ['ghstilson@gmail.com', 'cmelikian@gmail.com'];
const TRIP_START      = new Date('2026-04-15T00:00:00');
const TRIP_END        = new Date('2026-04-29T23:59:59');
let   JPY_RATE        = parseFloat(localStorage.getItem('jpyRate') || '149');
let   rateIsLive      = false;

async function fetchExchangeRate() {
  try {
    const res  = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data?.rates?.JPY) {
      JPY_RATE   = Math.round(data.rates.JPY * 10) / 10;
      rateIsLive = true;
      localStorage.setItem('jpyRate', JPY_RATE);
      const ri = document.getElementById('jpy-rate-input');
      if (ri) ri.value = JPY_RATE;
      const rn = document.getElementById('currency-rate-note');
      if (rn) rn.textContent = 'Rate: 1 USD = ' + JPY_RATE + ' JPY (live)';
      renderSidebarBudget();
    }
  } catch (e) { /* silently fall back to stored/default rate */ }
}

const CATEGORIES = {
  activity:  { color: '#10b981', icon: '🎌' },
  transport: { color: '#3b82f6', icon: '🚄' },
  hotel:     { color: '#8b5cf6', icon: '🏨' },
  food:      { color: '#f59e0b', icon: '🍜' },
  shopping:  { color: '#ec4899', icon: '🛍️' },
  other:     { color: '#6b7280', icon: '📌' },
};

const CITY_GROUPS = [
  { name:'Tokyo',    sub:'Shinjuku', nights:4, dates:'Apr 16 – 20', hotel:'Hotel Gracery Shinjuku',       dayIds:['2026-04-16','2026-04-17','2026-04-18','2026-04-19'], kanji:'東', bg:'linear-gradient(135deg,#1e3a5f,#0f2240)' },
  { name:'Hakone',   sub:'',        nights:2, dates:'Apr 20 – 22', hotel:'Tensui Saryo',                 dayIds:['2026-04-20','2026-04-21'],                           kanji:'箱', bg:'linear-gradient(135deg,#1a3d2b,#0d2419)' },
  { name:'Kyoto',    sub:'',        nights:4, dates:'Apr 22 – 26', hotel:'Hotel Granvia Kyoto',          dayIds:['2026-04-22','2026-04-23','2026-04-24','2026-04-25'], kanji:'京', bg:'linear-gradient(135deg,#4a1515,#2d0c0c)' },
  { name:'Kanazawa', sub:'',        nights:2, dates:'Apr 26 – 28', hotel:'Hotel INTERGATE Kanazawa',     dayIds:['2026-04-26','2026-04-27'],                           kanji:'金', bg:'linear-gradient(135deg,#3d2600,#241600)' },
  { name:'Tokyo',    sub:'Ginza',   nights:1, dates:'Apr 28 – 29', hotel:'Quintessa Hotel Tokyo Ginza',  dayIds:['2026-04-28'],                                       kanji:'銀', bg:'linear-gradient(135deg,#1f0d33,#130820)' },
];
const TRANSIT_DAYS = new Set(['2026-04-15','2026-04-20','2026-04-22','2026-04-26','2026-04-28','2026-04-29']);

// Rough transit time estimates (minutes) between categories
function estimateTransitMins(from, to) {
  if (!from.address || !to.address) return null;
  const sameCity = from.address && to.address &&
    from.address.split(',').pop().trim() === to.address.split(',').pop().trim();
  if (from.category === 'transport' || to.category === 'transport') return null; // skip — they ARE transport
  return sameCity ? 20 : 45;
}

// ── SEED DATA ────────────────────────────────────────────────
const SEED_DAYS = [
  { id:'2026-04-15', dayNum:1, city:'Los Angeles', hotel:'', activities:[
    { id:'a001', time:'11:20', title:'Depart LAX — United Flight UA39', category:'transport', order:0, cost:2196.86, currency:'USD', status:'booked', done:false, confirmation:'F354LH', address:'LAX - Tom Bradley International Terminal', notes:'Seats 31L (Gwen) & 31J (Christina) · Boeing 787-10 Dreamliner · Duration 11h 45m · Economy Plus seats included · $1,098.43/person', driveUrl:'' }
  ]},
  { id:'2026-04-16', dayNum:2, city:'Tokyo — Shinjuku', hotel:'Hotel Gracery Shinjuku', activities:[
    { id:'a002', time:'15:05', title:'Arrive Tokyo Haneda (HND)', category:'transport', order:0, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'Tokyo Haneda Airport (HND), Tokyo', notes:'Flight UA39 · Take Keikyu Line or Airport Limousine Bus to Shinjuku (~1 hr)', driveUrl:'' },
    { id:'a003', time:'17:00', title:'Check in — Hotel Gracery Shinjuku', category:'hotel', order:1, cost:200692, currency:'JPY', status:'booked', done:false, confirmation:'5594.831.309', address:'Kabukicho 1-19-1, Shinjuku, Tokyo', notes:'PIN: 6506 · Standard Twin Room · Check-in from 14:00 · Tel: +81 3 6833 1111', driveUrl:'' }
  ]},
  { id:'2026-04-17', dayNum:3, city:'Tokyo — Shinjuku', hotel:'Hotel Gracery Shinjuku', activities:[
    { id:'a004', time:'08:30', title:'teamLab Borderless: MORI Building Digital Art Museum', category:'activity', order:0, cost:11200, currency:'JPY', status:'booked', done:false, confirmation:'A7YRA4LXWCN3-0001', address:'Azabudai Hills Garden Plaza B B1, 5-9 Toranomon, Minato-ku, Tokyo', notes:'Entry window 08:30–09:00 · Arrive early!', driveUrl:'' }
  ]},
  { id:'2026-04-18', dayNum:4, city:'Tokyo — Shinjuku', hotel:'Hotel Gracery Shinjuku', activities:[] },
  { id:'2026-04-19', dayNum:5, city:'Tokyo — Shinjuku', hotel:'Hotel Gracery Shinjuku', activities:[] },
  { id:'2026-04-20', dayNum:6, city:'Hakone', hotel:'Tensui Saryo', activities:[
    { id:'a005', time:'08:30', title:'Fuji-Excursion 7 — Shinjuku to Kawaguchiko', category:'transport', order:0, cost:8400, currency:'JPY', status:'booked', done:false, confirmation:'E77821', address:'Shinjuku Station, Tokyo', notes:'Pickup code: 24492390994521288 · Car 3, Seats 13-C & 13-D · Arrives 10:26 · Collect tickets first!', driveUrl:'' },
    { id:'a006', time:'10:26', title:'Arrive Kawaguchiko — Mt. Fuji area', category:'transport', order:1, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'Kawaguchiko Station, Yamanashi', notes:'Explore Fuji Five Lakes before heading to Hakone', driveUrl:'' },
    { id:'a007', time:'15:00', title:'Check in — Tensui Saryo Ryokan', category:'hotel', order:2, cost:126340, currency:'JPY', status:'booked', done:false, confirmation:'IK1516984808', address:'1320-276 Gora, Hakone-machi, Kanagawa', notes:'Check-in 15:00–21:30 · Est. arrival 17:30 · Private open-air onsen · 2–3 min walk from Gora Station', driveUrl:'' },
    { id:'a008', time:'19:45', title:'Kaiseki Dinner — Tensui Saryo', category:'food', order:3, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'1320-276 Gora, Hakone-machi, Kanagawa', notes:'Included in stay · Basic Kaiseki · Time slot: 19:45', driveUrl:'' }
  ]},
  { id:'2026-04-21', dayNum:7, city:'Hakone', hotel:'Tensui Saryo', activities:[
    { id:'a009', time:'', title:'Breakfast — Tensui Saryo', category:'food', order:0, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'', notes:'Included in stay', driveUrl:'' },
    { id:'a010', time:'', title:'Free day in Hakone', category:'activity', order:1, cost:0, currency:'JPY', status:'idea', done:false, confirmation:'', address:'Hakone, Kanagawa', notes:'Ideas: Hakone Open-Air Museum · Lake Ashi boat cruise · Owakudani volcanic valley · Hakone Shrine · Hakone Ropeway', driveUrl:'' }
  ]},
  { id:'2026-04-22', dayNum:8, city:'Kyoto', hotel:'Hotel Granvia Kyoto', activities:[
    { id:'a011', time:'10:00', title:'Check out — Tensui Saryo', category:'hotel', order:0, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'1320-276 Gora, Hakone-machi, Kanagawa', notes:'Checkout by 10:00 · Hot Spring Tax ¥150/person at checkout', driveUrl:'' },
    { id:'a012', time:'10:11', title:'Shinkansen Hikari 637 — Odawara to Kyoto', category:'transport', order:1, cost:23800, currency:'JPY', status:'booked', done:false, confirmation:'2002', address:'Odawara Station, Kanagawa', notes:'Smart EX · Series N700 · Ordinary class · 2 adults · Arrives Kyoto 12:12', driveUrl:'' },
    { id:'a013', time:'12:12', title:'Arrive Kyoto Station', category:'transport', order:2, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'Kyoto Station, Kyoto', notes:'Hotel Granvia is directly connected to Kyoto Station', driveUrl:'' },
    { id:'a014', time:'15:00', title:'Check in — Hotel Granvia Kyoto', category:'hotel', order:3, cost:268256, currency:'JPY', status:'booked', done:false, confirmation:'23151SF060529', address:'JR Kyoto Eki Karasuma, 600-8216 Kyoto', notes:'Granvia Deluxe Twin Room · 4 nights Apr 22–26 · Tel: +81-75-344-8888', driveUrl:'' }
  ]},
  { id:'2026-04-23', dayNum:9,  city:'Kyoto', hotel:'Hotel Granvia Kyoto', activities:[] },
  { id:'2026-04-24', dayNum:10, city:'Kyoto', hotel:'Hotel Granvia Kyoto', activities:[] },
  { id:'2026-04-25', dayNum:11, city:'Kyoto', hotel:'Hotel Granvia Kyoto', activities:[] },
  { id:'2026-04-26', dayNum:12, city:'Kanazawa', hotel:'Hotel INTERGATE Kanazawa', activities:[
    { id:'a015', time:'11:00', title:'Check out — Hotel Granvia Kyoto', category:'hotel', order:0, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'JR Kyoto Eki Karasuma, 600-8216 Kyoto', notes:'Checkout by 11:00', driveUrl:'' },
    { id:'a016', time:'', title:'Travel Kyoto to Kanazawa', category:'transport', order:1, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'Kyoto Station, Kyoto', notes:'~2.5 hrs via Thunderbird limited express · Book separately!', driveUrl:'' },
    { id:'a017', time:'15:00', title:'Check in — Hotel INTERGATE Kanazawa', category:'hotel', order:2, cost:39004, currency:'JPY', status:'booked', done:false, confirmation:'20260125110822242', address:'2-5 Takaokamachi, Kanazawa, Ishikawa', notes:'Expedia: 73356721260247 · Superior Twin · Breakfast Buffet included', driveUrl:'' }
  ]},
  { id:'2026-04-27', dayNum:13, city:'Kanazawa', hotel:'Hotel INTERGATE Kanazawa', activities:[
    { id:'a018', time:'', title:'Free day in Kanazawa', category:'activity', order:0, cost:0, currency:'JPY', status:'idea', done:false, confirmation:'', address:'Kanazawa, Ishikawa', notes:'Ideas: Kenroku-en Garden · Kanazawa Castle · Higashi Chaya geisha district · Omicho Market · 21st Century Museum', driveUrl:'' }
  ]},
  { id:'2026-04-28', dayNum:14, city:'Tokyo — Ginza', hotel:'Quintessa Hotel Tokyo Ginza', activities:[
    { id:'a019', time:'11:00', title:'Check out — Hotel INTERGATE Kanazawa', category:'hotel', order:0, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'2-5 Takaokamachi, Kanazawa, Ishikawa', notes:'Checkout by 11:00', driveUrl:'' },
    { id:'a020', time:'', title:'Travel Kanazawa to Tokyo', category:'transport', order:1, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'Kanazawa Station, Ishikawa', notes:'~2.5 hrs via Kagayaki Shinkansen (direct to Tokyo) · Opened 2024!', driveUrl:'' },
    { id:'a021', time:'15:00', title:'Check in — Quintessa Hotel Tokyo Ginza', category:'hotel', order:2, cost:24713, currency:'JPY', status:'booked', done:false, confirmation:'6519361226', address:'Chuo-ku Ginza 4-11-4, Tokyo', notes:'PIN: 9235 · Hollywood Twin Room · Breakfast included · Tel: +81 3-6264-1351', driveUrl:'' }
  ]},
  { id:'2026-04-29', dayNum:15, city:'Tokyo — Los Angeles', hotel:'', activities:[
    { id:'a022', time:'11:00', title:'Check out — Quintessa Hotel Tokyo Ginza', category:'hotel', order:0, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'Chuo-ku Ginza 4-11-4, Tokyo', notes:'Checkout by 11:00 · Breakfast included', driveUrl:'' },
    { id:'a023', time:'18:10', title:'Depart Tokyo Haneda — United Flight UA38', category:'transport', order:1, cost:0, currency:'USD', status:'booked', done:false, confirmation:'F354LH', address:'Tokyo Haneda Airport (HND), Tokyo', notes:'Seats 31J (Gwen) & 31L (Christina) · Boeing 787-10 · Duration 10h 5m · Arrives LAX 12:15pm same day', driveUrl:'' }
  ]}
];

const PACKING_SEED = { items: [
  { id:'pk001', text:'Passport (valid 6+ months past Apr 29)', category:'Documents', done:false },
  { id:'pk002', text:'Flight confirmations (F354LH)', category:'Documents', done:false },
  { id:'pk003', text:'All hotel confirmation numbers (printed or saved offline)', category:'Documents', done:false },
  { id:'pk004', text:'Travel insurance documents', category:'Documents', done:false },
  { id:'pk005', text:'Credit cards — notify bank of Japan travel dates', category:'Documents', done:false },
  { id:'pk006', text:'Phone + charger', category:'Tech', done:false },
  { id:'pk007', text:'Japan uses Type A plugs — same as US, no adapter needed!', category:'Tech', done:false },
  { id:'pk008', text:'Portable battery pack', category:'Tech', done:false },
  { id:'pk009', text:'Camera + memory cards', category:'Tech', done:false },
  { id:'pk010', text:'Reserve pocket WiFi egg — pick up at HND arrivals', category:'Tech', done:false },
  { id:'pk011', text:'Download Google Maps offline (Tokyo, Kyoto, Hakone, Kanazawa)', category:'Tech', done:false },
  { id:'pk012', text:'Comfortable walking shoes (expect 15,000+ steps/day)', category:'Clothes', done:false },
  { id:'pk013', text:'Light layers — April is 10–18°C (50–64°F)', category:'Clothes', done:false },
  { id:'pk014', text:'Rain jacket or compact umbrella', category:'Clothes', done:false },
  { id:'pk015', text:'Nicer outfit for ryokan Kaiseki dinner at Tensui Saryo', category:'Clothes', done:false },
  { id:'pk016', text:'Slip-on shoes (temples & ryokan = constant shoe removal)', category:'Clothes', done:false },
  { id:'pk017', text:'Sunscreen', category:'Toiletries', done:false },
  { id:'pk018', text:'Prescription meds + copies of prescriptions', category:'Health', done:false },
  { id:'pk019', text:'Pain relievers, antacids, cold medicine', category:'Health', done:false },
  { id:'pk020', text:'Blister pads / moleskin — you WILL need these', category:'Health', done:false },
]};

const INFO_SEED = { sections: [
  { id:'inf001', title:'Emergency Numbers', content:'Police: 110\nFire / Ambulance: 119\nUS Embassy Tokyo: +81-3-3224-5000\nJapan Tourist Hotline (English, 24/7): 050-3816-2787' },
  { id:'inf002', title:'Getting Around', content:'Suica IC card: Get at Haneda arrivals or any JR station. Load ¥3,000–5,000. Works on trains, buses, convenience stores.\n\nWiFi Egg: Rent at HND airport arrivals hall. Return on departure day.\n\nBest apps: Google Maps (transit routing), Hyperdia or JR Navitime for Shinkansen.' },
  { id:'inf003', title:'Money & Tipping', content:'Tipping: NOT customary — do not tip, it can be seen as rude.\nCash: Many smaller shops and temples are cash-only. Keep ¥10,000–20,000 on hand.\n7-Eleven and Japan Post ATMs accept foreign cards reliably.\n\nUpdate the exchange rate in the Budget tab or the ¥/$ converter.' },
  { id:'inf004', title:'Cultural Tips', content:'Remove shoes at ryokans, traditional restaurants, and some temples.\nQueue politely — lines are taken seriously.\nTrash cans are rare outdoors — carry a small bag.\nSpeak quietly on trains.\nTwo hands when giving or receiving anything as a sign of respect.' },
  { id:'inf005', title:'Useful Apps', content:'Google Maps — download offline maps for all cities\nGoogle Translate — download Japanese language pack offline\nHyperdia / JR Navitime — train and Shinkansen schedules\nTabelog — restaurant reviews' },
]};

// ── FIREBASE ─────────────────────────────────────────────────
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ── STATE ────────────────────────────────────────────────────
let currentUser    = null;
let currentView    = 'overview';
let currentDayId   = null;
let days           = {};
let packingData    = null;
let infoData       = null;
let unsubDays      = null;
let unsubMeta      = null;
let currentEditId    = null;
let currentInfoEditId = null;
let currencyOpen   = false;

// ── DARK MODE ────────────────────────────────────────────────
(function initDark() {
  if (localStorage.getItem('darkMode') === '1') {
    document.body.classList.add('dark');
    const btn = document.getElementById('dark-toggle');
    if (btn) btn.innerHTML = '&#9788;';
  }
})();

function toggleDark() {
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('darkMode', isDark ? '1' : '0');
  const btn = document.getElementById('dark-toggle');
  btn.innerHTML = isDark ? '&#9788;' : '&#9790;';
}

// ── CHERRY BLOSSOMS ──────────────────────────────────────────
(function() {
  const canvas = document.getElementById('blossom-canvas');
  const ctx    = canvas.getContext('2d');
  let   petals = [];
  const COUNT  = 34;
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  window.addEventListener('resize', resize); resize();
  function mk() {
    return { x:Math.random()*canvas.width, y:Math.random()*-canvas.height,
      sz:Math.random()*7+4, vy:Math.random()*1.1+0.35, vx:Math.random()*0.5-0.25,
      rot:Math.random()*Math.PI*2, rs:(Math.random()-0.5)*0.032,
      a:Math.random()*0.38+0.18, sw:Math.random()*Math.PI*2,
      ss:Math.random()*0.013+0.004, sa:Math.random()*1.1+0.35 };
  }
  for (let i=0;i<COUNT;i++){ const p=mk(); p.y=Math.random()*canvas.height*1.4; petals.push(p); }
  function draw(p) {
    ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.globalAlpha=p.a;
    ctx.beginPath(); ctx.ellipse(0,0,p.sz*0.52,p.sz,0,0,Math.PI*2);
    ctx.fillStyle='#f2a7b8'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(0,-p.sz*0.2,p.sz*0.2,p.sz*0.42,0,0,Math.PI*2);
    ctx.fillStyle='#fce4ec'; ctx.fill(); ctx.restore();
  }
  let blossomRunning = true;
  window.stopBlossom  = () => { blossomRunning = false; };
  window.startBlossom = () => { if (!blossomRunning) { blossomRunning = true; tick(); } };
  function tick() {
    if (!blossomRunning) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    petals.forEach(p=>{
      p.sw+=p.ss; p.x+=Math.sin(p.sw)*p.sa+p.vx; p.y+=p.vy; p.rot+=p.rs;
      if(p.y>canvas.height+20){Object.assign(p,mk());p.y=-20;}
      draw(p);
    });
    requestAnimationFrame(tick);
  }
  tick();
})();

// ── AUTH ─────────────────────────────────────────────────────
auth.onAuthStateChanged(async user => {
  if (user) {
    if (!ALLOWED_EMAILS.includes(user.email.toLowerCase())) {
      await auth.signOut();
      showLoginError('This account is not authorized.');
      return;
    }
    currentUser = user;
    document.getElementById('user-avatar').src = user.photoURL || '';
    document.getElementById('user-name').textContent = (user.displayName||user.email).split(' ')[0];
    showApp();
    await initializeData();
    startListening();
  } else {
    currentUser = null; stopListening(); showLogin();
  }
});
document.getElementById('sign-in-btn').addEventListener('click', () =>
  auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e => showLoginError(e.message))
);
function signOut() { stopListening(); auth.signOut(); }
function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  if (window.startBlossom) window.startBlossom();
}
function showApp()   {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  if (window.stopBlossom) window.stopBlossom();
  initMobileUI();
  fetchExchangeRate();
}
function showLoginError(msg) {
  let el = document.querySelector('.login-error');
  if (!el) { el = document.createElement('p'); el.className='login-error'; document.querySelector('.login-card').appendChild(el); }
  el.textContent = msg;
}

// ── DATA INIT ────────────────────────────────────────────────
async function initializeData() {
  document.getElementById('main-view').innerHTML = '<div class="loading-state"><div class="spinner"></div> Loading your trip...</div>';
  try {
    const snap = await db.collection('days').limit(1).get();
    if (snap.empty) { const b=db.batch(); SEED_DAYS.forEach(d=>b.set(db.collection('days').doc(d.id),d)); await b.commit(); }
    const ps = await db.collection('meta').doc('packing').get();
    if (!ps.exists) await db.collection('meta').doc('packing').set(PACKING_SEED);
    const is = await db.collection('meta').doc('info').get();
    if (!is.exists) await db.collection('meta').doc('info').set(INFO_SEED);
  } catch(err) {
    document.getElementById('main-view').innerHTML = '<div class="loading-state" style="color:#c94040">Error: '+err.message+'</div>';
  }
}

function startListening() {
  unsubDays = db.collection('days').orderBy('dayNum').onSnapshot(snap => {
    days = {}; snap.forEach(doc => { days[doc.id] = doc.data(); });
    renderSidebar();
    if (currentView==='itinerary' && currentDayId && days[currentDayId]) renderDay(currentDayId);
    else if (currentView==='overview') renderOverview();
    else if (currentView==='budget')   renderBudgetView();
  });
  unsubMeta = db.collection('meta').onSnapshot(snap => {
    snap.forEach(doc => { if(doc.id==='packing') packingData=doc.data(); if(doc.id==='info') infoData=doc.data(); });
    if (currentView==='packing') renderPackingView();
    if (currentView==='info')    renderInfoView();
  });
}
function stopListening() { if(unsubDays){unsubDays();unsubDays=null;} if(unsubMeta){unsubMeta();unsubMeta=null;} }

// ── NAVIGATION ───────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => btn.addEventListener('click', ()=>switchView(btn.dataset.view)));

function switchView(view, skipTransition) {
  currentView = view;
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  const mv = document.getElementById('main-view');
  if (!skipTransition) { mv.classList.add('leaving'); setTimeout(()=>{ mv.classList.remove('leaving'); doRender(view); mv.classList.add('entering'); setTimeout(()=>mv.classList.remove('entering'),300); },180); }
  else doRender(view);
}
function doRender(view) {
  if (view==='overview') renderOverview();
  else if (view==='budget')  renderBudgetView();
  else if (view==='packing') renderPackingView();
  else if (view==='info')    renderInfoView();
}

function jumpToToday() {
  const today = new Date().toISOString().split('T')[0];
  if (days[today]) { currentView='itinerary'; document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active')); selectDay(today,true); }
  else switchView('overview');
}

// ── SIDEBAR ──────────────────────────────────────────────────
function renderSidebar() {
  const list = document.getElementById('day-list');
  list.innerHTML = '';

  // City group swatches
  const CITY_COLORS = {
    'Tokyo':    '#1E3A5F', 'Hakone': '#14532D',
    'Kyoto':    '#7C2D12', 'Kanazawa': '#713F12',
    'Los Angeles': '#374151',
  };

  let lastCity = null;
  Object.values(days).sort((a,b)=>a.dayNum-b.dayNum).forEach(day => {
    const baseName = day.city.split('—')[0].trim().split(' ')[0];
    if (baseName !== lastCity) {
      lastCity = baseName;
      const lbl = document.createElement('div');
      lbl.className = 'day-city-label';
      const color = CITY_COLORS[baseName] || '#374151';
      lbl.innerHTML = `<span class="day-city-swatch" style="background:${color}"></span>${baseName}`;
      list.appendChild(lbl);
    }

    const acts = day.activities || [];
    const isT  = TRANSIT_DAYS.has(day.id);
    const el   = document.createElement('div');
    el.className = 'day-item' + (day.id === currentDayId ? ' active' : '') + (isT ? ' transit' : '');
    el.dataset.id = day.id;
    const d   = new Date(day.id + 'T12:00:00');
    const ds  = d.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
    const firstAct = acts.find(a => a.title);
    const preview  = firstAct ? firstAct.title : '';
    el.innerHTML =
      '<div class="day-item-num">D' + day.dayNum + '</div>' +
      '<div class="day-item-info">' +
        '<div class="day-item-date">' + ds + '</div>' +
        (preview ? '<div class="day-item-preview">' + escHtml(preview.slice(0,28)) + '</div>' : '') +
      '</div>' +
      '<div class="day-item-dot' + (acts.length > 0 ? ' filled' : '') + '"></div>';
    el.addEventListener('click', () => {
      currentView = 'itinerary';
      document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
      const dlh = document.querySelector('.day-list-header');
      if (dlh) dlh.classList.add('in-itinerary');
      selectDay(day.id, true);
      closeSidebar();
    });
    list.appendChild(el);
  });

  const dlh = document.querySelector('.day-list-header');
  if (dlh) dlh.classList.toggle('in-itinerary', currentView === 'itinerary');
  renderSidebarBudget();
}

function renderSidebarBudget() {
  let jpy=0, usd=0;
  Object.values(days).forEach(d=>(d.activities||[]).forEach(a=>{
    if(a.cost>0&&a.status!=='idea'){if(a.currency==='JPY')jpy+=a.cost;else usd+=a.cost;}
  }));
  const est       = jpy/JPY_RATE+usd;
  const perPerson = Math.round(est/2);
  document.getElementById('budget-summary').innerHTML =
    '<div class="budget-footer-row"><span class="budget-footer-num">¥'+Math.round(jpy).toLocaleString()+'</span><span class="budget-footer-cur">JPY</span></div>'+
    (usd>0?'<div class="budget-footer-row"><span class="budget-footer-num">$'+usd.toFixed(0)+'</span><span class="budget-footer-cur">USD</span></div>':'')+
    '<div class="budget-footer-est">~$'+Math.round(est).toLocaleString()+' total · $'+perPerson.toLocaleString()+'/person</div>';
}

// ── JAPAN SVG MAP ────────────────────────────────────────────
function buildJapanMapSVG() {
  // Honshu simplified outline path (viewBox 0 0 300 420)
  // Points represent key coastal landmarks
  const honshu = `M 192,38 C 200,42 210,50 215,58 L 222,75 L 228,95 L 235,120
    L 240,145 L 242,165 L 238,185 L 235,205 L 240,225 L 248,240
    C 252,248 250,258 245,265 L 238,272 L 228,278 L 222,282
    C 218,286 215,292 210,298 L 205,308 L 198,318 L 190,328
    L 180,336 L 168,342 L 155,346 L 140,348 L 128,344
    L 115,338 L 105,328 L 95,318 L 88,308 L 82,295
    L 78,282 L 75,268 L 76,255 L 80,242
    C 84,235 88,228 90,220 L 88,210 L 85,198
    L 82,185 L 82,170 L 85,155 L 90,140
    L 96,125 L 100,110 L 102,95 L 100,80
    L 98,65 L 100,52 L 106,44
    C 112,38 120,34 128,32 L 140,30 L 153,31 L 165,33 L 178,36 Z`;

  // City positions (x,y) on 300x420 SVG
  const cities = [
    { name:'Tokyo',    x:232, y:248, dayId:'2026-04-16', sub:'Shinjuku' },
    { name:'Hakone',   x:218, y:275, dayId:'2026-04-20', sub:''         },
    { name:'Kyoto',    x:148, y:265, dayId:'2026-04-22', sub:''         },
    { name:'Kanazawa', x:118, y:198, dayId:'2026-04-26', sub:''         },
    { name:'Tokyo',    x:234, y:252, dayId:'2026-04-28', sub:'Ginza'    },
  ];

  // Route polyline (unique positions only)
  const routePoints = [
    [232,248], // Tokyo/Shinjuku
    [218,275], // Hakone
    [148,265], // Kyoto
    [118,198], // Kanazawa
    [232,248], // back to Tokyo/Ginza
  ];
  const routeStr = routePoints.map(p=>p.join(',')).join(' ');

  // LAX arc — drawn from off-screen left to Tokyo
  const arcPath = 'M -30,10 C 60,-30 150,80 232,248';

  // Build city dots + labels (skip duplicate Tokyo/Ginza dot since it overlaps)
  const cityElems = cities.filter((c,i)=>i<4).map(c => {
    const labelX = c.x > 160 ? c.x + 9 : c.x - 9;
    const anchor  = c.x > 160 ? 'start' : 'end';
    const labelY  = c.y - 6;
    return `<circle class="map-city-dot" cx="${c.x}" cy="${c.y}" r="5"
        onclick="goToCity('${c.dayId}')" title="${c.name}">
        <title>${c.name}${c.sub?' · '+c.sub:''}</title></circle>
      <text class="map-city-label map-city-label-accent" x="${labelX}" y="${c.y+1}" text-anchor="${anchor}">${c.name}</text>
      ${c.sub?'<text class="map-city-label" x="'+labelX+'" y="'+(c.y+12)+'" text-anchor="'+anchor+'">'+c.sub+'</text>':''}`;
  }).join('\n');

  return `<svg class="japan-map-svg" viewBox="0 0 300 420" xmlns="http://www.w3.org/2000/svg">
    <!-- LAX arc -->
    <path class="map-arc" d="${arcPath}"/>
    <text class="lax-label" x="-22" y="6">LAX</text>
    <!-- Honshu outline -->
    <path class="map-land" d="${honshu}"/>
    <!-- Animated route -->
    <polyline class="map-route map-route-anim" points="${routeStr}"
      style="stroke-dasharray:700;stroke-dashoffset:700;animation:drawRoute 2.2s 0.4s ease forwards"/>
    <!-- City dots -->
    ${cityElems}
    <!-- North label -->
    <text x="192" y="24" class="map-city-label" text-anchor="middle" style="font-size:8px;opacity:0.5">Honshu</text>
  </svg>`;
}

// ── OVERVIEW ─────────────────────────────────────────────────
function renderOverview() {
  const now       = new Date();
  const msPerDay  = 86400000;
  const daysUntil = Math.ceil((TRIP_START - now) / msPerDay);
  const inTrip    = now >= TRIP_START && now <= TRIP_END;
  const tripOver  = now > TRIP_END;

  let countdownHtml = '';
  if (tripOver) {
    countdownHtml = `<div class="countdown-banner"><div class="countdown-banner-bg">帰</div><div class="countdown-num" style="font-size:1.4rem">Trip complete!</div><div class="countdown-label">April 15 – 29, 2026</div></div>`;
  } else if (inTrip) {
    const todayId  = now.toISOString().split('T')[0];
    const todayDay = days[todayId];
    countdownHtml = `<div class="countdown-banner"><div class="countdown-banner-bg">旅</div><div class="countdown-top"><div><div class="countdown-num">Day ${todayDay?todayDay.dayNum:'?'}</div><div class="countdown-label">of 15 · You are in Japan!</div></div><div class="countdown-dates"><div class="countdown-trip-label">Traveling</div><div class="countdown-trip-dates">Apr 15 – 29</div></div></div><div style="margin-top:0.5rem"><a href="#" class="in-trip-link" onclick="jumpToToday();return false;">Jump to today</a></div></div>`;
  } else {
    const bookDate  = new Date('2025-12-22');
    const planDays  = Math.ceil((TRIP_START - bookDate)/msPerDay);
    const elapsed   = Math.max(0, Math.ceil((now - bookDate)/msPerDay));
    const pct       = Math.min(100,Math.round((elapsed/planDays)*100));
    countdownHtml = `<div class="countdown-banner"><div class="countdown-banner-bg">待</div><div class="countdown-top"><div><div class="countdown-num">${daysUntil}</div><div class="countdown-label">days until departure</div></div><div class="countdown-dates"><div class="countdown-trip-label">Departing</div><div class="countdown-trip-dates">Apr 15, 2026</div></div></div><div class="countdown-progress"><div class="countdown-bar" style="width:${pct}%"></div></div></div>`;
  }

  let todayFocusHtml = '';
  if (inTrip) {
    const todayId  = now.toISOString().split('T')[0];
    const todayDay = days[todayId];
    if (todayDay) {
      const todayActs = [...(todayDay.activities||[])].sort((a,b)=>a.order-b.order);
      const actsRowsHtml = todayActs.length
        ? todayActs.map(a =>
            `<div class="today-act-mini">
              <span class="today-act-time">${a.time||'—'}</span>
              <span class="today-act-name">${escHtml(a.title)}</span>
              ${a.confirmation?`<button class="today-act-conf" onclick="copyText('${escAttr(a.confirmation)}',this)">${escHtml(a.confirmation)}</button>`:''}
            </div>`).join('')
        : '<div style="color:var(--text-light);font-size:0.8rem;padding:0.4rem 0">Free day — nothing scheduled yet</div>';
      todayFocusHtml = `<div class="today-focus-card">
        <div class="today-focus-header">
          <div class="today-focus-title">Today · ${escHtml(todayDay.city)}</div>
          <a href="#" class="today-focus-go" onclick="jumpToToday();return false;">See full day →</a>
        </div>${actsRowsHtml}</div>`;
    }
  }


  const flightsHtml = `
  <div class="flights-card" style="margin-bottom:0.4rem">
    <div class="flight-row">
      <div class="flight-arrow">✈</div>
      <div class="flight-detail-wrap">
        <div class="flight-route-line">UA39 · LAX → HND</div>
        <div class="flight-meta">Apr 15 · 11:20am → Apr 16 3:05pm · Seats 31L / 31J · 787-10 · $1,098/person</div>
      </div>
      <button class="flight-conf-btn" onclick="copyText('F354LH',this)">F354LH</button>
    </div>
    <div class="flight-row">
      <div class="flight-arrow return">✈</div>
      <div class="flight-detail-wrap">
        <div class="flight-route-line">UA38 · HND → LAX</div>
        <div class="flight-meta">Apr 29 · 6:10pm → same day 12:15pm · Seats 31J / 31L · 787-10</div>
      </div>
      <button class="flight-conf-btn" style="opacity:0.45;cursor:default" disabled>F354LH</button>
    </div>
  </div>`;

  const cityCardsHtml = CITY_GROUPS.map(g => {
    const totalActs = g.dayIds.reduce((s,id)=>s+(days[id]?.activities?.length||0),0);
    const cost      = g.dayIds.reduce((s,id)=>s+(days[id]?.activities||[]).filter(a=>a.currency==='JPY').reduce((x,a)=>x+(a.cost||0),0),0);
    return `<div class="city-card" onclick="goToCity('${g.dayIds[0]}')">
      <div class="city-card-header" style="background:${g.bg}"><div class="city-card-kanji">${g.kanji}</div><div class="city-card-name">${g.name}</div>${g.sub?'<div class="city-card-sub">'+g.sub+'</div>':''}<div class="city-card-dates">${g.dates}</div></div>
      <div class="city-card-body"><div class="city-card-hotel">${g.hotel}</div><div class="city-card-stats"><div class="city-stat"><span class="city-stat-num">${g.nights}</span><span class="city-stat-lbl">nights</span></div><div class="city-stat"><span class="city-stat-num">${totalActs}</span><span class="city-stat-lbl">planned</span></div>${cost>0?'<div class="city-stat"><span class="city-stat-num">¥'+Math.round(cost/1000)+'k</span><span class="city-stat-lbl">booked</span></div>':''}</div></div>
    </div>`;
  }).join('');

  document.getElementById('main-view').innerHTML =
    countdownHtml +
    todayFocusHtml +
    `<span class="section-title">Route</span>` +
    `<div class="japan-map-wrap"><div class="japan-map-inner">${buildJapanMapSVG()}</div></div>` +
    `<span class="section-title" style="margin-top:1.4rem">Flights · <span style="font-weight:400;text-transform:none;letter-spacing:0">Conf: F354LH</span></span>` +
    flightsHtml +
    `<span class="section-title" style="margin-top:1.4rem">Cities</span><div class="city-grid">${cityCardsHtml}</div>`;
}

function goToCity(firstDayId) {
  currentView = 'itinerary';
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  selectDay(firstDayId, true);
}

// ── DAY VIEW ─────────────────────────────────────────────────
function selectDay(dayId, skipTransition) {
  if (!dayId || !days[dayId]) return;
  currentDayId = dayId;
  document.querySelectorAll('.day-item').forEach(el=>el.classList.toggle('active', el.dataset.id===dayId));
  const mv = document.getElementById('main-view');
  if (!skipTransition) {
    mv.classList.add('leaving');
    setTimeout(()=>{ mv.classList.remove('leaving'); renderDay(dayId); mv.classList.add('entering'); setTimeout(()=>mv.classList.remove('entering'),280); }, 170);
  } else {
    renderDay(dayId);
  }
  // Scroll sidebar item into view
  const activeItem = document.querySelector('.day-item.active');
  if (activeItem) activeItem.scrollIntoView({ block:'nearest', behavior:'smooth' });
}

function renderDay(dayId) {
  const day  = days[dayId];
  if (!day) return;
  const acts = [...(day.activities||[])].sort((a,b)=>a.order-b.order);
  const d    = new Date(dayId+'T12:00:00');
  const fullDate = d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'});
  const isTransit = TRANSIT_DAYS.has(dayId);

  // Build multi-stop Google Maps link from activities with addresses
  const mapsActs = acts.filter(a => a.address && a.category !== 'transport');
  let mapUrl;
  if (mapsActs.length >= 2) {
    const parts = mapsActs.map(a => encodeURIComponent(a.address));
    mapUrl = 'https://www.google.com/maps/dir/' + parts.join('/');
  } else if (mapsActs.length === 1) {
    mapUrl = 'https://www.google.com/maps/search/' + encodeURIComponent(mapsActs[0].address);
  } else {
    mapUrl = 'https://www.google.com/maps/search/' + encodeURIComponent((day.hotel||day.city)+' Japan');
  }

  let actsHtml = '';
  if (acts.length === 0) {
    actsHtml = '<div class="empty-state">Nothing planned yet — add something below</div>';
  } else {
    for (let i = 0; i < acts.length; i++) {
      actsHtml += renderActivityCard(acts[i]);
      if (i < acts.length - 1) {
        const curr = acts[i], next = acts[i+1];
        if (curr.address && next.address && curr.category !== 'transport' && next.category !== 'transport') {
          const mUrl = 'https://www.google.com/maps/dir/'+encodeURIComponent(curr.address)+'/'+encodeURIComponent(next.address);
          actsHtml += `<div class="travel-connector"><div class="travel-conn-inner"><a href="${mUrl}" target="_blank">Get directions →</a></div></div>`;
        }
      }
    }
  }

  document.getElementById('main-view').innerHTML = `
    <div class="day-header">
      <div class="day-header-left">
        <div class="day-header-eyebrow">
          <span class="day-num-tag">Day ${day.dayNum} of ${Object.keys(days).length}</span>
          <span class="day-type-badge ${isTransit?'day-type-transit':'day-type-explore'}">${isTransit?'🚄 Transit':'✦ Explore'}</span>
        </div>
        <h2 class="day-header-city">${day.city}</h2>
        <div class="day-header-date">${fullDate}</div>
        <a href="${mapUrl}" target="_blank" class="map-link">📍 ${mapsActs.length>=2?'View all stops on map':'View on map'}</a>
      </div>
      ${day.hotel?'<div class="day-hotel-chip"><div class="hotel-lbl">Staying at</div>'+escHtml(day.hotel)+'</div>':''}
    </div>
    <div class="activities-list" id="activities-list">${actsHtml}</div>
    <button class="add-act-btn" onclick="openAddModal()">+ Add Activity</button>`;
  initDragDrop();
}

function renderActivityCard(act) {
  const cat    = CATEGORIES[act.category] || CATEGORIES.other;
  const color  = cat.color;
  const bg     = color + '18';
  const isDone = act.done || false;
  const isIdea = (act.status || 'booked') === 'idea';

  const confirmHtml = act.confirmation
    ? `<div class="conf-row"><span class="conf-label">Conf.</span><span class="conf-value">${escHtml(act.confirmation)}</span><button class="copy-btn" onclick="copyText('${escAttr(act.confirmation)}',this)">Copy</button></div>` : '';

  const addrHtml = act.address
    ? `<div class="addr-row"><span class="addr-text">${escHtml(act.address)}</span><a href="https://www.google.com/maps/search/${encodeURIComponent(act.address)}" target="_blank" class="maps-btn">Maps ↗</a></div>` : '';

  const NOTES_LIMIT = 130;
  const notesLong   = act.notes && act.notes.length > NOTES_LIMIT;
  const notesShown  = notesLong ? act.notes.slice(0, NOTES_LIMIT) + '…' : act.notes;
  const notesHtml   = act.notes
    ? `<div class="act-notes" id="notes-${act.id}">${linkify(escHtml(notesShown))}</div>` +
      (notesLong ? `<button class="notes-toggle" onclick="toggleNotes('${act.id}',${JSON.stringify(act.notes).replace(/'/g,"&#39;")})">Show more</button>` : '')
    : '';

  let photoHtml = '';
  if (act.driveUrl && act.driveUrl.trim()) {
    const embed = driveUrlToEmbed(act.driveUrl.trim());
    if (embed) photoHtml = `<div class="act-photo" onclick="openLightbox('${escAttr(embed)}','${escAttr(act.driveUrl)}')"><img src="${escAttr(embed)}" alt="Photo" loading="lazy" onerror="this.closest('.act-photo').style.display='none'"><div class="act-photo-label">Google Drive photo</div></div>`;
  }

  return `<div class="activity-card${isDone?' done':''}${isIdea?' idea':''}" draggable="true" data-id="${act.id}">
    <div class="act-timeline">
      <div class="act-dot" style="background:${color}"></div>
      <div class="act-line"></div>
    </div>
    <div class="act-card-body">
      <div class="act-header">
        <div class="act-meta">
          ${act.time ? '<span class="act-time">' + act.time + '</span>' : ''}
          <span class="act-cat-pill" style="background:${bg};color:${color}"><span class="act-cat-icon">${cat.icon}</span>${act.category}</span>
          ${isIdea ? '<span class="act-idea-tag">Idea</span>' : ''}
        </div>
        <div class="act-actions">
          <button class="done-chk${isDone?' checked':''}" onclick="toggleDone('${act.id}')" title="Mark done">${isDone?'✓':''}</button>
          <button class="act-action-btn" onclick="openEditModal('${act.id}')">Edit</button>
          <button class="act-action-btn" onclick="deleteActivity('${act.id}')">Del</button>
        </div>
      </div>
      <div class="act-title">${escHtml(act.title)}</div>
      ${confirmHtml}${addrHtml}${notesHtml}
      ${act.cost > 0 ? '<span class="act-cost">' + formatCost(act.cost, act.currency) + '</span>' : ''}
      ${photoHtml}
    </div>
  </div>`;
}

// ── DRAG & DROP ──────────────────────────────────────────────
function initDragDrop() {
  const cards = document.querySelectorAll('.activity-card');
  let draggedId = null;
  cards.forEach(card => {
    card.addEventListener('dragstart', e => { draggedId=card.dataset.id; card.classList.add('dragging'); e.dataTransfer.effectAllowed='move'; });
    card.addEventListener('dragend',   ()=> card.classList.remove('dragging'));
    card.addEventListener('dragover',  e => { e.preventDefault(); card.classList.add('drag-over'); });
    card.addEventListener('dragleave', ()=> card.classList.remove('drag-over'));
    card.addEventListener('drop', async e => {
      e.preventDefault(); card.classList.remove('drag-over');
      const tid = card.dataset.id;
      if (!draggedId||draggedId===tid) return;
      let acts = [...(days[currentDayId]?.activities||[])];
      const fi = acts.findIndex(a=>a.id===draggedId);
      const ti = acts.findIndex(a=>a.id===tid);
      if (fi<0||ti<0) return;
      const [mv] = acts.splice(fi,1); acts.splice(ti,0,mv);
      acts = acts.map((a,i)=>({...a,order:i}));
      await db.collection('days').doc(currentDayId).update({activities:acts});
    });
  });
}

// ── SWIPE GESTURES ───────────────────────────────────────────
(function initSwipe() {
  let startX = 0, startY = 0;
  const mc = document.getElementById('main-content');
  mc.addEventListener('touchstart', e => { startX=e.touches[0].clientX; startY=e.touches[0].clientY; }, {passive:true});
  mc.addEventListener('touchend', e => {
    if (currentView !== 'itinerary') return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx)) return; // not a horizontal swipe
    const sorted = Object.values(days).sort((a,b)=>a.dayNum-b.dayNum);
    const idx    = sorted.findIndex(d=>d.id===currentDayId);
    if (dx < 0 && idx < sorted.length-1) selectDay(sorted[idx+1].id); // swipe left = next day
    if (dx > 0 && idx > 0)               selectDay(sorted[idx-1].id); // swipe right = prev day
  }, {passive:true});
})();

// ── MODAL ────────────────────────────────────────────────────
function openAddModal() {
  currentEditId = null;
  document.getElementById('modal-title').textContent = 'Add Activity';
  ['form-time','form-title','form-confirmation','form-address','form-notes','form-cost','form-photo-url'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('form-category').value='activity';
  document.getElementById('form-status').value='booked';
  document.getElementById('form-currency').value='JPY';
  document.getElementById('modal').classList.remove('hidden');
  setTimeout(()=>document.getElementById('form-title').focus(),80);
}
function openEditModal(actId) {
  const act = (days[currentDayId]?.activities||[]).find(a=>a.id===actId);
  if (!act) return;
  currentEditId = actId;
  document.getElementById('modal-title').textContent='Edit Activity';
  document.getElementById('form-time').value=act.time||'';
  document.getElementById('form-title').value=act.title||'';
  document.getElementById('form-category').value=act.category||'activity';
  document.getElementById('form-status').value=act.status||'booked';
  document.getElementById('form-confirmation').value=act.confirmation||'';
  document.getElementById('form-address').value=act.address||'';
  document.getElementById('form-notes').value=act.notes||'';
  document.getElementById('form-cost').value=act.cost||'';
  document.getElementById('form-currency').value=act.currency||'JPY';
  document.getElementById('form-photo-url').value=act.driveUrl||'';
  document.getElementById('modal').classList.remove('hidden');
  setTimeout(()=>document.getElementById('form-title').focus(),80);
}
function closeModal() { document.getElementById('modal').classList.add('hidden'); currentEditId=null; }
function handleModalOverlayClick(e) { if(e.target===document.getElementById('modal'))closeModal(); }

async function saveActivity() {
  const title = document.getElementById('form-title').value.trim();
  if (!title) { const i=document.getElementById('form-title'); i.style.borderColor='#c94040'; i.focus(); return; }
  document.getElementById('form-title').style.borderColor='';
  const data = { time:document.getElementById('form-time').value, title, category:document.getElementById('form-category').value, status:document.getElementById('form-status').value, confirmation:document.getElementById('form-confirmation').value.trim(), address:document.getElementById('form-address').value.trim(), notes:document.getElementById('form-notes').value.trim(), cost:parseFloat(document.getElementById('form-cost').value)||0, currency:document.getElementById('form-currency').value, driveUrl:document.getElementById('form-photo-url').value.trim() };
  const btn = document.querySelector('#modal .btn-save');
  btn.textContent='Saving...'; btn.disabled=true;
  try {
    let acts = [...(days[currentDayId]?.activities||[])];
    if (currentEditId) { const idx=acts.findIndex(a=>a.id===currentEditId); if(idx>=0) acts[idx]={...acts[idx],...data}; }
    else acts.push({id:'act-'+Date.now(),done:false,order:acts.length,...data});
    await db.collection('days').doc(currentDayId).update({activities:acts});
    closeModal();
  } catch(err) { alert('Error: '+err.message); }
  finally { btn.textContent='Save'; btn.disabled=false; }
}
async function deleteActivity(actId) {
  if (!confirm('Delete this activity?')) return;
  const acts = (days[currentDayId]?.activities||[]).filter(a=>a.id!==actId);
  await db.collection('days').doc(currentDayId).update({activities:acts});
}
async function toggleDone(actId) {
  let acts = [...(days[currentDayId]?.activities||[])];
  const idx = acts.findIndex(a=>a.id===actId);
  if (idx<0) return;
  acts[idx]={...acts[idx],done:!acts[idx].done};
  await db.collection('days').doc(currentDayId).update({activities:acts});
}

// ── BUDGET ───────────────────────────────────────────────────
function renderBudgetView() {
  let totalJPY=0, totalUSD=0;
  const byCat={};
  const byCity = CITY_GROUPS.map(g=>({...g,jpy:0,usd:0}));
  Object.values(days).forEach(day=>(day.activities||[]).filter(a=>a.cost>0&&a.status!=='idea').forEach(act=>{
    if(act.currency==='JPY'){totalJPY+=act.cost;byCat[act.category]=(byCat[act.category]||0)+act.cost;}
    else totalUSD+=act.cost;
    const city=byCity.find(g=>g.dayIds.includes(day.id));
    if(city){if(act.currency==='JPY')city.jpy+=act.cost;else city.usd+=act.cost;}
  }));
  const usdEst     = (totalJPY/JPY_RATE+totalUSD);
  const perPerson  = (usdEst/2).toFixed(0);
  const maxCat     = Math.max(...Object.values(byCat),1);
  const liveBadge  = rateIsLive ? '<span class="rate-live-badge">Live</span>' : '';
  const catBarsHtml= Object.entries(CATEGORIES).map(([k,v])=>{
    const amt=byCat[k]||0; if(!amt)return '';
    return `<div class="cat-bar-row"><span class="cat-bar-label">${k}</span><div class="cat-bar-track"><div class="cat-bar-fill" style="width:${Math.round((amt/maxCat)*100)}%;background:${v.color}"></div></div><span class="cat-bar-amt">¥${Math.round(amt).toLocaleString()}</span></div>`;
  }).filter(Boolean).join('');
  const cityRowsHtml=byCity.filter(g=>g.jpy>0||g.usd>0).map(g=>{
    const amt = g.jpy>0&&g.usd>0 ? `¥${Math.round(g.jpy).toLocaleString()} + $${g.usd.toFixed(2)}` : g.jpy>0 ? `¥${Math.round(g.jpy).toLocaleString()}` : `$${g.usd.toFixed(2)}`;
    return `<div class="city-cost-row"><span class="city-cost-name">${g.name}${g.sub?' · '+g.sub:''}</span><span class="city-cost-nights">${g.nights}n</span><span class="city-cost-amt">${amt}</span></div>`;
  }).join('');
  document.getElementById('main-view').innerHTML =
    `<div class="view-header"><div class="view-title">Budget</div><div class="view-subtitle">Booked expenses only · Ideas excluded</div></div>
    <div class="rate-row"><span>1 USD =</span><input type="number" class="rate-input" id="jpy-rate-input" value="${JPY_RATE}" min="50" max="300"><span>JPY</span>${liveBadge}</div>
    <div class="budget-cards">
      <div class="budget-card"><div class="budget-card-num">¥${Math.round(totalJPY).toLocaleString()}</div><div class="budget-card-lbl">Total in JPY</div></div>
      <div class="budget-card primary"><div class="budget-card-num">~$${Math.round(usdEst).toLocaleString()}</div><div class="budget-card-lbl">USD Estimate</div></div>
      <div class="budget-card muted"><div class="budget-card-num">~$${parseInt(perPerson).toLocaleString()}</div><div class="budget-card-lbl">Per Person ÷ 2</div></div>
    </div>
    <div class="budget-section-hd">By Category</div>
    <div class="cat-bars">${catBarsHtml || '<span style="color:var(--text-light);font-size:0.82rem">No booked costs yet</span>'}</div>
    <div class="budget-section-hd">By City</div>
    <div class="city-costs">${cityRowsHtml || '<div style="padding:1rem;color:var(--text-light);font-size:0.82rem">No costs yet</div>'}</div>`;
  document.getElementById('jpy-rate-input').addEventListener('change', e=>{
    const v=parseFloat(e.target.value); if(v>0){JPY_RATE=v;rateIsLive=false;localStorage.setItem('jpyRate',v);renderBudgetView();renderSidebarBudget();}
  });
}

// ── PACKING ──────────────────────────────────────────────────
function renderPackingView() {
  if (!packingData) { document.getElementById('main-view').innerHTML='<div class="loading-state"><div class="spinner"></div></div>'; return; }
  const items = packingData.items||[];
  const done  = items.filter(i=>i.done).length;
  const cats  = [...new Set(items.map(i=>i.category))];
  const pct   = items.length ? Math.round((done/items.length)*100) : 0;

  const groupsHtml = cats.map(cat => {
    const ci   = items.filter(i => i.category === cat);
    const cd   = ci.filter(i => i.done).length;
    const cpct = ci.length ? Math.round((cd / ci.length) * 100) : 0;
    return `<div class="pack-group">
      <div class="pack-group-hd">
        <span class="pack-group-name">${cat}</span>
        <div class="pack-group-meta">
          <div class="pack-group-bar"><div class="pack-group-bar-fill" style="width:${cpct}%"></div></div>
          <span class="pack-group-count">${cd}/${ci.length}</span>
        </div>
      </div>
      ${ci.map(item => `<div class="pack-item${item.done?' done':''}" data-id="${item.id}">
        <input type="checkbox" class="pack-check" ${item.done?'checked':''} onchange="togglePackingItem('${item.id}')">
        <span class="pack-text">${escHtml(item.text)}</span>
        <button class="pack-del" onclick="deletePackingItem('${item.id}')" aria-label="Delete">✕</button>
      </div>`).join('')}
      <div class="pack-add-row">
        <input type="text" class="pack-add-input" placeholder="Add to ${cat}…" data-cat="${cat}" onkeydown="if(event.key==='Enter')addPackingItem(this)">
        <button class="pack-add-btn" onclick="addPackingItem(this.previousElementSibling)">Add</button>
      </div>
    </div>`;
  }).join('');

  const addCatHtml = `<div class="new-cat-row">
    <input type="text" id="new-cat-input" class="pack-add-input" style="flex:1" placeholder="New category name…" onkeydown="if(event.key==='Enter')addPackingCategory()">
    <button class="pack-add-btn" onclick="addPackingCategory()">+ Category</button>
  </div>`;

  document.getElementById('main-view').innerHTML =
    `<div class="view-header"><div class="view-title">Packing List</div><div class="view-subtitle">Syncs between both of you in real time.</div></div>
    <div class="pack-overall"><div class="pack-overall-track"><div class="pack-overall-fill" style="width:${pct}%"></div></div><span class="pack-overall-text">${done} / ${items.length} packed</span></div>
    ${groupsHtml}
    ${addCatHtml}`;
}
async function togglePackingItem(id) {
  const items=(packingData?.items||[]).map(i=>i.id===id?{...i,done:!i.done}:i);
  await db.collection('meta').doc('packing').update({items});
}
async function addPackingItem(input) {
  const text=input.value.trim(); const cat=input.dataset.cat;
  if(!text) return;
  const items=[...(packingData?.items||[])];
  items.push({id:'pk-'+Date.now(),text,category:cat,done:false});
  await db.collection('meta').doc('packing').update({items});
  input.value='';
}
async function deletePackingItem(id) {
  const items=(packingData?.items||[]).filter(i=>i.id!==id);
  await db.collection('meta').doc('packing').update({items});
}
async function addPackingCategory() {
  const input = document.getElementById('new-cat-input');
  const cat   = input?.value?.trim();
  if (!cat) return;
  // Add a placeholder item to create the category
  const items = [...(packingData?.items||[])];
  items.push({ id:'pk-'+Date.now(), text:'(add items here)', category:cat, done:false });
  await db.collection('meta').doc('packing').update({items});
  if (input) input.value = '';
}

// ── TRIP INFO ────────────────────────────────────────────────
function renderInfoView() {
  if (!infoData) { document.getElementById('main-view').innerHTML='<div class="loading-state"><div class="spinner"></div></div>'; return; }
  const sections = infoData.sections || [];
  document.getElementById('main-view').innerHTML =
    `<div class="view-header"><div class="view-title">Trip Info</div><div class="view-subtitle">Key details, tips, and emergency contacts.</div></div>` +
    sections.map(s => `<div class="info-card">
      <div class="info-card-hd">
        <span class="info-card-title">${escHtml(s.title)}</span>
        <div class="info-card-actions">
          <button class="act-action-btn" onclick="openInfoEditModal('${s.id}')">Edit</button>
          <button class="act-action-btn" onclick="deleteInfoSection('${s.id}')">Delete</button>
        </div>
      </div>
      <div class="info-card-body">${linkify(escHtml(s.content))}</div>
    </div>`).join('') +
    `<button class="add-info-btn" onclick="openInfoAddModal()">+ Add Section</button>`;
}
function openInfoAddModal() {
  currentInfoEditId=null;
  document.getElementById('info-modal-title').textContent='Add Section';
  document.getElementById('info-form-title').value='';
  document.getElementById('info-form-content').value='';
  document.getElementById('info-modal').classList.remove('hidden');
  setTimeout(()=>document.getElementById('info-form-title').focus(),80);
}
function openInfoEditModal(id) {
  const s=(infoData?.sections||[]).find(x=>x.id===id); if(!s) return;
  currentInfoEditId=id;
  document.getElementById('info-modal-title').textContent='Edit Section';
  document.getElementById('info-form-title').value=s.title;
  document.getElementById('info-form-content').value=s.content;
  document.getElementById('info-modal').classList.remove('hidden');
  setTimeout(()=>document.getElementById('info-form-title').focus(),80);
}
function closeInfoModal() { document.getElementById('info-modal').classList.add('hidden'); currentInfoEditId=null; }
function handleInfoModalOverlayClick(e) { if(e.target===document.getElementById('info-modal'))closeInfoModal(); }
async function saveInfoSection() {
  const title=document.getElementById('info-form-title').value.trim();
  const content=document.getElementById('info-form-content').value.trim();
  if(!title){document.getElementById('info-form-title').style.borderColor='#c94040';return;}
  document.getElementById('info-form-title').style.borderColor='';
  let sections=[...(infoData?.sections||[])];
  if(currentInfoEditId){const idx=sections.findIndex(s=>s.id===currentInfoEditId);if(idx>=0)sections[idx]={...sections[idx],title,content};}
  else sections.push({id:'inf-'+Date.now(),title,content});
  await db.collection('meta').doc('info').update({sections});
  closeInfoModal();
}
async function deleteInfoSection(id) {
  if(!confirm('Delete this section?'))return;
  const sections=(infoData?.sections||[]).filter(s=>s.id!==id);
  await db.collection('meta').doc('info').update({sections});
}

// ── PRINT ────────────────────────────────────────────────────
function triggerPrint() {
  const sorted = Object.values(days).sort((a,b)=>a.dayNum-b.dayNum);
  const daysHtml = sorted.map(day => {
    const d = new Date(day.id+'T12:00:00');
    const dateStr = d.toLocaleDateString('en-US',{weekday:'short',month:'long',day:'numeric'});
    const acts = [...(day.activities||[])].sort((a,b)=>a.order-b.order);
    const actsHtml = acts.map(a=>`<div class="print-act"><span class="print-act-time">${a.time||'–'}</span><span class="print-act-title">${escHtml(a.title)}</span>${a.confirmation?'<span class="print-act-conf">'+escHtml(a.confirmation)+'</span>':''}</div>`).join('');
    return `<div class="print-day"><div class="print-day-header"><span class="print-day-num">Day ${day.dayNum}</span><span class="print-day-city">${day.city}</span><span class="print-day-date">${dateStr}</span></div>${actsHtml||'<div style="color:#aaa;font-size:0.78rem;padding:0.2rem 0">Free day</div>'}</div>`;
  }).join('');

  const pv = document.getElementById('print-view');
  pv.innerHTML = `<div class="print-btn-row"><button class="print-btn print-btn-primary" onclick="window.print()">Print / Save as PDF</button><button class="print-btn print-btn-secondary" onclick="document.getElementById('print-view').classList.add('hidden')">Close</button></div><div class="print-title">Japan 2026</div><div class="print-sub">April 15 – 29 · Gwen &amp; Christina · Confirmation: F354LH</div>${daysHtml}`;
  pv.classList.remove('hidden');
}

// ── CURRENCY WIDGET ──────────────────────────────────────────
function toggleCurrencyWidget() {
  currencyOpen = !currencyOpen;
  document.getElementById('currency-widget').classList.toggle('hidden', !currencyOpen);
  document.getElementById('currency-rate-note').textContent = 'Rate: 1 USD = '+JPY_RATE+' JPY';
  if (currencyOpen) document.getElementById('jpy-input').focus();
}
function convertJPY() {
  const jpy = parseFloat(document.getElementById('jpy-input').value)||0;
  document.getElementById('usd-input').value = jpy>0 ? (jpy/JPY_RATE).toFixed(2) : '';
}
function convertUSD() {
  const usd = parseFloat(document.getElementById('usd-input').value)||0;
  document.getElementById('jpy-input').value = usd>0 ? Math.round(usd*JPY_RATE) : '';
}

// ── LIGHTBOX ─────────────────────────────────────────────────
function openLightbox(imgUrl, driveLink) {
  document.getElementById('lightbox-img').src=imgUrl;
  document.getElementById('lightbox-link').href=driveLink||imgUrl;
  document.getElementById('lightbox').classList.remove('hidden');
}
function closeLightbox() {
  document.getElementById('lightbox').classList.add('hidden');
  document.getElementById('lightbox-img').src='';
}

// ── KEYBOARD ─────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key==='Escape') { closeModal(); closeLightbox(); closeInfoModal(); document.getElementById('currency-widget').classList.add('hidden'); currencyOpen=false; }
  if ((e.ctrlKey||e.metaKey)&&e.key==='Enter') {
    if (!document.getElementById('modal').classList.contains('hidden')) saveActivity();
    if (!document.getElementById('info-modal').classList.contains('hidden')) saveInfoSection();
  }
  if (currentView==='itinerary' && !document.getElementById('modal').classList.contains('hidden')===false) {
    if (e.key==='ArrowRight'||e.key==='ArrowLeft') {
      const sorted = Object.values(days).sort((a,b)=>a.dayNum-b.dayNum);
      const idx = sorted.findIndex(d=>d.id===currentDayId);
      if (e.key==='ArrowRight'&&idx<sorted.length-1) selectDay(sorted[idx+1].id);
      if (e.key==='ArrowLeft'&&idx>0) selectDay(sorted[idx-1].id);
    }
  }
});

// ── MOBILE UI ────────────────────────────────────────────────
function initMobileUI() {
  // Nothing to wire beyond what HTML onclick handlers do —
  // sidebar/backdrop already in DOM. Just sync initial state.
  closeSidebar();
}

function toggleSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const burger   = document.getElementById('hamburger');
  const isOpen   = sidebar.classList.contains('open');
  if (isOpen) {
    closeSidebar();
  } else {
    sidebar.classList.add('open');
    backdrop.classList.add('visible');
    burger.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeSidebar() {
  const sidebar  = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const burger   = document.getElementById('hamburger');
  if (!sidebar) return;
  sidebar.classList.remove('open');
  backdrop.classList.remove('visible');
  if (burger) burger.classList.remove('open');
  document.body.style.overflow = '';
}

// ── NOTES EXPAND / COLLAPSE ────────────────────────────────────────────────
function toggleNotes(actId, fullText) {
  const el  = document.getElementById('notes-' + actId);
  const btn = el ? el.nextElementSibling : null;
  if (!el || !btn) return;
  const expanded = btn.dataset.expanded === 'true';
  if (expanded) {
    const short = fullText.length > 130 ? fullText.slice(0, 130) + '…' : fullText;
    el.innerHTML  = linkify(escHtml(short));
    btn.textContent   = 'Show more';
    btn.dataset.expanded = 'false';
  } else {
    el.innerHTML  = linkify(escHtml(fullText));
    btn.textContent   = 'Show less';
    btn.dataset.expanded = 'true';
  }
}

// ── UTILS ────────────────────────────────────────────────────
function formatCost(c,currency) { return currency==='JPY'?'¥'+Math.round(c).toLocaleString():'$'+c.toFixed(2); }
function escHtml(s) { if(!s)return ''; return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\n/g,'<br>'); }
function escAttr(s) { if(!s)return ''; return s.replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function linkify(s) { return s.replace(/(https?:\/\/[^\s<"']+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>'); }
async function copyText(text,btn) {
  try { await navigator.clipboard.writeText(text); const o=btn.textContent; btn.textContent='Copied!'; btn.classList.add('copied'); setTimeout(()=>{btn.textContent=o;btn.classList.remove('copied');},1800); } catch {}
}
function driveFileId(url) {
  if(!url)return null;
  const m1=url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/); if(m1)return m1[1];
  const m2=url.match(/[?&]id=([a-zA-Z0-9_-]+)/); if(m2)return m2[1];
  return null;
}
function driveUrlToEmbed(url) { const id=driveFileId(url); return id?'https://drive.google.com/thumbnail?id='+id+'&sz=w480':null; }
