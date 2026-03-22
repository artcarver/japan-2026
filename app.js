import { initializeApp }                                                          from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, collection, addDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

// ── Firebase ──────────────────────────────────────────────────────────────────
const app = initializeApp({
  apiKey:            "AIzaSyBCIaluRd8u7M88DbL59Cs_6_sfcb86f0E",
  authDomain:        "japan-2026-gc.firebaseapp.com",
  projectId:         "japan-2026-gc",
  storageBucket:     "japan-2026-gc.firebasestorage.app",
  messagingSenderId: "661642949404",
  appId:             "1:661642949404:web:c6a554f3c243171d5a00d9",
});

const auth     = getAuth(app);
const db       = getFirestore(app);
const provider = new GoogleAuthProvider();
const ALLOWED  = ['ghstilson@gmail.com', 'cmelikian@gmail.com'];

// ── State ─────────────────────────────────────────────────────────────────────
let currentUser = null;
const notes  = {};
const checks = {};
let exchRate  = 159;

// Expense state
let expenses = [];
let expUnsub  = null;
let expFilter = 'all';
let localExpenses = [];

// Firestore-backed editable days
let firestoreDays = {};      // { '2026-04-15': { activities: [...] }, ... }
let daysUnsub     = null;
let currentEditDayId  = null;
let currentEditActId  = null;

// Drive folder URL (synced via Firestore settings doc)
let driveFolderUrl = '';

// ── Dates ─────────────────────────────────────────────────────────────────────
const TRIP_START = new Date('2026-04-15');
const TRIP_END   = new Date('2026-04-29T23:59:59');

const DAY_DATES = {
  apr15:new Date('2026-04-15'), apr16:new Date('2026-04-16'), apr17:new Date('2026-04-17'),
  apr18:new Date('2026-04-18'), apr19:new Date('2026-04-19'), apr20:new Date('2026-04-20'),
  apr21:new Date('2026-04-21'), apr22:new Date('2026-04-22'), apr23:new Date('2026-04-23'),
  apr24:new Date('2026-04-24'), apr25:new Date('2026-04-25'), apr26:new Date('2026-04-26'),
  apr27:new Date('2026-04-27'), apr28:new Date('2026-04-28'), apr29:new Date('2026-04-29'),
};

