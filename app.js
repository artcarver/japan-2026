/* ─────────────────────────────────────────
   JAPAN 2026 — App v4 (Merged)
   ───────────────────────────────────────── */

// ── Firebase ──────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBCIaluRd8u7M88DbL59Cs_6_sfcb86f0E",
  authDomain:        "japan-2026-gc.firebaseapp.com",
  projectId:         "japan-2026-gc",
  storageBucket:     "japan-2026-gc.firebasestorage.app",
  messagingSenderId: "661642949404",
  appId:             "1:661642949404:web:c6a554f3c243171d5a00d9"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db   = firebase.firestore();

// ── Constants ─────────────────────────────────────────────────
const ALLOWED_EMAILS = ['ghstilson@gmail.com', 'cmelikian@gmail.com'];
const TRIP_START     = new Date('2026-04-15T00:00:00');
const TRIP_END       = new Date('2026-04-29T23:59:59');

// ── State ─────────────────────────────────────────────────────
let currentUser = null;
let exchRate    = parseFloat(localStorage.getItem('japan-rate') || '149');
let rateIsLive  = false;
const notes     = {};
const checks    = {};
let packingData  = null;
let bookingsData = null; // loaded from Firestore, seeded from BUDGET_BOOKINGS

// ── Day dates ─────────────────────────────────────────────────
const DAY_DATES = {
  apr15: new Date('2026-04-15'), apr16: new Date('2026-04-16'),
  apr17: new Date('2026-04-17'), apr18: new Date('2026-04-18'),
  apr19: new Date('2026-04-19'), apr20: new Date('2026-04-20'),
  apr21: new Date('2026-04-21'), apr22: new Date('2026-04-22'),
  apr23: new Date('2026-04-23'), apr24: new Date('2026-04-24'),
  apr25: new Date('2026-04-25'), apr26: new Date('2026-04-26'),
  apr27: new Date('2026-04-27'), apr28: new Date('2026-04-28'),
  apr29: new Date('2026-04-29'),
};

