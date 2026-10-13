# CODE SPRINT

A timed, multi-round **competitive coding contest platform** for teams, with a live leaderboard and a full judge/admin dashboard. Built for a game-like, round-based experience (Logic Quest → Lunch Lock → Code Arena → Debug Lab → Final Boss).

## Quick Start

```bash
# 1. Install dependencies (already done if node_modules exists)
npm install

# 2. Create the database with teams, admin accounts and sample questions
npm run seed

# 3. Start the server
npm start
```

Open:
- **Teams portal:** `/` (Login with assigned team account)
- **Judge / Admin:** `/admin.html` (Administrator access)

> Note: Contest credentials (team accounts and judge/admin passwords) are distributed privately by event organizers.

To wipe all data and start fresh: stop the server, run `npm run reset`, then `npm start`.

## What's Built (matches the requirements doc)

1. **Login + team management** — unique Team ID + password, only registered teams get in. Login page shows competition status (Not Started / Live / Finished).
2. **Team dashboard** — name, ID, score, rank, remaining time, current round, overall progress bar, and the visual journey:
   `🔐 Gate → 🌀 Maze → 🔮 Cipher → 🍽 Lunch → ⚔️ Code Arena → 🐛 Debug Lab → 👾 Final Boss`
   Each stage shows **Locked / Active / Completed**.
3. **Question system** — 3 rounds + bonus questions, each with a standard page (statement, input, output, constraints, examples), a code editor (Monaco with plain-text fallback), language picker (**Python, JavaScript, Java**), Run, and Submit.
4. **Code execution** — runs locally in a sandboxed temp dir with time limits (compiles Java/`javac`, then runs). Extensible language registry in `services/executor.js`.
5. **Submission + automatic evaluation** — every submission is tested against all test cases; score = `marks × passed/total`.
6. **Scoring** — best submission per question counts; hint penalties subtract; ties broken by earliest solve.
7. **Timer & round control** — *server-controlled*. The server is the source of truth and pushes the state to clients every second. Rounds auto-lock / unlock / stop submissions by schedule. Configurable in the admin **Settings** tab (also: status, announcement message).
8. **Live leaderboard** — updates instantly over WebSocket whenever a score changes. Judges can **freeze** it (scores locked).
9. **Judge/Admin dashboard** — monitor all teams (score, rank, submissions, hints, flags), view a team's full detail, override a submission score for official corrections, flag suspicious activity, generate/manage teams, and **add / edit / delete questions and test cases without writing code**.
10. **Hints** — "Using this hint will reduce your score. Continue?" → penalty applied and recorded.
11. **Final results page** — Frozen final leaderboard with Winner / Runner-up and round-wise scores (published by judges).

## Default Round Schedule

| Phase | Time | Notes |
|---|---|---|
| Round 1 — Logic Quest | 10:00–12:00 | Gate → Maze → Cipher |
| Lunch Lock | 12:00–13:00 | questions locked, submissions disabled, countdown screen |
| Round 2 — Code Arena | 13:00–15:00 | Predict / Fix It / Complete It / Solve / Challenge + Bonus |
| Round 3 — Debug Lab | 15:00–16:00 | Broken Loop / Hidden Bug / Final Boss; 16:00 all submissions close |

Edit these dates/times live in admin → **Settings → Round Schedule**.

## Using the Admin Without Coding

- **Questions tab** → add/edit/delete questions per round. The form has plain text fields for statement/input/output/constraints, a starter-code box, **Examples** rows (shown to teams), and **Test Cases** rows (hidden + visible "sample"). No code knowledge needed.
- **Teams tab** → add one team or bulk-generate with a prefix; edit name / ID / active / password; delete.
- **Leaderboard tab** → freeze scores and publish the final results.
- **Activity tab** → watch every login/submit/hint and flag suspicious behavior.

## Project Layout

```
server.js            Express + Socket.IO entry point
db.js                SQLite (better-sqlite3) schema + helpers
seed.js              Database seed (teams, admins, sample questions)
middleware.js        session guards
routes/              auth, team, admin, public API endpoints
services/
  timer.js           server-authoritative phase/round engine
  executor.js        Python/JS/Java runner (sandboxed temp dir)
  scoring.js         score, rank, leaderboard
  realtime.js        broadcast helpers (socket.io)

public/              Frontend (vanilla JS + Monaco)
  index.html         Team login + competition status
  dashboard.html     Team dashboard + journey
  question.html      Question list + editor + results + hints
  leaderboard.html   Live leaderboard
  results.html       Final results
  admin.html         Judge/Admin dashboard (full control)
  css/style.css      Game-like theme
```

## Notes & Limitations

- Code runs with the machine's runtime: `python`, `node`, `java`/`javac`. Install others (e.g. g++) and extend `services/executor.js` to add languages.
- Execution is sandboxed by temp dir + time/memory caps via child processes — fine for a campus event on a trusted machine; for hostile/public deployment, swap in a hardened judge (e.g. Judge0) at the `/api/team/submit` boundary.
- The DB file lives at `data/codesprint.db`. Backup it to snapshot a competition.
- Time zone: the default schedule uses the server's local time; all comparisons use the server clock (do not rely on client clocks).