import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import {
  Map,
  useMap,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MapControls,
  MapClusterLayer,
  MapGeoJSON,
} from '@/components/ui/map'
import { densestArea, circlePolygon } from '../lib/geo'
import { useNearbyPlaces } from '../hooks/useNearbyPlaces'

// divIcon-style marker content: no bundler asset-path juggling, and the
// colour can encode status directly.
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

function Glyph({ kind, size }) {
  const group = KIND_ICON_GROUP[kind]
  if (!group) return null
  return (
    <svg
      className="pin-glyph"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      dangerouslySetInnerHTML={{ __html: KIND_GLYPHS[group] }}
    />
  )
}

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
      <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.4 8.4 0 1 0 10.2 10.2Z" fill="currentColor" />
    </svg>
  )
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

const FALLBACK_CENTER = [13.405, 52.52] // Berlin, so an empty map opens somewhere useful ([lng, lat])
const CITY_ZOOM = 12 // whole city in frame, not a street

// Opens on the city the user has pinned most, falling back to wherever they
// are. Runs once: after that the map is theirs to pan, and adding a place
// shouldn't yank the view somewhere else.
function InitialView({ entries, me }) {
  const { map } = useMap()
  const done = useRef(false)

  useEffect(() => {
    if (done.current || !map) return

    if (entries.length) {
      const hub = densestArea(entries.map((e) => e.place))
      map.jumpTo({ center: [hub.lng, hub.lat], zoom: CITY_ZOOM })
      done.current = true
      return
    }
    if (me) {
      map.jumpTo({ center: [me.lng, me.lat], zoom: CITY_ZOOM })
      done.current = true
    }
  }, [entries, me, map])

  return null
}

function FocusOnSelection({ focus }) {
  const { map } = useMap()

  useEffect(() => {
    if (!focus || !map) return
    map.flyTo({
      center: [focus.place.lng, focus.place.lat],
      zoom: Math.max(map.getZoom(), 15),
      duration: 600,
    })
  }, [focus, map])

  return null
}

