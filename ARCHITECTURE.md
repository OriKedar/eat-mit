# Architecture

## Overview

```
┌─────────────────────┐         ┌──────────────────────┐
│   GitHub Pages       │         │      Supabase        │
│   (static hosting)   │◄───────►│  Postgres + Auth +   │
│                      │  HTTPS  │  Row Level Security  │
│  React + Vite app    │         │                      │
│  Leaflet map         │         └──────────────────────┘
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│  Nominatim (OSM)      │
│  place search API     │
└──────────────────────┘
```

The frontend is a static site (just HTML/CSS/JS after build) hosted on GitHub
Pages. It talks directly to Supabase for all data (reads and writes) using
Supabase's client library, which handles auth tokens and RLS automatically. It
talks to Nominatim only to search for a place when adding a new one.

There is no custom backend server. This is intentional — one less thing to
host, patch, or pay for.

## Why not "GitHub repo as database"?

We considered this and rejected it. The core problem: GitHub Pages can only
serve static files, it can't accept writes. To let the browser write a new
place back into the repo, you'd need a GitHub API token in the frontend code,
which is visible to anyone who opens browser dev tools — meaning anyone could
write to (or vandalize) the repo. The workaround (GitHub Actions as a write
proxy) avoids exposing the token but adds a multi-second delay per write and
has real conflict problems once more than one person writes around the same
time. Fine for a single editable file you update by hand; not fine for an app
with real users.

## Why Supabase specifically

- **Auth is built-in and safe by default.** Real accounts (email/password or
  Google/GitHub OAuth login), passwords never touch our code.
- **Row Level Security (RLS)** — the actual safety mechanism for a multi-user
  app. Rules like "users can only edit their own places" or "group members can
  see the shared group map" are enforced by the database itself, not just by
  frontend code. Even a frontend bug can't leak or corrupt someone else's data.
- **Real Postgres underneath** — proper relational joins, which matters later
  for the "recommend based on friends' taste" feature (comparing overlapping
  ratings across users is a join-heavy query).
- **Free tier has no credit card requirement and doesn't expire.** The one
  honest catch: a free project pauses after 7 days with zero activity, and
  auto-resumes (a few seconds delay) on the next request. There are also hard
  caps on database size and bandwidth, but a hobby project won't come close.

## Why Leaflet + OpenStreetMap instead of Google Maps

Google Maps has richer place metadata (hours, photos, ratings) but requires a
billing account on file and has real (if small at this scale) cost risk if
usage ever grows. Leaflet + OSM is fully free with no API key and no usage
cap. The honest tradeoff: some restaurants — especially smaller or newer ones —
will have thin or missing data in OSM (no photo, no hours). The plan for v1 is
to let the data model store user-provided details (your own notes/photo) so
missing OSM data isn't a blocker. This can be revisited later if it becomes a
real pain point.

## Why React + Vite

Vite gives fast local dev and a simple static build output, which is exactly
what GitHub Pages needs (it just serves files — no server-side rendering).
React is a reasonable default for UI state (map pins, forms, lists) and has
the largest ecosystem, which matters for a hobby project where you'll want to
find existing examples/libraries rather than build everything from scratch.

## Data flow example: adding a place

1. User searches "Trattoria Roma" in the search box.
2. Frontend calls Nominatim, gets back name + lat/lng (+ address if available).
3. User picks the right result, adds their own status (want-to-go/visited),
   rating, and notes.
4. Frontend calls Supabase client library to insert a row into `places` (if it
   doesn't already exist) and a row into `user_places` linking that place to
   the logged-in user.
5. Supabase's RLS policy checks that the `user_id` being written matches the
   currently authenticated user — enforced at the database, not just trusted
   from the frontend.

## Future-proofing for groups (not built in v1, but designed for)

The schema (see `DATABASE_SCHEMA.md`) already separates:
- `places` (shared, global — a restaurant only needs to exist once)
- `user_places` (per-user relationship to a place — your own rating/notes)
- `groups` and `group_members` (empty/unused in v1, added when needed)

This means "add group support" later is mostly: build UI, add a couple of RLS
policies for group-shared visibility. It should not require restructuring
tables that already have your personal data in them.
