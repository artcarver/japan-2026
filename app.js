import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

// ── Firebase ──────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBCIaluRd8u7M88DbL59Cs_6_sfcb86f0E",
  authDomain: "japan-2026-gc.firebaseapp.com",
  projectId: "japan-2026-gc",
  storageBucket: "japan-2026-gc.firebasestorage.app",
  messagingSenderId: "661642949404",
  appId: "1:661642949404:web:c6a554f3c243171d5a00d9",
  measurementId: "G-BTCE13YE8R"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

// ── State ─────────────────────────────────────────────────────────────────────
let currentUser = null;
const notes = {};

// ── Trip data ─────────────────────────────────────────────────────────────────
// Each day: { id, date, title, location, periods[], tip? }
// Each period: { label, items[] }
// Each item: { time?, text, sub?, type? }
// type: 'booked' = green highlight + BOOKED tag

const DAYS = {
  apr15: {
    id: 'apr15', date: 'Wed · Apr 15', title: 'Depart Los Angeles', location: 'LAX → HND Tokyo',
    periods: [{
      label: 'Flight',
      items: [
        { time: '11:20 AM', text: 'United UA 39 departs LAX', type: 'booked' },
        { text: 'Arrives HND Thursday April 16, 3:05 PM' },
        { text: 'Boeing 787-10 Dreamliner · Economy (K) · Seats 31L & 31J', sub: true },
        { text: 'Confirmation: F354LH', sub: true },
      ]
    }],
    tip: 'Get to LAX by 8:30 AM. Check in online beforehand. No planning needed — settle in and adjust to the time zone.'
  },

  apr16: {
    id: 'apr16', date: 'Thu · Apr 16', title: 'Arrival Day', location: 'Tokyo · Shinjuku',
    periods: [
      {
        label: 'Afternoon',
        items: [
          { time: '3:05 PM', text: 'Arrive HND · clear customs, collect bags' },
          { text: 'Tokyo Monorail or Keikyu Line → Shinjuku (~60–75 min)', sub: true },
          { time: '~5:30 PM', text: 'Check in Hotel Gracery Shinjuku', type: 'booked' },
          { text: 'From 14:00 · Conf: 5594.831.309 · PIN: 6506', sub: true },
        ]
      },
      {
        label: 'Evening — take it easy',
        items: [
          { time: '7:00 PM', text: 'Omoide Yokocho (Memory Lane) · 5 min walk from hotel' },
          { text: 'Tiny smoky yakitori stalls, beer — ease into Japan', sub: true },
          { time: '9:00 PM', text: 'Wander Kabukicho · neon, arcades, vending machines' },
        ]
      }
    ],
    tip: 'Jet lag will hit in waves. Keep tonight very light — you have four full days ahead.'
  },

  apr17: {
    id: 'apr17', date: 'Fri · Apr 17', title: 'Art + Harajuku + Shibuya', location: 'Tokyo · Shinjuku',
    periods: [
      {
        label: 'Morning — teamLab Borderless',
        items: [
          { time: '8:15 AM', text: 'Depart hotel · Metro Hibiya Line → Kamiyacho (Exit 5)' },
          { time: '8:30 AM', text: 'teamLab Borderless · Azabudai Hills', type: 'booked' },
          { text: '¥5,600/person (~$35) · 2 tickets booked · ~3 hrs · no re-entry', sub: true },
          { text: 'Wear pants (mirrored floors) · download teamLab app beforehand', sub: true },
          { text: 'Hit Bubble Universe + Infinite Crystal World first · EN Tea House is extra', sub: true },
          { time: '11:30 AM', text: 'Exit teamLab · explore Azabudai Hills complex' },
        ]
      },
      {
        label: 'Afternoon — Harajuku',
        items: [
          { time: '12:30 PM', text: 'Metro Hibiya Line → Meiji-Jingumae (Harajuku)' },
          { time: '1:00 PM',  text: 'Meiji Shrine · forested approach, very peaceful' },
          { time: '2:30 PM',  text: 'Takeshita-dori · Harajuku street fashion, crepes' },
          { time: '3:30 PM',  text: 'Omotesando · tree-lined boulevard, flagship architecture' },
        ]
      },
      {
        label: 'Evening — Shibuya',
        items: [
          { time: '5:30 PM', text: 'Shibuya Scramble Crossing · view from above first, then walk through' },
          { time: '7:00 PM', text: 'Dinner in Shibuya or Shimokitazawa (1 stop) · izakayas, natural wine bars' },
        ]
      }
    ],
    tip: 'teamLab closes at 10 PM on Apr 17 (extended spring hours). The 8:30 AM slot is the least crowded of the day — crowds don\'t arrive until after 11 AM.'
  },

  apr18: {
    id: 'apr18', date: 'Sat · Apr 18', title: 'Old Tokyo', location: 'Tokyo · Asakusa · Yanaka · Akihabara',
    periods: [
      {
        label: 'Morning — Asakusa',
        items: [
          { time: '7:30 AM', text: 'Arrive Asakusa · Senso-ji Temple before the crowds' },
          { text: 'Tour buses arrive by 10 AM — early light through incense smoke is worth it', sub: true },
          { time: '8:30 AM', text: 'Nakamise-dori · street snacks: ningyo-yaki, age-manju, melonpan' },
          { time: '9:30 AM', text: 'Kappabashi-dori · restaurant supply street, plastic food models' },
        ]
      },
      {
        label: 'Afternoon — Yanaka + Akihabara',
        items: [
          { time: '11:00 AM', text: 'Yanaka · best-preserved traditional neighborhood in Tokyo' },
          { text: 'Yanaka Cemetery (cherry trees) · Yanaka Ginza covered shopping street', sub: true },
          { time: '1:00 PM',  text: 'Lunch in Yanaka · local tofu shops, small restaurants' },
          { time: '2:30 PM',  text: 'Akihabara · 15 min walk · electronics, retro games, arcade floors' },
        ]
      },
      {
        label: 'Evening — Shinjuku',
        items: [
          { time: '7:00 PM', text: 'Fuunji ramen · exceptional tsukemen (dipping ramen) · short queue likely' },
          { time: '8:30 PM', text: 'Golden Gai · cluster of tiny themed bars (jazz, film, rock) · just wander in' },
        ]
      }
    ],
    tip: null
  },

  apr19: {
    id: 'apr19', date: 'Sun · Apr 19', title: 'Kamakura Day Trip', location: 'Tokyo → Kamakura (~1 hr)',
    periods: [
      {
        label: 'Morning — Kita-Kamakura',
        items: [
          { time: '8:00 AM', text: 'Depart Shinjuku · JR Shonan-Shinjuku Line → Kita-Kamakura (~1 hr · ¥920/~$6)' },
          { time: '9:00 AM', text: 'Kita-Kamakura · quieter and more atmospheric than main station' },
          { time: '9:15 AM', text: 'Engaku-ji Temple · cedar forest, zen garden, very peaceful' },
          { time: '10:00 AM', text: 'Walk the trail south toward Kamakura (20–30 min scenic walk)' },
        ]
      },
      {
        label: 'Afternoon — Kamakura',
        items: [
          { time: '11:00 AM', text: 'Great Buddha · Kotoku-in · ¥300 (~$2) · can enter the hollow bronze statue' },
          { time: '12:00 PM', text: 'Hase-dera Temple · hillside paths, ocean views, cave system · ¥400 (~$3)' },
          { time: '1:00 PM',  text: 'Lunch near Hase Station · shirasu (whitebait) dishes, a local specialty' },
          { time: '2:30 PM',  text: 'Optional: Tsurugaoka Hachimangu Shrine · broad approach, multiple torii gates' },
        ]
      },
      {
        label: 'Evening — Return + Luggage Forwarding',
        items: [
          { time: '4:00 PM', text: 'Depart Kamakura · return to Shinjuku by 5:30 PM' },
          { time: '6:00 PM', text: 'Arrange takkyubin at hotel front desk tonight', type: 'booked' },
          { text: 'Send luggage: Hotel Gracery Shinjuku → Hotel Granvia Kyoto', sub: true },
          { text: 'Sent Apr 19 arrives Apr 21 · ~¥1,500–2,000/bag (~$10–13) · travel light tomorrow', sub: true },
          { time: '7:30 PM', text: 'Last dinner in Shinjuku · depachika or local ramen' },
        ]
      }
    ],
    tip: 'Weekends in Kamakura are busy — arriving before 10 AM puts you ahead of the tour groups.'
  },

  apr20: {
    id: 'apr20', date: 'Mon · Apr 20', title: 'Fuji Excursion → Kawaguchiko → Hakone', location: 'Shinjuku → Kawaguchiko → Gora',
    periods: [
      {
        label: 'Morning — Fuji Excursion',
        items: [
          { time: '8:30 AM', text: 'Fuji-Excursion 7 departs Shinjuku', type: 'booked' },
          { text: '¥8,400 total (~$53) · Car 3, Seats 13-C & 13-D · Res: E77821', sub: true },
          { time: '10:26 AM', text: 'Arrive Kawaguchiko Station' },
        ]
      },
      {
        label: 'Mid-Morning — Kawaguchiko',
        items: [
          { time: '10:30 AM', text: 'Oishi Park · north shore of Lake Kawaguchi' },
          { text: 'Best Fuji reflections + late cherry blossoms · the classic Fuji-over-water shot', sub: true },
          { time: '12:00 PM', text: 'Optional: Chureito Pagoda (30 min to Fujiyoshida · ~400 steps)' },
          { text: 'Iconic 5-story pagoda framing Fuji with blossoms', sub: true },
        ]
      },
      {
        label: 'Afternoon — Transit to Hakone',
        items: [
          { time: '1:30 PM', text: 'Depart Kawaguchiko · bus via Gotemba → Gora (~2.5 hrs)' },
          { text: 'Day bags only — luggage forwarded to Kyoto · scenic mountain bus', sub: true },
          { time: '4:00 PM', text: 'Arrive Gora · check in Tensui Saryo', type: 'booked' },
          { text: 'Reservation: IK1516984808 · check-in 15:00–21:30', sub: true },
        ]
      },
      {
        label: 'Evening',
        items: [
          { time: '4:30 PM', text: 'Optional: Hakone Open Air Museum · 10 min walk · closes 5 PM · ¥2,000 (~$13)' },
          { text: 'Timing is tight — save for first thing tomorrow morning instead', sub: true },
          { time: '5:30 PM', text: 'Ryokan · change into yukata, explore property, private onsen' },
          { time: '7:45 PM', text: 'Kaiseki dinner at Tensui Saryo — 19:45', type: 'booked' },
          { text: 'Dinner and breakfast included · 10-course traditional kaiseki', sub: true },
        ]
      }
    ],
    tip: 'Morning is the best window for Mt. Fuji views before clouds build. The train ride itself may offer beautiful Fuji sightlines.'
  },

  apr21: {
    id: 'apr21', date: 'Tue · Apr 21', title: 'The Hakone Loop', location: 'Hakone · Gora → Owakudani → Lake Ashi',
    periods: [
      {
        label: 'Morning — Open Air Museum + Ropeway',
        items: [
          { time: '9:00 AM',  text: 'Hakone Open Air Museum · opens 9 AM · ¥2,000 (~$13)' },
          { text: '10 min walk from ryokan · outdoor sculptures, Picasso Pavilion (300+ works), foot onsen inside', sub: true },
          { text: 'Allow ~2 hours · last admission 4:30 PM', sub: true },
          { time: '11:00 AM', text: 'Hakone Tozan Railway: Gora → Sounzan (10 min)' },
          { time: '11:15 AM', text: 'Ropeway: Sounzan → Owakudani (~25 min) · covered by Hakone Free Pass' },
          { text: 'Best Fuji views in the morning before clouds build', sub: true },
        ]
      },
      {
        label: 'Midday — Owakudani + Lake Ashi',
        items: [
          { time: '12:00 PM', text: 'Owakudani volcanic valley · sulfur steam vents · black eggs' },
          { text: '¥500 for 5 eggs (~$3) · supposedly add 7 years per egg', sub: true },
          { time: '1:00 PM',  text: 'Ropeway continues: Owakudani → Togendai on Lake Ashi (~25 min)' },
          { time: '1:30 PM',  text: 'Lake Ashi sightseeing boat → Moto-Hakone (~30 min · Hakone Free Pass)' },
          { text: 'Fuji views across the water · boats styled as pirate ships', sub: true },
        ]
      },
      {
        label: 'Afternoon — Hakone Shrine + Return',
        items: [
          { time: '2:30 PM', text: 'Hakone Shrine · 10 min walk from Moto-Hakone pier' },
          { text: 'Torii gate rising from the lake · cedar forest approach · one of Japan\'s great shrine settings', sub: true },
          { time: '3:30 PM', text: 'Lunch near Moto-Hakone · tofu cuisine, soba' },
          { time: '5:00 PM', text: 'Head back to Gora · Hakone Tozan Railway from Hakone-Yumoto' },
          { time: '5:30 PM', text: 'Tensui Saryo · private open-air onsen' },
        ]
      },
      {
        label: 'Evening',
        items: [
          { time: '7:45 PM', text: 'Kaiseki dinner at Tensui Saryo — 19:45', type: 'booked' },
        ]
      }
    ],
    tip: 'Buy the Hakone Free Pass at Gora Station — covers the Tozan Railway, ropeway, and Lake Ashi boat. ~¥4,000 (~$25) for the 2-day version.'
  },

  apr22: {
    id: 'apr22', date: 'Wed · Apr 22', title: 'Depart Hakone → Arrive Kyoto', location: 'Gora → Odawara → Kyoto',
    periods: [
      {
        label: 'Morning — Checkout + Shinkansen',
        items: [
          { time: '7:00 AM',  text: 'Breakfast at ryokan · included' },
          { time: '9:00 AM',  text: 'Check out Tensui Saryo · must leave by 9:00 AM to make the train' },
          { time: '9:05 AM',  text: 'Hakone Tozan Railway: Gora → Hakone-Yumoto (~35 min)' },
          { time: '9:45 AM',  text: 'Local train: Hakone-Yumoto → Odawara (~15 min)' },
          { time: '10:11 AM', text: 'HIKARI 637 departs Odawara', type: 'booked' },
          { text: '¥23,800 total (~$150) · Res: 2002 · Series N700 · seats TBD by email', sub: true },
          { time: '12:12 PM', text: 'Arrive Kyoto Station' },
        ]
      },
      {
        label: 'Afternoon — Arrive Kyoto',
        items: [
          { time: '12:15 PM', text: 'Check in Hotel Granvia Kyoto', type: 'booked' },
          { text: 'Above Kyoto Station · Conf: #23151SF060529 · luggage arrives today from takkyubin', sub: true },
          { time: '2:30 PM',  text: 'Fushimi Inari Taisha · 5 min by JR from Kyoto Station · FREE entry, open 24 hrs' },
          { text: 'Preview visit only — lower gates + Senbon Torii section · save energy for tomorrow 6 AM', sub: true },
        ]
      },
      {
        label: 'Evening',
        items: [
          { time: '5:30 PM', text: 'Nishiki Market · closes 5:30 PM weekdays · go early or skip to tomorrow' },
          { text: '"Kyoto\'s Kitchen" · pickles, matcha sweets, obanzai dishes', sub: true },
          { time: '7:30 PM', text: 'Dinner in Gion or Pontocho alley · riverside atmospheric street' },
        ]
      }
    ],
    tip: 'Check out by 9 AM is essential. The full Fushimi Inari hike is planned for tomorrow at 6 AM — the single best timing decision of the Kyoto trip.'
  },

  apr23: {
    id: 'apr23', date: 'Thu · Apr 23', title: 'Fushimi Inari + Higashiyama', location: 'Kyoto · Southern + Eastern Kyoto',
    periods: [
      {
        label: 'Very Early Morning — Fushimi Inari',
        items: [
          { time: '5:45 AM', text: 'Depart hotel · JR Nara Line → Inari Station (5 min · ¥150/~$1)' },
          { time: '6:00 AM', text: 'Arrive Fushimi Inari Taisha · FREE · open 24 hrs' },
          { text: 'By 8 AM it\'s crowded · by 10 AM shoulder-to-shoulder · 6 AM is transformative', sub: true },
          { text: 'Hike through the Senbon Torii · crowds thin dramatically above the switchbacks', sub: true },
          { text: 'Full hike to summit and back ~2 hrs · Yotsutsuji crossroads has best city views', sub: true },
          { time: '8:30 AM', text: 'Descend · grab breakfast from street stalls outside the entrance' },
        ]
      },
      {
        label: 'Late Morning — Higashiyama',
        items: [
          { time: '10:00 AM', text: 'Bus or taxi to Higashiyama district' },
          { time: '10:30 AM', text: 'Ninenzaka + Sannenzaka · preserved stone-paved machiya streets' },
          { text: 'Cafes, ceramics, matcha soft serve · most atmospheric streets in Kyoto', sub: true },
          { time: '11:30 AM', text: 'Kiyomizudera Temple · ¥500 (~$3) · iconic wooden stage over the valley' },
        ]
      },
      {
        label: 'Afternoon — Gion + Philosopher\'s Path',
        items: [
          { time: '1:00 PM',  text: 'Lunch in Higashiyama · tofu kaiseki, soba, or matcha cafe' },
          { time: '2:30 PM',  text: 'Gion district · preserved geisha quarter · best explored on foot' },
          { text: 'Hanamikoji Street · watch for geiko/maiko in early evening', sub: true },
          { time: '4:00 PM',  text: 'Philosopher\'s Path · 2 km canal walk lined with cherry trees' },
          { text: 'Late April may still have blossoms · cafe stops along the route', sub: true },
          { time: '5:30 PM',  text: 'Nanzenji Temple at the south end · free grounds' },
        ]
      },
      {
        label: 'Evening',
        items: [
          { time: '7:00 PM', text: 'Dinner in Gion or Pontocho · book in advance for this area' },
        ]
      }
    ],
    tip: '6 AM is the single most important timing call of the Kyoto trip. The difference between Fushimi Inari at 6 AM and 10 AM is the difference between serene and a crush of tourists.'
  },

  apr24: {
    id: 'apr24', date: 'Fri · Apr 24', title: 'Arashiyama + Nishiki Market', location: 'Kyoto · Western + Central',
    periods: [
      {
        label: 'Early Morning — Arashiyama Bamboo Grove',
        items: [
          { time: '7:00 AM', text: 'JR Sagano Line: Kyoto Station → Saga-Arashiyama (~15 min · ¥240/~$2)' },
          { time: '7:30 AM', text: 'Arashiyama Bamboo Grove · FREE · open 24 hrs' },
          { text: 'Tour groups arrive by 9 AM · 7:30 AM is dramatically quieter', sub: true },
          { text: '400m path · towering moso bamboo · morning light filters through the canopy', sub: true },
          { time: '8:30 AM', text: 'Tenryu-ji Temple · opens 8:30 AM · ¥500 (~$3) for garden' },
          { text: 'UNESCO · exceptional zen garden with borrowed Arashiyama mountain scenery', sub: true },
          { time: '9:30 AM', text: 'Okochi-Sanso Villa · ¥1,000 (~$6) includes matcha + sweet' },
          { text: 'Hilltop estate · panoramic views · one of the quietest spots in Arashiyama', sub: true },
        ]
      },
      {
        label: 'Midday — Arashiyama',
        items: [
          { time: '11:00 AM', text: 'Togetsukyo Bridge · iconic bridge over the Oi River' },
          { time: '11:30 AM', text: 'Lunch in Arashiyama · yudofu (hot tofu), matcha soba, or riverside cafe' },
        ]
      },
      {
        label: 'Afternoon — Central Kyoto',
        items: [
          { time: '2:00 PM', text: 'Return to central Kyoto · bus or JR' },
          { time: '2:30 PM', text: 'Nishiki Market · go before 3 PM · closes ~5:30 PM weekdays, 4:30 PM Saturday' },
          { text: 'Kyoto\'s Kitchen · sakura-themed sweets in April · pickles · matcha soft serve', sub: true },
          { time: '4:00 PM', text: 'Teramachi + Shinkyogoku shopping arcades · adjacent to Nishiki' },
        ]
      },
      {
        label: 'Evening',
        items: [
          { time: '6:30 PM', text: 'Gion at dusk · best light for wooden machiya architecture' },
          { time: '7:30 PM', text: 'Dinner in Pontocho or Gion' },
        ]
      }
    ],
    tip: null
  },

  apr25: {
    id: 'apr25', date: 'Sat · Apr 25', title: 'Nara Day Trip + Kinkaku-ji', location: 'Kyoto → Nara → Northern Kyoto',
    periods: [
      {
        label: 'Morning — Nara',
        items: [
          { time: '8:30 AM', text: 'JR Nara Line: Kyoto Station → Nara (45 min · ¥760/~$5)' },
          { time: '9:30 AM', text: 'Nara Park · hundreds of freely roaming deer · ¥200 deer crackers' },
          { time: '10:00 AM', text: 'Todai-ji Temple · world\'s largest wooden building · giant bronze Buddha' },
          { text: '¥600 (~$4) · UNESCO · genuinely awe-inspiring scale', sub: true },
          { time: '11:30 AM', text: 'Kasuga Taisha Shrine · forest setting · lantern-lined paths' },
          { time: '12:30 PM', text: 'Lunch in Nara · kakinoha-zushi (persimmon-leaf sushi)' },
          { time: '2:00 PM',  text: 'Return to Kyoto · JR Nara Line' },
        ]
      },
      {
        label: 'Afternoon — Northern Kyoto',
        items: [
          { time: '3:00 PM', text: 'Kinkaku-ji (Golden Pavilion) · ¥500 (~$3)' },
          { text: 'Worth seeing once despite the crowds · best on a clear afternoon', sub: true },
          { time: '4:00 PM', text: 'Ryoan-ji Temple · world-famous rock garden · ¥600 (~$4)' },
          { text: '15 stones on raked gravel · less crowded than Kinkaku-ji · deeply meditative', sub: true },
        ]
      },
      {
        label: 'Evening — Last Night in Kyoto',
        items: [
          { time: '6:00 PM', text: 'Return to hotel · freshen up' },
          { time: '7:00 PM', text: 'Dinner · Kawaramachi or Shijo area · izakaya, sake bar, or splurge kaiseki' },
        ]
      }
    ],
    tip: 'Saturdays in April are busy. Go to Nara before 10 AM and Kinkaku-ji after 3 PM when tour buses thin out. Golden Week starts April 29 — you leave just in time.'
  },

  apr26: {
    id: 'apr26', date: 'Sun · Apr 26', title: 'Depart Kyoto → Kanazawa', location: 'Kyoto → Kanazawa',
    periods: [
      {
        label: 'Morning — Checkout',
        items: [
          { time: '9:00 AM',  text: 'Breakfast at hotel or nearby' },
          { time: '10:00 AM', text: 'Check out Hotel Granvia Kyoto · Conf: #23151SF060529', type: 'booked' },
        ]
      },
      {
        label: 'Transit to Kanazawa',
        items: [
          { text: 'Thunderbird Limited Express: Kyoto → Kanazawa (~2 hrs · ~¥6,000–7,000/~$38–44)' },
          { text: 'Multiple departures · check timetable · aim for mid-morning', sub: true },
        ]
      },
      {
        label: 'Afternoon — Arrive Kanazawa',
        items: [
          { time: '~2:00 PM', text: 'Arrive Kanazawa Station' },
          { time: '3:00 PM',  text: 'Check in Hotel Intergate Kanazawa', type: 'booked' },
          { text: 'Conf: 20260125110822242 · 2-5 Takaokamachi · breakfast buffet included', sub: true },
          { time: '4:30 PM',  text: 'Higashi Chaya District · 15 min walk · Japan\'s best-preserved geisha quarter outside Kyoto' },
          { text: 'Traditional ochaya teahouses, gold leaf crafts, wooden facades', sub: true },
        ]
      },
      {
        label: 'Evening',
        items: [
          { time: '7:00 PM', text: 'Dinner · Nodoguro (blackthroat seaperch), sweet shrimp · Korinbo or Katamachi area' },
        ]
      }
    ],
    tip: null
  },

  apr27: {
    id: 'apr27', date: 'Mon · Apr 27', title: 'Kanazawa Full Day', location: 'Kenroku-en · 21st Century Museum · Omicho · Nagamachi',
    periods: [
      {
        label: 'Morning — Kenroku-en + Castle',
        items: [
          { time: '7:00 AM', text: 'Kenroku-en Garden · opens 7 AM · ¥320 (~$2) · free early entry from 4 AM' },
          { text: 'One of Japan\'s three great gardens · 1.5–2 hrs · Kasumigaike Pond + Kotojitoro lantern', sub: true },
          { time: '8:30 AM', text: 'Kanazawa Castle Park · directly adjacent · free grounds' },
          { text: '¥310 (~$2) for interior buildings · impressive carpentry and stone walls', sub: true },
        ]
      },
      {
        label: 'Mid-Morning — 21st Century Museum',
        items: [
          { time: '10:00 AM', text: '21st Century Museum of Contemporary Art · opens 10 AM' },
          { text: 'Free exchange zone · ~¥1,400 (~$9) for exhibitions · CLOSED MONDAYS — verify!', sub: true },
          { text: 'Swimming Pool (Leandro Erlich) + Blue Planet Sky (James Turrell) · both unmissable', sub: true },
        ]
      },
      {
        label: 'Afternoon — Omicho + Nagamachi',
        items: [
          { time: '12:00 PM', text: 'Omicho Market · Kanazawa\'s kitchen · 9 AM – 5 PM' },
          { text: 'Kaisendon (seasonal seafood rice bowl) · arrive by noon before lines grow', sub: true },
          { text: 'Sweet shrimp, sea urchin, crab · popular items sell out before noon', sub: true },
          { time: '2:00 PM',  text: 'Nagamachi Samurai District · preserved earthen walls, moats, residences' },
          { text: 'Nomura Clan Samurai House · ¥550 (~$4) · beautiful interior gardens', sub: true },
          { time: '3:30 PM',  text: 'Higashi Chaya · if not fully explored yesterday' },
        ]
      },
      {
        label: 'Evening',
        items: [
          { time: '6:30 PM', text: 'Dinner · Kanazawa seafood · Nodoguro, crab, sweet shrimp · izakaya near Omicho' },
        ]
      }
    ],
    tip: 'Apr 27 is a Monday — the 21st Century Museum is typically closed Mondays. Verify on their site before the trip. If closed, swap with Nagamachi Yuzen-kan or more time at Kenroku-en.'
  },

  apr28: {
    id: 'apr28', date: 'Tue · Apr 28', title: 'Depart Kanazawa → Tokyo Ginza', location: 'Kanazawa → Tokyo · Ginza',
    periods: [
      {
        label: 'Morning — Checkout + Shinkansen',
        items: [
          { time: '8:00 AM',  text: 'Breakfast buffet at Hotel Intergate · included' },
          { time: '10:00 AM', text: 'Check out · by 11:00 AM' },
          { text: 'Hokuriku Shinkansen: Kanazawa → Tokyo (Ueno) · ~2.5 hrs · ~¥14,000 (~$88)', sub: true },
          { text: 'Multiple departures · check timetable and book', sub: true },
        ]
      },
      {
        label: 'Afternoon — Arrive Tokyo Ginza',
        items: [
          { time: '~1:00 PM', text: 'Arrive Tokyo · transfer to Ginza' },
          { time: '3:00 PM',  text: 'Check in Quintessa Hotel Tokyo Ginza', type: 'booked' },
          { text: 'Conf: 6519361226 · PIN: 9235 · Ginza 4-11-4 · breakfast included', sub: true },
          { time: '2:30 PM',  text: 'Hamarikyu Gardens · 10 min walk · ¥300 (~$2) · traditional garden on Tokyo Bay' },
          { time: '4:00 PM',  text: 'Ginza main streets · Itoya stationery · Ginza Six · window shopping' },
        ]
      },
      {
        label: 'Evening — Final Night',
        items: [
          { time: '6:30 PM', text: 'Tsukiji Outer Market area for dinner · sushi, grilled seafood, sake bars' },
          { time: '8:00 PM', text: 'Ginza evening stroll · excellent last night in Japan' },
        ]
      }
    ],
    tip: 'Pack tonight and confirm you have everything. Flight departs HND at 6:10 PM tomorrow — leave the hotel by 12:30 PM.'
  },

  apr29: {
    id: 'apr29', date: 'Wed · Apr 29', title: 'Final Morning + Depart', location: 'Tokyo Ginza → HND → LAX',
    periods: [
      {
        label: 'Morning — Tsukiji Farewell',
        items: [
          { time: '7:30 AM',  text: 'Tsukiji Outer Market · 10 min walk · classic Tokyo farewell breakfast' },
          { text: 'Fresh sushi, tamagoyaki, grilled scallops, matcha · best before 10 AM', sub: true },
          { time: '9:00 AM',  text: 'Hamarikyu Gardens (if missed yesterday) or final Ginza wander' },
          { time: '10:00 AM', text: 'Return to hotel · collect luggage' },
        ]
      },
      {
        label: 'Afternoon — Depart',
        items: [
          { time: '12:30 PM', text: 'Depart hotel for Haneda Airport · no later than 12:30 PM' },
          { text: 'Keikyu Line from Higashi-Ginza → HND Terminal 3 (~30 min · ¥300/~$2)', sub: true },
          { text: 'Allow 2.5–3 hours before departure for international check-in + security', sub: true },
          { time: '6:10 PM',  text: 'United UA 38 departs HND', type: 'booked' },
          { text: 'HND → LAX · 10 hrs 5 min · Seats 31J & 31L · Conf: F354LH', sub: true },
          { text: 'Arrives LAX Wednesday April 29, 12:15 PM (same day, crossing date line)', sub: true },
        ]
      }
    ],
    tip: 'Golden Week officially begins today — you\'re flying out. Well timed. The airports will be busy but manageable with a 3-hour buffer.'
  }
};

