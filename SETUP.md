# Setup Guide

Steps marked **(you)** need a human with account access — Claude Code can't do
these. Steps marked **(Claude Code)** can be done directly in the repo.

## 1. Accounts to create (you)

1. **GitHub account** — if you don't already have one. Create a new repo,
   e.g. `food-map`.
2. **Supabase account** — sign up at supabase.com (free, no credit card).
   Create a new project. Pick any region close to you. Note down:
   - Project URL (looks like `https://xxxxx.supabase.co`)
   - `anon` public API key (Settings → API in the Supabase dashboard)

   These two values are safe to put in frontend code — they're meant to be
   public. Safety comes from Row Level Security, not from hiding these keys.

## 2. Apply the database schema (you, one time, via Supabase dashboard)

1. Open your Supabase project → SQL Editor.
2. Paste and run the **v1 tables** SQL from `DATABASE_SCHEMA.md` (the `places`
   and `user_places` tables, plus their RLS policies), in order.
3. Enable an auth provider: Supabase dashboard → Authentication → Providers.
   Easiest for a hobby project: enable **Email** (magic link, no password to
   manage) or **Google** OAuth if you prefer one-click login.

## 3. Project scaffolding (Claude Code can do this)

Once the repo exists and you have the Supabase URL + anon key, tell Claude
Code to:

1. Scaffold a Vite + React project in the repo root.
2. Install dependencies: `@supabase/supabase-js`, `leaflet`, `react-leaflet`.
3. Create a `.env` file (and add it to `.gitignore`!) with:
   ```
   VITE_SUPABASE_URL=your-project-url
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
4. Set up the Supabase client (`src/lib/supabase.js`) reading from those env
   vars.
5. Build the pages/components described in `ROADMAP.md` for v1.
6. Configure `vite.config.js` with the correct `base` path for GitHub Pages
   (this is `/repo-name/` unless using a custom domain).
7. Add a GitHub Actions workflow (`.github/workflows/deploy.yml`) that builds
   the Vite app and deploys the `dist/` folder to the `gh-pages` branch (or
   uses GitHub's native Pages-from-Actions deployment) on every push to
   `main`.

## 4. Environment variables in GitHub Actions (you, one time)

The `.env` file is never committed to git (it's in `.gitignore`), so the build
running inside GitHub Actions needs the same values a different way:

1. Repo → Settings → Secrets and variables → Actions → New repository secret.
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` there.
3. Claude Code should reference these as `${{ secrets.VITE_SUPABASE_URL }}`
   etc. inside the workflow file, so the build has access to them without
   them ever being visible in the repo's code.

## 5. Enable GitHub Pages (you, one time)

Repo → Settings → Pages → Source: set to "GitHub Actions" (if using the
Actions-based deploy from step 3) or the `gh-pages` branch, matching whichever
approach Claude Code set up.

## 6. Verify

- Visit the deployed GitHub Pages URL.
- Sign up / log in via the auth provider you enabled.
- Search for a real restaurant near you, add it with a status and note.
- Confirm it shows up as a pin on the map and in the list view.
- Log out, log in as a different (test) account, confirm you do NOT see the
  first account's saved places — this is your RLS check.

## Ongoing costs

At hobby-project scale (one person, then a handful of friends), everything
here stays within Supabase's and GitHub's free tiers. The only thing to keep
an eye on: a free Supabase project pauses after 7 days of no activity and
needs a manual "resume" click in the dashboard (or just visiting the app,
which can trigger a wake — there's a few seconds delay on first request after
a pause).