// ── Trip data ─────────────────────────────────────────────────────────────────
const DAYS = {
  apr15:{id:'apr15',date:'WED APR 15',title:'Depart Los Angeles',location:'LAX → HND Tokyo',periods:[
    {label:'Flight',items:[
      {time:'11:20 AM',text:'United UA 39 departs LAX',type:'booked'},
      {text:'Arrives HND Thursday April 16, 3:05 PM'},
      {text:'Boeing 787-10 Dreamliner · Economy (K) · Seats 31L & 31J',sub:true},
      {text:'Confirmation: F354LH',sub:true},
    ]},
  ],tip:'Get to LAX by 8:30 AM. Check in online beforehand. Settle in and adjust to the time zone.'},

  apr16:{id:'apr16',date:'THU APR 16',title:'Arrival Day',location:'Tokyo · Shinjuku',periods:[
    {label:'Afternoon',items:[
      {time:'3:05 PM',text:'Arrive HND · clear customs, collect bags',dur:'~90 min'},
      {text:'Tokyo Monorail or Keikyu Line → Shinjuku (~60–75 min)',sub:true},
      {time:'~5:30 PM',text:'Check in Hotel Gracery Shinjuku',type:'booked'},
      {text:'From 14:00 · Conf: 5594.831.309 · PIN: 6506',sub:true},
      {text:'Kabukicho 1-19-1, Shinjuku 160-0021',sub:true,addr:'Hotel Gracery Shinjuku, Kabukicho 1-19-1, Shinjuku, Tokyo'},
    ]},
    {label:'Evening — take it easy',items:[
      {time:'7:00 PM',text:'Omoide Yokocho (Memory Lane) · 5 min walk from hotel'},
      {text:'Tiny smoky yakitori stalls, beer — ease into Japan',sub:true},
      {time:'9:00 PM',text:'Wander Kabukicho · neon, arcades, vending machines'},
    ]},
  ],tip:'Jet lag will hit in waves. Keep tonight very light — you have four full days ahead.'},

  apr17:{id:'apr17',date:'FRI APR 17',title:'Art + Harajuku + Shibuya',location:'Tokyo · Shinjuku',periods:[
    {label:'Morning — teamLab Borderless',items:[
      {time:'8:15 AM',text:'Depart hotel · Metro Hibiya Line → Kamiyacho (Exit 5)'},
      {time:'8:30 AM',text:'teamLab Borderless · Azabudai Hills',type:'booked',dur:'~3 hrs'},
      {text:'¥5,600/person (~$35) · 2 tickets · no re-entry',sub:true},
      {text:'Wear pants (mirrored floors) · download teamLab app beforehand',sub:true},
      {text:'Hit Bubble Universe + Infinite Crystal World first · EN Tea House is extra',sub:true},
      {text:'Azabudai Hills Garden Plaza B, B1, 1-2-4 Azabudai, Minato-ku',sub:true,addr:'teamLab Borderless, Azabudai Hills, 1-2-4 Azabudai, Minato-ku, Tokyo'},
      {time:'11:30 AM',text:'Exit teamLab · explore Azabudai Hills complex'},
    ]},
    {label:'Afternoon — Harajuku',items:[
      {time:'12:30 PM',text:'Metro Hibiya Line → Meiji-Jingumae (Harajuku)'},
      {time:'1:00 PM',text:'Meiji Shrine · forested approach, very peaceful',dur:'~1 hr'},
      {text:'1-1 Yoyogikamizonocho, Shibuya-ku',sub:true,addr:'Meiji Shrine, Yoyogi, Shibuya, Tokyo'},
      {time:'2:30 PM',text:'Takeshita-dori · Harajuku street fashion, crepes'},
      {time:'3:30 PM',text:'Omotesando · tree-lined boulevard, flagship architecture'},
    ]},
    {label:'Evening — Shibuya',items:[
      {time:'5:30 PM',text:'Shibuya Scramble Crossing · view from above first, then walk through'},
      {time:'7:00 PM',text:'Dinner in Shibuya or Shimokitazawa · izakayas, wine bars'},
    ]},
  ],tip:'teamLab closes at 10 PM on Apr 17 (extended spring hours). 8:30 AM is the least crowded slot — crowds don\'t arrive until after 11 AM.'},

  apr18:{id:'apr18',date:'SAT APR 18',title:'Old Tokyo',location:'Asakusa · Yanaka · Akihabara',periods:[
    {label:'Morning — Asakusa',items:[
      {time:'7:30 AM',text:'Arrive Asakusa · Senso-ji before the crowds',dur:'~2 hrs'},
      {text:'Tour buses arrive by 10 AM — early light through incense smoke is worth it',sub:true},
      {text:'2-3-1 Asakusa, Taito-ku',sub:true,addr:'Senso-ji Temple, 2-3-1 Asakusa, Taito, Tokyo'},
      {time:'8:30 AM',text:'Nakamise-dori · ningyo-yaki, age-manju, melonpan'},
      {time:'9:30 AM',text:'Kappabashi-dori · restaurant supply street, plastic food models'},
    ]},
    {label:'Afternoon — Yanaka + Akihabara',items:[
      {time:'11:00 AM',text:'Yanaka · Tokyo\'s best-preserved traditional neighborhood',dur:'~1.5 hrs'},
      {text:'Yanaka Cemetery (cherry trees) · Yanaka Ginza covered shopping street',sub:true},
      {time:'1:00 PM',text:'Lunch in Yanaka · local tofu shops, small restaurants'},
      {time:'2:30 PM',text:'Akihabara · 15 min walk · electronics, retro games, arcade floors'},
    ]},
    {label:'Evening — Shinjuku',items:[
      {time:'7:00 PM',text:'Fuunji ramen · exceptional tsukemen · short queue likely',addr:'Fuunji Ramen, Nishi-Shinjuku, Tokyo'},
      {time:'8:30 PM',text:'Golden Gai · cluster of tiny themed bars (jazz, film, rock) · just wander in'},
    ]},
  ],tip:null},

  apr19:{id:'apr19',date:'SUN APR 19',title:'Kamakura Day Trip',location:'Tokyo → Kamakura (~1 hr)',periods:[
    {label:'Morning — Kita-Kamakura',items:[
      {time:'8:00 AM',text:'Depart Shinjuku · JR Shonan-Shinjuku Line → Kita-Kamakura (~1 hr · ¥920/~$6)'},
      {time:'9:15 AM',text:'Engaku-ji Temple · cedar forest, zen garden',dur:'~45 min',addr:'Engaku-ji, 409 Yamanouchi, Kamakura, Kanagawa'},
      {time:'10:00 AM',text:'Walk the trail south toward Kamakura (20–30 min scenic walk)'},
    ]},
    {label:'Afternoon — Kamakura',items:[
      {time:'11:00 AM',text:'Great Buddha · Kotoku-in · ¥300 (~$2) · enter the hollow statue',dur:'~1 hr',addr:'Kotoku-in Great Buddha, 4-2-28 Hase, Kamakura, Kanagawa'},
      {time:'12:00 PM',text:'Hase-dera Temple · ocean views, cave system · ¥400 (~$3)',dur:'~1 hr',addr:'Hase-dera Temple, 3-11-2 Hase, Kamakura, Kanagawa'},
      {time:'1:00 PM',text:'Lunch near Hase Station · shirasu (whitebait) dishes, a local specialty'},
      {time:'2:30 PM',text:'Optional: Tsurugaoka Hachimangu Shrine',addr:'Tsurugaoka Hachimangu, 2-1-31 Yukinoshita, Kamakura'},
    ]},
    {label:'Evening — Return + Luggage Forwarding',items:[
      {time:'4:00 PM',text:'Return to Shinjuku by 5:30 PM'},
      {time:'6:00 PM',text:'Arrange takkyubin at hotel front desk tonight',type:'booked'},
      {text:'Send luggage: Hotel Gracery Shinjuku → Hotel Granvia Kyoto',sub:true},
      {text:'Sent Apr 19 arrives Apr 21 · ~¥1,500–2,000/bag (~$10–13)',sub:true},
      {time:'7:30 PM',text:'Last dinner in Shinjuku'},
    ]},
  ],tip:'Weekends in Kamakura are busy — arriving before 10 AM puts you ahead of the tour groups.'},

  apr20:{id:'apr20',date:'MON APR 20',title:'Fuji Excursion → Kawaguchiko → Hakone',location:'Shinjuku → Kawaguchiko → Gora',periods:[
    {label:'Morning — Fuji Excursion',items:[
      {time:'8:30 AM',text:'Fuji-Excursion 7 departs Shinjuku',type:'booked'},
      {text:'¥8,400 total (~$53) · Car 3, Seats 13-C & 13-D · Res: E77821',sub:true},
      {time:'10:26 AM',text:'Arrive Kawaguchiko Station'},
    ]},
    {label:'Mid-Morning — Kawaguchiko',items:[
      {time:'10:30 AM',text:'Oishi Park · north shore · best Fuji reflections + late cherry blossoms',dur:'~1.5 hrs',addr:'Oishi Park, Kawaguchiko, Fujikawaguchiko, Yamanashi'},
      {time:'12:00 PM',text:'Optional: Chureito Pagoda (30 min to Fujiyoshida · ~400 steps)',addr:'Chureito Pagoda, Fujiyoshida, Yamanashi'},
      {text:'Iconic 5-story pagoda framing Fuji with blossoms',sub:true},
    ]},
    {label:'Afternoon — Transit to Hakone',items:[
      {time:'1:30 PM',text:'Bus via Gotemba → Gora (~2.5 hrs) · day bags only'},
      {time:'4:00 PM',text:'Check in Tensui Saryo · Gora, Hakone',type:'booked'},
      {text:'1320-276 Gora, Hakone-machi, Ashigarashimo-gun',sub:true,addr:'Tensui Saryo, Gora, Hakone, Ashigarashimo-gun, Kanagawa'},
      {text:'Reservation: IK1516984808 · check-in 15:00–21:30',sub:true},
    ]},
    {label:'Evening',items:[
      {time:'5:30 PM',text:'Ryokan · change into yukata, explore property, private onsen'},
      {time:'7:45 PM',text:'Kaiseki dinner at Tensui Saryo — 19:45',type:'booked'},
      {text:'Dinner and breakfast included · 10-course traditional kaiseki',sub:true},
    ]},
  ],tip:'Morning is the best window for Mt. Fuji views before clouds build. The train ride itself often offers Fuji sightlines.'},

  apr21:{id:'apr21',date:'TUE APR 21',title:'The Hakone Loop',location:'Gora → Owakudani → Lake Ashi',periods:[
    {label:'Morning — Open Air Museum + Ropeway',items:[
      {time:'9:00 AM',text:'Hakone Open Air Museum · opens 9 AM · ¥2,000 (~$13)',dur:'~2 hrs',addr:'Hakone Open Air Museum, 1121 Ninotaira, Hakone, Kanagawa'},
      {text:'10 min walk from ryokan · outdoor sculptures, Picasso Pavilion (300+ works), foot onsen inside',sub:true},
      {time:'11:00 AM',text:'Hakone Tozan Railway: Gora → Sounzan (10 min)'},
      {time:'11:15 AM',text:'Ropeway: Sounzan → Owakudani (~25 min) · Hakone Free Pass'},
      {text:'Best Fuji views in the morning before clouds build',sub:true},
    ]},
    {label:'Midday — Owakudani + Lake Ashi',items:[
      {time:'12:00 PM',text:'Owakudani volcanic valley · sulfur steam vents · black eggs',addr:'Owakudani, Hakone, Ashigarashimo-gun, Kanagawa'},
      {text:'¥500 for 5 eggs (~$3) · supposedly add 7 years per egg',sub:true},
      {time:'1:00 PM',text:'Ropeway → Togendai on Lake Ashi (~25 min)'},
      {time:'1:30 PM',text:'Lake Ashi sightseeing boat → Moto-Hakone (~30 min · Free Pass)',dur:'30 min'},
    ]},
    {label:'Afternoon — Hakone Shrine + Return',items:[
      {time:'2:30 PM',text:'Hakone Shrine · torii gate rising from the lake',dur:'~45 min',addr:'Hakone Shrine, 80-1 Motohakone, Hakone, Kanagawa'},
      {time:'3:30 PM',text:'Lunch near Moto-Hakone · tofu cuisine, soba'},
      {time:'5:00 PM',text:'Head back to Gora · Hakone Tozan Railway'},
      {time:'5:30 PM',text:'Tensui Saryo · private open-air onsen',dur:'~1.5 hrs'},
    ]},
    {label:'Evening',items:[
      {time:'7:45 PM',text:'Kaiseki dinner at Tensui Saryo — 19:45',type:'booked'},
    ]},
  ],tip:'Buy the Hakone Free Pass at Gora Station — covers Tozan Railway, ropeway, and Lake Ashi boat. ~¥4,000 (~$25) for 2 days.'},

  apr22:{id:'apr22',date:'WED APR 22',title:'Depart Hakone → Arrive Kyoto',location:'Gora → Odawara → Kyoto',periods:[
    {label:'Morning — Checkout + Shinkansen',items:[
      {time:'7:00 AM',text:'Breakfast at ryokan · included'},
      {time:'9:00 AM',text:'Check out Tensui Saryo · must leave by 9:00 AM'},
      {time:'9:05 AM',text:'Hakone Tozan Railway: Gora → Hakone-Yumoto (~35 min)'},
      {time:'9:45 AM',text:'Local train: Hakone-Yumoto → Odawara (~15 min)'},
      {time:'10:11 AM',text:'HIKARI 637 departs Odawara',type:'booked'},
      {text:'¥23,800 total (~$150) · Res: 2002 · Series N700 · seats TBD by email',sub:true},
      {time:'12:12 PM',text:'Arrive Kyoto Station',dur:'2 hrs 1 min'},
    ]},
    {label:'Afternoon — Arrive Kyoto',items:[
      {time:'12:15 PM',text:'Check in Hotel Granvia Kyoto',type:'booked'},
      {text:'JR Kyoto Station (Karasuma) · Conf: #23151SF060529',sub:true,addr:'Hotel Granvia Kyoto, JR Kyoto Station, 600-8216 Kyoto'},
      {text:'Luggage arriving from takkyubin (sent Apr 19)',sub:true},
      {time:'2:30 PM',text:'Fushimi Inari Taisha · 5 min by JR · FREE · open 24 hrs',addr:'Fushimi Inari Taisha, 68 Fukakusa Yabunouchicho, Fushimi-ku, Kyoto'},
      {text:'Preview visit — lower gates only · save energy for tomorrow 6 AM',sub:true},
    ]},
    {label:'Evening',items:[
      {time:'5:30 PM',text:'Nishiki Market · closes ~5:30 PM weekdays',addr:'Nishiki Market, Nishikikoji Street, Nakagyo-ku, Kyoto'},
      {time:'7:30 PM',text:'Dinner in Gion or Pontocho alley'},
    ]},
  ],tip:'Check out by 9 AM is essential. The full Fushimi Inari hike is tomorrow at 6 AM — the single most important timing decision of the Kyoto trip.'},

  apr23:{id:'apr23',date:'THU APR 23',title:'Fushimi Inari + Higashiyama',location:'Kyoto · Southern + Eastern Kyoto',periods:[
    {label:'Very Early Morning — Fushimi Inari',items:[
      {time:'5:45 AM',text:'JR Nara Line → Inari Station (5 min · ¥150/~$1)'},
      {time:'6:00 AM',text:'Fushimi Inari Taisha · FREE · open 24 hrs',dur:'~2.5 hrs',addr:'Fushimi Inari Taisha, 68 Fukakusa Yabunouchicho, Fushimi-ku, Kyoto'},
      {text:'By 8 AM it\'s crowded · by 10 AM shoulder-to-shoulder · 6 AM is transformative',sub:true},
      {text:'Full hike to summit and back ~2 hrs · Yotsutsuji crossroads has best views',sub:true},
      {time:'8:30 AM',text:'Descend · grab breakfast from street stalls outside entrance'},
    ]},
    {label:'Late Morning — Higashiyama',items:[
      {time:'10:00 AM',text:'Bus or taxi to Higashiyama district'},
      {time:'10:30 AM',text:'Ninenzaka + Sannenzaka · preserved stone-paved streets',dur:'~1 hr',addr:'Ninenzaka, Higashiyama-ku, Kyoto'},
      {time:'11:30 AM',text:'Kiyomizudera Temple · ¥500 (~$3)',dur:'~1 hr',addr:'Kiyomizudera, 1-294 Kiyomizu, Higashiyama-ku, Kyoto'},
    ]},
    {label:'Afternoon — Gion + Philosopher\'s Path',items:[
      {time:'1:00 PM',text:'Lunch in Higashiyama · tofu kaiseki, soba, or matcha cafe'},
      {time:'2:30 PM',text:'Gion district · Hanamikoji Street · watch for geiko/maiko',addr:'Hanamikoji Street, Gion, Higashiyama-ku, Kyoto'},
      {time:'4:00 PM',text:'Philosopher\'s Path · 2 km canal walk lined with cherry trees',dur:'~1 hr',addr:'Philosopher\'s Path, Sakyo-ku, Kyoto'},
      {time:'5:30 PM',text:'Nanzenji Temple · free grounds',addr:'Nanzenji, 86 Nanzenji Fukuchicho, Sakyo-ku, Kyoto'},
    ]},
    {label:'Evening',items:[
      {time:'7:00 PM',text:'Dinner in Gion or Pontocho · book in advance'},
    ]},
  ],tip:'6 AM at Fushimi Inari is the single best timing call of the Kyoto trip. The difference between 6 AM and 10 AM is serene vs. a crush of tourists.'},

  apr24:{id:'apr24',date:'FRI APR 24',title:'Arashiyama + Nishiki Market',location:'Kyoto · Western + Central',periods:[
    {label:'Early Morning — Arashiyama Bamboo Grove',items:[
      {time:'7:00 AM',text:'JR Sagano Line → Saga-Arashiyama (~15 min · ¥240/~$2)'},
      {time:'7:30 AM',text:'Arashiyama Bamboo Grove · FREE · open 24 hrs',dur:'~45 min',addr:'Arashiyama Bamboo Grove, Sagatenryuji, Ukyo-ku, Kyoto'},
      {text:'Tour groups arrive by 9 AM · 7:30 AM is dramatically quieter',sub:true},
      {time:'8:30 AM',text:'Tenryu-ji Temple · opens 8:30 AM · ¥500 (~$3) for garden',dur:'~1 hr',addr:'Tenryu-ji, 68 Sagatenryuji Susukinobabacho, Ukyo-ku, Kyoto'},
      {time:'9:30 AM',text:'Okochi-Sanso Villa · ¥1,000 (~$6) includes matcha + sweet',dur:'~45 min',addr:'Okochi Sanso Villa, Sagaogurayama, Ukyo-ku, Kyoto'},
    ]},
    {label:'Midday — Arashiyama',items:[
      {time:'11:00 AM',text:'Togetsukyo Bridge · iconic bridge over the Oi River',addr:'Togetsukyo Bridge, Sagatenryuji, Ukyo-ku, Kyoto'},
      {time:'11:30 AM',text:'Lunch · yudofu (hot tofu), matcha soba, or riverside cafe'},
    ]},
    {label:'Afternoon — Central Kyoto',items:[
      {time:'2:30 PM',text:'Nishiki Market · go before 3 PM · closes ~5:30 PM weekdays',dur:'~1 hr',addr:'Nishiki Market, Nishikikoji Street, Nakagyo-ku, Kyoto'},
      {text:'Kyoto\'s Kitchen · sakura-themed sweets in April · pickles · matcha soft serve',sub:true},
      {time:'4:00 PM',text:'Teramachi + Shinkyogoku shopping arcades · adjacent to Nishiki'},
    ]},
    {label:'Evening',items:[
      {time:'6:30 PM',text:'Gion at dusk · best light for wooden machiya architecture'},
      {time:'7:30 PM',text:'Dinner in Pontocho or Gion'},
    ]},
  ],tip:null},

  apr25:{id:'apr25',date:'SAT APR 25',title:'Nara Day Trip + Kinkaku-ji',location:'Kyoto → Nara → Northern Kyoto',periods:[
    {label:'Morning — Nara',items:[
      {time:'8:30 AM',text:'JR Nara Line: Kyoto → Nara (45 min · ¥760/~$5)'},
      {time:'9:30 AM',text:'Nara Park · hundreds of freely roaming deer',dur:'~30 min',addr:'Nara Park, Zoshicho, Nara'},
      {time:'10:00 AM',text:'Todai-ji Temple · world\'s largest wooden building · giant bronze Buddha',dur:'~1.5 hrs',addr:'Todai-ji, 406-1 Zoshicho, Nara'},
      {text:'¥600 (~$4) · UNESCO · genuinely awe-inspiring scale',sub:true},
      {time:'11:30 AM',text:'Kasuga Taisha Shrine · forest setting · lantern-lined paths',addr:'Kasuga Taisha, 160 Kasuganocho, Nara'},
      {time:'12:30 PM',text:'Lunch in Nara · kakinoha-zushi (persimmon-leaf sushi)'},
      {time:'2:00 PM',text:'Return to Kyoto'},
    ]},
    {label:'Afternoon — Northern Kyoto',items:[
      {time:'3:00 PM',text:'Kinkaku-ji (Golden Pavilion) · ¥500 (~$3)',addr:'Kinkaku-ji, 1 Kinkakujicho, Kita-ku, Kyoto'},
      {text:'Worth seeing once despite crowds · best on a clear afternoon',sub:true},
      {time:'4:00 PM',text:'Ryoan-ji Temple · world-famous rock garden · ¥600 (~$4)',dur:'~45 min',addr:'Ryoan-ji, 13 Ryoanji Goryonoshitacho, Ukyo-ku, Kyoto'},
    ]},
    {label:'Evening — Last Night in Kyoto',items:[
      {time:'7:00 PM',text:'Dinner · Kawaramachi or Shijo area · izakaya, sake bar, or splurge kaiseki'},
    ]},
  ],tip:'Saturdays in April are busy. Go to Nara before 10 AM and Kinkaku-ji after 3 PM when tour buses thin out. Golden Week starts April 29 — you leave just in time.'},

  apr26:{id:'apr26',date:'SUN APR 26',title:'Depart Kyoto → Kanazawa',location:'Kyoto → Kanazawa',periods:[
    {label:'Morning — Checkout',items:[
      {time:'10:00 AM',text:'Check out Hotel Granvia Kyoto',type:'booked'},
    ]},
    {label:'Transit to Kanazawa',items:[
      {text:'Thunderbird Limited Express: Kyoto → Kanazawa (~2 hrs · ~¥6,000–7,000/~$38–44)'},
      {text:'Multiple departures · check timetable · aim for mid-morning',sub:true},
    ]},
    {label:'Afternoon — Arrive Kanazawa',items:[
      {time:'3:00 PM',text:'Check in Hotel Intergate Kanazawa',type:'booked'},
      {text:'2-5 Takaokamachi, Kanazawa · breakfast buffet included',sub:true,addr:'Hotel Intergate Kanazawa, 2-5 Takaokamachi, Kanazawa, Ishikawa'},
      {time:'4:30 PM',text:'Higashi Chaya District · Japan\'s best-preserved geisha quarter outside Kyoto',dur:'~1.5 hrs',addr:'Higashi Chaya District, Higashiyama, Kanazawa, Ishikawa'},
    ]},
    {label:'Evening',items:[
      {time:'7:00 PM',text:'Dinner · Nodoguro (blackthroat seaperch), sweet shrimp · Korinbo area'},
    ]},
  ],tip:null},

  apr27:{id:'apr27',date:'MON APR 27',title:'Kanazawa Full Day',location:'Kenroku-en · 21st Century Museum · Omicho',periods:[
    {label:'Morning — Kenroku-en + Castle',items:[
      {time:'7:00 AM',text:'Kenroku-en Garden · opens 7 AM · ¥320 (~$2)',dur:'~1.5 hrs',addr:'Kenroku-en, 1 Kenrokumachi, Kanazawa, Ishikawa'},
      {text:'One of Japan\'s three great gardens · Kasumigaike Pond + Kotojitoro lantern',sub:true},
      {text:'Free early entry from 4 AM through Mayumizaka Gate',sub:true},
      {time:'8:30 AM',text:'Kanazawa Castle Park · directly adjacent · free grounds',addr:'Kanazawa Castle, 1-1 Marunouchi, Kanazawa, Ishikawa'},
    ]},
    {label:'Mid-Morning — 21st Century Museum',items:[
      {time:'10:00 AM',text:'21st Century Museum of Contemporary Art · opens 10 AM',dur:'~1.5 hrs',addr:'21st Century Museum, 1-2-1 Hirosaka, Kanazawa, Ishikawa'},
      {text:'Free exchange zone · ~¥1,400 (~$9) for exhibitions',sub:true},
      {text:'CLOSED MONDAYS — verify before visiting · kanazawa21.jp',sub:true},
      {text:'Swimming Pool (Leandro Erlich) + Blue Planet Sky (James Turrell)',sub:true},
    ]},
    {label:'Afternoon — Omicho + Nagamachi',items:[
      {time:'12:00 PM',text:'Omicho Market · Kanazawa\'s kitchen · 9 AM – 5 PM',dur:'~1.5 hrs',addr:'Omicho Market, 50 Kami-Omicho, Kanazawa, Ishikawa'},
      {text:'Kaisendon (seafood rice bowl) · arrive by noon before lines grow',sub:true},
      {text:'Popular items sell out before noon — arrive early',sub:true},
      {time:'2:00 PM',text:'Nagamachi Samurai District · Nomura Clan House · ¥550 (~$4)',addr:'Nagamachi Samurai District, Nagamachi, Kanazawa, Ishikawa'},
    ]},
    {label:'Evening',items:[
      {time:'6:30 PM',text:'Dinner · Kanazawa seafood · Nodoguro, crab, sweet shrimp'},
    ]},
  ],tip:'Apr 27 is Monday — the 21st Century Museum is typically closed. Verify on their website. If closed, add more time at Kenroku-en or visit Nagamachi Yuzen-kan.'},

  apr28:{id:'apr28',date:'TUE APR 28',title:'Depart Kanazawa → Tokyo Ginza',location:'Kanazawa → Tokyo · Ginza',periods:[
    {label:'Morning — Checkout + Shinkansen',items:[
      {time:'8:00 AM',text:'Breakfast buffet at Hotel Intergate · included'},
      {time:'10:00 AM',text:'Check out · by 11:00 AM'},
      {text:'Hokuriku Shinkansen: Kanazawa → Tokyo (Ueno) · ~2.5 hrs · ~¥14,000 (~$88)',sub:true},
    ]},
    {label:'Afternoon — Arrive Tokyo Ginza',items:[
      {time:'3:00 PM',text:'Check in Quintessa Hotel Tokyo Ginza',type:'booked'},
      {text:'Conf: 6519361226 · PIN: 9235 · breakfast included',sub:true,addr:'Quintessa Hotel Tokyo Ginza, 4-11-4 Ginza, Chuo-ku, Tokyo'},
      {time:'2:30 PM',text:'Hamarikyu Gardens · ¥300 (~$2) · traditional garden on Tokyo Bay',dur:'~1 hr',addr:'Hamarikyu Gardens, 1-1 Hamarikyuteien, Chuo-ku, Tokyo'},
      {time:'4:00 PM',text:'Ginza main streets · Itoya stationery · Ginza Six · window shopping'},
    ]},
    {label:'Evening — Final Night',items:[
      {time:'6:30 PM',text:'Tsukiji Outer Market area for dinner · sushi, grilled seafood, sake bars',addr:'Tsukiji Outer Market, 4-16-2 Tsukiji, Chuo-ku, Tokyo'},
      {time:'8:00 PM',text:'Ginza evening stroll · excellent last night in Japan'},
    ]},
  ],tip:'Pack tonight and confirm you have everything. Flight departs HND at 6:10 PM tomorrow — leave the hotel by 12:30 PM.'},

  apr29:{id:'apr29',date:'WED APR 29',title:'Final Morning + Depart',location:'Tokyo Ginza → HND → LAX',periods:[
    {label:'Morning — Tsukiji Farewell',items:[
      {time:'7:30 AM',text:'Tsukiji Outer Market · 10 min walk · classic Tokyo farewell breakfast',dur:'~1.5 hrs',addr:'Tsukiji Outer Market, 4-16-2 Tsukiji, Chuo-ku, Tokyo'},
      {text:'Fresh sushi, tamagoyaki, grilled scallops, matcha · best before 10 AM',sub:true},
      {time:'10:00 AM',text:'Return to hotel · collect luggage'},
    ]},
    {label:'Afternoon — Depart',items:[
      {time:'12:30 PM',text:'Depart hotel for Haneda Airport · no later than 12:30 PM'},
      {text:'Keikyu Line from Higashi-Ginza → HND Terminal 3 (~30 min · ¥300/~$2)',sub:true},
      {text:'Allow 2.5–3 hours before departure for international check-in + security',sub:true},
      {time:'6:10 PM',text:'United UA 38 departs HND',type:'booked'},
      {text:'HND → LAX · 10 hrs 5 min · Seats 31J & 31L · Conf: F354LH',sub:true},
      {text:'Arrives LAX Wednesday April 29, 12:15 PM (same day, crossing date line)',sub:true},
    ]},
  ],tip:'Golden Week begins today — you\'re flying out. Well timed. Allow 3 hours at the airport.'},
};

const GROUPS = [
  {label:'TOKYO',                dates:'APR 15–20', ids:['apr15','apr16','apr17','apr18','apr19'], color:'#4A90D9'},
  {label:'KAWAGUCHIKO · HAKONE', dates:'APR 20–22', ids:['apr20','apr21'],                        color:'#27AE60'},
  {label:'KYOTO',                dates:'APR 22–26', ids:['apr22','apr23','apr24','apr25'],         color:'#E91E8C'},
  {label:'KANAZAWA',             dates:'APR 26–28', ids:['apr26','apr27'],                        color:'#F39C12'},
  {label:'TOKYO · GINZA',        dates:'APR 28–29', ids:['apr28','apr29'],                        color:'#4A90D9'},
];