// ── Destination groups ────────────────────────────────────────────────────────
const GROUPS = [
  { label: 'TOKYO',                  dates: 'APR 15 – 20', ids: ['apr15','apr16','apr17','apr18','apr19'] },
  { label: 'KAWAGUCHIKO + HAKONE',   dates: 'APR 20 – 22', ids: ['apr20','apr21'] },
  { label: 'KYOTO',                  dates: 'APR 22 – 26', ids: ['apr22','apr23','apr24','apr25'] },
  { label: 'KANAZAWA',               dates: 'APR 26 – 28', ids: ['apr26','apr27'] },
  { label: 'TOKYO · GINZA',          dates: 'APR 28 – 29', ids: ['apr28','apr29'] },
];

// ── Confirmations data ────────────────────────────────────────────────────────
const CONFIRMATIONS = {
  flights: [
    {
      name: 'Outbound · LAX → Tokyo HND',
      items: [
        { key: 'Flight',        val: 'United UA 39' },
        { key: 'Date',          val: 'Wednesday April 15, 2026' },
        { key: 'Departs',       val: 'LAX 11:20 AM' },
        { key: 'Arrives',       val: 'HND Thursday April 16, 3:05 PM' },
        { key: 'Duration',      val: '11 hrs 45 min' },
        { key: 'Seats',         val: '31L (Gwendalynn)  ·  31J (Christina)' },
        { key: 'Aircraft',      val: 'Boeing 787-10 Dreamliner' },
        { key: 'Class',         val: 'United Economy (K)' },
        { key: 'Confirmation',  val: 'F354LH', hi: true },
      ]
    },
    {
      name: 'Return · Tokyo HND → LAX',
      items: [
        { key: 'Flight',        val: 'United UA 38' },
        { key: 'Date',          val: 'Wednesday April 29, 2026' },
        { key: 'Departs',       val: 'HND 6:10 PM' },
        { key: 'Arrives',       val: 'LAX 12:15 PM (same day)' },
        { key: 'Duration',      val: '10 hrs 5 min' },
        { key: 'Seats',         val: '31J (Gwendalynn)  ·  31L (Christina)' },
        { key: 'Aircraft',      val: 'Boeing 787-10 Dreamliner' },
        { key: 'Class',         val: 'United Economy (K)' },
        { key: 'Confirmation',  val: 'F354LH', hi: true },
      ]
    }
  ],
  hotels: [
    {
      name: 'Hotel Gracery Shinjuku · Tokyo',
      items: [
        { key: 'Check-in',      val: 'Thu Apr 16 from 14:00' },
        { key: 'Check-out',     val: 'Mon Apr 20 by 11:00' },
        { key: 'Nights',        val: '4' },
        { key: 'Room',          val: 'Standard Twin Room — Non-Smoking' },
        { key: 'Confirmation',  val: '5594.831.309', hi: true },
        { key: 'PIN',           val: '6506', hi: true },
        { key: 'Address',       val: 'Kabukicho 1-19-1, Shinjuku, Tokyo 160-0021' },
        { key: 'Phone',         val: '+81 3 6833 1111' },
        { key: 'Price',         val: '~¥200,692 (~$1,261)' },
        { key: 'Cancel',        val: 'Free 1 day before arrival · no-show = full charge' },
        { key: 'Note',          val: 'Godzilla Head terrace (8F) currently suspended' },
      ]
    },
    {
      name: 'Tensui Saryo · Gora, Hakone',
      items: [
        { key: 'Check-in',      val: 'Mon Apr 20, 15:00–21:30 (estimated arrival 17:30)' },
        { key: 'Check-out',     val: 'Wed Apr 22 by 10:00' },
        { key: 'Nights',        val: '2' },
        { key: 'Room',          val: 'Detached Type-A · Onsen + Foot Bath · Japanese-Western Style' },
        { key: 'Plan',          val: 'Early Bird 20 × Basic Kaiseki · Dinner 19:45 · Breakfast included' },
        { key: 'Reservation',   val: 'IK1516984808', hi: true },
        { key: 'Verification',  val: '0F35443D931C12B' },
        { key: 'Address',       val: '1320-276 Gora, Hakone-machi, Ashigarashimo-gun' },
        { key: 'Phone',         val: '+81-570-062-302' },
        { key: 'Email',         val: 'tensui-saryo@relo.jp' },
        { key: 'Price',         val: '¥126,340 (~$794) incl. tax · after ¥14,020 points discount' },
        { key: 'Hot spring tax', val: '¥150/person aged 12+ · pay at property' },
        { key: 'Cancel',        val: 'Free until 8 days before · 30% from 7 days · 50% from 2 · 80% same day' },
        { key: 'Access',        val: '2–3 min walk from Gora Station (Hakone Tozan Railway)' },
      ]
    },
    {
      name: 'Hotel Granvia Kyoto',
      items: [
        { key: 'Check-in',      val: 'Wed Apr 22, 2026' },
        { key: 'Check-out',     val: 'Sun Apr 26, 2026' },
        { key: 'Nights',        val: '4' },
        { key: 'Room',          val: 'Granvia Deluxe Twin Room — Non-Smoking' },
        { key: 'Confirmation',  val: '#23151SF060529', hi: true },
        { key: 'Address',       val: 'JR Kyoto Station (Karasuma), 600-8216 Kyoto' },
        { key: 'Phone',         val: '+81-75-344-8888' },
        { key: 'Price',         val: '¥268,256 (~$1,686) total incl. tax and service' },
        { key: 'Rate breakdown', val: 'Apr 22–23: ¥62,814/night · Apr 24: ¥67,064 · Apr 25: ¥75,564' },
        { key: 'Acc. tax',      val: 'Not included · ~¥4,000/person/night · pay at hotel' },
        { key: 'Cancel',        val: 'Notify by 16:00 JST day before arrival to avoid full charge' },
        { key: 'Luggage',       val: 'Takkyubin arriving from Gracery Shinjuku (sent Apr 19, arrives Apr 21)' },
      ]
    },
    {
      name: 'Hotel Intergate Kanazawa',
      items: [
        { key: 'Check-in',      val: 'Sun Apr 26 from 15:00' },
        { key: 'Check-out',     val: 'Tue Apr 28 by 11:00' },
        { key: 'Nights',        val: '2' },
        { key: 'Room',          val: 'Superior Twin Room — Non-Smoking' },
        { key: 'Amenities',     val: 'Breakfast Buffet included' },
        { key: 'Confirmation',  val: '20260125110822242', hi: true },
        { key: 'Expedia',       val: '73356721260247' },
        { key: 'Address',       val: '2-5 Takaokamachi, Kanazawa, Ishikawa 920-0864' },
        { key: 'Price',         val: '¥39,004 (~$245) total incl. taxes · pay at property' },
        { key: 'Cancel',        val: 'Free until Apr 22, 11:59 PM property time · 100% charge after' },
      ]
    },
    {
      name: 'Quintessa Hotel Tokyo Ginza',
      items: [
        { key: 'Check-in',      val: 'Tue Apr 28 from 15:00' },
        { key: 'Check-out',     val: 'Wed Apr 29 by 11:00' },
        { key: 'Nights',        val: '1' },
        { key: 'Room',          val: 'Hollywood Twin Room' },
        { key: 'Amenities',     val: 'Breakfast included' },
        { key: 'Confirmation',  val: '6519361226', hi: true },
        { key: 'PIN',           val: '9235', hi: true },
        { key: 'Address',       val: 'Chuo-ku Ginza 4-11-4, Tokyo' },
        { key: 'Phone',         val: '+81 3-6264-1351' },
        { key: 'Price',         val: '¥24,713 (~$155) · charged Apr 25 to card on file' },
        { key: 'Cancel',        val: 'Free until Apr 26, 11:59 PM JST · 100% charge after' },
      ]
    }
  ],
  trains: [
    {
      name: 'Fuji-Excursion 7 · Tokyo → Kawaguchiko',
      items: [
        { key: 'Train',         val: 'Fuji-Excursion 7' },
        { key: 'Date',          val: 'Monday April 20, 2026' },
        { key: 'Route',         val: 'Shinjuku 8:30 AM → Kawaguchiko 10:26 AM' },
        { key: 'Seats',         val: 'Car 3, Seat 13-C (Gwendalynn)  ·  Seat 13-D (Christina)' },
        { key: 'Facility',      val: 'Reserved seat' },
        { key: 'Reservation',   val: 'E77821', hi: true },
        { key: 'Pickup code',   val: '24492390994521288' },
        { key: 'Fare',          val: '¥8,400 (~$53) total for 2 adults' },
        { key: 'Ticket pickup', val: 'Use QR code or pickup code at ticket machine before travel day' },
        { key: 'JR East member', val: 'Gwendalynn Hanalei Stilson · #411313294' },
      ]
    },
    {
      name: 'Shinkansen HIKARI 637 · Odawara → Kyoto',
      items: [
        { key: 'Train',         val: 'HIKARI 637 · Series N700 · 16 cars' },
        { key: 'Date',          val: 'Wednesday April 22, 2026' },
        { key: 'Route',         val: 'Odawara 10:11 AM → Kyoto 12:12 PM' },
        { key: 'Class',         val: 'Ordinary · smart EX' },
        { key: 'Reservation',   val: '2002', hi: true },
        { key: 'Membership ID', val: '9007241665' },
        { key: 'Passengers',    val: '2 Adults' },
        { key: 'Fare',          val: '¥23,800 (~$150) total' },
        { key: 'Seat info',     val: 'TBD · email notification expected after Mar 22, 2026 at 8:00 AM' },
        { key: 'Note',          val: 'Shinkansen only · cannot board conventional lines with this ticket' },
      ]
    }
  ]
};

