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
try{hidePastDays=localStorage.getItem('japan-hidePast')==='1';}catch{}
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
let selectedFor    = 'shared';
let editExpId      = null;
const expandedItems = new Set(); // tracks which activity items are expanded in-place

// ── Trip dates ────────────────────────────────────────────────
// Set PHOTOS_URL to your shared Google Photos album link.
// Leave empty ('') to hide the photos card on the Overview.
const PHOTOS_URL = '';

const TRIP_START = new Date('2026-04-15T00:00:00');
const TRIP_END   = new Date('2026-04-29T23:59:59');
const T_DEPART   = new Date('2026-04-15T11:20:00-07:00');
const T_ARRIVE   = new Date('2026-04-16T15:05:00+09:00');

// NOTE: Use Date constructor (not date-only ISO strings) so these are local midnight,
// not UTC midnight. new Date('2026-04-15') parses as UTC and shows as Apr 14 in PDT.
const DAY_DATES = {
  apr15:new Date(2026,3,15), apr16:new Date(2026,3,16), apr17:new Date(2026,3,17),
  apr18:new Date(2026,3,18), apr19:new Date(2026,3,19), apr20:new Date(2026,3,20),
  apr21:new Date(2026,3,21), apr22:new Date(2026,3,22), apr23:new Date(2026,3,23),
  apr24:new Date(2026,3,24), apr25:new Date(2026,3,25), apr26:new Date(2026,3,26),
  apr27:new Date(2026,3,27), apr28:new Date(2026,3,28), apr29:new Date(2026,3,29),
};

// ── Helpers ───────────────────────────────────────────────────
const $ = id => document.getElementById(id);
function esc(s){ if(s==null)return''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function ea(s){ if(s==null)return''; return String(s).replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function fmt(jpy){ return budgetCur==='USD'?'$'+Math.round(jpy/exchRate).toLocaleString():'\u00a5'+Math.round(jpy).toLocaleString(); }

// Convert HH:MM (from type="time") to 12h display e.g. "9:30 AM"
// Passes through anything that doesn't match HH:MM so legacy data is safe
function fmt12h(t){
  if(!t)return'';
  const m=t.match(/^(\d{1,2}):(\d{2})$/);
  if(!m)return t; // already 12h or free-text — leave as-is
  let h=parseInt(m[1],10), min=m[2], ampm='AM';
  if(h===0){h=12;}
  else if(h===12){ampm='PM';}
  else if(h>12){h-=12;ampm='PM';}
  return h+':'+min+' '+ampm;
}
// Convert legacy "9:30 AM" strings back to HH:MM for type="time" input
function fmt24h(t){
  if(!t)return'';
  if(/^\d{1,2}:\d{2}$/.test(t.trim()))return t.trim().padStart(5,'0'); // already HH:MM
  const m=t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if(!m)return'';
  let h=parseInt(m[1],10);
  const min=m[2], ampm=m[3].toUpperCase();
  if(ampm==='PM'&&h<12)h+=12;
  if(ampm==='AM'&&h===12)h=0;
  return String(h).padStart(2,'0')+':'+min;
}

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
  // HH:MM from type="time" — 24h format
  const m24=clean.match(/^(\d{1,2}):(\d{2})$/);
  if(m24)return parseInt(m24[1],10)*60+parseInt(m24[2],10);
  // Legacy 12h format — "9:30 AM", "10:00 PM"
  const m12=clean.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)/);
  if(m12){
    let h=parseInt(m12[1],10), min=parseInt(m12[2],10);
    const ampm=m12[3].toUpperCase();
    if(ampm==='PM'&&h<12)h+=12;
    if(ampm==='AM'&&h===12)h=0;
    return h*60+min;
  }
  return 9999;
}

function timeToPeriodLabel(minutes){
  if(minutes<360)return 'Very early morning'; // before 6 AM
  if(minutes<720)return 'Morning';            // 6 AM - noon
  if(minutes<780)return 'Midday';             // noon - 1 PM
  if(minutes<1020)return 'Afternoon';         // 1 PM - 5 PM
  return 'Evening';                           // 5 PM+
}

function sortActivitiesByTime(acts){
  // Filter out old period-label entries — we auto-generate them now
  const items = acts.filter(a => a.type !== 'period-label');

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
  let lastPeriod = '';

  bundles.forEach(bundle => {
    const t = parseTimeToMinutes(bundle.parent.time);
    if (t < 9999) {
      const period = timeToPeriodLabel(t);
      if (period !== lastPeriod) {
        result.push({ type: 'period-label', title: period, order: order++ });
        lastPeriod = period;
      }
    }
    bundle.parent.order = order++;
    result.push(bundle.parent);
    bundle.subs.forEach(s => { s.order = order++; result.push(s); });
  });

  return result;
}

