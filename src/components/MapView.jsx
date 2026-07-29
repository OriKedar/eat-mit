import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import { densestArea } from '../lib/geo'

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

const meIcon = L.divIcon({
  className: 'me-wrapper',
  html: '<span class="me-dot"></span>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function clusterIcon(cluster) {
  const count = cluster.getChildCount()
  const size = count < 10 ? 34 : count < 50 ? 40 : 46
  return L.divIcon({
    html: `<span class="cluster-bubble">${count}</span>`,
    className: 'cluster-wrapper',
    iconSize: L.point(size, size, true),
  })
}

const FALLBACK_CENTER = [52.52, 13.405] // Berlin, so an empty map opens somewhere useful
const CITY_ZOOM = 12 // whole city in frame, not a street

// Opens on the city the user has pinned most, falling back to wherever they
// are. Runs once: after that the map is theirs to pan, and adding a place
// shouldn't yank the view somewhere else.
function InitialView({ entries, me }) {
  const map = useMap()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return

    if (entries.length) {
      const hub = densestArea(entries.map((e) => e.place))
      map.setView([hub.lat, hub.lng], CITY_ZOOM, { animate: false })
      done.current = true
      return
    }
    if (me) {
      map.setView([me.lat, me.lng], CITY_ZOOM, { animate: false })
      done.current = true
    }
  }, [entries, me, map])

  return null
}

function FocusOnSelection({ focus }) {
  const map = useMap()

  useEffect(() => {
    if (!focus) return
    map.flyTo([focus.place.lat, focus.place.lng], Math.max(map.getZoom(), 15), { duration: 0.6 })
  }, [focus, map])

  return null
}

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

function LocateControl({ state, onLocate }) {
  const map = useMap()

  async function handleClick() {
    const pos = await onLocate()
    if (pos) map.flyTo([pos.lat, pos.lng], Math.max(map.getZoom(), 15), { duration: 0.6 })
  }

  return (
    <button
      type="button"
      className={`locate-button ${state}`}
      onClick={handleClick}
      title={state === 'error' ? "Couldn't get your location" : 'Center on my location'}
      aria-label="Center on my location"
    >
      <LocateIcon />
    </button>
  )
}

// Leaflet fires 'contextmenu' for both right-click and a touch long-press,
// which is exactly the "drop a pin here" gesture we want.
function DropPinHandler({ onDropPin }) {
  useMapEvents({
    contextmenu(e) {
      onDropPin({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

export default function MapView({ entries, focus, onSelect, me, locateState, onLocate, onDropPin }) {
  return (
    <MapContainer center={FALLBACK_CENTER} zoom={CITY_ZOOM} className="map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <InitialView entries={entries} me={me} />
      <FocusOnSelection focus={focus} />
      <DropPinHandler onDropPin={onDropPin} />

      <MarkerClusterGroup
        iconCreateFunction={clusterIcon}
        showCoverageOnHover={false}
        maxClusterRadius={50}
        disableClusteringAtZoom={17}
        spiderfyOnMaxZoom
      >
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
                {entry.place.cuisine ? ` · ${entry.place.cuisine}` : ''}
              </div>
              {entry.place.address && <div className="popup-address">{entry.place.address}</div>}
              {entry.notes && <p className="popup-notes">{entry.notes}</p>}
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>

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

      <LocateControl state={locateState} onLocate={onLocate} />
    </MapContainer>
  )
}