// ── DOM refs ──────────────────────────────────────────────────────────────────
const itineraryEl  = document.getElementById('itinerary');
const confirmEl    = document.getElementById('confirmations');
const editBtn      = document.getElementById('editBtn');
const overlay      = document.getElementById('overlay');
const modalClose   = document.getElementById('modalClose');
const authEmail    = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');
const authSubmit   = document.getElementById('authSubmit');
const authErr      = document.getElementById('authErr');

// ── Tab switching ─────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(btn.dataset.tab).classList.add('active');
  });
});

// ── Render: Itinerary ─────────────────────────────────────────────────────────
function renderItinerary() {
  itineraryEl.innerHTML = GROUPS.map(g => `
    <div class="dest-section">
      <div class="dest-label">${g.label} &nbsp;·&nbsp; ${g.dates}</div>
      ${g.ids.map(id => renderDay(DAYS[id])).join('')}
    </div>
  `).join('');

  document.querySelectorAll('.day-header').forEach(h => {
    h.addEventListener('click', () => h.parentElement.classList.toggle('expanded'));
  });
}

function renderDay(d) {
  const periods = d.periods.map(p => `
    <div class="period">
      <div class="period-label">${p.label}</div>
      ${p.items.map(renderItem).join('')}
    </div>
  `).join('');

  const tip = d.tip ? `<div class="tip-block">${d.tip}</div>` : '';

  const noteText  = notes[d.id] || '';
  const noteRead  = noteText
    ? noteText.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>')
    : '<em>No notes yet — sign in to add notes.</em>';

  return `
    <div class="day-card" id="card-${d.id}">
      <div class="day-header">
        <div class="day-header-left">
          <span class="day-date">${d.date}</span>
          <div>
            <div class="day-title">${d.title}</div>
            <div class="day-location">${d.location}</div>
          </div>
        </div>
        <span class="day-toggle">&#9660;</span>
      </div>
      <div class="day-body">
        ${periods}
        ${tip}
        <div class="notes-section">
          <div class="notes-label">Notes</div>
          <div class="notes-read">${noteRead}</div>
          <textarea class="notes-edit" data-day="${d.id}" placeholder="Add notes, restaurant picks, reminders&#8230;">${escHtml(noteText)}</textarea>
          <div class="save-indicator" id="save-${d.id}"></div>
        </div>
      </div>
    </div>
  `;
}

