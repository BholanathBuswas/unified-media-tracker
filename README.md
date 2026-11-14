# 🎬 Unified Media Tracker PRO

[![Node.js](https://img.shields.io/badge/Node.js-v18+-68a063.svg?logo=node.js)](https://nodejs.org/)
[![SQLite](https://img.shields.io/badge/SQLite-WAL%20Mode-003B57.svg?logo=sqlite)](https://www.sqlite.org/)
[![Express](https://img.shields.io/badge/Express-5.x-000000.svg?logo=express)](https://expressjs.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A modern, lightning-fast media tracking web application for **Anime, Movies, TV Series, and Animations**. Built with a lightweight **Node.js + Express** backend, an indexed **SQLite database**, and a modern, responsive frontend with dual view modes (Card Grid & Compact Table), interactive season checklists, and a canvas-based Lucky Decision Wheel.

Migrated and upgraded from a legacy Google Apps Script & Google Sheets setup with **591 historical records** preserved and enriched.

---

## ✨ Features & Enhancements

### 🎯 Core Upgrades Over Legacy Version
- **Native SQLite Persistence**: Replaced slow Google Sheets API quotas and locking timeouts with a zero-latency SQLite database in WAL mode.
- **Dual Display Modes**:
  - **Poster Card Grid**: Visual cards with status badges, year, format, rating, and quick-toggle season chips.
  - **Compact Data Table**: Power-user table with sticky headers, sortable columns, and inline season pills.
- **One-Click Season Tracker**: Click season chips (`S1 ✓`, `S2 ○`, `S3 ○`) directly on cards or in the table without opening modals, with automatic status progression (*Plan to Watch* ➔ *Watching* ➔ *Completed*).
- **Interactive Season Modal**: Deep multi-season checklist with completion percentage progress bar, "Mark All Watched", and "Reset".
- **🎡 Lucky Decision Wheel**:
  - High-performance HTML5 canvas roulette wheel with easing physics and decelerating rotation.
  - Built-in **Web Audio synthesizer** for realistic mechanical tick sounds and victory fanfare (0 external audio files needed).
  - Confetti burst celebration and instant **"Mark as Watching"** button.
  - Filter wheel candidates by category (Anime, Movie, Hentai) and format (Web Series, Drama, etc.).
- **Smart Duplicate Prevention**: Real-time debounce check that scans title and alternate native title, warning before duplicate entry creation.
- **Extended Metadata Fields**:
  - `alt_name`: Native/alternate title (Japanese Kanji/Romaji, Korean Hangul, Hindi, Bengali, etc.).
  - `rating`: 1–10 star scoring system.
  - `favorite`: One-click bookmarking with dedicated "Favorites" tab.
  - `platform`: Track where to stream (Netflix, Crunchyroll, Prime Video, Disney+, Hotstar, Local BluRay).
  - `notes`: Personal reviews, episode bookmarks, and streaming links.
- **Backup & Portability**:
  - 1-click **JSON Backup** export and restore.
  - 1-click **CSV Spreadsheet** export (compatible with Google Sheets & Excel).
- **Dark / Light Theme**: Cinematic obsidian midnight theme with WCAG AA compliant contrast and smooth light mode.
- **Keyboard Shortcuts**:
  - `/` : Focus search input
  - `N` : Open Add Media modal
  - `W` : Launch Lucky Wheel
  - `G` : Switch to Card Grid view
  - `T` : Switch to Compact Table view
  - `Esc` : Close any active modal

---

## 📁 Project Structure

```text
├── public/
│   ├── index.html        # Modern, semantic single-page web app
│   ├── app.js            # Frontend state, API client, Lucky Wheel physics & audio
│   ├── styles.css        # CSS design tokens, glassmorphism, responsive styles
│   └── favicon.svg       # Vector gradient favicon
├── scripts/
│   └── import_excel.py   # Migration script from Excel to SQLite
├── test/
│   └── model.test.js     # Automated test suite (CRUD, lifecycle, search, wheel)
├── legacy/
│   ├── Code.gs           # Archived Google Apps Script backend
│   ├── Index.html        # Archived legacy HTML frontend
│   └── README.md         # Documented bug fixes and migration rationale
├── db.js                 # SQLite data layer (better-sqlite3 with node:sqlite fallback)
├── server.js             # Express REST API & static file server
├── media_tracker.db      # Populated SQLite database (591 items)
├── package.json          # Node scripts and dependencies
├── .gitignore            # Git ignore rules
└── README.md             # Project documentation
```

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Node.js** (v18.0.0 or higher recommended)
- **npm** (v9+ or modern package manager)

### 2. Installation
Clone the repository and install dependencies:
```bash
git clone https://github.com/your-username/unified-media-tracker.git
cd unified-media-tracker
npm install
```

### 3. Start the Server
Run the production server:
```bash
npm start
```
Or run with auto-reload during development:
```bash
npm run dev
```

Open your browser and navigate to:
```text
http://localhost:3000
```

### 4. Run Automated Tests
```bash
npm test
```

### 5. Re-import or Migrate Excel Data (Optional)
If you ever want to re-seed from `Unified Media Tracker.xlsx`:
```bash
npm run import
```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/media` | Query media items with filters (`category`, `type`, `status`, `search`, `sortBy`, `sortDir`, `page`, `limit`) |
| `GET` | `/api/media/:id` | Get single media record by ID |
| `POST` | `/api/media` | Create new media record |
| `POST` | `/api/media/check-duplicate` | Check if title exists in category |
| `PUT` | `/api/media/:id` | Update full media record |
| `PATCH` | `/api/media/:id/watched` | Update watched array for seasons |
| `PATCH` | `/api/media/:id/toggle-season` | Toggle watched state of single season |
| `PATCH` | `/api/media/:id/favorite` | Toggle bookmark / favorite status |
| `DELETE` | `/api/media/:id` | Permanently delete media record |
| `GET` | `/api/stats` | Analytics summary (counts, completed %, category breakdown) |
| `GET` | `/api/wheel` | Unwatched candidates for the Lucky Wheel |
| `GET` | `/api/export?format=json` | Download complete database as JSON |
| `GET` | `/api/export?format=csv` | Download complete database as CSV |
| `POST` | `/api/import` | Restore or merge JSON media backup |

---

## 🛠️ Deploying to the Cloud

### Option A: Railway / Render / Fly.io
1. Push your repository to GitHub.
2. Link your repository in [Railway](https://railway.app/) or [Render](https://render.com/).
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Attach a persistent volume to preserve `media_tracker.db` across redeployments.

### Option B: Docker
Create a `Dockerfile` (or use the included one):
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```
Build and run:
```bash
docker build -t media-tracker .
docker run -p 3000:3000 -v $(pwd)/data:/app/data media-tracker
```

---

## 📝 License
This project is open-source and released under the [MIT License](LICENSE).
