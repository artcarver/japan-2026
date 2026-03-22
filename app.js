'use strict';
/* ═══════════════════════════════════════════════════════════
   JAPAN 2026 — Gwendalynn & Christina
   ═══════════════════════════════════════════════════════════ */

// ── Firebase ──────────────────────────────────────────────────
firebase.initializeApp({
  apiKey:            'AIzaSyBCIaluRd8u7M88DbL59Cs_6_sfcb86f0E',
  authDomain:        'japan-2026-gc.firebaseapp.com',
  projectId:         'japan-2026-gc',
  storageBucket:     'japan-2026-gc.firebasestorage.app',
  messagingSenderId: '661642949404',
  appId:             '1:661642949404:web:c6a554f3c243171d5a00d9',
});
const auth = firebase.auth();
const db   = firebase.firestore();
const ALLOWED = ['ghstilson@gmail.com', 'cmelikian@gmail.com'];

db.enablePersistence({synchronizeTabs: true}).catch(err => {
  if (err.code === 'failed-precondition') console.warn('Firestore persistence: multiple tabs open');
  else if (err.code === 'unimplemented')  console.warn('Firestore persistence not supported');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(err => console.warn('SW registration failed:', err));
  });
}

// ── State ─────────────────────────────────────────────────────
let currentUser    = null;
let exchRate       = parseFloat(localStorage.getItem('japan-rate') || '150');
let rateIsLive     = false;
let budgetCur      = 'JPY';
let expFilter      = 'all';
let hidePastDays   = false;
const expandedCards = new Set();
const notes        = {};
const checks       = {};
let expenses       = [];
let localExpenses  = [];
let expUnsub       = null;
let firestoreDays  = {};
let daysUnsub      = null;
let driveFolderUrl = '';
let bookedCosts    = DEFAULT_BOOKED_COSTS_fn();
let bookedEditing  = false;
let ptTab          = 'tasks';
let editActDayId   = null;
let editActId      = null;
let ovTimer        = null;
let selectedCat    = 'food';
let selectedPayer  = 'gwen';
let editExpId      = null;

// ── Trip dates ────────────────────────────────────────────────
const TRIP_START = new Date('2026-04-15T00:00:00');
const TRIP_END   = new Date('2026-04-29T23:59:59');
const T_DEPART   = new Date('2026-04-15T11:20:00-07:00');
const T_ARRIVE   = new Date('2026-04-16T15:05:00+09:00');

const DAY_DATES = {
  apr15:new Date('2026-04-15'), apr16:new Date('2026-04-16'), apr17:new Date('2026-04-17'),
  apr18:new Date('2026-04-18'), apr19:new Date('2026-04-19'), apr20:new Date('2026-04-20'),
  apr21:new Date('2026-04-21'), apr22:new Date('2026-04-22'), apr23:new Date('2026-04-23'),
  apr24:new Date('2026-04-24'), apr25:new Date('2026-04-25'), apr26:new Date('2026-04-26'),
  apr27:new Date('2026-04-27'), apr28:new Date('2026-04-28'), apr29:new Date('2026-04-29'),
};

// ── Helpers ───────────────────────────────────────────────────
const $ = id => document.getElementById(id);
function esc(s){ if(s==null)return''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function ea(s){ if(s==null)return''; return String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function fmt(jpy){ return budgetCur==='USD'?'$'+Math.round(jpy/exchRate).toLocaleString():'\u00a5'+Math.round(jpy).toLocaleString(); }

let toastT;
function showToast(msg, type=''){
  const t=$('toast'); if(!t)return;
  t.textContent=msg; t.className='toast show'+(type?' '+type:'');
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'), 2600);
}

// ── Time (cross-browser safe) ─────────────────────────────────
function getTodayJST(){
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone:'Asia/Tokyo', year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
  });
  const p = {};
  f.formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
  return new Date(+p.year, +p.month-1, +p.day, +p.hour, +p.minute, +p.second);
}
function getTodayDayId(){
  const t=getTodayJST().toDateString();
  return Object.entries(DAY_DATES).find(([,d])=>d.toDateString()===t)?.[0]||null;
}
function getDayClass(id){
  const today=getTodayJST(), day=DAY_DATES[id]; if(!day)return'';
  if(today.toDateString()===day.toDateString())return'today';
  return today>day?'past':'';
}
function dayIdToDate(id){
  const m=id.match(/^([a-z]+)(\d+)$/); if(!m)return id;
  return '2026-'+(({apr:'04',may:'05',mar:'03'})[m[1]]||'04')+'-'+String(m[2]).padStart(2,'0');
}

function parseTimeToMinutes(t){
  if(!t)return 9999;
  const clean=t.replace(/^~/, '').trim();
  const m=clean.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/);
  if(!m)return 9999;
  let h=parseInt(m[1],10), min=parseInt(m[2],10);
  const ampm=(m[3]||'').toUpperCase();
  if(ampm==='PM'&&h<12)h+=12;
  if(ampm==='AM'&&h===12)h=0;
  return h*60+min;
}

function sortActivitiesByTime(acts){
  const periodLabels = [];
  const items = [];
  acts.forEach(a => {
    if (a.type === 'period-label') periodLabels.push(a);
    else items.push(a);
  });

  const bundles = [];
  items.forEach(item => {
    if (item.sub && bundles.length > 0) {
      bundles[bundles.length - 1].subs.push(item);
    } else {
      bundles.push({ parent: item, subs: [] });
    }
  });

  bundles.sort((a, b) => parseTimeToMinutes(a.parent.time) - parseTimeToMinutes(b.parent.time));

  const result = [];
  let order = 0;
  let usedLabels = 0;

  bundles.forEach((bundle, i) => {
    const t = parseTimeToMinutes(bundle.parent.time);
    if (usedLabels < periodLabels.length) {
      const prevT = i > 0 ? parseTimeToMinutes(bundles[i-1].parent.time) : -1;
      if (i === 0 || (t - prevT >= 90 && t !== 9999) || (prevT < 720 && t >= 720) || (prevT < 1020 && t >= 1020)) {
        const pl = periodLabels[usedLabels];
        pl.order = order++;
        result.push(pl);
        usedLabels++;
      }
    }
    bundle.parent.order = order++;
    result.push(bundle.parent);
    bundle.subs.forEach(s => { s.order = order++; result.push(s); });
  });

  while (usedLabels < periodLabels.length) {
    const pl = periodLabels[usedLabels];
    pl.order = order++;
    result.push(pl);
    usedLabels++;
  }

  return result;
}

function updateClock(){
  const el=$('jstClock'); if(!el)return;
  const jst=getTodayJST();
  el.textContent='JST '+String(jst.getHours()).padStart(2,'0')+':'+String(jst.getMinutes()).padStart(2,'0');
}
function updateTripStatus(){
  const el=$('tripStatus'); if(!el)return;
  const now=new Date(), todayId=getTodayDayId();
  if(now<TRIP_START){
    const d=Math.ceil((TRIP_START-now)/86400000);
    el.innerHTML='Trip starts in <strong>'+d+' day'+(d===1?'':'s')+'</strong>';
  }else if(now>TRIP_END){
    el.innerHTML='Trip complete &middot; Apr 15\u201329, 2026';
  }else{
    const dayNum=Math.floor((now-TRIP_START)/86400000)+1;
    const dest=(GROUPS.find(g=>g.ids.includes(todayId))?.label||'').split('\u00b7')[0].trim();
    el.innerHTML='<strong>Day '+dayNum+' of 15</strong> &middot; '+esc(dest);
  }
}