function renderItem(item) {
  const cls  = item.type === 'booked' ? ' booked' : '';
  const tag  = item.type === 'booked' ? '<span class="tag tag-booked">BOOKED</span>' : '';
  const time = item.time ? `<span class="act-time">${item.time}</span>` : `<span class="act-time"></span>`;
  const sub  = item.sub  ? `<div class="act-sub">${item.text === item.sub ? '' : item.sub}</div>` : '';
  return `
    <div class="act${cls}">
      ${time}
      <div class="act-body">
        <div class="act-text">${item.text}${tag}</div>
        ${item.sub ? `<div class="act-sub">${item.sub}</div>` : ''}
      </div>
    </div>
  `;
}

// ── Render: Confirmations ─────────────────────────────────────────────────────
function renderConfirmations() {
  const sections = [
    { key: 'flights', label: 'FLIGHTS' },
    { key: 'hotels',  label: 'HOTELS' },
    { key: 'trains',  label: 'TRAINS' },
  ];

  confirmEl.innerHTML = sections.map(s => `
    <div class="conf-section">
      <div class="conf-section-title">${s.label}</div>
      ${CONFIRMATIONS[s.key].map(card => `
        <div class="conf-card">
          <div class="conf-name">${card.name}</div>
          ${card.items.map(r => `
            <div class="conf-row">
              <span class="conf-key">${r.key}</span>
              <span class="conf-val ${r.hi ? 'hi' : ''}">${r.val}</span>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>
  `).join('');
}

// ── Auth ──────────────────────────────────────────────────────────────────────
editBtn.addEventListener('click', () => {
  if (currentUser) {
    signOut(auth);
  } else {
    authEmail.value = '';
    authPassword.value = '';
    authErr.textContent = '';
    authSubmit.textContent = 'Sign in';
    overlay.classList.add('open');
    setTimeout(() => authEmail.focus(), 80);
  }
});

overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.remove('open'); });
modalClose.addEventListener('click',   () => overlay.classList.remove('open'));

