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
  appId: "1:661642949404:web:c6a554f3c243171d5a00d9",
  measurementId: "G-BTCE13YE8R"
};

const ALLOWED_EMAILS = ['ghstilson@gmail.com', 'cmelikian@gmail.com'];

const CATEGORIES = {
  activity:  { color: '#10b981' },
  transport: { color: '#3b82f6' },
  hotel:     { color: '#8b5cf6' },
  food:      { color: '#f59e0b' },
  shopping:  { color: '#ec4899' },
  other:     { color: '#6b7280' },
};

// ── SEED DATA ────────────────────────────────────────────────
const SEED_DATA = [
  {
    id: '2026-04-15', dayNum: 1, city: 'Los Angeles', hotel: '',
    activities: [
      { id: 'a001', time: '11:20', title: 'Depart LAX — United Flight UA39', category: 'transport', order: 0, cost: 0, currency: 'USD', driveUrl: '',
        notes: 'Seats 31L (Gwen) & 31J (Christina) · Confirmation: F354LH · Boeing 787-10 Dreamliner · Duration 11h 45m' }
    ]
  },
  {
    id: '2026-04-16', dayNum: 2, city: 'Tokyo — Shinjuku', hotel: 'Hotel Gracery Shinjuku',
    activities: [
      { id: 'a002', time: '15:05', title: 'Arrive Tokyo Haneda (HND)', category: 'transport', order: 0, cost: 0, currency: 'JPY', driveUrl: '',
        notes: 'Flight UA39 · Take Keikyu Line or Airport Limousine Bus to Shinjuku (~1 hr)' },
      { id: 'a003', time: '17:00', title: 'Check in — Hotel Gracery Shinjuku', category: 'hotel', order: 1, cost: 200692, currency: 'JPY', driveUrl: '',
        notes: 'Confirmation: 5594.831.309 · PIN: 6506 · Standard Twin Room · Check-in from 14:00 · Kabukicho 1-19-1, Shinjuku · Tel: +81 3 6833 1111' }
    ]
  },
  {
    id: '2026-04-17', dayNum: 3, city: 'Tokyo — Shinjuku', hotel: 'Hotel Gracery Shinjuku',
    activities: [
      { id: 'a004', time: '08:30', title: 'teamLab Borderless: MORI Building Digital Art Museum', category: 'activity', order: 0, cost: 11200, currency: 'JPY', driveUrl: '',
        notes: 'Ticket: A7YRA4LXWCN3-0001 · Entry 08:30–09:00 · Azabudai Hills Garden Plaza B, B1, 5-9 Toranomon, Minato-ku · Arrive early!' }
    ]
  },
  { id: '2026-04-18', dayNum: 4, city: 'Tokyo — Shinjuku', hotel: 'Hotel Gracery Shinjuku', activities: [] },
  { id: '2026-04-19', dayNum: 5, city: 'Tokyo — Shinjuku', hotel: 'Hotel Gracery Shinjuku', activities: [] },
  {
    id: '2026-04-20', dayNum: 6, city: 'Hakone', hotel: 'Tensui Saryo',
    activities: [
      { id: 'a005', time: '08:30', title: 'Fuji-Excursion 7 — Shinjuku to Kawaguchiko', category: 'transport', order: 0, cost: 8400, currency: 'JPY', driveUrl: '',
        notes: 'Reservation: E77821 · Pickup code: 24492390994521288 · Car 3, Seats 13-C & 13-D · Arrives Kawaguchiko 10:26 · Pick up tickets at the station first!' },
      { id: 'a006', time: '10:26', title: 'Arrive Kawaguchiko — Mt. Fuji area', category: 'transport', order: 1, cost: 0, currency: 'JPY', driveUrl: '',
        notes: 'Explore Fuji Five Lakes area before heading south to Hakone' },
      { id: 'a007', time: '15:00', title: 'Check in — Tensui Saryo Ryokan', category: 'hotel', order: 2, cost: 126340, currency: 'JPY', driveUrl: '',
        notes: 'Reservation: IK1516984808 · Check-in 15:00–21:30, estimated arrival 17:30 · Detached room, private open-air onsen · 1320-276 Gora, Hakone · 2–3 min walk from Gora Station' },
      { id: 'a008', time: '19:45', title: 'Kaiseki Dinner — Tensui Saryo', category: 'food', order: 3, cost: 0, currency: 'JPY', driveUrl: '',
        notes: 'Included in stay · Basic Kaiseki dinner · Selected time slot: 19:45' }
    ]
  },
  {
    id: '2026-04-21', dayNum: 7, city: 'Hakone', hotel: 'Tensui Saryo',
    activities: [
      { id: 'a009', time: '', title: 'Breakfast — Tensui Saryo', category: 'food', order: 0, cost: 0, currency: 'JPY', driveUrl: '', notes: 'Included in stay' },
      { id: 'a010', time: '', title: 'Free day in Hakone', category: 'activity', order: 1, cost: 0, currency: 'JPY', driveUrl: '',
        notes: 'Ideas: Hakone Open-Air Museum, Lake Ashi boat cruise, Owakudani volcanic valley, Hakone Shrine, Hakone Ropeway' }
    ]
  },
  {
    id: '2026-04-22', dayNum: 8, city: 'Kyoto', hotel: 'Hotel Granvia Kyoto',
    activities: [
      { id: 'a011', time: '10:00', title: 'Check out — Tensui Saryo', category: 'hotel', order: 0, cost: 0, currency: 'JPY', driveUrl: '',
        notes: 'Checkout by 10:00 · Hot Spring Tax: ¥150 per person due at checkout' },
      { id: 'a012', time: '10:11', title: 'Shinkansen Hikari 637 — Odawara to Kyoto', category: 'transport', order: 1, cost: 23800, currency: 'JPY', driveUrl: '',
        notes: 'Reservation: 2002 · Smart EX · Series N700 · Ordinary class · 2 adults · Arrives Kyoto 12:12 · Note: Odawara is ~40 min from Gora by train' },
      { id: 'a013', time: '12:12', title: 'Arrive Kyoto Station', category: 'transport', order: 2, cost: 0, currency: 'JPY', driveUrl: '',
        notes: 'Hotel Granvia is directly connected to Kyoto Station — no travel needed!' },
      { id: 'a014', time: '15:00', title: 'Check in — Hotel Granvia Kyoto', category: 'hotel', order: 3, cost: 268256, currency: 'JPY', driveUrl: '',
        notes: 'Confirmation: 23151SF060529 · Granvia Deluxe Twin Room · 4 nights Apr 22–26 · JR Kyoto Eki Karasuma, 600-8216 Kyoto · Tel: +81-75-344-8888' }
    ]
  },
  { id: '2026-04-23', dayNum: 9,  city: 'Kyoto', hotel: 'Hotel Granvia Kyoto', activities: [] },
  { id: '2026-04-24', dayNum: 10, city: 'Kyoto', hotel: 'Hotel Granvia Kyoto', activities: [] },
  { id: '2026-04-25', dayNum: 11, city: 'Kyoto', hotel: 'Hotel Granvia Kyoto', activities: [] },
  {
    id: '2026-04-26', dayNum: 12, city: 'Kanazawa', hotel: 'Hotel INTERGATE Kanazawa',
    activities: [
      { id: 'a015', time: '11:00', title: 'Check out — Hotel Granvia Kyoto', category: 'hotel', order: 0, cost: 0, currency: 'JPY', driveUrl: '', notes: 'Checkout by 11:00' },
      { id: 'a016', time: '', title: 'Travel Kyoto to Kanazawa', category: 'transport', order: 1, cost: 0, currency: 'JPY', driveUrl: '',
        notes: '~2.5 hrs via Thunderbird limited express (Kyoto to Kanazawa direct) · Book separately!' },
      { id: 'a017', time: '15:00', title: 'Check in — Hotel INTERGATE Kanazawa', category: 'hotel', order: 2, cost: 39004, currency: 'JPY', driveUrl: '',
        notes: 'Confirmation: 20260125110822242 · Expedia: 73356721260247 · Superior Twin, Breakfast Buffet included · 2-5 Takaokamachi, Kanazawa 920-0864' }
    ]
  },
  {
    id: '2026-04-27', dayNum: 13, city: 'Kanazawa', hotel: 'Hotel INTERGATE Kanazawa',
    activities: [
      { id: 'a018', time: '', title: 'Free day in Kanazawa', category: 'activity', order: 0, cost: 0, currency: 'JPY', driveUrl: '',
        notes: 'Ideas: Kenroku-en Garden (top 3 in Japan!), Kanazawa Castle, Higashi Chaya geisha district, Omicho Market, 21st Century Museum of Contemporary Art' }
    ]
  },
  {
    id: '2026-04-28', dayNum: 14, city: 'Tokyo — Ginza', hotel: 'Quintessa Hotel Tokyo Ginza',
    activities: [
      { id: 'a019', time: '11:00', title: 'Check out — Hotel INTERGATE Kanazawa', category: 'hotel', order: 0, cost: 0, currency: 'JPY', driveUrl: '', notes: 'Checkout by 11:00 · Enjoy the breakfast buffet first!' },
      { id: 'a020', time: '', title: 'Travel Kanazawa to Tokyo', category: 'transport', order: 1, cost: 0, currency: 'JPY', driveUrl: '',
        notes: '~2.5 hrs via Kagayaki Shinkansen (Kanazawa to Tokyo direct) · Opened 2024!' },
      { id: 'a021', time: '15:00', title: 'Check in — Quintessa Hotel Tokyo Ginza', category: 'hotel', order: 2, cost: 24713, currency: 'JPY', driveUrl: '',
        notes: 'Confirmation: 6519361226 · PIN: 9235 · Hollywood Twin Room · Breakfast included · Chuo-ku Ginza 4-11-4, Tokyo · Tel: +81 3-6264-1351' }
    ]
  },
  {
    id: '2026-04-29', dayNum: 15, city: 'Tokyo — Los Angeles', hotel: '',
    activities: [
      { id: 'a022', time: '11:00', title: 'Check out — Quintessa Hotel Tokyo Ginza', category: 'hotel', order: 0, cost: 0, currency: 'JPY', driveUrl: '', notes: 'Checkout by 11:00 · Breakfast included · Last morning in Japan' },
      { id: 'a023', time: '18:10', title: 'Depart Tokyo Haneda — United Flight UA38', category: 'transport', order: 1, cost: 0, currency: 'USD', driveUrl: '',
        notes: 'Seats 31J (Gwen) & 31L (Christina) · Boeing 787-10 Dreamliner · Duration 10h 5m · Arrives LAX 12:15pm same day' }
    ]
  }
];