// ── Dark mode ─────────────────────────────────────────────────
// CSS handles auto dark via @media (prefers-color-scheme: dark) { body:not(.light) }
// JS adds body.dark (manual dark) or body.light (manual light override) when user toggles.
function applyDark(on){
  document.body.classList.toggle('dark', on);
  document.body.classList.toggle('light', !on);
  const btn=$('darkToggleBtn'); if(btn)btn.innerHTML=on?'&#9728;':'&#9790;';
  const meta=$('themeColorMeta'); if(meta)meta.content=on?'#141518':'#F0EAE0';
  try{localStorage.setItem('japan-dark',on?'1':'0');}catch{}
}
function updateDarkBtn(){
  const btn=$('darkToggleBtn'); if(!btn)return;
  const isDark=document.body.classList.contains('dark')||
    (!document.body.classList.contains('light')&&window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  btn.innerHTML=isDark?'&#9728;':'&#9790;';
}
$('darkToggleBtn')?.addEventListener('click',()=>{
  const isDark=document.body.classList.contains('dark')||
    (!document.body.classList.contains('light')&&window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  applyDark(!isDark);
});
try{
  const saved=localStorage.getItem('japan-dark');
  if(saved==='1')applyDark(true);
  else if(saved==='0')applyDark(false);
  else updateDarkBtn(); // no saved pref — CSS handles it, just sync button icon
}catch{}

// ── Currency converter ────────────────────────────────────────
async function fetchRate(){
  try{
    const r=await fetch('https://open.er-api.com/v6/latest/USD');
    const d=await r.json();
    if(d.rates?.JPY){exchRate=d.rates.JPY;rateIsLive=true;localStorage.setItem('japan-rate',String(exchRate));}
  }catch{}
  const el=$('cwRate'); if(el)el.textContent=rateIsLive?'1 USD = \u00a5'+exchRate.toFixed(0)+' JPY (live)':'1 USD \u2248 \u00a5'+Math.round(exchRate)+' JPY (est.)';
}
$('cwFab')?.addEventListener('click',()=>$('currencyWidget')?.classList.toggle('hidden'));
$('cwClose')?.addEventListener('click',()=>$('currencyWidget')?.classList.add('hidden'));
$('jpyIn')?.addEventListener('input',()=>{const v=parseFloat($('jpyIn').value);$('usdIn').value=isNaN(v)?'':(v/exchRate).toFixed(2);});
$('usdIn')?.addEventListener('input',()=>{const v=parseFloat($('usdIn').value);$('jpyIn').value=isNaN(v)?'':(v*exchRate).toFixed(0);});

// ── Modals ────────────────────────────────────────────────────
function openModal(id){$(id)?.classList.add('open');}
function closeModal(id){$(id)?.classList.remove('open');}
window.closeModal=closeModal;
document.addEventListener('keydown',e=>{
  if(e.key==='Escape')document.querySelectorAll('.modal-overlay.open').forEach(o=>o.classList.remove('open'));
  if((e.metaKey||e.ctrlKey)&&e.key==='Enter'){
    if($('activityModal')?.classList.contains('open'))saveActivity();
    if($('expenseModal')?.classList.contains('open'))saveExpense();
  }
});
document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open');}));

// ── Tab switching ─────────────────────────────────────────────
function switchTab(tab){
  document.querySelectorAll('.tab-btn,.bnav-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id==='panel-'+tab));
  const pills=$('destPillsWrap');
  if(pills)pills.classList.toggle('hidden',tab!=='itinerary');
  try{localStorage.setItem('japan-tab',tab);}catch{}
  if(tab==='overview')  renderOverview();
  if(tab==='itinerary') renderItinerary();
  if(tab==='bookings')  renderBookings();
  if(tab==='plan')      renderPlan();
  if(tab==='budget')    renderBudget();
  window.scrollTo(0,0);
}
window.switchTab=switchTab;
document.querySelectorAll('.tab-btn,.bnav-btn').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));

// ── Tab visibility (editor-only tabs) ────────────────────────
const EDITOR_ONLY_TABS = ['bookings','plan','budget'];
function updateTabVisibility(isEditor){
  EDITOR_ONLY_TABS.forEach(tab=>{
    document.querySelectorAll('[data-tab="'+tab+'"]').forEach(el=>el.classList.toggle('hidden-tab', !isEditor));
  });
  // If current active tab is now restricted, redirect to overview
  const active = document.querySelector('.tab-panel.active');
  if(active){
    const id = active.id.replace('panel-','');
    if(!isEditor && EDITOR_ONLY_TABS.includes(id)) switchTab('overview');
  }
}

// ── Dest pills ────────────────────────────────────────────────
function updatePillsOffset(){
  const wrap=$('destPillsWrap'), hdr=document.querySelector('header');
  if(wrap&&hdr) wrap.style.top=hdr.offsetHeight+'px';
}
// Resize listener registered once at init — not inside buildDestPills
window.addEventListener('resize', updatePillsOffset);

function buildDestPills(){
  updatePillsOffset();
  const el=$('destPills'); if(!el)return;
  el.innerHTML=GROUPS.map((g,i)=>'<button class="dest-pill" data-group="'+i+'">'+esc(g.label)+'</button>').join('');
  el.querySelectorAll('.dest-pill').forEach(pill=>{
    pill.addEventListener('click',()=>{
      el.querySelectorAll('.dest-pill').forEach(p=>p.classList.remove('active'));
      pill.classList.add('active');
      const sec=document.getElementById('section-'+pill.dataset.group);
      if(sec){
        const hH=document.querySelector('header')?.offsetHeight||0;
        const pH=$('destPillsWrap')?.offsetHeight||0;
        window.scrollTo({top:sec.getBoundingClientRect().top+window.scrollY-hH-pH-10,behavior:'smooth'});
      }
    });
  });
}
function updateActivePill(){
  const el=$('destPills'); if(!el)return;
  const hH=document.querySelector('header')?.offsetHeight||0;
  const pH=$('destPillsWrap')?.offsetHeight||0;
  const off=hH+pH+20; let active=0;
  GROUPS.forEach((_,i)=>{const s=document.getElementById('section-'+i); if(s&&s.getBoundingClientRect().top<off)active=i;});
  el.querySelectorAll('.dest-pill').forEach((p,i)=>{
    p.classList.toggle('active',i===active);
    if(i===active)p.scrollIntoView({inline:'nearest',block:'nearest'});
  });
}
window.addEventListener('scroll',updateActivePill,{passive:true});


// ═══════════════════════════════════════════════════════════
// TRIP DATA
// ═══════════════════════════════════════════════════════════

const GROUPS = [
  {label:'TOKYO',                  dates:'APR 15\u201320', ids:['apr15','apr16','apr17','apr18','apr19'], color:'#4A90D9'},
  {label:'KAWAGUCHIKO \u00b7 HAKONE', dates:'APR 20\u201322', ids:['apr20','apr21'],                    color:'#27AE60'},
  {label:'KYOTO',                  dates:'APR 22\u201326', ids:['apr22','apr23','apr24','apr25'],        color:'#C0392B'},
  {label:'KANAZAWA',               dates:'APR 26\u201328', ids:['apr26','apr27'],                       color:'#F39C12'},
  {label:'TOKYO \u00b7 GINZA',     dates:'APR 28\u201329', ids:['apr28','apr29'],                       color:'#4A90D9'},
];

const DAYS = {
  apr15:{id:'apr15',date:'WED APR 15',title:'Depart Los Angeles',location:'LAX \u2192 HND Tokyo',periods:[
    {label:'Flight',items:[
      {time:'11:20 AM',text:'United UA 39 departs LAX',type:'booked'},
      {text:'Arrives HND Thursday April 16, 3:05 PM'},
      {text:'Boeing 787-10 Dreamliner \u00b7 Economy (K) \u00b7 Seats 31L & 31J',sub:true},
      {text:'Confirmation: F354LH',sub:true},
    ]},
  ],tip:'Get to LAX by 8:30 AM. Check in online beforehand. Settle in and adjust to the time zone.'},

  apr16:{id:'apr16',date:'THU APR 16',title:'Arrival Day',location:'Tokyo \u00b7 Shinjuku',periods:[
    {label:'Afternoon',items:[
      {time:'3:05 PM',text:'Arrive HND \u00b7 clear customs, collect bags',dur:'~90 min'},
      {text:'Tokyo Monorail or Keikyu Line \u2192 Shinjuku (~60\u201375 min)',sub:true},
      {time:'~5:30 PM',text:'Check in Hotel Gracery Shinjuku',type:'booked'},
      {text:'From 14:00 \u00b7 Conf: 5594.831.309 \u00b7 PIN: 6506',sub:true},
      {text:'Kabukicho 1-19-1, Shinjuku 160-0021',sub:true,addr:'Hotel Gracery Shinjuku, Kabukicho 1-19-1, Shinjuku, Tokyo'},
    ]},
    {label:'Evening \u2014 take it easy',items:[
      {time:'7:00 PM',text:'Omoide Yokocho (Memory Lane) \u00b7 5 min walk from hotel'},
      {text:'Tiny smoky yakitori stalls, beer \u2014 ease into Japan',sub:true},
      {time:'9:00 PM',text:'Wander Kabukicho \u00b7 neon, arcades, vending machines'},
    ]},
  ],tip:'Jet lag will hit in waves. Keep tonight very light \u2014 you have four full days ahead.'},

  apr17:{id:'apr17',date:'FRI APR 17',title:'Art + Harajuku + Shibuya',location:'Tokyo \u00b7 Shinjuku',periods:[
    {label:'Morning \u2014 teamLab Borderless',items:[
      {time:'8:15 AM',text:'Depart hotel \u00b7 Metro Hibiya Line \u2192 Kamiyacho (Exit 5)'},
      {time:'8:30 AM',text:'teamLab Borderless \u00b7 Azabudai Hills',type:'booked',dur:'~3 hrs'},
      {text:'\u00a55,600/person (~$35) \u00b7 2 tickets \u00b7 no re-entry',sub:true},
      {text:'Wear pants (mirrored floors) \u00b7 download teamLab app beforehand',sub:true},
      {text:'Hit Bubble Universe + Infinite Crystal World first \u00b7 EN Tea House is extra',sub:true},
      {text:'Azabudai Hills Garden Plaza B, B1, 1-2-4 Azabudai, Minato-ku',sub:true,addr:'teamLab Borderless, Azabudai Hills, 1-2-4 Azabudai, Minato-ku, Tokyo'},
      {time:'11:30 AM',text:'Exit teamLab \u00b7 explore Azabudai Hills complex'},
    ]},
    {label:'Afternoon \u2014 Harajuku',items:[
      {time:'12:30 PM',text:'Metro Hibiya Line \u2192 Meiji-Jingumae (Harajuku)'},
      {time:'1:00 PM',text:'Meiji Shrine \u00b7 forested approach, very peaceful',dur:'~1 hr'},
      {text:'1-1 Yoyogikamizonocho, Shibuya-ku',sub:true,addr:'Meiji Shrine, Yoyogi, Shibuya, Tokyo'},
      {time:'2:30 PM',text:'Takeshita-dori \u00b7 Harajuku street fashion, crepes'},
      {time:'3:30 PM',text:'Omotesando \u00b7 tree-lined boulevard, flagship architecture'},
    ]},
    {label:'Evening \u2014 Shibuya',items:[
      {time:'5:30 PM',text:'Shibuya Scramble Crossing \u00b7 view from above first, then walk through'},
      {time:'7:00 PM',text:'Dinner in Shibuya or Shimokitazawa \u00b7 izakayas, wine bars'},
    ]},
  ],tip:'teamLab closes at 10 PM on Apr 17 (extended spring hours). 8:30 AM is the least crowded slot \u2014 crowds don\'t arrive until after 11 AM.'},

  apr18:{id:'apr18',date:'SAT APR 18',title:'Old Tokyo',location:'Asakusa \u00b7 Yanaka \u00b7 Akihabara',periods:[
    {label:'Morning \u2014 Asakusa',items:[
      {time:'7:30 AM',text:'Arrive Asakusa \u00b7 Senso-ji before the crowds',dur:'~2 hrs'},
      {text:'Tour buses arrive by 10 AM \u2014 early light through incense smoke is worth it',sub:true},
      {text:'2-3-1 Asakusa, Taito-ku',sub:true,addr:'Senso-ji Temple, 2-3-1 Asakusa, Taito, Tokyo'},
      {time:'8:30 AM',text:'Nakamise-dori \u00b7 ningyo-yaki, age-manju, melonpan'},
      {time:'9:30 AM',text:'Kappabashi-dori \u00b7 restaurant supply street, plastic food models'},
    ]},
    {label:'Afternoon \u2014 Yanaka + Akihabara',items:[
      {time:'11:00 AM',text:'Yanaka \u00b7 Tokyo\'s best-preserved traditional neighborhood',dur:'~1.5 hrs'},
      {text:'Yanaka Cemetery (cherry trees) \u00b7 Yanaka Ginza covered shopping street',sub:true},
      {time:'1:00 PM',text:'Lunch in Yanaka \u00b7 local tofu shops, small restaurants'},
      {time:'2:30 PM',text:'Akihabara \u00b7 15 min walk \u00b7 electronics, retro games, arcade floors'},
    ]},
    {label:'Evening \u2014 Shinjuku',items:[
      {time:'7:00 PM',text:'Fuunji ramen \u00b7 exceptional tsukemen \u00b7 short queue likely',addr:'Fuunji Ramen, Nishi-Shinjuku, Tokyo'},
      {time:'8:30 PM',text:'Golden Gai \u00b7 cluster of tiny themed bars (jazz, film, rock) \u00b7 just wander in'},
    ]},
  ],tip:''},

  apr19:{id:'apr19',date:'SUN APR 19',title:'Kamakura Day Trip',location:'Tokyo \u2192 Kamakura (~1 hr)',periods:[
    {label:'Morning \u2014 Kita-Kamakura',items:[
      {time:'8:00 AM',text:'Depart Shinjuku \u00b7 JR Shonan-Shinjuku Line \u2192 Kita-Kamakura (~1 hr \u00b7 \u00a5920/~$6)'},
      {time:'9:15 AM',text:'Engaku-ji Temple \u00b7 cedar forest, zen garden',dur:'~45 min',addr:'Engaku-ji, 409 Yamanouchi, Kamakura, Kanagawa'},
      {time:'10:00 AM',text:'Walk the trail south toward Kamakura (20\u201330 min scenic walk)'},
    ]},
    {label:'Afternoon \u2014 Kamakura',items:[
      {time:'11:00 AM',text:'Great Buddha \u00b7 Kotoku-in \u00b7 \u00a5300 (~$2) \u00b7 enter the hollow statue',dur:'~1 hr',addr:'Kotoku-in Great Buddha, 4-2-28 Hase, Kamakura, Kanagawa'},
      {time:'12:00 PM',text:'Hase-dera Temple \u00b7 ocean views, cave system \u00b7 \u00a5400 (~$3)',dur:'~1 hr',addr:'Hase-dera Temple, 3-11-2 Hase, Kamakura, Kanagawa'},
      {time:'1:00 PM',text:'Lunch near Hase Station \u00b7 shirasu (whitebait) dishes, a local specialty'},
      {time:'2:30 PM',text:'Optional: Tsurugaoka Hachimangu Shrine',addr:'Tsurugaoka Hachimangu, 2-1-31 Yukinoshita, Kamakura'},
    ]},
    {label:'Evening \u2014 Return + Luggage Forwarding',items:[
      {time:'4:00 PM',text:'Return to Shinjuku by 5:30 PM'},
      {time:'6:00 PM',text:'Arrange takkyubin at hotel front desk tonight'},
      {text:'Send luggage: Hotel Gracery Shinjuku \u2192 Hotel Granvia Kyoto',sub:true},
      {text:'Sent Apr 19 arrives Apr 21 \u00b7 ~\u00a51,500\u20132,000/bag (~$10\u201313)',sub:true},
      {time:'7:30 PM',text:'Last dinner in Shinjuku'},
    ]},
  ],tip:'Weekends in Kamakura are busy \u2014 arriving before 10 AM puts you ahead of the tour groups.'},

  apr20:{id:'apr20',date:'MON APR 20',title:'Fuji Excursion \u2192 Kawaguchiko \u2192 Hakone',location:'Shinjuku \u2192 Kawaguchiko \u2192 Gora',periods:[
    {label:'Morning \u2014 Fuji Excursion',items:[
      {time:'8:30 AM',text:'Fuji-Excursion 7 departs Shinjuku',type:'booked'},
      {text:'\u00a58,400 total (~$53) \u00b7 Car 3, Seats 13-C & 13-D \u00b7 Res: E77821',sub:true},
      {time:'10:26 AM',text:'Arrive Kawaguchiko Station'},
    ]},
    {label:'Morning & Afternoon \u2014 Kawaguchiko',items:[
      {time:'10:30 AM',text:'Oishi Park \u00b7 north shore \u00b7 best Fuji reflections + late cherry blossoms',dur:'~1.5 hrs',addr:'Oishi Park, Kawaguchiko, Fujikawaguchiko, Yamanashi'},
      {time:'12:00 PM',text:'Chureito Pagoda \u00b7 30 min to Fujiyoshida \u00b7 ~400 steps',dur:'~1 hr',addr:'Chureito Pagoda, Fujiyoshida, Yamanashi'},
      {text:'Iconic 5-story pagoda framing Fuji with blossoms \u2014 worth the detour',sub:true},
      {time:'1:00 PM',text:'Lunch near Kawaguchiko Station \u00b7 hoto noodles (local specialty)'},
    ]},
    {label:'Afternoon \u2014 Transit to Hakone',items:[
      {time:'2:00 PM',text:'Bus via Gotemba \u2192 Gora (~2.5 hrs) \u00b7 day bags only'},
      {time:'~4:30 PM',text:'Arrive Gora \u00b7 walk to ryokan (2\u20133 min from station)'},
      {time:'5:00 PM',text:'Check in Tensui Saryo \u00b7 Gora, Hakone',type:'booked'},
      {text:'1320-276 Gora, Hakone-machi, Ashigarashimo-gun',sub:true,addr:'Tensui Saryo, Gora, Hakone, Ashigarashimo-gun, Kanagawa'},
      {text:'Reservation: IK1516984808 \u00b7 check-in 15:00\u201321:30',sub:true},
    ]},
    {label:'Evening',items:[
      {time:'5:30 PM',text:'Ryokan \u00b7 change into yukata, explore property, private onsen'},
      {time:'7:45 PM',text:'Kaiseki dinner at Tensui Saryo \u2014 19:45',type:'booked'},
      {text:'Dinner and breakfast included \u00b7 10-course traditional kaiseki',sub:true},
    ]},
  ],tip:'Morning is the best window for Mt. Fuji views before clouds build. The Chureito Pagoda detour is worth it if skies are clear.'},

  apr21:{id:'apr21',date:'TUE APR 21',title:'The Hakone Loop',location:'Gora \u2192 Owakudani \u2192 Lake Ashi',periods:[
    {label:'Morning \u2014 Open Air Museum + Ropeway',items:[
      {time:'9:00 AM',text:'Hakone Open Air Museum \u00b7 opens 9 AM \u00b7 \u00a52,000 (~$13)',dur:'~2 hrs',addr:'Hakone Open Air Museum, 1121 Ninotaira, Hakone, Kanagawa'},
      {text:'10 min walk from ryokan \u00b7 outdoor sculptures, Picasso Pavilion (300+ works), foot onsen inside',sub:true},
      {time:'11:00 AM',text:'Hakone Tozan Railway: Gora \u2192 Sounzan (10 min)'},
      {time:'11:15 AM',text:'Ropeway: Sounzan \u2192 Owakudani (~25 min) \u00b7 Hakone Free Pass'},
      {text:'Best Fuji views in the morning before clouds build',sub:true},
    ]},
    {label:'Midday \u2014 Owakudani + Lake Ashi',items:[
      {time:'12:00 PM',text:'Owakudani volcanic valley \u00b7 sulfur steam vents \u00b7 black eggs',addr:'Owakudani, Hakone, Ashigarashimo-gun, Kanagawa'},
      {text:'\u00a5500 for 5 eggs (~$3) \u00b7 supposedly add 7 years per egg',sub:true},
      {time:'1:00 PM',text:'Ropeway \u2192 Togendai on Lake Ashi (~25 min)'},
      {time:'1:30 PM',text:'Lake Ashi sightseeing boat \u2192 Moto-Hakone (~30 min \u00b7 Free Pass)',dur:'30 min'},
    ]},
    {label:'Afternoon \u2014 Hakone Shrine + Return',items:[
      {time:'2:30 PM',text:'Hakone Shrine \u00b7 torii gate rising from the lake',dur:'~45 min',addr:'Hakone Shrine, 80-1 Motohakone, Hakone, Kanagawa'},
      {time:'3:30 PM',text:'Lunch near Moto-Hakone \u00b7 tofu cuisine, soba'},
      {time:'5:00 PM',text:'Head back to Gora \u00b7 Hakone Tozan Railway'},
      {time:'5:30 PM',text:'Tensui Saryo \u00b7 private open-air onsen',dur:'~1.5 hrs'},
    ]},
    {label:'Evening',items:[
      {time:'7:45 PM',text:'Kaiseki dinner at Tensui Saryo \u2014 19:45',type:'booked'},
    ]},
  ],tip:'Buy the Hakone Free Pass at Gora Station \u2014 covers Tozan Railway, ropeway, and Lake Ashi boat. ~\u00a54,000 (~$25) for 2 days.'},

  apr22:{id:'apr22',date:'WED APR 22',title:'Depart Hakone \u2192 Arrive Kyoto',location:'Gora \u2192 Odawara \u2192 Kyoto',periods:[
    {label:'Morning \u2014 Checkout + Shinkansen',items:[
      {time:'7:00 AM',text:'Breakfast at ryokan \u00b7 included'},
      {time:'9:00 AM',text:'Check out Tensui Saryo \u00b7 must leave by 9:00 AM'},
      {time:'9:05 AM',text:'Hakone Tozan Railway: Gora \u2192 Hakone-Yumoto (~35 min)'},
      {time:'9:45 AM',text:'Local train: Hakone-Yumoto \u2192 Odawara (~15 min)'},
      {time:'10:11 AM',text:'HIKARI 637 departs Odawara',type:'booked'},
      {text:'\u00a523,800 total (~$150) \u00b7 Res: 2002 \u00b7 Series N700 \u00b7 seats TBD by email',sub:true},
      {time:'12:12 PM',text:'Arrive Kyoto Station',dur:'2 hrs 1 min'},
    ]},
    {label:'Afternoon \u2014 Arrive Kyoto',items:[
      {time:'12:15 PM',text:'Check in Hotel Granvia Kyoto',type:'booked'},
      {text:'JR Kyoto Station (Karasuma) \u00b7 Conf: #23151SF060529',sub:true,addr:'Hotel Granvia Kyoto, JR Kyoto Station, 600-8216 Kyoto'},
      {text:'Luggage arriving from takkyubin (sent Apr 19)',sub:true},
      {time:'2:30 PM',text:'Fushimi Inari Taisha \u00b7 5 min by JR \u00b7 FREE \u00b7 open 24 hrs',addr:'Fushimi Inari Taisha, 68 Fukakusa Yabunouchicho, Fushimi-ku, Kyoto'},
      {text:'Preview visit \u2014 lower gates only \u00b7 save energy for tomorrow 6 AM',sub:true},
    ]},
    {label:'Evening',items:[
      {time:'5:30 PM',text:'Nishiki Market \u00b7 closes ~5:30 PM weekdays',addr:'Nishiki Market, Nishikikoji Street, Nakagyo-ku, Kyoto'},
      {time:'7:30 PM',text:'Dinner in Gion or Pontocho alley'},
    ]},
  ],tip:'Check out by 9 AM is essential. The full Fushimi Inari hike is tomorrow at 6 AM \u2014 the single most important timing decision of the Kyoto trip.'},

  apr23:{id:'apr23',date:'THU APR 23',title:'Fushimi Inari + Arashiyama',location:'Kyoto \u00b7 Southern + Western',periods:[
    {label:'Very Early Morning \u2014 Fushimi Inari',items:[
      {time:'5:45 AM',text:'JR Nara Line \u2192 Inari Station (5 min \u00b7 \u00a5150/~$1)'},
      {time:'6:00 AM',text:'Fushimi Inari Taisha \u00b7 FREE \u00b7 open 24 hrs',dur:'~2.5 hrs',addr:'Fushimi Inari Taisha, 68 Fukakusa Yabunouchicho, Fushimi-ku, Kyoto'},
      {text:'By 8 AM it\'s crowded \u00b7 by 10 AM shoulder-to-shoulder \u00b7 6 AM is transformative',sub:true},
      {text:'Full hike to summit and back ~2 hrs \u00b7 Yotsutsuji crossroads has best views',sub:true},
      {time:'8:30 AM',text:'Descend \u00b7 grab breakfast from street stalls outside entrance'},
    ]},
    {label:'Late Morning \u2014 Arashiyama',items:[
      {time:'9:30 AM',text:'JR Sagano Line \u2192 Saga-Arashiyama (~25 min \u00b7 \u00a5240/~$2)'},
      {time:'10:00 AM',text:'Arashiyama Bamboo Grove \u00b7 FREE \u00b7 open 24 hrs',dur:'~45 min',addr:'Arashiyama Bamboo Grove, Sagatenryuji, Ukyo-ku, Kyoto'},
      {text:'Still manageable at 10 AM on a weekday \u2014 earlier is better but you started at dawn',sub:true},
      {time:'10:45 AM',text:'Tenryu-ji Temple \u00b7 \u00a5500 (~$3) for garden',dur:'~45 min',addr:'Tenryu-ji, 68 Sagatenryuji Susukinobabacho, Ukyo-ku, Kyoto'},
      {time:'11:30 AM',text:'Togetsukyo Bridge \u00b7 iconic bridge over the Oi River',addr:'Togetsukyo Bridge, Sagatenryuji, Ukyo-ku, Kyoto'},
    ]},
    {label:'Afternoon \u2014 Higashiyama',items:[
      {time:'12:30 PM',text:'Lunch in Arashiyama \u00b7 yudofu (hot tofu), matcha soba, or riverside cafe'},
      {time:'2:00 PM',text:'Bus or JR to Higashiyama district'},
      {time:'2:30 PM',text:'Ninenzaka + Sannenzaka \u00b7 preserved stone-paved streets',dur:'~1 hr',addr:'Ninenzaka, Higashiyama-ku, Kyoto'},
      {time:'3:30 PM',text:'Kiyomizudera Temple \u00b7 \u00a5500 (~$3)',dur:'~1 hr',addr:'Kiyomizudera, 1-294 Kiyomizu, Higashiyama-ku, Kyoto'},
    ]},
    {label:'Evening',items:[
      {time:'5:30 PM',text:'Gion district \u00b7 Hanamikoji Street \u00b7 watch for geiko/maiko',addr:'Hanamikoji Street, Gion, Higashiyama-ku, Kyoto'},
      {time:'7:00 PM',text:'Dinner in Gion or Pontocho \u00b7 book in advance'},
    ]},
  ],tip:'6 AM at Fushimi Inari is the single best timing call of the Kyoto trip. The difference between 6 AM and 10 AM is serene vs. a crush of tourists.'},

  apr24:{id:'apr24',date:'FRI APR 24',title:'Nara Day Trip + Nishiki Market',location:'Kyoto \u2192 Nara \u2192 Central Kyoto',periods:[
    {label:'Morning \u2014 Nara',items:[
      {time:'8:30 AM',text:'JR Nara Line: Kyoto \u2192 Nara (45 min \u00b7 \u00a5760/~$5)'},
      {time:'9:30 AM',text:'Nara Park \u00b7 hundreds of freely roaming deer',dur:'~30 min',addr:'Nara Park, Zoshicho, Nara'},
      {time:'10:00 AM',text:'Todai-ji Temple \u00b7 world\'s largest wooden building \u00b7 giant bronze Buddha',dur:'~1.5 hrs',addr:'Todai-ji, 406-1 Zoshicho, Nara'},
      {text:'\u00a5600 (~$4) \u00b7 UNESCO \u00b7 genuinely awe-inspiring scale',sub:true},
      {time:'11:30 AM',text:'Kasuga Taisha Shrine \u00b7 forest setting \u00b7 lantern-lined paths',addr:'Kasuga Taisha, 160 Kasuganocho, Nara'},
      {time:'12:30 PM',text:'Lunch in Nara \u00b7 kakinoha-zushi (persimmon-leaf sushi)'},
      {time:'2:00 PM',text:'Return to Kyoto'},
    ]},
    {label:'Afternoon \u2014 Central Kyoto',items:[
      {time:'3:00 PM',text:'Nishiki Market \u00b7 go before 3 PM \u00b7 closes ~5:30 PM weekdays',dur:'~1 hr',addr:'Nishiki Market, Nishikikoji Street, Nakagyo-ku, Kyoto'},
      {text:'Kyoto\'s Kitchen \u00b7 sakura-themed sweets in April \u00b7 pickles \u00b7 matcha soft serve',sub:true},
      {time:'4:30 PM',text:'Teramachi + Shinkyogoku shopping arcades \u00b7 adjacent to Nishiki'},
    ]},
    {label:'Evening',items:[
      {time:'6:00 PM',text:'Philosopher\'s Path \u00b7 2 km canal walk lined with cherry trees',dur:'~1 hr',addr:'Philosopher\'s Path, Sakyo-ku, Kyoto'},
      {time:'7:30 PM',text:'Dinner in Pontocho or Gion'},
    ]},
  ],tip:'Nara is best before 10 AM when the deer are calm and the temples are quiet. Nishiki Market closes early on weekdays \u2014 arrive by 3 PM.'},

  apr25:{id:'apr25',date:'SAT APR 25',title:'Osaka Day Trip + Kinkaku-ji',location:'Kyoto \u2192 Osaka \u2192 Northern Kyoto',periods:[
    {label:'Morning \u2014 Osaka',items:[
      {time:'9:00 AM',text:'JR Shinkaisoku: Kyoto \u2192 Osaka (~30 min \u00b7 \u00a5580/~$4)'},
      {time:'10:00 AM',text:'Osaka Aquarium Kaiyukan \u00b7 whale sharks in a 4-storey Pacific tank',dur:'~2 hrs',addr:'Osaka Aquarium Kaiyukan, 1-1-10 Kaigandori, Minato-ku, Osaka'},
      {text:'\u00a52,700 (~$18) \u00b7 book tickets online in advance to skip the queue',sub:true},
      {time:'12:30 PM',text:'Dotonbori \u00b7 neon food street, takoyaki, the Glico Running Man sign',dur:'~1.5 hrs',addr:'Dotonbori, Chuo-ku, Osaka'},
      {text:'Try takoyaki (octopus balls), okonomiyaki (savory pancake), and kushikatsu (fried skewers)',sub:true},
    ]},
    {label:'Afternoon \u2014 Osaka + Return',items:[
      {time:'2:30 PM',text:'Kuromon Ichiba Market \u00b7 580m covered market \u00b7 fresh scallops and crab',dur:'~1 hr',addr:'Kuromon Ichiba Market, Nipponbashi, Chuo-ku, Osaka'},
      {time:'3:30 PM',text:'Optional: Osaka Castle \u00b7 \u00a5600 \u00b7 museum inside \u00b7 beautiful grounds',addr:'Osaka Castle, 1-1 Osakajo, Chuo-ku, Osaka'},
      {time:'4:30 PM',text:'Return to Kyoto \u00b7 JR Shinkaisoku (~30 min)'},
    ]},
    {label:'Late Afternoon \u2014 Northern Kyoto',items:[
      {time:'5:30 PM',text:'Kinkaku-ji (Golden Pavilion) \u00b7 \u00a5500 (~$3)',addr:'Kinkaku-ji, 1 Kinkakujicho, Kita-ku, Kyoto'},
      {text:'Late afternoon light on the gold leaf is stunning \u00b7 closes 5 PM but aim for just before',sub:true},
    ]},
    {label:'Evening \u2014 Last Night in Kyoto',items:[
      {time:'7:00 PM',text:'Dinner \u00b7 Kawaramachi or Shijo area \u00b7 izakaya, sake bar, or splurge kaiseki'},
    ]},
  ],tip:'Book Kaiyukan tickets online in advance to skip queues. Dotonbori street food is best around lunch. Kinkaku-ji is worth seeing once despite crowds \u2014 late afternoon light is beautiful.'},

  apr26:{id:'apr26',date:'SUN APR 26',title:'Depart Kyoto \u2192 Kanazawa',location:'Kyoto \u2192 Kanazawa',periods:[
    {label:'Morning \u2014 Checkout',items:[
      {time:'10:00 AM',text:'Check out Hotel Granvia Kyoto',type:'booked'},
    ]},
    {label:'Transit to Kanazawa',items:[
      {text:'Thunderbird Limited Express: Kyoto \u2192 Kanazawa (~2 hrs \u00b7 ~\u00a56,000\u20137,000/~$38\u201344)'},
      {text:'Multiple departures \u00b7 check timetable \u00b7 aim for mid-morning',sub:true},
    ]},
    {label:'Afternoon \u2014 Arrive Kanazawa',items:[
      {time:'3:00 PM',text:'Check in Hotel Intergate Kanazawa',type:'booked'},
      {text:'2-5 Takaokamachi, Kanazawa \u00b7 breakfast buffet included',sub:true,addr:'Hotel Intergate Kanazawa, 2-5 Takaokamachi, Kanazawa, Ishikawa'},
      {time:'3:30 PM',text:'21st Century Museum of Contemporary Art \u00b7 VISIT TODAY \u2014 closed Mondays',dur:'~1.5 hrs',addr:'21st Century Museum, 1-2-1 Hirosaka, Kanazawa, Ishikawa'},
      {text:'Free exchange zone \u00b7 ~\u00a51,400 (~$9) for exhibitions',sub:true},
      {text:'Swimming Pool (Leandro Erlich) + Blue Planet Sky (James Turrell)',sub:true},
    ]},
    {label:'Evening',items:[
      {time:'6:00 PM',text:'Higashi Chaya District \u00b7 Japan\'s best-preserved geisha quarter outside Kyoto',dur:'~1.5 hrs',addr:'Higashi Chaya District, Higashiyama, Kanazawa, Ishikawa'},
      {time:'7:30 PM',text:'Dinner \u00b7 Nodoguro (blackthroat seaperch), sweet shrimp \u00b7 Korinbo area'},
    ]},
  ],tip:'The 21st Century Museum is CLOSED on Mondays \u2014 visit it today on arrival. It\'s a 20-minute walk or short bus ride from the hotel.'},

  apr27:{id:'apr27',date:'MON APR 27',title:'Kanazawa Full Day',location:'Kenroku-en \u00b7 Omicho \u00b7 Nagamachi',periods:[
    {label:'Morning \u2014 Kenroku-en + Castle',items:[
      {time:'7:00 AM',text:'Kenroku-en Garden \u00b7 opens 7 AM \u00b7 \u00a5320 (~$2)',dur:'~2 hrs',addr:'Kenroku-en, 1 Kenrokumachi, Kanazawa, Ishikawa'},
      {text:'One of Japan\'s three great gardens \u00b7 Kasumigaike Pond + Kotojitoro lantern',sub:true},
      {text:'Free early entry from 4 AM through Mayumizaka Gate',sub:true},
      {time:'9:00 AM',text:'Kanazawa Castle Park \u00b7 directly adjacent \u00b7 free grounds',addr:'Kanazawa Castle, 1-1 Marunouchi, Kanazawa, Ishikawa'},
    ]},
    {label:'Late Morning \u2014 Omicho Market',items:[
      {time:'10:30 AM',text:'Omicho Market \u00b7 Kanazawa\'s kitchen \u00b7 9 AM \u2013 5 PM',dur:'~1.5 hrs',addr:'Omicho Market, 50 Kami-Omicho, Kanazawa, Ishikawa'},
      {text:'Kaisendon (seafood rice bowl) \u00b7 arrive before noon before lines grow',sub:true},
      {text:'Popular items sell out before noon \u2014 arrive early',sub:true},
    ]},
    {label:'Afternoon \u2014 Nagamachi + Explore',items:[
      {time:'1:00 PM',text:'Nagamachi Samurai District \u00b7 Nomura Clan House \u00b7 \u00a5550 (~$4)',dur:'~1.5 hrs',addr:'Nagamachi Samurai District, Nagamachi, Kanazawa, Ishikawa'},
      {time:'3:00 PM',text:'D.T. Suzuki Museum \u00b7 \u00a5310 \u00b7 meditative architecture + water mirror garden',dur:'~1 hr',addr:'D.T. Suzuki Museum, 3-4-20 Honda-machi, Kanazawa, Ishikawa'},
      {text:'Contemplative space designed by Yoshio Taniguchi \u00b7 calming after busy mornings',sub:true},
    ]},
    {label:'Evening',items:[
      {time:'6:30 PM',text:'Dinner \u00b7 Kanazawa seafood \u00b7 Nodoguro, crab, sweet shrimp'},
    ]},
  ],tip:'Note: 21st Century Museum is closed today (Monday) \u2014 you already visited yesterday. Kenroku-en is most peaceful in the early morning before tour groups arrive around 9 AM.'},

  apr28:{id:'apr28',date:'TUE APR 28',title:'Depart Kanazawa \u2192 Tokyo Ginza',location:'Kanazawa \u2192 Tokyo \u00b7 Ginza',periods:[
    {label:'Morning \u2014 Checkout + Shinkansen',items:[
      {time:'8:00 AM',text:'Breakfast buffet at Hotel Intergate \u00b7 included'},
      {time:'10:00 AM',text:'Check out \u00b7 by 11:00 AM'},
      {text:'Hokuriku Shinkansen: Kanazawa \u2192 Tokyo (Ueno) \u00b7 ~2.5 hrs \u00b7 ~\u00a514,000 (~$88)',sub:true},
    ]},
    {label:'Afternoon \u2014 Arrive Tokyo Ginza',items:[
      {time:'2:30 PM',text:'Hamarikyu Gardens \u00b7 \u00a5300 (~$2) \u00b7 traditional garden on Tokyo Bay',dur:'~1 hr',addr:'Hamarikyu Gardens, 1-1 Hamarikyuteien, Chuo-ku, Tokyo'},
      {time:'3:00 PM',text:'Check in Quintessa Hotel Tokyo Ginza',type:'booked'},
      {text:'Conf: 6519361226 \u00b7 PIN: 9235 \u00b7 breakfast included',sub:true,addr:'Quintessa Hotel Tokyo Ginza, 4-11-4 Ginza, Chuo-ku, Tokyo'},
      {time:'4:00 PM',text:'Ginza main streets \u00b7 Itoya stationery \u00b7 Ginza Six \u00b7 window shopping'},
    ]},
    {label:'Evening \u2014 Final Night',items:[
      {time:'6:30 PM',text:'Tsukiji Outer Market area for dinner \u00b7 sushi, grilled seafood, sake bars',addr:'Tsukiji Outer Market, 4-16-2 Tsukiji, Chuo-ku, Tokyo'},
      {time:'8:00 PM',text:'Ginza evening stroll \u00b7 excellent last night in Japan'},
    ]},
  ],tip:'Pack tonight and confirm you have everything. Flight departs HND at 6:10 PM tomorrow \u2014 leave the hotel by 12:30 PM.'},

  apr29:{id:'apr29',date:'WED APR 29',title:'Final Morning + Depart',location:'Tokyo Ginza \u2192 HND \u2192 LAX',periods:[
    {label:'Morning \u2014 Tsukiji Farewell',items:[
      {time:'7:30 AM',text:'Tsukiji Outer Market \u00b7 10 min walk \u00b7 classic Tokyo farewell breakfast',dur:'~1.5 hrs',addr:'Tsukiji Outer Market, 4-16-2 Tsukiji, Chuo-ku, Tokyo'},
      {text:'Fresh sushi, tamagoyaki, grilled scallops, matcha \u00b7 best before 10 AM',sub:true},
      {time:'10:00 AM',text:'Return to hotel \u00b7 collect luggage'},
    ]},
    {label:'Afternoon \u2014 Depart',items:[
      {time:'12:30 PM',text:'Depart hotel for Haneda Airport \u00b7 no later than 12:30 PM'},
      {text:'Keikyu Line from Higashi-Ginza \u2192 HND Terminal 3 (~30 min \u00b7 \u00a5300/~$2)',sub:true},
      {text:'Allow 2.5\u20133 hours before departure for international check-in + security',sub:true},
      {time:'6:10 PM',text:'United UA 38 departs HND',type:'booked'},
      {text:'HND \u2192 LAX \u00b7 10 hrs 5 min \u00b7 Seats 31J & 31L \u00b7 Conf: F354LH',sub:true},
      {text:'Arrives LAX Wednesday April 29, 12:15 PM (same day, crossing date line)',sub:true},
    ]},
  ],tip:'Golden Week begins today \u2014 you\'re flying out. Well timed. Allow 3 hours at the airport.'},
};

const OVERVIEW_DATA = [
  {city:'Tokyo',dates:'Apr 16\u201320',nights:4,hotel:'Hotel Gracery Shinjuku \u00b7 Kabukicho, Shinjuku',phone:'+81 3 6833 1111',
   highlights:[
     {text:'teamLab Borderless \u2014 immersive digital art filling entire rooms',star:true,url:'https://borderless.teamlab.art/en/'},
     {text:'Senso-ji at dawn \u2014 incense smoke and empty lantern-lit corridors',star:true,url:'https://www.senso-ji.jp/english/'},
     {text:'Shibuya Scramble Crossing \u2014 the world\'s busiest intersection'},
     {text:'Golden Gai \u2014 forty tiny themed bars, each seating about eight people',url:'https://maps.google.com/?q=Golden+Gai+Shinjuku+Tokyo'},
   ]},
  {city:'Kamakura',dates:'Apr 19 \u00b7 day trip',nights:0,waypoint:true,hotel:'Day trip from Tokyo \u00b7 45 min by JR',
   highlights:[
     {text:'Kotoku-in \u2014 13th-century bronze Great Buddha, 13 metres tall',star:true},
     {text:'Hase-dera Temple \u2014 ocean views, cave system, 11,000 Jizo statues'},
     {text:'Shirasu (whitebait) rice bowl \u2014 the Kamakura coastal specialty'},
   ]},
  {city:'Kawaguchiko',dates:'Apr 20 \u00b7 morning only',nights:0,waypoint:true,hotel:'Transit stop en route to Hakone',
   highlights:[
     {text:'Oishi Park \u2014 Mt. Fuji reflected in the lake with cherry blossoms',star:true},
     {text:'Chureito Pagoda \u2014 five-story pagoda framing Fuji from above'},
   ]},
  {city:'Hakone',dates:'Apr 20\u201322',nights:2,hotel:'Tensui Saryo Ryokan \u00b7 Gora \u00b7 private outdoor onsen',phone:'+81-570-062-302',
   highlights:[
     {text:'Private rotenburo on the deck \u2014 a hot spring under the stars at midnight',star:true},
     {text:'10-course kaiseki dinner both evenings',star:true},
     {text:'Owakudani volcanic ropeway \u2014 active sulfur craters and black eggs',url:'https://www.hakoneropeway.co.jp/en/'},
     {text:'Lake Ashi boat cruise \u2014 torii gate rising from the water',url:'https://www.hakone-kankosen.co.jp/foreign/en/'},
   ]},
  {city:'Kyoto',dates:'Apr 22\u201326',nights:4,hotel:'Hotel Granvia Kyoto \u00b7 connected to Kyoto Station',phone:'+81-75-344-8888',
   highlights:[
     {text:'Fushimi Inari at 6 AM \u2014 10,000 vermilion torii gates, empty at dawn',star:true,url:'https://inari.jp/en/'},
     {text:'Arashiyama bamboo grove \u2014 towering stalks swaying overhead',star:true},
     {text:'Gion at dusk \u2014 wooden alleyways, lantern glow, chance to spot a geiko'},
     {text:"Philosopher's Path \u2014 2 km canal walk lined with cherry trees"},
   ]},
  {city:'Nara',dates:'Apr 24 \u00b7 day trip',nights:0,waypoint:true,hotel:'Day trip from Kyoto \u00b7 45 min by JR Nara Line',
   highlights:[
     {text:'Hundreds of freely roaming deer bowing for crackers in Nara Park',star:true},
     {text:"Todai-ji \u2014 the world's largest wooden building, giant bronze Buddha inside",star:true},
     {text:'Kasuga Taisha Shrine \u2014 3,000 stone and bronze lanterns, forested paths'},
   ]},
  {city:'Osaka',dates:'Apr 25 \u00b7 day trip',nights:0,waypoint:true,hotel:'Day trip from Kyoto \u00b7 30 min by JR Shinkaisoku',
   highlights:[
     {text:'Kaiyukan Aquarium \u2014 whale sharks in a four-storey Pacific Ocean tank',star:true,url:'https://www.kaiyukan.com/language/eng/'},
     {text:'Dotonbori \u2014 takoyaki, okonomiyaki, the Glico Running Man sign'},
   ]},
  {city:'Kanazawa',dates:'Apr 26\u201328',nights:2,hotel:'Hotel Intergate Kanazawa \u00b7 2-5 Takaokamachi',phone:'+81-76-205-1122',
   highlights:[
     {text:"Kenroku-en \u2014 one of Japan's three great gardens",star:true,url:'https://www.pref.ishikawa.jp/siro-niwa/kenrokuen/e/'},
     {text:"21st Century Museum \u2014 Leandro Erlich's Swimming Pool installation",star:true,url:'https://www.kanazawa21.jp/en/'},
     {text:'Higashi Chaya District \u2014 preserved geisha quarter, gold leaf cafes'},
   ]},
  {city:'Tokyo \u00b7 Ginza',dates:'Apr 28\u201329',nights:1,hotel:'Quintessa Hotel Tokyo Ginza \u00b7 4-11-4 Ginza',phone:'+81 3-6264-1351',
   highlights:[
     {text:'Tsukiji Outer Market farewell breakfast \u2014 fresh sushi and grilled scallops',star:true},
     {text:'Ginza evening stroll \u2014 the perfect last night in Japan'},
   ]},
];

const CONFIRMATIONS = {
  flights:[
    {name:'Outbound \u00b7 LAX \u2192 Tokyo HND',number:{label:'Confirmation',val:'F354LH'},rows:[
      {k:'Flight',   v:'United UA 39'},{k:'Date',v:'Wed April 15, 2026'},
      {k:'Departs',  v:'LAX 11:20 AM'},{k:'Arrives',v:'HND Thu April 16, 3:05 PM'},
      {k:'Duration', v:'11 hrs 45 min'},{k:'Seats',v:'31L (Gwendalynn) \u00b7 31J (Christina)'},
      {k:'Aircraft', v:'Boeing 787-10 Dreamliner \u00b7 Economy (K)'},
      {k:'eTickets', v:'0162358617634 (G) \u00b7 0162358617635 (C)',mono:true},
      {k:'Cost',     v:'$2,196.86 total \u00b7 $1,098.43/person incl. Economy Plus'},
    ]},
    {name:'Return \u00b7 Tokyo HND \u2192 LAX',number:{label:'Confirmation',val:'F354LH'},rows:[
      {k:'Flight',  v:'United UA 38'},{k:'Date',v:'Wed April 29, 2026'},
      {k:'Departs', v:'HND 6:10 PM'},{k:'Arrives',v:'LAX 12:15 PM same day'},
      {k:'Duration',v:'10 hrs 5 min'},{k:'Seats',v:'31J (Gwendalynn) \u00b7 31L (Christina)'},
    ]},
  ],
  hotels:[
    {name:'Hotel Gracery Shinjuku \u00b7 Tokyo',number:{label:'Confirmation',val:'5594.831.309'},rows:[
      {k:'Check-in', v:'Thu Apr 16 from 14:00'},{k:'Check-out',v:'Mon Apr 20 by 11:00 (4 nights)'},
      {k:'Room',v:'Standard Twin Room \u2014 Non-Smoking'},{k:'PIN',v:'6506',mono:true},
      {k:'Address',v:'Kabukicho 1-19-1, Shinjuku, Tokyo 160-0021',addr:'Hotel Gracery Shinjuku, Kabukicho 1-19-1, Shinjuku, Tokyo'},
      {k:'Phone',v:'+81 3 6833 1111'},{k:'Price',v:'~\u00a5200,692 (~$1,261)'},
    ]},
    {name:'Tensui Saryo \u00b7 Gora, Hakone',number:{label:'Reservation',val:'IK1516984808'},rows:[
      {k:'Check-in',v:'Mon Apr 20, 15:00\u201321:30 (est. arrival 17:30)'},{k:'Check-out',v:'Wed Apr 22 by 10:00 (2 nights)'},
      {k:'Room',v:'Detached Type-A \u00b7 Open-air Onsen + Foot Bath'},
      {k:'Plan',v:'Basic Kaiseki \u00b7 Dinner 19:45 \u00b7 Breakfast included'},
      {k:'Verification',v:'0F35443D931C12B',mono:true},
      {k:'Address',v:'1320-276 Gora, Hakone-machi',addr:'Tensui Saryo, 1320-276 Gora, Hakone, Kanagawa'},
      {k:'Phone',v:'+81-570-062-302'},{k:'Price',v:'\u00a5126,340 (~$794) incl. tax'},
      {k:'Access',v:'2\u20133 min walk from Gora Station'},
    ]},
    {name:'Hotel Granvia Kyoto',number:{label:'Confirmation',val:'#23151SF060529'},rows:[
      {k:'Check-in',v:'Wed Apr 22, 2026'},{k:'Check-out',v:'Sun Apr 26, 2026 (4 nights)'},
      {k:'Room',v:'Granvia Deluxe Twin Room \u2014 Non-Smoking'},
      {k:'Address',v:'JR Kyoto Station (Karasuma), 600-8216 Kyoto',addr:'Hotel Granvia Kyoto, JR Kyoto Station, Kyoto'},
      {k:'Phone',v:'+81-75-344-8888'},{k:'Price',v:'\u00a5268,256 (~$1,686) total incl. tax'},
      {k:'Cancel',v:'Notify by 16:00 JST day before or full night charge'},
      {k:'Luggage',v:'Takkyubin arriving from Gracery Shinjuku (sent Apr 19, arrives Apr 21)'},
    ]},
    {name:'Hotel Intergate Kanazawa',number:{label:'Confirmation',val:'20260125110822242'},rows:[
      {k:'Check-in',v:'Sun Apr 26 from 15:00'},{k:'Check-out',v:'Tue Apr 28 by 11:00 (2 nights)'},
      {k:'Room',v:'Superior Twin Room \u2014 Non-Smoking'},{k:'Amenities',v:'Breakfast Buffet included'},
      {k:'Expedia',v:'73356721260247',mono:true},
      {k:'Address',v:'2-5 Takaokamachi, Kanazawa, Ishikawa 920-0864',addr:'Hotel Intergate Kanazawa, 2-5 Takaokamachi, Kanazawa'},
      {k:'Phone',v:'+81-76-205-1122'},{k:'Price',v:'\u00a539,004 (~$245) incl. taxes \u00b7 pay at property'},
    ]},
    {name:'Quintessa Hotel Tokyo Ginza',number:{label:'Confirmation',val:'6519361226'},rows:[
      {k:'Check-in',v:'Tue Apr 28 from 15:00'},{k:'Check-out',v:'Wed Apr 29 by 11:00 (1 night)'},
      {k:'Room',v:'Hollywood Twin Room'},{k:'Amenities',v:'Breakfast included'},
      {k:'PIN',v:'9235',mono:true},
      {k:'Address',v:'Chuo-ku Ginza 4-11-4, Tokyo',addr:'Quintessa Hotel Tokyo Ginza, 4-11-4 Ginza, Chuo, Tokyo'},
      {k:'Phone',v:'+81 3-6264-1351'},{k:'Price',v:'\u00a524,713 (~$155) \u00b7 charged Apr 25 to card on file'},
    ]},
  ],
  trains:[
    {name:'teamLab Borderless \u00b7 Apr 17',number:{label:'Confirmation',val:'A7YRA4LXWCN3-0001'},rows:[
      {k:'Date',v:'Friday April 17, 2026'},
      {k:'Entry',v:'08:30\u201309:00 window \u00b7 Azabudai Hills Garden Plaza B, B1'},
      {k:'Tickets',v:'2 adults \u00b7 \u00a55,600/person \u00b7 \u00a511,200 total'},
      {k:'Note',v:'Download teamLab app beforehand \u00b7 no re-entry'},
    ]},
    {name:'Fuji-Excursion 7 \u00b7 Shinjuku \u2192 Kawaguchiko',number:{label:'Reservation',val:'E77821'},rows:[
      {k:'Date',v:'Monday April 20, 2026'},
      {k:'Route',v:'Shinjuku 8:30 AM \u2192 Kawaguchiko 10:26 AM'},
      {k:'Seats',v:'Car 3, Seat 13-C (Gwendalynn) \u00b7 Seat 13-D (Christina)'},
      {k:'Pickup code',v:'24492390994521288',mono:true},
      {k:'Fare',v:'\u00a58,400 (~$53) total for 2 adults'},
    ]},
    {name:'Shinkansen HIKARI 637 \u00b7 Odawara \u2192 Kyoto',number:{label:'Reservation',val:'2002'},rows:[
      {k:'Train',v:'HIKARI 637 \u00b7 Series N700 \u00b7 Ordinary'},
      {k:'Date',v:'Wednesday April 22, 2026'},
      {k:'Route',v:'Odawara 10:11 AM \u2192 Kyoto 12:12 PM'},
      {k:'Smart EX',v:'9007241665',mono:true},
      {k:'Fare',v:'\u00a523,800 (~$150) total \u00b7 Smart EX'},
      {k:'Seats',v:'TBD \u00b7 email notification after Mar 22, 2026'},
    ]},
  ],
};

const URGENT = [
  {id:'u1',label:'Book Thunderbird Limited Express \u2014 Kyoto \u2192 Kanazawa',
   sub:'Apr 26 \u00b7 ~\u00a57,120/person \u00b7 fills up on weekends \u00b7 book at smart-ex.jp or JR ticket office',
   link:'https://smart-ex.jp/en/',linkLabel:'Book at smart-ex.jp \u2197'},
  {id:'u2',label:'Book Hokuriku Shinkansen \u2014 Kanazawa \u2192 Tokyo',
   sub:'Apr 28 \u00b7 ~\u00a514,120/person \u00b7 Kagayaki is fastest (no stops) \u00b7 ~2.5 hrs',
   link:'https://smart-ex.jp/en/',linkLabel:'Book at smart-ex.jp \u2197'},
];

const BOOKED_LIST = [
  {id:'b01',label:'United flights both ways (UA 39 / UA 38)',   sub:'Conf: F354LH \u00b7 seats 31L & 31J'},
  {id:'b02',label:'Hotel Gracery Shinjuku',                     sub:'4 nights \u00b7 Apr 16\u201320 \u00b7 Conf: 5594.831.309'},
  {id:'b03',label:'teamLab Borderless tickets',                 sub:'Apr 17 \u00b7 8:30 AM \u00b7 Conf: A7YRA4LXWCN3-0001'},
  {id:'b04',label:'Fuji-Excursion 7 \u2014 Shinjuku \u2192 Kawaguchiko', sub:'Apr 20 \u00b7 Res: E77821'},
  {id:'b05',label:'Tensui Saryo Ryokan, Hakone',                sub:'2 nights \u00b7 Apr 20\u201322 \u00b7 Res: IK1516984808'},
  {id:'b06',label:'Shinkansen HIKARI 637 \u2014 Odawara \u2192 Kyoto', sub:'Apr 22 \u00b7 10:11 AM \u00b7 Res: 2002'},
  {id:'b07',label:'Hotel Granvia Kyoto',                        sub:'4 nights \u00b7 Apr 22\u201326 \u00b7 Conf: #23151SF060529'},
  {id:'b08',label:'Hotel Intergate Kanazawa',                   sub:'2 nights \u00b7 Apr 26\u201328 \u00b7 Conf: 20260125110822242'},
  {id:'b09',label:'Quintessa Hotel Tokyo Ginza',                sub:'1 night \u00b7 Apr 28\u201329 \u00b7 Conf: 6519361226'},
];

const CHECKLIST = [
  {id:'before',title:'Before you leave',items:[
    {id:'c01',label:'Check shinkansen seat assignment email',    sub:'HIKARI 637 \u2014 notification after Mar 22 at 8:00 AM Japan time'},
    {id:'c02',label:'Download teamLab app',                     sub:'Required for Infinite Crystal World \u2014 get numbered tickets in-app'},
    {id:'c03',label:'Set up Suica on Apple Wallet',             sub:'Wallet \u2192 + \u2192 Transit Card \u2192 Suica \u00b7 works at every train and convenience store'},
    {id:'c04',label:'Download Google Maps offline',             sub:'Tokyo, Kyoto, Hakone, Kanazawa, Nara, Osaka before leaving'},
    {id:'c05',label:'Set up international data or get SIM',     sub:'Pocket WiFi at HND arrival \u00b7 or eSIM (Airalo, Ubigi) before flight'},
    {id:'c06',label:'Notify credit cards of travel dates',      sub:'Call or use app \u00b7 prevent card blocks in Japan'},
    {id:'c07',label:'Get yen cash before departure',            sub:'Bring \u00a520,000\u201330,000 \u00b7 or withdraw at 7-Eleven ATM on arrival \u00b7 many places cash-only'},
    {id:'c08',label:'Download Google Translate Japanese pack',  sub:'Camera mode reads menus and signs in real time \u2014 save offline'},
    {id:'c09',label:'Screenshot all QR codes and PINs',         sub:'Offline backup: teamLab ticket, Fuji-Excursion pickup code, hotel PINs'},
    {id:'c10',label:'Confirm travel insurance is active',       sub:'Have policy number saved offline'},
    {id:'c11',label:'Add this site to iPhone home screen',      sub:'Safari \u2192 Share \u2192 Add to Home Screen'},
  ]},
  {id:'ontrip',title:'During the trip',items:[
    {id:'c12',label:'Pick up Fuji-Excursion tickets at machine', sub:'Before Apr 20 \u00b7 pickup code: 24492390994521288 at any JR machine'},
    {id:'c13',label:'Arrange takkyubin at Hotel Gracery',        sub:'Night of Apr 19 \u00b7 send luggage to Hotel Granvia Kyoto \u00b7 ~\u00a51,500/bag \u00b7 arrives Apr 21'},
    {id:'c14',label:'Get Hakone Free Pass at Gora Station',      sub:'\u00a54,000 for 2 days \u00b7 covers Tozan Railway, ropeway, and Lake Ashi boat'},
    {id:'c15',label:'Confirm Tensui Saryo check-in QR code',     sub:'Arrives via SMS from ryokan before arrival \u00b7 needed at gate'},
  ]},
];

const TIPS_DATA = [
  {title:'Money & Cash',items:[
    {title:'Always carry cash',body:'Japan is still largely cash-based. <strong>Carry \u00a515,000\u201320,000 on you at all times</strong>. Small restaurants, temples, shrine entry fees, and many neighbourhood shops are cash-only.'},
    {title:'7-Eleven ATMs',body:'<strong>7-Eleven ATMs are the most reliable for international cards</strong>, with clear English menus. Expect a \u00a5220 fee plus your bank\'s foreign transaction fee.'},
    {title:'Suica IC card',body:'<strong>Add Suica to your Apple Wallet</strong> before you leave. Top up with Apple Pay. Tap in and out at every train and bus gate. Also works at 7-Eleven, FamilyMart, and most vending machines.'},
    {title:'No tipping \u2014 ever',body:'Tipping is not done in Japan. Do not tip at restaurants, hotels, taxis, or anywhere else. Excellent service is standard and expected \u2014 no gratuity required.'},
  ]},
  {title:'Getting Around',items:[
    {title:'Trains are always on time',body:'<strong>Google Maps gives exact platform numbers and exit information</strong> \u2014 always check which exit to use before heading up. Delays of more than a few minutes are genuinely rare.'},
    {title:'Quiet on trains',body:'<strong>No phone calls on trains</strong>. Keep your voice low. Earphones are expected for music. Phone on silent. This is taken seriously by locals.'},
    {title:'Takkyubin (luggage forwarding)',body:'<strong>Japan\'s takkyubin service is one of the best things about traveling here</strong>. Drop bags at any hotel or Yamato counter and they arrive at your next hotel the following day for ~\u00a51,500\u20132,500/bag.'},
  ]},
  {title:'Etiquette & Culture',items:[
    {title:'Shoes off',body:'You will remove your shoes constantly \u2014 at ryokans, many restaurants, and some temples. <strong>Wear slip-on shoes when possible and make sure your socks are intact</strong>. Socks with holes are noticed.'},
    {title:'Eating and walking',body:'It is considered bad manners to eat or drink while walking in Japan, except at festival stalls. Eat standing at the stall or find a place to stop.'},
    {title:'Cash tray',body:'There will be a small tray at every register. <strong>Place your cash on the tray</strong>, not directly in the cashier\'s hand. Receive change the same way.'},
  ]},
  {title:'Phrases',phrases:[
    {jp:'\u3053\u3093\u306b\u3061\u306f',rom:'Konnichiwa',en:'Hello'},
    {jp:'\u3042\u308a\u304c\u3068\u3046',rom:'Arigatou',en:'Thank you'},
    {jp:'\u3059\u307f\u307e\u305b\u3093',rom:'Sumimasen',en:'Excuse me'},
    {jp:'\u3044\u304f\u3089\u3067\u3059\u304b',rom:'Ikura desu ka?',en:'How much is it?'},
    {jp:'\u82f1\u8a9e\u30e1\u30cb\u30e5\u30fc\u306f\u3042\u308a\u307e\u3059\u304b',rom:'Eigo menyu wa arimasu ka?',en:'Do you have an English menu?'},
    {jp:'\u3053\u308c\u3092\u304f\u3060\u3055\u3044',rom:'Kore wo kudasai',en:'I\'ll have this'},
    {jp:'\u30c8\u30a4\u30ec\u306f\u3069\u3053\u3067\u3059\u304b',rom:'Toire wa doko desu ka?',en:'Where is the toilet?'},
    {jp:'\u6d77\u8001\u306f\u3069\u3053\u3067\u3059\u304b',rom:'Kairo wa doko desu ka?',en:'Where is the station?'},
  ]},
];

const PACKING = [
  {cat:'Clothing \u2014 April layers (10\u00b0C nights / 20\u00b0C days)',items:[
    'Lightweight trench coat or packable jacket (essential \u2014 spring is unpredictable)',
    '2\u20133 long-sleeve tops or lightweight knits','2 short-sleeve tops (for warmer days)',
    '1 cardigan or fleece for evenings',
    'Comfortable slip-on walking shoes \u2014 NO laces (you remove them at temples, ryokan)',
    '1 pair water-resistant shoes for rain days',
    'Compact umbrella \u2014 everyone uses one',
    '5\u20137 pairs of underwear + extra socks (you remove shoes constantly)',
  ]},
  {cat:'Ryokan (Tensui Saryo)',items:[
    'Yukata and slippers are provided \u2014 you will live in them',
    'Bring toiletries if you prefer your own brands (shampoo/conditioner provided)',
    'NO need to pack pajamas',
  ]},
  {cat:'Toiletries',items:[
    'Deodorant (bring your own \u2014 Japanese versions are mild)',
    'Feminine hygiene products (tampons are hard to find \u2014 bring from home)',
    'Sunscreen SPF 30+ (apply daily \u2014 you will walk 20,000 steps)',
    'Antihistamines \u2014 sakura season means high pollen',
    'Any prescription medications in original packaging',
    'Hand sanitizer + small pack of tissues (some bathrooms have no paper towels)',
  ]},
  {cat:'Documents & Money',items:[
    'Passport (6+ months validity, 1+ empty pages)',
    'Printed copies of all confirmation emails (or this app!)',
    'Credit cards \u2014 Visa and Mastercard most accepted',
    '\u00a520,000\u201330,000 cash on arrival',
    'Travel insurance info',
  ]},
  {cat:'Tech',items:[
    'Phone + charger (Japan uses same plug as US \u2014 no adapter needed)',
    'Portable battery bank (long days away from outlets)',
    'Download: Google Maps offline, Google Translate (camera mode), teamLab app',
    'Set up Suica on Apple Wallet before the flight',
    'Earphones (required for phone use on trains)',
  ]},
  {cat:'Smart packing tips',items:[
    'Leave space in your bag \u2014 you will shop',
    'Pack packing cubes \u2014 you switch cities 5 times',
    'Use takkyubin liberally \u2014 only carry a day bag when moving between cities',
    'Hole-free socks only \u2014 yours will be inspected at every temple',
  ]},
];

function DEFAULT_BOOKED_COSTS_fn(){
  return [
    {id:'bc1',label:'United flights + Economy Plus seats',   category:'Flights',   jpy:349100, usd:2197, paidBy:'gwen', dates:'Apr 15 + Apr 29'},
    {id:'bc2',label:'Hotel Gracery Shinjuku \u00b7 4 nights', category:'Hotels',    jpy:200692, usd:1261, paidBy:'gwen', dates:'Apr 16\u201320'},
    {id:'bc3',label:'teamLab Borderless \u00b7 2 tickets',    category:'Activities',jpy:11200,  usd:70,   paidBy:'gwen', dates:'Apr 17'},
    {id:'bc4',label:'Fuji-Excursion 7',                      category:'Transport', jpy:8400,   usd:53,   paidBy:'gwen', dates:'Apr 20'},
    {id:'bc5',label:'Tensui Saryo Ryokan \u00b7 2 nights',    category:'Hotels',    jpy:126340, usd:794,  paidBy:'gwen', dates:'Apr 20\u201322'},
    {id:'bc6',label:'Shinkansen HIKARI 637',                  category:'Transport', jpy:23800,  usd:150,  paidBy:'gwen', dates:'Apr 22'},
    {id:'bc7',label:'Hotel Granvia Kyoto \u00b7 4 nights',    category:'Hotels',    jpy:268256, usd:1686, paidBy:'gwen', dates:'Apr 22\u201326'},
    {id:'bc8',label:'Hotel Intergate Kanazawa \u00b7 2 nights',category:'Hotels',   jpy:39004,  usd:245,  paidBy:'gwen', dates:'Apr 26\u201328'},
    {id:'bc9',label:'Quintessa Hotel Ginza \u00b7 1 night',   category:'Hotels',    jpy:24713,  usd:155,  paidBy:'gwen', dates:'Apr 28\u201329'},
  ];
}
const CAT_COLORS={food:'#E91E8C',drinks:'#C0392B',transport:'#4A90D9',shopping:'#F39C12',activities:'#27AE60',other:'#8E8E8E'};


// ═══════════════════════════════════════════════════════════
// RENDER FUNCTIONS
// ═══════════════════════════════════════════════════════════

function cdHtml(){
  const now=new Date(), DAY=86400000, pad=n=>String(n).padStart(2,'0');
  if(now<T_DEPART){
    const ms=T_DEPART-now, d=Math.floor(ms/DAY);
    if(d>1) return '<span class="ov-cd-num">'+d+'</span><span class="ov-cd-label">days until departure</span><span class="ov-cd-sub">Apr 15 \u00b7 LAX 11:20 AM</span>';
    if(d===1){const h=Math.floor((ms%DAY)/3600000);return '<span class="ov-cd-num">Tomorrow</span><span class="ov-cd-sub">'+h+'h until departure</span>';}
    const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000),s=Math.floor((ms%60000)/1000);
    return '<span class="ov-cd-num" style="font-size:36px">'+pad(h)+':'+pad(m)+':'+pad(s)+'</span><span class="ov-cd-label">until departure</span>';
  }
  if(now>=T_DEPART&&now<T_ARRIVE)return '<span class="ov-cd-num" style="font-size:36px">\u2708</span><span class="ov-cd-label">In the air!</span><span class="ov-cd-sub">UA39 \u2192 arriving Apr 16</span>';
  if(now>TRIP_END)return '<span class="ov-cd-num">Home</span><span class="ov-cd-label">Apr 15\u201329, 2026</span>';
  const dayNum=Math.min(Math.floor((now-T_ARRIVE)/DAY)+1,15);
  const todayId=getTodayDayId(), d=DAYS[todayId];
  return '<span class="ov-live-dot"></span><span class="ov-cd-num">'+dayNum+'<span class="ov-cd-den">/15</span></span><span class="ov-cd-label">In Japan</span>'+(d?'<span class="ov-cd-sub">'+esc(d.location.split('\u00b7')[0].trim())+'</span>':'');
}

