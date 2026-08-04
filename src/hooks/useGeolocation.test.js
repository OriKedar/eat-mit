import { describe, it, expect, vi, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useGeolocation } from './useGeolocation'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useGeolocation', () => {
  it('resolves to null and sets error state when geolocation is unsupported', async () => {
    vi.stubGlobal('navigator', { geolocation: undefined })
    const { result } = renderHook(() => useGeolocation())

    let resolved
    await act(async () => {
      resolved = await result.current.locate()
    })

    expect(resolved).toBeNull()
    expect(result.current.state).toBe('error')
  })

  it('stores position and resolves it on success', async () => {
    const getCurrentPosition = vi.fn((success) =>
      success({ coords: { latitude: 52.52, longitude: 13.4, accuracy: 12 } }),
    )
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    const { result } = renderHook(() => useGeolocation())

    let resolved
    await act(async () => {
      resolved = await result.current.locate()
    })

    expect(resolved).toEqual({ lat: 52.52, lng: 13.4, accuracy: 12 })
    await waitFor(() => expect(result.current.position).toEqual(resolved))
    expect(result.current.state).toBe('idle')
  })

  it('sets error state when the browser denies the request', async () => {
    const getCurrentPosition = vi.fn((_success, error) => error(new Error('denied')))
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } })

    const { result } = renderHook(() => useGeolocation())

    let resolved
    await act(async () => {
      resolved = await result.current.locate()
    })

    expect(resolved).toBeNull()
    expect(result.current.state).toBe('error')
  })
})
