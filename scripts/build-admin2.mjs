// Builds the second level (cities / counties / districts) for every country from geoBoundaries gbOpen ADM2.
//   node scripts/build-admin2.mjs [ISO3 ISO3 …]      (default: every country in public/maps/admin1/index.json)
// Output: public/maps/admin2/<ISO3>.json + public/maps/admin2/index.json
//
// Region ids encode their parent so the app can light up parents without loading any data:
//   level-1 id  "JPN:1234"      (from build-admin1.mjs)
//   level-2 id  "JPN:1234.7"    ("<parent>.<n>")  → parentOf(code) = code before the dot
//
// geoBoundaries (https://www.geoboundaries.org) is CC BY 4.0 / per-country licenses (mostly CC BY, some OSM ODbL / CC BY-SA).
// The in-app credits mention it. South Korea is skipped: it has its own KOSTAT 2018 levels.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { geoArea, geoBounds, geoCentroid, geoContains, geoDistance } from 'd3-geo'
import { feature, quantize } from 'topojson-client'
import { topology } from 'topojson-server'
import { presimplify, simplify, sphericalTriangleArea } from 'topojson-simplify'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const admin1Dir = path.join(root, 'public/maps/admin1')
const outDir = path.join(root, 'public/maps/admin2')
const cacheDir = path.join(root, 'scripts/.cache/adm2')
fs.mkdirSync(outDir, { recursive: true })
fs.mkdirSync(cacheDir, { recursive: true })

const index1 = JSON.parse(fs.readFileSync(path.join(admin1Dir, 'index.json'), 'utf8'))
const wanted = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(index1)

// ---------- geometry helpers ----------
const ringArea = (r) => {
  let a = 0
  for (let i = 0, n = r.length - 1; i < n; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
  return a / 2
}
const rewindPoly = (rings) => rings.map((r, i) => ((ringArea(r) < 0) === (i === 0) ? r : [...r].reverse()))
const polygonsOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [])
/** valid, clockwise polygons only (simplification can leave zero-width slivers d3 reads as "the whole sphere") */
function clean(g) {
  const polys = polygonsOf(g)
    .map(rewindPoly)
    .filter((c) => {
      const a = geoArea({ type: 'Polygon', coordinates: c })
      return a > 0 && a <= 2 && c[0].length >= 4
    })
  return polys.length ? { type: 'MultiPolygon', coordinates: polys } : null
}

// what the app checks at runtime: a polygon as stored must not look like "the whole sphere"
const validAsIs = (c) => {
  const a = geoArea({ type: 'Polygon', coordinates: c })
  return a > 0 && a <= 2 && c[0].length >= 4
}

function spanOf(g) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  const walk = (c) => (typeof c[0] === 'number' ? ((x0 = Math.min(x0, c[0])), (x1 = Math.max(x1, c[0])), (y0 = Math.min(y0, c[1])), (y1 = Math.max(y1, c[1]))) : c.forEach(walk))
  walk(g.coordinates)
  return Math.max(x1 - x0, y1 - y0)
}

// ---------- labels ----------
const KO = {
  county: '카운티', counties: '카운티', district: '군·구', districts: '군·구', municipality: '시·군', municipalities: '시·군',
  city: '시', cities: '시', department: '데파르트망', departments: '데파르트망', province: '주·도', provinces: '주·도',
  prefecture: '현', prefectures: '현', subprefecture: '시·정·촌', subprefectures: '시·정·촌', commune: '코뮌', communes: '코뮌',
  parish: '교구', parishes: '교구', canton: '주', cantons: '주', 'rural district': '군', borough: '구', regency: '군·시', regencies: '군·시',
  governorate: '주', governorates: '주', region: '지방', regions: '지방', zone: '구역', zones: '구역', 'local government area': '지방자치구',
  'local government areas': '지방자치구', 'second-level': '시·군·구',
}
const koLabel = (en) => KO[en.toLowerCase()] ?? '시·군·구'
function enLabel(canon) {
  const t = (canon || 'Districts').trim()
  const one = t.split(/[|,/]/)[0].trim()
  const cap = one.charAt(0).toUpperCase() + one.slice(1)
  if (/s$/i.test(cap)) return cap
  if (/y$/i.test(cap) && !/[aeiou]y$/i.test(cap)) return cap.slice(0, -1) + 'ies'
  return /(sh|ch|x)$/i.test(cap) ? cap + 'es' : cap + 's'
}

// ---------- download ----------
async function fetchRetry(url, tries = 3) {
  let last
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(90_000) })
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`${res.status} ${url}`)
      return res
    } catch (e) {
      last = e
      await new Promise((r) => setTimeout(r, 800 * (i + 1)))
    }
  }
  throw last
}

async function loadAdm2(iso3) {
  const cacheFile = path.join(cacheDir, `${iso3}.json`)
  if (fs.existsSync(cacheFile)) return JSON.parse(fs.readFileSync(cacheFile, 'utf8'))
  const metaRes = await fetchRetry(`https://www.geoboundaries.org/api/current/gbOpen/${iso3}/ADM2/`)
  if (!metaRes) return null
  const meta = await metaRes.json().catch(() => null)
  const url = meta?.simplifiedGeometryGeoJSON || meta?.gjDownloadURL
  if (!url) return null
  const res = await fetchRetry(url)
  if (!res) return null
  const geo = await res.json()
  const packed = { canonical: meta.boundaryCanonical, license: meta.boundaryLicense, source: meta.boundarySource, geo }
  fs.writeFileSync(cacheFile, JSON.stringify(packed))
  return packed
}