// ── Overview ──────────────────────────────────────────────────
function renderOverview(){
  const el=$('panel-overview'); if(!el)return;
  const journeyHtml=OVERVIEW_DATA.map((stop,i)=>{
    const isLast=i===OVERVIEW_DATA.length-1;
    const hlsHtml='<ul class="ov-hls">'+stop.highlights.map(h=>{
      const inner=h.url?'<a href="'+ea(h.url)+'" target="_blank" rel="noopener">'+esc(h.text)+'<span class="ov-ext"> \u2197</span></a>':esc(h.text);
      return '<li class="ov-hl'+(h.star?' star':'')+'">'+ inner+'</li>';
    }).join('')+'</ul>';
    const dot='<div class="ov-stop-left"><div class="ov-stop-dot"></div>'+(isLast?'':'<div class="ov-stop-line"></div>')+'</div>';
    if(stop.waypoint){
      return '<div class="ov-stop waypoint'+(isLast?' ov-stop-last':'')+'">'+dot+'<div class="ov-stop-right"><div class="ov-stop-head"><div class="ov-wp-badge">Day trip</div><div class="ov-stop-city ov-wp-city">'+esc(stop.city)+'</div><div class="ov-stop-dates">'+esc(stop.dates)+'</div></div><div class="ov-stop-hotel">'+esc(stop.hotel)+'</div>'+hlsHtml+'</div></div>';
    }
    return '<div class="ov-stop'+(isLast?' ov-stop-last':'')+'">'+dot+'<div class="ov-stop-right"><div class="ov-stop-head"><div class="ov-stop-city">'+esc(stop.city)+'</div><div class="ov-stop-dates">'+esc(stop.dates)+(stop.nights?' \u00b7 '+stop.nights+' night'+(stop.nights>1?'s':''):'')+'</div></div><div class="ov-stop-hotel">'+esc(stop.hotel)+(stop.phone?' &nbsp;\u00b7 <strong>'+esc(stop.phone)+'</strong>':'')+'</div>'+hlsHtml+'</div></div>';
  }).join('');

  const now=new Date(), inTrip=now>=TRIP_START&&now<=TRIP_END;
  const todayId=getTodayDayId(), todayDay=todayId?DAYS[todayId]:null;
  const hotelGrid=OVERVIEW_DATA.filter(s=>!s.waypoint).map(s=>'<div class="hotel-cell"><div class="hotel-cell-city">'+esc(s.city.split('\u00b7')[0].trim())+'</div><div class="hotel-cell-name">'+esc(s.hotel.split('\u00b7')[0].trim())+'</div>'+(s.phone?'<div class="hotel-cell-phone">'+esc(s.phone)+'</div>':'')+'<div class="hotel-cell-dates">'+esc(s.dates)+'</div></div>').join('');

  el.innerHTML=
    '<div class="ov-hero"><div class="ov-hero-top"><div><div class="ov-eyebrow">April 15\u201329, 2026 &middot; 15 days</div><div class="ov-title">Japan</div><div class="ov-who">Gwendalynn &amp; Christina</div></div><div class="ov-cd" id="ovCd">'+cdHtml()+'</div></div>'
    +(inTrip&&todayDay?'<div class="ov-in-japan"><div class="ov-currently-label">Currently in</div><div class="ov-currently-city">'+esc(todayDay.location)+'</div></div>':'')
    +'</div>'
    +'<div class="ov-section-label">The route</div><div class="ov-route">'+journeyHtml+'</div>'
    +'<div class="ov-cta-row"><button class="ov-cta" onclick="switchTab(\'itinerary\')">View full itinerary \u2192</button></div>'
    +'<div class="ov-section-label" style="margin-top:32px">Hotels &amp; emergency contacts</div>'
    +'<div class="family-strip"><div class="hotel-grid">'+hotelGrid+'</div></div>';

  if(ovTimer)clearInterval(ovTimer);
  const closeToDepart=now<T_DEPART&&(T_DEPART-now)<86400000;
  ovTimer=setInterval(()=>{const c=$('ovCd');if(c)c.innerHTML=cdHtml();}, closeToDepart?1000:60000);
}

