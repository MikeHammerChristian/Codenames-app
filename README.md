# Codenames Online

A clean multiplayer web version of Codenames you can play with coworkers.

## Features

- Create / join rooms with a short code (or share a link)
- Red vs Blue teams
- Spymaster & Operative roles
- Real-time board sync
- Proper Codenames rules (9/8/7/1 distribution, assassin ends the game)
- Mobile-friendly UI

## Quick Start (local)

```bash
cd codenames-app
npm install
npm start
```

Open http://localhost:3000

Share the room code (or the `?room=XXXX` link) with your coworkers.

## Deploy for free (so everyone can join from anywhere)

### Option A – Render.com (recommended)

1. Push this folder to a GitHub repo
2. Go to [render.com](https://render.com) → New → Web Service
3. Connect the repo
4. Settings:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Deploy. You’ll get a public URL like `https://your-app.onrender.com`

### Option B – Railway / Fly.io / Glitch

Same idea – just point the start command at `npm start`.

## How to play

1. Everyone joins the **same room code**
2. Pick a team (Red / Blue) and role (Spymaster or Operative)
3. Someone clicks **Start Game**
4. Spymasters see the colored key and give a one-word clue + number
5. Operatives click words to guess
6. First team to reveal all their agents wins (hitting the assassin loses immediately)

Enjoy!
