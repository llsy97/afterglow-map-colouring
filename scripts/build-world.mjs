// Builds the country layer: every country AND territory (Hong Kong, Macao, Taiwan, Réunion, Guadeloupe, Puerto Rico, Guam …).
//   node scripts/build-world.mjs [path/to/ne_10m_admin_0_map_units.geojson]
// Output:
//   public/maps/world.json            coarse outlines of all ~248 countries, for the World tab + country list
//   public/maps/country/<ISO3>.json   finer outline per country that has no admin-1 map (single-country view)
//
// Source: Natural Earth 10m admin-0 *map units* (public domain). Map units are used instead of "countries" because they
// split overseas departments (Réunion, Guadeloupe, Martinique, Mayotte, French Guiana) and Svalbard / Caribbean Netherlands
// out of their sovereign states. Disputed or tiny "indeterminate" areas are merged into the country that administers them,
// or dropped when they are not part of any country.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { geoArea } from 'd3-geo'
import { quantize } from 'topojson-client'
import { topology } from 'topojson-server'
import { presimplify, simplify, sphericalTriangleArea } from 'topojson-simplify'

const require = createRequire(import.meta.url)
const countries = require('i18n-iso-countries')
const ALL = new Set(Object.keys(countries.getAlpha3Codes()))

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mapsDir = path.join(root, 'public/maps')
const cacheDir = path.join(root, 'scripts/.cache')
const URL_NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_admin_0_map_units.geojson'

async function load() {
  const arg = process.argv[2]
  if (arg) return JSON.parse(fs.readFileSync(arg, 'utf8'))
  const file = path.join(cacheDir, 'admin0_map_units.geojson')
  if (!fs.existsSync(file)) {
    fs.mkdirSync(cacheDir, { recursive: true })
    console.log('downloading Natural Earth map units …')
    const res = await fetch(URL_NE)
    if (!res.ok) throw new Error(`download failed: ${res.status}`)
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()))
  }
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

// map unit (GU_A3) → country it belongs to
const MERGE = {
  FXX: 'FRA', CLP: 'FRA', ENG: 'GBR', SCT: 'GBR', WLS: 'GBR', NIR: 'GBR', NLX: 'NLD', NLY: 'BES',
  PRX: 'PRT', PMD: 'PRT', PAZ: 'PRT', NOW: 'NOR', NJM: 'SJM', NSV: 'SJM',
  SOL: 'SOM', SOP: 'SOM', SOX: 'SOM', CYN: 'CYP', CNM: 'CYP', ESB: 'CYP', WSB: 'CYP', KOS: 'XKK', USG: 'CUB',
  KNX: 'KOR', KNZ: 'PRK', GAZ: 'PSE', WEB: 'PSE',
  JQI: 'UMI', DQI: 'UMI', FQI: 'UMI', HQI: 'UMI', WQI: 'UMI', MQI: 'UMI', BQI: 'UMI', LQI: 'UMI', KQI: 'UMI',
}
const DROP = new Set(['KAS', 'SPI', 'BRT', 'PGA', 'PFA', 'BJN', 'SER', 'SCR', 'ATA'])

// ---------- geometry ----------
const ringArea = (r) => {
  let a = 0
  for (let i = 0, n = r.length - 1; i < n; i++) a += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]
  return a / 2
}
const rewindPoly = (rings) => rings.map((r, i) => ((ringArea(r) < 0) === (i === 0) ? r : [...r].reverse()))
const polygonsOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [])
const validPoly = (c) => {
  const a = geoArea({ type: 'Polygon', coordinates: c })
  return a > 0 && a <= 2 && c[0].length >= 4
}
function bboxDiagDeg(polys) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const p of polys) for (const [x, y] of p[0]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y) }
  return { span: Math.max(x1 - x0, y1 - y0), diag: Math.hypot(x1 - x0, y1 - y0) }
}

/** simplify a TopoJSON in place-ish: weight threshold relative to `diagDeg`, tiny arcs (islands) kept intact */
function simplifyTopo(topo, diagDeg, detail, q, protectDeg = diagDeg / 40) {
  const minWeight = ((diagDeg * Math.PI) / 180 / detail) ** 2 / 2
  let t = presimplify(topo, sphericalTriangleArea)
  for (const arc of t.arcs) {
    let ax0 = Infinity, ax1 = -Infinity, ay0 = Infinity, ay1 = -Infinity
    for (const [x, y] of arc) { ax0 = Math.min(ax0, x); ax1 = Math.max(ax1, x); ay0 = Math.min(ay0, y); ay1 = Math.max(ay1, y) }
    const small = Math.hypot(ax1 - ax0, ay1 - ay0) < protectDeg
    if (small || arc.length <= 24) for (const pt of arc) pt[2] = Infinity
  }
  return quantize(simplify(t, minWeight), q)
}

// ---------- main ----------
const ne = await load()
const groups = new Map() // iso3 → polygons[]
const unmapped = []
for (const f of ne.features) {
  const p = f.properties
  const gu = p.GU_A3
  if (DROP.has(gu) || DROP.has(p.ADM0_A3) || !f.geometry) continue
  let iso = MERGE[gu]
  if (!iso) iso = p.ISO_A3_EH !== '-99' && ALL.has(p.ISO_A3_EH) ? p.ISO_A3_EH : ALL.has(gu) ? gu : undefined
  if (!iso) { unmapped.push(`${gu}|${p.NAME}`); continue }
  const polys = polygonsOf(f.geometry).map(rewindPoly).filter(validPoly)
  if (!polys.length) continue
  if (!groups.has(iso)) groups.set(iso, [])
  groups.get(iso).push(...polys)
}
if (unmapped.length) console.log('unmapped (dropped):', unmapped.join('; '))

const features = [...groups.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([iso3, polys]) => ({
    type: 'Feature',
    properties: { iso3 },
    geometry: { type: 'MultiPolygon', coordinates: polys },
  }))

// 1) coarse world: ~0.3° detail, every island kept
fs.mkdirSync(path.join(mapsDir, 'country'), { recursive: true })
{
  let t = topology({ countries: { type: 'FeatureCollection', features } }, 2e5)
  t = simplifyTopo(t, 360, 700, 2e5, 1.2)
  const json = JSON.stringify(t)
  fs.writeFileSync(path.join(mapsDir, 'world.json'), json)
  console.log(`world.json  ${features.length} countries  ${(json.length / 1024).toFixed(0)} KB`)
}

// 2) finer single-country outlines for countries without an admin-1 map
let index1 = {}
try { index1 = JSON.parse(fs.readFileSync(path.join(mapsDir, 'admin1/index.json'), 'utf8')) } catch { /* build-admin1 first for a smaller output */ }
for (const f of fs.readdirSync(path.join(mapsDir, 'country'))) fs.unlinkSync(path.join(mapsDir, 'country', f))
let total = 0, n = 0
for (const feat of features) {
  const iso3 = feat.properties.iso3
  if (iso3 === 'KOR' || index1[iso3]) continue
  const { span, diag } = bboxDiagDeg(feat.geometry.coordinates)
  const q = Math.min(1e6, Math.max(1e5, Math.round(span * 6000)))
  let t = topology({ country: { type: 'FeatureCollection', features: [feat] } }, q)
  t = simplifyTopo(t, diag, 1500, q)
  const json = JSON.stringify(t)
  fs.writeFileSync(path.join(mapsDir, 'country', `${iso3}.json`), json)
  total += json.length
  n++
}
console.log(`country/*.json  ${n} files  ${(total / 1024).toFixed(0)} KB`)