// ── FIREBASE INIT ────────────────────────────────────────────
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ── STATE ────────────────────────────────────────────────────
let currentUser   = null;
let currentDayId  = null;
let days          = {};
let unsubListener = null;
let currentEditId = null;


// ── CHERRY BLOSSOM ANIMATION ─────────────────────────────────
(function initBlossoms() {
  const canvas = document.getElementById('blossom-canvas');
  const ctx    = canvas.getContext('2d');
  let petals   = [];
  const COUNT  = 38;

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function makePetal() {
    return {
      x:       Math.random() * canvas.width,
      y:       Math.random() * -canvas.height,
      size:    Math.random() * 7 + 5,
      speedY:  Math.random() * 1.2 + 0.4,
      speedX:  Math.random() * 0.6 - 0.3,
      rot:     Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.04,
      opacity: Math.random() * 0.45 + 0.2,
      sway:    Math.random() * Math.PI * 2,
      swaySpeed: Math.random() * 0.015 + 0.005,
      swayAmp:   Math.random() * 1.2 + 0.4,
    };
  }

  // Stagger initial positions so they're already falling
  for (let i = 0; i < COUNT; i++) {
    const p = makePetal();
    p.y = Math.random() * canvas.height * 1.5;
    petals.push(p);
  }

  function drawPetal(p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = p.opacity;
    // Simple ellipse petal shape
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * 0.55, p.size, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f2a7b8';
    ctx.fill();
    // Inner highlight
    ctx.beginPath();
    ctx.ellipse(0, -p.size * 0.2, p.size * 0.22, p.size * 0.45, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fce4ec';
    ctx.fill();
    ctx.restore();
  }

  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    petals.forEach(p => {
      p.sway    += p.swaySpeed;
      p.x       += Math.sin(p.sway) * p.swayAmp + p.speedX;
      p.y       += p.speedY;
      p.rot     += p.rotSpeed;

      if (p.y > canvas.height + 20) {
        Object.assign(p, makePetal());
        p.y = -20;
      }
      drawPetal(p);
    });
    requestAnimationFrame(tick);
  }
  tick();
})();


