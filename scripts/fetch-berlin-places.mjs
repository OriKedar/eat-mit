// One-time (well, occasional) build step: pull every restaurant/cafe/bar in
// Berlin out of OSM and bake it into a static file the app ships with.
//
// Why not query Overpass live from the app: Overpass is a general-purpose
// query engine for the entire planet, run for free — it is slow under load,
// rate-limited, and regularly times out. But Berlin's POI set is small
// (~15k places) and changes slowly, so there is no reason to ask a live API
// for it on every map pan. Extract once here, ship it, done.
//
//   node scripts/fetch-berlin-places.mjs
//
// Falls through a list of public mirrors until one answers, and queries in a
// grid of small cells so no single request is big enough to time out.
// Progress is written as it goes, so a partial run can be re-run safely.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src', 'data', 'berlin-places.json')
const CACHE = join(ROOT, 'node_modules', '.cache', 'berlin-places-raw.json')

// Public Overpass instances, tried in order. The first is the busiest (and so
// the flakiest); the others are community mirrors that are usually quieter.
const MIRRORS = [
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

const AMENITIES = ['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'ice_cream']
// Berlin's administrative bounding box, with a little slack.
const BBOX = { south: 52.33, west: 13.08, north: 52.68, east: 13.77 }
const CELL_DEG = 0.08 // ~9km x 5km per query — small enough to answer fast
const POLITE_DELAY_MS = 1200
const PER_REQUEST_TIMEOUT_MS = 90_000
// An overloaded mirror can sit on a request for over a minute before
// answering 504, so the probe gives up early — a mirror that can't answer a
// trivial query quickly is not one we want for 45 real ones.
const PROBE_TIMEOUT_MS = 10_000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function cells() {
  const out = []
  for (let south = BBOX.south; south < BBOX.north; south += CELL_DEG) {
    for (let west = BBOX.west; west < BBOX.east; west += CELL_DEG) {
      out.push({
        south: +south.toFixed(4),
        west: +west.toFixed(4),
        north: +Math.min(south + CELL_DEG, BBOX.north).toFixed(4),
        east: +Math.min(west + CELL_DEG, BBOX.east).toFixed(4),
      })
    }
  }
  return out
}

async function queryOverpass(endpoint, cell, timeoutMs = PER_REQUEST_TIMEOUT_MS) {
  const query = `[out:json][timeout:60];
nwr["amenity"~"^(${AMENITIES.join('|')})$"]["name"](${cell.south},${cell.west},${cell.north},${cell.east});
out center;`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Overpass asks that scripted clients identify themselves.
        'User-Agent': 'eat-mit build script (https://github.com/OriKedar/eat-mit)',
      },
      signal: controller.signal,
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()).elements
  } finally {
    clearTimeout(timer)
  }
}

async function pickMirror() {
  // A deliberately tiny query — just checking who answers, and how fast.
  const probe = { south: 52.51, west: 13.4, north: 52.515, east: 13.405 }
  for (const endpoint of MIRRORS) {
    const started = Date.now()
    try {
      const elements = await queryOverpass(endpoint, probe, PROBE_TIMEOUT_MS)
      console.log(`  OK   ${endpoint}  (${Date.now() - started}ms, ${elements.length} places)`)
      return endpoint
    } catch (err) {
      console.log(`  FAIL ${endpoint}  (${Date.now() - started}ms, ${err.message})`)
    }
  }
  return null
}

function toPlace(el) {
  const tags = el.tags || {}
  const pos = el.type === 'node' ? el : el.center
  if (!pos || !tags.name) return null
  return {
    name: tags.name,
    lat: +pos.lat.toFixed(5), // ~1m precision, plenty for a pin
    lng: +pos.lon.toFixed(5),
    kind: tags.amenity,
    cuisine: tags.cuisine || null,
    osm_id: `${el.type}/${el.id}`,
  }
}

console.log('Probing Overpass mirrors…')
const endpoint = await pickMirror()
if (!endpoint) {
  console.error(`
No Overpass mirror responded.

If every mirror failed, your network is probably blocking them (some
sandboxes and corporate networks do). Options:
  - try again from a different network
  - or download a Berlin extract and filter it locally instead:
      curl -O https://download.geofabrik.de/europe/germany/berlin-latest.osm.pbf
      osmium tags-filter berlin-latest.osm.pbf \\
        nwr/amenity=restaurant,cafe,fast_food,bar,pub,ice_cream \\
        -o berlin-food.osm.pbf
      osmium export berlin-food.osm.pbf -f json -o berlin-food.json
`)
  process.exit(1)
}
console.log(`\nUsing ${endpoint}\n`)

const all = new Map()
if (existsSync(CACHE)) {
  for (const p of JSON.parse(readFileSync(CACHE, 'utf8'))) all.set(p.osm_id, p)
  console.log(`Resuming with ${all.size} places already cached.\n`)
}

const grid = cells()
let failed = 0
for (const [i, cell] of grid.entries()) {
  const label = `[${i + 1}/${grid.length}] ${cell.south},${cell.west}`
  try {
    const elements = await queryOverpass(endpoint, cell)
    let added = 0
    for (const el of elements) {
      const place = toPlace(el)
      if (place && !all.has(place.osm_id)) {
        all.set(place.osm_id, place)
        added++
      }
    }
    console.log(`${label}  +${added} (total ${all.size})`)
  } catch (err) {
    failed++
    console.log(`${label}  FAILED: ${err.message}`)
  }
  mkdirSync(dirname(CACHE), { recursive: true })
  writeFileSync(CACHE, JSON.stringify([...all.values()]))
  await sleep(POLITE_DELAY_MS)
}

const places = [...all.values()].sort((a, b) => a.lat - b.lat)

// Ship as positional arrays rather than objects: the key names would otherwise
// repeat 15,000 times. The app expands these back into objects on load.
const packed = places.map((p) => [p.name, p.lat, p.lng, p.kind, p.cuisine, p.osm_id])
const json = JSON.stringify(packed)
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, json)

const asObjects = JSON.stringify(places)
console.log(`
Wrote ${places.length} places to src/data/berlin-places.json
  packed  : ${(json.length / 1024).toFixed(0)} KB raw, ${(gzipSync(json).length / 1024).toFixed(0)} KB gzipped
  (objects: ${(asObjects.length / 1024).toFixed(0)} KB raw, ${(gzipSync(asObjects).length / 1024).toFixed(0)} KB gzipped)
  cells failed: ${failed}${failed ? '  — re-run to retry just those' : ''}
`)