// Leaflet fires 'contextmenu' for both right-click and a touch long-press,
// and MapLibre does the same — exactly the "drop a pin here" gesture we want.
function DropPinHandler({ onDropPin }) {
  const { map } = useMap()

  useEffect(() => {
    if (!map) return
    function handler(e) {
      onDropPin({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    }
    map.on('contextmenu', handler)
    return () => map.off('contextmenu', handler)
  }, [map, onDropPin])

  return null
}

// Tracks zoom + center — nothing here needs viewport bounds anymore since
// the nearby layer clusters the whole citywide dataset instead of manually
// capping by distance per zoom tier (see NearbyLayer).
function ViewportTracker({ onChange }) {
  const { map, isLoaded } = useMap()

  useEffect(() => {
    if (!map || !isLoaded) return
    function update() {
      const c = map.getCenter()
      onChange({ zoom: map.getZoom(), center: { lat: c.lat, lng: c.lng } })
    }
    update()
    map.on('moveend', update)
    map.on('zoomend', update)
    return () => {
      map.off('moveend', update)
      map.off('zoomend', update)
    }
  }, [map, isLoaded, onChange])

  return null
}

function LocateControl({ state, onLocate }) {
  const { map } = useMap()

  async function handleClick() {
    const pos = await onLocate()
    if (pos && map) map.flyTo({ center: [pos.lng, pos.lat], zoom: Math.max(map.getZoom(), 15), duration: 600 })
  }

  return (
    <button
      type="button"
      className={`map-fab locate-button ${state}`}
      onClick={handleClick}
      title={state === 'error' ? "Couldn't get your location" : 'Center on my location'}
      aria-label="Center on my location"
    >
      <LocateIcon />
    </button>
  )
}

// Dev-only readout of zoom + how many "nearby" places are loaded — stripped
// from prod builds since import.meta.env.DEV is statically false there.
function ZoomDebug({ zoom, count }) {
  if (!import.meta.env.DEV) return null
  return (
    <div className="zoom-debug">
      zoom {zoom} · {count} nearby
    </div>
  )
}

// Always-on layer of nearby restaurants, so the map shows what's around even
// before the user has saved anything. Ghost pins, distinct from the coloured
// saved-entry pins; clicking one shows a small popup with an explicit "Add"
// action rather than jumping straight into the add flow.
//
// Unlike the saved-entry pins, these render through MapClusterLayer — real
// per-place teardrop/glyph markers don't scale to a citywide dataset (~9.5k
// points for Berlin), and MapLibre's built-in clustering (via supercluster)
// handles that natively, so there's no need for the zoom-tiered distance
// capping the old Leaflet version did by hand. The trade-off: nearby pins
// render as plain dots instead of the teardrop+glyph saved pins get.
const MUTED_FOREGROUND = { dark: '#9c8e7c', light: '#7c6d58' }
// Muted brown/gold ramp so nearby-cluster bubbles read as ambient context,
// not competing with the gold/green saved-entry pins.
const NEARBY_CLUSTER_COLORS = { dark: ['#6b5d49', '#8a7355', '#a8895f'], light: ['#a8895f', '#8a7355', '#6b5d49'] }

function NearbyLayer({ savedOsmIds, onSelectNearby }) {
  const { map, resolvedTheme } = useMap()
  const all = useNearbyPlaces()
  const popupRef = useRef(null)

  useEffect(() => () => popupRef.current?.remove(), [])

  const geojson = useMemo(() => {
    const unsaved = all.filter((p) => !savedOsmIds.has(p.osm_id))
    return {
      type: 'FeatureCollection',
      features: unsaved.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { name: p.name, kind: p.kind || '', cuisine: p.cuisine || '', osm_id: p.osm_id },
      })),
    }
  }, [all, savedOsmIds])

  // Clicking a nearby dot doesn't jump straight into the add flow — it opens
  // a small popup (name, cuisine, an explicit "Add this place" button) so a
  // stray click doesn't open a modal. MapClusterLayer's unclustered points
  // are plain GL circles, not React components, so this popup is built with
  // the maplibre-gl API directly rather than MarkerPopup.
  const handlePointClick = useCallback(
    (feature, coordinates) => {
      if (!map) return
      popupRef.current?.remove()

      const place = {
        name: feature.properties.name,
        lat: coordinates[1],
        lng: coordinates[0],
        kind: feature.properties.kind || null,
        cuisine: feature.properties.cuisine || null,
        osm_id: feature.properties.osm_id,
      }

      const container = document.createElement('div')
      container.className = 'nearby-popup'

      const title = document.createElement('strong')
      title.textContent = place.name
      container.appendChild(title)

      if (place.cuisine) {
        const meta = document.createElement('div')
        meta.className = 'text-muted-foreground text-sm'
        meta.textContent = place.cuisine
        container.appendChild(meta)
      }

      const addButton = document.createElement('button')
      addButton.type = 'button'
      addButton.className = 'nearby-popup-add'
      addButton.textContent = 'Add this place'
      addButton.onclick = () => {
        popupRef.current?.remove()
        onSelectNearby(place)
      }
      container.appendChild(addButton)

      popupRef.current = new maplibregl.Popup({ closeButton: true, maxWidth: 'none' })
        .setLngLat(coordinates)
        .setDOMContent(container)
        .addTo(map)
    },
    [map, onSelectNearby],
  )

  return (
    <MapClusterLayer
      data={geojson}
      pointColor={MUTED_FOREGROUND[resolvedTheme] || MUTED_FOREGROUND.dark}
      clusterColors={NEARBY_CLUSTER_COLORS[resolvedTheme] || NEARBY_CLUSTER_COLORS.dark}
      clusterRadius={60}
      clusterMaxZoom={16}
      onPointClick={handlePointClick}
    />
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
  theme = 'dark',
  onToggleTheme,
}) {
  const [viewport, setViewport] = useState({ zoom: CITY_ZOOM, center: null })
  const savedOsmIds = new Set(entries.map((e) => e.place.osm_id).filter(Boolean))

  const accuracyCircle = useMemo(
    () => (me ? circlePolygon(me, me.accuracy) : null),
    [me],
  )

  return (
    <Map center={FALLBACK_CENTER} zoom={CITY_ZOOM} theme={theme} className="map">
      <MapControls position="top-left" />
      <ViewportTracker onChange={setViewport} />
      <InitialView entries={entries} me={me} />
      <FocusOnSelection focus={focus} />
      <DropPinHandler onDropPin={onDropPin} />
      <NearbyLayer savedOsmIds={savedOsmIds} onSelectNearby={onSelectNearby} />

      {entries.map((entry) => (
        <MapMarker
          key={entry.id}
          longitude={entry.place.lng}
          latitude={entry.place.lat}
          onClick={() => onSelect(entry)}
        >
          <MarkerContent>
            <span className="pin" style={{ '--pin-color': PIN_COLORS[pinTone(entry)] }}>
              <Glyph kind={entry.place.kind} size={11} />
            </span>
          </MarkerContent>
          <MarkerPopup>
            <strong>{entry.place.name}</strong>
            <div className="text-muted-foreground text-sm">
              {entry.status === 'visited' ? 'Visited' : 'Want to go'}
              {entry.rating ? ` · ${'★'.repeat(entry.rating)}` : ''}
              {entry.place.cuisine ? ` · ${entry.place.cuisine}` : ''}
            </div>
            {entry.place.address && (
              <div className="text-muted-foreground text-sm">{entry.place.address}</div>
            )}
            {entry.notes && <p className="mt-1">{entry.notes}</p>}
          </MarkerPopup>
        </MapMarker>
      ))}

      {me && accuracyCircle && (
        <MapGeoJSON
          data={accuracyCircle}
          fillPaint={{ 'fill-color': '#4a9eff', 'fill-opacity': 0.12 }}
          linePaint={{ 'line-color': '#4a9eff', 'line-width': 1 }}
        />
      )}
      {me && (
        <MapMarker longitude={me.lng} latitude={me.lat}>
          <MarkerContent>
            <span className="me-dot" />
          </MarkerContent>
        </MapMarker>
      )}

      <ZoomDebugPortal viewport={viewport} />

      <LocateControl state={locateState} onLocate={onLocate} />

      <button
        type="button"
        className="map-fab basemap-button"
        onClick={onToggleTheme}
        title={theme === 'dark' ? 'Switch to the light map' : 'Switch to the dark map'}
        aria-label={theme === 'dark' ? 'Switch to the light map' : 'Switch to the dark map'}
      >
        {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
    </Map>
  )
}

// ZoomDebug reads zoom off the ViewportTracker's lifted state and the nearby
// count off useNearbyPlaces directly — kept as its own tiny component so it
// can live inside <Map> (for useMap-free simplicity it doesn't actually need
// map context, just re-renders whenever MapView re-renders with new viewport).
function ZoomDebugPortal({ viewport }) {
  const all = useNearbyPlaces()
  return <ZoomDebug zoom={viewport.zoom} count={all.length} />
}