// ── Itinerary ─────────────────────────────────────────────────
function renderItinerary(){
  const el=$('panel-itinerary'); if(!el)return;
  const segFlexes=[5,2,4,2,1];
  const summaryBar='<div class="trip-summary-bar"><div class="tsb-top"><span class="tsb-title">JAPAN 2026 \u00b7 ROUTE</span><span class="tsb-dates">APR 15\u201329 \u00b7 15 DAYS</span></div><div class="tsb-bar">'+GROUPS.map((g,i)=>'<div class="tl-seg" style="flex:'+segFlexes[i]+';background:'+g.color+'"></div>').join('')+'</div><div class="tsb-labels">'+GROUPS.map(g=>'<div class="tsb-label-item"><div class="tsb-dot" style="background:'+g.color+'"></div>'+esc(g.label)+' <span style="color:var(--light)">'+esc(g.dates)+'</span></div>').join('')+'</div></div>';

  const hasPast=Object.keys(DAYS).some(id=>getDayClass(id)==='past');
  const toolbar=hasPast?'<div class="itin-toolbar"><button class="past-toggle-btn" id="pastToggleBtn">'+(hidePastDays?'Show past days':'Hide past days')+'</button></div>':'';

  const sections=GROUPS.map((g,i)=>{
    const vis=g.ids.filter(id=>!(hidePastDays&&getDayClass(id)==='past'));
    if(!vis.length)return '';
    return '<div class="dest-section" id="section-'+i+'"><div class="dest-header"><span class="dest-name">'+esc(g.label)+'</span><span class="dest-dates-label">'+esc(g.dates)+'</span></div>'+vis.map(id=>renderDay(DAYS[id])).join('')+'</div>';
  }).join('');

  el.innerHTML=summaryBar+toolbar+sections;

  el.querySelectorAll('.day-header').forEach(h=>{
    h.addEventListener('click',()=>{
      const card=h.parentElement, dayId=card.id.replace('card-','');
      card.classList.toggle('expanded');
      if(card.classList.contains('expanded')){
        expandedCards.add(dayId);
        injectDayActsSection(dayId);
        initSortable(dayId);
      } else {
        expandedCards.delete(dayId);
      }
    });
  });

  expandedCards.forEach(dayId=>{
    const card=document.getElementById('card-'+dayId);
    if(card&&!card.classList.contains('expanded')){
      card.classList.add('expanded');
      injectDayActsSection(dayId);
      initSortable(dayId);
    }
  });

  // Auto-expand today + tomorrow, scroll to today
  const todayId=getTodayDayId();
  if(todayId&&!expandedCards.size){
    const dayKeys=Object.keys(DAY_DATES);
    const todayIdx=dayKeys.indexOf(todayId);
    const card=document.getElementById('card-'+todayId);
    if(card){
      card.classList.add('expanded');
      expandedCards.add(todayId);
      injectDayActsSection(todayId);
      initSortable(todayId);
    }
    if(todayIdx>=0&&todayIdx<dayKeys.length-1){
      const tmrwId=dayKeys[todayIdx+1];
      const tmrwCard=document.getElementById('card-'+tmrwId);
      if(tmrwCard){
        tmrwCard.classList.add('expanded');
        expandedCards.add(tmrwId);
        injectDayActsSection(tmrwId);
        initSortable(tmrwId);
      }
    }
    if(card)setTimeout(()=>{
      const hH=document.querySelector('header')?.offsetHeight||0;
      const pH=$('destPillsWrap')?.offsetHeight||0;
      window.scrollTo({top:card.getBoundingClientRect().top+window.scrollY-hH-pH-12,behavior:'smooth'});
    },300);
  }
  $('pastToggleBtn')?.addEventListener('click',()=>{hidePastDays=!hidePastDays;renderItinerary();buildDestPills();});
}