// ── Overview data ─────────────────────────────────────────────────────────────
const OVERVIEW_DATA = [
  {
    city: 'Tokyo', dates: 'Apr 16–20', nights: 4,
    hotel: 'Hotel Gracery Shinjuku · Kabukicho, Shinjuku',
    highlights: [
      { text: 'teamLab Borderless — immersive digital art filling entire rooms', star: true, url: 'https://borderless.teamlab.art/en/' },
      { text: 'Senso-ji Temple at dawn — incense smoke and empty lantern-lit corridors', star: true },
      { text: 'Shibuya Scramble Crossing — the world\'s busiest intersection' },
      { text: 'Golden Gai — forty tiny themed bars, each seating about eight people' },
    ],
    daytrips: [
      { label: 'Day trip', city: 'Kamakura', note: '45 min by train', highlights: [
        { text: '13th-century Great Buddha (Kotoku-in)', star: true, url: 'https://maps.app.goo.gl/4t9v9fT6GHzKCpYcA' },
        { text: 'Hase-dera Temple — ocean views, cave system, 11,000 Jizo statues' },
        { text: 'Shirasu (whitebait) lunch — the Kamakura specialty' },
      ]},
    ],
  },
  {
    city: 'Kawaguchiko', dates: 'Apr 20 · morning only', nights: 0,
    hotel: 'Transit stop en route to Hakone',
    waypoint: true,
    highlights: [
      { text: 'Oishi Park — Mt. Fuji reflected in the lake with cherry blossoms', star: true, url: 'https://maps.app.goo.gl/oishipark' },
      { text: 'Optional: Chureito Pagoda — iconic 5-story pagoda framing Fuji from above' },
    ],
    daytrips: [],
  },
  {
    city: 'Hakone', dates: 'Apr 20–22', nights: 2,
    hotel: 'Tensui Saryo Ryokan · Gora · private outdoor onsen',
    highlights: [
      { text: 'Private rotenburo on the deck — a hot spring under the stars at midnight', star: true },
      { text: '10-course kaiseki dinner both evenings', star: true },
      { text: 'Owakudani volcanic ropeway — active sulfur craters and black eggs', url: 'https://www.hakoneropeway.co.jp/en/' },
      { text: 'Lake Ashi boat cruise — torii gate rising from the water at Hakone Shrine' },
    ],
    daytrips: [
      { label: 'En route', city: 'Mt. Fuji area', note: 'Oishi Park, Kawaguchiko', highlights: [
        { text: 'Fuji reflected in the lake with cherry blossoms in the foreground', star: true, url: 'https://maps.app.goo.gl/oishipark' },
      ]},
    ],
  },
  {
    city: 'Kyoto', dates: 'Apr 22–26', nights: 4,
    hotel: 'Hotel Granvia Kyoto · connected to Kyoto Station',
    highlights: [
      { text: 'Fushimi Inari at 6 AM — 10,000 vermilion torii gates, empty at dawn', star: true, url: 'https://inari.jp/en/' },
      { text: 'Arashiyama bamboo grove at 7:30 AM — before the tour groups arrive', star: true },
      { text: 'Gion at dusk — wooden alleyways, lantern glow, chance to spot a geiko' },
      { text: "Philosopher’s Path — 2 km canal walk lined with cherry trees" },
    ],
    daytrips: [],
  },
  {
    city: 'Nara', dates: 'Apr 25 · day trip', nights: 0,
    hotel: 'Day trip from Kyoto · 45 min by JR Nara Line',
    waypoint: true,
    highlights: [
      { text: 'Hundreds of freely roaming deer roaming freely through Nara Park', star: true },
      { text: 'Todai-ji — the world\'s largest wooden building, giant bronze Buddha inside', star: true, url: 'https://www.todaiji.or.jp/english/' },
      { text: 'Kasuga Taisha Shrine — 3,000 stone and bronze lanterns, forested paths', url: 'https://maps.app.goo.gl/kasuga' },
    ],
    daytrips: [],
  },
  {
    city: 'Osaka', dates: 'Apr 24 · day trip', nights: 0,
    hotel: 'Day trip from Kyoto · 30 min by JR Shinkaisoku',
    waypoint: true,
    highlights: [
      { text: 'Kaiyukan Aquarium — whale sharks in a four-storey Pacific Ocean tank', star: true, url: 'https://www.kaiyukan.com/language/eng/' },
      { text: 'Dotonbori — neon food street, takoyaki, the Glico Running Man sign', star: true },
      { text: 'Kuromon Ichiba Market — 580m covered market, fresh scallops and crab', url: 'https://kuromon.com/en/' },
      { text: 'Osaka Castle — 16th century, museum inside, beautiful grounds', url: 'https://www.osakacastle.net/english/' },
    ],
    daytrips: [],
  },  },
  {
    city: 'Kanazawa', dates: 'Apr 26–28', nights: 2,
    hotel: 'Hotel Intergate Kanazawa · breakfast included',
    highlights: [
      { text: 'Kenroku-en — one of Japan\'s three designated great gardens', star: true, url: 'https://kenrokuen.or.jp/en/' },
      { text: 'Omicho Market — the freshest seafood rice bowls you\'ll find anywhere', star: true },
      { text: 'Higashi Chaya geisha district — better preserved than Kyoto, without the crowds' },
      { text: '21st Century Museum — a room where you stand inside a swimming pool', url: 'https://www.kanazawa21.jp/en/' },
    ],
    daytrips: [],
  },
  {
    city: 'Tokyo · Ginza', dates: 'Apr 28–29', nights: 1,
    hotel: 'Quintessa Hotel Ginza · breakfast included',
    highlights: [
      { text: 'Tsukiji Outer Market farewell breakfast — fresh sushi and grilled scallops at dawn', star: true },
      { text: 'Hamarikyu Gardens — a traditional garden on Tokyo Bay, herons in the ponds' },
      { text: 'Ginza evening — Itoya stationery, farewell dinner, then the flight home' },
    ],
    daytrips: [],
  },
];

let ovCountdownTimer = null;

// ── Render: Overview ──────────────────────────────────────────────────────────
function renderOverview() {
  const ovEl = document.getElementById('overview');
  if (!ovEl) return;

  function cdHtml() {
    const now = new Date();
    const T0 = new Date('2026-04-15T00:00:00');
    const T1 = new Date('2026-04-29T23:59:59');
    if (now < T0) {
      const days = Math.ceil((T0 - now) / 86400000);
      return `<span class="ov-cd-num">${days}</span>
              <span class="ov-cd-label">${days === 1 ? 'day until Japan' : 'days until Japan'}</span>`;
    }
    if (now <= T1) {
      const day = Math.floor((now - T0) / 86400000) + 1;
      const SEG = [
        { s: new Date('2026-04-15T00:00:00'), e: new Date('2026-04-16T00:00:00'), city: 'Traveling to Japan' },
        { s: new Date('2026-04-16T00:00:00'), e: new Date('2026-04-20T00:00:00'), city: 'Tokyo' },
        { s: new Date('2026-04-20T00:00:00'), e: new Date('2026-04-22T00:00:00'), city: 'Hakone' },
        { s: new Date('2026-04-22T00:00:00'), e: new Date('2026-04-26T00:00:00'), city: 'Kyoto' },
        { s: new Date('2026-04-26T00:00:00'), e: new Date('2026-04-28T00:00:00'), city: 'Kanazawa' },
        { s: new Date('2026-04-28T00:00:00'), e: new Date('2026-04-30T00:00:00'), city: 'Tokyo · Ginza' },
      ];
      const seg = SEG.find(s => now >= s.s && now < s.e);
      return `<div class="ov-cd-live">
        <div class="ov-cd-dot"></div>
        <span class="ov-cd-city">${seg?.city ?? 'Japan'}</span>
        <span class="ov-cd-label">Day ${day} of 15</span>
      </div>`;
    }
    return `<span class="ov-cd-done">April 15–29, 2026</span>`;
  }

  const journeyHtml = OVERVIEW_DATA.map((stop, i) => {
    const isLast = i === OVERVIEW_DATA.length - 1;
    const isWaypoint = stop.waypoint === true;

    const hlsHtml = stop.highlights.map(h => `
      <li class="ov-hl${h.star ? ' ov-hl-star' : ''}">
        ${h.url
          ? `<a href="${h.url}" target="_blank" rel="noopener" class="ov-hl-link">${h.text}<span class="ov-ext"> ↗</span></a>`
          : h.text}
      </li>`).join('');

    if (isWaypoint) {
      return `
        <div class="ov-stop ov-stop-waypoint${isLast ? ' ov-stop-last' : ''}">
          <div class="ov-stop-left">
            <div class="ov-stop-dot ov-stop-dot-sm"></div>
            ${!isLast ? '<div class="ov-stop-line"></div>' : ''}
          </div>
          <div class="ov-stop-right ov-stop-right-wp">
            <div class="ov-stop-head">
              <div class="ov-wp-badge">Day trip</div>
              <div class="ov-stop-city ov-wp-city">${stop.city}</div>
              <div class="ov-stop-dates">${stop.dates.split(' · ')[0]}</div>
            </div>
            <div class="ov-stop-hotel">${stop.hotel}</div>
            <ul class="ov-hls">${hlsHtml}</ul>
          </div>
        </div>`;
    }

    const dtsHtml = stop.daytrips.map(dt => `
      <div class="ov-dt">
        <div class="ov-dt-head">
          <span class="ov-dt-label">${dt.label}</span>
          <span class="ov-dt-city">${dt.city}</span>
          ${dt.note ? `<span class="ov-dt-note">· ${dt.note}</span>` : ''}
        </div>
        <ul class="ov-dt-hls">
          ${dt.highlights.map(h => `
            <li class="ov-hl${h.star ? ' ov-hl-star' : ''}">
              ${h.url
                ? `<a href="${h.url}" target="_blank" rel="noopener" class="ov-hl-link">${h.text}<span class="ov-ext"> ↗</span></a>`
                : h.text}
            </li>`).join('')}
        </ul>
      </div>`).join('');

    return `
      <div class="ov-stop${isLast ? ' ov-stop-last' : ''}">
        <div class="ov-stop-left">
          <div class="ov-stop-dot"></div>
          ${!isLast ? '<div class="ov-stop-line"></div>' : ''}
        </div>
        <div class="ov-stop-right">
          <div class="ov-stop-head">
            <div class="ov-stop-city">${stop.city}</div>
            <div class="ov-stop-dates">${stop.dates} · ${stop.nights} night${stop.nights > 1 ? 's' : ''}</div>
          </div>
          <div class="ov-stop-hotel">${stop.hotel}</div>
          <ul class="ov-hls">${hlsHtml}</ul>
          ${dtsHtml}
        </div>
      </div>`;
  }).join('');

  ovEl.innerHTML = `
    <div class="ov-wrap">
      <div class="ov-hero">
        <span class="ov-kana">日 &nbsp; 本</span>
        <h1 class="ov-title">Japan 2026</h1>
        <p class="ov-who">Gwendalynn &amp; Christina</p>
        <div class="ov-cd" id="ovCd">${cdHtml()}</div>
        <p class="ov-meta">April 15–29 &nbsp;·&nbsp; 15 days &nbsp;·&nbsp; 5 cities &nbsp;·&nbsp; 3 day trips</p>
      </div>

      <div class="ov-section-label">Where we’re going</div>

      <div class="ov-journey">${journeyHtml}</div>

      <div class="ov-cta-row">
        <button class="ov-cta" id="ovItinBtn">See full day-by-day itinerary →</button>
      </div>
    </div>`;

  // Wire up the CTA button
  document.getElementById('ovItinBtn')?.addEventListener('click', () => {
    document.querySelector('[data-tab="itinerary"]')?.click();
  });

  // Live countdown tick for days/hours view
  if (ovCountdownTimer) clearInterval(ovCountdownTimer);
  const now = new Date();
  const T0cd = new Date('2026-04-15T00:00:00');
  const T1cd = new Date('2026-04-29T23:59:59');
  if (now < T0cd || (now >= T0cd && now <= T1cd)) {
    ovCountdownTimer = setInterval(() => {
      const el = document.getElementById('ovCd');
      if (el) el.innerHTML = cdHtml();
    }, 1000);
  }
}


// ── Confirmations ─────────────────────────────────────────────────────────────
const CONFIRMATIONS = {
  flights:[
    {name:'Outbound · LAX → Tokyo HND',
     number:{label:'Confirmation',val:'F354LH'},
     rows:[
       {k:'Flight',   v:'United UA 39'},
       {k:'Date',     v:'Wed April 15, 2026'},
       {k:'Departs',  v:'LAX 11:20 AM'},
       {k:'Arrives',  v:'HND Thu April 16, 3:05 PM'},
       {k:'Duration', v:'11 hrs 45 min'},
       {k:'Seats',    v:'31L (Gwendalynn)  ·  31J (Christina)'},
       {k:'Aircraft', v:'Boeing 787-10 Dreamliner · Economy (K)'},
     ]},
    {name:'Return · Tokyo HND → LAX',
     number:{label:'Confirmation',val:'F354LH'},
     rows:[
       {k:'Flight',   v:'United UA 38'},
       {k:'Date',     v:'Wed April 29, 2026'},
       {k:'Departs',  v:'HND 6:10 PM'},
       {k:'Arrives',  v:'LAX 12:15 PM same day'},
       {k:'Duration', v:'10 hrs 5 min'},
       {k:'Seats',    v:'31J (Gwendalynn)  ·  31L (Christina)'},
       {k:'Aircraft', v:'Boeing 787-10 Dreamliner · Economy (K)'},
     ]},
  ],
  hotels:[
    {name:'Hotel Gracery Shinjuku · Tokyo',
     number:{label:'Confirmation',val:'5594.831.309'},
     rows:[
       {k:'Check-in',  v:'Thu Apr 16 from 14:00'},
       {k:'Check-out', v:'Mon Apr 20 by 11:00  (4 nights)'},
       {k:'Room',      v:'Standard Twin Room — Non-Smoking'},
       {k:'PIN',       v:'6506',mono:true},
       {k:'Address',   v:'Kabukicho 1-19-1, Shinjuku, Tokyo 160-0021',addr:'Hotel Gracery Shinjuku, Kabukicho 1-19-1, Shinjuku, Tokyo'},
       {k:'Phone',     v:'+81 3 6833 1111'},
       {k:'Price',     v:'~¥200,692 (~$1,261)'},
       {k:'Cancel',    v:'Free 1 day before · no-show = full charge'},
       {k:'Note',      v:'Godzilla Head terrace (8F) currently suspended'},
     ]},
    {name:'Tensui Saryo · Gora, Hakone',
     number:{label:'Reservation',val:'IK1516984808'},
     rows:[
       {k:'Check-in',    v:'Mon Apr 20, 15:00–21:30  (est. arrival 17:30)'},
       {k:'Check-out',   v:'Wed Apr 22 by 10:00  (2 nights)'},
       {k:'Room',        v:'Detached Type-A · Onsen + Foot Bath · Japanese-Western'},
       {k:'Plan',        v:'Early Bird 20 × Basic Kaiseki · Dinner 19:45 · Breakfast included'},
       {k:'Verification',v:'0F35443D931C12B',mono:true},
       {k:'Address',     v:'1320-276 Gora, Hakone-machi',addr:'Tensui Saryo, Gora, Hakone, Kanagawa'},
       {k:'Phone',       v:'+81-570-062-302'},
       {k:'Price',       v:'¥126,340 (~$794) incl. tax'},
       {k:'Cancel',      v:'Free until 8 days before · 30% from 7 days · 50% from 2 · 80% same day'},
       {k:'Access',      v:'2–3 min walk from Gora Station (Hakone Tozan Railway)'},
     ]},
    {name:'Hotel Granvia Kyoto',
     number:{label:'Confirmation',val:'#23151SF060529'},
     rows:[
       {k:'Check-in',  v:'Wed Apr 22, 2026'},
       {k:'Check-out', v:'Sun Apr 26, 2026  (4 nights)'},
       {k:'Room',      v:'Granvia Deluxe Twin Room — Non-Smoking'},
       {k:'Address',   v:'JR Kyoto Station (Karasuma), 600-8216 Kyoto',addr:'Hotel Granvia Kyoto, JR Kyoto Station, Kyoto'},
       {k:'Phone',     v:'+81-75-344-8888'},
       {k:'Price',     v:'¥268,256 (~$1,686) total incl. tax and service'},
       {k:'Rates',     v:'Apr 22–23: ¥62,814/night · Apr 24: ¥67,064 · Apr 25: ¥75,564'},
       {k:'Acc. tax',  v:'~¥4,000/person/night · not included · pay at hotel'},
       {k:'Cancel',    v:'Notify by 16:00 JST day before or full night charge'},
       {k:'Luggage',   v:'Takkyubin arriving from Gracery Shinjuku (sent Apr 19, arrives Apr 21)'},
     ]},
    {name:'Hotel Intergate Kanazawa',
     number:{label:'Confirmation',val:'20260125110822242'},
     rows:[
       {k:'Check-in',  v:'Sun Apr 26 from 15:00'},
       {k:'Check-out', v:'Tue Apr 28 by 11:00  (2 nights)'},
       {k:'Room',      v:'Superior Twin Room — Non-Smoking'},
       {k:'Amenities', v:'Breakfast Buffet included'},
       {k:'Expedia',   v:'73356721260247',mono:true},
       {k:'Address',   v:'2-5 Takaokamachi, Kanazawa, Ishikawa 920-0864',addr:'Hotel Intergate Kanazawa, 2-5 Takaokamachi, Kanazawa'},
       {k:'Price',     v:'¥39,004 (~$245) total incl. taxes · pay at property'},
       {k:'Cancel',    v:'Free until Apr 22, 11:59 PM · 100% charge after'},
     ]},
    {name:'Quintessa Hotel Tokyo Ginza',
     number:{label:'Confirmation',val:'6519361226'},
     rows:[
       {k:'Check-in',  v:'Tue Apr 28 from 15:00'},
       {k:'Check-out', v:'Wed Apr 29 by 11:00  (1 night)'},
       {k:'Room',      v:'Hollywood Twin Room'},
       {k:'Amenities', v:'Breakfast included'},
       {k:'PIN',       v:'9235',mono:true},
       {k:'Address',   v:'Chuo-ku Ginza 4-11-4, Tokyo',addr:'Quintessa Hotel Tokyo Ginza, 4-11-4 Ginza, Chuo, Tokyo'},
       {k:'Phone',     v:'+81 3-6264-1351'},
       {k:'Price',     v:'¥24,713 (~$155) · charged Apr 25 to card on file'},
       {k:'Cancel',    v:'Free until Apr 26, 11:59 PM JST · 100% charge after'},
     ]},
  ],
  trains:[
    {name:'Fuji-Excursion 7 · Shinjuku → Kawaguchiko',
     number:{label:'Reservation',val:'E77821'},
     rows:[
       {k:'Date',        v:'Monday April 20, 2026'},
       {k:'Route',       v:'Shinjuku 8:30 AM → Kawaguchiko 10:26 AM'},
       {k:'Seats',       v:'Car 3, Seat 13-C (Gwendalynn)  ·  Seat 13-D (Christina)'},
       {k:'Pickup code', v:'24492390994521288',mono:true},
       {k:'Fare',        v:'¥8,400 (~$53) total for 2 adults'},
       {k:'Ticket',      v:'Pick up at ticket machine using QR code or pickup code before travel day'},
     ]},
    {name:'Shinkansen HIKARI 637 · Odawara → Kyoto',
     number:{label:'Reservation',val:'2002'},
     rows:[
       {k:'Train',      v:'HIKARI 637 · Series N700 · 16 cars · Ordinary'},
       {k:'Date',       v:'Wednesday April 22, 2026'},
       {k:'Route',      v:'Odawara 10:11 AM → Kyoto 12:12 PM'},
       {k:'Membership', v:'9007241665',mono:true},
       {k:'Fare',       v:'¥23,800 (~$150) total · smart EX'},
       {k:'Seats',      v:'TBD · email notification after Mar 22, 2026 at 8:00 AM'},
       {k:'Note',       v:'Shinkansen only — cannot board conventional lines with this ticket'},
     ]},
  ],
};