// ── AUTH ─────────────────────────────────────────────────────
auth.onAuthStateChanged(async (user) => {
  if (user) {
    if (!ALLOWED_EMAILS.includes(user.email.toLowerCase())) {
      await auth.signOut();
      showLoginError('This account is not authorized for this trip.');
      return;
    }
    currentUser = user;
    const avatar = document.getElementById('user-avatar');
    const name   = document.getElementById('user-name');
    if (user.photoURL) avatar.src = user.photoURL;
    name.textContent = user.displayName ? user.displayName.split(' ')[0] : user.email;
    showApp();
    await initializeData();
    startListening();
  } else {
    currentUser = null;
    if (unsubListener) { unsubListener(); unsubListener = null; }
    showLogin();
  }
});

document.getElementById('sign-in-btn').addEventListener('click', () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(err => showLoginError(err.message));
});

function signOut() {
  if (unsubListener) { unsubListener(); unsubListener = null; }
  auth.signOut();
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}
function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
}
function showLoginError(msg) {
  let err = document.querySelector('.login-error');
  if (!err) {
    err = document.createElement('p');
    err.className = 'login-error';
    document.querySelector('.login-card').appendChild(err);
  }
  err.textContent = msg;
}


// ── DATA INIT ────────────────────────────────────────────────
async function initializeData() {
  document.getElementById('day-content').innerHTML =
    `<div class="loading-state"><div class="spinner"></div> Loading your trip...</div>`;
  try {
    const snap = await db.collection('days').limit(1).get();
    if (snap.empty) await seedData();
  } catch (err) {
    document.getElementById('day-content').innerHTML =
      `<div class="loading-state" style="color:#c94040">Error: ${err.message}</div>`;
  }
}