// ── Itinerary data ────────────────────────────────────────────
const DAYS = {
  apr15: {
    id:'apr15', date:'WED APR 15', title:'Depart Los Angeles', location:'LAX \u2192 HND Tokyo',
    periods:[{ label:'Flight', items:[
      { time:'11:20 AM', text:'United UA 39 departs LAX', type:'booked' },
      { text:'Arrives HND Thursday April 16, 3:05 PM' },
      { text:'Boeing 787-10 Dreamliner \u00b7 Economy (K) \u00b7 Seats 31L (Gwen) & 31J (Christina)', sub:true },
      { text:'Confirmation: F354LH \u00b7 eTickets: 0162358617634 / 0162358617635', sub:true },
    ]}],
    tip:'Get to LAX by 8:30 AM. Check in online beforehand. Total flight cost: $2,196.86 \u00b7 $1,098/person including Economy Plus seats.'
  },
  apr16: {
    id:'apr16', date:'THU APR 16', title:'Arrival Day', location:'Tokyo \u00b7 Shinjuku',
    periods:[
      { label:'Afternoon', items:[
        { time:'3:05 PM',  text:'Arrive HND \u00b7 clear customs, collect bags' },
        { text:'Tokyo Monorail or Keikyu Line \u2192 Shinjuku (~60\u201375 min)', sub:true },
        { time:'~5:30 PM', text:'Check in Hotel Gracery Shinjuku', type:'booked' },
        { text:'From 14:00 \u00b7 Conf: 5594.831.309 \u00b7 PIN: 6506', sub:true },
      ]},
      { label:'Evening \u2014 take it easy', items:[
        { time:'7:00 PM', text:'Omoide Yokocho (Memory Lane) \u00b7 5 min walk from hotel' },
        { text:'Tiny smoky yakitori stalls, beer \u2014 ease into Japan', sub:true },
        { time:'9:00 PM', text:'Wander Kabukicho \u00b7 neon, arcades, vending machines' },
      ]},
    ],
    tip:'Jet lag will hit in waves. Keep tonight very light \u2014 you have four full days ahead.'
  },
  apr17: {
    id:'apr17', date:'FRI APR 17', title:'teamLab + Harajuku + Shibuya', location:'Tokyo \u00b7 Shinjuku',
    periods:[
      { label:'Morning \u2014 teamLab Borderless', items:[
        { time:'8:15 AM',  text:'Depart hotel \u00b7 Metro Hibiya Line \u2192 Kamiyacho (Exit 5)' },
        { time:'8:30 AM',  text:'teamLab Borderless \u00b7 Azabudai Hills', type:'booked' },
        { text:'\u00a55,600/person (~$35) \u00b7 Conf: A7YRA4LXWCN3-0001 \u00b7 ~3 hrs \u00b7 no re-entry', sub:true },
        { text:'Wear pants (mirrored floors) \u00b7 download teamLab app beforehand', sub:true },
        { text:'Hit Bubble Universe + Infinite Crystal World first \u00b7 EN Tea House is extra', sub:true },
        { time:'11:30 AM', text:'Exit teamLab \u00b7 explore Azabudai Hills complex' },
      ]},
      { label:'Afternoon \u2014 Harajuku', items:[
        { time:'12:30 PM', text:'Metro Hibiya Line \u2192 Meiji-Jingumae (Harajuku)' },
        { time:'1:00 PM',  text:'Meiji Shrine \u00b7 forested approach, very peaceful' },
        { time:'2:30 PM',  text:'Takeshita-dori \u00b7 Harajuku street fashion, crepes' },
        { time:'3:30 PM',  text:'Omotesando \u00b7 tree-lined boulevard, flagship architecture' },
      ]},
      { label:'Evening \u2014 Shibuya', items:[
        { time:'5:30 PM', text:'Shibuya Scramble Crossing \u00b7 view from above first, then walk through' },
        { time:'7:00 PM', text:'Dinner in Shibuya or Shimokitazawa \u00b7 izakayas, wine bars' },
      ]},
    ],
    tip:'teamLab closes at 10 PM on Apr 17 (extended spring hours). 8:30 AM is the least crowded slot \u2014 crowds arrive after 11 AM.'
  },
  apr18: {
    id:'apr18', date:'SAT APR 18', title:'Old Tokyo', location:'Asakusa \u00b7 Yanaka \u00b7 Akihabara',
    periods:[
      { label:'Morning \u2014 Asakusa', items:[
        { time:'7:30 AM', text:'Arrive Asakusa \u00b7 Senso-ji before the crowds' },
        { text:'Tour buses arrive by 10 AM \u2014 early light through incense smoke is worth it', sub:true },
        { time:'8:30 AM', text:'Nakamise-dori \u00b7 ningyo-yaki, age-manju, melonpan' },
        { time:'9:30 AM', text:'Kappabashi-dori \u00b7 restaurant supply street, plastic food models' },
      ]},
      { label:'Afternoon \u2014 Yanaka + Akihabara', items:[
        { time:'11:00 AM', text:"Yanaka \u00b7 Tokyo's best-preserved traditional neighborhood" },
        { text:'Yanaka Cemetery (cherry trees) \u00b7 Yanaka Ginza covered shopping street', sub:true },
        { time:'1:00 PM',  text:'Lunch in Yanaka \u00b7 local tofu shops, small restaurants' },
        { time:'2:30 PM',  text:'Akihabara \u00b7 15 min walk \u00b7 electronics, retro games, arcade floors' },
      ]},
      { label:'Evening \u2014 Shinjuku', items:[
        { time:'7:00 PM', text:'Fuunji ramen \u00b7 exceptional tsukemen \u00b7 short queue likely' },
        { time:'8:30 PM', text:'Golden Gai \u00b7 tiny themed bars (jazz, film, rock) \u00b7 just wander in' },
      ]},
    ],
    tip:null
  },
  apr19: {
    id:'apr19', date:'SUN APR 19', title:'Kamakura Day Trip', location:'Tokyo \u2192 Kamakura (~1 hr)',
    periods:[
      { label:'Morning \u2014 Kita-Kamakura', items:[
        { time:'8:00 AM',  text:'Depart Shinjuku \u00b7 JR Shonan-Shinjuku Line \u2192 Kita-Kamakura (~1 hr \u00b7 \u00a5920/~$6)' },
        { time:'9:15 AM',  text:'Engaku-ji Temple \u00b7 cedar forest, zen garden' },
        { time:'10:00 AM', text:'Walk the trail south toward Kamakura (20\u201330 min)' },
      ]},
      { label:'Afternoon \u2014 Kamakura', items:[
        { time:'11:00 AM', text:'Great Buddha \u00b7 Kotoku-in \u00b7 \u00a5300 (~$2) \u00b7 enter the hollow statue' },
        { time:'12:00 PM', text:'Hase-dera Temple \u00b7 ocean views, cave system \u00b7 \u00a5400 (~$3)' },
        { time:'1:00 PM',  text:'Lunch near Hase Station \u00b7 shirasu (whitebait) dishes' },
        { time:'2:30 PM',  text:'Optional: Tsurugaoka Hachimangu Shrine' },
      ]},
      { label:'Evening \u2014 Return + Luggage Forwarding', items:[
        { time:'4:00 PM', text:'Return to Shinjuku by 5:30 PM' },
        { time:'6:00 PM', text:'Arrange takkyubin at hotel front desk tonight', type:'booked' },
        { text:'Send luggage: Hotel Gracery Shinjuku \u2192 Hotel Granvia Kyoto', sub:true },
        { text:'Sent Apr 19, arrives Apr 21 \u00b7 ~\u00a51,500\u20132,000/bag (~$10\u201313)', sub:true },
        { time:'7:30 PM', text:'Last dinner in Shinjuku' },
      ]},
    ],
    tip:'Weekends in Kamakura are busy \u2014 arriving before 10 AM puts you ahead of the tour groups.'
  },
  apr20: {
    id:'apr20', date:'MON APR 20', title:'Fuji Excursion \u2192 Kawaguchiko \u2192 Hakone', location:'Shinjuku \u2192 Kawaguchiko \u2192 Gora',
    periods:[
      { label:'Morning \u2014 Fuji Excursion', items:[
        { time:'8:30 AM',  text:'Fuji-Excursion 7 departs Shinjuku', type:'booked' },
        { text:'\u00a58,400 total (~$53) \u00b7 Car 3, Seats 13-C & 13-D \u00b7 Res: E77821', sub:true },
        { text:'Pickup code: 24492390994521288 \u00b7 Collect tickets first!', sub:true },
        { time:'10:26 AM', text:'Arrive Kawaguchiko Station' },
      ]},
      { label:'Mid-Morning \u2014 Kawaguchiko', items:[
        { time:'10:30 AM', text:'Oishi Park \u00b7 north shore \u00b7 best Fuji reflections + late cherry blossoms' },
        { time:'12:00 PM', text:'Optional: Chureito Pagoda (30 min to Fujiyoshida \u00b7 ~400 steps)' },
      ]},
      { label:'Afternoon \u2014 Transit to Hakone', items:[
        { time:'1:30 PM', text:'Bus via Gotemba \u2192 Gora (~2.5 hrs) \u00b7 day bags only' },
        { time:'4:00 PM', text:'Check in Tensui Saryo \u00b7 Gora, Hakone', type:'booked' },
        { text:'Res: IK1516984808 \u00b7 check-in 15:00\u201321:30', sub:true },
      ]},
      { label:'Evening', items:[
        { time:'5:30 PM', text:'Ryokan \u00b7 change into yukata, private open-air onsen' },
        { time:'7:45 PM', text:'Kaiseki dinner at Tensui Saryo \u2014 19:45', type:'booked' },
        { text:'Dinner and breakfast included \u00b7 10-course traditional kaiseki', sub:true },
      ]},
    ],
    tip:'Morning is the best window for Mt. Fuji views before clouds build.'
  },
  apr21: {
    id:'apr21', date:'TUE APR 21', title:'The Hakone Loop', location:'Gora \u2192 Owakudani \u2192 Lake Ashi',
    periods:[
      { label:'Morning \u2014 Open Air Museum + Ropeway', items:[
        { time:'9:00 AM',  text:'Hakone Open Air Museum \u00b7 opens 9 AM \u00b7 \u00a52,000 (~$13)' },
        { text:'10 min walk from ryokan \u00b7 outdoor sculptures, Picasso Pavilion, foot onsen inside', sub:true },
        { time:'11:00 AM', text:'Hakone Tozan Railway: Gora \u2192 Sounzan (10 min)' },
        { time:'11:15 AM', text:'Ropeway: Sounzan \u2192 Owakudani (~25 min) \u00b7 Hakone Free Pass' },
      ]},
      { label:'Midday \u2014 Owakudani + Lake Ashi', items:[
        { time:'12:00 PM', text:'Owakudani volcanic valley \u00b7 sulfur steam vents \u00b7 black eggs' },
        { text:'\u00a5500 for 5 eggs (~$3) \u00b7 supposedly add 7 years per egg', sub:true },
        { time:'1:00 PM',  text:'Ropeway \u2192 Togendai on Lake Ashi (~25 min)' },
        { time:'1:30 PM',  text:'Lake Ashi sightseeing boat \u2192 Moto-Hakone (~30 min \u00b7 Free Pass)' },
      ]},
      { label:'Afternoon \u2014 Hakone Shrine + Return', items:[
        { time:'2:30 PM', text:'Hakone Shrine \u00b7 torii gate rising from the lake' },
        { time:'3:30 PM', text:'Lunch near Moto-Hakone \u00b7 tofu cuisine, soba' },
        { time:'5:00 PM', text:'Back to Gora \u00b7 Hakone Tozan Railway from Hakone-Yumoto' },
        { time:'5:30 PM', text:'Tensui Saryo \u00b7 private open-air onsen' },
      ]},
      { label:'Evening', items:[
        { time:'7:45 PM', text:'Kaiseki dinner at Tensui Saryo \u2014 19:45', type:'booked' },
        { text:'Dinner and breakfast included', sub:true },
      ]},
    ],
    tip:'Buy the Hakone Free Pass at Gora Station \u2014 covers Tozan Railway, ropeway, and Lake Ashi boat. ~\u00a54,000 (~$25) for the 2-day version.'
  },
  apr22: {
    id:'apr22', date:'WED APR 22', title:'Depart Hakone \u2192 Arrive Kyoto', location:'Gora \u2192 Odawara \u2192 Kyoto',
    periods:[
      { label:'Morning \u2014 Checkout + Shinkansen', items:[
        { time:'7:00 AM',  text:'Breakfast at ryokan \u00b7 included' },
        { time:'9:00 AM',  text:'Check out Tensui Saryo \u00b7 must leave by 9:00 AM' },
        { text:'Hot Spring Tax \u00a5150/person payable at checkout', sub:true },
        { time:'9:05 AM',  text:'Hakone Tozan Railway: Gora \u2192 Hakone-Yumoto (~35 min)' },
        { time:'9:45 AM',  text:'Local train: Hakone-Yumoto \u2192 Odawara (~15 min)' },
        { time:'10:11 AM', text:'HIKARI 637 departs Odawara', type:'booked' },
        { text:'\u00a523,800 total (~$150) \u00b7 Res: 2002 \u00b7 Smart EX: 9007241665 \u00b7 Series N700 \u00b7 Ordinary', sub:true },
        { time:'12:12 PM', text:'Arrive Kyoto Station' },
      ]},
      { label:'Afternoon \u2014 Arrive Kyoto', items:[
        { time:'12:15 PM', text:'Check in Hotel Granvia Kyoto', type:'booked' },
        { text:'Above Kyoto Station \u00b7 Conf: #23151SF060529 \u00b7 luggage arriving from takkyubin', sub:true },
        { time:'2:30 PM',  text:'Fushimi Inari Taisha \u00b7 5 min by JR \u00b7 FREE \u00b7 open 24 hrs' },
        { text:'Preview visit \u2014 lower gates only \u00b7 save energy for tomorrow 6 AM', sub:true },
      ]},
      { label:'Evening', items:[
        { time:'5:30 PM', text:'Nishiki Market \u00b7 closes ~5:30 PM weekdays' },
        { time:'7:30 PM', text:'Dinner in Gion or Pontocho alley' },
      ]},
    ],
    tip:'Check out by 9 AM is essential. The full Fushimi Inari hike is tomorrow at 6 AM \u2014 the single most important timing decision of the Kyoto trip.'
  },
  apr23: {
    id:'apr23', date:'THU APR 23', title:'Fushimi Inari + Higashiyama', location:'Kyoto \u00b7 Southern + Eastern Kyoto',
    periods:[
      { label:'Very Early Morning \u2014 Fushimi Inari', items:[
        { time:'5:45 AM', text:'JR Nara Line \u2192 Inari Station (5 min \u00b7 \u00a5150/~$1)' },
        { time:'6:00 AM', text:'Arrive Fushimi Inari Taisha \u00b7 FREE \u00b7 open 24 hrs' },
        { text:"By 8 AM it's crowded \u00b7 by 10 AM shoulder-to-shoulder \u00b7 6 AM is transformative", sub:true },
        { text:'Full hike to summit and back ~2 hrs \u00b7 Yotsutsuji crossroads has best city views', sub:true },
        { time:'8:30 AM', text:'Descend \u00b7 grab breakfast from street stalls outside entrance' },
      ]},
      { label:'Late Morning \u2014 Higashiyama', items:[
        { time:'10:00 AM', text:'Bus or taxi to Higashiyama district' },
        { time:'10:30 AM', text:'Ninenzaka + Sannenzaka \u00b7 preserved stone-paved machiya streets' },
        { time:'11:30 AM', text:'Kiyomizudera Temple \u00b7 \u00a5500 (~$3)' },
      ]},
      { label:"Afternoon \u2014 Gion + Philosopher's Path", items:[
        { time:'1:00 PM',  text:'Lunch in Higashiyama' },
        { time:'2:30 PM',  text:'Gion district \u00b7 Hanamikoji Street \u00b7 watch for geiko/maiko' },
        { time:"4:00 PM",  text:"Philosopher's Path \u00b7 2 km canal walk lined with cherry trees" },
        { time:'5:30 PM',  text:'Nanzenji Temple at the south end \u00b7 free grounds' },
      ]},
      { label:'Evening', items:[
        { time:'7:00 PM', text:'Dinner in Gion or Pontocho \u00b7 book in advance' },
      ]},
    ],
    tip:'6 AM at Fushimi Inari is the single best timing call of the Kyoto trip. The difference between 6 AM and 10 AM is the difference between serene and a crush of tourists.'
  },
  apr24: {
    id:'apr24', date:'FRI APR 24', title:'Arashiyama + Nishiki Market', location:'Kyoto \u00b7 Western + Central',
    periods:[
      { label:'Early Morning \u2014 Arashiyama Bamboo Grove', items:[
        { time:'7:00 AM', text:'JR Sagano Line \u2192 Saga-Arashiyama (~15 min \u00b7 \u00a5240/~$2)' },
        { time:'7:30 AM', text:'Arashiyama Bamboo Grove \u00b7 FREE \u00b7 open 24 hrs' },
        { text:'Tour groups arrive by 9 AM \u00b7 7:30 AM is dramatically quieter', sub:true },
        { time:'8:30 AM', text:'Tenryu-ji Temple \u00b7 opens 8:30 AM \u00b7 \u00a5500 (~$3) for garden' },
        { time:'9:30 AM', text:'Okochi-Sanso Villa \u00b7 \u00a51,000 (~$6) includes matcha + sweet' },
      ]},
      { label:'Midday \u2014 Arashiyama', items:[
        { time:'11:00 AM', text:'Togetsukyo Bridge \u00b7 iconic bridge over the Oi River' },
        { time:'11:30 AM', text:'Lunch \u00b7 yudofu (hot tofu), matcha soba, or riverside cafe' },
      ]},
      { label:'Afternoon \u2014 Central Kyoto', items:[
        { time:'2:30 PM', text:'Nishiki Market \u00b7 go before 3 PM \u00b7 closes ~5:30 PM weekdays' },
        { text:"Kyoto's Kitchen \u00b7 sakura-themed sweets in April \u00b7 pickles \u00b7 matcha soft serve", sub:true },
        { time:'4:00 PM', text:'Teramachi + Shinkyogoku shopping arcades \u00b7 adjacent to Nishiki' },
      ]},
      { label:'Evening', items:[
        { time:'6:30 PM', text:'Gion at dusk \u00b7 best light for wooden machiya architecture' },
        { time:'7:30 PM', text:'Dinner in Pontocho or Gion' },
      ]},
    ],
    tip:null
  },
  apr25: {
    id:'apr25', date:'SAT APR 25', title:'Nara Day Trip + Kinkaku-ji', location:'Kyoto \u2192 Nara \u2192 Northern Kyoto',
    periods:[
      { label:'Morning \u2014 Nara', items:[
        { time:'8:30 AM',  text:'JR Nara Line: Kyoto \u2192 Nara (45 min \u00b7 \u00a5760/~$5)' },
        { time:'9:30 AM',  text:'Nara Park \u00b7 hundreds of freely roaming deer \u00b7 \u00a5200 deer crackers' },
        { time:'10:00 AM', text:'Todai-ji Temple \u00b7 world\'s largest wooden building \u00b7 giant bronze Buddha' },
        { text:'\u00a5600 (~$4) \u00b7 UNESCO \u00b7 genuinely awe-inspiring scale', sub:true },
        { time:'11:30 AM', text:'Kasuga Taisha Shrine \u00b7 forest setting \u00b7 lantern-lined paths' },
        { time:'12:30 PM', text:'Lunch in Nara \u00b7 kakinoha-zushi (persimmon-leaf sushi)' },
        { time:'2:00 PM',  text:'Return to Kyoto \u00b7 JR Nara Line' },
      ]},
      { label:'Afternoon \u2014 Northern Kyoto', items:[
        { time:'3:00 PM', text:'Kinkaku-ji (Golden Pavilion) \u00b7 \u00a5500 (~$3)' },
        { text:'Worth seeing once despite crowds \u00b7 best on a clear afternoon', sub:true },
        { time:'4:00 PM', text:'Ryoan-ji Temple \u00b7 world-famous rock garden \u00b7 \u00a5600 (~$4)' },
      ]},
      { label:'Evening \u2014 Last Night in Kyoto', items:[
        { time:'7:00 PM', text:'Dinner \u00b7 Kawaramachi or Shijo area' },
      ]},
    ],
    tip:'Saturdays in April are busy. Go to Nara before 10 AM and Kinkaku-ji after 3 PM when tour buses thin. Golden Week starts April 29 \u2014 you leave just in time.'
  },
  apr26: {
    id:'apr26', date:'SUN APR 26', title:'Depart Kyoto \u2192 Kanazawa', location:'Kyoto \u2192 Kanazawa',
    periods:[
      { label:'Morning \u2014 Checkout', items:[
        { time:'10:00 AM', text:'Check out Hotel Granvia Kyoto', type:'booked' },
      ]},
      { label:'Transit to Kanazawa', items:[
        { text:'Thunderbird Limited Express: Kyoto \u2192 Kanazawa (~2 hrs \u00b7 ~\u00a56,000\u20137,000/~$38\u201344)' },
        { text:'Book separately at Kyoto Station ticket counter', sub:true },
      ]},
      { label:'Afternoon \u2014 Arrive Kanazawa', items:[
        { time:'3:00 PM',  text:'Check in Hotel Intergate Kanazawa', type:'booked' },
        { text:'Conf: 20260125110822242 \u00b7 Expedia: 73356721260247 \u00b7 Breakfast buffet included', sub:true },
        { time:'4:30 PM',  text:"Higashi Chaya District \u00b7 Japan's best-preserved geisha quarter outside Kyoto" },
      ]},
      { label:'Evening', items:[
        { time:'7:00 PM', text:'Dinner \u00b7 Nodoguro (blackthroat seaperch), sweet shrimp' },
      ]},
    ],
    tip:null
  },
  apr27: {
    id:'apr27', date:'MON APR 27', title:'Kanazawa Full Day', location:'Kenroku-en \u00b7 21st Century Museum \u00b7 Omicho',
    periods:[
      { label:'Morning \u2014 Kenroku-en + Castle', items:[
        { time:'7:00 AM', text:"Kenroku-en Garden \u00b7 opens 7 AM \u00b7 \u00a5320 (~$2) \u00b7 free early entry from 4 AM" },
        { text:"One of Japan's three great gardens \u00b7 1.5\u20132 hrs \u00b7 Kasumigaike Pond + Kotojitoro lantern", sub:true },
        { time:'8:30 AM', text:'Kanazawa Castle Park \u00b7 directly adjacent \u00b7 free grounds' },
      ]},
      { label:'Mid-Morning \u2014 21st Century Museum', items:[
        { time:'10:00 AM', text:'21st Century Museum of Contemporary Art \u00b7 opens 10 AM' },
        { text:'Free exchange zone \u00b7 ~\u00a51,400 (~$9) for exhibitions \u00b7 CLOSED MONDAYS \u2014 verify!', sub:true },
        { text:'Swimming Pool (Leandro Erlich) + Blue Planet Sky (James Turrell)', sub:true },
      ]},
      { label:'Afternoon \u2014 Omicho + Nagamachi', items:[
        { time:'12:00 PM', text:"Omicho Market \u00b7 Kanazawa's kitchen \u00b7 9 AM \u2013 5 PM" },
        { text:'Kaisendon (seafood rice bowl) \u00b7 arrive by noon before lines grow', sub:true },
        { time:'2:00 PM',  text:'Nagamachi Samurai District \u00b7 Nomura Clan House \u00b7 \u00a5550 (~$4)' },
      ]},
      { label:'Evening', items:[
        { time:'6:30 PM', text:'Dinner \u00b7 Kanazawa seafood \u00b7 Nodoguro, crab, sweet shrimp' },
      ]},
    ],
    tip:'Apr 27 is a Monday \u2014 the 21st Century Museum is typically closed Mondays. Verify on their website before the trip.'
  },
  apr28: {
    id:'apr28', date:'TUE APR 28', title:'Depart Kanazawa \u2192 Tokyo Ginza', location:'Kanazawa \u2192 Tokyo \u00b7 Ginza',
    periods:[
      { label:'Morning \u2014 Checkout + Shinkansen', items:[
        { time:'8:00 AM',  text:'Breakfast buffet at Hotel Intergate \u00b7 included' },
        { time:'10:00 AM', text:'Check out \u00b7 by 11:00 AM' },
        { text:'Hokuriku Shinkansen: Kanazawa \u2192 Tokyo ~2.5 hrs \u00b7 ~\u00a514,000 (~$88) \u00b7 Book separately', sub:true },
      ]},
      { label:'Afternoon \u2014 Arrive Tokyo Ginza', items:[
        { time:'3:00 PM',  text:'Check in Quintessa Hotel Tokyo Ginza', type:'booked' },
        { text:'Conf: 6519361226 \u00b7 PIN: 9235 \u00b7 Breakfast included', sub:true },
        { time:'2:30 PM',  text:'Hamarikyu Gardens \u00b7 \u00a5300 (~$2) \u00b7 traditional garden on Tokyo Bay' },
        { time:'4:00 PM',  text:'Ginza main streets \u00b7 Itoya stationery \u00b7 Ginza Six' },
      ]},
      { label:'Evening \u2014 Final Night', items:[
        { time:'6:30 PM', text:'Tsukiji Outer Market area for dinner' },
        { time:'8:00 PM', text:'Ginza evening stroll \u00b7 excellent last night in Japan' },
      ]},
    ],
    tip:'Pack tonight and confirm you have everything. Flight departs HND at 6:10 PM tomorrow \u2014 leave the hotel by 12:30 PM.'
  },
  apr29: {
    id:'apr29', date:'WED APR 29', title:'Final Morning + Depart', location:'Tokyo Ginza \u2192 HND \u2192 LAX',
    periods:[
      { label:'Morning \u2014 Tsukiji Farewell', items:[
        { time:'7:30 AM',  text:'Tsukiji Outer Market \u00b7 classic Tokyo farewell breakfast' },
        { text:'Fresh sushi, tamagoyaki, grilled scallops, matcha \u00b7 best before 10 AM', sub:true },
        { time:'10:00 AM', text:'Return to hotel \u00b7 collect luggage' },
      ]},
      { label:'Afternoon \u2014 Depart', items:[
        { time:'12:30 PM', text:'Depart hotel for Haneda Airport \u00b7 no later than 12:30 PM' },
        { text:'Keikyu Line from Higashi-Ginza \u2192 HND Terminal 3 (~30 min \u00b7 \u00a5300/~$2)', sub:true },
        { time:'6:10 PM',  text:'United UA 38 departs HND', type:'booked' },
        { text:'HND \u2192 LAX \u00b7 10 hrs 5 min \u00b7 Seats 31J (Gwen) & 31L (Christina) \u00b7 Conf: F354LH', sub:true },
        { text:'Arrives LAX Wednesday April 29, 12:15 PM (same day, crossing date line)', sub:true },
      ]},
    ],
    tip:"Golden Week begins today \u2014 you're flying out. Well timed. Allow 3 hours at the airport."
  }
};

