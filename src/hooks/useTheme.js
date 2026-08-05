import { useEffect, useState } from 'react'

const THEME_KEY = 'eat-mit:theme'

// App-wide theme (dark/light) — a `dark` class on <html> drives both the
// Tailwind/shadcn CSS variables and the map's basemap tile choice, so the
// two never fall out of sync the way they could when MapView owned this
// alone. `dark` on <html> is also what mapcn's Map component auto-detects.
export function useTheme() {
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'))
  }

  return { theme, toggleTheme }
}
