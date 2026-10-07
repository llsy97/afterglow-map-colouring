// Builds ONE file with every first-level region on Earth (states, provinces, prefectures …) for the World tab's
// "states / provinces" view.
//   node scripts/build-world-states.mjs        (run after build-admin1 and build-world)
// Output: public/maps/world-states.json   (TopoJSON object "states"; property id = RegionId, optional name / name_ko)
//
// - countries that have an admin-1 map contribute their units  (id "JPN:1234")
// - South Korea contributes its 17 KOSTAT provinces            (id "KOR:11")
// - countries without admin-1 (small territories) contribute the whole country (id "HKG"-style ISO3)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { geoArea } from 'd3-geo'
import { feature, quantize } from 'topojson-client'
import { topology } from 'topojson-server'
import { presimplify, simplify, sphericalTriangleArea } from 'topojson-simplify'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const maps = path.join(root, 'public/maps')
const read = (p) => JSON.parse(fs.readFileSync(path.join(maps, p), 'utf8'))

const polysOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [])
const valid = (c) => {
  const a = geoArea({ type: 'Polygon', coordinates: c })
  return a > 0 && a <= 2 && c[0].length >= 4
}

const features = []
const index1 = read('admin1/index.json')
for (const iso3 of Object.keys(index1)) {
  const t = read(`admin1/${iso3}.json`)
  for (const f of feature(t, t.objects.admin1).features) {
    features.push({
      type: 'Feature',
      geometry: f.geometry,
      properties: { id: `${iso3}:${f.properties.id}`, name: f.properties.name, ...(f.properties.name_ko ? { name_ko: f.properties.name_ko } : {}) },
    })
  }
}
{
  const t = read('kor/skorea-provinces-2018-topo-simple.json')
  for (const f of feature(t, t.objects.skorea_provinces_2018_geo).features) {
    features.push({
      type: 'Feature',
      geometry: f.geometry,
      properties: { id: `KOR:${f.properties.code}`, name: f.properties.name_eng, name_ko: f.properties.name },
    })
  }
}
const world = read('world.json')
for (const f of feature(world, world.objects.countries).features) {
  const iso3 = f.properties.iso3
  if (iso3 === 'KOR' || index1[iso3]) continue
  features.push({ type: 'Feature', geometry: f.geometry, properties: { id: iso3 } })
}

// keep only polygons d3 can fill correctly
let dropped = 0
const clean = features
  .map((f) => {
    const polys = polysOf(f.geometry).filter((c) => (valid(c) ? true : (dropped++, false)))
    return polys.length ? { ...f, geometry: { type: 'MultiPolygon', coordinates: polys } } : null
  })
  .filter(Boolean)

const q = 5e5
const raw = topology({ states: { type: 'FeatureCollection', features: clean } }, q)
const pre = presimplify(raw, sphericalTriangleArea)
const minWeight = ((2 * Math.PI) / 1500) ** 2 / 2 // ~0.25° detail: plenty for a 390px-wide world, zoomable to ~10x
const small = pre.arcs.map((arc) => {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const [x, y] of arc) {
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
  }
  return Math.hypot(x1 - x0, y1 - y0) < 0.35 || arc.length <= 10 // islands & tiny units stay whole
})
const arcsOf = (a, out = []) => (Array.isArray(a) ? (a.forEach((x) => arcsOf(x, out)), out) : (out.push(a < 0 ? ~a : a), out))

let topo
const protect = new Set()
for (let round = 0; round < 6; round++) {
  const t = {
    ...pre,
    arcs: pre.arcs.map((arc, i) => arc.map((pt) => [pt[0], pt[1], small[i] || protect.has(i) ? Infinity : pt[2]])),
  }
  topo = quantize(simplify(t, minWeight), q)
  // regions the simplification collapsed into slivers keep all their points on the next round
  const bad = topo.objects.states.geometries.filter((g) => {
    const f = feature(topo, g)
    return !polysOf(f.geometry).some(valid)
  })
  if (!bad.length) break
  for (const g of bad) for (const i of arcsOf(g.arcs)) protect.add(i)
  console.log(`  round ${round + 1}: ${bad.length} collapsed regions → protecting ${protect.size} arcs`)
}

const out = path.join(maps, 'world-states.json')
const json = JSON.stringify(topo)
fs.writeFileSync(out, json)

// every unit must still have a drawable polygon
const lost = feature(topo, topo.objects.states).features.filter((f) => !polysOf(f.geometry).some(valid))
console.log(`world-states.json  ${clean.length} regions  ${(json.length / 1e6).toFixed(2)} MB  (dropped ${dropped} bad polygons, ${lost.length} regions degenerate)`)
if (lost.length) console.log('  degenerate:', lost.slice(0, 20).map((f) => f.properties.id).join(' '))