function renderDay(d){
  const cls=getDayClass(d.id), isToday=cls==='today';
  const noteText=notes[d.id]||'';
  const noteRead=noteText?noteText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>'):(currentUser?'<em>No notes yet \u2014 type below to add.</em>':'<em>No notes yet.</em>');

  const dateId=dayIdToDate(d.id), fsDay=firestoreDays[dateId];
  const isEdit=!!currentUser;
  let bodyContent;

  if(fsDay&&fsDay.activities&&fsDay.activities.length>0){
    const acts=sortActivitiesByTime([...fsDay.activities]);
    bodyContent=acts.map(act=>{
      if(act.type==='period-label')return '<div class="period"><div class="period-label">'+esc(act.title)+'</div></div>';
      return renderFsItem(d.id,act,isEdit);
    }).join('');
    bodyContent+=isEdit?'<button class="add-act-btn" onclick="openAddAct(\''+d.id+'\')">+ Add activity</button>':'';
    const tipText=fsDay?.tip||d.tip||'';
    bodyContent+=tipText?'<div class="tip-block"><span class="tip-label">Tip </span>'+tipText+'</div>':'';
  } else {
    bodyContent=d.periods.map(p=>'<div class="period"><div class="period-label">'+p.label+'</div>'+p.items.map(item=>renderStaticItem(item,d.id,isEdit)).join('')+'</div>').join('');
    bodyContent+=isEdit?'<button class="add-act-btn" onclick="openAddAct(\''+d.id+'\')">+ Add activity</button>':'';
    bodyContent+=d.tip?'<div class="tip-block"><span class="tip-label">Tip </span>'+d.tip+'</div>':'';
  }

  const title=fsDay?.title||d.title, location=fsDay?.location||d.location;
  return '<div class="day-card '+cls+'" id="card-'+d.id+'">'
    +'<div class="day-header">'
    +'<div class="day-header-left"><span class="day-date">'+d.date+'</span>'
    +'<div class="day-title-wrap"><div class="day-title">'+esc(title)+(isToday?'<span class="today-badge">TODAY</span>':'')+'</div>'
    +'<div class="day-location">'+esc(location)+'</div></div></div>'
    +'<div class="day-header-right"><span class="notes-dot'+(noteText?' has-notes':'')+'"></span><span class="day-toggle">&#9660;</span></div>'
    +'</div>'
    +'<div class="day-body">'+bodyContent
    +'<div class="notes-section"><div class="notes-label">Notes</div>'
    +'<div class="notes-read">'+noteRead+'</div>'
    +'<textarea class="notes-edit" data-day="'+d.id+'" placeholder="Add notes, restaurant picks, reminders\u2026">'+esc(noteText)+'</textarea>'
    +'<div class="save-indicator" id="save-'+d.id+'"></div>'
    +'</div></div></div>';
}

function renderFsItem(dayId,act,isEdit){
  const isSub=act.sub===true, isBooked=act.booked===true;
  const tag=isBooked&&!isSub?'<span class="tag-booked">BOOKED</span>':'';
  const time=act.time&&!isSub?'<div class="act-time">'+esc(act.time)+'</div>':'<div class="act-time"></div>';
  const dur=act.dur?'<div class="act-duration">'+esc(act.dur)+'</div>':'';
  const titleText=act.addr
    ?'<a href="https://maps.google.com/?q='+encodeURIComponent(act.addr)+'" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;text-decoration-color:var(--border-lt)">'+esc(act.title)+'</a>'+tag
    :esc(act.title)+tag;
  let confHtml='';
  if(act.conf)confHtml='<button class="conf-toggle-btn" onclick="toggleInlineConf(this)">\u25b8 show details</button><div class="inline-conf">'+esc(act.conf)+'</div>';
  const editBtns=isEdit
    ?'<span class="item-edit-btns">'
      +'<button class="conf-toggle-btn" onclick="openEditAct(\''+ea(dayId)+'\',\''+ea(act.id)+'\')" title="Edit">\u270e</button>'
      +'<button class="conf-toggle-btn" onclick="deleteAct(\''+ea(dayId)+'\',\''+ea(act.id)+'\')" title="Delete">\u2715</button>'
      +'</span>':'' ;
  if(isSub)return '<div class="act sub-item"><div class="act-time"></div><div class="act-body"><div class="act-sub">'+titleText+dur+'</div></div></div>';
  const desc=act.desc?'<div class="act-sub">'+esc(act.desc)+'</div>':'';
  const dragAttr=isEdit?' draggable="true" data-act-id="'+ea(act.id)+'" data-day-id="'+ea(dayId)+'"':'';
  return '<div class="act'+(isBooked?' booked':'')+'"'+dragAttr+'>'+time+'<div class="act-body"><div class="act-text">'+titleText+'</div>'+desc+dur+confHtml+'</div>'+editBtns+'</div>';
}

function renderStaticItem(item,dayId,isEdit){
  const isSub=item.sub===true;
  const tag=item.type==='booked'&&!isSub?'<span class="tag-booked">BOOKED</span>':'';
  const time=item.time&&!isSub?'<div class="act-time">'+item.time+'</div>':'<div class="act-time"></div>';
  const dur=item.dur?'<div class="act-duration">'+item.dur+'</div>':'';
  const textContent=item.addr
    ?'<a href="https://maps.google.com/?q='+encodeURIComponent(item.addr)+'" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;text-decoration-color:var(--border-lt)">'+item.text+'</a>'+tag
    :item.text+tag;
  let confHtml='';
  if(item.type==='booked'&&!isSub){const c=findConfForItem(item.text);if(c)confHtml='<button class="conf-toggle-btn" onclick="toggleInlineConf(this)">\u25b8 show details</button><div class="inline-conf">'+c+'</div>';}
  if(isSub)return '<div class="act sub-item"><div class="act-time"></div><div class="act-body"><div class="act-sub">'+textContent+dur+'</div></div></div>';
  return '<div class="act'+(item.type==='booked'?' booked':'')+'">'+time+'<div class="act-body"><div class="act-text">'+textContent+'</div>'+dur+confHtml+'</div></div>';
}

window.toggleInlineConf=function(btn){
  const c=btn.nextElementSibling; if(!c)return;
  const o=c.classList.toggle('show');
  btn.textContent=o?'\u25be hide details':'\u25b8 show details';
};

function findConfForItem(text){
  if(!text)return null;
  const t=text.toLowerCase();
  if(t.includes('ua 39')||t.includes('departs lax'))return 'Conf: F354LH \u00b7 Seats 31L & 31J \u00b7 Boeing 787-10';
  if(t.includes('ua 38')||t.includes('departs hnd'))return 'Conf: F354LH \u00b7 Seats 31J & 31L \u00b7 Arrives LAX 12:15 PM';
  if(t.includes('gracery')&&t.includes('check in'))return 'Conf: 5594.831.309 \u00b7 PIN: 6506 \u00b7 +81 3 6833 1111';
  if(t.includes('tensui')&&t.includes('check in'))return 'Res: IK1516984808 \u00b7 Verify: 0F35443D931C12B \u00b7 +81-570-062-302';
  if(t.includes('kaiseki'))return 'Dinner at 19:45 \u00b7 10-course kaiseki \u00b7 included';
  if(t.includes('fuji-excursion')||t.includes('fuji excursion'))return 'Res: E77821 \u00b7 Pickup: 24492390994521288 \u00b7 Car 3, 13-C & 13-D';
  if(t.includes('hikari 637'))return 'Res: 2002 \u00b7 Smart EX: 9007241665 \u00b7 \u00a523,800 total';
  if(t.includes('granvia')&&t.includes('check'))return 'Conf: #23151SF060529 \u00b7 +81-75-344-8888';
  if(t.includes('intergate')&&t.includes('check'))return 'Conf: 20260125110822242 \u00b7 Expedia: 73356721260247';
  if(t.includes('quintessa')&&t.includes('check'))return 'Conf: 6519361226 \u00b7 PIN: 9235 \u00b7 +81 3-6264-1351';
  if(t.includes('takkyubin'))return 'Send from Gracery front desk \u00b7 ~\u00a51,500\u20132,000/bag \u00b7 arrives Apr 21';
  if(t.includes('teamlab'))return 'Conf: A7YRA4LXWCN3-0001 \u00b7 Entry 08:30\u201309:00';
  return null;
}

// ── Firestore day activities injection ────────────────────────
function injectDayActsSection(dayId){
  const card=document.getElementById('card-'+dayId);
  if(!card||!card.classList.contains('expanded'))return;
  if(!currentUser)return;
  const dayBody=card.querySelector('.day-body');
  if(dayBody&&dayBody.querySelector('.add-act-btn'))return;
  card.querySelector('.day-acts-section')?.remove();
  const acts=getDayActivities(dayId)||[];
  const sec=document.createElement('div');
  sec.className='day-acts-section';
  sec.innerHTML='<div class="day-acts-label">Your additions</div>'
    +'<div class="day-acts-list" id="acts-list-'+dayId+'">'+renderFsActivities(dayId,acts)+'</div>'
    +'<button class="add-act-btn" onclick="openAddAct(\''+dayId+'\')">+ Add activity, note, or reminder</button>';
  const ns=card.querySelector('.notes-section');
  ns?dayBody.insertBefore(sec,ns):dayBody.appendChild(sec);
}

function getDayActivities(dayId){
  const dateId=dayIdToDate(dayId);
  return firestoreDays[dateId]?sortActivitiesByTime([...(firestoreDays[dateId].activities||[])]):null;
}

function renderFsActivities(dayId,acts){
  if(!acts||!acts.length)return currentUser
    ?'<div class="fs-empty">Nothing added yet.</div>'
    :'<div class="fs-empty">Sign in to add activities.</div>';
  return acts.map(act=>{
    const cat=act.category||'other';
    const cost=act.cost&&act.cost>0?(act.currency==='JPY'?'\u00a5'+Math.round(act.cost).toLocaleString():'$'+Number(act.cost).toFixed(2)):'';
    const thumb=act.driveUrl?driveUrlToThumb(act.driveUrl):null;
    const photo=thumb
      ?'<div class="fs-act-photo" onclick="openLightbox(\''+ea(thumb)+'\',\''+ea(act.driveUrl||'')+'\')">'
        +'<img src="'+ea(thumb)+'" alt="" loading="lazy" onerror="this.closest(\'.fs-act-photo\').style.display=\'none\'">'
        +'<div class="fs-act-photo-label">Google Drive photo</div></div>'
      :'';
    return '<div class="fs-act-card" draggable="'+!!currentUser+'" data-act-id="'+ea(act.id)+'" data-day-id="'+ea(dayId)+'">'
      +'<div class="fs-act-stripe cat-stripe-'+cat+'"></div><div class="fs-act-body">'
      +'<div class="fs-act-top"><span class="fs-act-title">'+esc(act.title||'')+'</span>'+(act.time?'<span class="fs-act-time">'+esc(act.time)+'</span>':'')+'</div>'
      +'<div class="fs-act-meta"><span class="fs-act-tag cat-'+cat+'">'+esc(cat)+'</span>'+(cost?'<span class="fs-act-cost">'+cost+'</span>':'')+'</div>'
      +(act.notes?'<div class="fs-act-notes">'+esc(act.notes)+'</div>':'')
      +photo+'</div>'
      +(currentUser
        ?'<div class="fs-act-actions">'
          +'<button class="fs-act-btn" onclick="openEditAct(\''+ea(dayId)+'\',\''+ea(act.id)+'\')">Edit</button>'
          +'<button class="fs-act-btn del" onclick="deleteAct(\''+ea(dayId)+'\',\''+ea(act.id)+'\')">Delete</button>'
          +'</div>':''
      )+'</div>';
  }).join('');
}

function driveUrlToThumb(url){
  if(!url)return null;
  const m=url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)||url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m?'https://drive.google.com/thumbnail?id='+m[1]+'&sz=w480':null;
}

// ── Sortable drag-and-drop (touch + mouse via SortableJS) ─────
// Requires SortableJS CDN in index.html:
// <script src="https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.2/Sortable.min.js"></script>
function initSortable(dayId){
  if(typeof Sortable==='undefined'||!currentUser)return;
  const card=document.getElementById('card-'+dayId); if(!card)return;
  const dayBody=card.querySelector('.day-body'); if(!dayBody)return;
  // Destroy existing instance to avoid double-init on re-render
  if(dayBody._sortable){dayBody._sortable.destroy();dayBody._sortable=null;}
  dayBody._sortable=Sortable.create(dayBody,{
    animation:150,
    draggable:'.act[draggable="true"]',
    ghostClass:'act-sortable-ghost',
    onEnd:async evt=>{
      if(evt.oldIndex===evt.newIndex)return;
      const dateId=dayIdToDate(dayId), dd=firestoreDays[dateId]; if(!dd)return;
      // Read new visual order of all draggable items
      const ids=[...dayBody.querySelectorAll('.act[draggable="true"]')].map(el=>el.dataset.actId);
      let acts=[...(dd.activities||[])];
      ids.forEach((id,i)=>{const a=acts.find(x=>x.id===id);if(a)a.order=i;});
      await db.collection('days').doc(dateId).set({...dd,dayDate:dateId,activities:acts});
      showToast('Reordered','ok');
    }
  });
}