authPassword.addEventListener('keydown', e => { if (e.key === 'Enter') authSubmit.click(); });

authSubmit.addEventListener('click', async () => {
  const email = authEmail.value.trim();
  const pass  = authPassword.value;
  if (!email || !pass) { authErr.textContent = 'Please enter email and password.'; return; }
  authErr.textContent = '';
  authSubmit.textContent = 'Signing in…';
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    overlay.classList.remove('open');
  } catch {
    authErr.textContent = 'Incorrect email or password.';
    authSubmit.textContent = 'Sign in';
  }
});

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (user) {
    document.body.classList.add('edit-mode');
    editBtn.classList.add('active');
    editBtn.textContent = '✓ Editing';
    await loadAllNotes();
    refreshNoteDisplays();
    setupEditors();
  } else {
    document.body.classList.remove('edit-mode');
    editBtn.classList.remove('active');
    editBtn.textContent = '✎ Edit';
    refreshNoteDisplays();
  }
});

// ── Firestore: notes ──────────────────────────────────────────────────────────
async function loadAllNotes() {
  const ids = Object.keys(DAYS);
  await Promise.all(ids.map(async id => {
    try {
      const snap = await getDoc(doc(db, 'notes', id));
      if (snap.exists()) notes[id] = snap.data().text || '';
    } catch { /* offline or rules */ }
  }));
}

