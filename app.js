/* ─────────────────────────────────────────
   JAPAN 2026 — App Logic
   ───────────────────────────────────────── */

// ── CONFIG ──────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBCIaluRd8u7M88DbL59Cs_6_sfcb86f0E",
  authDomain: "japan-2026-gc.firebaseapp.com",
  projectId: "japan-2026-gc",
  storageBucket: "japan-2026-gc.firebasestorage.app",
  messagingSenderId: "661642949404",
  appId: "1:661642949404:web:c6a554f3c243171d5a00d9"
};

const ALLOWED_EMAILS = ['ghstilson@gmail.com', 'cmelikian@gmail.com'];
const TRIP_START = new Date('2026-04-15T00:00:00');
const TRIP_END   = new Date('2026-04-29T23:59:59');
const JPY_RATE_DEFAULT = 149; // JPY per 1 USD

const CATEGORIES = {
  activity:  { color: '#10b981' },
  transport: { color: '#3b82f6' },
  hotel:     { color: '#8b5cf6' },
  food:      { color: '#f59e0b' },
  shopping:  { color: '#ec4899' },
  other:     { color: '#6b7280' },
};

const CITY_GROUPS = [
  { name: 'Tokyo', sub: 'Shinjuku', nights: 4, dates: 'Apr 16 – 20', hotel: 'Hotel Gracery Shinjuku', dayIds: ['2026-04-16','2026-04-17','2026-04-18','2026-04-19'], kanji: '東', bg: 'linear-gradient(135deg, #1e3a5f 0%, #0f2240 100%)' },
  { name: 'Hakone', sub: '', nights: 2, dates: 'Apr 20 – 22', hotel: 'Tensui Saryo', dayIds: ['2026-04-20','2026-04-21'], kanji: '箱', bg: 'linear-gradient(135deg, #1a3d2b 0%, #0d2419 100%)' },
  { name: 'Kyoto', sub: '', nights: 4, dates: 'Apr 22 – 26', hotel: 'Hotel Granvia Kyoto', dayIds: ['2026-04-22','2026-04-23','2026-04-24','2026-04-25'], kanji: '京', bg: 'linear-gradient(135deg, #4a1515 0%, #2d0c0c 100%)' },
  { name: 'Kanazawa', sub: '', nights: 2, dates: 'Apr 26 – 28', hotel: 'Hotel INTERGATE Kanazawa', dayIds: ['2026-04-26','2026-04-27'], kanji: '金', bg: 'linear-gradient(135deg, #3d2600 0%, #241600 100%)' },
  { name: 'Tokyo', sub: 'Ginza', nights: 1, dates: 'Apr 28 – 29', hotel: 'Quintessa Hotel Tokyo Ginza', dayIds: ['2026-04-28'], kanji: '銀', bg: 'linear-gradient(135deg, #1f0d33 0%, #130820 100%)' },
];

// Transit day IDs (days where city changes)
const TRANSIT_DAYS = new Set(['2026-04-15','2026-04-20','2026-04-22','2026-04-26','2026-04-28','2026-04-29']);

