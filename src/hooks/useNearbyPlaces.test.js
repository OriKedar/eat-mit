import { describe, it, expect } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useNearbyPlaces } from './useNearbyPlaces'

describe('useNearbyPlaces', () => {
  it('starts empty, then loads the citywide dataset', async () => {
    const { result } = renderHook(() => useNearbyPlaces())

    expect(Array.isArray(result.current)).toBe(true)

    await waitFor(() => expect(result.current.length).toBeGreaterThan(0))

    const [first] = result.current
    expect(first).toHaveProperty('name')
    expect(first).toHaveProperty('lat')
    expect(first).toHaveProperty('lng')
  })

  it('reuses the module-level cache on a second mount', async () => {
    const { result: first } = renderHook(() => useNearbyPlaces())
    await waitFor(() => expect(first.current.length).toBeGreaterThan(0))

    const { result: second } = renderHook(() => useNearbyPlaces())
    // Cached synchronously — no loading flicker on the second mount.
    expect(second.current.length).toBe(first.current.length)
  })
})
