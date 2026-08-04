import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchPlaces, reverseGeocode } from './nominatim'

const SEARCH_RESULT = [
  {
    name: 'Mock Trattoria',
    display_name: 'Mock Trattoria, Torstraße 1, Berlin, Germany',
    lat: '52.5027',
    lon: '13.4265',
    osm_type: 'way',
    osm_id: 123,
    address: { road: 'Torstraße', house_number: '1', city: 'Berlin', country: 'Germany' },
    extratags: { cuisine: 'italian' },
    class: 'amenity',
    type: 'restaurant',
  },
]

const REVERSE_RESULT = {
  name: '',
  display_name: 'Weserstraße 40, Berlin, Germany',
  lat: '52.4966',
  lon: '13.4321',
  address: { road: 'Weserstraße', house_number: '40', city: 'Berlin', country: 'Germany' },
  extratags: {},
  class: 'amenity',
  type: null,
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn())
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('searchPlaces', () => {
  it('returns [] without calling fetch for queries under 3 chars', async () => {
    const result = await searchPlaces('yo')
    expect(result).toEqual([])
    expect(fetch).not.toHaveBeenCalled()
  })

  it('maps a successful response into place objects', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => SEARCH_RESULT })

    const promise = searchPlaces('trattoria')
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toEqual([
      {
        name: 'Mock Trattoria',
        lat: 52.5027,
        lng: 13.4265,
        address: 'Torstraße 1, Berlin, Germany',
        osm_id: 'way/123',
        cuisine: 'italian',
        kind: 'restaurant',
        displayName: 'Mock Trattoria, Torstraße 1, Berlin, Germany',
      },
    ])
  })

  it('throws on a non-ok response', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500 })
    const assertion = expect(searchPlaces('trattoria')).rejects.toThrow(
      'Nominatim search failed (500)',
    )
    await vi.runAllTimersAsync()
    await assertion
  })
})

describe('reverseGeocode', () => {
  it('resolves to a place for coordinates with an address', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => REVERSE_RESULT })

    const promise = reverseGeocode(52.4966, 13.4321)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(result).toMatchObject({
      lat: 52.4966,
      lng: 13.4321,
      address: 'Weserstraße 40, Berlin, Germany',
      osm_id: null,
    })
  })

  it('returns null when Nominatim reports an error for the coordinates', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({ error: 'Unable to geocode' }) })

    const promise = reverseGeocode(0, 0)
    await vi.runAllTimersAsync()
    expect(await promise).toBeNull()
  })
})
