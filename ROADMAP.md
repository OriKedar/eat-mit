# Roadmap

Build strictly in this order. Do not start Phase 2 work before Phase 1 is
working end-to-end — scope creep here is the main risk to actually finishing
this project.

## Phase 1 — v1, personal use only

**Goal:** I can log in, add restaurants I want to visit or have visited, see
them on a map, and see them in a list.

- [ ] Auth: log in / sign up (email magic link or Google OAuth via Supabase)
- [ ] Map view (Leaflet) showing all of my saved places as pins
  - Different pin color/icon for "want to go" vs "visited"
  - Clicking a pin shows name, my rating, my notes
- [ ] Search bar: search a place by name (Nominatim), see results, pick one
- [ ] "Add place" flow: after picking a search result, set status
  (want-to-go/visited), optional rating (1–5), optional notes, optional photo
- [ ] List view alongside the map (sortable/filterable by status, rating)
- [ ] Edit / delete an existing entry
- [ ] Deployed and working on GitHub Pages

**Definition of done:** I can use this on my phone, day to day, to track
restaurants, without needing this repo open in a code editor.

## Phase 2 — Friends (not started until Phase 1 is genuinely done)

**Goal:** I can share my map with specific friends and see theirs.

- [ ] `friendships` table + RLS (see `DATABASE_SCHEMA.md`)
- [ ] "Add friend" flow (by email or username search)
- [ ] Accept/reject friend requests
- [ ] Toggle: view my map / view a specific friend's map / view combined
- [ ] Basic privacy control: per-entry, mark something private if wanted
  (e.g. a note not meant for friends to see)

## Phase 3 — Groups (office use case)

**Goal:** A group of people (e.g. office) share one collective map.

- [ ] `groups` + `group_members` tables + RLS (see `DATABASE_SCHEMA.md`)
- [ ] Create a group, invite members (by email/link)
- [ ] Group map view: combined pins from all group members, with an
  indicator of who added/rated each one
- [ ] Leave/remove-member flow

## Phase 4 — Recommendations (exploratory, no fixed scope yet)

**Goal:** Surface places I haven't visited that friends with similar taste to
mine rated highly.

- [ ] Only start this once there's real rating data across multiple users —
  building a recommendation feature against empty/sparse data isn't useful
  and is a good way to waste time on the wrong thing.
- [ ] Simplest first version: for each friend, compute a taste-similarity
  score from places you've both rated (e.g. correlation between your ratings
  on shared places), then surface that friend's highly-rated unvisited places,
  weighted by similarity.
- [ ] This is a genuinely open-ended ML/stats problem if you want to go
  deeper later — treat the first version as intentionally simple.

## Explicit non-goals (for now)

- No native mobile app — a PWA (installable web app) covers "works well on my
  phone" without app store overhead.
- No public/open sign-up — friends and group members should be invited, not
  a public app anyone can join.
- No monetization/business features — this is a hobby project.