const GROUPS = [
  { label:'TOKYO',                dates:'APR 15\u201320', ids:['apr15','apr16','apr17','apr18','apr19'] },
  { label:'KAWAGUCHIKO \u00b7 HAKONE', dates:'APR 20\u201322', ids:['apr20','apr21'] },
  { label:'KYOTO',                dates:'APR 22\u201326', ids:['apr22','apr23','apr24','apr25'] },
  { label:'KANAZAWA',             dates:'APR 26\u201328', ids:['apr26','apr27'] },
  { label:'TOKYO \u00b7 GINZA',   dates:'APR 28\u201329', ids:['apr28','apr29'] },
];

// ── Confirmations ─────────────────────────────────────────────
const CONFIRMATIONS = {
  flights:[
    { name:'Outbound \u00b7 LAX \u2192 Tokyo HND',
      number:{ label:'Confirmation', val:'F354LH' },
      rows:[
        { k:'Flight',    v:'United UA 39' },
        { k:'Date',      v:'Wed April 15, 2026' },
        { k:'Departs',   v:'LAX 11:20 AM' },
        { k:'Arrives',   v:'HND Thu April 16, 3:05 PM' },
        { k:'Duration',  v:'11 hrs 45 min' },
        { k:'Seats',     v:'31L (Gwendalynn) \u00b7 31J (Christina)' },
        { k:'Aircraft',  v:'Boeing 787-10 Dreamliner \u00b7 Economy (K)' },
        { k:'eTickets',  v:'0162358617634 (Gwen) \u00b7 0162358617635 (Christina)', mono:true },
        { k:'Cost',      v:'$2,196.86 total \u00b7 $1,098.43/person (incl. Economy Plus seats)' },
      ]
    },
    { name:'Return \u00b7 Tokyo HND \u2192 LAX',
      number:{ label:'Confirmation', val:'F354LH' },
      rows:[
        { k:'Flight',   v:'United UA 38' },
        { k:'Date',     v:'Wed April 29, 2026' },
        { k:'Departs',  v:'HND 6:10 PM' },
        { k:'Arrives',  v:'LAX 12:15 PM same day' },
        { k:'Duration', v:'10 hrs 5 min' },
        { k:'Seats',    v:'31J (Gwendalynn) \u00b7 31L (Christina)' },
        { k:'Aircraft', v:'Boeing 787-10 Dreamliner \u00b7 Economy (K)' },
      ]
    }
  ],
  hotels:[
    { name:'Hotel Gracery Shinjuku \u00b7 Tokyo',
      number:{ label:'Confirmation', val:'5594.831.309' },
      rows:[
        { k:'Check-in',  v:'Thu Apr 16 from 14:00' },
        { k:'Check-out', v:'Mon Apr 20 by 11:00 (4 nights)' },
        { k:'Room',      v:'Standard Twin Room \u2014 Non-Smoking' },
        { k:'PIN',       v:'6506', mono:true },
        { k:'Address',   v:'Kabukicho 1-19-1, Shinjuku, Tokyo 160-0021' },
        { k:'Phone',     v:'+81 3 6833 1111' },
        { k:'Price',     v:'\u00a5200,692 (~$1,269)' },
        { k:'Cancel',    v:'Free 1 day before \u00b7 no-show = full charge' },
      ]
    },
    { name:'Tensui Saryo \u00b7 Gora, Hakone',
      number:{ label:'Reservation', val:'IK1516984808' },
      rows:[
        { k:'Check-in',     v:'Mon Apr 20, 15:00\u201321:30 (est. arrival 17:30)' },
        { k:'Check-out',    v:'Wed Apr 22 by 10:00 (2 nights)' },
        { k:'Room',         v:'Detached Type-A \u00b7 Onsen + Foot Bath \u00b7 Japanese-Western' },
        { k:'Plan',         v:'Early Bird 20 \u00d7 Basic Kaiseki \u00b7 Dinner 19:45 \u00b7 Breakfast included' },
        { k:'Verification', v:'0F35443D931C12B', mono:true },
        { k:'Address',      v:'1320-276 Gora, Hakone-machi, Ashigarashimo-gun' },
        { k:'Phone',        v:'+81-570-062-302' },
        { k:'Price',        v:'\u00a5126,340 (~$794) incl. tax' },
        { k:'Cancel',       v:'Free until 8 days before \u00b7 30% from 7 days \u00b7 50% from 2 \u00b7 80% same day' },
        { k:'Access',       v:'2\u20133 min walk from Gora Station (Hakone Tozan Railway)' },
      ]
    },
    { name:'Hotel Granvia Kyoto',
      number:{ label:'Confirmation', val:'#23151SF060529' },
      rows:[
        { k:'Check-in',  v:'Wed Apr 22, 2026' },
        { k:'Check-out', v:'Sun Apr 26, 2026 (4 nights)' },
        { k:'Room',      v:'Granvia Deluxe Twin Room \u2014 Non-Smoking' },
        { k:'Address',   v:'JR Kyoto Station (Karasuma), 600-8216 Kyoto' },
        { k:'Phone',     v:'+81-75-344-8888' },
        { k:'Price',     v:'\u00a5268,256 (~$1,686) total incl. tax and service' },
        { k:'Rates',     v:'Apr 22\u201323: \u00a562,814/night \u00b7 Apr 24: \u00a567,064 \u00b7 Apr 25: \u00a575,564' },
        { k:'Cancel',    v:'Notify by 16:00 JST day before arrival or full night charge' },
        { k:'Luggage',   v:'Takkyubin arriving from Gracery Shinjuku (sent Apr 19, arrives Apr 21)' },
      ]
    },
    { name:'Hotel Intergate Kanazawa',
      number:{ label:'Confirmation', val:'20260125110822242' },
      rows:[
        { k:'Check-in',  v:'Sun Apr 26 from 15:00' },
        { k:'Check-out', v:'Tue Apr 28 by 11:00 (2 nights)' },
        { k:'Room',      v:'Superior Twin Room \u2014 Non-Smoking' },
        { k:'Amenities', v:'Breakfast Buffet included' },
        { k:'Expedia',   v:'73356721260247', mono:true },
        { k:'Address',   v:'2-5 Takaokamachi, Kanazawa, Ishikawa 920-0864' },
        { k:'Price',     v:'\u00a539,004 (~$245) total incl. taxes \u00b7 pay at property' },
        { k:'Cancel',    v:'Free until Apr 22, 11:59 PM \u00b7 100% charge after' },
      ]
    },
    { name:'Quintessa Hotel Tokyo Ginza',
      number:{ label:'Confirmation', val:'6519361226' },
      rows:[
        { k:'Check-in',  v:'Tue Apr 28 from 15:00' },
        { k:'Check-out', v:'Wed Apr 29 by 11:00 (1 night)' },
        { k:'Room',      v:'Hollywood Twin Room' },
        { k:'Amenities', v:'Breakfast included' },
        { k:'PIN',       v:'9235', mono:true },
        { k:'Address',   v:'Chuo-ku Ginza 4-11-4, Tokyo' },
        { k:'Phone',     v:'+81 3-6264-1351' },
        { k:'Price',     v:'\u00a524,713 (~$155) \u00b7 charged Apr 25 to card on file' },
        { k:'Cancel',    v:'Free until Apr 26, 11:59 PM JST \u00b7 100% charge after' },
      ]
    }
  ],
  trains:[
    { name:'teamLab Borderless \u00b7 Apr 17',
      number:{ label:'Confirmation', val:'A7YRA4LXWCN3-0001' },
      rows:[
        { k:'Date',    v:'Friday April 17, 2026' },
        { k:'Entry',   v:'08:30\u201309:00 window \u00b7 Azabudai Hills Garden Plaza B, B1' },
        { k:'Tickets', v:'2 adults \u00b7 \u00a55,600/person \u00b7 \u00a511,200 total' },
        { k:'Address', v:'5-9 Toranomon, Minato-ku, Tokyo' },
        { k:'Note',    v:'Download teamLab app beforehand \u00b7 no re-entry' },
      ]
    },
    { name:'Fuji-Excursion 7 \u00b7 Shinjuku \u2192 Kawaguchiko',
      number:{ label:'Reservation', val:'E77821' },
      rows:[
        { k:'Date',         v:'Monday April 20, 2026' },
        { k:'Route',        v:'Shinjuku 8:30 AM \u2192 Kawaguchiko 10:26 AM' },
        { k:'Seats',        v:'Car 3, Seat 13-C (Gwendalynn) \u00b7 Seat 13-D (Christina)' },
        { k:'Pickup code',  v:'24492390994521288', mono:true },
        { k:'Fare',         v:'\u00a58,400 (~$53) total for 2 adults' },
        { k:'Ticket',       v:'Pick up at ticket machine using QR code or pickup code before boarding' },
      ]
    },
    { name:'Shinkansen HIKARI 637 \u00b7 Odawara \u2192 Kyoto',
      number:{ label:'Reservation', val:'2002' },
      rows:[
        { k:'Train',      v:'HIKARI 637 \u00b7 Series N700 \u00b7 16 cars \u00b7 Ordinary' },
        { k:'Date',       v:'Wednesday April 22, 2026' },
        { k:'Route',      v:'Odawara 10:11 AM \u2192 Kyoto 12:12 PM' },
        { k:'Smart EX',   v:'9007241665', mono:true },
        { k:'Fare',       v:'\u00a523,800 (~$150) total \u00b7 Smart EX' },
        { k:'Seats',      v:'TBD \u00b7 email notification after Mar 22, 2026 at 8:00 AM' },
      ]
    }
  ]
};

