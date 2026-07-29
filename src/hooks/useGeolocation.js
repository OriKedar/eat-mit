import { useCallback, useState } from 'react'

// Lifted out of the map so the list can sort by distance from the same fix.
export function useGeolocation() {
  const [position, setPosition] = useState(null) // {lat, lng, accuracy}
  const [state, setState] = useState('idle') // idle | locating | error

  const locate = useCallback(
    () =>
      new Promise((resolve) => {
        if (!navigator.geolocation) {
          setState('error')
          resolve(null)
          return
        }
        setState('locating')
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const next = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            }
            setPosition(next)
            setState('idle')
            resolve(next)
          },
          () => {
            setState('error')
            resolve(null)
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
        )
      }),
    [],
  )

  return { position, state, locate }
}
