// Nominatim usage policy: max 1 request/second, no bulk querying.
// Callers debounce; this module serialises and spaces requests as a backstop.
const ENDPOINT = 'https://nominatim.openstreetmap.org/search'
const REVERSE_ENDPOINT = 'https://nominatim.openstreetmap.org/reverse'
const MIN_INTERVAL_MS = 1100

let lastCallAt = 0

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function searchPlaces(query, { signal } = {}) {
  const trimmed = query.trim()
  if (trimmed.length < 3) return []

  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now()
  if (wait > 0) await delay(wait)
  lastCallAt = Date.now()

  const params = new URLSearchParams({
    q: trimmed,
    format: 'jsonv2',
    addressdetails: '1',
    extratags: '1',
    limit: '8',
  })

  const res = await fetch(`${ENDPOINT}?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Nominatim search failed (${res.status})`)

  const results = await res.json()
  return results.map(toPlace)
}

// Used by the drop-a-pin flow: we have coordinates and want a human address.
// Failure is non-fatal — the user can still name and save the spot.
export async function reverseGeocode(lat, lng, { signal } = {}) {
  const wait = lastCallAt + MIN_INTERVAL_MS - Date.now()
  if (wait > 0) await delay(wait)
  lastCallAt = Date.now()

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'jsonv2',
    addressdetails: '1',
    zoom: '18',
  })

  const res = await fetch(`${REVERSE_ENDPOINT}?${params}`, {
    signal,
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Nominatim reverse lookup failed (${res.status})`)

  const r = await res.json()
  if (r.error) return null
  return { ...toPlace(r), lat, lng }
}

function toPlace(r) {
  const a = r.address || {}
  const address = [
    [a.road, a.house_number].filter(Boolean).join(' '),
    a.suburb || a.neighbourhood,
    a.city || a.town || a.village,
    a.country,
  ]
    .filter(Boolean)
    .join(', ')

  return {
    name: r.name || r.display_name.split(',')[0],
    lat: Number(r.lat),
    lng: Number(r.lon),
    address: address || r.display_name,
    osm_id: r.osm_type && r.osm_id ? `${r.osm_type}/${r.osm_id}` : null,
    cuisine: r.extratags?.cuisine || null,
    displayName: r.display_name,
  }
}
