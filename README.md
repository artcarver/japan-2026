# Japan 2026 🗾

A private itinerary planner for Gwen & Christina's Japan trip (April 15–29, 2026).

## Stack
- **Frontend**: Vanilla HTML/CSS/JS — no build tools needed
- **Hosting**: GitHub Pages (free)
- **Database**: Firebase Firestore (real-time sync between both of you)
- **Auth**: Google Sign-In (restricted to your two emails)
- **Storage**: Firebase Storage (for photo uploads)

---

## Setup Checklist

### 1. Firebase Firestore Rules
Go to **Firebase Console → Firestore → Rules** and paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null &&
        request.auth.token.email in [
          'ghstilson@gmail.com',
          'cmelikian@gmail.com'
        ];
    }
  }
}
```

Click **Publish**.

### 2. Firebase Storage Rules
Go to **Firebase Console → Storage → Rules** and paste:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if request.auth != null &&
        request.auth.token.email in [
          'ghstilson@gmail.com',
          'cmelikian@gmail.com'
        ];
    }
  }
}
```

Click **Publish**.

### 3. Add your domain to Firebase Auth
Go to **Firebase Console → Authentication → Settings → Authorized domains**
and add: `[your-github-username].github.io`

### 4. Push to GitHub
```bash
cd japan-2026
git init
git add .
git commit -m "Initial commit 🗾"
git branch -M main
git remote add origin https://github.com/[your-username]/japan-2026.git
git push -u origin main
```

### 5. Enable GitHub Pages
In your GitHub repo: **Settings → Pages → Source: Deploy from branch → main → / (root)**

Your site will be live at: `https://[your-username].github.io/japan-2026`

---

## How it works

- The **first person to sign in** will trigger the database seed — all 15 days of the trip get written to Firestore automatically.
- Both of you see **the same data in real time**. Add an activity and it appears on her screen instantly.
- **Updating the website** (pushing code to GitHub) only changes the UI — your itinerary data in Firestore is untouched.

## Features
- 📅 Day-by-day itinerary (all 15 days pre-loaded)
- ➕ Add / ✏️ Edit / 🗑 Delete activities
- ↕️ Drag to reorder activities within a day
- 💰 Budget tracker (totals all costs in JPY & USD)
- 📝 Notes per activity (confirmation numbers, tips, etc.)
- 📍 Map link per day (opens Google Maps)
- 📷 Photo uploads (stored in Firebase Storage)
- 🔒 Google Sign-In (only your two emails work)
- ⌨️ Keyboard shortcuts: `Esc` to close modal, `Cmd+Enter` to save

---

## Travelers
- Gwendalynn Stilson — ghstilson@gmail.com
- Christina Melikian — cmelikian@gmail.com

## Flights
- **Outbound**: UA39 · LAX → HND · Apr 15 11:20am → Apr 16 3:05pm · Seats 31L/31J · Confirmation: F354LH
- **Return**: UA38 · HND → LAX · Apr 29 6:10pm → 12:15pm · Seats 31J/31L