// ── Checklist ─────────────────────────────────────────────────────────────────
const CHECKLIST = [
  {id:'booked', title:'BOOKED — all done', booked:true, items:[
    {id:'c1', label:'United flights (UA 39 + UA 38)',             sub:'Conf: F354LH · seats 31L/31J'},
    {id:'c2', label:'Hotel Gracery Shinjuku',                     sub:'4 nights · Apr 16–20'},
    {id:'c3', label:'teamLab Borderless tickets',                 sub:'Apr 17 · 8:30 AM · ¥5,600/person'},
    {id:'c4', label:'Fuji-Excursion 7 train tickets',             sub:'Apr 20 · Res: E77821'},
    {id:'c5', label:'Tensui Saryo ryokan, Hakone',                sub:'2 nights · Apr 20–22 · IK1516984808'},
    {id:'c6', label:'Shinkansen HIKARI 637 (Odawara → Kyoto)',   sub:'Apr 22 · Res: 2002'},
    {id:'c7', label:'Hotel Granvia Kyoto',                        sub:'4 nights · Apr 22–26'},
    {id:'c8', label:'Hotel Intergate Kanazawa',                   sub:'2 nights · Apr 26–28'},
    {id:'c9', label:'Quintessa Hotel Tokyo Ginza',                sub:'1 night · Apr 28–29'},
  ]},
  {id:'before', title:'BEFORE YOU LEAVE', items:[
    {id:'c10', label:'Check shinkansen seat email',               sub:'Expected after Mar 22 at 8:00 AM'},
    {id:'c11', label:'Download teamLab app',                      sub:'Needed for Infinite Crystal World numbered tickets'},
    {id:'c12', label:'Set up Suica on Apple Wallet',              sub:'iPhone: Wallet app → + → add transit card → Suica. Works at all gates.'},
    {id:'c13', label:'Confirm 21st Century Museum hours',         sub:'Apr 27 is Monday — verify not closed · kanazawa21.jp'},
    {id:'c14', label:'Download Google Maps offline',              sub:'Tokyo, Kyoto, Kanazawa, Hakone — essential for weak signal'},
    {id:'c15', label:'Set up international data plan',            sub:'Or get pocket WiFi at HND · eSIM is another option'},
    {id:'c16', label:'Notify credit card companies of travel',    sub:'Prevent card blocks abroad'},
    {id:'c17', label:'Get yen cash',                              sub:'7-Eleven ATMs accept international cards · have ¥20,000–30,000 on hand at all times'},
    {id:'c18', label:'Add this site to iPhone home screen',       sub:'Safari → Share → Add to Home Screen'},
  ]},
  {id:'ontrip', title:'ON-TRIP TASKS', items:[
    {id:'c19', label:'Arrange takkyubin at Hotel Gracery',        sub:'Night of Apr 19 — send luggage to Hotel Granvia Kyoto'},
    {id:'c20', label:'Buy Hakone Free Pass at Gora Station',      sub:'Apr 20 or 21 · covers ropeway, railway, Lake Ashi boat'},
    {id:'c21', label:'Pick up Fuji-Excursion tickets before Apr 20', sub:'Pickup code: 24492390994521288'},
    {id:'c22', label:'Confirm Tensui Saryo QR code for check-in', sub:'Via SMS from the ryokan before arrival'},
  ]},
];

// ── Japan Tips data ───────────────────────────────────────────────────────────
const TIPS_DATA = [
  {title:'Money & Cash',items:[
    {title:'Always carry cash',body:'Japan is still largely cash-based. <strong>Carry ¥15,000–20,000 on you at all times</strong>. Small restaurants, temples, shrine entry fees, vending machines, and neighborhood shops are often cash-only. Coin purses are useful — you\'ll accumulate ¥100 and ¥500 coins quickly.'},
    {title:'7-Eleven ATMs',body:'<strong>7-Eleven ATMs are the most reliable for international cards</strong>, with clear English menus. FamilyMart and post office ATMs also work. Banks may not. Expect a ¥220 withdrawal fee plus your bank\'s foreign transaction fee.'},
    {title:'Suica IC card',body:'<strong>Add Suica to your Apple Wallet</strong> before you leave (Wallet app → + → Transit Card → Suica). Top it up with Apple Pay. Tap in and out at every train and bus gate — fares are automatically calculated. Also works at 7-Eleven, FamilyMart, vending machines, and lockers. Carrying ¥3,000–5,000 loaded on your Suica is plenty.'},
    {title:'No tipping — ever',body:'Tipping is not just unusual in Japan, it can be considered <strong>confusing or even offensive</strong>. Do not tip at restaurants, hotels, taxis, or anywhere else. Service is always included in the price. Excellent service is standard and expected — no gratuity required or wanted.'},
    {title:'When paying cash',body:'There will be a small tray at every register. <strong>Place your cash on the tray</strong>, not directly in the cashier\'s hand. Receive change the same way. This is standard etiquette.'},
  ]},
  {title:'Getting Around',items:[
    {title:'Trains are always on time',body:'Japanese trains are famous for punctuality — delays of more than a few minutes are genuinely rare. <strong>Google Maps gives you exact platform numbers and exit information</strong> — always check which exit to use at a station before heading up.'},
    {title:'Quiet on trains',body:'<strong>No phone calls on trains</strong>. Keep your voice low. Eating is generally not done on local trains (it\'s fine on Shinkansen). Earphones are expected for music or video. Phone on silent mode. This is taken seriously by locals.'},
    {title:'Shinkansen boarding',body:'<strong>Board at exactly the right car number</strong> — marked on the platform floor. Doors close precisely on time. Reserved seats mean exactly that — someone else will have that seat if you\'re late. Eating and drinking are fine on the Shinkansen.'},
    {title:'Takkyubin (luggage forwarding)',body:'<strong>Japan\'s takkyubin service is one of the best things about traveling here</strong>. Drop your bags at any hotel, convenience store, or Yamato counter and they arrive at your next hotel the following day, typically for ¥1,500–2,500 per bag. Highly recommended between cities.'},
  ]},
  {title:'Etiquette & Culture',items:[
    {title:'Bowing',body:'A gentle <strong>head nod or small bow</strong> is appropriate for most interactions — entering a hotel, thanking a shopkeeper, acknowledging a greeting. You don\'t need to do deep formal bows; a respectful nod goes a long way and is always appreciated.'},
    {title:'Shoes at temples and ryokan',body:'<strong>Remove shoes whenever you see a step up at an entrance</strong>, or when you see a row of shoes near the door. At the ryokan, wear the provided slippers indoors. Never wear outdoor shoes on tatami. Separate toilet slippers may be provided near bathrooms — swap into them and back.'},
    {title:'Eating while walking',body:'<strong>Eating while walking is generally frowned upon</strong> in Japan (though Nishiki Market and street food areas are exceptions). Find a spot to stop and eat, or eat at the stall. Drink from bottles while walking is fine.'},
    {title:'Queuing',body:'<strong>Always queue</strong>. Lines form on the left side of escalators (stand, don\'t walk) in Tokyo; the right in Osaka and Kyoto. Board trains in order. Don\'t cut, push, or rush. Even in crowds, people are patient and orderly.'},
    {title:'Quiet voices',body:'<strong>Japanese public spaces are quiet</strong>. Speak in conversational tones, not loudly. Laughing and chatting is fine but shouting or being boisterous is jarring. In temples and shrines, even quieter is better.'},
    {title:'"Itadakimasu" and "Gochisosama"',body:'Say <strong>"itadakimasu"</strong> (ee-tah-dah-kee-mahs) before eating — it\'s an expression of gratitude for the food. Say <strong>"gochisosama deshita"</strong> (go-chee-so-sama desh-ta) when you\'re done, especially when leaving a restaurant. Locals will appreciate the effort.'},
  ]},
  {title:'Onsen (Hot Springs) at Tensui Saryo',items:[
    {title:'Your ryokan has private onsen',body:'Tensui Saryo\'s Type-A room includes a <strong>private outdoor onsen bath (rotenburo) on your deck</strong> plus a foot bath — so any tattoo questions are completely irrelevant. You have your own bath that you can use any time, day or night.'},
    {title:'Onsen etiquette',body:'<strong>Shower and rinse thoroughly before entering any bath</strong>. Use the small stool and shower station provided — this is essential, not optional. Keep your small towel out of the water (rest it on your head or at the side). No swimwear in traditional onsen.'},
    {title:'Temperature & time',body:'Onsen water is hot — often <strong>40–42°C (104–108°F)</strong>. Ease in slowly. Limit each soak to about 15–20 minutes. Hydrate before and after. Don\'t drink alcohol just before soaking.'},
    {title:'Yukata robe',body:'Your ryokan will provide a <strong>yukata</strong> (light cotton robe) and slippers. Wear it to meals, to the onsen, and to wander the ryokan. It\'s perfectly normal to wear it in common areas and even to step outside briefly in ryokan towns like Gora.'},
  ]},
  {title:'Useful Japanese Phrases',phrases:[
    {jp:'ありがとうございます',rom:'Arigatou gozaimasu',en:'Thank you (polite)'},
    {jp:'すみません',rom:'Sumimasen',en:'Excuse me / Sorry'},
    {jp:'いただきます',rom:'Itadakimasu',en:'Before eating (like "bon appétit")'},
    {jp:'ごちそうさまでした',rom:'Gochisosama deshita',en:'After eating (thank you for the meal)'},
    {jp:'これをください',rom:'Kore wo kudasai',en:'I\'ll have this one, please'},
    {jp:'いくらですか',rom:'Ikura desu ka',en:'How much is this?'},
    {jp:'英語のメニューはありますか',rom:'Eigo no menyu wa arimasu ka',en:'Do you have an English menu?'},
    {jp:'トイレはどこですか',rom:'Toire wa doko desu ka',en:'Where is the bathroom?'},
    {jp:'助けてください',rom:'Tasukete kudasai',en:'Please help me'},
    {jp:'写真を撮ってもいいですか',rom:'Shashin wo totte mo ii desu ka',en:'May I take a photo?'},
  ]},
  {title:'Emergency Info',items:[
    {title:'Emergency numbers',body:'<strong>Police: 110 · Ambulance/Fire: 119</strong>. The Japan Tourism Agency operates an English-language emergency line at <strong>050-3816-2787</strong> (24/7). US Embassy Tokyo: +81-3-3224-5000.'},
    {title:'Japan is extremely safe',body:'Japan consistently ranks among the world\'s safest countries. Violent crime is rare. <strong>Lost items are almost always turned in</strong> — if you lose something, check with the nearest koban (police box) or the train station lost and found. Return rates for wallets and phones are remarkably high.'},
    {title:'Earthquakes',body:'Japan is seismically active. If shaking occurs: <strong>drop, cover, hold on</strong>. Move away from windows. Do not run outside. After the shaking stops, check for gas leaks. The "Yurekuru Call" app gives earthquake early warnings.'},
    {title:'Apps to download',body:'<strong>Google Maps</strong> (offline maps), <strong>Google Translate</strong> (camera translation for menus and signs), <strong>Hyperdia or Navitime</strong> (train route planning), <strong>teamLab app</strong> (for Borderless visit). Optionally: Yurekuru Call for earthquake alerts.'},
  ]},
];

// ── DOM refs ──────────────────────────────────────────────────────────────────
const itineraryEl   = document.getElementById('itinerary');
const confirmEl     = document.getElementById('confirmations');
const checklistEl   = document.getElementById('checklist');
const tipsEl        = null; // merged into Pre-trip tab
const editBtn       = document.getElementById('editBtn');
const editBtnLabel  = document.getElementById('editBtnLabel');
const userAvatar    = document.getElementById('userAvatar');
const overlay       = document.getElementById('overlay');
const authClose     = document.getElementById('authClose');
const googleSignIn  = document.getElementById('googleSignInBtn');
const authErr       = document.getElementById('authErr');
const tripStatus    = document.getElementById('tripStatus');
const jstClock      = document.getElementById('jstClock');
const destPillsWrap = document.getElementById('destPillsWrap');
const destPillsEl   = document.getElementById('destPills');
const darkToggle    = document.getElementById('darkToggle');
const currencyFab   = document.getElementById('currencyFab');
const currencyWidget= document.getElementById('currencyWidget');
const currencyClose = document.getElementById('currencyClose');
const jpyInput      = document.getElementById('jpyInput');
const usdInput      = document.getElementById('usdInput');
const currRate      = document.getElementById('currRate');
const backTop       = document.getElementById('backTop');
const themeColor    = document.getElementById('theme-color-meta');

// ── Landing / App toggle ──────────────────────────────────────────────────────
// Navigate to landing page
window.showLanding = function () { window.location.href = 'index.html'; };

// (blossoms on landing page only — see index.html)

// ── Toast ─────────────────────────────────────────────────────────────────────
const toastEl = document.getElementById('toast');
let toastTimer;
function showToast(msg) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

