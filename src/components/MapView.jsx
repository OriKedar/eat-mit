import { useEffect, useMemo, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet'
import L from 'leaflet'

// divIcon instead of the default PNG marker: no bundler asset-path juggling,
// and the colour can encode status directly.
const iconCache = new Map()
function pinIcon(status) {
  if (!iconCache.has(status)) {
    const color = status === 'visited' ? '#2f9e5f' : '#e08b28'
    iconCache.set(
      status,
      L.divIcon({
        className: 'pin-wrapper',
        html: `<span class="pin" style="--pin-color:${color}"></span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
        popupAnchor: [0, -20],
      }),
    )
  }
  return iconCache.get(status)
}

const FALLBACK_CENTER = [52.52, 13.405] // Berlin, so an empty map opens somewhere useful

function FitBounds({ entries, focus }) {
  const map = useMap()

  useEffect(() => {
    if (focus) {
      map.flyTo([focus.place.lat, focus.place.lng], Math.max(map.getZoom(), 15), {
        duration: 0.6,
      })
      return
    }
    if (!entries.length) return
    map.fitBounds(
      L.latLngBounds(entries.map((e) => [e.place.lat, e.place.lng])).pad(0.2),
      { animate: false },
    )
    // Only refit when the set of pins changes, not on every focus clear.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries.length, focus?.id])

  return null
}

const meIcon = L.divIcon({
  className: 'me-wrapper',
  html: '<span class="me-dot"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

// Standard "my location" crosshair: ring, centre dot, four ticks.
function LocateIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <line x1="12" y1="1.8" x2="12" y2="4.6" />
        <line x1="12" y1="19.4" x2="12" y2="22.2" />
        <line x1="1.8" y1="12" x2="4.6" y2="12" />
        <line x1="19.4" y1="12" x2="22.2" y2="12" />
      </g>
    </svg>
  )
}

function LocateControl() {
  const map = useMap()
  const [me, setMe] = useState(null)
  const [state, setState] = useState('idle') // idle | locating | error

  function locate() {
    if (!navigator.geolocation) {
      setState('error')
      return
    }
    setState('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setMe({ lat: latitude, lng: longitude, accuracy })
        setState('idle')
        map.flyTo([latitude, longitude], Math.max(map.getZoom(), 15), { duration: 0.6 })
      },
      () => setState('error'),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  }

  return (
    <>
      <button
        type="button"
        className={`locate-button ${state}`}
        onClick={locate}
        title={state === 'error' ? "Couldn't get your location" : 'Center on my location'}
        aria-label="Center on my location"
      >
        <LocateIcon />
      </button>
      {me && (
        <>
          <Circle
            center={[me.lat, me.lng]}
            radius={me.accuracy}
            pathOptions={{ color: '#4a9eff', weight: 1, fillOpacity: 0.12 }}
          />
          <Marker position={[me.lat, me.lng]} icon={meIcon} />
        </>
      )}
    </>
  )
}

export default function MapView({ entries, focus, onSelect }) {
  const center = useMemo(() => {
    if (entries.length) return [entries[0].place.lat, entries[0].place.lng]
    return FALLBACK_CENTER
  }, [entries])

  return (
    <MapContainer center={center} zoom={13} className="map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <FitBounds entries={entries} focus={focus} />
      <LocateControl />
      {entries.map((entry) => (
        <Marker
          key={entry.id}
          position={[entry.place.lat, entry.place.lng]}
          icon={pinIcon(entry.status)}
          eventHandlers={{ click: () => onSelect(entry) }}
        >
          <Popup>
            <strong>{entry.place.name}</strong>
            <div className="popup-meta">
              {entry.status === 'visited' ? 'Visited' : 'Want to go'}
              {entry.rating ? ` · ${'★'.repeat(entry.rating)}` : ''}
            </div>
            {entry.place.address && <div className="popup-address">{entry.place.address}</div>}
            {entry.notes && <p className="popup-notes">{entry.notes}</p>}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
