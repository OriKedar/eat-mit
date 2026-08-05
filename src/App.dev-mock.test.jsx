import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// import.meta.env.DEV is true under Vitest, so supabaseConfigured: false here
// exercises DEV_MOCK — the local-dev fallback (see App.jsx) that skips Auth
// and Supabase entirely and feeds the map from useMockPlaces. Kept in its
// own file since DEV_MOCK is derived once at module load from these two
// values, unlike App.test.jsx's supabaseConfigured: true scenarios.
vi.mock('./components/MapView', () => ({
  default: () => <div data-testid="map-view" />,
}))

vi.mock('./lib/supabase', () => ({
  supabase: { auth: {} },
  supabaseConfigured: false,
}))

const { default: App } = await import('./App')

describe('App — DEV_MOCK (no Supabase project configured, dev build)', () => {
  it('skips Auth and renders Home directly, seeded from useMockPlaces', async () => {
    render(<App />)

    expect(await screen.findByText('Food Map')).toBeInTheDocument()
    expect(screen.getByText('Mock Trattoria Berlin')).toBeInTheDocument()
    expect(screen.getByText('Mock Ramen House')).toBeInTheDocument()
    expect(screen.getByText('Mock Falafel Corner')).toBeInTheDocument()
  })

  it('hides the Sign out button since there is no real session', async () => {
    render(<App />)
    await screen.findByText('Food Map')

    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument()
  })
})