async function seedData() {
  const batch = db.batch();
  SEED_DATA.forEach(day => batch.set(db.collection('days').doc(day.id), day));
  await batch.commit();
}


// ── REALTIME LISTENER ────────────────────────────────────────
function startListening() {
  unsubListener = db.collection('days').orderBy('dayNum').onSnapshot((snap) => {
    days = {};
    snap.forEach(doc => { days[doc.id] = doc.data(); });
    renderSidebar();
    if (currentDayId && days[currentDayId]) {
      renderDay(currentDayId);
    } else {
      const today   = new Date().toISOString().split('T')[0];
      const firstId = Object.keys(days).sort()[0];
      selectDay(days[today] ? today : firstId);
    }
  }, err => {
    document.getElementById('day-content').innerHTML =
      `<div class="loading-state" style="color:#c94040">Connection error: ${err.message}</div>`;
  });
}


// ── SIDEBAR ──────────────────────────────────────────────────
function renderSidebar() {
  const list   = document.getElementById('day-list');
  list.innerHTML = '';
  Object.values(days).sort((a,b) => a.dayNum - b.dayNum).forEach(day => {
    const item = document.createElement('div');
    item.className = `day-item${day.id === currentDayId ? ' active' : ''}`;
    item.dataset.id = day.id;
    const d       = new Date(day.id + 'T12:00:00');
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    item.innerHTML = `
      <div class="day-item-num">Day ${day.dayNum}</div>
      <div class="day-item-info">
        <div class="day-item-date">${dateStr}</div>
        <div class="day-item-city">${day.city}</div>
      </div>`;
    item.addEventListener('click', () => selectDay(day.id));
    list.appendChild(item);
  });
  renderBudget();
}

function selectDay(dayId) {
  if (!dayId || !days[dayId]) return;
  currentDayId = dayId;
  document.querySelectorAll('.day-item').forEach(el =>
    el.classList.toggle('active', el.dataset.id === dayId));
  renderDay(dayId);
}


// ── DAY VIEW ─────────────────────────────────────────────────
function renderDay(dayId) {
  const day  = days[dayId];
  if (!day) return;
  const acts = [...(day.activities || [])].sort((a,b) => a.order - b.order);
  const d    = new Date(dayId + 'T12:00:00');
  const fullDate = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const mapUrl   = `https://www.google.com/maps/search/${encodeURIComponent((day.hotel || day.city) + ' Japan')}`;

  document.getElementById('day-content').innerHTML = `
    <div class="day-header">
      <div class="day-header-left">
        <div class="day-header-num">Day ${day.dayNum} of ${Object.keys(days).length}</div>
        <h2 class="day-header-city">${day.city}</h2>
        <div class="day-header-date">${fullDate}</div>
        <a href="${mapUrl}" target="_blank" class="map-link">View on map</a>
      </div>
      ${day.hotel ? `
        <div class="day-header-hotel">
          <div class="hotel-label">Staying at</div>
          ${escHtml(day.hotel)}
        </div>` : ''}
    </div>
    <div class="activities-list" id="activities-list">
      ${acts.length === 0
        ? '<div class="empty-state">Nothing planned yet — add something below</div>'
        : acts.map(act => renderActivityCard(act)).join('')}
    </div>
    <button class="add-btn" onclick="openAddModal()">+ Add Activity</button>
  `;
  initDragDrop();
}