// ── SEED DATA ────────────────────────────────────────────────
const SEED_DAYS = [
  { id:'2026-04-15', dayNum:1, city:'Los Angeles', hotel:'', activities:[
    { id:'a001', time:'11:20', title:'Depart LAX — United Flight UA39', category:'transport', order:0, cost:0, currency:'USD', status:'booked', done:false, confirmation:'F354LH', address:'LAX - Tom Bradley International Terminal', notes:'Seats 31L (Gwen) & 31J (Christina) · Boeing 787-10 Dreamliner · Duration 11h 45m', driveUrl:'' }
  ]},
  { id:'2026-04-16', dayNum:2, city:'Tokyo — Shinjuku', hotel:'Hotel Gracery Shinjuku', activities:[
    { id:'a002', time:'15:05', title:'Arrive Tokyo Haneda (HND)', category:'transport', order:0, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'Tokyo Haneda Airport (HND)', notes:'Flight UA39 · Take Keikyu Line or Airport Limousine Bus to Shinjuku (~1 hr)', driveUrl:'' },
    { id:'a003', time:'17:00', title:'Check in — Hotel Gracery Shinjuku', category:'hotel', order:1, cost:200692, currency:'JPY', status:'booked', done:false, confirmation:'5594.831.309', address:'Kabukicho 1-19-1, Shinjuku, Tokyo', notes:'PIN: 6506 · Standard Twin Room · Check-in from 14:00 · Tel: +81 3 6833 1111', driveUrl:'' }
  ]},
  { id:'2026-04-17', dayNum:3, city:'Tokyo — Shinjuku', hotel:'Hotel Gracery Shinjuku', activities:[
    { id:'a004', time:'08:30', title:'teamLab Borderless: MORI Building Digital Art Museum', category:'activity', order:0, cost:11200, currency:'JPY', status:'booked', done:false, confirmation:'A7YRA4LXWCN3-0001', address:'Azabudai Hills Garden Plaza B B1, 5-9 Toranomon, Minato-ku, Tokyo', notes:'Entry window 08:30–09:00 · 2 adults · Arrive early!', driveUrl:'' }
  ]},
  { id:'2026-04-18', dayNum:4, city:'Tokyo — Shinjuku', hotel:'Hotel Gracery Shinjuku', activities:[] },
  { id:'2026-04-19', dayNum:5, city:'Tokyo — Shinjuku', hotel:'Hotel Gracery Shinjuku', activities:[] },
  { id:'2026-04-20', dayNum:6, city:'Hakone', hotel:'Tensui Saryo', activities:[
    { id:'a005', time:'08:30', title:'Fuji-Excursion 7 — Shinjuku to Kawaguchiko', category:'transport', order:0, cost:8400, currency:'JPY', status:'booked', done:false, confirmation:'E77821', address:'Shinjuku Station', notes:'Pickup code: 24492390994521288 · Car 3, Seats 13-C & 13-D · Arrives 10:26 · Collect tickets at station!', driveUrl:'' },
    { id:'a006', time:'10:26', title:'Arrive Kawaguchiko — Mt. Fuji area', category:'transport', order:1, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'Kawaguchiko Station', notes:'Explore Fuji Five Lakes before heading to Hakone', driveUrl:'' },
    { id:'a007', time:'15:00', title:'Check in — Tensui Saryo Ryokan', category:'hotel', order:2, cost:126340, currency:'JPY', status:'booked', done:false, confirmation:'IK1516984808', address:'1320-276 Gora, Hakone-machi, Ashigarashimo-gun', notes:'Check-in 15:00–21:30 · Estimated arrival 17:30 · Detached room with private open-air onsen · 2–3 min walk from Gora Station', driveUrl:'' },
    { id:'a008', time:'19:45', title:'Kaiseki Dinner — Tensui Saryo', category:'food', order:3, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'1320-276 Gora, Hakone-machi', notes:'Included in stay · Basic Kaiseki · Time slot: 19:45', driveUrl:'' }
  ]},
  { id:'2026-04-21', dayNum:7, city:'Hakone', hotel:'Tensui Saryo', activities:[
    { id:'a009', time:'', title:'Breakfast — Tensui Saryo', category:'food', order:0, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'', notes:'Included in stay', driveUrl:'' },
    { id:'a010', time:'', title:'Free day in Hakone', category:'activity', order:1, cost:0, currency:'JPY', status:'idea', done:false, confirmation:'', address:'Hakone, Kanagawa', notes:'Ideas: Hakone Open-Air Museum · Lake Ashi boat cruise · Owakudani volcanic valley · Hakone Shrine · Hakone Ropeway', driveUrl:'' }
  ]},
  { id:'2026-04-22', dayNum:8, city:'Kyoto', hotel:'Hotel Granvia Kyoto', activities:[
    { id:'a011', time:'10:00', title:'Check out — Tensui Saryo', category:'hotel', order:0, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'1320-276 Gora, Hakone-machi', notes:'Checkout by 10:00 · Hot Spring Tax: ¥150 per person at checkout', driveUrl:'' },
    { id:'a012', time:'10:11', title:'Shinkansen Hikari 637 — Odawara to Kyoto', category:'transport', order:1, cost:23800, currency:'JPY', status:'booked', done:false, confirmation:'2002', address:'Odawara Station — Shinkansen platforms', notes:'Smart EX · Series N700 · Ordinary class · 2 adults · Arrives Kyoto 12:12 · Note: Odawara is ~40 min from Gora', driveUrl:'' },
    { id:'a013', time:'12:12', title:'Arrive Kyoto Station', category:'transport', order:2, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'Kyoto Station', notes:'Hotel Granvia is directly connected to Kyoto Station — no travel needed!', driveUrl:'' },
    { id:'a014', time:'15:00', title:'Check in — Hotel Granvia Kyoto', category:'hotel', order:3, cost:268256, currency:'JPY', status:'booked', done:false, confirmation:'23151SF060529', address:'JR Kyoto Eki Karasuma, 600-8216 Kyoto', notes:'Granvia Deluxe Twin Room · 4 nights Apr 22–26 · Tel: +81-75-344-8888', driveUrl:'' }
  ]},
  { id:'2026-04-23', dayNum:9,  city:'Kyoto', hotel:'Hotel Granvia Kyoto', activities:[] },
  { id:'2026-04-24', dayNum:10, city:'Kyoto', hotel:'Hotel Granvia Kyoto', activities:[] },
  { id:'2026-04-25', dayNum:11, city:'Kyoto', hotel:'Hotel Granvia Kyoto', activities:[] },
  { id:'2026-04-26', dayNum:12, city:'Kanazawa', hotel:'Hotel INTERGATE Kanazawa', activities:[
    { id:'a015', time:'11:00', title:'Check out — Hotel Granvia Kyoto', category:'hotel', order:0, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'JR Kyoto Eki Karasuma, 600-8216 Kyoto', notes:'Checkout by 11:00', driveUrl:'' },
    { id:'a016', time:'', title:'Travel Kyoto to Kanazawa', category:'transport', order:1, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'Kyoto Station', notes:'~2.5 hrs via Thunderbird limited express (Kyoto → Kanazawa direct) · Book tickets separately!', driveUrl:'' },
    { id:'a017', time:'15:00', title:'Check in — Hotel INTERGATE Kanazawa', category:'hotel', order:2, cost:39004, currency:'JPY', status:'booked', done:false, confirmation:'20260125110822242', address:'2-5 Takaokamachi, Kanazawa, Ishikawa 920-0864', notes:'Expedia: 73356721260247 · Superior Twin · Breakfast Buffet included', driveUrl:'' }
  ]},
  { id:'2026-04-27', dayNum:13, city:'Kanazawa', hotel:'Hotel INTERGATE Kanazawa', activities:[
    { id:'a018', time:'', title:'Free day in Kanazawa', category:'activity', order:0, cost:0, currency:'JPY', status:'idea', done:false, confirmation:'', address:'Kanazawa, Ishikawa', notes:'Ideas: Kenroku-en Garden (top 3 in Japan!) · Kanazawa Castle · Higashi Chaya geisha district · Omicho Market · 21st Century Museum of Contemporary Art', driveUrl:'' }
  ]},
  { id:'2026-04-28', dayNum:14, city:'Tokyo — Ginza', hotel:'Quintessa Hotel Tokyo Ginza', activities:[
    { id:'a019', time:'11:00', title:'Check out — Hotel INTERGATE Kanazawa', category:'hotel', order:0, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'2-5 Takaokamachi, Kanazawa', notes:'Checkout by 11:00 · Enjoy breakfast buffet first!', driveUrl:'' },
    { id:'a020', time:'', title:'Travel Kanazawa to Tokyo', category:'transport', order:1, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'Kanazawa Station', notes:'~2.5 hrs via Kagayaki Shinkansen (Kanazawa → Tokyo direct)', driveUrl:'' },
    { id:'a021', time:'15:00', title:'Check in — Quintessa Hotel Tokyo Ginza', category:'hotel', order:2, cost:24713, currency:'JPY', status:'booked', done:false, confirmation:'6519361226', address:'Chuo-ku Ginza 4-11-4, Tokyo', notes:'PIN: 9235 · Hollywood Twin Room · Breakfast included · Tel: +81 3-6264-1351', driveUrl:'' }
  ]},
  { id:'2026-04-29', dayNum:15, city:'Tokyo — Los Angeles', hotel:'', activities:[
    { id:'a022', time:'11:00', title:'Check out — Quintessa Hotel Tokyo Ginza', category:'hotel', order:0, cost:0, currency:'JPY', status:'booked', done:false, confirmation:'', address:'Chuo-ku Ginza 4-11-4, Tokyo', notes:'Checkout by 11:00 · Breakfast included · Last morning in Japan', driveUrl:'' },
    { id:'a023', time:'18:10', title:'Depart Tokyo Haneda — United Flight UA38', category:'transport', order:1, cost:0, currency:'USD', status:'booked', done:false, confirmation:'F354LH', address:'Tokyo Haneda Airport (HND)', notes:'Seats 31J (Gwen) & 31L (Christina) · Boeing 787-10 Dreamliner · Duration 10h 5m · Arrives LAX 12:15pm same day', driveUrl:'' }
  ]}
];

