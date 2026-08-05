const EARTH_RADIUS_KM = 6371

export function distanceKm(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

// Where to open the map: the middle of wherever the user has the most pins,
// rather than their newest one. Counting neighbours within a radius (instead
// of bucketing into a grid) avoids a city getting split across cell borders.
// O(n²), which is fine for a personal list of a few hundred places.
export function densestArea(points, radiusKm = 15) {
  if (!points.length) return null

  let best = null
  let bestCount = -1

  for (const candidate of points) {
    const near = points.filter((p) => distanceKm(candidate, p) <= radiusKm)
    if (near.length > bestCount) {
      bestCount = near.length
      best = near
    }
  }

  return {
    lat: best.reduce((sum, p) => sum + p.lat, 0) / best.length,
    lng: best.reduce((sum, p) => sum + p.lng, 0) / best.length,
  }
}

// Approximates a geodesic circle as a GeoJSON polygon — used for the "my
// location" accuracy ring, which MapLibre has no built-in primitive for.
export function circlePolygon(center, radiusMeters, points = 48) {
  const lat = (center.lat * Math.PI) / 180
  const dLat = radiusMeters / 111320
  const dLng = radiusMeters / (111320 * Math.cos(lat))

  const ring = []
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI
    ring.push([center.lng + dLng * Math.cos(angle), center.lat + dLat * Math.sin(angle)])
  }

  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} }
}

export function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)} m`
  if (km < 10) return `${km.toFixed(1)} km`
  return `${Math.round(km)} km`
}