// ── Activity modal ────────────────────────────────────────────
window.openAddAct=function(dayId){
  editActDayId=dayId; editActId=null;
  $('actModalTitle').textContent='Add activity';
  ['actTime','actTitle','actNotes','actCost','actPhoto'].forEach(id=>$(id)&&($(id).value=''));
  if($('actCategory'))$('actCategory').value='activity';
  if($('actCurrency'))$('actCurrency').value='JPY';
  if($('actBooked'))$('actBooked').checked=false;
  $('actErr')?.classList.add('hidden');
  openModal('activityModal');
  setTimeout(()=>$('actTitle')?.focus(),80);
};

window.openEditAct=function(dayId,actId){
  const dd=firestoreDays[dayIdToDate(dayId)]; if(!dd)return;
  const act=dd.activities?.find(a=>a.id===actId); if(!act)return;
  editActDayId=dayId; editActId=actId;
  $('actModalTitle').textContent='Edit activity';
  if($('actTime'))    $('actTime').value=act.time||'';
  if($('actTitle'))   $('actTitle').value=act.title||'';
  if($('actCategory'))$('actCategory').value=act.category||'activity';
  if($('actNotes'))   $('actNotes').value=act.notes||'';
  if($('actCost'))    $('actCost').value=act.cost||'';
  if($('actCurrency'))$('actCurrency').value=act.currency||'JPY';
  if($('actPhoto'))   $('actPhoto').value=act.driveUrl||'';
  if($('actBooked'))  $('actBooked').checked=!!act.booked;
  $('actErr')?.classList.add('hidden');
  openModal('activityModal');
  setTimeout(()=>$('actTitle')?.focus(),80);
};

window.deleteAct=async function(dayId,actId){
  if(!confirm('Delete this activity?'))return;
  const dateId=dayIdToDate(dayId), dd=firestoreDays[dateId]; if(!dd)return;
  const acts=(dd.activities||[]).filter(a=>a.id!==actId).map((a,i)=>({...a,order:i}));
  await db.collection('days').doc(dateId).set({...dd,dayDate:dateId,activities:acts});
  showToast('Activity deleted');
};

async function saveActivity(){
  const title=$('actTitle')?.value.trim();
  if(!title){
    $('actErr')?.classList.remove('hidden');
    if($('actErr'))$('actErr').textContent='Title is required.';
    return;
  }
  $('actErr')?.classList.add('hidden');
  const btn=$('actSaveBtn'); if(btn){btn.textContent='Saving\u2026';btn.disabled=true;}
  try{
    const dateId=dayIdToDate(editActDayId);
    const dd=firestoreDays[dateId]||{dayDate:dateId,activities:[]};
    let acts=[...(dd.activities||[])];
    const newAct={
      id:editActId||('act-'+Date.now()),
      time:$('actTime')?.value||'',
      title,
      category:$('actCategory')?.value||'activity',
      notes:$('actNotes')?.value.trim()||'',
      cost:parseFloat($('actCost')?.value)||0,
      currency:$('actCurrency')?.value||'JPY',
      driveUrl:$('actPhoto')?.value.trim()||'',
      booked:!!$('actBooked')?.checked,
      order:acts.length,
    };
    if(editActId){
      const i=acts.findIndex(a=>a.id===editActId);
      if(i!==-1)acts[i]={...acts[i],...newAct};
    } else {
      newAct.order=acts.length;
      acts.push(newAct);
    }
    acts=sortActivitiesByTime(acts);
    await db.collection('days').doc(dateId).set({...dd,dayDate:dateId,activities:acts});
    closeModal('activityModal');
    showToast(editActId?'Activity updated':'Activity added','ok');
  }catch(e){
    $('actErr')?.classList.remove('hidden');
    if($('actErr'))$('actErr').textContent='Could not save.';
  }finally{
    if(btn){btn.textContent='Save';btn.disabled=false;}
  }
}
$('actSaveBtn')?.addEventListener('click',saveActivity);

// ── Bookings ──────────────────────────────────────────────────
function renderBookings(){
  const el=$('panel-bookings'); if(!el)return;
  const driveEmbedUrl=driveUrlToEmbed(driveFolderUrl);
  const driveOpenUrl=driveFolderUrl||null;

  const driveHtml='<div class="drive-section" id="driveSection">'
    +'<div class="drive-hd" onclick="toggleDriveSection()">'
    +'<div class="drive-hd-left"><div class="drive-icon"><svg width="28" height="22" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5L6.6 66.85z" fill="#0066DA"/><path d="M43.65 25L29.9 2 14.65 29l13.75 24 15.25-27 0 0z" fill="#00AC47"/><path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.45 9.5 8.3 14.3z" fill="#EA4335"/><path d="M43.65 25L57.4 2H29.9L16.15 25l13.75 24 13.75-24z" fill="#00832D"/><path d="M59.8 53l-16.15 0-13.75 24 29.9 0 16.15-28L59.8 53z" fill="#2684FC"/><path d="M73.4 26.5l-14.65-25c-.8-1.4-1.95-2.5-3.3-3.3L57.4 2 43.65 25l16.15 28 23.8 0c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z" fill="#FFBA00"/></svg></div>'
    +'<div class="drive-hd-text"><div class="drive-hd-title">Confirmation Documents</div><div class="drive-hd-sub">Google Drive folder \u00b7 PDFs, receipts, photos</div></div></div>'
    +'<span class="drive-toggle">&#9660;</span></div>'
    +'<div class="drive-body" id="driveBody">'
    +(driveEmbedUrl
      ?'<div class="drive-embed-wrap"><iframe src="'+ea(driveEmbedUrl)+'" allowfullscreen loading="lazy" title="Documents"></iframe></div>'
      :'<div class="drive-embed-empty"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".3"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg><p>No folder linked yet</p><small>Paste a Google Drive URL below</small></div>')
    +(driveOpenUrl?'<a class="drive-open-link" href="'+ea(driveOpenUrl)+'" target="_blank" rel="noopener">Open folder in Google Drive \u2197</a>':'')
    +'<div class="drive-url-row"><input class="drive-url-input" id="driveUrlInput" type="url" placeholder="Paste Google Drive folder URL\u2026" value="'+ea(driveFolderUrl)+'">'
    +'<button class="drive-url-save" id="driveUrlSave">Save</button></div></div></div>';

  const confs=[{key:'flights',title:'FLIGHTS'},{key:'hotels',title:'HOTELS'},{key:'trains',title:'TRAINS &amp; ACTIVITIES'}].map(s=>
    '<div class="conf-group"><div class="conf-group-title">'+s.title+'</div>'
    +(CONFIRMATIONS[s.key]||[]).map(card=>
      '<div class="conf-card"><div class="conf-name">'+esc(card.name)+'</div>'
      +'<div class="conf-number-row">'
      +'<span class="conf-number-label">'+esc(card.number.label)+'</span>'
      +'<span class="conf-number-val">'+esc(card.number.val)+'</span>'
      +'<button class="copy-btn" data-copy="'+ea(card.number.val)+'" title="Copy to clipboard">Copy</button>'
      +'</div>'
      +card.rows.map(r=>'<div class="conf-row"><span class="conf-key">'+esc(r.k)+'</span><span class="conf-val'+(r.mono?' mono':'')+'">'+
        (r.addr?'<a href="https://maps.google.com/?q='+encodeURIComponent(r.addr)+'" target="_blank" rel="noopener">'+esc(r.v)+'</a>':esc(r.v))
        +'</span></div>').join('')
      +'</div>'
    ).join('')+'</div>'
  ).join('');

  el.innerHTML=driveHtml+confs;

  $('driveUrlSave')?.addEventListener('click',()=>saveDriveUrl($('driveUrlInput')?.value.trim()||''));
  $('driveUrlInput')?.addEventListener('keydown',e=>{if(e.key==='Enter')saveDriveUrl($('driveUrlInput').value.trim());});

  el.querySelectorAll('.copy-btn').forEach(btn=>{
    btn.addEventListener('click',async()=>{
      try{
        await navigator.clipboard.writeText(btn.dataset.copy||'');
        btn.textContent='Copied!'; btn.classList.add('copied');
        setTimeout(()=>{btn.textContent='Copy';btn.classList.remove('copied');},1800);
      }catch{}
    });
  });
}

window.deleteBookedCost=async function(id){
  bookedCosts=bookedCosts.filter(c=>c.id!==id);
  await db.collection('settings').doc('bookedCosts').set({items:bookedCosts});
  renderBudget();
  showToast('Removed','ok');
};
window.toggleDriveSection=function(){$('driveSection')?.classList.toggle('expanded');};

function driveUrlToEmbed(url){
  if(!url)return null;
  const m=url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m?'https://drive.google.com/embeddedfolderview?id='+m[1]+'#list':null;
}
async function saveDriveUrl(url){
  driveFolderUrl=url;
  try{localStorage.setItem('japan-drive-url',url);}catch{}
  if(currentUser){try{await db.collection('settings').doc('drive').set({folderUrl:url});}catch{}}
  renderBookings(); showToast('Drive folder saved','ok');
}

// ── Plan ──────────────────────────────────────────────────────
function renderPlan(){
  const el=$('panel-plan'); if(!el)return;
  const tabBar='<div class="pt-tabs">'
    +'<button class="pt-tab'+(ptTab==='tasks'?' active':'')+'" data-pt="tasks">Checklist</button>'
    +'<button class="pt-tab'+(ptTab==='packing'?' active':'')+'" data-pt="packing">Packing</button>'
    +'<button class="pt-tab'+(ptTab==='tips'?' active':'')+'" data-pt="tips">Japan Tips</button>'
    +'</div>';

  const dismissed=JSON.parse(localStorage.getItem('japan-dismissed')||'{}');
  const visibleUrgent=URGENT.filter(u=>!dismissed[u.id]);
  const urgentHtml=visibleUrgent.length?'<div class="urgent-wrap">'
    +'<div class="urgent-hd"><span class="urgent-label">&#9888; Still needs booking</span></div>'
    +visibleUrgent.map(u=>'<div class="urgent-item"><div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div>'
      +'<div class="urgent-title">'+esc(u.label)+'</div>'
      +'<div class="urgent-sub">'+esc(u.sub)+'</div>'
      +(u.link?'<a href="'+ea(u.link)+'" target="_blank" rel="noopener" class="urgent-link">'+esc(u.linkLabel)+'</a>':'')
      +'</div><button class="conf-toggle-btn" onclick="dismissUrgent(\''+u.id+'\')" title="Mark as booked" style="font-size:11px;white-space:nowrap;color:var(--green)">\u2713 Booked</button></div></div>').join('')
    +'</div>':'';

  const bookedHtml='<div class="cl-section" id="cl-booked">'
    +'<div class="cl-section-hd" onclick="toggleClSection(\'booked\')">'
    +'<span class="cl-section-title">Booked &amp; confirmed</span>'
    +'<div class="cl-section-meta"><span class="cl-progress"><span style="color:var(--green)">'+BOOKED_LIST.length+'</span> / '+BOOKED_LIST.length+'</span><span class="cl-toggle">&#9660;</span></div></div>'
    +'<div class="cl-items">'+BOOKED_LIST.map(item=>'<div class="check-item done"><div class="check-box always-checked"></div>'
      +'<div><div class="check-label">'+esc(item.label)+'</div>'+(item.sub?'<div class="check-sub">'+esc(item.sub)+'</div>':'')+'</div></div>').join('')
    +'</div></div>';

  const checklistHtml=CHECKLIST.map(sec=>{
    const done=sec.items.filter(i=>checks[i.id]).length;
    return '<div class="cl-section expanded" id="cl-'+sec.id+'">'
      +'<div class="cl-section-hd" onclick="toggleClSection(\''+sec.id+'\')"><span class="cl-section-title">'+esc(sec.title)+'</span>'
      +'<div class="cl-section-meta"><span class="cl-progress"><span>'+done+'</span> / '+sec.items.length+'</span><span class="cl-toggle">&#9660;</span></div></div>'
      +'<div class="cl-items">'+sec.items.map(item=>'<div class="check-item'+(checks[item.id]?' done':'')+'" data-check="'+item.id+'">'
        +'<div class="check-box'+(checks[item.id]?' checked':'')+'"></div>'
        +'<div style="flex:1"><div class="check-label">'+esc(item.label)+'</div>'+(item.sub?'<div class="check-sub">'+esc(item.sub)+'</div>':'')+'</div>'
        +(currentUser?'<button class="conf-toggle-btn" onclick="event.stopPropagation();deleteCheckItem(\''+sec.id+'\',\''+item.id+'\')" title="Remove" style="opacity:0.3;font-size:11px">&times;</button>':'')
        +'</div>').join('')
      +(currentUser?'<div style="display:flex;gap:6px;padding:10px 16px;border-top:1px solid var(--border-lt)">'
        +'<input type="text" class="form-input" id="clAdd-'+sec.id+'" placeholder="Add a task\u2026" style="flex:1;font-size:14px;padding:6px 10px" onkeydown="if(event.key===\'Enter\')addCheckItem(\''+sec.id+'\')">'
        +'<button class="btn-primary" onclick="addCheckItem(\''+sec.id+'\')" style="font-size:13px;padding:6px 12px">Add</button></div>':'')
      +'</div></div>';
  }).join('');

  const packChecks=JSON.parse(localStorage.getItem('japan-packing')||'{}');
  const packingHtml=PACKING.map((group,gi)=>'<div class="pack-cat">'
    +'<div class="pack-cat-head">'+esc(group.cat)+'</div>'
    +group.items.map((item,ii)=>{
      const pid='pk-'+gi+'-'+ii;
      const done=packChecks[pid];
      return '<div class="pack-item-row'+(done?' packed':'')+'" data-pack="'+pid+'">'
        +'<input type="checkbox" '+(done?'checked ':'')+' onchange="togglePack(&quot;'+pid+'&quot;,this.checked)">'
        +'<span class="pack-item-text">'+esc(item)+'</span>'
        +(currentUser?'<button class="conf-toggle-btn" onclick="event.stopPropagation();deletePackItem('+gi+','+ii+')" title="Remove" style="opacity:0.3;font-size:11px;margin-left:auto">&times;</button>':'')
        +'</div>';
    }).join('')
    +'</div>').join('')
    +(currentUser?'<div style="margin-top:16px;padding:12px 0;border-top:1px solid var(--border-lt)">'
    +'<div style="font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--light);margin-bottom:8px">Add item</div>'
    +'<div style="display:flex;gap:6px"><select class="form-input form-select" id="packCatSel" style="width:auto;min-width:120px;font-size:14px;padding:6px 8px">'+PACKING.map(g=>'<option>'+esc(g.cat.split('\u2014')[0].trim())+'</option>').join('')+'</select>'
    +'<input type="text" class="form-input" id="packAddInput" placeholder="Item to pack\u2026" style="flex:1;font-size:14px;padding:6px 8px">'
    +'<button class="btn-primary" onclick="addPackItem()" style="font-size:13px;padding:6px 12px">Add</button></div></div>':'');

  const tipsHtml=TIPS_DATA.map(sec=>'<div class="tips-section">'
    +'<div class="tips-section-title">'+esc(sec.title)+'</div>'
    +(sec.phrases?'<div class="tip-card"><div class="tip-card-body">'+sec.phrases.map(p=>'<div class="tip-phrase-row"><span class="tip-phrase-jp">'+esc(p.jp)+'</span><span class="tip-phrase-rom">'+esc(p.rom)+'</span><span class="tip-phrase-en">'+esc(p.en)+'</span></div>').join('')+'</div></div>'
    :sec.items.map(tip=>'<div class="tip-card"><div class="tip-card-title">'+esc(tip.title)+'</div><div class="tip-card-body">'+tip.body+'</div></div>').join(''))
    +'</div>').join('');

  // Packing progress — only count keys that correspond to current valid items
  const packChecksAll=JSON.parse(localStorage.getItem('japan-packing')||'{}');
  const totalPackItems=PACKING.reduce((s,g)=>s+g.items.length,0);
  let packedCount=0;
  PACKING.forEach((group,gi)=>{group.items.forEach((_,ii)=>{if(packChecksAll['pk-'+gi+'-'+ii])packedCount++;});});
  const packPct=totalPackItems?Math.round((packedCount/totalPackItems)*100):0;
  const packProgressHtml='<div class="pack-progress"><div class="pack-progress-text"><span>'+packedCount+'</span> / '+totalPackItems+' packed</div><div class="pack-progress-bar"><div class="pack-progress-fill" style="width:'+packPct+'%"></div></div><div class="pack-progress-text">'+packPct+'%</div></div>';

  el.innerHTML=tabBar
    +'<div class="pt-panel'+(ptTab==='tasks'?' active':'')+'" id="pt-tasks">'+urgentHtml+checklistHtml+bookedHtml+'</div>'
    +'<div class="pt-panel'+(ptTab==='packing'?' active':'')+'" id="pt-packing">'+packProgressHtml+packingHtml+'</div>'
    +'<div class="pt-panel'+(ptTab==='tips'?' active':'')+'" id="pt-tips">'+tipsHtml+'</div>'
    +(currentUser?'<div style="margin-top:32px;padding-top:20px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">'
      +'<div><div style="font-size:13px;font-weight:500;color:var(--text)">Export trip data</div>'
      +'<div style="font-size:12px;color:var(--light)">Download itinerary, bookings, budget, and notes as JSON</div></div>'
      +'<div style="display:flex;gap:6px"><button class="booked-edit-btn" onclick="exportTripData()" style="white-space:nowrap">Export JSON</button>'
      +'<button class="booked-edit-btn" onclick="importTripData()" style="white-space:nowrap">Import JSON</button></div></div>':'');

  el.querySelectorAll('.pt-tab').forEach(btn=>btn.addEventListener('click',()=>{ptTab=btn.dataset.pt;renderPlan();}));
  el.querySelectorAll('.check-item[data-check]').forEach(item=>item.addEventListener('click',()=>toggleCheck(item.dataset.check)));
}

window.dismissUrgent=function(id){
  const d=JSON.parse(localStorage.getItem('japan-dismissed')||'{}');
  d[id]=true;
  localStorage.setItem('japan-dismissed',JSON.stringify(d));
  renderPlan();
  showToast('Marked as booked','ok');
};
window.toggleClSection=function(id){document.getElementById('cl-'+id)?.classList.toggle('expanded');};

async function toggleCheck(id){
  checks[id]=!checks[id]; renderPlan();
  if(currentUser){try{await db.collection('checks').doc('all').set(checks);}catch{}}
  else{try{localStorage.setItem('japan-checks',JSON.stringify(checks));}catch{}}
}

