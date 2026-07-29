// Renders the app icon (a map pin on a rounded dark tile) to PNG at the sizes
// the manifest and iOS need. Hand-rolled encoder so this needs no dependencies
// and no binary assets in the repo — run `npm run icons` after tweaking colors.
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
// maskable icons get cropped to an OS-chosen shape, so they need a full-bleed
// background and the mark pulled into the middle 80% safe zone.
const OUTPUTS = [
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-maskable-512.png', size: 512, maskable: true },
]

const BG = [20, 20, 26]
const PIN = [224, 139, 40]
const HOLE = [20, 20, 26]
const SS = 4 // supersampling factor, for antialiased edges

function roundedSquare(x, y, size, radius) {
  const cx = Math.min(Math.max(x, radius), size - radius)
  const cy = Math.min(Math.max(y, radius), size - radius)
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2
}

// Classic teardrop pin: a disc on top, tapering to a point at the bottom.
function inPin(x, y, size, scale) {
  const cx = size / 2
  const cy = size * 0.42
  const r = size * 0.23 * scale

  if ((x - cx) ** 2 + (y - cy) ** 2 <= r ** 2) return true

  const tipY = cy + (size * 0.82 - cy) * scale
  if (y < cy || y > tipY) return false
  const t = (y - cy) / (tipY - cy)
  const halfWidth = r * (1 - t) * Math.sqrt(1 - t * t + 1e-9)
  return Math.abs(x - cx) <= halfWidth
}

function inHole(x, y, size, scale) {
  const cx = size / 2
  const cy = size * 0.42
  return (x - cx) ** 2 + (y - cy) ** 2 <= (size * 0.095 * scale) ** 2
}

function renderRGBA(size, maskable) {
  const px = Buffer.alloc(size * size * 4)
  const radius = maskable ? 0 : size * 0.22
  const scale = maskable ? 0.72 : 1

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let bgHits = 0
      let pinHits = 0
      let samples = 0

      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px_ = x + (sx + 0.5) / SS
          const py_ = y + (sy + 0.5) / SS
          samples++
          if (!roundedSquare(px_, py_, size, radius)) continue
          bgHits++
          if (inPin(px_, py_, size, scale) && !inHole(px_, py_, size, scale)) pinHits++
        }
      }

      const alpha = bgHits / samples
      const pinMix = bgHits ? pinHits / bgHits : 0
      const base = pinMix > 0 ? mix(BG, PIN, pinMix) : BG
      const i = (y * size + x) * 4
      px[i] = base[0]
      px[i + 1] = base[1]
      px[i + 2] = base[2]
      px[i + 3] = Math.round(alpha * 255)
    }
  }
  return px
}

function mix(a, b, t) {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t))
}

function crc32(buf) {
  let c = ~0
  for (const byte of buf) {
    c ^= byte
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function encodePNG(rgba, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type: RGBA
  // bytes 10-12 stay zero: deflate, adaptive filtering, no interlace

  // One filter byte (0 = None) per scanline, as the PNG spec requires.
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(OUT_DIR, { recursive: true })
for (const { name, size, maskable } of OUTPUTS) {
  const png = encodePNG(renderRGBA(size, maskable), size)
  writeFileSync(join(OUT_DIR, name), png)
  console.log(`${name} (${size}x${size}, ${(png.length / 1024).toFixed(1)} kB)`)
}
