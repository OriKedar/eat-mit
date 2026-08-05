import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Real MapLibre needs a real WebGL canvas that jsdom doesn't provide, so
// @/components/ui/map (the mapcn-generated wrapper) is replaced with light
// stand-ins that expose just enough (a controllable fake map object, plain-DOM
// marker/popup/cluster stand-ins) to exercise MapView's own logic: pin
// coloring, the nearby-layer saved/unsaved split, and the callbacks it wires
// up. The real map.jsx is vendored shadcn output, not something this project
// owns the correctness of — it isn't unit-tested here.
const mapState = { zoom: 12, center: { lat: 52.5, lng: 13.4 } }
const mapEventListeners = {}
const mapObject = {
  getZoom: () => mapState.zoom,
  getCenter: () => mapState.center,
  jumpTo: vi.fn(),
  flyTo: vi.fn(),
  on: (event, handler) => {
    mapEventListeners[event] = handler
  },
  off: (event, handler) => {
    if (mapEventListeners[event] === handler) delete mapEventListeners[event]
  },
}

// NearbyLayer builds its "add this place" popup with the maplibre-gl API
// directly (see MapView.jsx) — a minimal fake Popup that renders into
// document.body lets the test click through it like a real popup would.
class FakePopup {
  setLngLat() {
    return this
  }
  setDOMContent(el) {
    this.el = el
    document.body.appendChild(el)
    return this
  }
  addTo() {
    return this
  }
  remove() {
    this.el?.remove()
  }
}
vi.mock('maplibre-gl', () => ({ default: { Popup: FakePopup } }))

vi.mock('@/components/ui/map', () => ({
  Map: ({ children, className, theme }) => (
    <div data-testid="map-container" className={className} data-theme={theme}>
      {children}
    </div>
  ),
  useMap: () => ({ map: mapObject, isLoaded: true, resolvedTheme: 'dark' }),
  MapControls: () => null,
  MapMarker: ({ longitude, latitude, onClick, children }) => (
    <div data-testid="marker" data-lat={latitude} data-lng={longitude} onClick={onClick}>
      {children}
    </div>
  ),
  MarkerContent: ({ children }) => <div data-testid="marker-content">{children}</div>,
  MarkerPopup: ({ children }) => <div data-testid="popup">{children}</div>,
  MapGeoJSON: ({ data }) => <div data-testid="geojson" data-kind={data?.geometry?.type} />,
  MapClusterLayer: ({ data, onPointClick }) => (
    <div data-testid="cluster-layer">
      {data.features.map((f) => (
        <button
          key={f.properties.osm_id}
          type="button"
          data-testid="nearby-point"
          onClick={() => onPointClick(f, f.geometry.coordinates)}
        >
          {f.properties.name}
        </button>
      ))}
    </div>
  ),
}))

const nearbyPlaces = { current: [] }
vi.mock('../hooks/useNearbyPlaces', () => ({
  useNearbyPlaces: () => nearbyPlaces.current,
}))

const { default: MapView } = await import('./MapView')

function nearbyPlace(overrides) {
  return { name: 'Nearby Place', lat: 52.501, lng: 13.401, kind: 'cafe', osm_id: 'way/2', ...overrides }
}

function savedEntry(overrides) {
  return {
    id: 'e1',
    status: 'want_to_go',
    rating: 0,
    notes: '',
    place: { name: 'Saved Place', lat: 52.5, lng: 13.4, osm_id: 'way/1', kind: 'restaurant' },
    ...overrides,
  }
}

beforeEach(() => {
  mapState.zoom = 12
  mapState.center = { lat: 52.5, lng: 13.4 }
  Object.keys(mapEventListeners).forEach((k) => delete mapEventListeners[k])
  mapObject.jumpTo.mockClear()
  mapObject.flyTo.mockClear()
  nearbyPlaces.current = [
    nearbyPlace({ osm_id: 'way/1', name: 'Hidden Nearby' }), // matches a saved entry's osm_id in some tests, hidden there
    nearbyPlace({ osm_id: 'way/2', name: 'Visible Nearby' }),
  ]
})

const noop = () => {}
const baseProps = {
  entries: [],
  onSelect: noop,
  onSelectNearby: noop,
  onLocate: noop,
  onDropPin: noop,
  locateState: 'idle',
}

