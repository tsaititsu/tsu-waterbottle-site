import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { inflateSync } from 'node:zlib'
import test from 'node:test'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const APP_DIR = path.join(ROOT, 'src/app')
const FAVICON_PATH = path.join(APP_DIR, 'favicon.ico')
const APPLE_ICON_PATH = path.join(APP_DIR, 'apple-icon.png')
const LAYOUT_PATH = path.join(APP_DIR, 'layout.tsx')
const SOURCE_PATH = path.join(ROOT, 'public/brand/waterbottle-logo-transparent-cropped.png')
const LEGACY_APPLE_SOURCE_PATH = path.join(ROOT, 'public/brand/waterbottle-logo-web.png')
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

const SOURCE_HASHES = new Map([
  [SOURCE_PATH, 'ec373dd457c70a9ed5992adef863ee462a3b7e8737e0c24f6dbfe4dc96338445'],
  [LEGACY_APPLE_SOURCE_PATH, '55e62860a55f4b4ec46ac21c191b07e4073d427c797ce4f98787b253ccaf9ec5'],
])

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex')
}

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function parsePng(buffer, label, { requireSrgb = false } = {}) {
  assert.ok(buffer.subarray(0, 8).equals(PNG_SIGNATURE), `${label} must have a PNG signature`)

  const chunks = []
  let offset = 8
  while (offset < buffer.length) {
    assert.ok(offset + 12 <= buffer.length, `${label} has a truncated PNG chunk header`)
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    const chunkEnd = dataEnd + 4
    assert.ok(chunkEnd <= buffer.length, `${label} has a truncated ${type} chunk`)
    assert.equal(
      buffer.readUInt32BE(dataEnd),
      crc32(buffer.subarray(offset + 4, dataEnd)),
      `${label} has an invalid ${type} CRC`,
    )
    chunks.push({ type, data: buffer.subarray(dataStart, dataEnd) })
    offset = chunkEnd
    if (type === 'IEND') break
  }

  assert.equal(offset, buffer.length, `${label} must not contain bytes after IEND`)
  assert.equal(chunks[0]?.type, 'IHDR', `${label} must begin with IHDR`)
  assert.equal(chunks.at(-1)?.type, 'IEND', `${label} must end with IEND`)
  assert.equal(chunks.filter(({ type }) => type === 'IHDR').length, 1)
  assert.equal(chunks.filter(({ type }) => type === 'IEND').length, 1)

  const ihdr = chunks[0].data
  assert.equal(ihdr.length, 13, `${label} IHDR must be 13 bytes`)
  const width = ihdr.readUInt32BE(0)
  const height = ihdr.readUInt32BE(4)
  const bitDepth = ihdr[8]
  const colorType = ihdr[9]
  const compression = ihdr[10]
  const filter = ihdr[11]
  const interlace = ihdr[12]

  assert.equal(bitDepth, 8, `${label} must use 8-bit channels`)
  assert.equal(colorType, 6, `${label} must use RGBA color`)
  assert.equal(compression, 0)
  assert.equal(filter, 0)
  assert.equal(interlace, 0, `${label} must be non-interlaced`)

  const idat = Buffer.concat(chunks.filter(({ type }) => type === 'IDAT').map(({ data }) => data))
  assert.ok(idat.length > 0, `${label} must contain image data`)
  const pixels = inflateSync(idat)
  const rowLength = width * 4 + 1
  assert.equal(pixels.length, rowLength * height, `${label} decompressed scanline length is invalid`)
  for (let row = 0; row < height; row += 1) {
    assert.ok(pixels[row * rowLength] <= 4, `${label} contains an invalid PNG filter`)
  }

  const forbiddenChunks = new Set(['eXIf', 'iCCP', 'tEXt', 'zTXt', 'iTXt'])
  for (const { type } of chunks) {
    assert.ok(!forbiddenChunks.has(type), `${label} must not contain ${type} metadata`)
  }
  assert.ok(!buffer.toString('latin1').match(/xmp|adobe|photoshop/i), `${label} contains editor metadata`)

  const srgbChunks = chunks.filter(({ type }) => type === 'sRGB')
  assert.ok(srgbChunks.length <= 1, `${label} must not declare sRGB more than once`)
  if (requireSrgb) {
    assert.equal(srgbChunks.length, 1, `${label} must declare sRGB exactly once`)
    assert.deepEqual([...srgbChunks[0].data], [0], `${label} must use perceptual sRGB rendering intent`)
  }

  return { width, height, chunks }
}