window.addCheckItem=function(secId){
  const inp=$('clAdd-'+secId); if(!inp||!inp.value.trim())return;
  const sec=CHECKLIST.find(s=>s.id===secId); if(!sec)return;
  const newId='c-'+Date.now();
  sec.items.push({id:newId,label:inp.value.trim(),sub:''});
  inp.value='';
  renderPlan();
  showToast('Task added','ok');
};
window.deleteCheckItem=function(secId,itemId){
  const sec=CHECKLIST.find(s=>s.id===secId); if(!sec)return;
  sec.items=sec.items.filter(i=>i.id!==itemId);
  delete checks[itemId];
  renderPlan();
  showToast('Task removed');
};

window.togglePack=function(id,val){
  const pc=JSON.parse(localStorage.getItem('japan-packing')||'{}');
  if(val)pc[id]=true; else delete pc[id];
  localStorage.setItem('japan-packing',JSON.stringify(pc));
  renderPlan();
};
window.addPackItem=function(){
  const inp=$('packAddInput'), sel=$('packCatSel');
  if(!inp||!sel||!inp.value.trim())return;
  const catName=sel.value.trim();
  const group=PACKING.find(g=>g.cat.startsWith(catName));
  if(group){group.items.push(inp.value.trim()); inp.value=''; renderPlan(); showToast('Added to packing list','ok');}
};
window.deletePackItem=function(gi,ii){
  if(PACKING[gi]&&PACKING[gi].items[ii]!==undefined){
    PACKING[gi].items.splice(ii,1);
    renderPlan();
    showToast('Removed from packing list');
  }
};

// ── Budget ────────────────────────────────────────────────────
function renderBudget(){
  const el=$('panel-budget'); if(!el)return;
  if(!currentUser){
    el.innerHTML='<div class="budget-gate">'
      +'<div class="budget-gate-icon">\u00a5</div>'
      +'<div class="budget-gate-title">Budget is private</div>'
      +'<div class="budget-gate-sub">Expense tracking and settlement is only<br>visible to Gwendalynn &amp; Christina.</div>'
      +'<button class="budget-gate-btn" onclick="openModal(\'authModal\')">'
      +'<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#fff" opacity=".7" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/></svg>'
      +'Sign in with Google</button></div>';
    return;
  }

  let gwenPaid=0, christinaPaid=0, settlement=0;
  bookedCosts.forEach(c=>{
    if(!c.jpy)return;
    if(c.paidBy==='gwen'){gwenPaid+=c.jpy; settlement+=c.jpy/2;}
    else if(c.paidBy==='christina'){christinaPaid+=c.jpy; settlement-=c.jpy/2;}
    else if(c.paidBy==='split'){gwenPaid+=c.jpy/2; christinaPaid+=c.jpy/2;}
  });
  expenses.forEach(e=>{
    const a=e.amount||0;
    if(e.paidBy==='gwen'){gwenPaid+=a; if(e.split)settlement+=a/2;}
    else if(e.paidBy==='christina'){christinaPaid+=a; if(e.split)settlement-=a/2;}
  });
  const bookedTotal=bookedCosts.reduce((s,c)=>s+(c.jpy||0),0);
  const expTotal=expenses.reduce((s,e)=>s+(e.amount||0),0);
  const grandTotal=bookedTotal+expTotal;

  const christinaOwes=settlement>0?settlement:0, gwenOwes=settlement<0?Math.abs(settlement):0;
  const isUSD=budgetCur==='USD';
  const displayed=expFilter==='all'?expenses:expenses.filter(e=>e.category===expFilter);

  const byDay={};
  displayed.forEach(e=>{const d=e.date||'unknown';if(!byDay[d])byDay[d]=[];byDay[d].push(e);});
  const sortedDays=Object.keys(byDay).sort((a,b)=>b.localeCompare(a));
  const expRowsHtml=displayed.length===0
    ?'<div class="exp-empty">'+(expenses.length===0?'<strong>No expenses logged yet</strong><br>Tap &ldquo;+ Add&rdquo; to log your first expense in Japan.':'No expenses in this category.')+'</div>'
    :sortedDays.map(day=>{
      const dayTotal=byDay[day].reduce((s,e)=>s+(e.amount||0),0);
      let dayLabel=day;
      try{const dd=new Date(day+'T12:00:00');dayLabel=dd.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});}catch{}
      return '<div class="exp-day-group">'
        +'<div class="exp-day-hd"><span>'+dayLabel+'</span><span class="exp-day-total">\u00a5'+dayTotal.toLocaleString()+'</span></div>'
        +byDay[day].map(e=>'<div class="expense-item">'
          +'<div class="exp-cat-stripe" style="background:'+(CAT_COLORS[e.category]||'#ccc')+'"></div>'
          +'<div class="exp-body"><div class="exp-top"><span class="exp-desc">'+esc(e.description||e.category||'')+'</span><span class="exp-amount">\u00a5'+(e.amount||0).toLocaleString()+'</span></div>'
          +'<div class="exp-meta"><span>'+(e.paidBy==='gwen'?'Gwen':'Christina')+' paid</span>'+(e.split?'<span class="exp-tag split">Split</span>':'')+'<span class="exp-tag">'+esc(e.category||'')+'</span>'+(e.date?'<span style="color:var(--light);font-size:10px">'+e.date+'</span>':'')+'</div></div>'
          +'<button class="exp-edit" data-id="'+ea(e.id||'')+'" title="Edit" style="background:none;border:none;border-left:1px solid var(--border-lt);padding:0 8px;cursor:pointer;color:var(--light);font-size:11px">\u270e</button>'
          +'<button class="exp-delete" data-id="'+ea(e.id||'')+'" title="Delete">&times;</button></div>'
        ).join('')+'</div>';
    }).join('');

  el.innerHTML=
    '<div class="budget-header">'
    +'<div><div class="budget-eyebrow">Finances</div><div class="budget-title">Trip Budget</div></div>'
    +'<div class="budget-header-right">'
    +'<div class="cur-toggle"><button class="cur-btn'+(budgetCur==='JPY'?' active':'')+'" data-cur="JPY">\u00a5 JPY</button><button class="cur-btn'+(budgetCur==='USD'?' active':'')+'" data-cur="USD">$ USD</button></div>'
    +'<button class="budget-add-btn" id="budgetAddBtn">+ Add expense</button></div></div>'
    +'<div class="b-top-row">'
    +'<div class="b-total-card"><div class="b-total-label">Total trip cost</div><div class="b-total-val">'+fmt(grandTotal)+'</div><div class="b-total-sub">'+(isUSD?'\u00a5'+Math.round(grandTotal).toLocaleString()+' JPY':'~$'+Math.round(grandTotal/exchRate).toLocaleString()+' USD')+'</div></div>'
    +'<div class="b-share-card"><div class="b-share-label">Gwendalynn\'s share</div><div class="b-share-val">'+fmt(grandTotal/2)+'</div><div class="b-share-sub">half of all shared costs</div></div>'
    +'<div class="b-share-card"><div class="b-share-label">Christina\'s share</div><div class="b-share-val">'+fmt(grandTotal/2)+'</div><div class="b-share-sub">half of all shared costs</div></div>'
    +'</div>'
    +'<div class="b-person-row">'
    +'<div class="b-person-card"><div class="b-person-head"><div class="b-avatar b-avatar-g">G</div><span class="b-person-name">Gwendalynn</span></div>'
    +'<div class="b-person-paid">'+fmt(gwenPaid)+'</div><div class="b-person-sub">fronted so far</div>'
    +(gwenOwes>0?'<div class="b-chip b-chip-owes">Owes '+fmt(gwenOwes)+' to Christina</div>'
      :christinaOwes>0?'<div class="b-chip b-chip-owed">Owed '+fmt(christinaOwes)+'</div>'
      :'<div class="b-chip b-chip-even">Settled</div>')+'</div>'
    +'<div class="b-person-card"><div class="b-person-head"><div class="b-avatar b-avatar-c">C</div><span class="b-person-name">Christina</span></div>'
    +'<div class="b-person-paid">'+fmt(christinaPaid)+'</div><div class="b-person-sub">fronted so far</div>'
    +(christinaOwes>0?'<div class="b-chip b-chip-owes">Owes '+fmt(christinaOwes)+' to Gwendalynn</div>'
      :gwenOwes>0?'<div class="b-chip b-chip-owed">Owed '+fmt(gwenOwes)+'</div>'
      :'<div class="b-chip b-chip-even">Settled</div>')+'</div>'
    +'</div>'
    +'<div class="b-table-wrap"><div class="b-table-hd"><span class="b-table-title">Pre-booked costs</span>'
    +'<div style="display:flex;gap:6px">'
    +'<button class="booked-edit-btn" id="bookedEditToggle">'+(bookedEditing?'Done':'Edit')+'</button>'
    +'</div></div>'
    +'<div class="b-table-scroll"><table class="b-table">'
    +'<thead><tr><th>Category</th><th>Item</th><th>Amount</th><th>Paid by</th><th>Split</th></tr></thead>'
    +'<tbody id="bcView" style="'+(bookedEditing?'display:none':'')+'">'+bookedCosts.map(c=>{
      const catClass='b-cat-'+(c.category||'Other').toLowerCase().replace(' ','');
      return '<tr><td><span class="b-cat-chip '+catClass+'">'+esc(c.category||'')+'</span></td>'
        +'<td class="b-item-cell">'+esc(c.label)+(c.dates?'<div style="font-size:10px;color:var(--light);margin-top:1px">'+esc(c.dates)+'</div>':'')+'</td>'
        +'<td class="b-amt-cell">'+fmt(c.jpy||0)+'</td>'
        +'<td>'+(c.paidBy==='gwen'?'Gwendalynn':c.paidBy==='christina'?'Christina':'Split')+'</td>'
        +'<td>50/50</td></tr>';
    }).join('')+'</tbody>'
    +'<tbody id="bcEdit" style="'+(bookedEditing?'':'display:none')+'">'+bookedCosts.map(c=>{
      const cats=['Flights','Hotels','Transport','Activities','Other'];
      return '<tr><td><select class="b-payer-sel" data-id="'+ea(c.id)+'" data-field="category" style="font-size:10px;padding:2px 4px">'+cats.map(cat=>'<option'+(c.category===cat?' selected':'')+'>'+cat+'</option>').join('')+'</select></td>'
        +'<td class="b-item-cell"><input type="text" class="form-input" data-id="'+ea(c.id)+'" data-field="label" value="'+ea(c.label)+'" style="font-size:12px;padding:4px 6px;width:100%"></td>'
        +'<td class="b-amt-cell"><input type="number" class="form-input" data-id="'+ea(c.id)+'" data-field="jpy" value="'+(c.jpy||0)+'" style="font-size:12px;padding:4px 6px;width:100px;font-family:var(--mono)"></td>'
        +'<td><select class="b-payer-sel" data-id="'+ea(c.id)+'" data-field="paidBy">'
        +'<option value="gwen"'+(c.paidBy==='gwen'?' selected':'')+'>Gwendalynn</option>'
        +'<option value="christina"'+(c.paidBy==='christina'?' selected':'')+'>Christina</option>'
        +'<option value="split"'+(c.paidBy==='split'?' selected':'')+'>Split</option>'
        +'</select></td>'
        +'<td><button class="conf-toggle-btn" onclick="deleteBookedCost(\''+ea(c.id)+'\')" style="color:var(--red)">&times;</button></td></tr>';
    }).join('')
    +'<tr class="b-save-row"><td colspan="5" style="display:flex;gap:8px;align-items:center">'
    +'<button class="b-save-btn" id="bcSaveBtn">Save changes</button>'
    +'<button class="booked-edit-btn" id="bcAddBtn" style="margin-left:auto">+ Add item</button>'
    +'</td></tr>'
    +'</tbody>'
    +'<tfoot><tr><td colspan="2">Total pre-booked</td><td class="b-amt-cell">'+fmt(bookedTotal)+'</td><td colspan="2"></td></tr></tfoot>'
    +'</table></div></div>'
    +'<div class="exp-list-hd"><span class="exp-list-title">On-trip expenses ('+expenses.length+')</span>'
    +'<div class="exp-filter-row">'
    +'<button class="exp-filter-btn'+(expFilter==='all'?' active':'')+'" data-filter="all">All</button>'
    +Object.keys(CAT_COLORS).map(cat=>'<button class="exp-filter-btn'+(expFilter===cat?' active':'')+'" data-filter="'+cat+'">'+cat.charAt(0).toUpperCase()+cat.slice(1)+'</button>').join('')
    +'</div></div>'
    +expRowsHtml
    +'<div style="height:40px"></div>';

  el.querySelectorAll('.cur-btn').forEach(btn=>btn.addEventListener('click',()=>{budgetCur=btn.dataset.cur;renderBudget();}));
  $('budgetAddBtn')?.addEventListener('click',openExpenseModal);
  $('bookedEditToggle')?.addEventListener('click',()=>{bookedEditing=!bookedEditing;renderBudget();});
  $('bcSaveBtn')?.addEventListener('click',async()=>{
    el.querySelectorAll('[data-id][data-field]').forEach(el=>{
      const item=bookedCosts.find(c=>c.id===el.dataset.id); if(!item)return;
      const f=el.dataset.field, v=el.value;
      if(f==='jpy'){item.jpy=parseInt(v,10)||0;item.usd=Math.round(item.jpy/exchRate);}
      else item[f]=v;
    });
    bookedEditing=false;
    await db.collection('settings').doc('bookedCosts').set({items:bookedCosts});
    showToast('Saved','ok'); renderBudget();
  });
  $('bcAddBtn')?.addEventListener('click',()=>{
    bookedCosts.push({id:'bc-'+Date.now(),label:'New item',category:'Other',jpy:0,usd:0,paidBy:'gwen'});
    renderBudget();
  });
  el.querySelectorAll('.exp-filter-btn').forEach(btn=>btn.addEventListener('click',()=>{expFilter=btn.dataset.filter;renderBudget();}));
  el.querySelectorAll('.exp-delete').forEach(btn=>btn.addEventListener('click',async e=>{
    e.stopPropagation();
    if(confirm('Delete this expense?'))await deleteExpense(btn.dataset.id);
  }));
  el.querySelectorAll('.exp-edit').forEach(btn=>btn.addEventListener('click',e=>{
    e.stopPropagation();
    openEditExpense(btn.dataset.id);
  }));
}

// ── Expense modal ─────────────────────────────────────────────
function openEditExpense(id){
  const exp=expenses.find(e=>e.id===id); if(!exp)return;
  editExpId=id;
  if($('expModalTitle'))$('expModalTitle').textContent='Edit expense';
  // Remove quick macros section — not relevant when editing
  document.getElementById('quickMacros')?.remove();
  if($('expAmount'))$('expAmount').value=exp.amount||'';
  if($('expNote'))  $('expNote').value=exp.description||'';
  if($('expDate'))  $('expDate').value=exp.date||'';
  selectedCat=exp.category||'food';
  selectedPayer=exp.paidBy||'gwen';
  document.querySelectorAll('#expCatChips .chip').forEach(c=>c.classList.toggle('active',c.dataset.cat===selectedCat));
  document.querySelectorAll('#expPayerChips .chip').forEach(c=>c.classList.toggle('active',c.dataset.payer===selectedPayer));
  if($('expSplit'))$('expSplit').checked=!!exp.split;
  // Show date input, hide quick-date chips
  if($('expDate'))$('expDate').style.display='block';
  if($('expQuickDates'))$('expQuickDates').style.display='none';
  $('expErr')?.classList.add('hidden');
  const saveBtn=$('expSaveBtn'); if(saveBtn)saveBtn.textContent='Save changes';
  openModal('expenseModal');
  setTimeout(()=>$('expAmount')?.focus(),80);
}

function openExpenseModal(){
  editExpId=null;
  if($('expModalTitle'))$('expModalTitle').textContent='Log expense';
  const saveBtn=$('expSaveBtn'); if(saveBtn)saveBtn.textContent='Add expense';
  // Show quick macros
  renderQuickMacros();
  // Restore quick-date row visibility (may have been hidden by edit mode)
  if($('expQuickDates'))$('expQuickDates').style.display='';
  const now=getTodayJST();
  const inTrip=now>=TRIP_START&&now<=TRIP_END;
  const useDate=inTrip?now:TRIP_START;
  if($('expDate'))$('expDate').value=useDate.toISOString().split('T')[0];
  if($('expAmount'))$('expAmount').value='';
  if($('expNote'))$('expNote').value='';
  document.querySelectorAll('#expCatChips .chip').forEach(c=>c.classList.toggle('active',c.dataset.cat==='food'));
  document.querySelectorAll('#expPayerChips .chip').forEach(c=>c.classList.toggle('active',c.dataset.payer==='gwen'));
  if($('expSplit'))$('expSplit').checked=true;
  selectedCat='food'; selectedPayer='gwen';
  $('expErr')?.classList.add('hidden');
  if($('expSplitHint'))$('expSplitHint').textContent='';
  document.querySelectorAll('.qd-btn').forEach(b=>b.classList.toggle('active',b.dataset.offset==='0'));
  if($('expDate'))$('expDate').style.display='none';
  openModal('expenseModal');
  setTimeout(()=>$('expAmount')?.focus(),80);
}

$('expFab')?.addEventListener('click',openExpenseModal);

// Quick-add expense macros
const QUICK_MACROS=[
  {label:'\u00a5500 Food',   icon:'\ud83c\udf5c',amount:500,  cat:'food',      desc:'Food'},
  {label:'\u00a51,000 Food', icon:'\ud83c\udf71',amount:1000, cat:'food',      desc:'Food'},
  {label:'\u00a52,000 Food', icon:'\ud83c\udf63',amount:2000, cat:'food',      desc:'Food'},
  {label:'Suica top-up',    icon:'\ud83d\ude83',amount:2000, cat:'transport', desc:'Suica reload'},
  {label:'\u00a5500 Drinks', icon:'\ud83c\udf75',amount:500,  cat:'drinks',    desc:'Drinks'},
  {label:'Temple entry',    icon:'\u26e9',      amount:500,  cat:'activities',desc:'Temple entry'},
];
function renderQuickMacros(){
  let container=document.getElementById('quickMacros');
  if(!container){
    const body=document.querySelector('#expenseModal .modal-body'); if(!body)return;
    container=document.createElement('div');
    container.id='quickMacros';
    container.style.cssText='display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border-lt)';
    body.insertBefore(container,body.firstChild);
  }
  const payerName=selectedPayer==='gwen'?'Gwendalynn':'Christina';
  container.innerHTML='<div style="display:flex;justify-content:space-between;align-items:baseline;width:100%;margin-bottom:4px">'
    +'<span style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--light)">Quick add</span>'
    +'<span style="font-size:11px;color:var(--muted)">Paying: <strong>'+payerName+'</strong></span>'
    +'</div>'
    +QUICK_MACROS.map((m,i)=>'<button class="chip" onclick="quickAddExpense('+i+')" style="font-size:12px;padding:6px 12px">'+m.icon+' '+m.label+'</button>').join('');
}
window.quickAddExpense=async function(idx){
  const m=QUICK_MACROS[idx]; if(!m)return;
  const now=getTodayJST();
  const dateStr=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  try{
    await addExpense({amount:m.amount,category:m.cat,description:m.desc,paidBy:selectedPayer,split:true,date:dateStr});
    closeModal('expenseModal');
    showToast('Added \u00a5'+m.amount.toLocaleString()+' \u00b7 '+payerLabelFor(selectedPayer)+' paid','ok');
  }catch(e){showToast('Failed','err');}
};
function payerLabelFor(p){return p==='gwen'?'Gwen':'Christina';}

