import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Real Leaflet needs real DOM layout (tile panes, canvas sizing) that jsdom
// doesn't provide, so react-leaflet/leaflet/the cluster plugin are replaced
// with light stand-ins that expose just enough (a controllable fake map
// object, plain-DOM Marker/Popup/Circle) to exercise MapView's own logic:
// pin coloring, zoom-tiered nearby capping, and the callbacks it wires up.
const mapState = {
  zoom: 12,
  center: { lat: 52.5, lng: 13.4 },
  bounds: { south: 52.0, west: 13.0, north: 53.0, east: 14.0 },
}
const mapEventListeners = {}
const mapObject = {
  getZoom: () => mapState.zoom,
  getCenter: () => mapState.center,
  getBounds: () => ({
    getSouth: () => mapState.bounds.south,
    getWest: () => mapState.bounds.west,
    getNorth: () => mapState.bounds.north,
    getEast: () => mapState.bounds.east,
  }),
  setView: vi.fn(),
  flyTo: vi.fn(),
}

vi.mock('leaflet', () => ({
  default: {
    divIcon: (opts) => ({ __divIcon: true, ...opts }),
    point: (w, h) => ({ w, h }),
  },
}))

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, className }) => (
    <div data-testid="map-container" className={className}>
      {children}
    </div>
  ),
  TileLayer: ({ url }) => <div data-testid="tile-layer" data-url={url} />,
  Marker: ({ position, icon, eventHandlers, children, ...rest }) => (
    <div
      data-testid="marker"
      data-lat={position[0]}
      data-lng={position[1]}
      data-tone={icon?.html?.match(/--pin-color:([^"]+)/)?.[1] || ''}
      data-nearby={icon?.html?.includes('pin-nearby') ? 'true' : 'false'}
      onClick={eventHandlers?.click}
      {...rest}
    >
      {children}
    </div>
  ),
  Popup: ({ children }) => <div data-testid="popup">{children}</div>,
  Circle: (props) => <div data-testid="circle" data-radius={props.radius} />,
  useMap: () => mapObject,
  useMapEvents: (handlers) => {
    Object.assign(mapEventListeners, handlers)
    return mapObject
  },
}))

vi.mock('react-leaflet-cluster', () => ({
  default: ({ children }) => <div data-testid="cluster-group">{children}</div>,
}))

const nearbyPlaces = { current: [] }
vi.mock('../hooks/useNearbyPlaces', () => ({
  useNearbyPlaces: () => nearbyPlaces.current,
}))

const { default: MapView } = await import('./MapView')

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

function nearbyPlace(overrides) {
  return { name: 'Nearby Place', lat: 52.501, lng: 13.401, kind: 'cafe', osm_id: 'way/2', ...overrides }
}

beforeEach(() => {
  localStorage.clear()
  mapState.zoom = 12
  mapState.center = { lat: 52.5, lng: 13.4 }
  mapState.bounds = { south: 52.0, west: 13.0, north: 53.0, east: 14.0 }
  nearbyPlaces.current = []
  mapObject.setView.mockClear()
  mapObject.flyTo.mockClear()
  for (const key of Object.keys(mapEventListeners)) delete mapEventListeners[key]
})

const noop = () => {}

describe('MapView — saved entries', () => {
  it('renders a marker per entry and colors it by status', () => {
    const entries = [
      savedEntry({ id: 'a', status: 'want_to_go' }),
      savedEntry({ id: 'b', status: 'visited', place: { ...savedEntry().place, lat: 52.52, lng: 13.42 } }),
    ]
    render(<MapView entries={entries} onSelect={noop} onSelectNearby={noop} onLocate={noop} onDropPin={noop} />)

    const markers = screen.getAllByTestId('marker')
    const wantToGo = markers.find((m) => m.dataset.lat === '52.5')
    const visited = markers.find((m) => m.dataset.lat === '52.52')

    expect(wantToGo.dataset.tone).toBe('#E8A33D')
    expect(visited.dataset.tone).toBe('#8FAE7C')
  })

  it('calls onSelect with the clicked entry', async () => {
    const onSelect = vi.fn()
    const entry = savedEntry({ id: 'clicked' })
    render(<MapView entries={[entry]} onSelect={onSelect} onSelectNearby={noop} onLocate={noop} onDropPin={noop} />)

    await userEvent.click(screen.getByTestId('marker'))
    expect(onSelect).toHaveBeenCalledWith(entry)
  })

  it('shows the visited/rating popup meta', () => {
    const entry = savedEntry({ status: 'visited', rating: 4 })
    render(<MapView entries={[entry]} onSelect={noop} onSelectNearby={noop} onLocate={noop} onDropPin={noop} />)

    expect(screen.getByText(/Visited/)).toBeInTheDocument()
    expect(screen.getByText(/★★★★/)).toBeInTheDocument()
  })
})

describe('MapView — location marker', () => {
  it('renders a Circle and marker for `me`, and none when absent', () => {
    const { rerender } = render(
      <MapView entries={[]} onSelect={noop} onSelectNearby={noop} onLocate={noop} onDropPin={noop} />,
    )
    expect(screen.queryByTestId('circle')).not.toBeInTheDocument()

    rerender(
      <MapView
        entries={[]}
        onSelect={noop}
        onSelectNearby={noop}
        onLocate={noop}
        onDropPin={noop}
        me={{ lat: 52.5, lng: 13.4, accuracy: 25 }}
      />,
    )
    expect(screen.getByTestId('circle')).toHaveAttribute('data-radius', '25')
  })
})

describe('MapView — basemap toggle', () => {
  it('starts dark and switches url + persists to localStorage on toggle', async () => {
    render(<MapView entries={[]} onSelect={noop} onSelectNearby={noop} onLocate={noop} onDropPin={noop} />)

    expect(screen.getByTestId('tile-layer').dataset.url).toContain('dark_all')

    await userEvent.click(screen.getByRole('button', { name: /switch to the light map/i }))

    expect(screen.getByTestId('tile-layer').dataset.url).toContain('rastertiles/voyager')
    expect(localStorage.getItem('eat-mit:basemap')).toBe('light')
  })
})

describe('MapView — nearby layer', () => {
  it('hides places already saved and shows the rest inside the viewport at full zoom', () => {
    mapState.zoom = 17
    nearbyPlaces.current = [
      nearbyPlace({ osm_id: 'way/1', lat: 52.5, lng: 13.4 }), // matches the saved entry, hidden
      nearbyPlace({ osm_id: 'way/2', name: 'Visible Nearby', lat: 52.55, lng: 13.45 }), // in bounds
      nearbyPlace({ osm_id: 'way/3', name: 'Outside Bounds', lat: 60, lng: 20 }), // out of bounds
    ]
    const entries = [savedEntry({ place: { ...savedEntry().place, osm_id: 'way/1' } })]

    render(<MapView entries={entries} onSelect={noop} onSelectNearby={noop} onLocate={noop} onDropPin={noop} />)

    expect(screen.getByText('Visible Nearby')).toBeInTheDocument()
    expect(screen.queryByText('Outside Bounds')).not.toBeInTheDocument()
  })

  it('calls onSelectNearby when a ghost pin is clicked', async () => {
    mapState.zoom = 17
    const onSelectNearby = vi.fn()
    const place = nearbyPlace({ osm_id: 'way/9', name: 'Click Me' })
    nearbyPlaces.current = [place]

    render(<MapView entries={[]} onSelect={noop} onSelectNearby={onSelectNearby} onLocate={noop} onDropPin={noop} />)

    const marker = screen.getAllByTestId('marker').find((m) => m.dataset.nearby === 'true')
    await userEvent.click(marker)
    expect(onSelectNearby).toHaveBeenCalledWith(place)
  })

  it('caps nearby pins to the nearest N below the full-zoom threshold', () => {
    mapState.zoom = 12 // below PINS_FULL_ZOOM(17) → LOW_ZOOM_PIN_CAP applies
    // 3 candidates, well under the cap — every one should render, proving
    // the low-zoom path runs (as opposed to erroring or dropping everything).
    nearbyPlaces.current = [
      nearbyPlace({ osm_id: 'n1', name: 'Near 1', lat: 52.501, lng: 13.401 }),
      nearbyPlace({ osm_id: 'n2', name: 'Near 2', lat: 52.502, lng: 13.402 }),
      nearbyPlace({ osm_id: 'n3', name: 'Near 3', lat: 52.503, lng: 13.403 }),
    ]

    render(<MapView entries={[]} onSelect={noop} onSelectNearby={noop} onLocate={noop} onDropPin={noop} />)

    expect(screen.getByText('Near 1')).toBeInTheDocument()
    expect(screen.getByText('Near 2')).toBeInTheDocument()
    expect(screen.getByText('Near 3')).toBeInTheDocument()
  })
})

describe('MapView — drop pin', () => {
  it('forwards a long-press/right-click contextmenu event as a dropped pin', () => {
    const onDropPin = vi.fn()
    render(<MapView entries={[]} onSelect={noop} onSelectNearby={noop} onLocate={noop} onDropPin={onDropPin} />)

    act(() => {
      mapEventListeners.contextmenu({ latlng: { lat: 52.55, lng: 13.45 } })
    })

    expect(onDropPin).toHaveBeenCalledWith({ lat: 52.55, lng: 13.45 })
  })
})

describe('MapView — locate control', () => {
  it('calls onLocate and flies to the resolved position', async () => {
    const onLocate = vi.fn().mockResolvedValue({ lat: 52.6, lng: 13.5 })
    render(<MapView entries={[]} onSelect={noop} onSelectNearby={noop} onLocate={onLocate} onDropPin={noop} />)

    await userEvent.click(screen.getByRole('button', { name: /center on my location/i }))

    expect(onLocate).toHaveBeenCalled()
    expect(mapObject.flyTo).toHaveBeenCalledWith([52.6, 13.5], expect.any(Number), expect.any(Object))
  })
})