function copyToClipboard(text, label) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Copied: ${label}`);
  }).catch(() => {
    // fallback
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showToast(`Copied: ${label}`); } catch {}
    document.body.removeChild(ta);
  });
}

// ── Past days state ───────────────────────────────────────────────────────────
let hidePastDays = false;
function applyDark(on) {
  document.body.classList.toggle('dark', on);
  darkToggle.textContent = on ? '☀' : '☽';
  themeColor.content = on ? '#111111' : '#F8F6F1';
  try { localStorage.setItem('japan-dark', on ? '1' : '0'); } catch {}
}

darkToggle.addEventListener('click', () => applyDark(!document.body.classList.contains('dark')));
try { if (localStorage.getItem('japan-dark') === '1') applyDark(true); } catch {}

// ── Currency ──────────────────────────────────────────────────────────────────
async function fetchRate() {
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    const d = await r.json();
    if (d.rates?.JPY) {
      exchRate = d.rates.JPY;
      currRate.textContent = `1 USD = ¥${exchRate.toFixed(0)} JPY (live rate)`;
    }
  } catch {
    currRate.textContent = `1 USD ≈ ¥${exchRate} JPY (estimated)`;
  }
}

currencyFab.addEventListener('click', () => currencyWidget.classList.toggle('hidden'));
currencyClose.addEventListener('click', () => currencyWidget.classList.add('hidden'));
// Do NOT close on outside click — widget stays open
jpyInput.addEventListener('input', () => {
  const v = parseFloat(jpyInput.value);
  usdInput.value = isNaN(v) ? '' : (v / exchRate).toFixed(2);
});
usdInput.addEventListener('input', () => {
  const v = parseFloat(usdInput.value);
  jpyInput.value = isNaN(v) ? '' : (v * exchRate).toFixed(0);
});

// ── Back to top ───────────────────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  backTop.classList.toggle('visible', window.scrollY > 400);
}, {passive:true});
backTop.addEventListener('click', () => window.scrollTo({top:0, behavior:'smooth'}));

// ── Dates ─────────────────────────────────────────────────────────────────────
function getTodayJST() {
  return new Date(new Date().toLocaleString('en-US', {timeZone:'Asia/Tokyo'}));
}
function getTodayDayId() {
  const t = getTodayJST().toDateString();
  return Object.entries(DAY_DATES).find(([,d]) => d.toDateString() === t)?.[0] || null;
}
function getDayClass(id) {
  const today = getTodayJST(), day = DAY_DATES[id];
  if (!day) return '';
  if (today.toDateString() === day.toDateString()) return 'today';
  return today > day ? 'past' : '';
}

function updateClock() {
  const jst = getTodayJST();
  jstClock.textContent = `JST ${String(jst.getHours()).padStart(2,'0')}:${String(jst.getMinutes()).padStart(2,'0')}`;
}

function updateTripStatus() {
  const now = new Date(), todayId = getTodayDayId();
  if (now < TRIP_START) {
    const d = Math.ceil((TRIP_START - now) / 86400000);
    tripStatus.innerHTML = `Trip starts in <strong>${d} day${d===1?'':'s'}</strong>`;
  } else if (now > TRIP_END) {
    tripStatus.innerHTML = 'Trip complete &nbsp;·&nbsp; Apr 15–29, 2026';
  } else {
    const dayNum = Math.floor((now - TRIP_START) / 86400000) + 1;
    const dest = GROUPS.find(g => g.ids.includes(todayId))?.label.split('·')[0].trim() || '';
    tripStatus.innerHTML = `<strong>Day ${dayNum} of 15</strong> &nbsp;·&nbsp; ${dest}`;
  }
}

// ── Destination pills ─────────────────────────────────────────────────────────
function buildDestPills() {
  destPillsWrap.style.display = '';
  destPillsEl.innerHTML = GROUPS.map((g,i) =>
    `<button class="dest-pill${i===0?' active':''}" data-group="${i}">${g.label}</button>`
  ).join('');
  destPillsEl.querySelectorAll('.dest-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      destPillsEl.querySelectorAll('.dest-pill').forEach(p=>p.classList.remove('active'));
      pill.classList.add('active');
      const sec = document.getElementById('section-'+pill.dataset.group);
      if (sec) {
        const hH = document.querySelector('header').offsetHeight;
        const pH = destPillsWrap.offsetHeight;
        window.scrollTo({top: sec.getBoundingClientRect().top + window.scrollY - hH - pH - 10, behavior:'smooth'});
      }
    });
  });
}

function updateActivePill() {
  const hH = document.querySelector('header').offsetHeight;
  const pH = destPillsWrap.offsetHeight;
  const off = hH + pH + 20;
  let active = 0;
  GROUPS.forEach((_,i) => {
    const el = document.getElementById('section-'+i);
    if (el && el.getBoundingClientRect().top < off) active = i;
  });
  destPillsEl.querySelectorAll('.dest-pill').forEach((p,i) => p.classList.toggle('active', i===active));
  // Scroll active pill into view horizontally
  const activePill = destPillsEl.querySelector('.dest-pill.active');
  if (activePill) activePill.scrollIntoView({inline:'nearest', block:'nearest'});
}

// ── Render: Itinerary ─────────────────────────────────────────────────────────
function renderItinerary() {
  // Summary bar
  const segFlexes = [5,2,4,2,1];
  const summaryBar = `
    <div class="trip-summary-bar">
      <div class="tsb-top">
        <span class="tsb-title">JAPAN 2026 · ROUTE</span>
        <span class="tsb-dates">APR 15 – 29 · 15 DAYS</span>
      </div>
      <div class="tsb-bar">
        ${GROUPS.map((g,i) => `<div class="tl-seg" style="flex:${segFlexes[i]};background:${g.color}"></div>`).join('')}
      </div>
      <div class="tsb-labels">
        ${GROUPS.map((g,i) => `
          <div class="tsb-label-item">
            <div class="tsb-dot" style="background:${g.color}"></div>
            ${g.label} <span style="color:var(--light)">${g.dates}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  const hasPast = Object.keys(DAYS).some(id => getDayClass(id) === 'past');
  const toolbar = hasPast ? `
    <div class="itinerary-toolbar">
      <button class="past-toggle-btn${hidePastDays?' hiding':''}" id="pastToggleBtn">
        ${hidePastDays ? 'Show past days' : 'Hide past days'}
      </button>
    </div>
  ` : '';

  const sections = GROUPS.map((g,i) => {
    const visibleDays = g.ids.filter(id => {
      if (hidePastDays && getDayClass(id) === 'past') return false;
      return true;
    });
    if (visibleDays.length === 0) return '';
    return `
      <div class="dest-section" id="section-${i}">
        <div class="dest-header">
          <span class="dest-name">${g.label}</span>
          <span class="dest-dates-label">${g.dates}</span>
        </div>
        ${visibleDays.map(id => renderDay(DAYS[id])).join('')}
      </div>
    `;
  }).join('');

  itineraryEl.innerHTML = summaryBar + toolbar + sections;

  document.querySelectorAll('.day-header').forEach(h => {
    h.addEventListener('click', () => {
      const card = h.parentElement;
      card.classList.toggle('expanded');
      if (card.classList.contains('expanded')) {
        const dayId = card.id.replace('card-', '');
        injectDayActsSection(dayId);
      }
    });
  });

  const pastBtn = document.getElementById('pastToggleBtn');
  if (pastBtn) {
    pastBtn.addEventListener('click', () => {
      hidePastDays = !hidePastDays;
      renderItinerary();
      buildDestPills();
    });
  }

  const todayId = getTodayDayId();
  if (todayId) {
    const card = document.getElementById('card-'+todayId);
    if (card) {
      card.classList.add('expanded');
      injectDayActsSection(todayId);
      setTimeout(() => {
        const hH = document.querySelector('header').offsetHeight;
        const pH = destPillsWrap.offsetHeight;
        window.scrollTo({top: card.getBoundingClientRect().top + window.scrollY - hH - pH - 12, behavior:'smooth'});
      }, 300);
    }
  }
}

function renderDay(d) {
  const cls     = getDayClass(d.id);
  const isToday = cls === 'today';
  const noteText = notes[d.id] || '';
  const noteRead = noteText
    ? noteText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>')
    : '<em>No notes yet — sign in to add notes.</em>';

  const periods = d.periods.map(p => `
    <div class="period">
      <div class="period-label">${p.label}</div>
      ${p.items.map(renderItem).join('')}
    </div>
  `).join('');

  return `
    <div class="day-card ${cls}" id="card-${d.id}">
      <div class="day-header">
        <div class="day-header-left">
          <span class="day-date">${d.date}</span>
          <div class="day-title-wrap">
            <div class="day-title">${d.title}${isToday?'<span class="today-badge">TODAY</span>':''}</div>
            <div class="day-location">${d.location}</div>
          </div>
        </div>
        <div class="day-header-right">
          <span class="notes-dot${noteText?' has-notes':''}"></span>
          <span class="day-toggle">&#9660;</span>
        </div>
      </div>
      <div class="day-body">
        ${periods}
        ${d.tip?`<div class="tip-block"><span class="tip-label">Tip  </span>${d.tip}</div>`:''}
        <div class="notes-section">
          <div class="notes-label">Notes</div>
          <div class="notes-read">${noteRead}</div>
          <textarea class="notes-edit" data-day="${d.id}" placeholder="Add notes, restaurant picks, reminders…">${esc(noteText)}</textarea>
          <div class="save-indicator" id="save-${d.id}"></div>
        </div>
      </div>
    </div>
  `;
}

function renderItem(item) {
  const isSub  = item.sub === true;
  const cls    = item.type==='booked' && !isSub ? ' booked' : '';
  const tag    = item.type==='booked' && !isSub ? '<span class="tag tag-booked">BOOKED</span>' : '';
  const time   = item.time && !isSub ? `<div class="act-time">${item.time}</div>` : '<div class="act-time"></div>';
  const dur    = item.dur ? `<div class="act-duration">${item.dur}</div>` : '';
  const textContent = item.addr
    ? `<a href="https://maps.google.com/?q=${encodeURIComponent(item.addr)}" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline;text-decoration-color:var(--border)">${item.text}</a>${tag}`
    : `${item.text}${tag}`;

  // Sub-items: no time slot, rendered as muted supporting text
  if (isSub) {
    return `
      <div class="act sub-item">
        <div style="width:8px"></div>
        <div class="act-time"></div>
        <div class="act-body">
          <div class="act-sub" style="padding-left:2px">${textContent}${dur}</div>
        </div>
      </div>`;
  }

  return `
    <div class="act${cls}">
      <div class="act-dot"></div>
      ${time}
      <div class="act-body">
        <div class="act-text">${textContent}</div>
        ${dur}
      </div>
    </div>`;
}

// ── Drive Folder Helpers ──────────────────────────────────────────────────────
function driveFolderIdFromUrl(url) {
  if (!url) return null;
  // https://drive.google.com/drive/folders/FOLDER_ID
  // https://drive.google.com/drive/u/0/folders/FOLDER_ID
  const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : null;
}

function driveFolderEmbedUrl(url) {
  const id = driveFolderIdFromUrl(url);
  return id ? `https://drive.google.com/embeddedfolderview?id=${id}#list` : null;
}

async function saveDriveFolderUrl(url) {
  driveFolderUrl = url;
  try {
    await setDoc(doc(db, 'settings', 'drive'), { folderUrl: url });
    showToast('Drive folder saved');
  } catch {
    // fallback: local
    try { localStorage.setItem('japan-drive-url', url); } catch {}
    showToast('Saved locally');
  }
  renderConfirmations();
}

async function loadDriveSettings() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'drive'));
    if (snap.exists()) driveFolderUrl = snap.data().folderUrl || '';
  } catch {
    try { driveFolderUrl = localStorage.getItem('japan-drive-url') || ''; } catch {}
  }
}

function renderDriveSection() {
  const embedUrl  = driveFolderEmbedUrl(driveFolderUrl);
  const folderId  = driveFolderIdFromUrl(driveFolderUrl);
  const openUrl   = folderId ? `https://drive.google.com/drive/folders/${folderId}` : null;

  const embedHtml = embedUrl
    ? `<div class="drive-embed-wrap">
        <iframe src="${embedUrl}" allowfullscreen loading="lazy" title="Confirmation Documents"></iframe>
       </div>`
    : `<div class="drive-embed-empty">
        <svg width="36" height="36" viewBox="0 0 87.3 78" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:0.25">
          <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5L6.6 66.85z" fill="#0066DA"/>
          <path d="M43.65 25L29.9 1.4c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.5A8.87 8.87 0 000 53h27.5L43.65 25z" fill="#00AC47"/>
          <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3L78.3 70l4.8-8.3c.8-1.4 1.2-2.95 1.2-4.5H57.3l5.9 11.05 10.35 8.55z" fill="#EA4335"/>
          <path d="M43.65 25L57.4 1.4A8.87 8.87 0 0053.65 0H33.65c-1.55 0-3.1.4-4.4 1.1L43.65 25z" fill="#00832D"/>
          <path d="M57.3 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.45 1.2h50.6c1.55 0 3.1-.4 4.45-1.2L57.3 53z" fill="#2684FC"/>
          <path d="M73.4 26.5l-12.85-22.2c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 57.3 53h27.45c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z" fill="#FFBA00"/>
        </svg>
        <div class="drive-embed-empty-text">
          ${currentUser ? 'Paste your Google Drive folder link below to embed all confirmation documents.' : 'Sign in to configure the documents folder.'}
        </div>
      </div>`;

  const editRow = currentUser ? `
    <div class="drive-url-row">
      <input type="url" class="drive-url-input" id="driveUrlInput"
        placeholder="https://drive.google.com/drive/folders/…"
        value="${esc(driveFolderUrl)}">
      <button class="drive-url-save" id="driveUrlSave">Save</button>
    </div>` : '';

  const openLink = openUrl ? `
    <a href="${openUrl}" target="_blank" rel="noopener" class="drive-open-btn">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      Open folder in Google Drive
    </a>` : '';

  return `
    <div class="drive-section expanded" id="driveSection">
      <div class="drive-section-hd" onclick="toggleDriveSection()">
        <div class="drive-section-left">
          <div class="drive-icon">
            <svg width="22" height="19" viewBox="0 0 87.3 78" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5L6.6 66.85z" fill="#0066DA"/>
              <path d="M43.65 25L29.9 1.4c-1.35.8-2.5 1.9-3.3 3.3L1.2 48.5A8.87 8.87 0 000 53h27.5L43.65 25z" fill="#00AC47"/>
              <path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3L78.3 70l4.8-8.3c.8-1.4 1.2-2.95 1.2-4.5H57.3l5.9 11.05 10.35 8.55z" fill="#EA4335"/>
              <path d="M43.65 25L57.4 1.4A8.87 8.87 0 0053.65 0H33.65c-1.55 0-3.1.4-4.4 1.1L43.65 25z" fill="#00832D"/>
              <path d="M57.3 53H27.5L13.75 76.8c1.35.8 2.9 1.2 4.45 1.2h50.6c1.55 0 3.1-.4 4.45-1.2L57.3 53z" fill="#2684FC"/>
              <path d="M73.4 26.5l-12.85-22.2c-.8-1.4-1.95-2.5-3.3-3.3L43.65 25 57.3 53h27.45c0-1.55-.4-3.1-1.2-4.5L73.4 26.5z" fill="#FFBA00"/>
            </svg>
          </div>
          <div>
            <div class="drive-section-title">Confirmation Documents</div>
            <div class="drive-section-sub">${embedUrl ? 'Google Drive folder' : 'No folder linked yet'}</div>
          </div>
        </div>
        <span class="drive-toggle">&#9660;</span>
      </div>
      <div class="drive-body">
        ${embedHtml}
        ${openLink}
        ${editRow}
      </div>
    </div>
  `;
}

window.toggleDriveSection = function() {
  document.getElementById('driveSection')?.classList.toggle('expanded');
};

