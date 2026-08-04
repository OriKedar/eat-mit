import { describe, it, expect, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useOnline } from './useOnline'

function setNavigatorOnLine(value) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true })
}

afterEach(() => {
  setNavigatorOnLine(true)
})

describe('useOnline', () => {
  it('starts with navigator.onLine', () => {
    setNavigatorOnLine(false)
    const { result } = renderHook(() => useOnline())
    expect(result.current).toBe(false)
  })

  it('flips to false on an offline event', () => {
    const { result } = renderHook(() => useOnline())
    expect(result.current).toBe(true)

    act(() => window.dispatchEvent(new Event('offline')))
    expect(result.current).toBe(false)
  })

  it('flips back to true on an online event', () => {
    setNavigatorOnLine(false)
    const { result } = renderHook(() => useOnline())
    expect(result.current).toBe(false)

    act(() => window.dispatchEvent(new Event('online')))
    expect(result.current).toBe(true)
  })
})
