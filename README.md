# Japan 2026 · Gwendalynn & Christina

A personal trip planner for a 15-day Japan trip (April 15–29, 2026). Built as a progressive web app with offline support, real-time collaboration via Firebase, and a shareable overview for family and friends.

**Live site:** [artcarver.github.io/japan-2026](https://artcarver.github.io/japan-2026/)

---

## What it does

- **Overview** — Countdown to departure, journey timeline, hotel quick-reference with phone numbers. Designed for parents and friends to follow along.
- **Itinerary** — Day-by-day schedule across 5 cities (Tokyo, Hakone, Kyoto, Kanazawa, Tokyo Ginza) with 4 day trips (Kamakura, Nara, Osaka, Kawaguchiko). Every item is editable when signed in.
- **Bookings** — All confirmation numbers, PINs, addresses, and phone numbers in one place. Google Drive folder embed for scanned documents.
- **Plan** — Pre-trip checklist, packing list, Japan travel tips, and useful Japanese phrases.
- **Budget** — Expense tracker with 50/50 split calculation, category breakdown, and pre-booked cost management.

## For editors (Gwen & Christina)

Sign in with Google to unlock editing:

- **Edit any itinerary item** — hover over an activity to see ✎ Edit and ✕ Delete buttons
- **Add activities** — "+ Add activity" button at the bottom of each day
- **Drag and drop** — reorder user-added activities
- **Log expenses** — ¥ FAB button always visible, quick date buttons, category chips, split toggle
- **Notes** — per-day notes that auto-save as you type
- **Checklists** — check off tasks before and during the trip
- **Budget management** — edit who paid for pre-booked items, track settlement

All edits sync in real-time between both editors via Firestore.

## For everyone else

The site is publicly viewable without sign-in:

- Full itinerary with times, locations, and Google Maps links
- Inline "▸ show details" on booked items reveals confirmation info
- Overview with countdown and hotel contacts
- Dark mode toggle
- Currency converter (¥ ↔ $)
- Cherry blossom ambient animation

## Offline support

The app works without internet:

- **Service worker** caches HTML, CSS, JS, fonts, and icons
- **Firestore persistence** caches all trip data locally
- Open the app in a subway tunnel → full itinerary, notes, and expenses load from cache
- Edits made offline sync automatically when back online

### Add to home screen

**iPhone:** Safari → Share → Add to Home Screen
**Android:** Chrome → Menu → Add to Home Screen

Launches in standalone mode (no browser UI) with a custom icon.

## Tech stack

- Vanilla HTML / CSS / JavaScript — no frameworks
- Firebase Auth (Google sign-in, restricted to 2 allowed emails)
- Cloud Firestore (real-time database with offline persistence)
- Service Worker + Web App Manifest (PWA)
- GitHub Pages (hosting)
- DM Serif Display + DM Sans (typography)

## File structure

```
index.html        → App shell and all modals
styles.css        → Full design system (light + dark themes)
app.js            → All logic, data, and rendering
sw.js             → Service worker for offline caching
manifest.json     → PWA manifest for home screen install
icon-192.png      → App icon (192×192)
icon-512.png      → App icon (512×512)
```

## Firebase setup

The app uses a Firebase project (`japan-2026-gc`) with:

- **Authentication** — Google provider, restricted to two allowed emails
- **Firestore** — Collections: `days`, `notes`, `checks`, `expenses`, `settings`
- **Security rules** — `notes` and `days` are publicly readable; everything else requires editor auth

### Firestore collections

| Collection | Purpose | Public read | Editor write |
|------------|---------|-------------|--------------|
| `days` | Itinerary activities (seeded from hardcoded data on first sign-in) | ✓ | ✓ |
| `notes` | Per-day freeform notes | ✓ | ✓ |
| `checks` | Checklist completion state | — | ✓ |
| `expenses` | On-trip expense log | — | ✓ |
| `settings` | Drive folder URL, booked cost payer assignments | — | ✓ |

### Re-seeding the itinerary

If you need to reset the itinerary to match the hardcoded data in `app.js`:

1. Go to Firebase Console → Firestore → `days` collection
2. Delete the entire collection
3. Sign in to the app — it will detect the empty collection and re-seed all 15 days

## Updating the site

After pushing changes to GitHub:

1. Bump `CACHE_NAME` in `sw.js` (e.g., `'japan-2026-v1'` → `'japan-2026-v2'`)
2. This tells the service worker to re-download updated files
3. Users will get the new version on their next visit

## Itinerary summary

| Dates | Location | Hotel | Highlights |
|-------|----------|-------|------------|
| Apr 15 | Depart LAX | — | UA 39, 11:20 AM |
| Apr 16–19 | Tokyo · Shinjuku | Hotel Gracery Shinjuku | teamLab Borderless, Senso-ji, Kamakura day trip |
| Apr 20–21 | Kawaguchiko · Hakone | Tensui Saryo Ryokan | Mt. Fuji, Chureito Pagoda, Hakone Loop, private onsen |
| Apr 22–25 | Kyoto | Hotel Granvia Kyoto | Fushimi Inari 6 AM, Arashiyama, Nara day trip, Osaka day trip |
| Apr 26–27 | Kanazawa | Hotel Intergate | 21st Century Museum, Kenroku-en, Omicho Market |
| Apr 28 | Tokyo · Ginza | Quintessa Hotel Ginza | Hamarikyu Gardens, Tsukiji farewell |
| Apr 29 | Depart HND | — | UA 38, 6:10 PM |

---

Built with care for an unforgettable trip. 🇯🇵
