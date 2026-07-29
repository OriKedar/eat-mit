# Food Map — Personal Restaurant Tracker (v1 → Group-ready)

## What this project is

A personal, map-based tracker for restaurants I want to visit and restaurants I've
already visited. Built to work for me alone first, but architected from day one so
that friends and later an "office group map" can be added without a rewrite.

## Core idea

- See restaurants as pins on a map.
- Mark each one as **"want to go"** or **"visited"**, with my own rating and notes.
- Everything usable from phone or desktop, anywhere (it's a web app).
- Later: share a map with friends, and eventually get recommendations based on
  friends whose taste overlaps with mine.

## Tech stack (all free tier)

| Layer            | Choice                              | Why |
|------------------|--------------------------------------|-----|
| Frontend hosting | GitHub Pages                        | Free, static, stable |
| Frontend         | React + Vite                        | Standard, works well with GitHub Pages |
| Map              | Leaflet.js + OpenStreetMap tiles    | Free, no API key, no usage cap |
| Place search     | Nominatim (OSM geocoding)           | Free, rate-limited but fine for personal use |
| Backend / DB     | Supabase (Postgres + Auth)          | Free tier, real accounts, Row Level Security |

Full reasoning for these choices is in `ARCHITECTURE.md`.

## Document map (read in this order)

1. **`ARCHITECTURE.md`** — how the pieces fit together, and the honest tradeoffs
   of the free stack.
2. **`DATABASE_SCHEMA.md`** — the exact Supabase tables, columns, and Row Level
   Security policies. This is the source of truth for the data model.
3. **`SETUP.md`** — step-by-step instructions to actually stand the project up
   (accounts to create, repo structure, environment variables).
4. **`ROADMAP.md`** — what gets built in what order (v1 → friends → groups →
   recommendations), so scope doesn't creep before v1 is done.

## How to use this with Claude Code

Upload this whole folder into a new GitHub repo, then open the repo with Claude
Code and say something like:

> "Read README.md, ARCHITECTURE.md, DATABASE_SCHEMA.md, SETUP.md, and ROADMAP.md
> in this repo. Set up the v1 project scope from ROADMAP.md: a React + Vite app
> with Leaflet map, Supabase auth, and the places/user_places tables from
> DATABASE_SCHEMA.md. Follow SETUP.md for the exact steps and ask me before
> creating the Supabase project itself, since that requires my account."

Claude Code will need you to:
- Create the actual Supabase project yourself (it can't do this for you — needs
  your account/login), and paste the project URL + anon key into a `.env` file it
  will create.
- Create the GitHub repo itself if one doesn't exist yet.

Everything else (code, schema application, Leaflet setup) it can do directly.

## Non-goals for v1 (see ROADMAP.md for when these come in)

- No friends, sharing, or groups yet — the data model supports it, but no UI for
  it in v1.
- No AI-based recommendations yet — needs enough rating data to be meaningful.
- No mobile app / app store — this is a web app, installable to your home screen
  (PWA) later if wanted.
