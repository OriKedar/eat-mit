import { describe, it, expect, afterEach, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('supabaseConfigured', () => {
  it('is false when the Supabase env vars are missing (this repo has no .env)', async () => {
    const { supabaseConfigured, supabase } = await import('./supabase')
    expect(supabaseConfigured).toBe(false)
    expect(supabase).toBeNull()
  })

  it('is true once both URL and anon key are set', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key')
    vi.resetModules()

    const { supabaseConfigured, supabase } = await import('./supabase')
    expect(supabaseConfigured).toBe(true)
    expect(supabase).not.toBeNull()
  })
})

describe('appUrl', () => {
  it('joins the deployed base path onto the current origin', async () => {
    vi.stubEnv('BASE_URL', '/eat-mit/')
    vi.resetModules()

    const { appUrl } = await import('./supabase')
    expect(appUrl()).toBe(`${window.location.origin}/eat-mit/`)
  })
})