// ── Pre-trip checklist ────────────────────────────────────────
const CHECKLIST = [
  {
    section:'BOOKED \u2014 nothing left to do',
    items:[
      { id:'c1',  label:'United flights (UA 39 + UA 38)',              sub:'Conf: F354LH \u00b7 seats 31L/31J' },
      { id:'c2',  label:'Hotel Gracery Shinjuku',                      sub:'4 nights \u00b7 Apr 16\u201320' },
      { id:'c3',  label:'teamLab Borderless tickets',                  sub:'Apr 17 \u00b7 8:30 AM \u00b7 \u00a55,600/person' },
      { id:'c4',  label:'Fuji-Excursion 7 train tickets',              sub:'Apr 20 \u00b7 Res: E77821' },
      { id:'c5',  label:'Tensui Saryo ryokan, Hakone',                 sub:'2 nights \u00b7 Apr 20\u201322 \u00b7 IK1516984808' },
      { id:'c6',  label:'Shinkansen HIKARI 637 (Odawara \u2192 Kyoto)', sub:'Apr 22 \u00b7 Res: 2002' },
      { id:'c7',  label:'Hotel Granvia Kyoto',                         sub:'4 nights \u00b7 Apr 22\u201326' },
      { id:'c8',  label:'Hotel Intergate Kanazawa',                    sub:'2 nights \u00b7 Apr 26\u201328' },
      { id:'c9',  label:'Quintessa Hotel Tokyo Ginza',                 sub:'1 night \u00b7 Apr 28\u201329' },
    ]
  },
  {
    section:'BEFORE YOU LEAVE',
    items:[
      { id:'c10', label:'Check shinkansen seat email',                sub:'Email expected after Mar 22 at 8:00 AM' },
      { id:'c11', label:'Download teamLab app',                       sub:'Needed for Infinite Crystal World numbered tickets' },
      { id:'c12', label:'Get IC card sorted (Suica or Pasmo)',        sub:'Add to Apple Wallet beforehand or buy at HND on arrival' },
      { id:'c13', label:'Confirm 21st Century Museum hours',          sub:'Apr 27 is Monday \u2014 verify not closed \u00b7 kanazawa21.jp' },
      { id:'c14', label:'Download Google Maps offline for each city', sub:'Tokyo, Kyoto, Kanazawa, Hakone' },
      { id:'c15', label:'Set up international data plan',             sub:'Or get pocket WiFi at HND' },
      { id:'c16', label:'Notify credit card companies of travel',     sub:'Prevent card blocks abroad' },
      { id:'c17', label:'Buy yen or plan for airport ATM',            sub:'Many places cash-only \u00b7 have \u00a520,000\u201330,000 on hand' },
      { id:'c18', label:'Add this site to iPhone home screen',        sub:'Open in Safari \u2192 Share \u2192 Add to Home Screen' },
    ]
  },
  {
    section:'ON-TRIP TASKS',
    items:[
      { id:'c19', label:'Arrange takkyubin at Hotel Gracery Shinjuku', sub:'Night of Apr 19 \u2014 send luggage to Hotel Granvia Kyoto' },
      { id:'c20', label:'Buy Hakone Free Pass at Gora Station',        sub:'Apr 20 or 21 \u00b7 covers ropeway, railway, Lake Ashi boat' },
      { id:'c21', label:'Pick up Fuji-Excursion tickets at machine',   sub:'Use QR code or pickup code: 24492390994521288' },
      { id:'c22', label:'Book Thunderbird: Kyoto \u2192 Kanazawa',      sub:'Apr 26 \u00b7 ~2 hrs \u00b7 buy at Kyoto Station ticket counter' },
      { id:'c23', label:'Book Hokuriku Shinkansen: Kanazawa \u2192 Tokyo', sub:'Apr 28 \u00b7 ~2.5 hrs \u00b7 ~\u00a514,000/person' },
    ]
  }
];