const PACKING_SEED = { items: [
  { id:'pk001', text:'Passport (valid 6+ months from Apr 29)', category:'Documents', done:false },
  { id:'pk002', text:'Flight confirmations (F354LH)', category:'Documents', done:false },
  { id:'pk003', text:'All hotel confirmation numbers (printed or saved offline)', category:'Documents', done:false },
  { id:'pk004', text:'Travel insurance documents', category:'Documents', done:false },
  { id:'pk005', text:'Credit cards — notify bank of Japan travel dates', category:'Documents', done:false },
  { id:'pk006', text:'Phone + charger', category:'Tech', done:false },
  { id:'pk007', text:'Universal adapter (Japan uses Type A — same as US, no adapter needed!)', category:'Tech', done:false },
  { id:'pk008', text:'Portable battery pack', category:'Tech', done:false },
  { id:'pk009', text:'Camera + memory cards', category:'Tech', done:false },
  { id:'pk010', text:'Reserve pocket WiFi / WiFi egg to pick up at HND arrivals', category:'Tech', done:false },
  { id:'pk011', text:'Download Google Maps offline (Tokyo, Kyoto, Hakone, Kanazawa)', category:'Tech', done:false },
  { id:'pk012', text:'Comfortable walking shoes (expect 15,000+ steps/day)', category:'Clothes', done:false },
  { id:'pk013', text:'Light layers — April in Japan is 10–18°C (50–64°F)', category:'Clothes', done:false },
  { id:'pk014', text:'Rain jacket or compact umbrella', category:'Clothes', done:false },
  { id:'pk015', text:'Nicer outfit for ryokan dinner at Tensui Saryo', category:'Clothes', done:false },
  { id:'pk016', text:'Slip-on shoes (temples & ryokan require removing shoes constantly)', category:'Clothes', done:false },
  { id:'pk017', text:'Toiletries (hotels provide basics but bring your own)', category:'Toiletries', done:false },
  { id:'pk018', text:'Sunscreen', category:'Toiletries', done:false },
  { id:'pk019', text:'Prescription medications + copies of prescriptions', category:'Health', done:false },
  { id:'pk020', text:'Pain relievers, antacids, cold medicine', category:'Health', done:false },
  { id:'pk021', text:'Blister pads / moleskin — you will need these', category:'Health', done:false },
]};

const INFO_SEED = { sections: [
  { id:'inf001', title:'Emergency Numbers', content:'Police: 110\nFire / Ambulance: 119\nUS Embassy Tokyo: +81-3-3224-5000\nJapan Tourist Hotline (multilingual): 050-3816-2787' },
  { id:'inf002', title:'Getting Around', content:'Suica IC card: Get at Haneda arrivals or any JR station. Load ¥3,000–5,000. Works on most trains, buses, and even some convenience stores and vending machines.\n\nWiFi Egg: Rent at HND airport in the arrivals hall. Return it on departure day at the same desk.\n\nBest apps: Google Maps (most reliable for transit routing), Hyperdia or JR Navitime for Shinkansen times.' },
  { id:'inf003', title:'Money & Tipping', content:'Exchange rate: 1 USD ≈ 149 JPY (update in Budget tab)\nTipping: NOT customary in Japan — do not tip, it can be seen as rude.\nCash: Many smaller shops, temples, and restaurants are cash-only. Keep ¥10,000–20,000 on hand.\n7-Eleven and Japan Post ATMs accept foreign cards reliably.' },
  { id:'inf004', title:'Cultural Tips', content:'Remove shoes at ryokans, many traditional restaurants, and some temples.\nQueue politely — lines are taken very seriously.\nTrash cans are rare outdoors — carry a small bag.\nSpeak quietly on trains and public transit.\nTwo hands when giving or receiving business cards, gifts, or money.' },
  { id:'inf005', title:'Useful Apps', content:'Google Maps — download offline maps for all cities\nGoogle Translate — download Japanese offline language pack\nHyperdia / JR Navitime — train schedules and Shinkansen\nTabelog — restaurant reviews and ratings in Japan' },
]};


// ── FIREBASE ─────────────────────────────────────────────────
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();


// ── STATE ────────────────────────────────────────────────────
let currentUser   = null;
let currentView   = 'overview';
let currentDayId  = null;
let days          = {};
let packingData   = null;
let infoData      = null;
let unsubDays     = null;
let unsubMeta     = null;
let currentEditId    = null;
let currentInfoEditId = null;
let jpyRate = JPY_RATE_DEFAULT;


// ── CHERRY BLOSSOMS ──────────────────────────────────────────
(function initBlossoms() {
  const canvas = document.getElementById('blossom-canvas');
  const ctx    = canvas.getContext('2d');
  let petals   = [];
  const COUNT  = 36;

  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  window.addEventListener('resize', resize);
  resize();

  function mkPetal() {
    return { x: Math.random() * canvas.width, y: Math.random() * -canvas.height,
      size: Math.random() * 7 + 4, speedY: Math.random() * 1.1 + 0.35,
      speedX: Math.random() * 0.5 - 0.25, rot: Math.random() * Math.PI * 2,
      rotS: (Math.random() - 0.5) * 0.035, opacity: Math.random() * 0.4 + 0.18,
      sway: Math.random() * Math.PI * 2, swayS: Math.random() * 0.014 + 0.004,
      swayA: Math.random() * 1.1 + 0.35 };
  }

  for (let i = 0; i < COUNT; i++) { const p = mkPetal(); p.y = Math.random() * canvas.height * 1.4; petals.push(p); }

  function draw(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = p.opacity;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * 0.52, p.size, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f2a7b8';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(0, -p.size * 0.2, p.size * 0.2, p.size * 0.42, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fce4ec';
    ctx.fill();
    ctx.restore();
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    petals.forEach(p => {
      p.sway += p.swayS;
      p.x += Math.sin(p.sway) * p.swayA + p.speedX;
      p.y += p.speedY;
      p.rot += p.rotS;
      if (p.y > canvas.height + 20) { Object.assign(p, mkPetal()); p.y = -20; }
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
      showLoginError('This account is not authorized for this trip.');
      return;
    }
    currentUser = user;
    document.getElementById('user-avatar').src = user.photoURL || '';
    document.getElementById('user-name').textContent = (user.displayName || user.email).split(' ')[0];
    showApp();
    await initializeData();
    startListening();
  } else {
    currentUser = null;
    stopListening();
    showLogin();
  }
});

document.getElementById('sign-in-btn').addEventListener('click', () => {
  auth.signInWithPopup(new firebase.auth.GoogleAuthProvider())
    .catch(e => showLoginError(e.message));
});

function signOut() { stopListening(); auth.signOut(); }

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}
function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}
function showLoginError(msg) {
  let el = document.querySelector('.login-error');
  if (!el) { el = document.createElement('p'); el.className = 'login-error'; document.querySelector('.login-card').appendChild(el); }
  el.textContent = msg;
}


