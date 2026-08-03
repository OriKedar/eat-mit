import { useCallback, useState } from 'react'

// TEMP dev-only stand-in for usePlaces — lets the UI (map, pins, add-flow) be
// clicked through locally with no Supabase project configured. Only ever
// wired up when import.meta.env.DEV && !supabaseConfigured (see App.jsx).
// Safe to delete once real creds are available for local testing.
const SEED = [
  {
    id: 'mock-1',
    status: 'visited',
    rating: 5,
    notes: 'The kottbullar, obviously.',
    photo_url: '',
    created_at: '2026-07-20T12:00:00Z',
    place: {
      id: 'mock-place-1',
      name: 'Mock Trattoria Berlin',
      lat: 52.5027,
      lng: 13.4265,
      address: 'Torstraße 1, Berlin',
      osm_id: null,
      cuisine: 'Italian',
      kind: 'restaurant',
    },
  },
  {
    id: 'mock-2',
    status: 'visited',
    rating: 0,
    notes: '',
    photo_url: '',
    created_at: '2026-07-25T12:00:00Z',
    place: {
      id: 'mock-place-2',
      name: 'Mock Ramen House',
      lat: 52.5116,
      lng: 13.4443,
      address: 'Kastanienallee 12, Berlin',
      osm_id: null,
      cuisine: 'Japanese',
      kind: 'restaurant',
    },
  },
  {
    id: 'mock-3',
    status: 'want_to_go',
    rating: 0,
    notes: 'Friend recommended the tasting menu.',
    photo_url: '',
    created_at: '2026-08-01T12:00:00Z',
    place: {
      id: 'mock-place-3',
      name: 'Mock Falafel Corner',
      lat: 52.4966,
      lng: 13.4321,
      address: 'Weserstraße 40, Berlin',
      osm_id: null,
      cuisine: 'Middle Eastern',
      kind: 'fast_food',
    },
  },
]

let nextId = SEED.length + 1

export function useMockPlaces() {
  const [entries, setEntries] = useState(SEED)

  const addEntry = useCallback(async (place, { status, rating, notes, photo_url }) => {
    const id = `mock-${nextId++}`
    setEntries((prev) => [
      {
        id,
        status,
        rating: rating || 0,
        notes: notes || '',
        photo_url: photo_url || '',
        created_at: new Date().toISOString(),
        place: { id: `mock-place-${id}`, ...place },
      },
      ...prev,
    ])
  }, [])

  const updateEntry = useCallback(async (entryId, patch) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? { ...e, status: patch.status, rating: patch.rating || 0, notes: patch.notes || '', photo_url: patch.photo_url || '' }
          : e,
      ),
    )
  }, [])

  const deleteEntry = useCallback(async (entryId) => {
    setEntries((prev) => prev.filter((e) => e.id !== entryId))
  }, [])

  return {
    entries,
    loading: false,
    error: null,
    refresh: async () => {},
    addEntry,
    updateEntry,
    deleteEntry,
  }
}