describe('MapView — saved entries', () => {
  it('renders a marker per entry and colors it by status', () => {
    const entries = [
      savedEntry({ id: 'a', status: 'want_to_go' }),
      savedEntry({ id: 'b', status: 'visited', place: { ...savedEntry().place, lat: 52.52, lng: 13.42 } }),
    ]
    render(<MapView {...baseProps} entries={entries} />)

    const markers = screen.getAllByTestId('marker')
    const wantToGo = markers.find((m) => m.dataset.lat === '52.5')
    const visited = markers.find((m) => m.dataset.lat === '52.52')

    expect(wantToGo.querySelector('.pin').style.getPropertyValue('--pin-color')).toBe('#E8A33D')
    expect(visited.querySelector('.pin').style.getPropertyValue('--pin-color')).toBe('#8FAE7C')
  })

  it('calls onSelect with the clicked entry', async () => {
    const onSelect = vi.fn()
    const entry = savedEntry({ id: 'clicked' })
    render(<MapView {...baseProps} entries={[entry]} onSelect={onSelect} />)

    await userEvent.click(screen.getByTestId('marker'))
    expect(onSelect).toHaveBeenCalledWith(entry)
  })

  it('shows the visited/rating popup meta', () => {
    const entry = savedEntry({ status: 'visited', rating: 4 })
    render(<MapView {...baseProps} entries={[entry]} />)

    expect(screen.getByText(/Visited/)).toBeInTheDocument()
    expect(screen.getByText(/★★★★/)).toBeInTheDocument()
  })
})

describe('MapView — location marker', () => {
  it('renders an accuracy circle and marker for `me`, and neither when absent', () => {
    const { rerender } = render(<MapView {...baseProps} />)
    expect(screen.queryByTestId('geojson')).not.toBeInTheDocument()

    rerender(<MapView {...baseProps} me={{ lat: 52.5, lng: 13.4, accuracy: 25 }} />)
    expect(screen.getByTestId('geojson')).toHaveAttribute('data-kind', 'Polygon')
    expect(screen.getAllByTestId('marker').some((m) => m.dataset.lat === '52.5')).toBe(true)
  })
})

describe('MapView — theme', () => {
  it('passes the theme through to the map and calls onToggleTheme from the FAB', async () => {
    const onToggleTheme = vi.fn()
    render(<MapView {...baseProps} theme="light" onToggleTheme={onToggleTheme} />)

    expect(screen.getByTestId('map-container')).toHaveAttribute('data-theme', 'light')

    await userEvent.click(screen.getByRole('button', { name: /switch to the dark map/i }))
    expect(onToggleTheme).toHaveBeenCalled()
  })
})

describe('MapView — nearby layer', () => {
  it('hides places already saved and shows the rest', () => {
    const entries = [savedEntry({ place: { ...savedEntry().place, osm_id: 'way/1' } })]
    render(<MapView {...baseProps} entries={entries} />)

    const points = screen.getAllByTestId('nearby-point')
    expect(points.map((p) => p.textContent)).toEqual(['Visible Nearby'])
  })

  it('clicking a nearby point opens a popup instead of calling onSelectNearby directly', async () => {
    const onSelectNearby = vi.fn()
    render(<MapView {...baseProps} onSelectNearby={onSelectNearby} />)

    const points = screen.getAllByTestId('nearby-point')
    await userEvent.click(points[0])

    expect(onSelectNearby).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /add this place/i })).toBeInTheDocument()
  })

  it('calls onSelectNearby once the popup\'s add button is clicked', async () => {
    const onSelectNearby = vi.fn()
    render(<MapView {...baseProps} onSelectNearby={onSelectNearby} />)

    await userEvent.click(screen.getAllByTestId('nearby-point')[0])
    await userEvent.click(screen.getByRole('button', { name: /add this place/i }))

    expect(onSelectNearby).toHaveBeenCalledWith(expect.objectContaining({ name: 'Hidden Nearby' }))
  })
})

describe('MapView — drop pin', () => {
  it('forwards a long-press/right-click contextmenu event as a dropped pin', () => {
    const onDropPin = vi.fn()
    render(<MapView {...baseProps} onDropPin={onDropPin} />)

    act(() => {
      mapEventListeners.contextmenu({ lngLat: { lat: 52.55, lng: 13.45 } })
    })

    expect(onDropPin).toHaveBeenCalledWith({ lat: 52.55, lng: 13.45 })
  })
})

describe('MapView — locate control', () => {
  it('calls onLocate and flies to the resolved position', async () => {
    const onLocate = vi.fn().mockResolvedValue({ lat: 52.6, lng: 13.5 })
    render(<MapView {...baseProps} onLocate={onLocate} />)

    await userEvent.click(screen.getByRole('button', { name: /center on my location/i }))

    expect(onLocate).toHaveBeenCalled()
    expect(mapObject.flyTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [13.5, 52.6] }),
    )
  })
})