function parseIco(buffer) {
  assert.ok(buffer.length >= 6, 'favicon.ico must contain an ICO header')
  assert.equal(buffer.readUInt16LE(0), 0, 'ICO reserved field must be zero')
  assert.equal(buffer.readUInt16LE(2), 1, 'ICO type must be icon')
  const count = buffer.readUInt16LE(4)
  assert.ok(count >= 4, 'favicon.ico must contain at least four images')
  assert.ok(buffer.length >= 6 + count * 16, 'favicon.ico directory is truncated')

  const entries = []
  for (let index = 0; index < count; index += 1) {
    const offset = 6 + index * 16
    const width = buffer[offset] || 256
    const height = buffer[offset + 1] || 256
    const bytes = buffer.readUInt32LE(offset + 8)
    const imageOffset = buffer.readUInt32LE(offset + 12)
    assert.equal(width, height, `ICO entry ${index} must be square`)
    assert.ok(bytes > 0, `ICO entry ${index} must not be empty`)
    assert.ok(imageOffset >= 6 + count * 16, `ICO entry ${index} overlaps its directory`)
    assert.ok(imageOffset + bytes <= buffer.length, `ICO entry ${index} is truncated`)
    entries.push({ width, height, bytes, imageOffset })
  }

  const sorted = [...entries].sort((a, b) => a.imageOffset - b.imageOffset)
  for (let index = 1; index < sorted.length; index += 1) {
    assert.ok(
      sorted[index - 1].imageOffset + sorted[index - 1].bytes <= sorted[index].imageOffset,
      'ICO image payloads must not overlap',
    )
  }

  for (const size of [16, 32, 48, 64]) {
    assert.ok(entries.some(({ width, height }) => width === size && height === size), `ICO is missing ${size}x${size}`)
  }

  for (const entry of entries) {
    const payload = buffer.subarray(entry.imageOffset, entry.imageOffset + entry.bytes)
    const parsed = parsePng(payload, `favicon.ico ${entry.width}x${entry.height}`)
    assert.equal(parsed.width, entry.width)
    assert.equal(parsed.height, entry.height)
  }

  return entries
}

test('keeps both source brand assets byte-for-byte unchanged', () => {
  for (const [filePath, expectedHash] of SOURCE_HASHES) {
    assert.ok(existsSync(filePath), `${path.relative(ROOT, filePath)} must still exist`)
    assert.equal(sha256(filePath), expectedHash, `${path.relative(ROOT, filePath)} changed unexpectedly`)
  }

  const diff = spawnSync('git', ['diff', '--quiet', '--', ...[...SOURCE_HASHES.keys()].map((filePath) => path.relative(ROOT, filePath))], {
    cwd: ROOT,
  })
  assert.equal(diff.status, 0, 'source brand assets must have no Git diff')
})

test('uses only Next.js file-based root icon metadata', () => {
  const layout = readFileSync(LAYOUT_PATH, 'utf8')
  const metadataBlock = layout.slice(layout.indexOf('export const metadata'), layout.indexOf('export const viewport'))

  for (const required of ['metadataBase:', 'title:', 'description:', 'openGraph:', 'twitter:']) {
    assert.ok(metadataBlock.includes(required), `layout metadata must retain ${required}`)
  }
  assert.ok(!metadataBlock.match(/\bicons\s*:/), 'layout metadata must not define icons manually')
  assert.ok(!metadataBlock.match(/\bshortcut\s*:/), 'layout metadata must not define a shortcut icon')
  assert.ok(!metadataBlock.match(/\bapple\s*:/), 'layout metadata must not define an Apple icon manually')
  assert.ok(!metadataBlock.includes('/brand/waterbottle-logo-'), 'layout metadata must not reference legacy brand icon URLs')
  assert.ok(!metadataBlock.match(/favicon[^'"\s]*[?#]/i), 'layout metadata must not cache-bust a favicon URL manually')
  assert.ok(!metadataBlock.match(/https?:\/\/[^'"\s]*favicon/i), 'layout metadata must not use a hostname-specific favicon')

  const iconFiles = readdirSync(APP_DIR).filter((name) => /^(?:favicon\.ico|apple-icon(?:\d+)?\.png|icon(?:\d+)?\.(?:png|ico|jpg|jpeg|svg))$/i.test(name))
  assert.deepEqual(iconFiles.sort(), ['apple-icon.png', 'favicon.ico'])
  assert.ok(existsSync(FAVICON_PATH))
  assert.ok(existsSync(APPLE_ICON_PATH))
  assert.ok(!FAVICON_PATH.match(/[?#]/))
  assert.ok(!APPLE_ICON_PATH.match(/[?#]/))
})

test('provides a valid multi-resolution ICO with transparent square PNG payloads', () => {
  const favicon = readFileSync(FAVICON_PATH)
  assert.ok(statSync(FAVICON_PATH).size < 512_000, 'favicon.ico is unexpectedly large')
  const entries = parseIco(favicon)
  assert.deepEqual([...new Set(entries.map(({ width }) => width))].sort((a, b) => a - b), [16, 32, 48, 64])
})

test('provides a metadata-free 180x180 sRGB Apple touch icon', () => {
  assert.ok(statSync(APPLE_ICON_PATH).size < 512_000, 'apple-icon.png is unexpectedly large')
  const appleIcon = parsePng(readFileSync(APPLE_ICON_PATH), 'apple-icon.png', { requireSrgb: true })
  assert.deepEqual([appleIcon.width, appleIcon.height], [180, 180])
})

test('decodes generated assets with the independent macOS image decoder', () => {
  assert.ok(existsSync('/usr/bin/sips'), 'sips is required for the independent decoder check')
  for (const [filePath, expectedSize] of [[FAVICON_PATH, 64], [APPLE_ICON_PATH, 180]]) {
    const decoded = spawnSync('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', '-g', 'hasAlpha', filePath], {
      encoding: 'utf8',
    })
    assert.equal(decoded.status, 0, decoded.stderr)
    assert.match(decoded.stdout, new RegExp(`pixelWidth: ${expectedSize}`))
    assert.match(decoded.stdout, new RegExp(`pixelHeight: ${expectedSize}`))
    assert.match(decoded.stdout, /hasAlpha: yes/)
  }
})
