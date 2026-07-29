import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Surfaced in the UI rather than thrown, so a missing .env gives a readable
// message instead of a blank page.
export const supabaseConfigured = Boolean(url && anonKey)

export const supabase = supabaseConfigured ? createClient(url, anonKey) : null

// Magic-link callback has to land back on the deployed base path
// (e.g. https://user.github.io/eat-mit/), not the domain root.
export function appUrl() {
  return new URL(import.meta.env.BASE_URL, window.location.origin).href
}