// ── Budget seed (used only if Firestore has no data) ─────────
const BUDGET_SEED = [
  { name:'United Flights (UA39 + UA38)', dates:'Apr 15 + 29', amt:2196.86, currency:'USD', cat:'transport' },
  { name:'Hotel Gracery Shinjuku',        dates:'Apr 16\u201320', amt:200692, currency:'JPY', cat:'accommodation' },
  { name:'teamLab Borderless',            dates:'Apr 17',       amt:11200,  currency:'JPY', cat:'activities' },
  { name:'Fuji-Excursion 7 Train',        dates:'Apr 20',       amt:8400,   currency:'JPY', cat:'transport' },
  { name:'Tensui Saryo Ryokan',           dates:'Apr 20\u201322', amt:126340, currency:'JPY', cat:'accommodation' },
  { name:'Shinkansen HIKARI 637',         dates:'Apr 22',       amt:23800,  currency:'JPY', cat:'transport' },
  { name:'Hotel Granvia Kyoto',           dates:'Apr 22\u201326', amt:268256, currency:'JPY', cat:'accommodation' },
  { name:'Hotel Intergate Kanazawa',      dates:'Apr 26\u201328', amt:39004,  currency:'JPY', cat:'accommodation' },
  { name:'Quintessa Hotel Tokyo Ginza',   dates:'Apr 28\u201329', amt:24713,  currency:'JPY', cat:'accommodation' },
];

const BUDGET_CAT_COLORS = {
  accommodation: '#C0392B',
  transport:     '#2980B9',
  activities:    '#27AE60',
};

// ── Packing seed data ─────────────────────────────────────────
const PACKING_SEED = {
  items:[
    { id:'pk1',  text:'Passport + copy', category:'Documents', done:false },
    { id:'pk2',  text:'Travel insurance documents', category:'Documents', done:false },
    { id:'pk3',  text:'Hotel confirmation printouts / PDFs', category:'Documents', done:false },
    { id:'pk4',  text:'IC card (Suica/Pasmo) or plan to get at HND', category:'Documents', done:false },
    { id:'pk5',  text:'iPhone + charger', category:'Tech', done:false },
    { id:'pk6',  text:'Portable battery pack', category:'Tech', done:false },
    { id:'pk7',  text:'Universal adapter (Japan is Type A)', category:'Tech', done:false },
    { id:'pk8',  text:'AirPods / headphones', category:'Tech', done:false },
    { id:'pk9',  text:'Comfortable walking shoes', category:'Clothes', done:false },
    { id:'pk10', text:'Slip-on shoes (easy on/off for shrines)', category:'Clothes', done:false },
    { id:'pk11', text:'Layers for cool April mornings', category:'Clothes', done:false },
    { id:'pk12', text:'Rain jacket / compact umbrella', category:'Clothes', done:false },
    { id:'pk13', text:'Sunscreen', category:'Toiletries', done:false },
    { id:'pk14', text:'Small day bag / backpack', category:'Toiletries', done:false },
    { id:'pk15', text:'Motion sickness medication', category:'Health', done:false },
    { id:'pk16', text:'Blister bandages', category:'Health', done:false },
    { id:'pk17', text:'Yen cash (~\u00a530,000)', category:'Documents', done:false },
  ]
};

// ── DOM refs ──────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const tripStatusEl   = $('tripStatus');
const jstClockEl     = $('jstClock');
const searchInputEl  = $('searchInput');
const destPillsWrap  = $('destPillsWrap');
const destPillsEl    = $('destPills');
const darkToggleBtn  = $('darkToggle');
const authBtn        = $('authBtn');
const authBtnLabel   = $('authBtnLabel');
const userAvatarSm   = $('userAvatarSm');
const overlay        = $('overlay');
const authClose      = $('authClose');
const googleSignInBtn= $('googleSignInBtn');
const authErrEl      = $('authErr');
const currencyFab    = $('currencyFab');
const currencyWidget = $('currencyWidget');
const currencyClose  = $('currencyClose');
const jpyInput       = $('jpyInput');
const usdInput       = $('usdInput');
const currRateEl     = $('currRate');
const themeColorMeta = $('theme-color-meta');