function updateClock(){
  const el=$('jstClock'); if(!el)return;
  const jst=getTodayJST();
  const day=jst.toLocaleString('en-US',{weekday:'short'});
  const mo=jst.toLocaleString('en-US',{month:'short'});
  const dt=jst.getDate();
  const pad=n=>String(n).padStart(2,'0');
  el.innerHTML=day+' '+mo+' '+dt+', '+pad(jst.getHours())+':'+pad(jst.getMinutes())+' <span class="jst-suffix">JST</span>';
}
function japanTimeHtml(){
  const jst=getTodayJST();
  const day=jst.toLocaleString('en-US',{weekday:'long'});
  const mo=jst.toLocaleString('en-US',{month:'long'});
  const dt=jst.getDate();
  const pad=n=>String(n).padStart(2,'0');
  const h=jst.getHours(), m=pad(jst.getMinutes());
  const ampm=h>=12?'PM':'AM';
  const h12=h===0?12:h>12?h-12:h;
  return 'Current time in Japan: <strong>'+day+', '+mo+' '+dt+' \u00b7 '+h12+':'+m+' '+ampm+'</strong> JST';
}
function updateTripStatus(){
  const el=$('tripStatus'); if(!el)return;
  const now=new Date(), todayId=getTodayDayId();
  if(now<T_DEPART){
    // Compare calendar dates (local midnight) so "1 day" shows correctly even when
    // <24h remain but departure is still on the next calendar day.
    const todayMid=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const departMid=new Date(2026,3,15);
    const d=Math.round((departMid-todayMid)/86400000);
    if(d>0) el.innerHTML='Trip starts in <strong>'+d+' day'+(d===1?'':'s')+'</strong>';
    else el.innerHTML='<strong>Departing today</strong>';
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
$('cwFab')?.addEventListener('click',()=>{openModal('currencyModal');setTimeout(()=>$('jpyIn')?.focus(),80);});
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
  el.innerHTML=GROUPS.map((g,i)=>'<button class="dest-pill" data-group="'+i+'"><span class="dest-pill-dot" style="background:'+g.color+'"></span>'+esc(g.label)+'</button>').join('');
  let clickedPill=null, clickLockTimer=null;
  el.querySelectorAll('.dest-pill').forEach(pill=>{
    pill.addEventListener('click',()=>{
      el.querySelectorAll('.dest-pill').forEach(p=>p.classList.remove('active'));
      pill.classList.add('active');
      clickedPill=parseInt(pill.dataset.group);
      clearTimeout(clickLockTimer);
      clickLockTimer=setTimeout(()=>{clickedPill=null;},1200);
      const sec=document.getElementById('section-'+pill.dataset.group);
      if(sec){
        const hH=document.querySelector('header')?.offsetHeight||0;
        const pH=$('destPillsWrap')?.offsetHeight||0;
        window.scrollTo({top:sec.getBoundingClientRect().top+window.scrollY-hH-pH-10,behavior:'smooth'});
      }
    });
  });
  window._destPillClickedRef=()=>clickedPill;
}
let pillRafPending=false;
function updateActivePill(){
  const el=$('destPills'); if(!el)return;
  // If a pill was just clicked, respect that choice
  const clicked=window._destPillClickedRef?.();
  if(clicked!==null&&clicked!==undefined){
    el.querySelectorAll('.dest-pill').forEach((p,i)=>{
      p.classList.toggle('active',i===clicked);
      if(i===clicked)p.scrollIntoView({inline:'nearest',block:'nearest'});
    });
    return;
  }
  const hH=document.querySelector('header')?.offsetHeight||0;
  const pH=$('destPillsWrap')?.offsetHeight||0;
  const off=hH+pH+20; let active=0;
  // For the last section, check if we're near the bottom of the page
  const atBottom=window.innerHeight+window.scrollY>=document.body.scrollHeight-50;
  const lastIdx=GROUPS.length-1;
  if(atBottom){active=lastIdx;}
  else{GROUPS.forEach((_,i)=>{const s=document.getElementById('section-'+i); if(s&&s.getBoundingClientRect().top<off)active=i;});}
  el.querySelectorAll('.dest-pill').forEach((p,i)=>{
    p.classList.toggle('active',i===active);
    if(i===active)p.scrollIntoView({inline:'nearest',block:'nearest'});
  });
}
window.addEventListener('scroll',()=>{if(!pillRafPending){pillRafPending=true;requestAnimationFrame(()=>{updateActivePill();pillRafPending=false;});}},{passive:true});


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
      {time:'11:20 AM',text:'United UA 39 \u00b7 LAX \u2192 HND',type:'booked',
       notes:'Conf: F354LH \u00b7 Seats 31L (Gwen) & 31J (Christina) \u00b7 Boeing 787-10 Dreamliner \u00b7 Economy (K)\nArrives Tokyo HND Thursday April 16, 3:05 PM \u00b7 11 hrs 45 min'},
    ]},
  ],tip:'Get to LAX by 8:30 AM. Check in online beforehand.'},

  apr16:{id:'apr16',date:'THU APR 16',title:'Arrival Day',location:'Tokyo \u00b7 Shinjuku',periods:[
    {label:'Afternoon',items:[
      {time:'3:05 PM',text:'Arrive Haneda Airport',dur:'~90 min to hotel',
       notes:'Clear customs, collect bags \u00b7 Tokyo Monorail or Keikyu Line \u2192 Shinjuku (~60\u201375 min)'},
      {time:'~5:30 PM',text:'Check in Hotel Gracery Shinjuku',type:'booked',
       notes:'Conf: 5594.831.309 \u00b7 PIN: 6506 \u00b7 Standard Twin \u00b7 From 14:00\nKabukicho 1-19-1, Shinjuku 160-0021 \u00b7 +81 3 6833 1111',
       addr:'Hotel Gracery Shinjuku, Kabukicho 1-19-1, Shinjuku, Tokyo'},
    ]},
    {label:'Evening',items:[
      {time:'7:00 PM',text:'Omoide Yokocho',
       notes:'Memory Lane \u2014 tiny smoky yakitori stalls, ice-cold beer. 5 min walk from hotel. Ease into Japan here.'},
      {time:'9:00 PM',text:'Wander Kabukicho',
       notes:'Neon arcades, vending machines, convenience stores. No agenda \u2014 just absorb it.'},
    ]},
  ],tip:'Jet lag will hit in waves. Keep tonight very light \u2014 you have four full days ahead.'},

  apr17:{id:'apr17',date:'FRI APR 17',title:'Art + Harajuku + Shibuya',location:'Tokyo \u00b7 Shinjuku',periods:[
    {label:'Morning',items:[
      {time:'8:30 AM',text:'teamLab Borderless',type:'booked',dur:'~3 hrs',cost:5600,
       notes:'Conf: A7YRA4LXWCN3-0001 \u00b7 Entry 08:30\u201309:00 \u00b7 No re-entry\nWear pants (mirrored floors) \u00b7 Download teamLab app beforehand \u00b7 Hit Bubble Universe + Infinite Crystal World first',
       addr:'teamLab Borderless, Azabudai Hills, 1-2-4 Azabudai, Minato-ku, Tokyo'},
      {time:'11:30 AM',text:'Explore Azabudai Hills complex',
       notes:'Contemporary architecture and upscale retail surrounding teamLab. Worth 20 minutes.'},
    ]},
    {label:'Afternoon',items:[
      {time:'12:30 PM',text:'Meiji Shrine',dur:'~1 hr',
       notes:'Forested approach through towering torii gates. Peaceful after a hectic morning.',
       addr:'Meiji Shrine, 1-1 Yoyogikamizonocho, Shibuya, Tokyo'},
      {time:'2:30 PM',text:'Takeshita-dori',
       notes:'Harajuku street fashion, crepe stands, chaotic energy. Short but worth seeing.'},
      {time:'3:30 PM',text:'Omotesando',
       notes:'Tree-lined boulevard with flagship architecture \u2014 Prada, Tod\'s, Louis Vuitton. Window shopping is free.'},
    ]},
    {label:'Evening',items:[
      {time:'5:30 PM',text:'Shibuya Scramble Crossing',
       notes:'View from above first \u2014 Starbucks on the corner or Mag\'s Park rooftop. Then walk through at street level.'},
      {time:'7:00 PM',text:'Dinner in Shibuya or Shimokitazawa',
       notes:'Izakayas and wine bars throughout. Shimokitazawa (10 min from Shibuya) is more bohemian with excellent small bars.'},
    ]},
  ],tip:'teamLab is least crowded 8:30\u201310 AM. Skip the EN Tea House inside unless you want to spend extra.'},

  apr18:{id:'apr18',date:'SAT APR 18',title:'Old Tokyo',location:'Asakusa \u00b7 Yanaka \u00b7 Akihabara',periods:[
    {label:'Morning',items:[
      {time:'7:30 AM',text:'Senso-ji Temple',dur:'~2 hrs',
       notes:'Tour buses arrive by 10 AM \u2014 early morning incense smoke through near-empty corridors is worth it.',
       addr:'Senso-ji Temple, 2-3-1 Asakusa, Taito, Tokyo'},
      {time:'8:30 AM',text:'Nakamise-dori',
       notes:'Shopping street leading to Senso-ji. Ningyo-yaki (fish cakes), age-manju, melonpan.'},
      {time:'9:30 AM',text:'Kappabashi-dori',
       notes:'Restaurant supply street \u2014 plastic food models, knives, ceramics. Fascinating even if you buy nothing.'},
    ]},
    {label:'Afternoon',items:[
      {time:'11:00 AM',text:'Yanaka',dur:'~1.5 hrs',
       notes:'Tokyo\'s best-preserved traditional neighborhood. Yanaka Cemetery (cherry trees) and Yanaka Ginza covered shopping street.',
       addr:'Yanaka, Taito-ku, Tokyo'},
      {time:'1:00 PM',text:'Lunch in Yanaka',
       notes:'Local tofu shops and small family restaurants. Cheap and unpretentious.'},
      {time:'2:30 PM',text:'Akihabara',
       notes:'Electronics, retro games, multi-floor arcades. 15 min walk from Yanaka.',
       addr:'Akihabara, Chiyoda-ku, Tokyo'},
    ]},
    {label:'Evening',items:[
      {time:'7:00 PM',text:'Fuunji Ramen',
       notes:'Exceptional tsukemen (dipping ramen). Short queue usual \u2014 worth the wait.',
       addr:'Fuunji Ramen, Nishi-Shinjuku, Tokyo'},
      {time:'8:30 PM',text:'Golden Gai',
       notes:'~80 tiny themed bars \u2014 jazz, film noir, rock. Each seats about 8 people. Just wander in, most welcome tourists.'},
    ]},
  ],tip:''},

  apr19:{id:'apr19',date:'SUN APR 19',title:'Kamakura Day Trip',location:'Tokyo \u2192 Kamakura (~1 hr)',periods:[
    {label:'Morning',items:[
      {time:'8:00 AM',text:'JR Shonan-Shinjuku Line \u2192 Kita-Kamakura',
       notes:'~1 hr \u00b7 \u00a5920/person (~$6) \u00b7 Weekends are busy \u2014 arriving before 10 AM puts you ahead of tour groups'},
      {time:'9:15 AM',text:'Engaku-ji Temple',dur:'~45 min',cost:300,
       notes:'Cedar forest, zen garden. Quiet and meditative in the morning.',
       addr:'Engaku-ji, 409 Yamanouchi, Kamakura, Kanagawa'},
      {time:'10:00 AM',text:'Walk trail south to Kamakura',dur:'20\u201330 min',
       notes:'Scenic forest path between Kita-Kamakura and central Kamakura. Stay on the main trail.'},
    ]},
    {label:'Afternoon',items:[
      {time:'11:00 AM',text:'Great Buddha \u00b7 Kotoku-in',dur:'~1 hr',cost:300,
       notes:'13th-century bronze Buddha, 13 metres tall. You can enter the hollow statue for a small extra fee.',
       addr:'Kotoku-in, 4-2-28 Hase, Kamakura, Kanagawa'},
      {time:'12:00 PM',text:'Hase-dera Temple',dur:'~1 hr',cost:400,
       notes:'Ocean views over Kamakura Bay, cave system with 11,000 miniature Jizo statues.',
       addr:'Hase-dera Temple, 3-11-2 Hase, Kamakura, Kanagawa'},
      {time:'1:00 PM',text:'Lunch near Hase Station',
       notes:'Shirasu (whitebait) is the local specialty \u2014 shirasu don (rice bowl) or shirasu pizza.'},
      {time:'2:30 PM',text:'Tsurugaoka Hachimangu Shrine',
       notes:'Optional if energy allows. Main shrine of Kamakura \u2014 impressive approach avenue.',
       addr:'Tsurugaoka Hachimangu, 2-1-31 Yukinoshita, Kamakura'},
    ]},
    {label:'Evening',items:[
      {time:'4:00 PM',text:'Return to Shinjuku',
       notes:'Aim to be back by 5:30 PM'},
      {time:'6:00 PM',text:'Arrange takkyubin at hotel front desk',
       notes:'Send luggage: Hotel Gracery Shinjuku \u2192 Hotel Granvia Kyoto\nSent Apr 19 arrives Apr 21 \u00b7 ~\u00a51,500\u20132,000/bag (~$10\u201313)'},
      {time:'7:30 PM',text:'Last dinner in Shinjuku'},
    ]},
  ],tip:'Weekends in Kamakura are busy \u2014 arriving before 10 AM puts you ahead of the tour groups.'},

  apr20:{id:'apr20',date:'MON APR 20',title:'Fuji Excursion \u2192 Kawaguchiko \u2192 Hakone',location:'Shinjuku \u2192 Kawaguchiko \u2192 Gora',periods:[
    {label:'Morning',items:[
      {time:'8:30 AM',text:'Fuji-Excursion 7 \u00b7 Shinjuku \u2192 Kawaguchiko',type:'booked',cost:8400,
       notes:'Res: E77821 \u00b7 Pickup code: 24492390994521288\nCar 3, Seat 13-C (Gwen) & 13-D (Christina) \u00b7 Arrives 10:26 AM'},
      {time:'10:30 AM',text:'Oishi Park',dur:'~1.5 hrs',
       notes:'North shore of Lake Kawaguchi \u2014 best Fuji reflections in the lake with late cherry blossoms.',
       addr:'Oishi Park, Kawaguchiko, Fujikawaguchiko, Yamanashi'},
      {time:'12:00 PM',text:'Chureito Pagoda',dur:'~1 hr',
       notes:'30 min from Kawaguchiko \u00b7 ~400 stone steps \u00b7 Iconic 5-story pagoda framing Fuji \u2014 worth the detour if skies are clear.',
       addr:'Chureito Pagoda, Arakurayama Sengen Park, Fujiyoshida, Yamanashi'},
    ]},
    {label:'Afternoon',items:[
      {time:'1:00 PM',text:'Lunch \u00b7 Kawaguchiko Station area',
       notes:'Hoto noodles \u2014 thick flat noodles in miso broth with pumpkin. Local specialty of Yamanashi.'},
      {time:'2:00 PM',text:'Bus via Gotemba \u2192 Gora',dur:'~2.5 hrs',
       notes:'Day bags only \u2014 luggage already forwarded to Kyoto via takkyubin'},
      {time:'~4:30 PM',text:'Arrive Gora \u00b7 walk to ryokan',
       notes:'2\u20133 min walk from Gora Station to Tensui Saryo'},
      {time:'5:00 PM',text:'Check in Tensui Saryo',type:'booked',
       notes:'Res: IK1516984808 \u00b7 Verify: 0F35443D931C12B \u00b7 +81-570-062-302\nDetached Type-A \u00b7 Private open-air onsen + foot bath \u00b7 Check-in 15:00\u201321:30',
       addr:'Tensui Saryo, 1320-276 Gora, Hakone, Kanagawa'},
    ]},
    {label:'Evening',items:[
      {time:'5:30 PM',text:'Change into yukata \u00b7 private onsen',
       notes:'Yukata and slippers provided. Use the private rotenburo on your deck before dinner too.'},
      {time:'7:45 PM',text:'Kaiseki dinner \u00b7 Tensui Saryo',type:'booked',
       notes:'10-course traditional kaiseki \u00b7 Dinner and breakfast included in room rate'},
    ]},
  ],tip:'Morning is the best window for Mt. Fuji views before clouds build. The Chureito Pagoda detour is worth it if skies are clear.'},

  apr21:{id:'apr21',date:'TUE APR 21',title:'The Hakone Loop',location:'Gora \u2192 Owakudani \u2192 Lake Ashi',periods:[
    {label:'Morning',items:[
      {time:'9:00 AM',text:'Hakone Open Air Museum',dur:'~2 hrs',cost:2000,
       notes:'10 min walk from ryokan \u00b7 Outdoor sculptures, Picasso Pavilion (300+ works), foot onsen inside\nBuy the Hakone Free Pass at Gora Station (~\u00a54,000 \u00b7 covers Tozan Railway, ropeway, and Lake Ashi boat)',
       addr:'Hakone Open Air Museum, 1121 Ninotaira, Hakone, Kanagawa'},
      {time:'11:00 AM',text:'Tozan Railway: Gora \u2192 Sounzan',dur:'10 min',
       notes:'Covered by Hakone Free Pass'},
      {time:'11:15 AM',text:'Ropeway: Sounzan \u2192 Owakudani',dur:'~25 min',
       notes:'Best Fuji views in the morning before clouds build. Covered by Hakone Free Pass.'},
    ]},
    {label:'Midday',items:[
      {time:'12:00 PM',text:'Owakudani volcanic valley',cost:500,
       notes:'Black eggs boiled in volcanic hot spring \u2014 supposedly adds 7 years per egg. Active sulfur vents.',
       addr:'Owakudani, Hakone, Ashigarashimo-gun, Kanagawa'},
      {time:'1:00 PM',text:'Ropeway \u2192 Togendai on Lake Ashi',dur:'~25 min',
       notes:'Covered by Hakone Free Pass'},
      {time:'1:30 PM',text:'Lake Ashi sightseeing boat \u2192 Moto-Hakone',dur:'30 min',
       notes:'Views of Mt. Fuji over the lake on a clear day. Covered by Hakone Free Pass.'},
    ]},
    {label:'Afternoon',items:[
      {time:'2:30 PM',text:'Hakone Shrine',dur:'~45 min',
       notes:'Torii gate rising directly from the lake surface. Very photogenic from the lakeside path.',
       addr:'Hakone Shrine, 80-1 Motohakone, Hakone, Kanagawa'},
      {time:'3:30 PM',text:'Lunch near Moto-Hakone',
       notes:'Tofu cuisine and soba restaurants near the shrine.'},
      {time:'5:00 PM',text:'Return to Gora \u00b7 Tozan Railway'},
      {time:'5:30 PM',text:'Private open-air onsen at ryokan',dur:'~1.5 hrs',
       notes:'Most magical at dusk \u2014 use it before dinner.'},
    ]},
    {label:'Evening',items:[
      {time:'7:45 PM',text:'Kaiseki dinner \u00b7 Tensui Saryo',type:'booked',
       notes:'10-course kaiseki \u00b7 Second night \u00b7 Dinner included in room rate'},
    ]},
  ],tip:'Buy the Hakone Free Pass at Gora Station \u2014 covers Tozan Railway, ropeway, and Lake Ashi boat. ~\u00a54,000 for 2 days.'},

  apr22:{id:'apr22',date:'WED APR 22',title:'Depart Hakone \u2192 Arrive Kyoto',location:'Gora \u2192 Odawara \u2192 Kyoto',periods:[
    {label:'Morning',items:[
      {time:'7:00 AM',text:'Breakfast at ryokan \u00b7 included'},
      {time:'9:00 AM',text:'Check out Tensui Saryo',
       notes:'Must leave by 9:00 AM'},
      {time:'9:05 AM',text:'Tozan Railway: Gora \u2192 Hakone-Yumoto',dur:'~35 min'},
      {time:'9:45 AM',text:'Local train: Hakone-Yumoto \u2192 Odawara',dur:'~15 min'},
      {time:'10:11 AM',text:'HIKARI 637 \u00b7 Odawara \u2192 Kyoto',type:'booked',cost:23800,
       notes:'Res: 2002 \u00b7 Smart EX: 9007241665\nSeries N700 \u00b7 Ordinary class \u00b7 Car 11, Seats 10-D & 10-E \u00b7 Board via QR-Ticket'},
      {time:'12:12 PM',text:'Arrive Kyoto Station'},
    ]},
    {label:'Afternoon',items:[
      {time:'12:15 PM',text:'Check in Hotel Granvia Kyoto',type:'booked',
       notes:'Conf: #23151SF060529 \u00b7 +81-75-344-8888\nJR Kyoto Station (Karasuma exit) \u00b7 Luggage arriving from takkyubin (sent Apr 19, arrives Apr 21)',
       addr:'Hotel Granvia Kyoto, JR Kyoto Station, Kyoto'},
      {time:'2:30 PM',text:'Fushimi Inari Taisha \u00b7 preview visit',
       notes:'5 min by JR from Kyoto Station \u00b7 FREE \u00b7 Open 24 hrs\nLower gates only today \u2014 save energy for tomorrow\'s 6 AM hike.',
       addr:'Fushimi Inari Taisha, 68 Fukakusa Yabunouchicho, Fushimi-ku, Kyoto'},
    ]},
    {label:'Evening',items:[
      {time:'5:30 PM',text:'Nishiki Market',
       notes:'Closes ~5:30 PM weekdays \u2014 arrive by 5 PM. Kyoto pickles, sakura sweets, matcha soft serve.',
       addr:'Nishiki Market, Nishikikoji Street, Nakagyo-ku, Kyoto'},
      {time:'7:30 PM',text:'Dinner in Gion or Pontocho',
       notes:'Pontocho is a narrow lantern-lit alley along the Kamo River \u2014 atmospheric at night.'},
    ]},
  ],tip:'Check out by 9 AM is essential. The full Fushimi Inari hike is tomorrow at 6 AM.'},

  apr23:{id:'apr23',date:'THU APR 23',title:'Fushimi Inari + Arashiyama',location:'Kyoto \u00b7 Southern + Western',periods:[
    {label:'Very Early Morning',items:[
      {time:'5:45 AM',text:'JR Nara Line \u2192 Inari Station',
       notes:'5 min \u00b7 \u00a5150/person (~$1)'},
      {time:'6:00 AM',text:'Fushimi Inari Taisha',dur:'~2.5 hrs',
       notes:'10,000 vermilion torii gates. By 8 AM it\'s crowded; 6 AM is genuinely transformative.\nFull hike to summit and back ~2 hrs \u00b7 Yotsutsuji crossroads (~45 min up) has the best views and a rest stop.',
       addr:'Fushimi Inari Taisha, 68 Fukakusa Yabunouchicho, Fushimi-ku, Kyoto'},
      {time:'8:30 AM',text:'Breakfast at Inari street stalls',
       notes:'Inari-zushi, grilled skewers, matcha drinks from vendors outside the main gate.'},
    ]},
    {label:'Late Morning',items:[
      {time:'9:30 AM',text:'JR Sagano Line \u2192 Saga-Arashiyama',
       notes:'~25 min \u00b7 \u00a5240/person (~$2)'},
      {time:'10:00 AM',text:'Arashiyama Bamboo Grove',dur:'~45 min',
       notes:'Still manageable at 10 AM on a weekday. Towering bamboo on both sides \u2014 genuinely otherworldly.',
       addr:'Arashiyama Bamboo Grove, Sagatenryuji, Ukyo-ku, Kyoto'},
      {time:'10:45 AM',text:'Tenryu-ji Temple',dur:'~45 min',cost:500,
       notes:'UNESCO site. Beautiful strolling garden with pond \u2014 mountain backdrop is quintessential Kyoto.',
       addr:'Tenryu-ji, 68 Sagatenryuji Susukinobabacho, Ukyo-ku, Kyoto'},
      {time:'11:30 AM',text:'Togetsukyo Bridge',
       notes:'Iconic bridge over the Oi River. Good views of the mountains from the riverbank.',
       addr:'Togetsukyo Bridge, Sagatenryuji, Ukyo-ku, Kyoto'},
    ]},
    {label:'Afternoon',items:[
      {time:'12:30 PM',text:'Lunch in Arashiyama',
       notes:'Yudofu (hot tofu), matcha soba, or a riverside caf\u00e9. Take your time \u2014 you started at dawn.'},
      {time:'2:30 PM',text:'Ninenzaka + Sannenzaka',dur:'~1 hr',
       notes:'Preserved stone-paved streets lined with tea houses and craft shops.',
       addr:'Ninenzaka, Higashiyama-ku, Kyoto'},
      {time:'3:30 PM',text:'Kiyomizudera Temple',dur:'~1 hr',cost:500,
       notes:'Dramatic wooden stage jutting from the mountainside \u2014 panoramic views over eastern Kyoto.',
       addr:'Kiyomizudera, 1-294 Kiyomizu, Higashiyama-ku, Kyoto'},
    ]},
    {label:'Evening',items:[
      {time:'5:30 PM',text:'Gion \u00b7 Hanamikoji Street',
       notes:'Watch for geiko and maiko in the early evening. No photography rule is taken seriously here.',
       addr:'Hanamikoji Street, Gion, Higashiyama-ku, Kyoto'},
      {time:'7:00 PM',text:'Dinner in Gion or Pontocho',
       notes:'Book in advance for anything good in Gion. Pontocho has more walk-in options.'},
    ]},
  ],tip:'6 AM at Fushimi Inari is the single best timing call of the Kyoto trip.'},

  apr24:{id:'apr24',date:'FRI APR 24',title:'Nara Day Trip + Central Kyoto',location:'Kyoto \u2192 Nara \u2192 Central Kyoto',periods:[
    {label:'Morning',items:[
      {time:'8:30 AM',text:'JR Nara Line: Kyoto \u2192 Nara',
       notes:'45 min \u00b7 \u00a5760/person (~$5)'},
      {time:'9:30 AM',text:'Nara Park \u00b7 deer',
       notes:'Hundreds of freely roaming deer who bow for crackers (shika senbei, ~\u00a5200 from vendors). Watch your bags.',
       addr:'Nara Park, Zoshicho, Nara'},
      {time:'10:00 AM',text:'Todai-ji Temple',dur:'~1.5 hrs',cost:600,
       notes:'World\'s largest wooden building. The bronze Daibutsu inside is 15 metres tall \u2014 genuinely awe-inspiring.\nSqueezing through the wooden pillar nostril hole inside is said to bring enlightenment.',
       addr:'Todai-ji, 406-1 Zoshicho, Nara'},
      {time:'11:30 AM',text:'Kasuga Taisha Shrine',
       notes:'3,000 stone and bronze lanterns lining forested paths. Less crowded than Todai-ji.',
       addr:'Kasuga Taisha, 160 Kasuganocho, Nara'},
      {time:'12:30 PM',text:'Lunch in Nara',
       notes:'Kakinoha-zushi (sushi wrapped in persimmon leaf) is the local specialty.'},
    ]},
    {label:'Afternoon',items:[
      {time:'2:00 PM',text:'Return to Kyoto by JR'},
      {time:'3:00 PM',text:'Nishiki Market',dur:'~1 hr',
       notes:'Go before 5:30 PM closing. Sakura-themed sweets in April, Kyoto pickles, matcha everything.',
       addr:'Nishiki Market, Nishikikoji Street, Nakagyo-ku, Kyoto'},
      {time:'4:30 PM',text:'Teramachi + Shinkyogoku arcades',
       notes:'Covered shopping arcades adjacent to Nishiki \u2014 good for souvenirs and snacks.'},
    ]},
    {label:'Evening',items:[
      {time:'6:00 PM',text:"Philosopher's Path",dur:'~1 hr',
       notes:'2 km canal walk lined with cherry trees. Best at dusk.',
       addr:"Philosopher's Path, Sakyo-ku, Kyoto"},
      {time:'7:30 PM',text:'Dinner in Pontocho or Gion'},
    ]},
  ],tip:'Nara is best before 10 AM when the deer are calm and the temples quiet.'},

  apr25:{id:'apr25',date:'SAT APR 25',title:'Osaka Day Trip + Kinkaku-ji',location:'Kyoto \u2192 Osaka \u2192 Northern Kyoto',periods:[
    {label:'Morning',items:[
      {time:'9:00 AM',text:'JR Shinkaisoku: Kyoto \u2192 Osaka',
       notes:'~30 min \u00b7 \u00a5580/person (~$4)'},
      {time:'10:00 AM',text:'Osaka Aquarium Kaiyukan',dur:'~2 hrs',cost:2700,
       notes:'Whale sharks in a 4-storey Pacific Ocean tank. Book tickets online in advance to skip the queue.',
       addr:'Osaka Aquarium Kaiyukan, 1-1-10 Kaigandori, Minato-ku, Osaka'},
      {time:'12:30 PM',text:'Dotonbori',dur:'~1.5 hrs',
       notes:'Neon food street. Try: takoyaki (octopus balls), okonomiyaki (savory pancake), kushikatsu (fried skewers). The Glico Running Man sign.',
       addr:'Dotonbori, Chuo-ku, Osaka'},
    ]},
    {label:'Afternoon',items:[
      {time:'2:30 PM',text:'Kuromon Ichiba Market',dur:'~1 hr',
       notes:'580m covered market. Fresh scallops, crab, and sea urchin at stalls.',
       addr:'Kuromon Ichiba Market, Nipponbashi, Chuo-ku, Osaka'},
      {time:'3:30 PM',text:'Osaka Castle \u00b7 optional',cost:600,
       notes:'Beautiful grounds and moat. Museum inside. Worth it if energy allows.',
       addr:'Osaka Castle, 1-1 Osakajo, Chuo-ku, Osaka'},
      {time:'4:30 PM',text:'Return to Kyoto \u00b7 JR Shinkaisoku',
       notes:'~30 min'},
    ]},
    {label:'Late Afternoon',items:[
      {time:'4:30 PM',text:'Kinkaku-ji \u00b7 Golden Pavilion',cost:500,
       notes:'Late afternoon light on the gold leaf is the best time to visit. Closes 5 PM \u2014 arrive by 4:30.\nExtremely crowded but genuinely worth seeing once.',
       addr:'Kinkaku-ji, 1 Kinkakujicho, Kita-ku, Kyoto'},
    ]},
    {label:'Evening',items:[
      {time:'7:00 PM',text:'Last night in Kyoto \u00b7 dinner',
       notes:'Kawaramachi or Shijo area. Consider a splurge kaiseki if you haven\'t had one yet.'},
    ]},
  ],tip:'Book Kaiyukan online in advance. Kinkaku-ji late afternoon light is beautiful.'},

  apr26:{id:'apr26',date:'SUN APR 26',title:'Depart Kyoto \u2192 Kanazawa',location:'Kyoto \u2192 Kanazawa',periods:[
    {label:'Morning',items:[
      {time:'10:00 AM',text:'Check out Hotel Granvia Kyoto',type:'booked',
       notes:'Conf: #23151SF060529'},
      {time:'10:37 AM',text:'Thunder-Bird 15 \u00b7 Kyoto \u2192 Tsuruga',type:'booked',cost:7720,
       notes:'Res: 47842 \u00b7 Receipt ID: ADN1766K \u00b7 ¥15,440 total for 2\nCar 4, Seats 10-A & 10-B \u00b7 Arrives Tsuruga 11:30 \u00b7 9-min transfer\nPick up physical tickets at JR West machine before boarding \u00b7 bring Visa ending 2990 + 4-digit PIN'},
      {time:'11:39 AM',text:'Tsurugi 16 \u00b7 Tsuruga \u2192 Kanazawa',type:'booked',sub:true,
       notes:'Car 7, Seats 9-D & 9-E \u00b7 Arrives Kanazawa 12:36'},
    ]},
    {label:'Afternoon',items:[
      {time:'12:36 PM',text:'Arrive Kanazawa Station'},
      {time:'3:00 PM',text:'Check in Hotel Intergate Kanazawa',type:'booked',
       notes:'Conf: 20260125110822242 \u00b7 Expedia: 73356721260247\nSuperior Twin \u00b7 Breakfast buffet included \u00b7 2-5 Takaokamachi \u00b7 +81-76-205-1122',
       addr:'Hotel Intergate Kanazawa, 2-5 Takaokamachi, Kanazawa'},
      {time:'3:30 PM',text:'21st Century Museum of Contemporary Art',dur:'~1.5 hrs',cost:1400,
       notes:'VISIT TODAY \u2014 closed Mondays.\nSwimming Pool (Leandro Erlich) + Blue Planet Sky (James Turrell) \u2014 both must-sees. Free exchange zone outside.',
       addr:'21st Century Museum, 1-2-1 Hirosaka, Kanazawa, Ishikawa'},
    ]},
    {label:'Evening',items:[
      {time:'6:00 PM',text:'Higashi Chaya District',dur:'~1.5 hrs',
       notes:'Japan\'s best-preserved geisha quarter outside Kyoto. Gold leaf shops, tea houses, machiya townhouses.',
       addr:'Higashi Chaya District, Higashiyama, Kanazawa, Ishikawa'},
      {time:'7:30 PM',text:'Dinner \u00b7 Korinbo area',
       notes:'Nodoguro (blackthroat seaperch) and sweet shrimp are Kanazawa specialties.'},
    ]},
  ],tip:'The 21st Century Museum is CLOSED on Mondays \u2014 visit it today on arrival.'},

  apr27:{id:'apr27',date:'MON APR 27',title:'Kanazawa Full Day',location:'Kenroku-en \u00b7 Omicho \u00b7 Nagamachi',periods:[
    {label:'Morning',items:[
      {time:'7:00 AM',text:'Kenroku-en Garden',dur:'~2 hrs',cost:320,
       notes:'One of Japan\'s three great gardens. Most peaceful before 9 AM. Kasumigaike Pond + Kotojitoro lantern.\nFree entry from 4 AM via Mayumizaka Gate.',
       addr:'Kenroku-en, 1 Kenrokumachi, Kanazawa, Ishikawa'},
      {time:'9:00 AM',text:'Kanazawa Castle Park',
       notes:'Directly adjacent to Kenroku-en. Free grounds. White plaster walls and elegant restored gates.',
       addr:'Kanazawa Castle, 1-1 Marunouchi, Kanazawa, Ishikawa'},
      {time:'10:30 AM',text:'Omicho Market',dur:'~1.5 hrs',
       notes:'Kanazawa\'s kitchen. Kaisendon (seafood rice bowl) from market stalls \u2014 arrive before noon before lines grow.',
       addr:'Omicho Market, 50 Kami-Omicho, Kanazawa, Ishikawa'},
    ]},
    {label:'Afternoon',items:[
      {time:'1:00 PM',text:'Nagamachi Samurai District',dur:'~1.5 hrs',cost:550,
       notes:'Preserved samurai residences and mud walls. Nomura Clan House \u2014 beautiful garden and tatami rooms.',
       addr:'Nagamachi, Kanazawa, Ishikawa'},
      {time:'3:00 PM',text:'D.T. Suzuki Museum',dur:'~1 hr',cost:310,
       notes:'Meditative architecture by Yoshio Taniguchi. Water mirror garden. Calm and contemplative.',
       addr:'D.T. Suzuki Museum, 3-4-20 Honda-machi, Kanazawa, Ishikawa'},
    ]},
    {label:'Evening',items:[
      {time:'6:30 PM',text:'Dinner \u00b7 Kanazawa seafood',
       notes:'Nodoguro, snow crab, sweet shrimp. One of the best food cities in Japan. Splurge if anywhere.'},
    ]},
  ],tip:'Kenroku-en is most peaceful early morning. 21st Century Museum closed today (Monday) \u2014 you visited yesterday.'},

  apr28:{id:'apr28',date:'TUE APR 28',title:'Depart Kanazawa \u2192 Tokyo Ginza',location:'Kanazawa \u2192 Tokyo \u00b7 Ginza',periods:[
    {label:'Morning',items:[
      {time:'7:00 AM',text:'Breakfast buffet at Hotel Intergate \u00b7 included',
       notes:'Allow time \u2014 train departs at 9:07 AM. Aim to finish by 8:15 AM.'},
      {time:'8:30 AM',text:'Check out \u00b7 by 8:30 AM',
       notes:'Hotel checkout is by 11:00 AM but train departs 9:07 \u2014 check out early and walk to Kanazawa Station (~10 min)'},
      {time:'9:07 AM',text:'Kagayaki 506 \u00b7 Kanazawa \u2192 Tokyo',type:'booked',cost:15000,
       notes:'Res: 41398 \u00b7 Receipt ID: ADN1800K \u00b7 \u00a530,000 total for 2\nCar 7, Seats 5-D & 5-E \u00b7 Arrives Tokyo 11:36 \u00b7 Non-stop ~2.5 hrs\nPick up physical tickets at JR West machine before boarding \u00b7 bring Visa ending 2990 + 4-digit PIN'},
    ]},
    {label:'Afternoon',items:[
      {time:'2:30 PM',text:'Hamarikyu Gardens',dur:'~1 hr',cost:300,
       notes:'Traditional stroll garden on Tokyo Bay. Peaceful contrast after the shinkansen.',
       addr:'Hamarikyu Gardens, 1-1 Hamarikyuteien, Chuo-ku, Tokyo'},
      {time:'3:00 PM',text:'Check in Quintessa Hotel Tokyo Ginza',type:'booked',
       notes:'Conf: 6519361226 \u00b7 PIN: 9235 \u00b7 Hollywood Twin \u00b7 Breakfast included\n4-11-4 Ginza, Chuo-ku \u00b7 +81 3-6264-1351',
       addr:'Quintessa Hotel Tokyo Ginza, 4-11-4 Ginza, Chuo-ku, Tokyo'},
      {time:'4:00 PM',text:'Ginza streets',
       notes:'Itoya stationery (excellent for gifts), Ginza Six, window shopping. Ginza is Japan\'s most expensive real estate.'},
    ]},
    {label:'Evening',items:[
      {time:'6:30 PM',text:'Tsukiji Outer Market \u00b7 dinner',
       notes:'Sushi, grilled seafood, sake bars. 10 min walk from hotel. Preview for tomorrow\'s breakfast.',
       addr:'Tsukiji Outer Market, 4-16-2 Tsukiji, Chuo-ku, Tokyo'},
      {time:'8:00 PM',text:'Ginza evening stroll',
       notes:'The perfect last night in Japan. Pack tonight. Flight tomorrow at 6:10 PM.'},
    ]},
  ],tip:'Pack tonight. Flight departs HND at 6:10 PM tomorrow \u2014 leave the hotel by 12:30 PM.'},

  apr29:{id:'apr29',date:'WED APR 29',title:'Final Morning + Depart',location:'Tokyo Ginza \u2192 HND \u2192 LAX',periods:[
    {label:'Morning',items:[
      {time:'7:30 AM',text:'Tsukiji Outer Market \u00b7 breakfast',dur:'~1.5 hrs',
       notes:'10 min walk from hotel. Fresh sushi, tamagoyaki, grilled scallops, matcha. Best before 10 AM.',
       addr:'Tsukiji Outer Market, 4-16-2 Tsukiji, Chuo-ku, Tokyo'},
      {time:'10:00 AM',text:'Return to hotel \u00b7 collect luggage'},
    ]},
    {label:'Afternoon',items:[
      {time:'12:30 PM',text:'Depart hotel for Haneda Airport',
       notes:'No later than 12:30 PM \u00b7 Keikyu Line from Higashi-Ginza \u2192 HND Terminal 3 (~30 min \u00b7 \u00a5300/person)\nAllow 2.5\u20133 hours before departure for international check-in + security'},
      {time:'6:10 PM',text:'United UA 38 \u00b7 HND \u2192 LAX',type:'booked',
       notes:'Conf: F354LH \u00b7 Seats 31J (Gwen) & 31L (Christina)\nHND \u2192 LAX \u00b7 10 hrs 5 min \u00b7 Arrives LAX 12:15 PM same day (date line)'},
    ]},
  ],tip:'Golden Week begins today \u2014 you\'re flying out. Well timed. Allow 3 hours at the airport.'},
};