// ---------- main ----------
const index2 = fs.existsSync(path.join(outDir, 'index.json')) && process.argv.slice(2).length ? JSON.parse(fs.readFileSync(path.join(outDir, 'index.json'), 'utf8')) : {}
let total = 0
const skipped = []

async function build(iso3) {
  if (iso3 === 'KOR' || !index1[iso3]) return
  const packed = await loadAdm2(iso3)
  if (!packed) return void skipped.push(`${iso3}: no ADM2`)

  // level-1 regions (our parents)
  const t1 = JSON.parse(fs.readFileSync(path.join(admin1Dir, `${iso3}.json`), 'utf8'))
  const parents = feature(t1, t1.objects.admin1).features
    .map((f) => ({ id: f.properties.id, geom: clean(f.geometry) }))
    .filter((p) => p.geom)
    .map((p) => ({ ...p, bounds: geoBounds(p.geom), centroid: geoCentroid(p.geom) }))
  if (!parents.length) return void skipped.push(`${iso3}: no parents`)

  const inBounds = ([[w, s], [e, n]], [x, y]) => y >= s && y <= n && (w <= e ? x >= w && x <= e : x >= w || x <= e)
  const parentOf = (pt) => {
    for (const p of parents) if (inBounds(p.bounds, pt) && geoContains(p.geom, pt)) return p.id
    let best = parents[0], bd = Infinity
    for (const p of parents) {
      const d = geoDistance(p.centroid, pt)
      if (d < bd) { bd = d; best = p }
    }
    return best.id
  }

  const feats = []
  for (const f of packed.geo.features) {
    if (!f.geometry) continue
    const g = clean(f.geometry)
    if (!g) continue
    feats.push({ g, name: String(f.properties.shapeName || f.properties.shapeID || '').trim(), key: f.properties.shapeID || '' })
  }
  if (feats.length < 2 || feats.length <= parents.length) return void skipped.push(`${iso3}: ${feats.length} ADM2 (not finer than ADM1 ${parents.length})`)
  feats.sort((a, b) => a.name.localeCompare(b.name, 'en') || a.key.localeCompare(b.key))

  const counters = new Map()
  const features = feats.map((f) => {
    const pid = parentOf(geoCentroid(f.g)).replace(/\./g, '_')
    const n = (counters.get(pid) ?? 0) + 1
    counters.set(pid, n)
    return { type: 'Feature', geometry: f.g, properties: { id: `${pid}.${n}`, name: f.name || `#${n}` } }
  })

  // simplify relative to the country's size; protect tiny arcs so small units survive
  const span = Math.max(...features.map((f) => spanOf(f.geometry)))
  const q = Math.min(8e5, Math.max(5e4, Math.round(span * 4000)))
  const raw = topology({ admin2: { type: 'FeatureCollection', features } }, q)
  const [x0, y0, x1, y1] = raw.bbox
  const diagDeg = Math.hypot(x1 - x0, y1 - y0)
  // simplify; if that collapses any unit into a sliver, retry with more detail
  let topo
  for (let detail = 1500; ; detail *= 2) {
    const minWeight = ((diagDeg * Math.PI) / 180 / detail) ** 2 / 2
    let t = presimplify(raw, sphericalTriangleArea)
    for (const arc of t.arcs) {
      let ax0 = Infinity, ax1 = -Infinity, ay0 = Infinity, ay1 = -Infinity
      for (const [x, y] of arc) {
        ax0 = Math.min(ax0, x); ax1 = Math.max(ax1, x); ay0 = Math.min(ay0, y); ay1 = Math.max(ay1, y)
      }
      const small = Math.hypot(ax1 - ax0, ay1 - ay0) < diagDeg / 200
      if (small || arc.length <= 10) for (const pt of arc) pt[2] = Infinity
    }
    topo = quantize(simplify(t, minWeight), q)
    const lost = feature(topo, topo.objects.admin2).features.filter((f) => !polygonsOf(f.geometry).some(validAsIs)).length
    if (!lost || detail >= 24000) {
      if (lost) console.log(`  ${iso3}: ${lost} unit(s) still degenerate at detail ${detail}`)
      break
    }
  }

  const json = JSON.stringify(topo)
  fs.writeFileSync(path.join(outDir, `${iso3}.json`), json)
  const en = enLabel(packed.canonical)
  index2[iso3] = { n: features.length, label: { en, ko: koLabel(en) } }
  total += json.length
  console.log(`${iso3} ${features.length} units  ${(json.length / 1024).toFixed(0)} KB  (${en})`)
}

const queue = [...wanted]
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const iso3 = queue.shift()
      try {
        await build(iso3)
      } catch (e) {
        skipped.push(`${iso3}: ${String(e.message || e).slice(0, 100)}`)
      }
    }
  }),
)
const sorted = Object.fromEntries(Object.entries(index2).sort())
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(sorted))
console.log(`\n${Object.keys(sorted).length} countries, +${(total / 1e6).toFixed(1)} MB this run`)
if (skipped.length) console.log('skipped:\n  ' + skipped.join('\n  '))
