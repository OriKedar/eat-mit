import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useMockPlaces } from './useMockPlaces'

describe('useMockPlaces', () => {
  it('seeds three entries', () => {
    const { result } = renderHook(() => useMockPlaces())
    expect(result.current.entries).toHaveLength(3)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('adds a new entry to the front of the list', async () => {
    const { result } = renderHook(() => useMockPlaces())
    const before = result.current.entries.length

    await act(async () => {
      await result.current.addEntry(
        { name: 'New Spot', lat: 1, lng: 2 },
        { status: 'want_to_go', rating: 0, notes: 'try it', photo_url: '' },
      )
    })

    expect(result.current.entries).toHaveLength(before + 1)
    expect(result.current.entries[0]).toMatchObject({
      status: 'want_to_go',
      notes: 'try it',
      place: { name: 'New Spot' },
    })
  })

  it('updates an existing entry in place', async () => {
    const { result } = renderHook(() => useMockPlaces())
    const target = result.current.entries[0]

    await act(async () => {
      await result.current.updateEntry(target.id, {
        status: 'visited',
        rating: 4,
        notes: 'updated',
      })
    })

    const updated = result.current.entries.find((e) => e.id === target.id)
    expect(updated).toMatchObject({ status: 'visited', rating: 4, notes: 'updated' })
  })

  it('deletes an entry', async () => {
    const { result } = renderHook(() => useMockPlaces())
    const target = result.current.entries[0]
    const before = result.current.entries.length

    await act(async () => {
      await result.current.deleteEntry(target.id)
    })

    expect(result.current.entries).toHaveLength(before - 1)
    expect(result.current.entries.find((e) => e.id === target.id)).toBeUndefined()
  })
})