function renderActivityCard(act) {
  const cat   = CATEGORIES[act.category] || CATEGORIES.other;
  const color = cat.color;
  const bgHex = color + '18';

  // Google Drive preview: convert share URL to direct embed URL
  let photoHtml = '';
  if (act.driveUrl && act.driveUrl.trim()) {
    const embedUrl  = driveUrlToEmbed(act.driveUrl.trim());
    const directUrl = driveUrlToDirect(act.driveUrl.trim());
    if (embedUrl) {
      photoHtml = `
        <div class="activity-drive-photo" onclick="openLightbox('${escAttr(directUrl)}','${escAttr(act.driveUrl)}')">
          <img src="${escAttr(embedUrl)}" alt="Photo" loading="lazy" onerror="this.closest('.activity-drive-photo').style.display='none'">
          <div class="drive-photo-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Google Drive photo
          </div>
        </div>`;
    }
  }

  return `
    <div class="activity-card" draggable="true" data-id="${act.id}">
      <div class="activity-timeline">
        <div class="activity-dot" style="background:${color}"></div>
        <div class="activity-line"></div>
      </div>
      <div class="activity-content">
        <div class="activity-header">
          <div class="activity-meta">
            ${act.time ? `<span class="activity-time">${act.time}</span>` : ''}
            <span class="activity-category-tag" style="background:${bgHex};color:${color}">${act.category}</span>
          </div>
          <div class="activity-actions">
            <button class="action-btn" onclick="openEditModal('${act.id}')">Edit</button>
            <button class="action-btn" onclick="deleteActivity('${act.id}')">Delete</button>
          </div>
        </div>
        <div class="activity-title">${escHtml(act.title)}</div>
        ${act.notes ? `<div class="activity-notes">${linkify(escHtml(act.notes))}</div>` : ''}
        ${act.cost > 0 ? `<span class="activity-cost">${formatCost(act.cost, act.currency)}</span>` : ''}
        ${photoHtml}
      </div>
    </div>`;
}


// ── DRAG & DROP ──────────────────────────────────────────────
function initDragDrop() {
  const cards   = document.querySelectorAll('.activity-card');
  let draggedId = null;

  cards.forEach(card => {
    card.addEventListener('dragstart', (e) => {
      draggedId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      card.classList.add('drag-over');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', async (e) => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const targetId = card.dataset.id;
      if (!draggedId || draggedId === targetId) return;
      const day  = days[currentDayId];
      let acts   = [...(day.activities || [])];
      const fi   = acts.findIndex(a => a.id === draggedId);
      const ti   = acts.findIndex(a => a.id === targetId);
      if (fi === -1 || ti === -1) return;
      const [moved] = acts.splice(fi, 1);
      acts.splice(ti, 0, moved);
      acts = acts.map((a, i) => ({ ...a, order: i }));
      await db.collection('days').doc(currentDayId).update({ activities: acts });
    });
  });
}


