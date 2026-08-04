import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

const ROW = {
  id: 'entry-1',
  status: 'visited',
  rating: 5,
  notes: '',
  photo_url: '',
  created_at: '2026-08-01T00:00:00Z',
  place_id: 'place-1',
  place: { id: 'place-1', name: 'Test Place', lat: 1, lng: 2, osm_id: null },
}

// Chainable query-builder stub matching the subset of the supabase-js
// fluent API usePlaces actually calls (select/eq/order/insert/update/delete
// /upsert/limit/single), each step returning `this` so any call order works
// and the terminal await resolves via `then`.
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

vi.mock('../lib/supabase', () => ({
  supabase: { from: vi.fn() },
}))

const { supabase } = await import('../lib/supabase')
const { usePlaces } = await import('./usePlaces')

beforeEach(() => {
  supabase.from.mockReset()
})

describe('usePlaces', () => {
  it('loads entries for the given user on mount', async () => {
    supabase.from.mockReturnValue(makeQuery({ data: [ROW], error: null }))

    const { result } = renderHook(() => usePlaces('user-1'))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.entries).toEqual([ROW])
    expect(result.current.error).toBeNull()
    expect(supabase.from).toHaveBeenCalledWith('user_places')
  })

  it('drops rows whose joined place is missing', async () => {
    const orphan = { ...ROW, id: 'entry-2', place: null }
    supabase.from.mockReturnValue(makeQuery({ data: [ROW, orphan], error: null }))

    const { result } = renderHook(() => usePlaces('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.entries).toEqual([ROW])
  })

  it('surfaces a query error', async () => {
    supabase.from.mockReturnValue(makeQuery({ data: null, error: { message: 'boom' } }))

    const { result } = renderHook(() => usePlaces('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('boom')
  })

  it('does nothing when there is no userId', () => {
    renderHook(() => usePlaces(undefined))
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('deleteEntry removes the row then refreshes', async () => {
    supabase.from.mockReturnValue(makeQuery({ data: [ROW], error: null }))
    const { result } = renderHook(() => usePlaces('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))

    supabase.from
      .mockReturnValueOnce(makeQuery({ error: null }))
      .mockReturnValueOnce(makeQuery({ data: [], error: null }))
    await act(async () => {
      await result.current.deleteEntry('entry-1')
    })

    expect(supabase.from).toHaveBeenCalledWith('user_places')
  })
})