const OVERVIEW_DATA = [
  {city:'Tokyo',dates:'Apr 16\u201320',nights:4,dayIds:['apr16','apr17','apr18','apr19'],hotel:'Hotel Gracery Shinjuku \u00b7 Kabukicho, Shinjuku',phone:'+81 3 6833 1111',
   highlights:[
     {text:'teamLab Borderless \u2014 immersive digital art filling entire rooms',star:true,url:'https://borderless.teamlab.art/en/'},
     {text:'Senso-ji at dawn \u2014 incense smoke and empty lantern-lit corridors',star:true,url:'https://www.senso-ji.jp/english/'},
     {text:'Shibuya Scramble Crossing \u2014 the world\'s busiest intersection'},
     {text:'Golden Gai \u2014 forty tiny themed bars, each seating about eight people',url:'https://maps.google.com/?q=Golden+Gai+Shinjuku+Tokyo'},
   ]},
  {city:'Kamakura',dates:'Apr 19 \u00b7 day trip',nights:0,dayIds:['apr19'],waypoint:true,hotel:'Day trip from Tokyo \u00b7 45 min by JR',
   highlights:[
     {text:'Kotoku-in \u2014 13th-century bronze Great Buddha, 13 metres tall',star:true},
     {text:'Hase-dera Temple \u2014 ocean views, cave system, 11,000 Jizo statues'},
     {text:'Shirasu (whitebait) rice bowl \u2014 the Kamakura coastal specialty'},
   ]},
  {city:'Kawaguchiko',dates:'Apr 20 \u00b7 morning only',nights:0,dayIds:['apr20'],waypoint:true,hotel:'Transit stop en route to Hakone',
   highlights:[
     {text:'Oishi Park \u2014 Mt. Fuji reflected in the lake with cherry blossoms',star:true},
     {text:'Chureito Pagoda \u2014 five-story pagoda framing Fuji from above'},
   ]},
  {city:'Hakone',dates:'Apr 20\u201322',nights:2,dayIds:['apr20','apr21'],hotel:'Tensui Saryo Ryokan \u00b7 Gora \u00b7 private outdoor onsen',phone:'+81-570-062-302',
   highlights:[
     {text:'Private rotenburo on the deck \u2014 a hot spring under the stars at midnight',star:true},
     {text:'10-course kaiseki dinner both evenings',star:true},
     {text:'Owakudani volcanic ropeway \u2014 active sulfur craters and black eggs',url:'https://www.hakoneropeway.co.jp/en/'},
     {text:'Lake Ashi boat cruise \u2014 torii gate rising from the water',url:'https://www.hakone-kankosen.co.jp/foreign/en/'},
   ]},
  {city:'Kyoto',dates:'Apr 22\u201326',nights:4,dayIds:['apr22','apr23','apr24','apr25'],hotel:'Hotel Granvia Kyoto \u00b7 connected to Kyoto Station',phone:'+81-75-344-8888',
   highlights:[
     {text:'Fushimi Inari at 6 AM \u2014 10,000 vermilion torii gates, empty at dawn',star:true,url:'https://inari.jp/en/'},
     {text:'Arashiyama bamboo grove \u2014 towering stalks swaying overhead',star:true},
     {text:'Gion at dusk \u2014 wooden alleyways, lantern glow, chance to spot a geiko'},
     {text:"Philosopher's Path \u2014 2 km canal walk lined with cherry trees"},
   ]},
  {city:'Nara',dates:'Apr 24 \u00b7 day trip',nights:0,dayIds:['apr24'],waypoint:true,hotel:'Day trip from Kyoto \u00b7 45 min by JR Nara Line',
   highlights:[
     {text:'Hundreds of freely roaming deer bowing for crackers in Nara Park',star:true},
     {text:"Todai-ji \u2014 the world's largest wooden building, giant bronze Buddha inside",star:true},
     {text:'Kasuga Taisha Shrine \u2014 3,000 stone and bronze lanterns, forested paths'},
   ]},
  {city:'Osaka',dates:'Apr 25 \u00b7 day trip',nights:0,dayIds:['apr25'],waypoint:true,hotel:'Day trip from Kyoto \u00b7 30 min by JR Shinkaisoku',
   highlights:[
     {text:'Kaiyukan Aquarium \u2014 whale sharks in a four-storey Pacific Ocean tank',star:true,url:'https://www.kaiyukan.com/language/eng/'},
     {text:'Dotonbori \u2014 takoyaki, okonomiyaki, the Glico Running Man sign'},
   ]},
  {city:'Kanazawa',dates:'Apr 26\u201328',nights:2,dayIds:['apr26','apr27'],hotel:'Hotel Intergate Kanazawa \u00b7 2-5 Takaokamachi',phone:'+81-76-205-1122',
   highlights:[
     {text:"Kenroku-en \u2014 one of Japan's three great gardens",star:true,url:'https://www.pref.ishikawa.jp/siro-niwa/kenrokuen/e/'},
     {text:"21st Century Museum \u2014 Leandro Erlich's Swimming Pool installation",star:true,url:'https://www.kanazawa21.jp/en/'},
     {text:'Higashi Chaya District \u2014 preserved geisha quarter, gold leaf cafes'},
   ]},
  {city:'Tokyo \u00b7 Ginza',dates:'Apr 28\u201329',nights:1,dayIds:['apr28','apr29'],hotel:'Quintessa Hotel Tokyo Ginza \u00b7 4-11-4 Ginza',phone:'+81 3-6264-1351',
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
      {k:'Seats',v:'Car 11, Seat 10-D & 10-E'},
      {k:'Boarding',v:'QR-Ticket (display from Smart EX app)'},
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
  {id:'b06',label:'Shinkansen HIKARI 637 \u2014 Odawara \u2192 Kyoto', sub:'Apr 22 \u00b7 10:11 AM \u00b7 Res: 2002 \u00b7 Car 11, 10-D & 10-E'},
  {id:'b07',label:'Hotel Granvia Kyoto',                        sub:'4 nights \u00b7 Apr 22\u201326 \u00b7 Conf: #23151SF060529'},
  {id:'b08',label:'Hotel Intergate Kanazawa',                   sub:'2 nights \u00b7 Apr 26\u201328 \u00b7 Conf: 20260125110822242'},
  {id:'b09',label:'Quintessa Hotel Tokyo Ginza',                sub:'1 night \u00b7 Apr 28\u201329 \u00b7 Conf: 6519361226'},
];

const CHECKLIST = [
  {id:'before',title:'Before you leave',items:[
    {id:'c01',label:'Shinkansen seats assigned \u2014 Car 11, 10-D & 10-E', sub:'HIKARI 637 \u00b7 Board via QR-Ticket from Smart EX app'},
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
    {jp:'\u99c5\u306f\u3069\u3053\u3067\u3059\u304b',rom:'Eki wa doko desu ka?',en:'Where is the station?'},
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
    {id:'bc1',label:'United flights + Economy Plus seats',   category:'Flights',   jpy:349100, usd:2197, paidBy:'gwen', dates:'Apr 15 + Apr 29', purchased:'Dec 22, 2025'},
    {id:'bc2',label:'Hotel Gracery Shinjuku \u00b7 4 nights', category:'Hotels',    jpy:200692, usd:1261, paidBy:'gwen', dates:'Apr 16\u201320', purchased:'Jan 25, 2026'},
    {id:'bc3',label:'teamLab Borderless \u00b7 2 tickets',    category:'Activities',jpy:11200,  usd:70,   paidBy:'gwen', dates:'Apr 17', purchased:'Mar 21, 2026'},
    {id:'bc4',label:'Fuji-Excursion 7',                      category:'Transport', jpy:8400,   usd:53,   paidBy:'gwen', dates:'Apr 20', purchased:'Mar 20, 2026'},
    {id:'bc5',label:'Tensui Saryo Ryokan \u00b7 2 nights',    category:'Hotels',    jpy:126340, usd:794,  paidBy:'gwen', dates:'Apr 20\u201322', purchased:'Jan 22, 2026'},
    {id:'bc6',label:'Shinkansen HIKARI 637',                  category:'Transport', jpy:23800,  usd:150,  paidBy:'gwen', dates:'Apr 22', purchased:'Mar 20, 2026'},
    {id:'bc7',label:'Hotel Granvia Kyoto \u00b7 4 nights',    category:'Hotels',    jpy:268256, usd:1686, paidBy:'gwen', dates:'Apr 22\u201326', purchased:'Jan 25, 2026'},
    {id:'bc10',label:'Thunder-Bird 15 + Tsurugi 16 \u00b7 Kyoto \u2192 Kanazawa', category:'Transport', jpy:15440, usd:97, paidBy:'gwen', dates:'Apr 26', purchased:'Mar 27, 2026'},
    {id:'bc8',label:'Hotel Intergate Kanazawa \u00b7 2 nights',category:'Hotels',   jpy:39004,  usd:245,  paidBy:'gwen', dates:'Apr 26\u201328', purchased:'Jan 25, 2026'},
    {id:'bc11',label:'Kagayaki 506 \u00b7 Kanazawa \u2192 Tokyo', category:'Transport', jpy:30000, usd:189, paidBy:'gwen', dates:'Apr 28', purchased:'Mar 27, 2026'},
    {id:'bc9',label:'Quintessa Hotel Ginza \u00b7 1 night',   category:'Hotels',    jpy:24713,  usd:155,  paidBy:'gwen', dates:'Apr 28\u201329', purchased:'Jan 25, 2026'},
  ];
}
const CAT_COLORS={food:'#E91E8C',transport:'#4A90D9',sightseeing:'#8B5CF6',nightlife:'#EC4899',nature:'#10B981',shopping:'#F39C12',activities:'#27AE60',other:'#8E8E8E'};


// ═══════════════════════════════════════════════════════════
// RENDER FUNCTIONS
// ═══════════════════════════════════════════════════════════

function cdHtml(){
  const now=new Date(), DAY=86400000, pad=n=>String(n).padStart(2,'0');
  if(now<T_DEPART){
    const ms=T_DEPART-now;
    // Use calendar-day diff (local midnight) so "Tomorrow" and day counts are correct
    // even when <24h remain but departure is still on the next calendar day.
    // Math.floor(ms/DAY) would give 0 for ~22h and wrongly show the live timer.
    const todayMid=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    const departMid=new Date(2026,3,15); // April 15 local midnight
    const d=Math.round((departMid-todayMid)/DAY);
    if(d>1) return '<span class="ov-cd-num">'+d+'</span><span class="ov-cd-label">days until departure</span><span class="ov-cd-sub">Apr 15 \u00b7 LAX 11:20 AM</span>';
    if(d===1){const h=Math.floor(ms/3600000);return '<span class="ov-cd-num">Tomorrow</span><span class="ov-cd-sub">'+h+'h until departure</span>';}
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
  const now=new Date(), inTrip=now>=TRIP_START&&now<=TRIP_END;
  const todayId=getTodayDayId(), todayDay=todayId?DAYS[todayId]:null;

  // ── Stop status: past / current / upcoming ────────────────
  function stopStatus(stop){
    if(!inTrip||!todayId||!stop.dayIds||!stop.dayIds.length)return '';
    if(stop.dayIds.includes(todayId))return 'stop-current';
    const todayDate=DAY_DATES[todayId];
    if(stop.dayIds.every(id=>DAY_DATES[id]&&DAY_DATES[id]<todayDate))return 'stop-past';
    return '';
  }

  const journeyHtml=OVERVIEW_DATA.map((stop,i)=>{
    const isLast=i===OVERVIEW_DATA.length-1;
    const status=stopStatus(stop);
    const herePill=status==='stop-current'?'<span class="ov-here-pill">here</span>':'';
    const hlsHtml='<ul class="ov-hls">'+stop.highlights.map(h=>{
      const inner=h.url?'<a href="'+ea(h.url)+'" target="_blank" rel="noopener">'+esc(h.text)+'<span class="ov-ext"> \u2197</span></a>':esc(h.text);
      return '<li class="ov-hl'+(h.star?' star':'')+'">'+ inner+'</li>';
    }).join('')+'</ul>';
    const line=isLast?'':'<div class="ov-stop-line"></div>';
    if(stop.waypoint){
      return '<div class="ov-stop waypoint '+status+(isLast?' ov-stop-last':'')+'">'
        +'<div class="ov-stop-left"><div class="ov-stop-dot"></div>'+line+'</div>'
        +'<div class="ov-stop-right"><div class="ov-stop-head"><div class="ov-wp-badge">Day trip</div><div class="ov-stop-city ov-wp-city">'+esc(stop.city)+herePill+'</div><div class="ov-stop-dates">'+esc(stop.dates)+'</div></div>'
        +'<div class="ov-stop-hotel">'+esc(stop.hotel)+'</div>'+hlsHtml+'</div></div>';
    }
    return '<div class="ov-stop '+status+(isLast?' ov-stop-last':'')+'">'
      +'<div class="ov-stop-left"><div class="ov-stop-dot"></div>'+line+'</div>'
      +'<div class="ov-stop-right"><div class="ov-stop-head"><div class="ov-stop-city">'+esc(stop.city)+herePill+'</div><div class="ov-stop-dates">'+esc(stop.dates)+(stop.nights?' \u00b7 '+stop.nights+' night'+(stop.nights>1?'s':''):'')+'</div></div>'
      +'<div class="ov-stop-hotel">'+esc(stop.hotel)+'</div>'+hlsHtml+'</div></div>';
  }).join('');

  // Hotel grid with tappable phone numbers
  const hotelGrid=OVERVIEW_DATA.filter(s=>!s.waypoint).map(s=>{
    const phoneHtml=s.phone?'<a class="hotel-cell-phone" href="tel:'+ea(s.phone.replace(/[\s\-]/g,''))+'">'+esc(s.phone)+'</a>':'';
    return '<div class="hotel-cell"><div class="hotel-cell-city">'+esc(s.city.split('\u00b7')[0].trim())+'</div><div class="hotel-cell-name">'+esc(s.hotel.split('\u00b7')[0].trim())+'</div>'+phoneHtml+'<div class="hotel-cell-dates">'+esc(s.dates)+'</div></div>';
  }).join('');

  // Flights card with tracking links
  const flightsHtml='<div class="ov-flights">'
    +'<div class="ov-fl-leg"><div class="ov-fl-dir">Depart \u00b7 Wed Apr 15</div>'
    +'<div class="ov-fl-airports"><span class="ov-fl-code">LAX</span><span class="ov-fl-arrow">\u2192</span><span class="ov-fl-code">HND</span></div>'
    +'<div class="ov-fl-time">11:20 AM \u2192 Apr 16, 3:05 PM</div>'
    +'<div class="ov-fl-detail">United UA 39 \u00b7 11h 45m \u00b7 787 Dreamliner</div>'
    +'<a class="ov-fl-track" href="https://www.flightaware.com/live/flight/UAL39" target="_blank" rel="noopener">Track flight \u2197</a></div>'
    +'<div class="ov-fl-leg"><div class="ov-fl-dir">Return \u00b7 Wed Apr 29</div>'
    +'<div class="ov-fl-airports"><span class="ov-fl-code">HND</span><span class="ov-fl-arrow">\u2192</span><span class="ov-fl-code">LAX</span></div>'
    +'<div class="ov-fl-time">6:10 PM \u2192 12:15 PM same day</div>'
    +'<div class="ov-fl-detail">United UA 38 \u00b7 10h 5m \u00b7 787 Dreamliner</div>'
    +'<a class="ov-fl-track" href="https://www.flightaware.com/live/flight/UAL38" target="_blank" rel="noopener">Track flight \u2197</a></div>'
    +'</div>';

  // Today's plan (only shown during trip)
  let todayPlanHtml='';
  if(inTrip&&todayDay){
    const items=todayDay.periods.flatMap(p=>p.items).filter(i=>!i.sub).slice(0,5);
    const bullets=items.map(i=>'<li class="ov-today-item">'+(i.time?'<span class="ov-today-time">'+i.time+'</span>':'')+esc(i.text)+'</li>').join('');
    const hotel=OVERVIEW_DATA.find(s=>!s.waypoint&&todayDay.location.includes(s.city.split('\u00b7')[0].trim()));
    todayPlanHtml='<div class="ov-today-card">'
      +'<div class="ov-today-hd"><span class="ov-today-badge">Today\u2019s plan</span><span class="ov-today-title">'+esc(todayDay.title)+'</span></div>'
      +'<ul class="ov-today-list">'+bullets+'</ul>'
      +(hotel?'<div class="ov-today-hotel">Staying at <strong>'+esc(hotel.hotel.split('\u00b7')[0].trim())+'</strong>'+(hotel.phone?' \u00b7 <a href="tel:'+ea(hotel.phone.replace(/[\s\-]/g,''))+'">'+esc(hotel.phone)+'</a>':'')+'</div>':'')
      +'</div>';
  }

  // Photos card — only rendered when PHOTOS_URL is set
  const photosHtml=PHOTOS_URL
    ?'<a class="ov-photos-card" href="'+ea(PHOTOS_URL)+'" target="_blank" rel="noopener">'
      +'<span class="ov-photos-icon"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg></span>'
      +'<span class="ov-photos-text"><span class="ov-photos-label">Photos from Japan</span><span class="ov-photos-sub">See what Gwen &amp; Christina are up to</span></span>'
      +'<span class="ov-photos-arrow">\u2192</span>'
      +'</a>'
    :'';

  el.innerHTML=
    '<div class="ov-accent"><div class="ov-accent-inner"><div class="ov-accent-left"><div class="ov-accent-byline">Gwendalynn \u0026 Christina</div><div class="ov-accent-title">Japan 2026</div><div class="ov-accent-sub">April 15\u201329 \u00b7 15 days</div></div><div class="ov-accent-right" id="ovCd">'+cdHtml()+'</div></div><div class="ov-accent-stripe" id="ovJapanTime">'+japanTimeHtml()+'</div></div>'
    +todayPlanHtml
    +photosHtml
    +'<div class="ov-section-label">The route<span class="ov-section-label-sub">5 cities \u00b7 15 days</span></div><div class="ov-route">'+journeyHtml+'</div>'
    +'<div class="ov-cta-row"><button class="ov-cta" onclick="switchTab(\'itinerary\')">View detailed day-by-day plan \u2192</button></div>'
    +'<div class="ov-section-label" style="margin-top:32px">Flights</div>'
    +flightsHtml
    +'<div class="ov-section-label" style="margin-top:28px">Hotels &amp; emergency contacts</div>'
    +'<div class="ov-info-note">Dial +81 numbers as shown from any US phone. Tap to call. Reach us via iMessage or WhatsApp.</div>'
    +'<div class="family-strip"><div class="hotel-grid">'+hotelGrid+'</div></div>';

  if(ovTimer)clearInterval(ovTimer);
  // Only use 1-second ticking on the actual departure day (d===0); "Tomorrow" only needs hourly updates
  const todayMidCd=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  const departMidCd=new Date(2026,3,15);
  const daysLeftCd=Math.round((departMidCd-todayMidCd)/86400000);
  const closeToDepart=now<T_DEPART&&daysLeftCd===0;
  ovTimer=setInterval(()=>{
    const c=$('ovCd');if(c)c.innerHTML=cdHtml();
    const jt=$('ovJapanTime');if(jt)jt.innerHTML=japanTimeHtml();
  }, closeToDepart?1000:60000);
}

// ── Itinerary ─────────────────────────────────────────────────
function renderItinerary(){
  const el=$('panel-itinerary'); if(!el)return;

  const hasPast=Object.keys(DAYS).some(id=>getDayClass(id)==='past');
  const toolbar=hasPast?'<div class="itin-toolbar"><button class="past-toggle-btn" id="pastToggleBtn">'+(hidePastDays?'Show past days':'Hide past days')+'</button></div>':'';

  const todayExists=!!getTodayDayId();
  const viewerHintText=todayExists
    ? "<strong>Today's plan is open below.</strong> Tap any other day to see what's planned."
    : 'Tap any day to see the full schedule, maps, and details.';
  const viewerHint='<div class="viewer-hint">'
    +'<span class="viewer-hint-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></span>'
    +'<span class="viewer-hint-text">'+viewerHintText+'</span>'
    +'</div>';

  const sections=GROUPS.map((g,i)=>{
    const vis=g.ids.filter(id=>!(hidePastDays&&getDayClass(id)==='past'));
    if(!vis.length)return '';
    return '<div class="dest-section" id="section-'+i+'"><div class="dest-header"><span class="dest-name">'+esc(g.label)+'</span><span class="dest-dates-label">'+esc(g.dates)+'</span></div>'+vis.map(id=>renderDay(DAYS[id])).join('')+'</div>';
  }).join('');

  el.innerHTML=viewerHint+toolbar+sections;

  el.querySelectorAll('.day-header').forEach(h=>{
    h.addEventListener('click',()=>{
      const card=h.parentElement, dayId=card.id.replace('card-','');
      card.classList.toggle('expanded');
      if(card.classList.contains('expanded')){
        expandedCards.add(dayId);
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
      initSortable(todayId);
    }
    if(todayIdx>=0&&todayIdx<dayKeys.length-1){
      const tmrwId=dayKeys[todayIdx+1];
      const tmrwCard=document.getElementById('card-'+tmrwId);
      if(tmrwCard){
        tmrwCard.classList.add('expanded');
        expandedCards.add(tmrwId);
        initSortable(tmrwId);
      }
    }
    if(card)setTimeout(()=>{
      const hH=document.querySelector('header')?.offsetHeight||0;
      const pH=$('destPillsWrap')?.offsetHeight||0;
      window.scrollTo({top:card.getBoundingClientRect().top+window.scrollY-hH-pH-12,behavior:'smooth'});
    },300);
  }
  $('pastToggleBtn')?.addEventListener('click',()=>{hidePastDays=!hidePastDays;try{localStorage.setItem('japan-hidePast',hidePastDays?'1':'0');}catch{}renderItinerary();buildDestPills();});

  // Wire up notes editors
  setupEditors();
}

function renderDay(d){
  const cls=getDayClass(d.id), isToday=cls==='today';
  const noteText=notes[d.id]||'';
  const isEdit=!!currentUser;

  const dateId=dayIdToDate(d.id), fsDay=firestoreDays[dateId];
  const tip=fsDay?.tip||d.tip||'';
  let bodyContent='';

  // Expand all button
  bodyContent+='<div class="expand-all-wrap"><button class="expand-all-btn" onclick="toggleExpandAll(\''+d.id+'\')">Expand all</button></div>';

  if(fsDay&&fsDay.activities&&fsDay.activities.length>0){
    const acts=sortActivitiesByTime([...fsDay.activities]);
    bodyContent+=acts.map(act=>{
      if(act.type==='period-label')return '<div class="period"><div class="period-label">'+esc(act.title)+'</div></div>';
      return renderFsItem(d.id,act,isEdit);
    }).join('');
  } else {
    bodyContent+=d.periods.map(p=>'<div class="period"><div class="period-label">'+p.label+'</div>'+p.items.map(item=>renderStaticItem(item,d.id,isEdit)).join('')+'</div>').join('');
  }

  if(isEdit)bodyContent+='<div class="add-act-wrap"><button class="add-act-btn" onclick="openAddAct(\''+d.id+'\')">+ Add activity</button></div>';

  // Tip and notes go outside the timeline
  let afterTimeline='';
  if(tip)afterTimeline+='<div class="day-tip"><div class="day-tip-label">Tip</div><div class="day-tip-text">'+esc(tip)+'</div></div>';

  if(isEdit){
    afterTimeline+='<div class="notes-section">'
      +'<div class="notes-hd"><span class="notes-label">Notes</span><span class="notes-save-ind" id="save-'+d.id+'"></span></div>'
      +'<textarea class="notes-edit" data-day="'+d.id+'" placeholder="Add notes for this day..."></textarea></div>';
  }else if(noteText){
    afterTimeline+='<div class="notes-section">'
      +'<div class="notes-hd"><span class="notes-label">Notes</span></div>'
      +'<div class="notes-read-only">'+noteText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>')+'</div></div>';
  }

  const title=fsDay?.title||d.title, location=fsDay?.location||d.location;
  const actCount=(fsDay?.activities||d.periods?.reduce((s,p)=>s+p.items.length,0)||0);
  const actLabel=typeof actCount==='number'?actCount+' item'+(actCount!==1?'s':''):'';

  return '<div class="day-card '+cls+'" id="card-'+d.id+'">'
    +'<div class="day-header">'
    +'<div class="day-header-left"><span class="day-date">'+d.date+'</span>'
    +'<div class="day-title-wrap"><div class="day-title">'+esc(title)+(isToday?'<span class="today-badge">TODAY</span>':'')+'</div>'
    +'<div class="day-location">'+esc(location)+'</div></div></div>'
    +'<div class="day-header-right"><span class="day-count">'+actLabel+'</span><span class="day-toggle">&#9660;</span></div>'
    +'</div>'
    +'<div class="day-body"><div class="day-body-inner"><div class="timeline">'+bodyContent
    +'</div>'+afterTimeline+'</div></div></div>';
}

// Toggle expand state of an activity row in-place (no full re-render)
window.toggleActExpand=function(itemId, event){
  // Don't toggle if clicking a link, button, or input inside the detail panel
  if(event&&(event.target.closest('a')||event.target.closest('button')||event.target.closest('input')))return;
  const el=document.querySelector('[data-item-id="'+itemId+'"]'); if(!el)return;
  if(expandedItems.has(itemId)){expandedItems.delete(itemId);el.classList.remove('expanded');}
  else{expandedItems.add(itemId);el.classList.add('expanded');}
};

// Expand all / collapse all activities in a day
window.toggleExpandAll=function(dayId){
  const card=document.getElementById('card-'+dayId); if(!card)return;
  // Only target rows that actually have expandable detail (clickable class)
  const acts=card.querySelectorAll('.act.clickable[data-item-id]');
  const allExpanded=[...acts].every(a=>a.classList.contains('expanded'));
  acts.forEach(a=>{
    const id=a.dataset.itemId;
    if(allExpanded){expandedItems.delete(id);a.classList.remove('expanded');}
    else{expandedItems.add(id);a.classList.add('expanded');}
  });
  const btn=card.querySelector('.expand-all-btn');
  if(btn)btn.textContent=allExpanded?'Expand all':'Collapse all';
};

function renderFsItem(dayId,act,isEdit){
  const isSub=act.sub===true, isBooked=act.booked===true;
  const tag=isBooked&&!isSub?'<span class="tag-booked">BOOKED</span>':'';
  const time=act.time&&!isSub?'<div class="act-time">'+fmt12h(act.time)+'</div>':'<div class="act-time"></div>';

  if(isSub)return '<div class="act sub-item"><div class="act-time"></div><div class="act-body"><div class="act-sub">'+esc(act.title)+'</div></div></div>';

  const hasDetails=!!(act.notes||act.cost>0||act.dur||act.addr);
  const isExp=expandedItems.has(act.id);
  const dragAttr=isEdit?' draggable="true" data-act-id="'+ea(act.id)+'" data-day-id="'+ea(dayId)+'"':'';

  let detailHtml='';
  if(hasDetails){
    const metaParts=[];
    if(act.cost>0)metaParts.push('<span class="act-detail-cost">\u00a5'+Math.round(act.cost).toLocaleString()+'</span>');
    if(act.dur)metaParts.push('<span class="act-detail-dur">'+esc(act.dur)+'</span>');
    const meta=metaParts.length?'<div class="act-detail-meta">'+metaParts.join('')+'</div>':'';
    const notesLines=(act.notes||'').split('\n').filter(Boolean);
    const notesHtml=notesLines.map(l=>'<div class="act-detail-notes">'+esc(l)+'</div>').join('');
    const mapLink=act.addr?'<a class="act-detail-map" href="https://maps.google.com/?q='+encodeURIComponent(act.addr)+'" target="_blank" rel="noopener">View on map \u2197</a>':'';
    detailHtml='<div class="act-detail"><div class="act-detail-inner"><div class="act-detail-body">'+meta+notesHtml+mapLink+'</div></div></div>';
  }

  const clickable=hasDetails;
  const clickAttr=clickable?' onclick="toggleActExpand(\''+ea(act.id)+'\',event)"':'';
  const editBtn=isEdit?'<button class="act-edit-inline" onclick="event.stopPropagation();openEditAct(\''+ea(dayId)+'\',\''+ea(act.id)+'\')">Edit</button>':'';

  const cat=act.category||'activity';
  // Inline meta visible even when collapsed
  const inlineParts=[];
  if(act.dur)inlineParts.push('<span class="act-inline-dur">'+esc(act.dur)+'</span>');
  if(act.cost>0)inlineParts.push('<span class="act-inline-cost">\u00a5'+Math.round(act.cost).toLocaleString()+'</span>');
  const inlineMeta=inlineParts.length?'<div class="act-inline-meta">'+inlineParts.join('')+'</div>':'';

  return '<div class="act'+(isExp?' expanded':'')+(isBooked?' booked':'')+(clickable?' clickable':'')+'" data-cat="'+ea(cat)+'" data-item-id="'+ea(act.id)+'"'+dragAttr+clickAttr+'>'
    +'<div class="act-dot"></div>'
    +time
    +'<div class="act-body">'
    +'<div class="act-main"><div class="act-text">'+esc(act.title)+tag+'</div>'
    +(hasDetails?'<span class="act-chevron">\u25B8</span>':'')
    +editBtn
    +'</div>'
    +inlineMeta
    +detailHtml
    +'</div></div>';
}

function renderStaticItem(item,dayId,isEdit){
  const isSub=item.sub===true;
  const tag=item.type==='booked'&&!isSub?'<span class="tag-booked">BOOKED</span>':'';
  const time=item.time&&!isSub?'<div class="act-time">'+item.time+'</div>':'<div class="act-time"></div>';

  if(isSub)return '<div class="act sub-item"><div class="act-time"></div><div class="act-body"><div class="act-sub">'+esc(item.text||'')+'</div></div></div>';

  const conf=item.type==='booked'?findConfForItem(item.text):null;
  const hasDetails=!!(item.notes||item.cost>0||item.dur||item.addr||conf);
  const itemId=dayId+'-s-'+(item.time||'x').replace(/[:\s]/g,'')+'-'+(item.text||'').replace(/\s/g,'').slice(0,8);
  const isExp=expandedItems.has(itemId);

  let detailHtml='';
  if(hasDetails){
    const metaParts=[];
    if(item.cost>0)metaParts.push('<span class="act-detail-cost">\u00a5'+Math.round(item.cost).toLocaleString()+'</span>');
    if(item.dur)metaParts.push('<span class="act-detail-dur">'+esc(item.dur)+'</span>');
    const meta=metaParts.length?'<div class="act-detail-meta">'+metaParts.join('')+'</div>':'';
    const notesLines=((item.notes||'')+(conf?'\n'+conf:'')).split('\n').filter(Boolean);
    const notesHtml=notesLines.map(l=>'<div class="act-detail-notes">'+esc(l)+'</div>').join('');
    const mapLink=item.addr?'<a class="act-detail-map" href="https://maps.google.com/?q='+encodeURIComponent(item.addr)+'" target="_blank" rel="noopener">View on map \u2197</a>':'';
    detailHtml='<div class="act-detail"><div class="act-detail-inner"><div class="act-detail-body">'+meta+notesHtml+mapLink+'</div></div></div>';
  }

  const clickAttr=hasDetails?' onclick="toggleActExpand(\''+itemId+'\',event)"':'';

  const icat=item.category||detectCategory(item.text||'',item.type,item.notes||'');
  // Inline meta visible even when collapsed
  const siParts=[];
  if(item.dur)siParts.push('<span class="act-inline-dur">'+esc(item.dur)+'</span>');
  if(item.cost>0)siParts.push('<span class="act-inline-cost">\u00a5'+Math.round(item.cost).toLocaleString()+'</span>');
  const siMeta=siParts.length?'<div class="act-inline-meta">'+siParts.join('')+'</div>':'';

  return '<div class="act'+(isExp?' expanded':'')+(item.type==='booked'?' booked':'')+(hasDetails?' clickable':'')+'" data-cat="'+icat+'" data-item-id="'+itemId+'"'+clickAttr+'>'
    +'<div class="act-dot"></div>'
    +time
    +'<div class="act-body">'
    +'<div class="act-main"><div class="act-text">'+esc(item.text||'')+tag+'</div>'+(hasDetails?'<span class="act-chevron">\u25B8</span>':'')+'</div>'
    +siMeta
    +detailHtml
    +'</div></div>';
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
  if(t.includes('hikari 637'))return 'Res: 2002 \u00b7 Car 11, 10-D & 10-E \u00b7 Smart EX: 9007241665';
  if(t.includes('granvia')&&t.includes('check'))return 'Conf: #23151SF060529 \u00b7 +81-75-344-8888';
  if(t.includes('intergate')&&t.includes('check'))return 'Conf: 20260125110822242 \u00b7 Expedia: 73356721260247';
  if(t.includes('quintessa')&&t.includes('check'))return 'Conf: 6519361226 \u00b7 PIN: 9235 \u00b7 +81 3-6264-1351';
  if(t.includes('takkyubin'))return 'Send from Gracery front desk \u00b7 ~\u00a51,500\u20132,000/bag \u00b7 arrives Apr 21';
  if(t.includes('teamlab'))return 'Conf: A7YRA4LXWCN3-0001 \u00b7 Entry 08:30\u201309:00';
  return null;
}

function getDayActivities(dayId){
  const dateId=dayIdToDate(dayId);
  return firestoreDays[dateId]?sortActivitiesByTime([...(firestoreDays[dateId].activities||[])]):null;
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
  const dayBody=card.querySelector('.day-body-inner'); if(!dayBody)return;
  if(dayBody._sortable){dayBody._sortable.destroy();dayBody._sortable=null;}
  dayBody._sortable=Sortable.create(dayBody,{
    animation:150,
    draggable:'.act[draggable="true"]',
    ghostClass:'act-sortable-ghost',
    onEnd:async evt=>{
      if(evt.oldIndex===evt.newIndex)return;
      const dateId=dayIdToDate(dayId), dd=firestoreDays[dateId]; if(!dd)return;
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
  if($('actTime'))    $('actTime').value=fmt24h(act.time||'');
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
  try{await db.collection('settings').doc('bookedCosts').set({items:bookedCosts});}catch{}
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
      +'<div><div style="font-size:13px;font-weight:500;color:var(--text)">Data tools</div>'
      +'<div style="font-size:12px;color:var(--light)">Export, import, or re-seed itinerary from source</div></div>'
      +'<div style="display:flex;gap:6px"><button class="booked-edit-btn" onclick="exportTripData()" style="white-space:nowrap">Export JSON</button>'
      +'<button class="booked-edit-btn" onclick="importTripData()" style="white-space:nowrap">Import JSON</button>'
      +'<button class="booked-edit-btn" onclick="confirmReseed()" style="white-space:nowrap;color:var(--red)">Re-seed days</button></div></div>':'');

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

window.addCheckItem=async function(secId){
  const inp=$('clAdd-'+secId); if(!inp||!inp.value.trim())return;
  const sec=CHECKLIST.find(s=>s.id===secId); if(!sec)return;
  const newId='c-'+Date.now();
  sec.items.push({id:newId,label:inp.value.trim(),sub:'',custom:true});
  inp.value='';
  renderPlan();
  showToast('Task added','ok');
  await saveChecklistStructure();
};
window.deleteCheckItem=async function(secId,itemId){
  const sec=CHECKLIST.find(s=>s.id===secId); if(!sec)return;
  sec.items=sec.items.filter(i=>i.id!==itemId);
  delete checks[itemId];
  renderPlan();
  showToast('Task removed');
  await saveChecklistStructure();
  if(currentUser){try{await db.collection('checks').doc('all').set(checks);}catch{}}
};

async function saveChecklistStructure(){
  // Persist only custom-added items to Firestore so they survive refresh
  const customItems={};
  CHECKLIST.forEach(sec=>{
    const custom=sec.items.filter(i=>i.custom);
    if(custom.length>0)customItems[sec.id]=custom;
  });
  if(currentUser){
    try{await db.collection('settings').doc('checklist').set({customItems});}catch{}
  }
  try{localStorage.setItem('japan-checklist-custom',JSON.stringify(customItems));}catch{}
}
async function loadChecklistCustomItems(){
  let customItems=null;
  if(currentUser){
    try{const s=await db.collection('settings').doc('checklist').get(); if(s.exists)customItems=s.data().customItems||null;}catch{}
  }
  if(!customItems){try{customItems=JSON.parse(localStorage.getItem('japan-checklist-custom')||'null');}catch{}}
  if(customItems){
    Object.entries(customItems).forEach(([secId,items])=>{
      const sec=CHECKLIST.find(s=>s.id===secId); if(!sec)return;
      items.forEach(item=>{
        if(!sec.items.find(i=>i.id===item.id)){sec.items.push({...item,custom:true});}
      });
    });
  }
}

window.togglePack=function(id,val){
  const pc=JSON.parse(localStorage.getItem('japan-packing')||'{}');
  if(val)pc[id]=true; else delete pc[id];
  localStorage.setItem('japan-packing',JSON.stringify(pc));
  renderPlan();
};
window.addPackItem=async function(){
  const inp=$('packAddInput'), sel=$('packCatSel');
  if(!inp||!sel||!inp.value.trim())return;
  const catName=sel.value.trim();
  const group=PACKING.find(g=>g.cat.startsWith(catName));
  if(group){group.items.push(inp.value.trim()); inp.value=''; renderPlan(); showToast('Added to packing list','ok'); await savePackingStructure();}
};
window.deletePackItem=async function(gi,ii){
  if(PACKING[gi]&&PACKING[gi].items[ii]!==undefined){
    PACKING[gi].items.splice(ii,1);
    // Clean up packing checks for shifted indices
    const pc=JSON.parse(localStorage.getItem('japan-packing')||'{}');
    const newPc={};
    PACKING.forEach((group,gIdx)=>{group.items.forEach((_,iIdx)=>{
      const oldKey='pk-'+gIdx+'-'+iIdx;
      if(gIdx===gi&&iIdx>=ii){
        // Shift keys down after deletion
        const nextKey='pk-'+gIdx+'-'+(iIdx+1);
        if(pc[nextKey])newPc[oldKey]=true;
      }else{
        if(pc[oldKey])newPc[oldKey]=true;
      }
    });});
    localStorage.setItem('japan-packing',JSON.stringify(newPc));
    renderPlan();
    showToast('Removed from packing list');
    await savePackingStructure();
  }
};

async function savePackingStructure(){
  const data=PACKING.map(g=>({cat:g.cat,items:[...g.items]}));
  if(currentUser){try{await db.collection('settings').doc('packing').set({lists:data});}catch{}}
  try{localStorage.setItem('japan-packing-custom',JSON.stringify(data));}catch{}
}
async function loadPackingCustomItems(){
  let saved=null;
  if(currentUser){
    try{const s=await db.collection('settings').doc('packing').get(); if(s.exists)saved=s.data().lists||null;}catch{}
  }
  if(!saved){try{saved=JSON.parse(localStorage.getItem('japan-packing-custom')||'null');}catch{}}
  if(saved&&Array.isArray(saved)){
    // Merge: for each saved category, if it matches a PACKING category, replace items
    saved.forEach(sg=>{
      const match=PACKING.find(g=>g.cat===sg.cat);
      if(match){match.items=sg.items||[];}
    });
  }
}

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

  // ── Compute settlement breakdown ──
  // Track what each person paid and what each person's fair share is
  let gwenBookedPaid=0, christinaBookedPaid=0;
  let gwenExpPaid=0, christinaExpPaid=0;
  let gwenOwesTotal=0, christinaOwesTotal=0; // what each person's fair share is

  bookedCosts.forEach(c=>{
    if(!c.jpy)return;
    const fw=c.forWhom||'shared';
    // Track who paid
    if(c.paidBy==='gwen') gwenBookedPaid+=c.jpy;
    else if(c.paidBy==='christina') christinaBookedPaid+=c.jpy;
    else if(c.paidBy==='split'){gwenBookedPaid+=c.jpy/2; christinaBookedPaid+=c.jpy/2;}
    // Track who owes (fair share)
    if(fw==='gwen'){gwenOwesTotal+=c.jpy;}
    else if(fw==='christina'){christinaOwesTotal+=c.jpy;}
    else{gwenOwesTotal+=c.jpy/2; christinaOwesTotal+=c.jpy/2;} // shared
  });
  expenses.forEach(e=>{
    const a=e.amount||0;
    const fw=e.forWhom||(e.paidBy==='split'?'shared':'shared'); // legacy compat
    // Track who paid
    if(e.paidBy==='gwen') gwenExpPaid+=a;
    else if(e.paidBy==='christina') christinaExpPaid+=a;
    else if(e.paidBy==='split'){gwenExpPaid+=a/2; christinaExpPaid+=a/2;} // legacy
    // Track who owes (fair share)
    if(fw==='gwen'){gwenOwesTotal+=a;}
    else if(fw==='christina'){christinaOwesTotal+=a;}
    else{gwenOwesTotal+=a/2; christinaOwesTotal+=a/2;}
  });
  const gwenPaid=gwenBookedPaid+gwenExpPaid;
  const christinaPaid=christinaBookedPaid+christinaExpPaid;
  const bookedTotal=bookedCosts.reduce((s,c)=>s+(c.jpy||0),0);
  const expTotal=expenses.reduce((s,e)=>s+(e.amount||0),0);
  const grandTotal=bookedTotal+expTotal;
  // Settlement: positive = Gwen overpaid relative to her share, Christina owes her
  const settlement=gwenPaid-gwenOwesTotal;
  const christinaOwes=settlement>0?settlement:0;
  const gwenOwes=settlement<0?Math.abs(settlement):0;

  const isUSD=budgetCur==='USD';
  const displayed=expFilter==='all'?expenses:expenses.filter(e=>e.category===expFilter);

  // ── Expense list by day ──
  const byDay={};
  displayed.forEach(e=>{const d=e.date||'unknown';if(!byDay[d])byDay[d]=[];byDay[d].push(e);});
  const sortedDays=Object.keys(byDay).sort((a,b)=>b.localeCompare(a));
  const expRowsHtml=displayed.length===0
    ?(expenses.length===0
      ?'<div class="exp-empty"><div class="exp-empty-text">No expenses logged yet.</div><button class="exp-empty-cta" onclick="openExpenseModal()">+ Log your first expense</button></div>'
      :'<div class="exp-empty"><div class="exp-empty-text">No expenses in this category.</div></div>'
    )
    :sortedDays.map(day=>{
      const dayTotal=byDay[day].reduce((s,e)=>s+(e.amount||0),0);
      let dayLabel=day;
      try{const dd=new Date(day+'T12:00:00');dayLabel=dd.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});}catch{}
      return '<div class="exp-day-group">'
        +'<div class="exp-day-hd"><span>'+dayLabel+'</span><span class="exp-day-total">'+fmt(dayTotal)+'</span></div>'
        +byDay[day].map(e=>'<div class="expense-item">'
          +'<div class="exp-cat-stripe" style="background:'+(CAT_COLORS[e.category]||'#ccc')+'"></div>'
          +'<div class="exp-body"><div class="exp-top"><span class="exp-desc">'+esc(e.description||e.category||'')+'</span><span class="exp-amount">'+fmt(e.amount||0)+'</span></div>'
          +'<div class="exp-meta"><span>'+(e.paidBy==='gwen'?'Gwen paid':e.paidBy==='christina'?'Christina paid':'Split 50/50')+(e.forWhom&&e.forWhom!=='shared'?' \u00b7 for '+(e.forWhom==='gwen'?'Gwen':'Christina')+' only':'')+'</span><span class="exp-tag">'+esc(e.category||'')+'</span></div></div>'
          +'<button class="exp-edit" data-id="'+ea(e.id||'')+'" title="Edit">\u270e</button>'
          +'<button class="exp-delete" data-id="'+ea(e.id||'')+'" title="Delete">&times;</button></div>'
        ).join('')+'</div>';
    }).join('');

  // ── Category totals for on-trip expenses ──
  const catTotals={};
  expenses.forEach(e=>{const c=e.category||'other';catTotals[c]=(catTotals[c]||0)+(e.amount||0);});

  // ── Booked costs grouped by category ──
  const bookedByCategory={};
  bookedCosts.forEach(c=>{const cat=c.category||'Other';if(!bookedByCategory[cat])bookedByCategory[cat]=[];bookedByCategory[cat].push(c);});
  const bookedCatOrder=['Flights','Hotels','Transport','Activities','Other'];

  // ── Settlement ledger lines ──
  const ledgerLines=[];
  if(gwenBookedPaid>0)  ledgerLines.push({who:'Gwendalynn', type:'Pre-booked', amount:gwenBookedPaid});
  if(christinaBookedPaid>0) ledgerLines.push({who:'Christina', type:'Pre-booked', amount:christinaBookedPaid});
  if(gwenExpPaid>0)     ledgerLines.push({who:'Gwendalynn', type:'On-trip expenses', amount:gwenExpPaid});
  if(christinaExpPaid>0) ledgerLines.push({who:'Christina', type:'On-trip expenses', amount:christinaExpPaid});
  const gwenFairShare=gwenOwesTotal;
  const christinaFairShare=christinaOwesTotal;

  // ── BUILD HTML ──
  let html='';

  // Header
  html+='<div class="budget-header">'
    +'<div><div class="budget-title">Trip Budget</div></div>'
    +'<div class="budget-header-right">'
    +'<button class="budget-cw-btn" id="budgetCwBtn" title="Currency converter">\u00a5 \u21c4 $</button>'
    +'<div class="cur-toggle"><button class="cur-btn'+(budgetCur==='JPY'?' active':'')+'" data-cur="JPY">\u00a5 JPY</button><button class="cur-btn'+(budgetCur==='USD'?' active':'')+'" data-cur="USD">$ USD</button></div>'
    +'</div></div>';

  // ── Section 1: Overview totals ──
  html+='<div class="b-top-row">'
    +'<div class="b-total-card"><div class="b-total-label">Total trip cost</div><div class="b-total-val">'+fmt(grandTotal)+'</div>'
    +'<div class="b-total-sub">'+(isUSD?'\u00a5'+Math.round(grandTotal).toLocaleString()+' JPY':'~$'+Math.round(grandTotal/exchRate).toLocaleString()+' USD')+'</div>'
    +'<div class="b-total-breakdown"><span>Pre-booked '+fmt(bookedTotal)+'</span><span>On-trip '+fmt(expTotal)+'</span></div></div>'
    +'<div class="b-share-card"><div class="b-share-label">Gwen\'s fair share</div><div class="b-share-val">'+fmt(gwenFairShare)+'</div><div class="b-share-sub">'+(gwenFairShare===christinaFairShare?'50/50 split':'includes personal items')+'</div></div>'
    +'<div class="b-share-card"><div class="b-share-label">Christina\'s fair share</div><div class="b-share-val">'+fmt(christinaFairShare)+'</div><div class="b-share-sub">'+(gwenFairShare===christinaFairShare?'50/50 split':'includes personal items')+'</div></div>'
    +'</div>';

  // ── Section 2: Settlement ──
  html+='<div class="settle-wrap">'
    +'<div class="settle-hd"><span class="settle-title">Settlement</span></div>'
    +'<div class="settle-body">';

  // Settlement result banner
  if(Math.round(settlement)===0){
    html+='<div class="settle-result settle-even">All settled up -- no one owes anything.</div>';
  }else if(christinaOwes>0){
    html+='<div class="settle-result settle-owes">'
      +'<div class="settle-arrow"><div class="b-avatar b-avatar-c" style="width:24px;height:24px;font-size:11px">C</div>'
      +'<span class="settle-arrow-line"></span>'
      +'<span class="settle-arrow-amt">'+fmt(christinaOwes)+'</span>'
      +'<span class="settle-arrow-line"></span>'
      +'<div class="b-avatar b-avatar-g" style="width:24px;height:24px;font-size:11px">G</div></div>'
      +'<div class="settle-result-text">Christina owes Gwendalynn <strong>'+fmt(christinaOwes)+'</strong></div></div>';
  }else{
    html+='<div class="settle-result settle-owes">'
      +'<div class="settle-arrow"><div class="b-avatar b-avatar-g" style="width:24px;height:24px;font-size:11px">G</div>'
      +'<span class="settle-arrow-line"></span>'
      +'<span class="settle-arrow-amt">'+fmt(gwenOwes)+'</span>'
      +'<span class="settle-arrow-line"></span>'
      +'<div class="b-avatar b-avatar-c" style="width:24px;height:24px;font-size:11px">C</div></div>'
      +'<div class="settle-result-text">Gwendalynn owes Christina <strong>'+fmt(gwenOwes)+'</strong></div></div>';
  }

  // Detailed ledger
  html+='<div class="settle-ledger">'
    +'<div class="settle-ledger-hd"><span>Who paid</span><span>Category</span><span>Amount</span></div>';
  ledgerLines.forEach(l=>{
    const isG=l.who==='Gwendalynn';
    html+='<div class="settle-ledger-row">'
      +'<span class="settle-who"><span class="b-avatar '+(isG?'b-avatar-g':'b-avatar-c')+'" style="width:20px;height:20px;font-size:10px">'+(isG?'G':'C')+'</span>'+esc(l.who)+'</span>'
      +'<span class="settle-type">'+esc(l.type)+'</span>'
      +'<span class="settle-amt">'+fmt(l.amount)+'</span></div>';
  });
  html+='<div class="settle-ledger-row settle-ledger-total">'
    +'<span class="settle-who">Total paid</span><span></span><span class="settle-amt">'+fmt(gwenPaid+christinaPaid)+'</span></div>';
  html+='<div class="settle-ledger-row"><span class="settle-who"><span class="b-avatar b-avatar-g" style="width:20px;height:20px;font-size:10px">G</span>Gwen\'s fair share</span><span></span><span class="settle-amt">'+fmt(gwenFairShare)+'</span></div>';
  html+='<div class="settle-ledger-row"><span class="settle-who"><span class="b-avatar b-avatar-c" style="width:20px;height:20px;font-size:10px">C</span>Christina\'s fair share</span><span></span><span class="settle-amt">'+fmt(christinaFairShare)+'</span></div>';
  html+='</div>'; // end ledger
  html+='</div></div>'; // end settle-body, settle-wrap

  // ── Build pre-booked section HTML ──
  let prebookedHtml='<div class="b-table-wrap"><div class="b-table-hd"><span class="b-table-title">Pre-booked costs</span>'
    +'<span class="b-table-total">'+fmt(bookedTotal)+'</span></div>';
  prebookedHtml+='<div class="bc-list">';
  bookedCatOrder.forEach(cat=>{
    const items=bookedByCategory[cat]; if(!items||items.length===0)return;
    const catTotal=items.reduce((s,c)=>s+(c.jpy||0),0);
    const catClass='b-cat-'+(cat||'Other').toLowerCase().replace(' ','');
    prebookedHtml+='<div class="bc-cat-group">'
      +'<div class="bc-cat-hd"><span class="b-cat-chip '+catClass+'">'+esc(cat)+'</span><span class="bc-cat-total">'+fmt(catTotal)+'</span></div>';
    items.forEach(c=>{
      prebookedHtml+='<div class="bc-item" data-bcid="'+ea(c.id)+'">'
        +'<div class="bc-item-main">'
        +'<div class="bc-item-label">'+esc(c.label)+(c.dates?'<span class="bc-item-dates">'+esc(c.dates)+'</span>':'')+'</div>'
        +'<div class="bc-item-right"><span class="bc-item-amt">'+fmt(c.jpy||0)+'</span></div></div>'
        +'<div class="bc-item-meta"><span>'+(c.paidBy==='gwen'?'Gwen paid':c.paidBy==='christina'?'Christina paid':'Split')+(c.forWhom&&c.forWhom!=='shared'?' \u00b7 for '+(c.forWhom==='gwen'?'Gwen':'Christina')+' only':'')+'</span>'
        +(c.purchased?'<span>Purchased '+esc(c.purchased)+'</span>':'')+'</div></div>';
    });
    prebookedHtml+='</div>';
  });
  prebookedHtml+='</div>';
  prebookedHtml+='<div class="bc-actions">'
    +'<button class="booked-edit-btn" id="bcAddBtn">+ Add pre-booked item</button>'
    +'</div></div>';

  // ── Build on-trip expenses section HTML ──
  let expensesHtml='<div class="exp-section">'
    +'<div class="exp-list-hd"><span class="exp-list-title">On-trip expenses</span>'
    +'<button class="budget-add-btn" id="budgetAddBtn">+ Add expense</button></div>';
  expensesHtml+='<div class="exp-filter-row">'
    +'<button class="exp-filter-btn'+(expFilter==='all'?' active':'')+'" data-filter="all">All'+(expTotal>0?' <span class="efb-total">'+fmt(expTotal)+'</span>':'')+'</button>';
  Object.keys(CAT_COLORS).forEach(cat=>{
    const ct=catTotals[cat]||0;
    expensesHtml+='<button class="exp-filter-btn'+(expFilter===cat?' active':'')+'" data-filter="'+cat+'">'+cat.charAt(0).toUpperCase()+cat.slice(1)+(ct>0?' <span class="efb-total">'+fmt(ct)+'</span>':'')+'</button>';
  });
  expensesHtml+='</div>';
  expensesHtml+=expRowsHtml;
  expensesHtml+='</div>';

  // During the trip, show expenses first (most used). Before/after, show pre-booked first.
  const now=new Date();
  const duringTrip=now>=TRIP_START&&now<=TRIP_END;
  if(duringTrip){
    html+=expensesHtml+prebookedHtml;
  }else{
    html+=prebookedHtml+expensesHtml;
  }
  html+='<div style="height:40px"></div>';

  el.innerHTML=html;

  // ── Event listeners ──
  el.querySelectorAll('.cur-btn').forEach(btn=>btn.addEventListener('click',()=>{budgetCur=btn.dataset.cur;renderBudget();}));
  $('budgetCwBtn')?.addEventListener('click',()=>{openModal('currencyModal');setTimeout(()=>$('jpyIn')?.focus(),80);});
  $('budgetAddBtn')?.addEventListener('click',openExpenseModal);
  $('bcAddBtn')?.addEventListener('click',()=>openBookedModal());
  el.querySelectorAll('.bc-item').forEach(item=>{
    item.addEventListener('click',()=>{
      const id=item.dataset.bcid;
      const c=bookedCosts.find(x=>x.id===id);
      if(c)openBookedModal(c);
    });
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

// ── Pre-booked cost modal ─────────────────────────────────
let editBookedId=null;
function openBookedModal(item){
  editBookedId=item?item.id:null;
  const isEdit=!!item;
  if($('bcModalTitle'))$('bcModalTitle').textContent=isEdit?'Edit pre-booked item':'Add pre-booked item';
  if($('bcLabel'))$('bcLabel').value=item?item.label:'';
  if($('bcAmount'))$('bcAmount').value=item?(item.jpy||''):'';
  if($('bcCategory')){$('bcCategory').value=item?item.category:'Hotels';}
  if($('bcPaidBy'))$('bcPaidBy').value=item?(item.paidBy||'gwen'):'gwen';
  if($('bcForWhom'))$('bcForWhom').value=item?(item.forWhom||'shared'):'shared';
  if($('bcDates'))$('bcDates').value=item?(item.dates||''):'';
  if($('bcPurchased'))$('bcPurchased').value=item?(item.purchased||''):'';
  const delBtn=$('bcDeleteBtn');
  if(delBtn)delBtn.style.display=isEdit?'':'none';
  const saveBtn=$('bcSaveBtn2');
  if(saveBtn)saveBtn.textContent=isEdit?'Save changes':'Add item';
  $('bcErr')?.classList.add('hidden');
  openModal('bookedModal');
  setTimeout(()=>$('bcLabel')?.focus(),80);
}
window.openBookedModal=openBookedModal;

async function saveBookedItem(){
  const label=$('bcLabel')?.value.trim();
  if(!label){if($('bcErr')){$('bcErr').textContent='Enter a name.';$('bcErr').classList.remove('hidden');}return;}
  const jpy=parseInt($('bcAmount')?.value||'0',10);
  const data={
    label,
    jpy, usd:Math.round(jpy/exchRate),
    category:$('bcCategory')?.value||'Other',
    paidBy:$('bcPaidBy')?.value||'gwen',
    forWhom:$('bcForWhom')?.value||'shared',
    dates:$('bcDates')?.value.trim()||'',
    purchased:$('bcPurchased')?.value.trim()||'',
  };
  if(editBookedId){
    const item=bookedCosts.find(c=>c.id===editBookedId);
    if(item)Object.assign(item,data);
  }else{
    data.id='bc-'+Date.now();
    bookedCosts.push(data);
  }
  try{await db.collection('settings').doc('bookedCosts').set({items:bookedCosts});}catch{}
  closeModal('bookedModal');
  showToast(editBookedId?'Updated':'Added','ok');
  renderBudget();
}
window.saveBookedItem=saveBookedItem;

async function deleteBookedFromModal(){
  if(!editBookedId)return;
  if(!confirm('Delete this pre-booked item?'))return;
  bookedCosts=bookedCosts.filter(c=>c.id!==editBookedId);
  try{await db.collection('settings').doc('bookedCosts').set({items:bookedCosts});}catch{}
  closeModal('bookedModal');
  showToast('Removed','ok');
  renderBudget();
}
window.deleteBookedFromModal=deleteBookedFromModal;

// ── Expense modal ─────────────────────────────────────────────
function openEditExpense(id){
  const exp=expenses.find(e=>e.id===id); if(!exp)return;
  editExpId=id;
  if($('expModalTitle'))$('expModalTitle').textContent='Edit expense';
  if($('expAmount'))$('expAmount').value=exp.amount||'';
  if($('expNote'))  $('expNote').value=exp.description||'';
  if($('expDate'))  $('expDate').value=exp.date||'';
  selectedCat=exp.category||'food';
  selectedPayer=exp.paidBy||'gwen';
  // Migrate legacy: old "split" paidBy → paidBy=gwen + forWhom=shared
  if(selectedPayer==='split'){selectedPayer='gwen';}
  selectedFor=exp.forWhom||'shared';
  document.querySelectorAll('#expCatChips .chip').forEach(c=>c.classList.toggle('active',c.dataset.cat===selectedCat));
  document.querySelectorAll('#expPayerChips .chip').forEach(c=>c.classList.toggle('active',c.dataset.payer===selectedPayer));
  document.querySelectorAll('#expForChips .chip').forEach(c=>c.classList.toggle('active',c.dataset.for===selectedFor));
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
  // Restore quick-date row visibility (may have been hidden by edit mode)
  if($('expQuickDates'))$('expQuickDates').style.display='';
  const now=getTodayJST();
  const inTrip=now>=TRIP_START&&now<=TRIP_END;
  const useDate=inTrip?now:TRIP_START;
  if($('expDate'))$('expDate').value=useDate.toISOString().split('T')[0];
  if($('expAmount'))$('expAmount').value='';
  if($('expNote'))$('expNote').value='';
  document.querySelectorAll('#expCatChips .chip').forEach(c=>c.classList.toggle('active',c.dataset.cat==='food'));
  document.querySelectorAll('#expPayerChips .chip').forEach(c=>c.classList.toggle('active',c.dataset.payer===selectedPayer));
  selectedCat='food';
  selectedFor='shared';
  document.querySelectorAll('#expForChips .chip').forEach(c=>c.classList.toggle('active',c.dataset.for==='shared'));
  $('expErr')?.classList.add('hidden');
  document.querySelectorAll('.qd-btn').forEach(b=>b.classList.toggle('active',b.dataset.offset==='0'));
  if($('expDate'))$('expDate').style.display='none';
  openModal('expenseModal');
  setTimeout(()=>$('expAmount')?.focus(),80);
}

$('expFab')?.addEventListener('click',openExpenseModal);

// Quick-add expense macros
document.getElementById('expCatChips')?.addEventListener('click',e=>{
  const btn=e.target.closest('.chip'); if(!btn)return;
  document.querySelectorAll('#expCatChips .chip').forEach(c=>c.classList.remove('active'));
  btn.classList.add('active'); selectedCat=btn.dataset.cat||'other';
});
document.getElementById('expPayerChips')?.addEventListener('click',e=>{
  const btn=e.target.closest('.chip'); if(!btn)return;
  document.querySelectorAll('#expPayerChips .chip').forEach(c=>c.classList.remove('active'));
  btn.classList.add('active'); selectedPayer=btn.dataset.payer||'gwen';
});
document.getElementById('expForChips')?.addEventListener('click',e=>{
  const btn=e.target.closest('.chip'); if(!btn)return;
  document.querySelectorAll('#expForChips .chip').forEach(c=>c.classList.remove('active'));
  btn.classList.add('active'); selectedFor=btn.dataset.for||'shared';
});
document.getElementById('expQuickDates')?.addEventListener('click',e=>{
  const btn=e.target.closest('.qd-btn'); if(!btn)return;
  document.querySelectorAll('.qd-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  if(btn.id==='expPickDate'){
    if($('expDate'))$('expDate').style.display='block';
    return;
  }
  // Today or Yesterday -- auto-set date and hide the date input
  if($('expDate'))$('expDate').style.display='none';
  const off=parseInt(btn.dataset.offset||'0',10);
  const base=new Date(getTodayJST()); base.setDate(base.getDate()+off);
  const s=TRIP_START, f=TRIP_END;
  const clamped=base<s?s:base>f?f:base;
  if($('expDate'))$('expDate').value=clamped.toISOString().split('T')[0];
});

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
      paidBy:selectedPayer,
      forWhom:selectedFor,
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
        p.items.forEach(item=>{
          let itemCost=item.cost||0;
          if(!itemCost){
            const m=(item.text||'').match(/[¥\u00a5]([\d,]+)/);
            if(m)itemCost=parseInt(m[1].replace(/,/g,''),10)||0;
          }
          activities.push({
            id:dayId+'-'+order,
            time:item.time||'',
            title:item.text||'',
            desc:'',
            category:item.category||detectCategory(item.text||'',item.type,item.notes||''),
            booked:item.type==='booked'||item.booked||false,
            conf:'',
            addr:item.addr||'',
            notes:item.notes||'',
            cost:itemCost,
            currency:'JPY',
            driveUrl:'',
            sub:item.sub||false,
            dur:item.dur||'',
            order:order++,
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

// Smart category detection from activity text and notes
function detectCategory(text, type, notes){
  const t=((text||'')+' '+(notes||'')).toLowerCase();
  // Transport (flights, trains, buses, boats, transfers)
  if(/\bua \d+\b|shinkansen|hikari|nozomi|kodama|fuji.excursion|thunderbird|hokuriku/.test(t))return 'transport';
  if(/\bjr .* line|tozan railway|ropeway|bus via|local train|sagano line|nara line/.test(t))return 'transport';
  if(/return to (?:shinjuku|gora|kyoto|hotel|osaka|tokyo)|depart hotel|arrive (?:haneda|kyoto|gora|osaka|station)/.test(t))return 'transport';
  if(/lake ashi .* boat|sightseeing boat|collect luggage/.test(t))return 'transport';
  // Hotel (check in/out, ryokan specifics)
  if(/check.?in\b|check.?out\b/.test(t))return 'hotel';
  if(/breakfast (?:at|buffet at) (?:ryokan|hotel|intergate|granvia|gracery|quintessa|tensui)/.test(t))return 'hotel';
  // Nature (parks, gardens, onsen, walks, natural scenery)
  if(/park(?!ing)|garden|bamboo|owakudani|onsen|yukata|rotenburo|walk trail|kenroku|philosopher|oishi park/.test(t))return 'nature';
  if(/nara .* deer|deer\b|hamarikyu/.test(t))return 'nature';
  // Sightseeing (temples, shrines, castles, landmarks, historic districts)
  if(/temple|shrine|senso-ji|fushimi inari|great buddha|hase-dera|todai-ji|tenryu-ji|engaku-ji/.test(t))return 'sightseeing';
  if(/kasuga|hachimangu|kiyomizu|pagoda|chureito/.test(t))return 'sightseeing';
  if(/shibuya scramble|togetsukyo|ninenzaka|sannenzaka|kanazawa castle|osaka castle/.test(t))return 'sightseeing';
  if(/samurai|higashi chaya|gion|hanamikoji|ginza .* stroll|ginza streets|ginza evening/.test(t))return 'sightseeing';
  if(/omotesando|takeshita|yanaka\b|nagamachi/.test(t))return 'sightseeing';
  if(/hakone shrine|meiji shrine/.test(t))return 'sightseeing';
  // Nightlife (bars, evening entertainment, atmospheric streets at night)
  if(/golden gai|kabukicho|omoide yokocho|bar\b|bars\b|pontocho|wander.*night/.test(t))return 'nightlife';
  // Food (meals, markets, food streets)
  if(/dinner|lunch|breakfast|ramen|kaiseki|tsukiji|nishiki market|omicho market|dotonbori|street stalls|seafood|kuromon/.test(t))return 'food';
  if(/omoide yokocho/.test(t))return 'food';
  // Shopping (shopping streets, arcades, specialty stores)
  if(/kappabashi|nakamise|teramachi|shinkyogoku|shopping/.test(t))return 'shopping';
  // Activity (museums, experiences, entertainment, unique activities)
  if(/museum|teamlab|akihabara|aquarium|kaiyukan|explore|azabudai/.test(t))return 'activity';
  if(/takkyubin|arrange/.test(t))return 'other';
  // Booked fallback
  if(type==='booked')return 'hotel';
  return 'activity';
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
    // Auto-set default payer to whoever is signed in
    selectedPayer=user.email==='cmelikian@gmail.com'?'christina':'gwen';
    await Promise.all([loadAllNotes(), loadChecksFromDB(), loadBookedCostsFromDB(), loadDriveSettings(), loadChecklistCustomItems(), loadPackingCustomItems()]);
    renderPlan();
    refreshNoteDisplays(); setupEditors();
    subscribeExpenses(); subscribeDays();
    refreshAllPanels();
  }else{
    document.body.classList.remove('edit-mode');
    if(btn){btn.classList.remove('signed-in');btn.textContent='Editor login';}
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
        try{
          await db.collection('notes').doc(dayId).set({text,updatedAt:new Date()});
          if(ind){ind.textContent='Saved';setTimeout(()=>{if(ind)ind.textContent='';},1800);}
        }catch{if(ind)ind.textContent='Could not save.';}
      },900);
    });
  });
}

// ── Re-seed ───────────────────────────────────────────────────
window.confirmReseed=async function(){
  if(!confirm('This will overwrite the seeded itinerary data with the latest source. Your custom activities, notes, and photos are unaffected. Continue?'))return;
  showToast('Re-seeding\u2026');
  await seedDays();
  showToast('Itinerary re-seeded','ok');
};

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
      // Custom items added by editors
      checklistCustomItems:(()=>{const ci={};CHECKLIST.forEach(sec=>{const custom=sec.items.filter(i=>i.custom);if(custom.length>0)ci[sec.id]=custom;});return ci;})(),
      packingLists:PACKING.map(g=>({cat:g.cat,items:[...g.items]})),
      packingState:JSON.parse(localStorage.getItem('japan-packing')||'{}'),
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
      if(data.checklistCustomItems){
        await db.collection('settings').doc('checklist').set({customItems:data.checklistCustomItems});
        try{localStorage.setItem('japan-checklist-custom',JSON.stringify(data.checklistCustomItems));}catch{}
      }
      if(data.packingLists){
        await db.collection('settings').doc('packing').set({lists:data.packingLists});
        try{localStorage.setItem('japan-packing-custom',JSON.stringify(data.packingLists));}catch{}
      }
      if(data.packingState){
        try{localStorage.setItem('japan-packing',JSON.stringify(data.packingState));}catch{}
      }
      if(data.expenses&&data.expenses.length>0){
        const batch=db.batch();
        data.expenses.forEach(exp=>{
          const ref=exp.id?db.collection('expenses').doc(exp.id):db.collection('expenses').doc();
          batch.set(ref,{...exp,createdAt:exp.createdAt||firebase.firestore.FieldValue.serverTimestamp()});
        });
        await batch.commit();
      }
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
  const ctx=cv.getContext('2d'); let P=[]; let blossomPaused=false;
  function rs(){cv.width=innerWidth;cv.height=innerHeight;}
  rs(); window.addEventListener('resize',rs);
  document.addEventListener('visibilitychange',()=>{blossomPaused=document.hidden; if(!blossomPaused)requestAnimationFrame(draw);});
  function mk(){return{x:Math.random()*cv.width,y:-40-Math.random()*80,r:2.5+Math.random()*2.5,rot:Math.random()*Math.PI*2,rv:(Math.random()-.5)*.013,vx:(Math.random()-.5)*.16,vy:.16+Math.random()*.24,sw:Math.random()*Math.PI*2,sws:.004+Math.random()*.005,a:.4+Math.random()*.35};}
  for(let i=0;i<14;i++){const p=mk();p.y=Math.random()*innerHeight;P.push(p);}
  function draw(){
    if(blossomPaused)return;
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
      ctx.closePath();
      const isDark=document.body.classList.contains('dark')||
        (!document.body.classList.contains('light')&&window.matchMedia?.('(prefers-color-scheme: dark)').matches);
      ctx.fillStyle=isDark?'rgba(200,160,170,0.55)':'#E8A0B0';
      ctx.fill(); ctx.restore();
    });
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();

// ── Init ──────────────────────────────────────────────────────
try{Object.assign(checks,JSON.parse(localStorage.getItem('japan-checks')||'{}'));}catch{}
loadLocalExpenses();
try{driveFolderUrl=localStorage.getItem('japan-drive-url')||'';}catch{}
// Load cached custom checklist/packing items from localStorage (Firestore load happens after auth)
try{
  const ci=JSON.parse(localStorage.getItem('japan-checklist-custom')||'null');
  if(ci){Object.entries(ci).forEach(([secId,items])=>{
    const sec=CHECKLIST.find(s=>s.id===secId); if(!sec)return;
    items.forEach(item=>{if(!sec.items.find(i=>i.id===item.id))sec.items.push({...item,custom:true});});
  });}
}catch{}
try{
  const pl=JSON.parse(localStorage.getItem('japan-packing-custom')||'null');
  if(pl&&Array.isArray(pl)){pl.forEach(sg=>{const match=PACKING.find(g=>g.cat===sg.cat);if(match)match.items=sg.items||[];});}
}catch{}

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