document.getElementById('expCatChips')?.addEventListener('click',e=>{
  const btn=e.target.closest('.chip'); if(!btn)return;
  document.querySelectorAll('#expCatChips .chip').forEach(c=>c.classList.remove('active'));
  btn.classList.add('active'); selectedCat=btn.dataset.cat||'other';
});
document.getElementById('expPayerChips')?.addEventListener('click',e=>{
  const btn=e.target.closest('.chip'); if(!btn)return;
  document.querySelectorAll('#expPayerChips .chip').forEach(c=>c.classList.remove('active'));
  btn.classList.add('active'); selectedPayer=btn.dataset.payer||'gwen';
  updateSplitHint();
  // Update quick macros payer label if visible
  const qm=document.getElementById('quickMacros'); if(qm)renderQuickMacros();
});
document.getElementById('expQuickDates')?.addEventListener('click',e=>{
  const btn=e.target.closest('.qd-btn'); if(!btn)return;
  if(btn.id==='expPickDate'){
    if($('expDate'))$('expDate').style.display=$('expDate').style.display==='none'?'block':'none';
    return;
  }
  const off=parseInt(btn.dataset.offset||'0',10);
  const base=new Date(getTodayJST()); base.setDate(base.getDate()+off);
  const s=TRIP_START, f=TRIP_END;
  const clamped=base<s?s:base>f?f:base;
  if($('expDate'))$('expDate').value=clamped.toISOString().split('T')[0];
  document.querySelectorAll('.qd-btn').forEach(b=>b.classList.toggle('active',b===btn));
});
function updateSplitHint(){
  const el=$('expSplitHint'); if(!el)return;
  if(!$('expSplit')?.checked){el.textContent='';return;}
  const amt=parseFloat($('expAmount')?.value)||0;
  const half=Math.round(amt/2);
  const other=selectedPayer==='gwen'?'Christina':'Gwen';
  el.textContent=half>0?other+' owes \u00a5'+half.toLocaleString():'';
}
$('expAmount')?.addEventListener('input',updateSplitHint);
$('expSplit')?.addEventListener('change',updateSplitHint);

async function saveExpense(){
  const amount=parseInt($('expAmount')?.value||'0',10);
  if(!amount||amount<=0){if($('expErr')){$('expErr').textContent='Enter an amount.';$('expErr').classList.remove('hidden');}return;}
  const btn=$('expSaveBtn');
  const origLabel=btn?btn.textContent:'';
  if(btn){btn.textContent='Saving\u2026';btn.disabled=true;}
  try{
    const expData={
      amount, category:selectedCat,
      description:$('expNote')?.value.trim()||selectedCat,
      paidBy:selectedPayer, split:!!$('expSplit')?.checked,
      date:$('expDate')?.value||'',
    };
    if(editExpId){
      if(currentUser){try{await db.collection('expenses').doc(editExpId).update(expData);}catch(e){throw e;}}
      else{const i=localExpenses.findIndex(e=>e.id===editExpId);if(i!==-1){localExpenses[i]={...localExpenses[i],...expData};saveLocalExpenses();expenses=[...localExpenses];renderBudget();}}
      closeModal('expenseModal');
      showToast('Expense updated','ok');
    } else {
      await addExpense(expData);
      closeModal('expenseModal');
      showToast('Added \u00a5'+amount.toLocaleString(),'ok');
    }
  }catch(e){
    if($('expErr')){$('expErr').textContent='Could not save. Check connection.';$('expErr').classList.remove('hidden');}
  }finally{
    if(btn){btn.textContent=origLabel;btn.disabled=false;}
  }
}
$('expSaveBtn')?.addEventListener('click',saveExpense);

// ── Expense Firestore ─────────────────────────────────────────
function subscribeExpenses(){
  if(expUnsub)expUnsub();
  expUnsub=db.collection('expenses').orderBy('createdAt','desc')
    .onSnapshot(snap=>{
      expenses=snap.docs.map(d=>({id:d.id,...d.data()}));
      if($('panel-budget')?.classList.contains('active'))renderBudget();
    },()=>{
      expenses=[...localExpenses];
      if($('panel-budget')?.classList.contains('active'))renderBudget();
    });
}
function unsubscribeExpenses(){if(expUnsub){expUnsub();expUnsub=null;}}
function loadLocalExpenses(){
  try{localExpenses=JSON.parse(localStorage.getItem('japan-expenses')||'[]'); expenses=[...localExpenses];}
  catch{localExpenses=[];expenses=[];}
}
function saveLocalExpenses(){try{localStorage.setItem('japan-expenses',JSON.stringify(localExpenses));}catch{}}
async function addExpense(exp){
  if(currentUser){
    await db.collection('expenses').add({...exp,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
  }else{
    const e={...exp,id:Date.now()+'-'+Math.random(),createdAt:Date.now()};
    localExpenses.unshift(e); saveLocalExpenses(); expenses=[...localExpenses];
    if($('panel-budget')?.classList.contains('active'))renderBudget();
  }
}
async function deleteExpense(id){
  if(currentUser){try{await db.collection('expenses').doc(id).delete();}catch{}}
  else{localExpenses=localExpenses.filter(e=>e.id!==id);saveLocalExpenses();expenses=[...localExpenses];if($('panel-budget')?.classList.contains('active'))renderBudget();}
}

// ── Firestore days ────────────────────────────────────────────
function subscribeDays(){
  if(daysUnsub)daysUnsub();
  daysUnsub=db.collection('days').orderBy('dayDate')
    .onSnapshot(async snap=>{
      if(snap.empty){await seedDays();return;}
      let needsReseed=true;
      snap.forEach(d=>{if((d.data().activities||[]).length>0)needsReseed=false;});
      if(needsReseed){await seedDays();return;}
      firestoreDays={};
      snap.forEach(d=>{firestoreDays[d.id]=d.data();});
      renderItinerary();
    },err=>console.error('Days error:',err));
}
function unsubDays(){if(daysUnsub){daysUnsub();daysUnsub=null;}}
async function seedDays(){
  try{
    const ops=Object.entries(DAYS).map(([dayId,day])=>{
      const dateId=dayIdToDate(dayId);
      let order=0; const activities=[];
      day.periods.forEach(p=>{
        activities.push({id:dayId+'-pl-'+order,type:'period-label',title:p.label,order:order++});
        p.items.forEach(item=>{
          let itemCost=0;
          const costMatch=(item.text||'').match(/[¥\u00a5]([\d,]+)/);
          if(costMatch)itemCost=parseInt(costMatch[1].replace(/,/g,''),10)||0;
          activities.push({
            id:dayId+'-'+order,time:item.time||'',title:item.text||'',desc:'',
            category:item.type==='booked'?'hotel':'activity',
            booked:item.type==='booked',conf:'',addr:item.addr||'',
            notes:'',cost:itemCost,currency:'JPY',driveUrl:'',
            sub:item.sub||false,dur:item.dur||'',order:order++,
          });
        });
      });
      return db.collection('days').doc(dateId).set({
        dayDate:dateId,dayId:dayId,title:day.title,location:day.location,
        tip:day.tip||'',activities,
      });
    });
    await Promise.all(ops);
  }catch(e){console.error('Seed failed',e);}
}

// ── Auth ──────────────────────────────────────────────────────
$('authBtn')?.addEventListener('click',()=>{
  if(currentUser)auth.signOut();
  else{if($('authErr'))$('authErr').classList.add('hidden');openModal('authModal');}
});
$('googleSignInBtn')?.addEventListener('click',async()=>{
  if($('authErr'))$('authErr').classList.add('hidden');
  const btn=$('googleSignInBtn'); if(btn)btn.textContent='Signing in\u2026';
  try{
    const r=await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
    if(!ALLOWED.includes(r.user.email)){
      await auth.signOut();
      if($('authErr')){$('authErr').textContent='Access restricted to Gwendalynn & Christina.';$('authErr').classList.remove('hidden');}
    }else{closeModal('authModal');}
  }catch(e){
    if(e.code!=='auth/popup-closed-by-user'){
      if($('authErr')){$('authErr').textContent='Sign-in failed. Please try again.';$('authErr').classList.remove('hidden');}
    }
  }finally{
    const btn=$('googleSignInBtn');
    if(btn)btn.innerHTML='<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg> Sign in with Google';
  }
});

auth.onAuthStateChanged(async user=>{
  currentUser=user;
  const btn=$('authBtn');
  if(user){
    document.body.classList.add('edit-mode');
    if(btn){
      btn.classList.add('signed-in');
      const firstName=(user.displayName||'').split(' ')[0]||'Signed in';
      btn.innerHTML='';
      if(user.photoURL){const img=document.createElement('img');img.className='auth-avatar';img.src=user.photoURL;btn.appendChild(img);}
      btn.appendChild(document.createTextNode(firstName));
    }
    $('expFab')?.classList.remove('hidden');
    updateTabVisibility(true);
    await Promise.all([loadAllNotes(), loadChecksFromDB(), loadBookedCostsFromDB(), loadDriveSettings()]);
    renderPlan();
    refreshNoteDisplays(); setupEditors();
    subscribeExpenses(); subscribeDays();
    refreshAllPanels();
  }else{
    document.body.classList.remove('edit-mode');
    if(btn){btn.classList.remove('signed-in');btn.textContent='Sign in';}
    $('expFab')?.classList.add('hidden');
    updateTabVisibility(false);
    unsubscribeExpenses(); unsubDays();
    firestoreDays={};
    loadLocalExpenses();
    try{driveFolderUrl=localStorage.getItem('japan-drive-url')||'';}catch{}
    refreshNoteDisplays();
    refreshAllPanels();
  }
});

function refreshAllPanels(){
  const active=document.querySelector('.tab-panel.active'); if(!active)return;
  const id=active.id.replace('panel-','');
  if(id==='overview')renderOverview();
  else if(id==='itinerary')renderItinerary();
  else if(id==='bookings')renderBookings();
  else if(id==='plan')renderPlan();
  else if(id==='budget')renderBudget();
}

// ── Firestore: Notes ──────────────────────────────────────────
async function loadAllNotes(){
  await Promise.all(Object.keys(DAYS).map(async id=>{
    try{const s=await db.collection('notes').doc(id).get(); if(s.exists)notes[id]=s.data().text||'';}catch{}
  }));
}
async function loadChecksFromDB(){
  try{const s=await db.collection('checks').doc('all').get(); if(s.exists)Object.assign(checks,s.data());}catch{}
}
async function loadBookedCostsFromDB(){
  try{const s=await db.collection('settings').doc('bookedCosts').get(); if(s.exists)bookedCosts=s.data().items||DEFAULT_BOOKED_COSTS_fn();}catch{}
}
async function loadDriveSettings(){
  try{const s=await db.collection('settings').doc('drive').get(); if(s.exists&&s.data().folderUrl)driveFolderUrl=s.data().folderUrl;}
  catch{try{driveFolderUrl=localStorage.getItem('japan-drive-url')||'';}catch{}}
}

function refreshNoteDisplays(){
  document.querySelectorAll('.notes-read').forEach(el=>{
    const ta=el.nextElementSibling; if(!ta)return;
    const dayId=ta.dataset.day, text=notes[dayId]||'';
    el.innerHTML=text?text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>'):'<em>No notes yet \u2014 sign in to add notes.</em>';
    document.querySelector('#card-'+dayId+' .notes-dot')?.classList.toggle('has-notes',!!text);
  });
  document.querySelectorAll('.notes-edit').forEach(ta=>{ta.value=notes[ta.dataset.day]||'';});
}

function setupEditors(){
  document.querySelectorAll('.notes-edit').forEach(orig=>{
    const ta=orig.cloneNode(true); orig.parentNode.replaceChild(ta,orig);
    ta.value=notes[ta.dataset.day]||'';
    let timer;
    ta.addEventListener('input',()=>{
      clearTimeout(timer);
      const ind=$('save-'+ta.dataset.day); if(ind)ind.textContent='Saving\u2026';
      timer=setTimeout(async()=>{
        const dayId=ta.dataset.day, text=ta.value;
        notes[dayId]=text;
        document.querySelector('#card-'+dayId+' .notes-dot')?.classList.toggle('has-notes',!!text);
        const readEl=ta.previousElementSibling;
        if(readEl)readEl.innerHTML=text?text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>'):'<em>No notes yet \u2014 sign in to add notes.</em>';
        try{
          await db.collection('notes').doc(dayId).set({text,updatedAt:new Date()});
          if(ind){ind.textContent='Saved';setTimeout(()=>{if(ind)ind.textContent='';},1800);}
        }catch{if(ind)ind.textContent='Could not save.';}
      },900);
    });
  });
}

// ── Export / Import ───────────────────────────────────────────
window.exportTripData=async function(){
  showToast('Gathering data\u2026');
  try{
    const itinerary={};
    if(Object.keys(firestoreDays).length>0){
      Object.entries(firestoreDays).forEach(([dateId,data])=>{
        const dayId=data.dayId||dateId;
        itinerary[dateId]={dayId,dateId,title:data.title||'',location:data.location||'',tip:data.tip||'',
          activities:(data.activities||[]).map(a=>({
            id:a.id,type:a.type||undefined,time:a.time||'',title:a.title||'',desc:a.desc||'',
            category:a.category||'',booked:a.booked||false,conf:a.conf||'',addr:a.addr||'',
            notes:a.notes||'',cost:a.cost||0,currency:a.currency||'JPY',sub:a.sub||false,dur:a.dur||'',order:a.order||0,
          })),
        };
      });
    }else{
      Object.entries(DAYS).forEach(([dayId,day])=>{
        const dateId=dayIdToDate(dayId);
        itinerary[dateId]={dayId,dateId,title:day.title,location:day.location,tip:day.tip||'',periods:day.periods};
      });
    }
    const exportData={
      _exportedAt:new Date().toISOString(),
      _exportedBy:currentUser?.email||'anonymous',
      _description:'Japan 2026 trip data export.',
      itinerary,notes:{...notes},confirmations:CONFIRMATIONS,
      prebooked:[...bookedCosts],expenses:[...expenses],
      overview:OVERVIEW_DATA,checklistState:{...checks},groups:GROUPS,
    };
    const blob=new Blob([JSON.stringify(exportData,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url; a.download='japan-2026-trip-data.json';
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast('Trip data exported','ok');
  }catch(e){console.error('Export failed:',e);showToast('Export failed','err');}
};

window.importTripData=async function(){
  const input=document.createElement('input');
  input.type='file'; input.accept='.json';
  input.onchange=async e=>{
    const file=e.target.files[0]; if(!file)return;
    showToast('Importing\u2026');
    try{
      const text=await file.text();
      const data=JSON.parse(text);
      if(data.itinerary){
        const ops=Object.entries(data.itinerary).map(([dateId,day])=>
          db.collection('days').doc(dateId).set({
            dayDate:dateId,dayId:day.dayId||dateId,title:day.title||'',location:day.location||'',tip:day.tip||'',
            activities:(day.activities||[]).map((a,i)=>({
              id:a.id||dateId+'-'+i,type:a.type||undefined,time:a.time||'',title:a.title||'',desc:a.desc||'',
              category:a.category||'activity',booked:a.booked||false,conf:a.conf||'',addr:a.addr||'',
              notes:a.notes||'',cost:a.cost||0,currency:a.currency||'JPY',driveUrl:a.driveUrl||'',
              sub:a.sub||false,dur:a.dur||'',order:a.order!=null?a.order:i,
            })),
          })
        );
        await Promise.all(ops);
      }
      if(data.notes)await Promise.all(Object.entries(data.notes).map(([id,text])=>text?db.collection('notes').doc(id).set({text,updatedAt:new Date()}):Promise.resolve()));
      if(data.prebooked){bookedCosts=data.prebooked;await db.collection('settings').doc('bookedCosts').set({items:bookedCosts});}
      if(data.checklistState){Object.assign(checks,data.checklistState);await db.collection('checks').doc('all').set(checks);}
      showToast('Import complete \u2014 refreshing','ok');
      setTimeout(()=>location.reload(),1200);
    }catch(e){console.error('Import failed:',e);showToast('Import failed: '+e.message,'err');}
  };
  input.click();
};

// ── Lightbox ──────────────────────────────────────────────────
window.openLightbox=function(imgUrl,driveLink){
  const img=$('lightboxImg'),lnk=$('lightboxLink'),lb=$('lightbox');
  if(img)img.src=imgUrl||'';
  if(lnk){lnk.href=driveLink||imgUrl||'#';lnk.style.display=driveLink?'':'none';}
  lb?.classList.remove('hidden');
};
window.closeLightbox=function(){$('lightbox')?.classList.add('hidden');};

// ── Cherry blossoms ───────────────────────────────────────────
(function(){
  const cv=$('blc'); if(!cv)return;
  const ctx=cv.getContext('2d'); let P=[];
  function rs(){cv.width=innerWidth;cv.height=innerHeight;}
  rs(); window.addEventListener('resize',rs);
  function mk(){return{x:Math.random()*cv.width,y:-40-Math.random()*80,r:2.5+Math.random()*2.5,rot:Math.random()*Math.PI*2,rv:(Math.random()-.5)*.013,vx:(Math.random()-.5)*.16,vy:.16+Math.random()*.24,sw:Math.random()*Math.PI*2,sws:.004+Math.random()*.005,a:.4+Math.random()*.35};}
  for(let i=0;i<14;i++){const p=mk();p.y=Math.random()*innerHeight;P.push(p);}
  (function draw(){
    ctx.clearRect(0,0,cv.width,cv.height);
    P.forEach((p,i)=>{
      p.x+=p.vx+Math.sin(p.sw)*.18; p.y+=p.vy; p.rot+=p.rv; p.sw+=p.sws;
      if(p.y>cv.height+40)P[i]=mk();
      ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.rot); ctx.globalAlpha=p.a;
      ctx.beginPath();
      for(let j=0;j<5;j++){
        const a=(j/5)*Math.PI*2-Math.PI/2;
        const ox=Math.cos(a)*p.r, oy=Math.sin(a)*p.r;
        const cx1=Math.cos(a+.3)*p.r*.4, cy1=Math.sin(a+.3)*p.r*.4;
        j===0?ctx.moveTo(ox,oy):ctx.quadraticCurveTo(cx1,cy1,ox,oy);
      }
      ctx.closePath(); ctx.fillStyle='#E8A0B0'; ctx.fill(); ctx.restore();
    });
    requestAnimationFrame(draw);
  })();
})();

// ── Init ──────────────────────────────────────────────────────
try{Object.assign(checks,JSON.parse(localStorage.getItem('japan-checks')||'{}'));}catch{}
loadLocalExpenses();
try{driveFolderUrl=localStorage.getItem('japan-drive-url')||'';}catch{}

db.collection('settings').doc('drive').get()
  .then(s=>{if(s.exists&&s.data()?.folderUrl)driveFolderUrl=s.data().folderUrl;})
  .catch(()=>{});

updateTabVisibility(false); // hidden until auth confirms editor
const savedTab=localStorage.getItem('japan-tab')||'overview';
const safeTab=EDITOR_ONLY_TABS.includes(savedTab)?'overview':savedTab;
switchTab(safeTab);
buildDestPills();
updateTripStatus();
updateClock();
fetchRate();

setInterval(updateClock,30000);
setInterval(updateTripStatus,60000);