// ── Render: Confirmations ─────────────────────────────────────────────────────
function renderConfirmations() {
  // Auth gate — confirmations and prices are private
  if (!currentUser) {
    confirmEl.innerHTML = `
      <div class="auth-gate">
        <div class="auth-gate-icon" style="font-size:28px;opacity:0.3;margin-bottom:12px">&#128274;</div>
        <div class="auth-gate-title">Confirmations are private</div>
        <div class="auth-gate-sub">Confirmation numbers, costs, and booking details<br>are only visible to Gwen &amp; Christina.</div>
        <button class="auth-gate-btn" onclick="openAuthModal()">
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#fff" opacity=".7" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#fff" opacity=".7" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#fff" opacity=".7" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.28-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#fff" opacity=".7" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.36-8.16 2.36-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Sign in with Google
        </button>
      </div>`;
    return;
  }
  // Cost summary
  const total = bookedCosts.reduce((s,c) => s + (c.jpy||0), 0);
  const totalUSD = bookedCosts.reduce((s,c) => s + (c.usd||0), 0);

  const costHTML = `
    <div class="cost-summary-card">
      <div class="cost-summary-title">Booked Cost Summary</div>
      ${bookedCosts.map(c => `
        <div class="cost-row">
          <span class="cost-label">${c.label}${c.note?` <span style="font-size:10px;color:var(--light)">(${c.note})</span>`:''}</span>
          <div class="cost-vals">
            ${c.jpy?`<div class="cost-jpy">¥${c.jpy.toLocaleString()}</div><div class="cost-usd">~$${c.usd.toLocaleString()}</div>`:'<div class="cost-usd" style="font-size:12px">See confirmation</div>'}
          </div>
        </div>
      `).join('')}
      <div class="cost-total-row">
        <span class="cost-total-label">Total (excl. flights)</span>
        <div>
          <div class="cost-total-jpy">¥${total.toLocaleString()}</div>
          <div class="cost-total-usd">~$${totalUSD.toLocaleString()} USD</div>
        </div>
      </div>
    </div>
  `;

  const confs = [{key:'flights',title:'FLIGHTS'},{key:'hotels',title:'HOTELS'},{key:'trains',title:'TRAINS'}].map(s => `
    <div class="conf-group">
      <div class="conf-group-title">${s.title}</div>
      ${CONFIRMATIONS[s.key].map(card => `
        <div class="conf-card">
          <div class="conf-name">${card.name}</div>
          <div class="conf-number-row">
            <span class="conf-number-label">${card.number.label}</span>
            <span class="conf-number-val">${card.number.val}</span>
            <button class="copy-btn" data-copy="${card.number.val}" data-label="${card.name}" title="Copy to clipboard">Copy</button>
          </div>
          ${card.rows.map(r => `
            <div class="conf-row">
              <span class="conf-key">${r.k}</span>
              <span class="conf-val${r.mono?' mono':''}">
                ${r.addr?`<a href="https://maps.google.com/?q=${encodeURIComponent(r.addr)}" target="_blank" rel="noopener">${r.v}</a>`:r.v}
              </span>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>
  `).join('');

  confirmEl.innerHTML = renderDriveSection() + costHTML + confs;

  // Wire Drive folder save
  const driveInput = document.getElementById('driveUrlInput');
  const driveSave  = document.getElementById('driveUrlSave');
  if (driveSave && driveInput) {
    driveSave.addEventListener('click', () => saveDriveFolderUrl(driveInput.value.trim()));
    driveInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveDriveFolderUrl(driveInput.value.trim()); });
  }

  // Wire copy buttons
  confirmEl.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => copyToClipboard(btn.dataset.copy, btn.dataset.label));
  });
}

// ── Render: Checklist ─────────────────────────────────────────────────────────
function renderChecklist() {
  checklistEl.innerHTML = CHECKLIST.map(section => {
    const total = section.items.length;
    const done  = section.items.filter(i => checks[i.id]).length;
    const isBooked = !!section.booked;
    return `
      <div class="checklist-section${isBooked?' booked-section':''}" id="cl-${section.id}">
        <div class="checklist-section-hd" onclick="toggleChecklistSection('${section.id}')">
          <span class="checklist-title">${section.title}</span>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="checklist-progress"><span>${done}</span> / ${total}</span>
            <span class="checklist-toggle">&#9660;</span>
          </div>
        </div>
        <div class="checklist-items">
          ${section.items.map(item => `
            <div class="check-item${checks[item.id]?' done':''}" data-check="${item.id}">
              <div class="check-box${checks[item.id]?' checked':''}"></div>
              <div>
                <div class="check-label">${item.label}</div>
                ${item.sub?`<div class="check-sub">${item.sub}</div>`:''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  // Booked section collapsed by default
  const bookedSec = document.getElementById('cl-booked');
  if (bookedSec) bookedSec.classList.remove('expanded');
  // Others expanded by default
  document.querySelectorAll('.checklist-section:not(.booked-section)').forEach(s => s.classList.add('expanded'));

  document.querySelectorAll('.check-item').forEach(item => {
    item.addEventListener('click', () => toggleCheck(item.dataset.check));
  });

  // Append Japan Tips + Packing List sections below checklist
  const existing = document.getElementById('checklist-tips');
  if (!existing) {
    const tipDiv = document.createElement('div');
    tipDiv.id = 'checklist-tips';
    tipDiv.style.marginTop = '36px';
    checklistEl.appendChild(tipDiv);
  }
  renderTips();
}

window.toggleChecklistSection = function(id) {
  const sec = document.getElementById('cl-'+id);
  if (sec) sec.classList.toggle('expanded');
};

async function toggleCheck(id) {
  checks[id] = !checks[id];
  renderChecklist();
  if (currentUser) {
    try { await setDoc(doc(db,'checks','all'), checks); } catch {}
  } else {
    try { localStorage.setItem('japan-checks', JSON.stringify(checks)); } catch {}
  }
}

// ── Render: Japan Tips ────────────────────────────────────────────────────────
function renderTips() {
  const tipsHtml = TIPS_DATA.map(section => `
    <div class="tips-section">
      <div class="tips-section-title">${section.title}</div>
      ${section.phrases ? `
        <div class="tip-card">
          <div class="tip-card-body">
            ${section.phrases.map(p => `
              <div class="tip-phrase-row">
                <span class="tip-phrase-jp">${p.jp}</span>
                <span class="tip-phrase-rom">${p.rom}</span>
                <span class="tip-phrase-en">${p.en}</span>
              </div>
            `).join('')}
          </div>
        </div>
      ` : section.items.map(tip => `
        <div class="tip-card">
          <div class="tip-card-title">${tip.title}</div>
          <div class="tip-card-body">${tip.body}</div>
        </div>
      `).join('')}
    </div>
  `).join('');
  // Append tips to checklist panel if element exists
  const tipsContainer = document.getElementById('checklist-tips');
  if (tipsContainer) tipsContainer.innerHTML = tipsHtml;
  // Also render packing list
  renderPackingList();
}

// ── Render: Packing List ─────────────────────────────────────────────────────
const PACKING = [
  {cat:'Clothing — April layers (10°C nights / 20°C days)',items:[
    'Lightweight trench coat or packable jacket (essential — spring is unpredictable)',
    '2–3 long-sleeve tops or lightweight knits',
    '2 short-sleeve tops (for warmer days)',
    '1 cardigan or fleece for evenings',
    '2 pairs of pants or jeans (skip one pair — hotels have coin laundry)',
    '1–2 dresses or skirts (longer styles for temples)',
    '5–7 pairs of underwear + extra socks (you remove shoes constantly)',
    'Compact umbrella — everyone uses one, rain jackets stand out',
    'Comfortable slip-on walking shoes — NO laces (you remove them at temples, ryokan, restaurants)',
    '1 pair water-resistant shoes for rain days',
  ]},
  {cat:'Ryokan (Tensui Saryo)',items:[
    'Yukata and slippers are provided — you will live in them',
    'Bring your own toiletries if you prefer your brands (shampoo/conditioner provided)',
    'A small bag for the onsen area (towel provided)',
    'NO need to pack pajamas',
  ]},
  {cat:'Toiletries',items:[
    'Deodorant (bring your own — Japanese versions are mild)',
    'Feminine hygiene products (tampons are hard to find — bring from home)',
    'Sunscreen SPF 30+ (apply daily — you will walk 20,000 steps)',
    'Any prescription medications in original packaging + a letter from your doctor',
    'Antihistamines — sakura season means high pollen',
    'Ibuprofen / Tylenol (easy to find in Japan but bring some)',
    'Hand sanitizer + small pack of tissues (some bathrooms have no paper towels)',
    'Lip balm and moisturizer (urban air is dry)',
    'Leave fragrances at home — heavy perfume is considered rude in Japan',
  ]},
  {cat:'Documents & Money',items:[
    'Passport (6+ months validity, 1+ empty pages)',
    'Printed copies of all confirmation emails (or this app!)',
    'Credit cards — Visa and Mastercard most accepted',
    '¥20,000–30,000 cash on arrival (withdraw more at 7-Eleven ATMs)',
    'Travel insurance info',
  ]},
  {cat:'Tech',items:[
    'Phone + charger (Japan uses same plug as US — no adapter needed)',
    'Portable battery bank (long days away from outlets)',
    'Download Google Maps offline for Tokyo, Kyoto, Kanazawa, Hakone before leaving',
    'Set up Suica on Apple Wallet before the flight',
    'Download: Google Translate (camera mode), teamLab app, Google Maps',
    'Earphones (required for phone use on trains)',
  ]},
  {cat:'Smart packing tips',items:[
    'Leave space in your bag — you will shop',
    'Pack packing cubes — you switch cities 5 times',
    'Use takkyubin (hotel luggage forwarding) liberally — only carry a day bag when moving',
    'Hole-free socks only — yours will be inspected at every temple',
  ]},
];

function renderPackingList() {
  const container = document.getElementById('checklist-tips');
  if (!container) return;

  const packHtml = `
    <div class="tips-section" style="margin-top:28px">
      <div class="tips-section-title">Packing List — April Japan</div>
      ${PACKING.map(group => `
        <div class="tip-card" style="margin-bottom:8px">
          <div class="tip-card-title">${group.cat}</div>
          <div class="tip-card-body">
            <ul style="padding-left:16px;margin-top:6px">
              ${group.items.map(i => `<li style="margin-bottom:4px;line-height:1.5">${i}</li>`).join('')}
            </ul>
          </div>
        </div>
      `).join('')}
    </div>`;

  // Append after tips (tips renders first, then this)
  container.insertAdjacentHTML('beforeend', packHtml);
}

// ── Tab switching ─────────────────────────────────────────────────────────────
const addExpFab = document.getElementById('addExpFab');

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
    destPillsWrap.style.display = btn.dataset.tab === 'itinerary' ? '' : 'none';
    addExpFab.classList.toggle('hidden', btn.dataset.tab !== 'budget');
    if (btn.dataset.tab === 'budget') renderBudget();
    if (btn.dataset.tab === 'overview') renderOverview();
  });
});

// ── Category config ───────────────────────────────────────────────────────────
const CAT_COLORS = {
  food:       '#E91E8C',
  drinks:     '#C0392B',
  transport:  '#4A90D9',
  souvenirs:  '#F39C12',
  activities: '#27AE60',
  other:      '#8E8E8E',
};

// Booked costs for reference
// Pre-booked costs — stored in Firestore when signed in, editable per item
const DEFAULT_BOOKED = [
  {id:'b1', label:'Flights (both)',                  jpy:null,   usd:null,  paidBy:'split'},
  {id:'b2', label:'Hotel Gracery Shinjuku',          jpy:200692, usd:1261,  paidBy:'gwen'},
  {id:'b3', label:'teamLab Borderless (2 tickets)',  jpy:11200,  usd:70,    paidBy:'gwen'},
  {id:'b4', label:'Fuji-Excursion 7 train',          jpy:8400,   usd:53,    paidBy:'gwen'},
  {id:'b5', label:'Tensui Saryo, Hakone',            jpy:126340, usd:794,   paidBy:'gwen'},
  {id:'b6', label:'Shinkansen (Odawara→Kyoto)',      jpy:23800,  usd:150,   paidBy:'gwen'},
  {id:'b7', label:'Hotel Granvia Kyoto',             jpy:268256, usd:1686,  paidBy:'gwen'},
  {id:'b8', label:'Hotel Intergate Kanazawa',        jpy:39004,  usd:245,   paidBy:'gwen'},
  {id:'b9', label:'Quintessa Hotel Ginza',           jpy:24713,  usd:155,   paidBy:'gwen'},
];
let bookedCosts = DEFAULT_BOOKED.map(b => ({...b})); // mutable copy

async function loadBookedCosts() {
  try {
    const snap = await getDoc(doc(db, 'settings', 'bookedCosts'));
    if (snap.exists()) bookedCosts = snap.data().items || DEFAULT_BOOKED;
  } catch {}
}

async function saveBookedCosts() {
  try {
    await setDoc(doc(db, 'settings', 'bookedCosts'), {items: bookedCosts});
  } catch {}
}

// ── Expense Firestore ─────────────────────────────────────────────────────────
function subscribeExpenses() {
  if (expUnsub) expUnsub();
  const q = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));
  expUnsub = onSnapshot(q, snap => {
    expenses = snap.docs.map(d => ({id: d.id, ...d.data()}));
    renderBudget();
  }, () => {
    // fallback to local on error
    expenses = [...localExpenses].sort((a,b) => b.createdAt - a.createdAt);
    renderBudget();
  });
}

function unsubscribeExpenses() {
  if (expUnsub) { expUnsub(); expUnsub = null; }
}

function loadLocalExpenses() {
  try {
    localExpenses = JSON.parse(localStorage.getItem('japan-expenses') || '[]');
    expenses = [...localExpenses].sort((a,b) => b.createdAt - a.createdAt);
  } catch { localExpenses = []; expenses = []; }
}

function saveLocalExpenses() {
  try { localStorage.setItem('japan-expenses', JSON.stringify(localExpenses)); } catch {}
}

async function addExpense(exp) {
  if (currentUser) {
    try {
      await addDoc(collection(db, 'expenses'), {
        ...exp,
        createdAt: serverTimestamp(),
      });
      // onSnapshot will update expenses list automatically
    } catch (e) {
      console.error('Failed to save expense', e);
      throw e;
    }
  } else {
    const newExp = {...exp, id: Date.now() + '-' + Math.random(), createdAt: Date.now()};
    localExpenses.unshift(newExp);
    saveLocalExpenses();
    expenses = [...localExpenses];
    renderBudget();
  }
}

async function deleteExpense(id) {
  if (currentUser) {
    try { await deleteDoc(doc(db, 'expenses', id)); } catch {}
  } else {
    localExpenses = localExpenses.filter(e => e.id !== id);
    saveLocalExpenses();
    expenses = [...localExpenses];
    renderBudget();
  }
}

// ── Budget calculations ───────────────────────────────────────────────────────
function calcBudget() {
  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  // Per-person net spend (what each person actually spent / their share)
  let gwenNet = 0, christinaNet = 0;
  // Settlement: positive = christina owes gwen, negative = gwen owes christina
  let settlement = 0;

  expenses.forEach(e => {
    const amt = e.amount || 0;
    if (e.split) {
      if (e.paidBy === 'gwen') {
        gwenNet      += amt;
        settlement   += amt / 2; // christina owes gwen half
      } else {
        christinaNet += amt;
        settlement   -= amt / 2; // gwen owes christina half
      }
    } else {
      if (e.paidBy === 'gwen') gwenNet += amt;
      else christinaNet += amt;
    }
  });

  // Category totals
  const byCat = {};
  Object.keys(CAT_COLORS).forEach(c => byCat[c] = 0);
  expenses.forEach(e => { if (byCat[e.category] !== undefined) byCat[e.category] += e.amount || 0; });

  // By date
  const byDate = {};
  expenses.forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = 0;
    byDate[e.date] += e.amount || 0;
  });

  return { total, gwenNet, christinaNet, settlement, byCat, byDate };
}