// ── MODAL ────────────────────────────────────────────────────
function openAddModal() {
  currentEditId = null;
  document.getElementById('modal-title').textContent   = 'Add Activity';
  document.getElementById('form-time').value           = '';
  document.getElementById('form-title').value          = '';
  document.getElementById('form-category').value       = 'activity';
  document.getElementById('form-notes').value          = '';
  document.getElementById('form-cost').value           = '';
  document.getElementById('form-currency').value       = 'JPY';
  document.getElementById('form-photo-url').value      = '';
  document.getElementById('modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('form-title').focus(), 80);
}

function openEditModal(actId) {
  const act = (days[currentDayId]?.activities || []).find(a => a.id === actId);
  if (!act) return;
  currentEditId = actId;
  document.getElementById('modal-title').textContent   = 'Edit Activity';
  document.getElementById('form-time').value           = act.time || '';
  document.getElementById('form-title').value          = act.title || '';
  document.getElementById('form-category').value       = act.category || 'activity';
  document.getElementById('form-notes').value          = act.notes || '';
  document.getElementById('form-cost').value           = act.cost || '';
  document.getElementById('form-currency').value       = act.currency || 'JPY';
  document.getElementById('form-photo-url').value      = act.driveUrl || '';
  document.getElementById('modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('form-title').focus(), 80);
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
  currentEditId = null;
}

function handleModalOverlayClick(e) {
  if (e.target === document.getElementById('modal')) closeModal();
}

async function saveActivity() {
  const time     = document.getElementById('form-time').value;
  const title    = document.getElementById('form-title').value.trim();
  const category = document.getElementById('form-category').value;
  const notes    = document.getElementById('form-notes').value.trim();
  const cost     = parseFloat(document.getElementById('form-cost').value) || 0;
  const currency = document.getElementById('form-currency').value;
  const driveUrl = document.getElementById('form-photo-url').value.trim();

  if (!title) {
    const inp = document.getElementById('form-title');
    inp.style.borderColor = '#c94040';
    inp.focus();
    return;
  }
  document.getElementById('form-title').style.borderColor = '';

  const btn = document.querySelector('.btn-save');
  btn.textContent = 'Saving...';
  btn.disabled    = true;

  try {
    const day  = days[currentDayId];
    let acts   = [...(day.activities || [])];

    if (currentEditId) {
      const idx = acts.findIndex(a => a.id === currentEditId);
      if (idx !== -1) acts[idx] = { ...acts[idx], time, title, category, notes, cost, currency, driveUrl };
    } else {
      acts.push({ id: 'act-' + Date.now(), time, title, category, notes, cost, currency, driveUrl, order: acts.length });
    }

    await db.collection('days').doc(currentDayId).update({ activities: acts });
    closeModal();
  } catch (err) {
    alert('Error saving: ' + err.message);
  } finally {
    btn.textContent = 'Save';
    btn.disabled    = false;
  }
}

async function deleteActivity(actId) {
  if (!confirm('Delete this activity?')) return;
  const acts = (days[currentDayId]?.activities || []).filter(a => a.id !== actId);
  await db.collection('days').doc(currentDayId).update({ activities: acts });
}


// ── GOOGLE DRIVE HELPERS ─────────────────────────────────────
// Extract file ID from various Drive URL formats
function driveFileId(url) {
  if (!url) return null;
  // Format: /file/d/FILE_ID/...
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  // Format: id=FILE_ID
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  // Format: /open?id=FILE_ID
  const m3 = url.match(/open\?id=([a-zA-Z0-9_-]+)/);
  if (m3) return m3[1];
  return null;
}

function driveUrlToEmbed(url) {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w480` : null;
}

function driveUrlToDirect(url) {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/uc?export=view&id=${id}` : (url || '');
}


// ── LIGHTBOX ─────────────────────────────────────────────────
function openLightbox(imgUrl, driveLink) {
  document.getElementById('lightbox-img').src       = imgUrl;
  document.getElementById('lightbox-link').href     = driveLink || imgUrl;
  document.getElementById('lightbox').classList.remove('hidden');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.add('hidden');
  document.getElementById('lightbox-img').src = '';
}


// ── BUDGET ───────────────────────────────────────────────────
function renderBudget() {
  let jpy = 0, usd = 0;
  Object.values(days).forEach(day =>
    (day.activities || []).forEach(act => {
      if (act.cost > 0) {
        if (act.currency === 'JPY') jpy += act.cost;
        else if (act.currency === 'USD') usd += act.cost;
      }
    })
  );
  document.getElementById('budget-summary').innerHTML = `
    <div class="budget-row">
      <span>¥${Math.round(jpy).toLocaleString()}</span>
      <span class="budget-label">JPY</span>
    </div>
    ${usd > 0 ? `<div class="budget-row"><span>$${usd.toLocaleString()}</span><span class="budget-label">USD</span></div>` : ''}
  `;
}


// ── KEYBOARD ─────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); closeLightbox(); }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    if (!document.getElementById('modal').classList.contains('hidden')) saveActivity();
  }
});


// ── UTILS ────────────────────────────────────────────────────
function formatCost(cost, currency) {
  return currency === 'JPY'
    ? `¥${Math.round(cost).toLocaleString()}`
    : `$${cost.toFixed(2)}`;
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/\n/g,'<br>');
}

function escAttr(str) {
  if (!str) return '';
  return str.replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

// Make URLs in notes clickable
function linkify(str) {
  return str.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}