// ── Dark mode ─────────────────────────────────────────────────
function applyDark(on) {
  document.body.classList.toggle('dark', on);
  darkToggleBtn.textContent = on ? '\u2600' : '\u263D';
  themeColorMeta.content = on ? '#111111' : '#F8F6F1';
  try { localStorage.setItem('japan-dark', on ? '1' : '0'); } catch {}
}
darkToggleBtn.addEventListener('click', () => applyDark(!document.body.classList.contains('dark')));
try { if (localStorage.getItem('japan-dark') === '1') applyDark(true); } catch {}

// ── Currency converter ────────────────────────────────────────
async function fetchRate() {
  try {
    const res  = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    if (data.rates && data.rates.JPY) {
      exchRate   = data.rates.JPY;
      rateIsLive = true;
      localStorage.setItem('japan-rate', exchRate);
      currRateEl.textContent = '1 USD = \u00a5' + exchRate.toFixed(0) + ' JPY (live)';
      // Refresh budget if open
      if ($('budget').classList.contains('active')) renderBudget();
    }
  } catch { currRateEl.textContent = '1 USD \u2248 \u00a5' + exchRate + ' JPY (estimated)'; }
}
currencyFab.addEventListener('click', () => currencyWidget.classList.toggle('hidden'));
currencyClose.addEventListener('click', () => currencyWidget.classList.add('hidden'));
jpyInput.addEventListener('input', () => {
  const v = parseFloat(jpyInput.value);
  usdInput.value = isNaN(v) ? '' : (v / exchRate).toFixed(2);
});
usdInput.addEventListener('input', () => {
  const v = parseFloat(usdInput.value);
  jpyInput.value = isNaN(v) ? '' : (v * exchRate).toFixed(0);
});

// ── JST clock + trip status ───────────────────────────────────
function getTodayJST() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }));
}
function getTodayDayId() {
  const t = getTodayJST().toDateString();
  return Object.entries(DAY_DATES).find(([, d]) => d.toDateString() === t)?.[0] || null;
}
function getDayClass(id) {
  const today   = getTodayJST();
  const dayDate = DAY_DATES[id];
  if (!dayDate) return '';
  const t = today.toDateString(), d = dayDate.toDateString();
  if (t === d) return 'today';
  return today > dayDate ? 'past' : '';
}
function updateClock() {
  const jst = getTodayJST();
  const h = String(jst.getHours()).padStart(2, '0');
  const m = String(jst.getMinutes()).padStart(2, '0');
  jstClockEl.textContent = 'JST ' + h + ':' + m;
}
function updateTripStatus() {
  const now     = new Date();
  const todayId = getTodayDayId();
  if (now < TRIP_START) {
    const days = Math.ceil((TRIP_START - now) / 86400000);
    tripStatusEl.innerHTML = 'Trip starts in <strong>' + days + ' day' + (days === 1 ? '' : 's') + '</strong>';
  } else if (now > TRIP_END) {
    tripStatusEl.innerHTML = 'Trip complete &nbsp;&middot;&nbsp; Apr 15\u201329, 2026';
  } else {
    const dayNum  = Math.floor((now - TRIP_START) / 86400000) + 1;
    const destName= (GROUPS.find(g => g.ids.includes(todayId))?.label || '').split('\u00b7')[0].trim();
    tripStatusEl.innerHTML = '<strong>Day ' + dayNum + ' of 15</strong> &nbsp;&middot;&nbsp; ' + destName;
  }
}

// ── Destination pills ─────────────────────────────────────────
function buildDestPills() {
  destPillsWrap.classList.remove('hidden');
  destPillsEl.innerHTML = GROUPS.map((g, i) =>
    '<button class="dest-pill' + (i === 0 ? ' active' : '') + '" data-group="' + i + '">' + g.label + '</button>'
  ).join('');
  destPillsEl.querySelectorAll('.dest-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      destPillsEl.querySelectorAll('.dest-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const sec = document.getElementById('section-' + pill.dataset.group);
      if (sec) {
        const hH = document.querySelector('header').offsetHeight;
        const pH = destPillsWrap.offsetHeight;
        window.scrollTo({ top: sec.getBoundingClientRect().top + window.scrollY - hH - pH - 10, behavior: 'smooth' });
      }
    });
  });
}
function updateActivePill() {
  const hH = document.querySelector('header').offsetHeight;
  const pH = destPillsWrap.classList.contains('hidden') ? 0 : destPillsWrap.offsetHeight;
  const offset = hH + pH + 20;
  let active = 0;
  GROUPS.forEach((_, i) => {
    const el = document.getElementById('section-' + i);
    if (el && el.getBoundingClientRect().top < offset) active = i;
  });
  destPillsEl.querySelectorAll('.dest-pill').forEach((p, i) => p.classList.toggle('active', i === active));
}

// ── Render: Itinerary ─────────────────────────────────────────
function renderItinerary() {
  $('itinerary').innerHTML = GROUPS.map((g, i) =>
    '<div class="dest-section" id="section-' + i + '">' +
      '<div class="dest-header"><span class="dest-name">' + g.label + '</span><span class="dest-dates">' + g.dates + '</span></div>' +
      g.ids.map(id => renderDay(DAYS[id])).join('') +
    '</div>'
  ).join('');

  document.querySelectorAll('.day-header').forEach(h => {
    h.addEventListener('click', () => h.parentElement.classList.toggle('expanded'));
  });

  // Auto-expand today's card
  const todayId = getTodayDayId();
  if (todayId) {
    const card = document.getElementById('card-' + todayId);
    if (card) {
      card.classList.add('expanded');
      setTimeout(() => {
        const hH = document.querySelector('header').offsetHeight;
        const pH = destPillsWrap.offsetHeight;
        window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - hH - pH - 12, behavior: 'smooth' });
      }, 300);
    }
  }
}

function renderDay(d) {
  const cls     = getDayClass(d.id);
  const isToday = cls === 'today';
  const noteText = notes[d.id] || '';
  const noteRead = noteText
    ? noteText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')
    : '<em>No notes yet \u2014 sign in to add notes.</em>';

  const periodsHtml = d.periods.map(p =>
    '<div class="period">' +
    '<div class="period-label">' + p.label + '</div>' +
    p.items.map(renderItem).join('') +
    '</div>'
  ).join('');

  const tipHtml = d.tip
    ? '<div class="tip-block"><span class="tip-label">Tip &nbsp;&nbsp;</span>' + esc(d.tip) + '</div>'
    : '';

  const notesHtml =
    '<div class="notes-section">' +
    '<div class="notes-label">Notes</div>' +
    '<div class="notes-read">' + noteRead + '</div>' +
    '<textarea class="notes-edit" data-day="' + d.id + '" placeholder="Add notes, restaurant picks, reminders\u2026">' + esc(noteText) + '</textarea>' +
    '<div class="save-indicator" id="save-' + d.id + '"></div>' +
    '</div>';

  return '<div class="day-card ' + cls + '" id="card-' + d.id + '">' +
    '<div class="day-header">' +
      '<div class="day-header-left">' +
        '<span class="day-date">' + d.date + '</span>' +
        '<div class="day-title-wrap">' +
          '<div class="day-title">' + esc(d.title) + (isToday ? '<span class="today-badge">TODAY</span>' : '') + '</div>' +
          '<div class="day-location">' + d.location + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="day-header-right">' +
        '<span class="notes-dot' + (noteText ? ' has-notes' : '') + '"></span>' +
        '<span class="day-toggle">&#9660;</span>' +
      '</div>' +
    '</div>' +
    '<div class="day-body">' + periodsHtml + tipHtml + notesHtml + '</div>' +
    '</div>';
}

function renderItem(item) {
  const cls  = item.type === 'booked' ? ' booked' : '';
  const tag  = item.type === 'booked' ? '<span class="tag tag-booked">BOOKED</span>' : '';
  const time = item.time ? '<div class="act-time">' + item.time + '</div>' : '<div class="act-time"></div>';
  const sub  = item.sub  ? '<div class="act-sub">' + item.text + '</div>' : '';
  const main = item.sub  ? '' : '<div class="act-text">' + item.text + tag + '</div>';
  return '<div class="act' + cls + '">' + time + '<div class="act-body">' + main + sub + '</div></div>';
}