// ── Render: Budget ────────────────────────────────────────────────────────────
function renderBudget() {
  const budgetEl = document.getElementById('budget');
  if (!budgetEl) return;

  if (!currentUser) {
    budgetEl.innerHTML = `
      <div class="auth-gate">
        <div class="auth-gate-icon" style="font-size:28px;opacity:0.3;margin-bottom:12px">&#165;</div>
        <div class="auth-gate-title">Budget is private</div>
        <div class="auth-gate-sub">Expense tracking and settlement is only<br>visible to Gwen &amp; Christina.</div>
        <button class="auth-gate-btn" onclick="openAuthModal()">
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#fff" opacity=".7" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/></svg>
          Sign in with Google
        </button>
      </div>`;
    return;
  }

  const { total, gwenNet, christinaNet, settlement, byCat, byDate } = calcBudget();
  const maxCat = Math.max(...Object.values(byCat), 1);

  // Settlement card style
  const settled = Math.abs(settlement) < 1;
  let settlementText = '', settleClass = '';
  if (settled) {
    settlementText = 'All settled up';
    settleClass = 'settlement';
  } else if (settlement > 0) {
    settlementText = `Christina owes Gwen ¥${Math.round(settlement).toLocaleString()}`;
    settleClass = 'settlement owed';
  } else {
    settlementText = `Gwen owes Christina ¥${Math.round(Math.abs(settlement)).toLocaleString()}`;
    settleClass = 'settlement owed';
  }

  // Filter expenses
  const displayed = expFilter === 'all' ? expenses : expenses.filter(e => e.category === expFilter);

  // Booked costs total
  const bookedTotal = bookedCosts.filter(c=>c.jpy).reduce((s,c) => s + c.jpy, 0);

  budgetEl.innerHTML = `
    <div class="budget-header">
      <div class="budget-title">Trip Expenses</div>
      <div class="budget-sub">${currentUser ? 'Real-time sync active' : 'Sign in to sync with Christina'}</div>
    </div>

    <!-- Stats -->
    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">Total On-Trip Spent</div>
        <div class="stat-jpy">¥${total.toLocaleString()}</div>
        <div class="stat-usd">~$${Math.round(total / exchRate).toLocaleString()} USD</div>
      </div>
      <div class="stat-card ${settleClass}">
        <div class="stat-label">Settlement</div>
        <div class="stat-jpy">${settlementText}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Gwen Paid</div>
        <div class="stat-jpy">¥${gwenNet.toLocaleString()}</div>
        <div class="stat-usd">~$${Math.round(gwenNet / exchRate).toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Christina Paid</div>
        <div class="stat-jpy">¥${christinaNet.toLocaleString()}</div>
        <div class="stat-usd">~$${Math.round(christinaNet / exchRate).toLocaleString()}</div>
      </div>
    </div>

    <!-- Category breakdown -->
    <div class="cat-breakdown">
      <div class="cat-breakdown-title">By Category</div>
      ${Object.entries(byCat).map(([cat, amt]) => `
        <div class="cat-row">
          <span class="cat-name">${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
          <div class="cat-bar-wrap">
            <div class="cat-bar" style="width:${(amt/maxCat)*100}%;background:${CAT_COLORS[cat]}"></div>
          </div>
          <span class="cat-amt">¥${amt.toLocaleString()}</span>
        </div>
      `).join('')}
    </div>

    <!-- Booked costs — editable -->
    <div class="booked-ref-card">
      <div class="booked-ref-hd">
        <div class="booked-ref-title">Pre-booked Costs</div>
        <button class="booked-edit-btn" id="bookedEditToggle">Edit</button>
      </div>
      <div id="bookedCostList">
        ${bookedCosts.filter(c=>c.jpy).map(c=>`
          <div class="booked-ref-row" data-id="${c.id}">
            <span class="booked-ref-label">${c.label}</span>
            <div class="booked-ref-right">
              <span class="booked-ref-paidby booked-payer-${c.paidBy}">${c.paidBy === 'split' ? 'Split' : c.paidBy === 'gwen' ? 'Gwen' : 'Christina'}</span>
              <span class="booked-ref-val">¥${c.jpy.toLocaleString()}</span>
            </div>
          </div>
        `).join('')}
      </div>
      <div id="bookedCostEdit" style="display:none">
        ${bookedCosts.filter(c=>c.jpy).map(c=>`
          <div class="booked-edit-row" data-id="${c.id}">
            <span class="booked-edit-label">${c.label}</span>
            <div class="booked-edit-controls">
              <select class="booked-payer-sel" data-id="${c.id}">
                <option value="gwen"${c.paidBy==='gwen'?' selected':''}>Gwen paid</option>
                <option value="christina"${c.paidBy==='christina'?' selected':''}>Christina paid</option>
                <option value="split"${c.paidBy==='split'?' selected':''}>Split 50/50</option>
              </select>
              <span class="booked-ref-val">¥${c.jpy.toLocaleString()}</span>
            </div>
          </div>
        `).join('')}
        <button class="booked-save-btn" id="bookedSave">Save</button>
      </div>
      <div class="booked-ref-total">
        <span class="booked-ref-total-label">Pre-booked total</span>
        <span class="booked-ref-total-val">¥${bookedTotal.toLocaleString()}</span>
      </div>
      <div style="font-size:11px;color:var(--light);margin-top:6px">
        Total trip (booked + on-trip): ¥${(bookedTotal + total).toLocaleString()} &nbsp;·&nbsp; ~$${Math.round((bookedTotal + total)/exchRate).toLocaleString()}
      </div>
    </div>

    <!-- Expense list -->
    <div class="expense-list-hd">
      <span class="expense-list-title">Expenses (${expenses.length})</span>
      <div class="exp-filter-row">
        <button class="exp-filter-btn${expFilter==='all'?' active':''}" data-filter="all">All</button>
        ${Object.keys(CAT_COLORS).map(cat =>
          `<button class="exp-filter-btn${expFilter===cat?' active':''}" data-filter="${cat}">${cat.charAt(0).toUpperCase()+cat.slice(1)}</button>`
        ).join('')}
      </div>
    </div>

    ${(() => {
      if (displayed.length === 0) return `
        <div class="exp-empty">
          <strong>${expenses.length === 0 ? 'No expenses yet' : 'No expenses in this category'}</strong>
          ${expenses.length === 0 ? 'Tap "+ Add" to log your first expense in Japan.' : 'Try a different filter above.'}
        </div>
      `;

      // Group by date
      const byDay = {};
      displayed.forEach(e => {
        const d = e.date || 'Unknown date';
        if (!byDay[d]) byDay[d] = [];
        byDay[d].push(e);
      });
      const sortedDays = Object.keys(byDay).sort((a,b) => b.localeCompare(a));

      return sortedDays.map(day => {
        const dayTotal = byDay[day].reduce((s,e) => s + (e.amount||0), 0);
        // Format date nicely
        let dayLabel = day;
        try {
          const d = new Date(day + 'T12:00:00');
          dayLabel = d.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'});
        } catch {}

        return `
          <div class="exp-day-group">
            <div class="exp-day-hd">
              <span>${dayLabel}</span>
              <span class="exp-day-total">¥${dayTotal.toLocaleString()}</span>
            </div>
            ${byDay[day].map(e => `
              <div class="expense-item">
                <div class="exp-cat-stripe" style="background:${CAT_COLORS[e.category]||'#ccc'}"></div>
                <div class="exp-body">
                  <div class="exp-top">
                    <span class="exp-desc">${e.description || e.category}</span>
                    <span class="exp-amount">¥${(e.amount||0).toLocaleString()}</span>
                  </div>
                  <div class="exp-meta">
                    <span>${e.paidBy === 'gwen' ? 'Gwen' : 'Christina'} paid</span>
                    ${e.split ? `<span class="exp-tag split">Split 50/50</span>` : ''}
                    <span class="exp-tag">${e.category}</span>
                  </div>
                </div>
                <button class="exp-delete" data-id="${e.id}" title="Delete">&times;</button>
              </div>
            `).join('')}
          </div>
        `;
      }).join('');
    })()}
    <div style="height:80px"></div>
  `;

  // Booked costs edit toggle
  const bookedEditToggle = document.getElementById('bookedEditToggle');
  const bookedCostList   = document.getElementById('bookedCostList');
  const bookedCostEdit   = document.getElementById('bookedCostEdit');
  const bookedSaveBtn    = document.getElementById('bookedSave');
  let bookedEditing = false;

  if (bookedEditToggle) {
    bookedEditToggle.addEventListener('click', () => {
      bookedEditing = !bookedEditing;
      bookedCostList.style.display = bookedEditing ? 'none' : '';
      bookedCostEdit.style.display = bookedEditing ? '' : 'none';
      bookedEditToggle.textContent = bookedEditing ? 'Cancel' : 'Edit';
    });
  }

  if (bookedSaveBtn) {
    bookedSaveBtn.addEventListener('click', async () => {
      budgetEl.querySelectorAll('.booked-payer-sel').forEach(sel => {
        const id = sel.dataset.id;
        const item = bookedCosts.find(c => c.id === id);
        if (item) item.paidBy = sel.value;
      });
      await saveBookedCosts();
      showToast('Pre-booked costs saved');
      renderBudget();
    });
  }

  // Filter buttons
  budgetEl.querySelectorAll('.exp-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      expFilter = btn.dataset.filter;
      renderBudget();
    });
  });

  // Delete buttons
  budgetEl.querySelectorAll('.exp-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (confirm('Delete this expense?')) await deleteExpense(btn.dataset.id);
    });
  });
}

// ── Expense Modal ─────────────────────────────────────────────────────────────
const expOverlay  = document.getElementById('expenseOverlay');
const expModalClose = document.getElementById('expModalClose');
const expAmount   = document.getElementById('expAmount');
const expNote     = document.getElementById('expNote');
const expDate     = document.getElementById('expDate');
const expSubmit   = document.getElementById('expSubmit');
const expErr      = document.getElementById('expErr');
const expSplit    = document.getElementById('expSplit');
const expSplitHint = document.getElementById('expSplitHint');

let selectedCat   = 'food';
let selectedPayer = 'gwen';

function openExpenseModal() {
  expErr.textContent = '';
  expAmount.value = '';
  expNote.value = '';
  expDate.style.display = 'none';

  // Default to today via quick button
  const today = getTodayJST();
  const tripStart = new Date('2026-04-15');
  const tripEnd   = new Date('2026-04-29');
  const useDate = today >= tripStart && today <= tripEnd ? today : tripStart;
  expDate.value = useDate.toISOString().split('T')[0];

  // Highlight "Today" quick button
  document.querySelectorAll('.exp-quick-date[data-offset]').forEach(b => b.classList.remove('active'));
  const todayBtn = document.querySelector('.exp-quick-date[data-offset="0"]');
  if (todayBtn) todayBtn.classList.add('active');

  expOverlay.classList.add('open');
  setTimeout(() => expAmount.focus(), 100);
}

// Quick date buttons
document.getElementById('expQuickDates').addEventListener('click', e => {
  const btn = e.target.closest('.exp-quick-date');
  if (!btn) return;

  if (btn.id === 'expPickerToggle') {
    expDate.style.display = expDate.style.display === 'none' ? 'block' : 'none';
    document.querySelectorAll('.exp-quick-date[data-offset]').forEach(b => b.classList.remove('active'));
    return;
  }

  const offset = parseInt(btn.dataset.offset, 10);
  const base   = getTodayJST();
  base.setDate(base.getDate() + offset);
  // Clamp to trip range
  const tripStart = new Date('2026-04-15');
  const tripEnd   = new Date('2026-04-29');
  const clamped = base < tripStart ? tripStart : base > tripEnd ? tripEnd : base;
  expDate.value = clamped.toISOString().split('T')[0];

  document.querySelectorAll('.exp-quick-date[data-offset]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
});

addExpFab.addEventListener('click', openExpenseModal);
expModalClose.addEventListener('click', () => expOverlay.classList.remove('open'));
expOverlay.addEventListener('click', e => { if (e.target === expOverlay) expOverlay.classList.remove('open'); });

// Category buttons
document.getElementById('expCats').addEventListener('click', e => {
  const btn = e.target.closest('.exp-cat');
  if (!btn) return;
  document.querySelectorAll('.exp-cat').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedCat = btn.dataset.cat;
});

// Payer buttons
document.getElementById('expPayers').addEventListener('click', e => {
  const btn = e.target.closest('.exp-payer');
  if (!btn) return;
  document.querySelectorAll('.exp-payer').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedPayer = btn.dataset.payer;
  updateSplitHint();
});

function updateSplitHint() {
  if (!expSplit.checked) { expSplitHint.textContent = ''; return; }
  const amt = parseFloat(expAmount.value) || 0;
  const half = Math.round(amt / 2);
  const other = selectedPayer === 'gwen' ? 'Christina' : 'Gwen';
  expSplitHint.textContent = half > 0 ? `${other} owes ¥${half.toLocaleString()}` : '';
}

expAmount.addEventListener('input', updateSplitHint);
expSplit.addEventListener('change', updateSplitHint);

expSubmit.addEventListener('click', async () => {
  const amount = parseInt(expAmount.value, 10);
  if (!amount || amount <= 0) { expErr.textContent = 'Enter an amount.'; return; }
  if (!expDate.value) { expErr.textContent = 'Enter a date.'; return; }

  expSubmit.textContent = 'Adding…';
  expSubmit.disabled = true;
  expErr.textContent = '';

  try {
    await addExpense({
      amount,
      category:    selectedCat,
      description: expNote.value.trim() || selectedCat.charAt(0).toUpperCase() + selectedCat.slice(1),
      paidBy:      selectedPayer,
      split:       expSplit.checked,
      date:        expDate.value,
    });
    expOverlay.classList.remove('open');
    showToast(`Added ¥${amount.toLocaleString()}`);
  } catch {
    expErr.textContent = 'Could not save. Check connection.';
  } finally {
    expSubmit.textContent = 'Add Expense';
    expSubmit.disabled = false;
  }
});

// ── Firestore Days (editable itinerary) ───────────────────────────────────────
function subscribeDays() {
  if (daysUnsub) daysUnsub();
  const q = query(collection(db, 'days'), orderBy('dayDate'));
  daysUnsub = onSnapshot(q, async snap => {
    if (snap.empty) {
      await seedDays();
      return;
    }

    // Detect old seeded data: if any day has activities with IDs starting with 's00',
    // those were auto-seeded and duplicate the hardcoded itinerary — clear them.
    let needsClear = false;
    snap.forEach(d => {
      const acts = d.data().activities || [];
      if (acts.some(a => a.id && a.id.startsWith('s00'))) needsClear = true;
    });
    if (needsClear) {
      const clearOps = [];
      snap.forEach(d => {
        const acts = (d.data().activities || []).filter(a => !a.id?.startsWith('s00'));
        clearOps.push(setDoc(doc(db, 'days', d.id), { dayDate: d.id, activities: acts }));
      });
      await Promise.all(clearOps);
      return; // snapshot will re-fire after clear
    }

    firestoreDays = {};
    snap.forEach(d => { firestoreDays[d.id] = d.data(); });
    enhanceExpandedCards();
  }, err => {
    console.error('Days listener error:', err);
  });
}

async function seedDays() {
  // Seed empty day records — the hardcoded itinerary IS the itinerary.
  // The Firestore activities section is for user-added notes/activities only.
  try {
    const dateIds = [
      '2026-04-15','2026-04-16','2026-04-17','2026-04-18','2026-04-19',
      '2026-04-20','2026-04-21','2026-04-22','2026-04-23','2026-04-24',
      '2026-04-25','2026-04-26','2026-04-27','2026-04-28','2026-04-29',
    ];
    await Promise.all(dateIds.map(d =>
      setDoc(doc(db, 'days', d), { dayDate: d, activities: [] })
    ));
  } catch(e) { console.error('Seed failed', e); }
}

function getDayActivities(dayId) {
  // Map DAYS id ('apr15') to date string ('2026-04-15')
  const dateId = dayIdToDate(dayId);
  if (firestoreDays[dateId]) return [...(firestoreDays[dateId].activities || [])].sort((a,b) => a.order - b.order);
  return null; // no Firestore data — use hardcoded
}

function dayIdToDate(id) {
  // 'apr15' → '2026-04-15'
  const months = {apr:'04',may:'05',mar:'03'};
  const m = id.match(/^([a-z]+)(\d+)$/);
  if (!m) return id;
  return `2026-${months[m[1]] || '04'}-${String(m[2]).padStart(2,'0')}`;
}

function dateToColorClass(category) {
  return `cat-${category || 'other'}`;
}

function formatActCost(cost, currency) {
  if (!cost || cost === 0) return '';
  return currency === 'JPY' ? `¥${Math.round(cost).toLocaleString()}` : `$${cost.toFixed(2)}`;
}

function driveFileId(url) {
  if (!url) return null;
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2) return m2[1];
  return null;
}