function refreshNoteDisplays() {
  document.querySelectorAll('.notes-read').forEach(el => {
    const ta    = el.nextElementSibling;
    const dayId = ta ? ta.dataset.day : null;
    if (!dayId) return;
    const text = notes[dayId] || '';
    el.innerHTML = text
      ? text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/\n/g,'<br>')
      : '<em>No notes yet — sign in to add notes.</em>';
  });
  document.querySelectorAll('.notes-edit').forEach(ta => {
    ta.value = notes[ta.dataset.day] || '';
  });
}

function setupEditors() {
  document.querySelectorAll('.notes-edit').forEach(orig => {
    // Clone to remove old listeners
    const ta = orig.cloneNode(true);
    orig.parentNode.replaceChild(ta, orig);
    ta.value = notes[ta.dataset.day] || '';

    let timer;
    ta.addEventListener('input', () => {
      clearTimeout(timer);
      const ind = document.getElementById('save-' + ta.dataset.day);
      if (ind) ind.textContent = 'Saving…';
      timer = setTimeout(async () => {
        const dayId = ta.dataset.day;
        const text  = ta.value;
        notes[dayId] = text;
        try {
          await setDoc(doc(db, 'notes', dayId), { text, updatedAt: new Date() });
          if (ind) { ind.textContent = 'Saved'; setTimeout(() => { ind.textContent = ''; }, 1800); }
        } catch {
          if (ind) ind.textContent = 'Could not save.';
        }
      }, 900);
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
}

// ── Init ──────────────────────────────────────────────────────────────────────
renderItinerary();
renderConfirmations();
