import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
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

const FALLBACK_CENTER = [32.0853, 34.7818] // Tel Aviv, so an empty map isn't mid-ocean

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
