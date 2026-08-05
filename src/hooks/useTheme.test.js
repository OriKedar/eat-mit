import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useTheme } from './useTheme'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.classList.remove('dark')
})

describe('useTheme', () => {
  it('defaults to dark and sets the dark class on <html>', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('starts from a persisted preference', () => {
    localStorage.setItem('eat-mit:theme', 'light')
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('toggles the theme, updates <html> and persists it', () => {
    const { result } = renderHook(() => useTheme())

    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(localStorage.getItem('eat-mit:theme')).toBe('light')

    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(localStorage.getItem('eat-mit:theme')).toBe('dark')
  })
})
