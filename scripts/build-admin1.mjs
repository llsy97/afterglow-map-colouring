// Builds one lazily-loaded TopoJSON per country from Natural Earth admin-1 (10m).
//   node scripts/build-admin1.mjs [path/to/ne_10m_admin_1_states_provinces.geojson]
// Output: public/maps/admin1/<ISO3>.json  +  public/maps/admin1/index.json
// South Korea is skipped: it keeps its own, finer KOSTAT 2018 data (see src/maps/registry.ts).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { quantize } from 'topojson-client'
import { topology } from 'topojson-server'
import { presimplify, simplify, sphericalTriangleArea } from 'topojson-simplify'

const require = createRequire(import.meta.url)
const countries = require('i18n-iso-countries')

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public/maps/admin1')
const cacheDir = path.join(root, 'scripts/.cache')
const URL_NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_1_states_provinces.geojson'
const SKIP = new Set(['KOR'])
// Territories that are their own "country" in the app (see build-world.mjs) must not also appear as units of their sovereign state.
const OWN_COUNTRY = {
  FRA: new Set(['Guyane française', 'Martinique', 'Guadeloupe', 'La Réunion', 'Mayotte']),
  NOR: new Set(['Svalbard', 'Jan Mayen', 'Bouvet Island']),
  NLD: new Set(['Bonaire', 'Saba', 'Sint Eustatius']),
}

