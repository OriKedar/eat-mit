import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// MapLibre needs a real WebGL canvas jsdom doesn't provide — App's own tests
// care about the surrounding chrome (topbar, list/map tabs, dialog wiring),
// not the map itself, so a lightweight stand-in exposing an onSelectNearby
// trigger is enough (MapView has its own dedicated tests).
vi.mock('./components/MapView', () => ({
  default: ({ onSelectNearby, onDropPin }) => (
    <div data-testid="map-view">
      <button type="button" onClick={() => onSelectNearby({ name: 'Nearby Spot', lat: 1, lng: 2 })}>
        trigger nearby select
      </button>
      <button type="button" onClick={() => onDropPin({ lat: 3, lng: 4 })}>
        trigger drop pin
      </button>
    </div>
  ),
}))

// Chainable query-builder stub matching the subset of the supabase-js fluent
// API usePlaces calls — same shape as usePlaces.test.js's helper.
function makeQuery(result) {
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    insert: vi.fn(() => query),
    update: vi.fn(() => query),
    delete: vi.fn(() => query),
    upsert: vi.fn(() => query),
    limit: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve(result)),
    then: (resolve) => Promise.resolve(result).then(resolve),
  }
  return query
}

const ENTRY = {
  id: 'entry-1',
  status: 'want_to_go',
  rating: 0,
  notes: '',
  photo_url: '',
  created_at: '2026-08-01T00:00:00Z',
  place: { id: 'place-1', name: 'Test Trattoria', lat: 52.5, lng: 13.4, osm_id: null },
}

const authState = { session: null }

vi.mock('./lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(() => Promise.resolve({ data: { session: authState.session } })),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      signOut: vi.fn(),
    },
    from: vi.fn(() => makeQuery({ data: [ENTRY], error: null })),
  },
  supabaseConfigured: true,
}))

const { supabase } = await import('./lib/supabase')
const { default: App } = await import('./App')

beforeEach(() => {
  authState.session = null
  supabase.from.mockReset()
  supabase.from.mockReturnValue(makeQuery({ data: [ENTRY], error: null }))
  supabase.auth.signOut.mockReset()
  window.confirm = vi.fn(() => true)
})

describe('App — auth gate', () => {
  it('shows a loading state before auth resolves, then Auth once signed out is confirmed', async () => {
    render(<App />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
    expect(await screen.findByPlaceholderText('you@example.com')).toBeInTheDocument()
  })

  it('renders Home once a session resolves', async () => {
    authState.session = { user: { id: 'user-1' } }
    render(<App />)

    expect(await screen.findByText('Food Map')).toBeInTheDocument()
    expect(await screen.findByText('Test Trattoria')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('signs out via the Supabase client', async () => {
    authState.session = { user: { id: 'user-1' } }
    render(<App />)

    await userEvent.click(await screen.findByRole('button', { name: /sign out/i }))
    expect(supabase.auth.signOut).toHaveBeenCalled()
  })
})

describe('App — Home', () => {
  beforeEach(() => {
    authState.session = { user: { id: 'user-1' } }
  })

  it('switches between the map and list tabs (mobile layout)', async () => {
    render(<App />)
    await screen.findByText('Food Map')

    const main = document.querySelector('main')
    expect(main.className).toContain('show-map')

    await userEvent.click(screen.getByRole('button', { name: 'List' }))
    expect(main.className).toContain('show-list')
  })

  it('opens the add-place dialog from the topbar button', async () => {
    render(<App />)
    await screen.findByText('Food Map')

    await userEvent.click(screen.getByRole('button', { name: /\+ add place/i }))
    expect(await screen.findByText('Add a place')).toBeInTheDocument()

    // No result picked yet, so the dialog is still on its search step — only
    // its X close button is available (Cancel only appears once a place is
    // picked; that path is covered by PlaceDialog's own tests).
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByText('Add a place')).not.toBeInTheDocument()
  })

  it('opens the nearby-add dialog pre-filled when MapView reports a nearby selection', async () => {
    render(<App />)
    await screen.findByText('Food Map')

    await userEvent.click(screen.getByRole('button', { name: /trigger nearby select/i }))
    expect(await screen.findByText('Nearby Spot')).toBeInTheDocument()
  })

  it('deletes an entry once the confirmation is accepted', async () => {
    render(<App />)
    await screen.findByText('Test Trattoria')

    const callsBeforeDelete = supabase.from.mock.calls.length
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(supabase.from.mock.calls.length).toBeGreaterThan(callsBeforeDelete))
    expect(supabase.from).toHaveBeenCalledWith('user_places')
  })

  it('edits an entry from the list and submits an update', async () => {
    render(<App />)
    await screen.findByText('Test Trattoria')

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(await screen.findByText('Edit entry')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(screen.queryByText('Edit entry')).not.toBeInTheDocument())
  })

  it('opens the pin-drop dialog when MapView reports a dropped pin', async () => {
    render(<App />)
    await screen.findByText('Food Map')

    await userEvent.click(screen.getByRole('button', { name: /trigger drop pin/i }))
    expect(await screen.findByText('Add a place here')).toBeInTheDocument()
  })

  it('confirms before deleting, and does nothing if the user cancels', async () => {
    window.confirm = vi.fn(() => false)
    render(<App />)
    await screen.findByText('Test Trattoria')

    const callsBeforeDelete = supabase.from.mock.calls.length
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(window.confirm).toHaveBeenCalledWith('Delete "Test Trattoria" from your map?')
    // Cancelled — no further Supabase calls (the initial load already made
    // one), and the entry is still there.
    expect(supabase.from.mock.calls.length).toBe(callsBeforeDelete)
    expect(screen.getByText('Test Trattoria')).toBeInTheDocument()
  })

  it('shows an offline banner when the browser goes offline', async () => {
    render(<App />)
    await screen.findByText('Food Map')
    expect(screen.queryByText(/offline/i)).not.toBeInTheDocument()

    window.dispatchEvent(new Event('offline'))
    expect(await screen.findByText(/offline/i)).toBeInTheDocument()

    window.dispatchEvent(new Event('online'))
    await waitFor(() => expect(screen.queryByText(/offline/i)).not.toBeInTheDocument())
  })

  it('shows a query error with a retry action', async () => {
    supabase.from.mockReturnValue(makeQuery({ data: null, error: { message: 'Could not reach Supabase' } }))
    render(<App />)

    expect(await screen.findByText('Could not reach Supabase')).toBeInTheDocument()
    const retry = screen.getByRole('button', { name: /retry/i })

    supabase.from.mockReturnValue(makeQuery({ data: [ENTRY], error: null }))
    await userEvent.click(retry)

    expect(await screen.findByText('Test Trattoria')).toBeInTheDocument()
  })

  it('shows the empty state and its add-place shortcut when there are no entries', async () => {
    supabase.from.mockReturnValue(makeQuery({ data: [], error: null }))
    render(<App />)

    expect(await screen.findByText('No places yet.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /add your first/i }))
    expect(await screen.findByText('Add a place')).toBeInTheDocument()
  })
})
