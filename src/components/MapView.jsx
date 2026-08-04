import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap, useMapEvents } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import { densestArea, distanceKm } from '../lib/geo'
import { useNearbyPlaces } from '../hooks/useNearbyPlaces'

// divIcon instead of the default PNG marker: no bundler asset-path juggling,
// and the colour can encode status directly.
//   gold  — still want to go
//   green — visited
const PIN_COLORS = { want_to_go: '#E8A33D', visited: '#8FAE7C' }

function pinTone(entry) {
  return entry.status === 'visited' ? 'visited' : 'want_to_go'
}

// OSM has far more amenity values than we want distinct icons for, so they
// fold down to the three the pins actually distinguish. Anything else (or no
// kind at all — hand-placed pins, older saved rows) gets no glyph.
const KIND_ICON_GROUP = {
  restaurant: 'restaurant',
  fast_food: 'restaurant',
  bar: 'bar',
  pub: 'bar',
  cafe: 'cafe',
  ice_cream: 'cafe',
}

const KIND_GLYPHS = {
  restaurant:
    '<path d="M6 2v7a2 2 0 0 0 4 0V2M8 9v13M16 2c-2 0-3 2-3 5s1 5 3 5v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  bar: '<path d="M4 4h16M4 4l8 9 8-9M12 13v7M8 20h8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  cafe: '<path d="M4 8h13v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M17 9h1a3 3 0 0 1 0 6h-1" fill="none" stroke="currentColor" stroke-width="2"/>',
}

function glyphMarkup(kind, size) {
  const group = KIND_ICON_GROUP[kind]
  if (!group) return ''
  return `<svg class="pin-glyph" viewBox="0 0 24 24" width="${size}" height="${size}">${KIND_GLYPHS[group]}</svg>`
}

const iconCache = new Map()
function pinIcon(tone, kind) {
  const cacheKey = `${tone}:${kind || ''}`
  if (!iconCache.has(cacheKey)) {
    iconCache.set(
      cacheKey,
      L.divIcon({
        className: 'pin-wrapper',
        html: `<span class="pin" style="--pin-color:${PIN_COLORS[tone]}">${glyphMarkup(kind, 11)}</span>`,
        iconSize: [22, 22],
        iconAnchor: [11, 22],
        popupAnchor: [0, -20],
      }),
    )
  }
  return iconCache.get(cacheKey)
}

// At/above this zoom: every real place in the current viewport, uncapped,
// grouped by MarkerClusterGroup same as saved pins — 17+ already looks
// right, leave this tier alone. Below it, two capped tiers instead of one
// so the density step-down feels gradual rather than a single 25→everything
// jump: ≤14 shows more (a wide view with too few pins looks sparse/broken),
// 15-16 shows fewer (getting close to full detail, so a smaller top-up is
// enough). Tune both with the zoom-debug badge.
const PINS_FULL_ZOOM = 17
const LOW_ZOOM_PIN_CAP = 40
const MID_ZOOM_PIN_CAP = 70

const nearbyIconCache = new Map()
function nearbyIcon(kind) {
  const cacheKey = kind || ''
  if (!nearbyIconCache.has(cacheKey)) {
    nearbyIconCache.set(
      cacheKey,
      L.divIcon({
        className: 'pin-wrapper',
        html: `<span class="pin pin-nearby">${glyphMarkup(kind, 9)}</span>`,
        iconSize: [18, 18],
        iconAnchor: [9, 18],
        popupAnchor: [0, -16],
      }),
    )
  }
  return nearbyIconCache.get(cacheKey)
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

// Both styles come from the same CARTO host, so the service worker's tile
// cache rule covers either without change.
const BASEMAPS = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    label: 'Switch to the light map',
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    label: 'Switch to the dark map',
  },
}
const BASEMAP_KEY = 'eat-mit:basemap'

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4.2" fill="currentColor" />
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <line x1="12" y1="2.4" x2="12" y2="5" />
        <line x1="12" y1="19" x2="12" y2="21.6" />
        <line x1="2.4" y1="12" x2="5" y2="12" />
        <line x1="19" y1="12" x2="21.6" y2="12" />
        <line x1="5.5" y1="5.5" x2="7.3" y2="7.3" />
        <line x1="16.7" y1="16.7" x2="18.5" y2="18.5" />
        <line x1="5.5" y1="18.5" x2="7.3" y2="16.7" />
        <line x1="16.7" y1="7.3" x2="18.5" y2="5.5" />
      </g>
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z"
        fill="currentColor"
      />
    </svg>
  )
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

// Tracks zoom + center + viewport bounds — everything NearbyLayer needs to
// pick between its two selection strategies (see PINS_FULL_ZOOM).
function useMapView() {
  const [zoom, setZoom] = useState(null)
  const [center, setCenter] = useState(null)
  const [bounds, setBounds] = useState(null)

  const map = useMapEvents({
    moveend: update,
    zoomend: update,
  })

  function update() {
    setZoom(map.getZoom())
    const c = map.getCenter()
    setCenter({ lat: c.lat, lng: c.lng })
    const b = map.getBounds()
    setBounds({
      south: b.getSouth(),
      west: b.getWest(),
      north: b.getNorth(),
      east: b.getEast(),
    })
  }

  useEffect(update, [])

  return { zoom, center, bounds }
}