// ── Render: Confirmations ─────────────────────────────────────
function renderConfirmations() {
  $('confirmations').innerHTML = [
    { key:'flights', title:'FLIGHTS' },
    { key:'hotels',  title:'HOTELS'  },
    { key:'trains',  title:'TRAINS & ACTIVITIES' },
  ].map(s =>
    '<div class="conf-group">' +
    '<div class="conf-group-title">' + s.title + '</div>' +
    (CONFIRMATIONS[s.key] || []).map(card =>
      '<div class="conf-card">' +
      '<div class="conf-name">' + card.name + '</div>' +
      '<div class="conf-number-row">' +
        '<span class="conf-number-label">' + card.number.label + '</span>' +
        '<span class="conf-number-val">' + card.number.val + '</span>' +
        '<button class="conf-copy-btn" onclick="copyConf(\'' + card.number.val.replace(/'/g,"\\'") + '\',this)">Copy</button>' +
      '</div>' +
      card.rows.map(r =>
        '<div class="conf-row"><span class="conf-key">' + r.k + '</span><span class="conf-val' + (r.mono ? ' mono' : '') + '">' + esc(r.v) + '</span></div>'
      ).join('') +
      '</div>'
    ).join('') +
    '</div>'
  ).join('');
}

async function copyConf(text, btn) {
  try {
    await navigator.clipboard.writeText(text);
    const orig = btn.textContent;
    btn.textContent = 'Copied!';
    btn.classList.add('copied');
    setTimeout(() => { btn.textContent = orig; btn.classList.remove('copied'); }, 1800);
  } catch {}
}

// ── Render: Checklist ─────────────────────────────────────────
function renderChecklist() {
  $('pretrip').innerHTML = CHECKLIST.map(section => {
    const total = section.items.length;
    const done  = section.items.filter(i => checks[i.id]).length;
    return '<div class="checklist-section">' +
      '<div class="checklist-title">' + section.section + '</div>' +
      '<div class="checklist-progress"><span>' + done + '</span> / ' + total + ' complete</div>' +
      section.items.map(item =>
        '<div class="check-item' + (checks[item.id] ? ' done' : '') + '" data-check="' + item.id + '">' +
          '<div class="check-box' + (checks[item.id] ? ' checked' : '') + '"></div>' +
          '<div><div class="check-label">' + esc(item.label) + '</div>' +
          (item.sub ? '<div class="check-sub">' + esc(item.sub) + '</div>' : '') +
          '</div></div>'
      ).join('') +
      '</div>';
  }).join('');

  document.querySelectorAll('.check-item').forEach(item => {
    item.addEventListener('click', () => toggleCheck(item.dataset.check));
  });
}

async function toggleCheck(id) {
  checks[id] = !checks[id];
  renderChecklist();
  if (currentUser) {
    try { await db.collection('checks').doc('all').set(checks); } catch {}
  } else {
    try { localStorage.setItem('japan-checks', JSON.stringify(checks)); } catch {}
  }
}

// ── Render: Budget ────────────────────────────────────────────
function renderBudget() {
  const bookings = bookingsData || [];
  let totalJPY = 0, totalUSD = 0;
  const byCat = {};
  bookings.forEach(b => {
    if (b.currency === 'JPY') { totalJPY += b.amt; byCat[b.cat] = (byCat[b.cat] || 0) + b.amt; }
    else totalUSD += b.amt;
  });
  const usdEst    = totalJPY / exchRate + totalUSD;
  const perPerson = usdEst / 2;
  const maxCat    = Math.max(...Object.values(byCat), 1);
  const liveBadge = rateIsLive ? '<span class="rate-live">Live</span>' : '';
  const canEdit   = !!currentUser;

  const bookingRows = bookings.map(b => {
    const amt = b.currency === 'JPY'
      ? '\u00a5' + Math.round(b.amt).toLocaleString()
      : '$' + Number(b.amt).toFixed(2);
    const editBtns = canEdit
      ? '<span class="booking-actions">' +
          '<button class="booking-edit-btn" onclick="openBookingModal(\'' + b.id + '\')">Edit</button>' +
          '<button class="booking-del-btn" onclick="deleteBooking(\'' + b.id + '\')">Del</button>' +
        '</span>'
      : '';
    return '<div class="booking-row">' +
      '<span class="booking-name">' + esc(b.name) + '</span>' +
      '<span class="booking-dates">' + esc(b.dates) + '</span>' +
      '<span class="booking-amt">' + amt + '</span>' +
      editBtns +
    '</div>';
  }).join('');

  const addBtn = canEdit
    ? '<button class="booking-add-btn" onclick="openBookingModal(null)">+ Add booking</button>'
    : '';

  const catBarsFixed = Object.entries(byCat).map(([cat, amt]) => {
    const pct   = Math.round((amt / maxCat) * 100);
    const color = BUDGET_CAT_COLORS[cat] || '#888';
    return '<div class="cat-bar-row">' +
      '<span class="cat-bar-label">' + cat + '</span>' +
      '<div class="cat-bar-track"><div class="cat-bar-fill" style="width:' + pct + '%;background:' + color + '"></div></div>' +
      '<span class="cat-bar-amt">\u00a5' + Math.round(amt).toLocaleString() + '</span>' +
    '</div>';
  }).join('');

  $('budget').innerHTML =
    '<div class="view-header"><div class="view-title">Budget</div><div class="view-subtitle">Confirmed bookings \u00b7 edit any entry when signed in</div></div>' +
    '<div class="rate-row"><span>1 USD =</span>' +
      '<input type="number" class="rate-input" id="rateInput" value="' + Math.round(exchRate) + '" min="50" max="300">' +
      '<span>JPY</span>' + liveBadge +
    '</div>' +
    '<div class="budget-cards">' +
      '<div class="budget-card"><div class="budget-card-num">\u00a5' + Math.round(totalJPY).toLocaleString() + '</div><div class="budget-card-lbl">Total JPY</div></div>' +
      '<div class="budget-card primary"><div class="budget-card-num">~$' + Math.round(usdEst).toLocaleString() + '</div><div class="budget-card-lbl">USD Estimate</div></div>' +
      '<div class="budget-card muted"><div class="budget-card-num">~$' + Math.round(perPerson).toLocaleString() + '</div><div class="budget-card-lbl">Per Person</div></div>' +
    '</div>' +
    '<div class="budget-section-hd">All Bookings</div>' +
    '<div class="booking-table">' + bookingRows + '</div>' +
    addBtn +
    (Object.keys(byCat).length
      ? '<div class="budget-section-hd" style="margin-top:24px">By Category (JPY)</div><div class="cat-bars">' + catBarsFixed + '</div>'
      : '');

  document.getElementById('rateInput').addEventListener('change', e => {
    const v = parseFloat(e.target.value);
    if (v > 0) { exchRate = v; rateIsLive = false; localStorage.setItem('japan-rate', v); renderBudget(); }
  });
}

// ── Bookings: load / save ─────────────────────────────────────
async function loadBookingsData() {
  try {
    const snap = await db.collection('meta').doc('bookings').get();
    bookingsData = snap.exists ? (snap.data().list || BUDGET_SEED) : BUDGET_SEED;
  } catch {
    bookingsData = BUDGET_SEED;
  }
  renderBudget();
}

async function saveBookingsData() {
  renderBudget();
  if (!currentUser) return;
  try { await db.collection('meta').doc('bookings').set({ list: bookingsData }); } catch {}
}

// ── Booking modal ─────────────────────────────────────────────
let editingBookingId = null;

function openBookingModal(id) {
  editingBookingId = id;
  const modal = $('bookingModal');
  const b = id ? bookingsData.find(x => x.id === id) : null;
  $('bm-name').value     = b ? b.name    : '';
  $('bm-dates').value    = b ? b.dates   : '';
  $('bm-amt').value      = b ? b.amt     : '';
  $('bm-currency').value = b ? b.currency: 'JPY';
  $('bm-cat').value      = b ? b.cat     : 'accommodation';
  $('bm-title').textContent = id ? 'Edit Booking' : 'Add Booking';
  modal.classList.add('open');
  setTimeout(() => $('bm-name').focus(), 60);
}

function closeBookingModal() {
  $('bookingModal').classList.remove('open');
  editingBookingId = null;
}

async function saveBooking() {
  const name = $('bm-name').value.trim();
  if (!name) { $('bm-name').style.outline = '2px solid var(--verm)'; return; }
  $('bm-name').style.outline = '';
  const entry = {
    id:       editingBookingId || ('bk-' + Date.now()),
    name,
    dates:    $('bm-dates').value.trim(),
    amt:      parseFloat($('bm-amt').value) || 0,
    currency: $('bm-currency').value,
    cat:      $('bm-cat').value,
  };
  if (editingBookingId) {
    bookingsData = bookingsData.map(b => b.id === editingBookingId ? entry : b);
  } else {
    bookingsData = [...bookingsData, entry];
  }
  closeBookingModal();
  await saveBookingsData();
}

async function deleteBooking(id) {
  if (!confirm('Remove this booking?')) return;
  bookingsData = bookingsData.filter(b => b.id !== id);
  await saveBookingsData();
}

// ── Render: Packing ───────────────────────────────────────────
function renderPacking() {
  const items = packingData ? packingData.items || [] : [];
  const done  = items.filter(i => i.done).length;
  const cats  = [...new Set(items.map(i => i.category))];
  const pct   = items.length ? Math.round((done / items.length) * 100) : 0;

  const signinNote = !currentUser
    ? '<div class="pack-signin-note">Sign in to save packing progress across devices.</div>'
    : '';

  const groupsHtml = cats.map(cat => {
    const ci   = items.filter(i => i.category === cat);
    const cd   = ci.filter(i => i.done).length;
    const cpct = ci.length ? Math.round((cd / ci.length) * 100) : 0;
    return '<div class="pack-group">' +
      '<div class="pack-group-hd">' +
        '<span class="pack-group-name">' + cat + '</span>' +
        '<div class="pack-group-meta">' +
          '<div class="pack-group-bar"><div class="pack-group-bar-fill" style="width:' + cpct + '%"></div></div>' +
          '<span class="pack-group-count">' + cd + '/' + ci.length + '</span>' +
        '</div>' +
      '</div>' +
      ci.map(item =>
        '<div class="pack-item' + (item.done ? ' done' : '') + '" data-id="' + item.id + '">' +
          '<input type="checkbox" class="pack-check" ' + (item.done ? 'checked' : '') + ' onchange="togglePackItem(\'' + item.id + '\')">' +
          '<span class="pack-text">' + esc(item.text) + '</span>' +
          '<button class="pack-del" onclick="deletePackItem(\'' + item.id + '\')">&#x2715;</button>' +
        '</div>'
      ).join('') +
      '<div class="pack-add-row">' +
        '<input type="text" class="pack-add-input" placeholder="Add to ' + cat + '\u2026" data-cat="' + cat + '" onkeydown="if(event.key===\'Enter\')addPackItem(this)">' +
        '<button class="pack-add-btn" onclick="addPackItem(this.previousElementSibling)">Add</button>' +
      '</div>' +
    '</div>';
  }).join('');

  const newCatHtml =
    '<div class="new-cat-row">' +
      '<input type="text" id="newCatInput" class="pack-add-input" style="flex:1" placeholder="New category name\u2026" onkeydown="if(event.key===\'Enter\')addPackCat()">' +
      '<button class="pack-add-btn" onclick="addPackCat()">+ Category</button>' +
    '</div>';

  $('packing').innerHTML =
    '<div class="view-header"><div class="view-title">Packing List</div><div class="view-subtitle">Check items off as you pack.</div></div>' +
    signinNote +
    '<div class="pack-overall"><div class="pack-overall-track"><div class="pack-overall-fill" style="width:' + pct + '%"></div></div><span class="pack-overall-text">' + done + ' / ' + items.length + ' packed</span></div>' +
    groupsHtml +
    newCatHtml;
}

async function togglePackItem(id) {
  if (!packingData) return;
  packingData.items = packingData.items.map(i => i.id === id ? { ...i, done: !i.done } : i);
  renderPacking();
  await savePackingData();
}

async function addPackItem(input) {
  const text = input.value.trim();
  const cat  = input.dataset.cat;
  if (!text || !packingData) return;
  packingData.items.push({ id: 'pk-' + Date.now(), text, category: cat, done: false });
  await savePackingData();
  input.value = '';
}

async function deletePackItem(id) {
  if (!packingData) return;
  packingData.items = packingData.items.filter(i => i.id !== id);
  await savePackingData();
}

async function addPackCat() {
  const input = document.getElementById('newCatInput');
  const cat   = input?.value?.trim();
  if (!cat || !packingData) return;
  packingData.items.push({ id: 'pk-' + Date.now(), text: '(add items here)', category: cat, done: false });
  await savePackingData();
  if (input) input.value = '';
}

async function savePackingData() {
  renderPacking();
  if (currentUser) {
    try { await db.collection('meta').doc('packing').set(packingData); } catch {}
  } else {
    try { localStorage.setItem('japan-packing', JSON.stringify(packingData)); } catch {}
  }
}

async function loadPackingData() {
  if (currentUser) {
    try {
      const snap = await db.collection('meta').doc('packing').get();
      packingData = snap.exists ? snap.data() : PACKING_SEED;
      if (!packingData.items) packingData = PACKING_SEED;
    } catch { packingData = PACKING_SEED; }
  } else {
    try {
      const saved = localStorage.getItem('japan-packing');
      packingData = saved ? JSON.parse(saved) : PACKING_SEED;
    } catch { packingData = PACKING_SEED; }
  }
  renderPacking();
}

// ── Search ────────────────────────────────────────────────────
searchInputEl.addEventListener('input', () => {
  const q = searchInputEl.value.trim().toLowerCase();
  let anyVisible = false;
  document.querySelectorAll('.day-card').forEach(card => {
    if (!q) { card.classList.remove('search-hidden'); anyVisible = true; return; }
    if (card.textContent.toLowerCase().includes(q)) {
      card.classList.remove('search-hidden');
      if (!card.classList.contains('expanded')) card.classList.add('expanded');
      anyVisible = true;
    } else {
      card.classList.add('search-hidden');
    }
  });
  document.querySelectorAll('.dest-section').forEach(sec => {
    const vis = [...sec.querySelectorAll('.day-card')].some(c => !c.classList.contains('search-hidden'));
    sec.style.display = vis || !q ? '' : 'none';
  });
  let noRes = document.getElementById('no-results');
  if (!anyVisible && q) {
    if (!noRes) {
      noRes = document.createElement('div');
      noRes.id = 'no-results'; noRes.className = 'no-results';
      noRes.textContent = 'No results found.';
      $('itinerary').appendChild(noRes);
    }
  } else if (noRes) noRes.remove();
});

// ── Tab switching ─────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    const showPills = btn.dataset.tab === 'itinerary';
    destPillsWrap.classList.toggle('hidden', !showPills);
    window.scrollTo(0, 0);
  });
});