async function load() {
  const arg = process.argv[2]
  if (arg) return JSON.parse(fs.readFileSync(arg, 'utf8'))
  const file = path.join(cacheDir, 'admin1.geojson')
  if (!fs.existsSync(file)) {
    fs.mkdirSync(cacheDir, { recursive: true })
    console.log('downloading Natural Earth admin-1 …')
    const res = await fetch(URL_NE)
    if (!res.ok) throw new Error(`download failed: ${res.status}`)
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

// d3-geo wants spherical polygons wound clockwise (holes counter-clockwise); Natural Earth is mixed.
// Rings are cut at the antimeridian, so a planar shoelace sum decides the direction reliably.
const ringArea = (r) => {
  let a = 0
  for (let i = 0, n = r.length - 1; i < n; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
  return a / 2
}
function rewindPolygon(rings) {
  return rings.map((r, i) => {
    const cw = ringArea(r) < 0
    return (i === 0 ? cw : !cw) ? r : [...r].reverse()
  })
}
function rewind(g) {
  if (g.type === 'Polygon') return { ...g, coordinates: rewindPolygon(g.coordinates) }
  if (g.type === 'MultiPolygon') return { ...g, coordinates: g.coordinates.map(rewindPolygon) }
  return g
}

function bboxSpan(g) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  const walk = (c) => (typeof c[0] === 'number' ? ((x0 = Math.min(x0, c[0])), (x1 = Math.max(x1, c[0])), (y0 = Math.min(y0, c[1])), (y1 = Math.max(y1, c[1]))) : c.forEach(walk))
  walk(g.coordinates)
  return [x1 - x0, y1 - y0]
}

// ---- level labels, e.g. "States / 주" ----
const KO = {
  State: '주', Province: '주·도', Prefecture: '현', Region: '지방', District: '구·군', County: '군', Department: '데파르트망',
  Governorate: '주', Municipality: '시·군', Parish: '교구', Canton: '주', Division: '도', Emirate: '에미리트', Territory: '준주',
  City: '시', Republic: '공화국', 'Autonomous Community': '자치지방', Voivodeship: '주', Commune: '코뮌', 'Autonomous Region': '자치구',
  'Metropolitan department': '데파르트망', 'Statistical Region': '통계 지역', 'Unitary Authority': '자치단체', Atoll: '환초', Island: '섬',
  'Federal District': '연방구', Oblast: '주', Krai: '변경주', Okrug: '자치구', Voblast: '주', Governorates: '주', Zone: '구역', Emirate_: '에미리트',
}
const KO_OVERRIDE = { JPN: '도도부현', CAN: '주·준주', CHN: '성·자치구', VNM: '성', USA: '주' }
const EN_OVERRIDE = { JPN: 'Prefectures', CAN: 'Provinces & territories', CHN: 'Provinces', USA: 'States' }

function plural(w) {
  if (/y$/.test(w) && !/[aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies'
  if (/(s|sh|ch|x)$/.test(w)) return w + 'es'
  return w + 's'
}

function label(iso3, features) {
  const count = {}
  for (const f of features) {
    const t = (f.properties.type_en || '').split('|')[0].trim()
    if (t) count[t] = (count[t] ?? 0) + 1
  }
  const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0]
  const en = EN_OVERRIDE[iso3] ?? (top ? plural(top) : 'Regions')
  const ko = KO_OVERRIDE[iso3] ?? (top && KO[top]) ?? '행정구역'
  return { ko, en }
}

// ---- main ----
const ne = await load()
const byCountry = new Map()
for (const f of ne.features) {
  const iso3 = countries.alpha2ToAlpha3(String(f.properties.iso_a2 ?? ''))
  if (!iso3 || SKIP.has(iso3) || !f.geometry) continue
  if (OWN_COUNTRY[iso3]?.has(f.properties.name)) continue
  if (!byCountry.has(iso3)) byCountry.set(iso3, [])
  byCountry.get(iso3).push(f)
}

fs.mkdirSync(outDir, { recursive: true })
for (const f of fs.readdirSync(outDir)) fs.unlinkSync(path.join(outDir, f))

const index = {}
let total = 0
for (const [iso3, feats] of [...byCountry].sort()) {
  if (feats.length < 2) continue // admin-1 == the country itself: nothing to show
  const seen = new Set()
  const features = feats.map((f, i) => {
    let code = String(f.properties.adm1_code ?? i).replace(/^[A-Z0-9]{3}-/, '')
    if (seen.has(code)) code = `${code}_${i}`
    seen.add(code)
    const p = f.properties
    return {
      type: 'Feature',
      geometry: rewind(f.geometry),
      properties: { id: code, name: p.name_en || p.name || code, name_ko: p.name_ko || undefined },
    }
  })

  // simplify relative to the country's size so every country looks right at phone width
  // finer quantization for widely scattered countries (Kiribati, USA, Fiji …) so atolls survive
  const span = Math.max(...features.flatMap((f) => bboxSpan(f.geometry)))
  const q = Math.min(1e6, Math.max(1e5, Math.round(span * 5000)))
  let topo = topology({ admin1: { type: 'FeatureCollection', features } }, q)
  const [x0, y0, x1, y1] = topo.bbox
  const diag = (Math.hypot(x1 - x0, y1 - y0) * Math.PI) / 180
  const minWeight = (diag / 1200) ** 2 / 2
  topo = presimplify(topo, sphericalTriangleArea)
  // never simplify short arcs: they are islands and tiny units, and would collapse to slivers
  const countryDiagDeg = Math.hypot(x1 - x0, y1 - y0)
  for (const arc of topo.arcs) {
    // presimplify hands back absolute lon/lat points
    let ax0 = Infinity, ax1 = -Infinity, ay0 = Infinity, ay1 = -Infinity
    for (const [x, y] of arc) {
      ax0 = Math.min(ax0, x); ax1 = Math.max(ax1, x); ay0 = Math.min(ay0, y); ay1 = Math.max(ay1, y)
    }
    const small = Math.hypot(ax1 - ax0, ay1 - ay0) < countryDiagDeg / 40
    if (small || arc.length <= 24) for (const pt of arc) pt[2] = Infinity
  }
  topo = quantize(simplify(topo, minWeight), q) // back to compact delta-encoded integers

  const json = JSON.stringify(topo)
  fs.writeFileSync(path.join(outDir, `${iso3}.json`), json)
  index[iso3] = { n: features.length, label: label(iso3, feats) }
  total += json.length
}
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(index))
console.log(`${Object.keys(index).length} countries, ${(total / 1e6).toFixed(1)} MB`)