// ── DATA INIT ────────────────────────────────────────────────
async function initializeData() {
  document.getElementById('main-view').innerHTML = '<div class="loading-state"><div class="spinner"></div> Loading your trip...</div>';
  try {
    const snap = await db.collection('days').limit(1).get();
    if (snap.empty) {
      const batch = db.batch();
      SEED_DAYS.forEach(d => batch.set(db.collection('days').doc(d.id), d));
      await batch.commit();
    }
    const packSnap = await db.collection('meta').doc('packing').get();
    if (!packSnap.exists) await db.collection('meta').doc('packing').set(PACKING_SEED);
    const infoSnap = await db.collection('meta').doc('info').get();
    if (!infoSnap.exists) await db.collection('meta').doc('info').set(INFO_SEED);
  } catch (err) {
    document.getElementById('main-view').innerHTML = '<div class="loading-state" style="color:#c94040">Error loading data. Check Firestore rules.<br>' + err.message + '</div>';
  }
}


// ── REALTIME LISTENERS ───────────────────────────────────────
function startListening() {
  unsubDays = db.collection('days').orderBy('dayNum').onSnapshot(snap => {
    days = {};
    snap.forEach(doc => { days[doc.id] = doc.data(); });
    renderSidebar();
    if (currentView === 'itinerary' && currentDayId && days[currentDayId]) renderDay(currentDayId);
    else if (currentView === 'overview') renderOverview();
    else if (currentView === 'budget') renderBudgetView();
  }, err => console.error('Days listener:', err));

  unsubMeta = db.collection('meta').onSnapshot(snap => {
    snap.forEach(doc => {
      if (doc.id === 'packing') packingData = doc.data();
      if (doc.id === 'info')    infoData    = doc.data();
    });
    if (currentView === 'packing') renderPackingView();
    if (currentView === 'info')    renderInfoView();
  }, err => console.error('Meta listener:', err));
}

function stopListening() {
  if (unsubDays) { unsubDays(); unsubDays = null; }
  if (unsubMeta) { unsubMeta(); unsubMeta = null; }
}


// ── NAVIGATION ───────────────────────────────────────────────
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  if (view === 'overview') renderOverview();
  else if (view === 'budget')  renderBudgetView();
  else if (view === 'packing') renderPackingView();
  else if (view === 'info')    renderInfoView();
}

function jumpToToday() {
  const today = new Date().toISOString().split('T')[0];
  if (days[today]) {
    currentView = 'itinerary';
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    selectDay(today);
  } else {
    // Not in trip range — go to overview
    switchView('overview');
  }
}