// Dev-only readout of zoom + how many pins that zoom is actually putting into
// the cluster group — the two numbers you need to tune maxClusterRadius /
// disableClusteringAtZoom above without guessing. Stripped from prod builds
// since import.meta.env.DEV is statically false there (see App.jsx's DEV_MOCK
// for the same pattern).
function ZoomDebug({ zoom, count }) {
  if (!import.meta.env.DEV) return null
  return (
    <div className="zoom-debug">
      zoom {zoom} · {count} pins
    </div>
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

// Always-on layer of nearby restaurants, so the map shows what's around even
// before the user has saved anything. Ghost pins, distinct from the coloured
// saved-entry pins; clicking one starts the add flow pre-filled with that
// place instead of a fresh search.
//
// Three zoom tiers (see PINS_FULL_ZOOM / LOW_ZOOM_PIN_CAP / MID_ZOOM_PIN_CAP):
// ≤14 and 15-16 both cap to the closest N places to the map center — just a
// different N — so neither a wide view nor a medium one turns into noise.
// At PINS_FULL_ZOOM and above, everything in the viewport, uncapped;
// clustering below groups it the same way it always has.
//
// ≤14 renders ungrouped — real individual pins, not cluster bubbles. 15+ is
// unchanged: still wrapped in MarkerClusterGroup exactly as before.
function NearbyLayer({ savedOsmIds, onSelectNearby }) {
  const { zoom, center, bounds } = useMapView()
  const all = useNearbyPlaces()

  let unsaved = []
  if (center) {
    const candidates = all.filter((p) => !savedOsmIds.has(p.osm_id))
    if (zoom >= PINS_FULL_ZOOM && bounds) {
      const { south, west, north, east } = bounds
      unsaved = candidates.filter(
        (p) => p.lat >= south && p.lat <= north && p.lng >= west && p.lng <= east,
      )
    } else {
      const cap = zoom >= 15 ? MID_ZOOM_PIN_CAP : LOW_ZOOM_PIN_CAP
      unsaved = candidates
        .map((p) => ({ ...p, _km: distanceKm(center, p) }))
        .sort((a, b) => a._km - b._km)
        .slice(0, cap)
    }
  }

  const markers = unsaved.map((place) => (
    <Marker
      key={place.osm_id}
      position={[place.lat, place.lng]}
      icon={nearbyIcon(place.kind)}
      eventHandlers={{ click: () => onSelectNearby(place) }}
    >
      <Popup>
        <strong>{place.name}</strong>
        {place.cuisine && <div className="popup-meta">{place.cuisine}</div>}
        {place.address && <div className="popup-address">{place.address}</div>}
      </Popup>
    </Marker>
  ))

  return (
    <>
      <ZoomDebug zoom={zoom} count={unsaved.length} />
      {zoom >= 15 ? (
        <MarkerClusterGroup
          iconCreateFunction={clusterIcon}
          showCoverageOnHover={false}
          maxClusterRadius={40}
          disableClusteringAtZoom={17}
          spiderfyOnMaxZoom
        >
          {markers}
        </MarkerClusterGroup>
      ) : (
        markers
      )}
    </>
  )
}

export default function MapView({
  entries,
  focus,
  onSelect,
  onSelectNearby,
  me,
  locateState,
  onLocate,
  onDropPin,
}) {
  const [basemap, setBasemap] = useState(
    () => localStorage.getItem(BASEMAP_KEY) || 'dark',
  )

  function toggleBasemap() {
    const next = basemap === 'dark' ? 'light' : 'dark'
    setBasemap(next)
    localStorage.setItem(BASEMAP_KEY, next)
  }

  const savedOsmIds = new Set(entries.map((e) => e.place.osm_id).filter(Boolean))

  return (
    <MapContainer
      center={FALLBACK_CENTER}
      zoom={CITY_ZOOM}
      className={`map basemap-${basemap}`}
      scrollWheelZoom
    >
      <TileLayer
        key={basemap}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={BASEMAPS[basemap].url}
        subdomains="abcd"
        maxZoom={20}
        detectRetina /* fills the {r} slot with @2x on high-DPI screens */
      />
      <InitialView entries={entries} me={me} />
      <FocusOnSelection focus={focus} />
      <DropPinHandler onDropPin={onDropPin} />
      <NearbyLayer savedOsmIds={savedOsmIds} onSelectNearby={onSelectNearby} />

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
            icon={pinIcon(pinTone(entry), entry.place.kind)}
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

      <button
        type="button"
        className="basemap-button"
        onClick={toggleBasemap}
        title={BASEMAPS[basemap].label}
        aria-label={BASEMAPS[basemap].label}
      >
        {basemap === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
    </MapContainer>
  )
}
