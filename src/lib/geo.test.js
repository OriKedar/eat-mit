import { describe, it, expect } from 'vitest'
import { distanceKm, densestArea, formatDistance, circlePolygon } from './geo'

describe('distanceKm', () => {
  it('is zero for identical points', () => {
    expect(distanceKm({ lat: 52.52, lng: 13.4 }, { lat: 52.52, lng: 13.4 })).toBe(0)
  })

  it('matches a known Berlin distance (Alexanderplatz to Brandenburg Gate)', () => {
    const alex = { lat: 52.5219, lng: 13.4132 }
    const gate = { lat: 52.5163, lng: 13.3777 }
    const km = distanceKm(alex, gate)
    expect(km).toBeGreaterThan(2.2)
    expect(km).toBeLessThan(2.7)
  })

  it('is symmetric', () => {
    const a = { lat: 52.5, lng: 13.4 }
    const b = { lat: 48.85, lng: 2.35 } // Paris
    expect(distanceKm(a, b)).toBeCloseTo(distanceKm(b, a), 9)
  })
})

describe('densestArea', () => {
  it('returns null for an empty list', () => {
    expect(densestArea([])).toBeNull()
  })

  it('centers on the single point given only one', () => {
    const p = { lat: 52.5, lng: 13.4 }
    expect(densestArea([p])).toEqual({ lat: 52.5, lng: 13.4 })
  })

  it('picks the cluster with more neighbours over a single outlier', () => {
    const cluster = [
      { lat: 52.50, lng: 13.40 },
      { lat: 52.51, lng: 13.41 },
      { lat: 52.505, lng: 13.405 },
    ]
    const outlier = { lat: 10, lng: 10 }
    const hub = densestArea([...cluster, outlier])

    // Hub should land near the cluster's centroid, nowhere near the outlier.
    expect(hub.lat).toBeGreaterThan(52)
    expect(hub.lat).toBeLessThan(53)
    expect(hub.lng).toBeGreaterThan(13)
    expect(hub.lng).toBeLessThan(14)
  })

  it('respects a custom radius', () => {
    // Two points 20km apart: default 15km radius keeps them in separate
    // clusters, a larger radius merges them into one.
    const a = { lat: 52.5, lng: 13.4 }
    const b = { lat: 52.68, lng: 13.4 } // ~20km north
    const wide = densestArea([a, b], 50)
    expect(wide.lat).toBeCloseTo((a.lat + b.lat) / 2, 2)
  })
})

describe('formatDistance', () => {
  it('formats sub-km distances in meters', () => {
    expect(formatDistance(0.42)).toBe('420 m')
  })

  it('formats under-10km distances with one decimal', () => {
    expect(formatDistance(3.14159)).toBe('3.1 km')
  })

  it('formats 10km+ distances rounded to a whole number', () => {
    expect(formatDistance(12.6)).toBe('13 km')
  })

  it('handles zero', () => {
    expect(formatDistance(0)).toBe('0 m')
  })
})

describe('circlePolygon', () => {
  it('produces a closed ring', () => {
    const feature = circlePolygon({ lat: 52.5, lng: 13.4 }, 100)
    const ring = feature.geometry.coordinates[0]
    expect(ring[0]).toEqual(ring[ring.length - 1])
  })

  it('keeps every vertex roughly the given radius from the center', () => {
    const center = { lat: 52.5, lng: 13.4 }
    const feature = circlePolygon(center, 500, 16)
    const ring = feature.geometry.coordinates[0]
    for (const [lng, lat] of ring) {
      const km = distanceKm(center, { lat, lng })
      expect(km).toBeGreaterThan(0.45)
      expect(km).toBeLessThan(0.55)
    }
  })
})