// ── Auth ──────────────────────────────────────────────────────
authBtn.addEventListener('click', () => {
  if (currentUser) {
    auth.signOut();
  } else {
    authErrEl.textContent = '';
    overlay.classList.add('open');
  }
});
overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
authClose.addEventListener('click', () => overlay.classList.remove('open'));

googleSignInBtn.addEventListener('click', async () => {
  authErrEl.textContent = '';
  googleSignInBtn.textContent = 'Signing in\u2026';
  const provider = new firebase.auth.GoogleAuthProvider();
  try {
    const result = await auth.signInWithPopup(provider);
    const email  = result.user.email;
    if (!ALLOWED_EMAILS.includes(email)) {
      await auth.signOut();
      authErrEl.textContent = 'Access restricted to Gwen & Christina.';
      googleSignInBtn.textContent = 'Sign in with Google';
      return;
    }
    overlay.classList.remove('open');
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      authErrEl.textContent = 'Sign-in failed. Please try again.';
    }
    googleSignInBtn.textContent = 'Sign in with Google';
  }
});

auth.onAuthStateChanged(async user => {
  currentUser = user;
  if (user) {
    document.body.classList.add('edit-mode');
    authBtn.classList.add('signed-in');
    const firstName = (user.displayName || '').split(' ')[0] || 'Signed in';
    authBtnLabel.textContent = firstName;
    if (user.photoURL) userAvatarSm.src = user.photoURL;
    await loadAllNotes();
    await loadChecksFromDB();
    renderChecklist();
    refreshNoteDisplays();
    setupEditors();
    loadPackingData();
    loadBookingsData();
  } else {
    document.body.classList.remove('edit-mode');
    authBtn.classList.remove('signed-in');
    authBtnLabel.textContent = 'Sign in';
    userAvatarSm.src = '';
    refreshNoteDisplays();
    loadPackingData();
    // Use seed data for unsigned users
    if (!bookingsData) { bookingsData = BUDGET_SEED; renderBudget(); }
    else renderBudget(); // re-render to hide edit controls
  }
});

// ── Firestore: Notes ──────────────────────────────────────────
async function loadAllNotes() {
  await Promise.all(Object.keys(DAYS).map(async id => {
    try {
      const snap = await db.collection('notes').doc(id).get();
      if (snap.exists) notes[id] = snap.data().text || '';
    } catch {}
  }));
}

function refreshNoteDisplays() {
  document.querySelectorAll('.notes-read').forEach(el => {
    const ta = el.nextElementSibling;
    if (!ta) return;
    const dayId = ta.dataset.day;
    const text  = notes[dayId] || '';
    el.innerHTML = text
      ? text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')
      : '<em>No notes yet \u2014 sign in to add notes.</em>';
    const dot = document.querySelector('#card-' + dayId + ' .notes-dot');
    if (dot) dot.classList.toggle('has-notes', !!text);
  });
  document.querySelectorAll('.notes-edit').forEach(ta => { ta.value = notes[ta.dataset.day] || ''; });
}

function setupEditors() {
  document.querySelectorAll('.notes-edit').forEach(orig => {
    const ta = orig.cloneNode(true);
    orig.parentNode.replaceChild(ta, orig);
    ta.value = notes[ta.dataset.day] || '';
    let timer;
    ta.addEventListener('input', () => {
      clearTimeout(timer);
      const ind = document.getElementById('save-' + ta.dataset.day);
      if (ind) ind.textContent = 'Saving\u2026';
      timer = setTimeout(async () => {
        const dayId = ta.dataset.day;
        const text  = ta.value;
        notes[dayId] = text;
        const dot = document.querySelector('#card-' + dayId + ' .notes-dot');
        if (dot) dot.classList.toggle('has-notes', !!text);
        const readEl = ta.previousElementSibling;
        if (readEl) readEl.innerHTML = text
          ? text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')
          : '<em>No notes yet \u2014 sign in to add notes.</em>';
        try {
          await db.collection('notes').doc(dayId).set({ text, updatedAt: new Date() });
          if (ind) { ind.textContent = 'Saved'; setTimeout(() => { if (ind) ind.textContent = ''; }, 1800); }
        } catch { if (ind) ind.textContent = 'Could not save.'; }
      }, 900);
    });
  });
}

// ── Firestore: Checks ─────────────────────────────────────────
async function loadChecksFromDB() {
  try {
    const snap = await db.collection('checks').doc('all').get();
    if (snap.exists) Object.assign(checks, snap.data());
  } catch {}
}

// ── Helpers ───────────────────────────────────────────────────
function esc(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Load local state ──────────────────────────────────────────
try { Object.assign(checks, JSON.parse(localStorage.getItem('japan-checks') || '{}')); } catch {}
bookingsData = BUDGET_SEED; // will be replaced by Firestore on sign-in

// ── Init ──────────────────────────────────────────────────────
renderItinerary();
renderConfirmations();
renderChecklist();
renderBudget();
buildDestPills();
updateTripStatus();
updateClock();
fetchRate();

setInterval(updateClock, 30000);
setInterval(updateTripStatus, 60000);
window.addEventListener('scroll', updateActivePill, { passive: true });