// ── SIDEBAR ──────────────────────────────────────────────────
function renderSidebar() {
  const list = document.getElementById('day-list');
  list.innerHTML = '';
  Object.values(days).sort((a,b) => a.dayNum - b.dayNum).forEach(day => {
    const el   = document.createElement('div');
    const acts = (day.activities || []);
    const isTransit = TRANSIT_DAYS.has(day.id);
    el.className = 'day-item' + (day.id === currentDayId ? ' active' : '') + (isTransit ? ' transit' : '');
    el.dataset.id = day.id;

    const d   = new Date(day.id + 'T12:00:00');
    const ds  = d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
    const count = acts.length;
    const filled = Math.min(count, 5);
    const dots = Array.from({length:5}, (_,i) =>
      '<div class="density-dot' + (i < filled ? ' filled' : '') + '"></div>'
    ).join('');

    el.innerHTML = `
      <div class="day-item-num">D${day.dayNum}</div>
      <div class="day-item-info">
        <div class="day-item-date">${ds}</div>
        <div class="day-item-city">${day.city}</div>
      </div>
      <div class="day-item-dots">${dots}</div>`;
    el.addEventListener('click', () => { currentView = 'itinerary'; document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active')); selectDay(day.id); });
    list.appendChild(el);
  });
  renderSidebarBudget();
}

function renderSidebarBudget() {
  let jpy = 0, usd = 0;
  Object.values(days).forEach(d =>
    (d.activities || []).forEach(a => {
      if (a.cost > 0 && a.status !== 'idea') {
        if (a.currency === 'JPY') jpy += a.cost;
        else usd += a.cost;
      }
    })
  );
  const usdEst = (jpy / jpyRate + usd).toFixed(0);
  document.getElementById('budget-summary').innerHTML = `
    <div class="budget-row"><span>¥${Math.round(jpy).toLocaleString()}</span><span class="budget-label">JPY</span></div>
    ${usd > 0 ? '<div class="budget-row"><span>$' + usd.toLocaleString() + '</span><span class="budget-label">USD</span></div>' : ''}
    <div class="budget-usd-est">~$${parseInt(usdEst).toLocaleString()} USD total est.</div>`;
}


// ── OVERVIEW ─────────────────────────────────────────────────
function renderOverview() {
  const now        = new Date();
  const msPerDay   = 86400000;
  const daysUntil  = Math.ceil((TRIP_START - now) / msPerDay);
  const inTrip     = now >= TRIP_START && now <= TRIP_END;
  const tripOver   = now > TRIP_END;

  // Countdown section
  let countdownHtml = '';
  if (tripOver) {
    countdownHtml = `<div class="countdown-banner">
      <div class="countdown-banner-bg">帰</div>
      <div class="countdown-num" style="font-size:1.4rem">Trip complete!</div>
      <div class="countdown-label">Apr 15 – 29, 2026 · Japan</div>
    </div>`;
  } else if (inTrip) {
    const todayId = now.toISOString().split('T')[0];
    const todayDay = days[todayId];
    const dayNum = todayDay ? todayDay.dayNum : '?';
    countdownHtml = `<div class="countdown-banner">
      <div class="countdown-banner-bg">旅</div>
      <div class="countdown-top">
        <div><div class="countdown-num">Day ${dayNum}</div><div class="countdown-label">of 15 · You are in Japan!</div></div>
        <div class="countdown-dates"><div class="countdown-trip-label">Traveling</div><div class="countdown-trip-dates">Apr 15 – 29</div></div>
      </div>
      <div class="in-trip-msg"><a href="#" onclick="jumpToToday();return false;" style="color:rgba(255,255,255,0.7);text-decoration:none;border-bottom:1px solid rgba(255,255,255,0.3)">Jump to today</a></div>
    </div>`;
  } else {
    const planningDays = Math.ceil((TRIP_START - new Date('2026-01-01')) / msPerDay);
    const elapsed      = Math.ceil((now - new Date('2026-01-01')) / msPerDay);
    const pct          = Math.min(100, Math.round((elapsed / planningDays) * 100));
    countdownHtml = `<div class="countdown-banner">
      <div class="countdown-banner-bg">待</div>
      <div class="countdown-top">
        <div><div class="countdown-num">${daysUntil}</div><div class="countdown-label">days until departure</div></div>
        <div class="countdown-dates"><div class="countdown-trip-label">Departing</div><div class="countdown-trip-dates">Apr 15, 2026</div></div>
      </div>
      <div class="countdown-progress"><div class="countdown-bar" style="width:${pct}%"></div></div>
    </div>`;
  }

  // Flights
  const outAct = (days['2026-04-15']?.activities || []).find(a => a.category === 'transport');
  const retAct = (days['2026-04-29']?.activities || []).find(a => a.category === 'transport' && a.time === '18:10');
  const flightsHtml = `<div class="flights-card">
    <div class="section-label">Flights</div>
    <div class="flight-row">
      <div class="flight-direction">Out</div>
      <div class="flight-route">
        <div class="flight-num">UA39 · LAX → HND</div>
        <div class="flight-detail">Apr 15 · 11:20am LAX · Arrives Apr 16 3:05pm · Seats 31L / 31J</div>
      </div>
      <button class="flight-conf" onclick="copyText('F354LH', this)">F354LH</button>
    </div>
    <div class="flight-row">
      <div class="flight-direction">Return</div>
      <div class="flight-route">
        <div class="flight-num">UA38 · HND → LAX</div>
        <div class="flight-detail">Apr 29 · 6:10pm HND · Arrives same day 12:15pm · Seats 31J / 31L</div>
      </div>
      <button class="flight-conf" onclick="copyText('F354LH', this)">F354LH</button>
    </div>
  </div>`;

  // City cards
  const cityCardsHtml = CITY_GROUPS.map(g => {
    const totalActs = g.dayIds.reduce((s, id) => s + (days[id]?.activities?.length || 0), 0);
    const booked    = g.dayIds.reduce((s, id) =>
      s + (days[id]?.activities || []).filter(a => a.status === 'booked' && a.cost > 0).length, 0);
    const cost      = g.dayIds.reduce((s, id) =>
      s + (days[id]?.activities || []).filter(a => a.currency === 'JPY').reduce((x,a) => x + (a.cost||0), 0), 0);
    return `<div class="city-card" onclick="goToCity('${g.dayIds[0]}')">
      <div class="city-card-header" style="background:${g.bg}">
        <div class="city-card-kanji">${g.kanji}</div>
        <div class="city-card-name">${g.name}</div>
        ${g.sub ? '<div class="city-card-sub">' + g.sub + '</div>' : ''}
        <div class="city-card-dates">${g.dates}</div>
      </div>
      <div class="city-card-body">
        <div class="city-card-hotel">${g.hotel}</div>
        <div class="city-card-stats">
          <div class="city-stat"><span class="city-stat-num">${g.nights}</span><span class="city-stat-lbl">nights</span></div>
          <div class="city-stat"><span class="city-stat-num">${totalActs}</span><span class="city-stat-lbl">planned</span></div>
          ${cost > 0 ? '<div class="city-stat"><span class="city-stat-num">¥' + Math.round(cost/1000) + 'k</span><span class="city-stat-lbl">booked</span></div>' : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  document.getElementById('main-view').innerHTML = `
    ${countdownHtml}
    ${flightsHtml}
    <div class="section-label" style="margin-bottom:0.75rem">Cities</div>
    <div class="city-grid">${cityCardsHtml}</div>
  `;
}

function goToCity(firstDayId) {
  currentView = 'itinerary';
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  selectDay(firstDayId);
}


// ── DAY VIEW ─────────────────────────────────────────────────
function selectDay(dayId) {
  if (!dayId || !days[dayId]) return;
  currentDayId = dayId;
  document.querySelectorAll('.day-item').forEach(el => el.classList.toggle('active', el.dataset.id === dayId));
  renderDay(dayId);
}

function renderDay(dayId) {
  const day  = days[dayId];
  if (!day) return;
  const acts = [...(day.activities || [])].sort((a,b) => a.order - b.order);
  const d    = new Date(dayId + 'T12:00:00');
  const fullDate = d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
  const mapUrl   = 'https://www.google.com/maps/search/' + encodeURIComponent((day.hotel || day.city) + ' Japan');
  const isTransit = TRANSIT_DAYS.has(dayId);
  const badgeHtml = '<span class="day-type-badge ' + (isTransit ? 'day-type-transit' : 'day-type-explore') + '">' + (isTransit ? 'Transit day' : 'Explore day') + '</span>';

  document.getElementById('main-view').innerHTML = `
    <div class="day-header">
      <div>
        ${badgeHtml}
        <div class="day-header-num">Day ${day.dayNum} of ${Object.keys(days).length}</div>
        <h2 class="day-header-city">${day.city}</h2>
        <div class="day-header-date">${fullDate}</div>
        <a href="${mapUrl}" target="_blank" class="map-link">View on map</a>
      </div>
      ${day.hotel ? '<div class="day-header-hotel"><div class="hotel-label">Staying at</div>' + escHtml(day.hotel) + '</div>' : ''}
    </div>
    <div class="activities-list" id="activities-list">
      ${acts.length === 0 ? '<div class="empty-state">Nothing planned yet — add something below</div>'
        : acts.map(a => renderActivityCard(a)).join('')}
    </div>
    <button class="add-btn" onclick="openAddModal()">+ Add Activity</button>`;
  initDragDrop();
}

function renderActivityCard(act) {
  const cat   = CATEGORIES[act.category] || CATEGORIES.other;
  const color = cat.color;
  const bg    = color + '18';
  const isDone = act.done || false;
  const isIdea = (act.status || 'booked') === 'idea';

  const confirmHtml = act.confirmation
    ? `<div class="confirmation-row">
        <span class="confirmation-label">Conf.</span>
        <span class="confirmation-value">${escHtml(act.confirmation)}</span>
        <button class="copy-btn" onclick="copyText('${escAttr(act.confirmation)}', this)">Copy</button>
       </div>` : '';

  const addrHtml = act.address
    ? `<div class="address-row">
        <span class="address-value">${escHtml(act.address)}</span>
        <a href="https://www.google.com/maps/search/${encodeURIComponent(act.address)}" target="_blank" class="maps-btn">Maps</a>
       </div>` : '';

  let photoHtml = '';
  if (act.driveUrl && act.driveUrl.trim()) {
    const embed = driveUrlToEmbed(act.driveUrl.trim());
    if (embed) {
      photoHtml = `<div class="activity-drive-photo" onclick="openLightbox('${escAttr(embed)}','${escAttr(act.driveUrl)}')">
        <img src="${escAttr(embed)}" alt="Photo" loading="lazy" onerror="this.closest('.activity-drive-photo').style.display='none'">
        <div class="drive-photo-label">Google Drive photo</div>
      </div>`;
    }
  }

  return `<div class="activity-card${isDone ? ' done' : ''}${isIdea ? ' idea' : ''}" draggable="true" data-id="${act.id}">
    <div class="activity-timeline">
      <div class="activity-dot" style="background:${color}"></div>
      <div class="activity-line"></div>
    </div>
    <div class="activity-content">
      <div class="activity-header">
        <div class="activity-meta">
          ${act.time ? '<span class="activity-time">' + act.time + '</span>' : ''}
          <span class="activity-category-tag" style="background:${bg};color:${color}">${act.category}</span>
          ${isIdea ? '<span class="status-idea-tag">Idea</span>' : ''}
        </div>
        <div class="activity-actions">
          <button class="done-btn${isDone ? ' checked' : ''}" onclick="toggleDone('${act.id}')" title="${isDone ? 'Mark undone' : 'Mark done'}">${isDone ? '✓' : ''}</button>
          <button class="action-btn" onclick="openEditModal('${act.id}')">Edit</button>
          <button class="action-btn" onclick="deleteActivity('${act.id}')">Delete</button>
        </div>
      </div>
      <div class="activity-title">${escHtml(act.title)}</div>
      ${confirmHtml}
      ${addrHtml}
      ${act.notes ? '<div class="activity-notes">' + linkify(escHtml(act.notes)) + '</div>' : ''}
      ${act.cost > 0 ? '<span class="activity-cost">' + formatCost(act.cost, act.currency) + '</span>' : ''}
      ${photoHtml}
    </div>
  </div>`;
}


// ── DRAG & DROP ──────────────────────────────────────────────
function initDragDrop() {
  const cards = document.querySelectorAll('.activity-card');
  let draggedId = null;
  cards.forEach(card => {
    card.addEventListener('dragstart', e => { draggedId = card.dataset.id; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    card.addEventListener('dragend',   () => card.classList.remove('dragging'));
    card.addEventListener('dragover',  e => { e.preventDefault(); card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', async e => {
      e.preventDefault(); card.classList.remove('drag-over');
      const tid = card.dataset.id;
      if (!draggedId || draggedId === tid) return;
      let acts = [...(days[currentDayId]?.activities || [])];
      const fi = acts.findIndex(a => a.id === draggedId);
      const ti = acts.findIndex(a => a.id === tid);
      if (fi < 0 || ti < 0) return;
      const [mv] = acts.splice(fi, 1);
      acts.splice(ti, 0, mv);
      acts = acts.map((a,i) => ({...a, order:i}));
      await db.collection('days').doc(currentDayId).update({ activities: acts });
    });
  });
}


// ── ACTIVITY MODAL ───────────────────────────────────────────
function openAddModal() {
  currentEditId = null;
  document.getElementById('modal-title').textContent = 'Add Activity';
  ['form-time','form-title','form-confirmation','form-address','form-notes','form-cost','form-photo-url'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('form-category').value = 'activity';
  document.getElementById('form-status').value   = 'booked';
  document.getElementById('form-currency').value = 'JPY';
  document.getElementById('modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('form-title').focus(), 80);
}

function openEditModal(actId) {
  const act = (days[currentDayId]?.activities || []).find(a => a.id === actId);
  if (!act) return;
  currentEditId = actId;
  document.getElementById('modal-title').textContent         = 'Edit Activity';
  document.getElementById('form-time').value                 = act.time || '';
  document.getElementById('form-title').value                = act.title || '';
  document.getElementById('form-category').value             = act.category || 'activity';
  document.getElementById('form-status').value               = act.status || 'booked';
  document.getElementById('form-confirmation').value         = act.confirmation || '';
  document.getElementById('form-address').value              = act.address || '';
  document.getElementById('form-notes').value                = act.notes || '';
  document.getElementById('form-cost').value                 = act.cost || '';
  document.getElementById('form-currency').value             = act.currency || 'JPY';
  document.getElementById('form-photo-url').value            = act.driveUrl || '';
  document.getElementById('modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('form-title').focus(), 80);
}

function closeModal() { document.getElementById('modal').classList.add('hidden'); currentEditId = null; }
function handleModalOverlayClick(e) { if (e.target === document.getElementById('modal')) closeModal(); }

async function saveActivity() {
  const title = document.getElementById('form-title').value.trim();
  if (!title) { const i = document.getElementById('form-title'); i.style.borderColor = '#c94040'; i.focus(); return; }
  document.getElementById('form-title').style.borderColor = '';

  const data = {
    time: document.getElementById('form-time').value,
    title,
    category:     document.getElementById('form-category').value,
    status:       document.getElementById('form-status').value,
    confirmation: document.getElementById('form-confirmation').value.trim(),
    address:      document.getElementById('form-address').value.trim(),
    notes:        document.getElementById('form-notes').value.trim(),
    cost:         parseFloat(document.getElementById('form-cost').value) || 0,
    currency:     document.getElementById('form-currency').value,
    driveUrl:     document.getElementById('form-photo-url').value.trim(),
  };

  const btn = document.querySelector('.btn-save');
  btn.textContent = 'Saving...'; btn.disabled = true;
  try {
    let acts = [...(days[currentDayId]?.activities || [])];
    if (currentEditId) {
      const idx = acts.findIndex(a => a.id === currentEditId);
      if (idx >= 0) acts[idx] = { ...acts[idx], ...data };
    } else {
      acts.push({ id: 'act-' + Date.now(), done: false, order: acts.length, ...data });
    }
    await db.collection('days').doc(currentDayId).update({ activities: acts });
    closeModal();
  } catch (err) { alert('Error saving: ' + err.message); }
  finally { btn.textContent = 'Save'; btn.disabled = false; }
}

async function deleteActivity(actId) {
  if (!confirm('Delete this activity?')) return;
  const acts = (days[currentDayId]?.activities || []).filter(a => a.id !== actId);
  await db.collection('days').doc(currentDayId).update({ activities: acts });
}

async function toggleDone(actId) {
  let acts = [...(days[currentDayId]?.activities || [])];
  const idx = acts.findIndex(a => a.id === actId);
  if (idx < 0) return;
  acts[idx] = { ...acts[idx], done: !acts[idx].done };
  await db.collection('days').doc(currentDayId).update({ activities: acts });
}


// ── BUDGET VIEW ──────────────────────────────────────────────
function renderBudgetView() {
  let totalJPY = 0, totalUSD = 0;
  const byCat  = {};
  const byCity = CITY_GROUPS.map(g => ({ ...g, jpy: 0, usd: 0 }));

  Object.values(days).forEach(day => {
    (day.activities || []).filter(a => a.cost > 0 && a.status !== 'idea').forEach(act => {
      if (act.currency === 'JPY') { totalJPY += act.cost; byCat[act.category] = (byCat[act.category]||0) + act.cost; }
      else { totalUSD += act.cost; }
      // City attribution
      const city = byCity.find(g => g.dayIds.includes(day.id));
      if (city) { if (act.currency === 'JPY') city.jpy += act.cost; else city.usd += act.cost; }
    });
  });

  const usdEst  = (totalJPY / jpyRate + totalUSD).toFixed(0);
  const maxCat  = Math.max(...Object.values(byCat), 1);

  const catBarsHtml = Object.entries(CATEGORIES).map(([key, val]) => {
    const amt = byCat[key] || 0;
    if (!amt) return '';
    const pct = Math.round((amt / maxCat) * 100);
    return `<div class="cat-bar-row">
      <span class="cat-bar-label">${key}</span>
      <div class="cat-bar-track"><div class="cat-bar-fill" style="width:${pct}%;background:${val.color}"></div></div>
      <span class="cat-bar-amt">¥${Math.round(amt).toLocaleString()}</span>
    </div>`;
  }).filter(Boolean).join('');

  const cityRowsHtml = byCity.filter(g => g.jpy > 0 || g.usd > 0).map(g =>
    `<div class="city-cost-row">
      <span class="city-cost-name">${g.name}${g.sub ? ' · ' + g.sub : ''}</span>
      <span class="city-cost-nights">${g.nights}n</span>
      <span class="city-cost-amt">¥${Math.round(g.jpy).toLocaleString()}${g.usd > 0 ? ' + $' + g.usd : ''}</span>
    </div>`
  ).join('');

  document.getElementById('main-view').innerHTML = `
    <div class="view-header">
      <div class="view-title">Budget</div>
      <div class="view-subtitle">Booked expenses only. Ideas not included.</div>
    </div>
    <div class="rate-control">
      <span>Exchange rate: 1 USD =</span>
      <input type="number" class="rate-input" id="jpy-rate-input" value="${jpyRate}" min="100" max="200">
      <span>JPY</span>
    </div>
    <div class="budget-totals">
      <div class="budget-total-card">
        <div class="budget-total-num">¥${Math.round(totalJPY).toLocaleString()}</div>
        <div class="budget-total-lbl">Total in JPY</div>
      </div>
      <div class="budget-total-card accent">
        <div class="budget-total-num">~$${parseInt(usdEst).toLocaleString()}</div>
        <div class="budget-total-lbl">USD estimate</div>
      </div>
    </div>
    <div class="budget-section-title">By Category</div>
    <div class="category-bars">${catBarsHtml || '<span style="color:var(--text-light);font-size:0.82rem">No booked costs yet</span>'}</div>
    <div class="budget-section-title">By City</div>
    <div class="city-cost-table">${cityRowsHtml || '<div style="padding:1rem;color:var(--text-light);font-size:0.82rem">No costs recorded yet</div>'}</div>
  `;

  document.getElementById('jpy-rate-input').addEventListener('change', e => {
    const val = parseFloat(e.target.value);
    if (val > 0) { jpyRate = val; renderBudgetView(); renderSidebarBudget(); }
  });
}


// ── PACKING VIEW ─────────────────────────────────────────────
function renderPackingView() {
  if (!packingData) { document.getElementById('main-view').innerHTML = '<div class="loading-state"><div class="spinner"></div></div>'; return; }
  const items = packingData.items || [];
  const done  = items.filter(i => i.done).length;
  const cats  = [...new Set(items.map(i => i.category))];

  const progressHtml = `<div class="packing-progress">
    <div class="packing-progress-track"><div class="packing-progress-fill" style="width:${items.length ? Math.round((done/items.length)*100) : 0}%"></div></div>
    <span class="packing-progress-text">${done} / ${items.length} packed</span>
  </div>`;

  const groupsHtml = cats.map(cat => {
    const catItems = items.filter(i => i.category === cat);
    const catDone  = catItems.filter(i => i.done).length;
    const itemsHtml = catItems.map(item => `
      <div class="packing-item${item.done ? ' done' : ''}" data-id="${item.id}">
        <input type="checkbox" class="packing-check" ${item.done ? 'checked' : ''} onchange="togglePackingItem('${item.id}')">
        <span class="packing-text">${escHtml(item.text)}</span>
        <button class="packing-delete" onclick="deletePackingItem('${item.id}')" title="Remove">✕</button>
      </div>`).join('');
    return `<div class="packing-cat-group">
      <div class="packing-cat-header">
        <span class="packing-cat-name">${cat}</span>
        <span class="packing-cat-count">${catDone}/${catItems.length}</span>
      </div>
      ${itemsHtml}
      <div class="packing-add-row">
        <input type="text" class="packing-add-input" placeholder="Add item to ${cat}..." data-cat="${cat}" onkeydown="handlePackingEnter(event)">
        <button class="packing-add-btn" onclick="addPackingItem(this.previousElementSibling)">Add</button>
      </div>
    </div>`;
  }).join('');

  document.getElementById('main-view').innerHTML = `
    <div class="view-header">
      <div class="view-title">Packing List</div>
      <div class="view-subtitle">Check things off as you pack. Updates for both of you.</div>
    </div>
    ${progressHtml}
    ${groupsHtml}`;
}

function handlePackingEnter(e) {
  if (e.key === 'Enter') addPackingItem(e.target);
}

async function togglePackingItem(id) {
  const items = (packingData?.items || []).map(i => i.id === id ? {...i, done: !i.done} : i);
  await db.collection('meta').doc('packing').update({ items });
}

async function addPackingItem(input) {
  const text = input.value.trim();
  const cat  = input.dataset.cat;
  if (!text) return;
  const items = [...(packingData?.items || [])];
  items.push({ id: 'pk-' + Date.now(), text, category: cat, done: false });
  await db.collection('meta').doc('packing').update({ items });
  input.value = '';
}

async function deletePackingItem(id) {
  const items = (packingData?.items || []).filter(i => i.id !== id);
  await db.collection('meta').doc('packing').update({ items });
}


// ── TRIP INFO VIEW ───────────────────────────────────────────
function renderInfoView() {
  if (!infoData) { document.getElementById('main-view').innerHTML = '<div class="loading-state"><div class="spinner"></div></div>'; return; }
  const sections = infoData.sections || [];
  const cardsHtml = sections.map(s => `
    <div class="info-section-card">
      <div class="info-section-header">
        <span class="info-section-title">${escHtml(s.title)}</span>
        <div class="info-section-actions">
          <button class="action-btn" onclick="openInfoEditModal('${s.id}')">Edit</button>
          <button class="action-btn" onclick="deleteInfoSection('${s.id}')">Delete</button>
        </div>
      </div>
      <div class="info-section-content">${linkify(escHtml(s.content))}</div>
    </div>`).join('');

  document.getElementById('main-view').innerHTML = `
    <div class="view-header">
      <div class="view-title">Trip Info</div>
      <div class="view-subtitle">Key details, tips, and emergency contacts.</div>
    </div>
    ${cardsHtml}
    <button class="add-section-btn" onclick="openInfoAddModal()">+ Add Section</button>`;
}

function openInfoAddModal() {
  currentInfoEditId = null;
  document.getElementById('info-modal-title').textContent = 'Add Section';
  document.getElementById('info-form-title').value   = '';
  document.getElementById('info-form-content').value = '';
  document.getElementById('info-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('info-form-title').focus(), 80);
}

function openInfoEditModal(id) {
  const s = (infoData?.sections || []).find(x => x.id === id);
  if (!s) return;
  currentInfoEditId = id;
  document.getElementById('info-modal-title').textContent = 'Edit Section';
  document.getElementById('info-form-title').value   = s.title;
  document.getElementById('info-form-content').value = s.content;
  document.getElementById('info-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('info-form-title').focus(), 80);
}

function closeInfoModal() { document.getElementById('info-modal').classList.add('hidden'); currentInfoEditId = null; }
function handleInfoModalOverlayClick(e) { if (e.target === document.getElementById('info-modal')) closeInfoModal(); }

async function saveInfoSection() {
  const title   = document.getElementById('info-form-title').value.trim();
  const content = document.getElementById('info-form-content').value.trim();
  if (!title) { document.getElementById('info-form-title').style.borderColor = '#c94040'; return; }
  document.getElementById('info-form-title').style.borderColor = '';
  let sections = [...(infoData?.sections || [])];
  if (currentInfoEditId) {
    const idx = sections.findIndex(s => s.id === currentInfoEditId);
    if (idx >= 0) sections[idx] = { ...sections[idx], title, content };
  } else {
    sections.push({ id: 'inf-' + Date.now(), title, content });
  }
  await db.collection('meta').doc('info').update({ sections });
  closeInfoModal();
}

async function deleteInfoSection(id) {
  if (!confirm('Delete this section?')) return;
  const sections = (infoData?.sections || []).filter(s => s.id !== id);
  await db.collection('meta').doc('info').update({ sections });
}


// ── LIGHTBOX ─────────────────────────────────────────────────
function openLightbox(imgUrl, driveLink) {
  document.getElementById('lightbox-img').src   = imgUrl;
  document.getElementById('lightbox-link').href = driveLink || imgUrl;
  document.getElementById('lightbox').classList.remove('hidden');
}
function closeLightbox() {
  document.getElementById('lightbox').classList.add('hidden');
  document.getElementById('lightbox-img').src = '';
}


// ── KEYBOARD ─────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeLightbox(); closeInfoModal(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    if (!document.getElementById('modal').classList.contains('hidden')) saveActivity();
    if (!document.getElementById('info-modal').classList.contains('hidden')) saveInfoSection();
  }
});


// ── DRIVE HELPERS ─────────────────────────────────────────────
function driveFileId(url) {
  if (!url) return null;
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);      if (m2) return m2[1];
  const m3 = url.match(/open\?id=([a-zA-Z0-9_-]+)/);    if (m3) return m3[1];
  return null;
}
function driveUrlToEmbed(url) { const id = driveFileId(url); return id ? 'https://drive.google.com/thumbnail?id=' + id + '&sz=w480' : null; }


// ── UTILS ─────────────────────────────────────────────────────
function formatCost(cost, currency) {
  return currency === 'JPY' ? '¥' + Math.round(cost).toLocaleString() : '$' + cost.toFixed(2);
}
function escHtml(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/\n/g,'<br>');
}
function escAttr(s) {
  if (!s) return '';
  return s.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function linkify(s) {
  return s.replace(/(https?:\/\/[^\s<"']+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}
async function copyText(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1800);
  } catch { /* fallback: do nothing */ }
}