function driveUrlToThumb(url) {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w480` : null;
}

function linkifyText(str) {
  return str.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}

// Render activity cards from Firestore data
function renderFirestoreActivities(dayId, acts) {
  if (!acts || acts.length === 0) {
    return currentUser
      ? `<div class="fs-empty">Nothing added yet — use the button below to add restaurant picks, reminders, or anything you want to track for this day.</div>`
      : `<div class="fs-empty">Sign in to add personal notes and activities.</div>`;
  }
  return acts.map(act => {
    const catClass = `cat-${act.category || 'other'}`;
    const stripeClass = `cat-stripe-${act.category || 'other'}`;
    const costStr = formatActCost(act.cost, act.currency);
    const thumb = act.driveUrl ? driveUrlToThumb(act.driveUrl) : null;
    const isEdit = !!currentUser;

    const photoHtml = thumb ? `
      <div class="fs-act-photo" onclick="openLightbox('${thumb}','${act.driveUrl}')">
        <img src="${thumb}" alt="Photo" loading="lazy" onerror="this.closest('.fs-act-photo').style.display='none'">
        <div class="fs-act-photo-label">Google Drive photo</div>
      </div>` : '';

    return `
      <div class="fs-act-card" draggable="${isEdit}" data-act-id="${act.id}" data-day-id="${dayId}">
        <div class="fs-act-stripe ${stripeClass}"></div>
        <div class="fs-act-body">
          <div class="fs-act-top">
            <span class="fs-act-title">${esc(act.title || '')}</span>
            ${act.time ? `<span class="fs-act-time">${act.time}</span>` : ''}
          </div>
          <div class="fs-act-meta">
            <span class="fs-act-tag ${catClass}">${act.category || 'other'}</span>
            ${costStr ? `<span class="fs-act-cost">${costStr}</span>` : ''}
          </div>
          ${act.notes ? `<div class="fs-act-notes">${linkifyText(esc(act.notes))}</div>` : ''}
          ${photoHtml}
        </div>
        ${isEdit ? `
        <div class="fs-act-actions">
          <button class="fs-act-btn" onclick="openEditAct('${dayId}','${act.id}')">Edit</button>
          <button class="fs-act-btn del" onclick="deleteAct('${dayId}','${act.id}')">Delete</button>
        </div>` : ''}
      </div>`;
  }).join('');
}

// Inject Firestore activities section into an expanded day card
function injectDayActsSection(dayId) {
  const card = document.getElementById('card-' + dayId);
  if (!card || !card.classList.contains('expanded')) return;

  // Only show the editable section when signed in
  if (!currentUser) return;

  const existing = card.querySelector('.day-acts-section');
  if (existing) existing.remove();

  const section = document.createElement('div');
  section.className = 'day-acts-section';
  section.innerHTML = `
    <div class="day-acts-label">Your additions</div>
    <div class="day-acts-list" id="acts-list-${dayId}">
      ${renderFirestoreActivities(dayId, acts || [])}
    </div>
    ${currentUser ? `<button class="add-act-btn" onclick="openAddAct('${dayId}')">+ Add activity, note, or reminder</button>` : ''}
  `;

  // Insert before notes section
  const notesSection = card.querySelector('.notes-section');
  if (notesSection) {
    card.querySelector('.day-body').insertBefore(section, notesSection);
  } else {
    card.querySelector('.day-body').appendChild(section);
  }

  if (currentUser) initDragDrop(dayId);
}

// When a day card is expanded, inject activities
function enhanceExpandedCards() {
  document.querySelectorAll('.day-card.expanded').forEach(card => {
    const dayId = card.id.replace('card-', '');
    injectDayActsSection(dayId);
  });
}

// ── Drag & Drop reordering ────────────────────────────────────────────────────
function initDragDrop(dayId) {
  const listEl = document.getElementById('acts-list-' + dayId);
  if (!listEl) return;
  const cards = listEl.querySelectorAll('.fs-act-card');
  let draggedId = null;

  cards.forEach(card => {
    card.addEventListener('dragstart', e => {
      draggedId = card.dataset.actId;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', e => { e.preventDefault(); card.classList.add('drag-over'); });
    card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
    card.addEventListener('drop', async e => {
      e.preventDefault();
      card.classList.remove('drag-over');
      const targetId = card.dataset.actId;
      if (!draggedId || draggedId === targetId) return;
      const dateId = dayIdToDate(dayId);
      const dayData = firestoreDays[dateId];
      if (!dayData) return;
      let acts = [...(dayData.activities || [])];
      const fi = acts.findIndex(a => a.id === draggedId);
      const ti = acts.findIndex(a => a.id === targetId);
      if (fi === -1 || ti === -1) return;
      const [moved] = acts.splice(fi, 1);
      acts.splice(ti, 0, moved);
      acts = acts.map((a, i) => ({...a, order: i}));
      await setDoc(doc(db, 'days', dateId), {dayDate: dateId, activities: acts});
    });
  });
}

// ── Activity Modal ────────────────────────────────────────────────────────────
const actModal     = document.getElementById('activity-modal');
const actModalTitle = document.getElementById('act-modal-title');
const actTimeInput  = document.getElementById('act-time');
const actCatSelect  = document.getElementById('act-category');
const actTitleInput = document.getElementById('act-title');
const actNotesInput = document.getElementById('act-notes');
const actCostInput  = document.getElementById('act-cost');
const actCurrSelect = document.getElementById('act-currency');
const actPhotoInput = document.getElementById('act-photo-url');
const actSaveBtn    = document.getElementById('act-save');
const actCancelBtn  = document.getElementById('act-cancel');
const actModalClose = document.getElementById('act-modal-close');
const actErr        = document.getElementById('act-err');

window.openAddAct = function(dayId) {
  currentEditDayId = dayId;
  currentEditActId = null;
  actModalTitle.textContent = 'Add Activity';
  actTimeInput.value  = '';
  actTitleInput.value = '';
  actCatSelect.value  = 'activity';
  actNotesInput.value = '';
  actCostInput.value  = '';
  actCurrSelect.value = 'JPY';
  actPhotoInput.value = '';
  actErr.textContent  = '';
  actModal.classList.add('open');
  setTimeout(() => actTitleInput.focus(), 80);
};

window.openEditAct = function(dayId, actId) {
  const dateId  = dayIdToDate(dayId);
  const dayData = firestoreDays[dateId];
  if (!dayData) return;
  const act = dayData.activities.find(a => a.id === actId);
  if (!act) return;
  currentEditDayId = dayId;
  currentEditActId = actId;
  actModalTitle.textContent = 'Edit Activity';
  actTimeInput.value  = act.time || '';
  actTitleInput.value = act.title || '';
  actCatSelect.value  = act.category || 'activity';
  actNotesInput.value = act.notes || '';
  actCostInput.value  = act.cost || '';
  actCurrSelect.value = act.currency || 'JPY';
  actPhotoInput.value = act.driveUrl || '';
  actErr.textContent  = '';
  actModal.classList.add('open');
  setTimeout(() => actTitleInput.focus(), 80);
};

window.deleteAct = async function(dayId, actId) {
  if (!confirm('Delete this activity?')) return;
  const dateId  = dayIdToDate(dayId);
  const dayData = firestoreDays[dateId];
  if (!dayData) return;
  const acts = dayData.activities.filter(a => a.id !== actId).map((a,i) => ({...a, order:i}));
  await setDoc(doc(db, 'days', dateId), {dayDate: dateId, activities: acts});
  showToast('Activity deleted');
};

function closeActModal() {
  actModal.classList.remove('open');
  currentEditDayId = null;
  currentEditActId = null;
}

actCancelBtn.addEventListener('click', closeActModal);
actModalClose.addEventListener('click', closeActModal);
actModal.addEventListener('click', e => { if (e.target === actModal) closeActModal(); });

actSaveBtn.addEventListener('click', async () => {
  const title = actTitleInput.value.trim();
  if (!title) { actErr.textContent = 'Title is required.'; actTitleInput.focus(); return; }
  if (!currentEditDayId) return;

  actSaveBtn.textContent = 'Saving…';
  actSaveBtn.disabled = true;
  actErr.textContent = '';

  try {
    const dateId  = dayIdToDate(currentEditDayId);
    const dayData = firestoreDays[dateId] || {dayDate: dateId, activities: []};
    let acts = [...(dayData.activities || [])];

    const newAct = {
      id:       currentEditActId || ('act-' + Date.now()),
      time:     actTimeInput.value,
      title,
      category: actCatSelect.value,
      notes:    actNotesInput.value.trim(),
      cost:     parseFloat(actCostInput.value) || 0,
      currency: actCurrSelect.value,
      driveUrl: actPhotoInput.value.trim(),
      order:    0,
    };

    if (currentEditActId) {
      const idx = acts.findIndex(a => a.id === currentEditActId);
      if (idx !== -1) { acts[idx] = {...acts[idx], ...newAct}; }
    } else {
      newAct.order = acts.length;
      acts.push(newAct);
    }

    await setDoc(doc(db, 'days', dateId), {dayDate: dateId, activities: acts});
    closeActModal();
    showToast(currentEditActId ? 'Activity updated' : 'Activity added');
  } catch (e) {
    actErr.textContent = 'Could not save. Check connection.';
    console.error(e);
  } finally {
    actSaveBtn.textContent = 'Save';
    actSaveBtn.disabled = false;
  }
});

// Cmd/Ctrl+Enter to save
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeActModal(); closeLightbox(); }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    if (actModal.classList.contains('open')) actSaveBtn.click();
  }
});

// ── Lightbox ──────────────────────────────────────────────────────────────────
const lightboxEl    = document.getElementById('lightbox');
const lightboxImg   = document.getElementById('lightbox-img');
const lightboxLink  = document.getElementById('lightbox-link');
const lightboxClose = document.getElementById('lightbox-close');

window.openLightbox = function(imgUrl, driveLink) {
  lightboxImg.src      = imgUrl;
  lightboxLink.href    = driveLink || imgUrl;
  lightboxEl.classList.add('open');
};

function closeLightbox() {
  lightboxEl.classList.remove('open');
  lightboxImg.src = '';
}

lightboxClose.addEventListener('click', closeLightbox);
lightboxEl.addEventListener('click', e => { if (e.target === lightboxEl) closeLightbox(); });

// ── Google Auth ───────────────────────────────────────────────────────────────
window.openAuthModal = function openAuthModal() {
  authErr.textContent = '';
  overlay.classList.add('open');
};

editBtn.addEventListener('click', () => {
  if (currentUser) fbSignOut(auth);
  else openAuthModal();
});


overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
authClose.addEventListener('click', () => overlay.classList.remove('open'));

googleSignIn.addEventListener('click', async () => {
  authErr.textContent = '';
  googleSignIn.textContent = 'Signing in…';
  try {
    const result = await signInWithPopup(auth, provider);
    if (!ALLOWED.includes(result.user.email)) {
      await fbSignOut(auth);
      authErr.textContent = 'Access restricted to Gwen & Christina.';
      googleSignIn.textContent = 'Sign in with Google';
      return;
    }
    overlay.classList.remove('open');
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      authErr.textContent = 'Sign-in failed. Please try again.';
    }
    googleSignIn.textContent = 'Sign in with Google';
  }
});

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user) {
    document.body.classList.add('edit-mode');
    editBtn.classList.add('active');
    editBtnLabel.textContent = '✓ Editing';
    if (user.photoURL) userAvatar.src = user.photoURL;
    await loadAllNotes();
    await loadChecks();
    await loadDriveSettings();
    await loadBookedCosts();
    refreshNoteDisplays();
    setupEditors();
    subscribeExpenses();
    subscribeDays(); // Firestore-backed editable itinerary
  } else {
    document.body.classList.remove('edit-mode');
    editBtn.classList.remove('active');
    editBtnLabel.textContent = '✎ Edit';
    userAvatar.src = '';
    unsubscribeExpenses();
    if (daysUnsub) { daysUnsub(); daysUnsub = null; }
    firestoreDays = {};
    loadLocalExpenses();
    try { driveFolderUrl = localStorage.getItem('japan-drive-url') || ''; } catch {}
    refreshNoteDisplays();
    renderBudget();
    renderConfirmations();
    renderItinerary();
  }
});

// ── Firestore ─────────────────────────────────────────────────────────────────
async function loadAllNotes() {
  await Promise.all(Object.keys(DAYS).map(async id => {
    try {
      const snap = await getDoc(doc(db,'notes',id));
      if (snap.exists()) notes[id] = snap.data().text || '';
    } catch {}
  }));
}

async function loadChecks() {
  try {
    const snap = await getDoc(doc(db,'checks','all'));
    if (snap.exists()) Object.assign(checks, snap.data());
  } catch {}
  renderChecklist();
}

function refreshNoteDisplays() {
  document.querySelectorAll('.notes-read').forEach(el => {
    const ta = el.nextElementSibling;
    if (!ta) return;
    const dayId = ta.dataset.day;
    const text  = notes[dayId] || '';
    el.innerHTML = text
      ? text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>')
      : '<em>No notes yet — sign in to add notes.</em>';
    const dot = document.querySelector(`#card-${dayId} .notes-dot`);
    if (dot) dot.classList.toggle('has-notes', !!text);
  });
  document.querySelectorAll('.notes-edit').forEach(ta => {
    ta.value = notes[ta.dataset.day] || '';
  });
}

function setupEditors() {
  document.querySelectorAll('.notes-edit').forEach(orig => {
    const ta = orig.cloneNode(true);
    orig.parentNode.replaceChild(ta, orig);
    ta.value = notes[ta.dataset.day] || '';
    let timer;
    ta.addEventListener('input', () => {
      clearTimeout(timer);
      const ind = document.getElementById('save-'+ta.dataset.day);
      if (ind) ind.textContent = 'Saving…';
      timer = setTimeout(async () => {
        const dayId = ta.dataset.day;
        const text  = ta.value;
        notes[dayId] = text;
        const dot = document.querySelector(`#card-${dayId} .notes-dot`);
        if (dot) dot.classList.toggle('has-notes', !!text);
        const readEl = ta.previousElementSibling;
        if (readEl) readEl.innerHTML = text
          ? text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>')
          : '<em>No notes yet — sign in to add notes.</em>';
        try {
          await setDoc(doc(db,'notes',dayId), {text, updatedAt:new Date()});
          if (ind) { ind.textContent = 'Saved'; setTimeout(()=>{if(ind)ind.textContent='';}, 1800); }
        } catch {
          if (ind) ind.textContent = 'Could not save.';
        }
      }, 900);
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
// Pre-initialize booked items as checked (they're all confirmed)
const BOOKED_IDS = ['c1','c2','c3','c4','c5','c6','c7','c8','c9'];
BOOKED_IDS.forEach(id => { checks[id] = true; });
try { Object.assign(checks, JSON.parse(localStorage.getItem('japan-checks')||'{}')); } catch {}
loadLocalExpenses();
try { driveFolderUrl = localStorage.getItem('japan-drive-url') || ''; } catch {}

// Try loading drive URL from Firestore even before auth (public read)
getDoc(doc(db, 'settings', 'drive')).then(snap => {
  if (snap.exists() && snap.data().folderUrl) {
    driveFolderUrl = snap.data().folderUrl;
    renderConfirmations();
  }
}).catch(() => {});

renderOverview();
renderConfirmations();
renderChecklist();
renderBudget();
buildDestPills();
updateTripStatus();
updateClock();
fetchRate();

// Auto-open auth modal if redirected from landing with ?signin=1
if (new URLSearchParams(window.location.search).get('signin') === '1') {
  setTimeout(() => openAuthModal(), 400);
}

// Handle #section-N anchor from landing page chapter cards
// After itinerary renders, scroll to the correct destination section
(function handleAnchor() {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#section-')) return;
  const sectionId = hash.slice(1);

  // Switch to itinerary tab first, then scroll
  const itinBtn = document.querySelector('[data-tab="itinerary"]');
  if (itinBtn) itinBtn.click();

  function tryScroll(attempts) {
    const el = document.getElementById(sectionId);
    if (el) {
      const headerH = document.querySelector('header')?.offsetHeight || 0;
      const pillsH  = document.getElementById('destPillsWrap')?.offsetHeight || 0;
      setTimeout(() => {
        window.scrollTo({
          top: el.getBoundingClientRect().top + window.scrollY - headerH - pillsH - 12,
          behavior: 'smooth'
        });
        const pillIndex = parseInt(sectionId.replace('section-', ''));
        const pills = document.querySelectorAll('.dest-pill');
        pills.forEach((p, i) => p.classList.toggle('active', i === pillIndex));
      }, 150);
    } else if (attempts > 0) {
      setTimeout(() => tryScroll(attempts - 1), 200);
    }
  }
  tryScroll(10);
})();

setInterval(updateClock, 30000);
setInterval(updateTripStatus, 60000);
window.addEventListener('scroll', updateActivePill, {passive:true});
