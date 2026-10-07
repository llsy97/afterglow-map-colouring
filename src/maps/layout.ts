import { geoArea, geoCentroid, geoMercator, geoPath } from 'd3-geo'
import type { GeoProjection } from 'd3-geo'
import type { Feature, Geometry, MultiPolygon, Position } from 'geojson'

/**
 * Lays a set of features out like a real atlas page:
 *  - the main landmass is projected with Mercator, rotated to its own longitude so the
 *    date line never stretches it (Russia, Fiji, Alaska, NZ …);
 *  - far-flung pieces (Hawaii, Alaska, French overseas departments, Canary Islands …)
 *    become small framed insets along the bottom, so nothing is dropped and the
 *    mainland keeps the room it needs.
 */

const R_KM = 6371
const LINK_KM = 750 // parts closer than this belong to the same landmass cluster
const MAX_INSETS = 8
const RAD = Math.PI / 180

type Vec = [number, number, number]
type Part = {
  fi: number
  coords: Position[][]
  vec: Vec
  rad: number // angular radius of the part around its centroid
  area: number
  pts: Vec[]
}

const DOT_BELOW = 2.5 // px: smaller islands become dots
const DOT_R = 1.5
export function dotPath(cx: number, cy: number, r = DOT_R): string {
  const f = (n: number) => Math.round(n * 10) / 10
  return `M${f(cx - r)},${f(cy)}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0`
}

export type Frame = { x: number; y: number; w: number; h: number }
export type Projected = { d: string; area: number }

const toVec = (lon: number, lat: number): Vec => {
  const l = lon * RAD
  const p = lat * RAD
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)]
}
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const ang = (a: Vec, b: Vec) => Math.acos(Math.min(1, Math.max(-1, dot(a, b))))

function explode(features: Feature<Geometry, unknown>[]): Part[] {
  const parts: Part[] = []
  features.forEach((f, fi) => {
    const g = f.geometry
    const polys: Position[][][] = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []
    for (const coords of polys) {
      const poly = { type: 'Polygon' as const, coordinates: coords }
      // simplification can leave zero-width slivers that d3 reads as "the whole sphere"; skip those
      const area = geoArea(poly)
      if (!(area > 0) || area > 2 || coords[0].length < 4) continue
      const c = geoCentroid(poly)
      const vec = toVec(c[0], c[1])
      const ring = coords[0]
      const step = Math.max(1, Math.floor(ring.length / 16))
      const pts: Vec[] = []
      for (let i = 0; i < ring.length; i += step) pts.push(toVec(ring[i][0], ring[i][1]))
      let rad = 0
      for (const p of pts) rad = Math.max(rad, ang(vec, p))
      parts.push({ fi, coords, vec, rad, area, pts })
    }
  })
  return parts
}

function near(a: Part, b: Part): boolean {
  const limit = LINK_KM / R_KM
  if (ang(a.vec, b.vec) > a.rad + b.rad + limit) return false
  const cosLimit = Math.cos(limit)
  for (const p of a.pts) for (const q of b.pts) if (dot(p, q) > cosLimit) return true
  return false
}

type Cluster = { parts: Part[]; area: number; vec: Vec }

function cluster(parts: Part[]): Cluster[] {
  const parent = parts.map((_, i) => i)
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])))
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      if (find(i) !== find(j) && near(parts[i], parts[j])) parent[find(i)] = find(j)
    }
  }
  const groups = new Map<number, Part[]>()
  parts.forEach((p, i) => {
    const k = find(i)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(p)
  })
  const out: Cluster[] = [...groups.values()].map((ps) => {
    let area = 0
    const v: Vec = [0, 0, 0]
    for (const p of ps) {
      area += p.area
      v[0] += p.vec[0] * p.area
      v[1] += p.vec[1] * p.area
      v[2] += p.vec[2] * p.area
    }
    const len = Math.hypot(...v) || 1
    return { parts: ps, area, vec: [v[0] / len, v[1] / len, v[2] / len] as Vec }
  })
  out.sort((a, b) => b.area - a.area)
  // too many remote specks: fold the extras into the nearest cluster we keep
  const keep = out.slice(0, 1 + MAX_INSETS)
  for (const extra of out.slice(1 + MAX_INSETS)) {
    let best = keep[0]
    for (const k of keep) if (dot(k.vec, extra.vec) > dot(best.vec, extra.vec)) best = k
    best.parts.push(...extra.parts)
    best.area += extra.area
  }
  return keep
}

const multi = (parts: Part[]): MultiPolygon => ({ type: 'MultiPolygon', coordinates: parts.map((p) => p.coords) })

function mercatorFor(parts: Part[], x0: number, y0: number, x1: number, y1: number): GeoProjection {
  const shape = multi(parts)
  const [lon] = geoCentroid(shape)
  return geoMercator().rotate([-lon, 0]).fitExtent(
    [
      [x0, y0],
      [x1, y1],
    ],
    shape,
  )
}

export type Layout = {
  frames: Frame[]
  /** Projects features (the layout's own, or finer ones covering the same area) to path strings. */
  project: (features: Feature<Geometry, unknown>[]) => Projected[]
}

export function makeLayout(
  features: Feature<Geometry, unknown>[],
  w: number,
  h: number,
  opts: { pad?: number; mainOnly?: boolean } = {},
): Layout {
  const pad = opts.pad ?? 14
  const parts = explode(features)
  const clusters = parts.length ? cluster(parts) : []
  const insets = opts.mainOnly ? [] : clusters.slice(1)

  // inset boxes along the bottom edge
  const n = insets.length
  const perRow = n > 5 ? Math.ceil(n / 2) : Math.max(n, 1)
  const gap = 8
  const box = Math.max(28, Math.min(80, w * 0.2, h * 0.26, (w - pad * 2 - gap * (perRow - 1)) / perRow))
  const rows = n ? Math.ceil(n / perRow) : 0
  const reserve = rows ? rows * (box + gap) : 0
  const frames: Frame[] = insets.map((_, i) => ({
    x: pad + (i % perRow) * (box + gap),
    y: h - pad - (rows - Math.floor(i / perRow)) * box - (rows - Math.floor(i / perRow) - 1) * gap,
    w: box,
    h: box,
  }))

  const projections: GeoProjection[] = []
  if (clusters.length) {
    projections.push(mercatorFor(clusters[0].parts, pad, pad, w - pad, h - pad - reserve))
    insets.forEach((c, i) => {
      const f = frames[i]
      projections.push(mercatorFor(c.parts, f.x + 4, f.y + 4, f.x + f.w - 4, f.y + f.h - 4))
    })
  }
  const paths = projections.map((p) => geoPath(p).digits(1))

  // which cluster each of the layout's own parts landed in
  const owner = new Map<Part, number>()
  clusters.slice(0, 1 + insets.length).forEach((c, ci) => c.parts.forEach((p) => owner.set(p, ci)))

  const project = (fs: Feature<Geometry, unknown>[]): Projected[] => {
    const own = fs === features
    const myParts = own ? parts : explode(fs)
    const byFeature: Projected[] = fs.map(() => ({ d: '', area: 0 }))
    const buckets = new Map<string, Part[]>() // `${feature}:${cluster}`
    for (const p of myParts) {
      let ci = owner.get(p)
      if (ci === undefined) {
        // finer features: follow the nearest part of the coarse layout
        let best = Infinity
        for (const q of parts) {
          const a = ang(p.vec, q.vec)
          if (a < best) {
            best = a
            ci = owner.get(q)
          }
        }
      }
      if (ci === undefined || ci >= paths.length) continue
      if (opts.mainOnly && ci !== 0) continue
      const key = `${p.fi}:${ci}`
      if (!buckets.has(key)) buckets.set(key, [])
      buckets.get(key)!.push(p)
    }
    for (const [key, ps] of buckets) {
      const [fi, ci] = key.split(':').map(Number)
      const path = paths[ci]
      // islets that would vanish (Dokdo!) are drawn as a small dot at their true position
      const big: Part[] = []
      const dots: [number, number][] = []
      for (const p of ps) {
        const [[x0, y0], [x1, y1]] = path.bounds({ type: 'Polygon', coordinates: p.coords })
        if (x1 - x0 < DOT_BELOW && y1 - y0 < DOT_BELOW && Number.isFinite(x0)) dots.push([(x0 + x1) / 2, (y0 + y1) / 2])
        else big.push(p)
      }
      if (!big.length) {
        // the whole region is tiny: keep its real shape
        const geom = multi(ps)
        byFeature[fi].d += path(geom) ?? ''
        byFeature[fi].area += path.area(geom)
        continue
      }
      const geom = multi(big)
      byFeature[fi].d += (path(geom) ?? '') + dots.map(([x, y]) => dotPath(x, y)).join('')
      byFeature[fi].area += path.area(geom) + dots.length * Math.PI * DOT_R * DOT_R
    }
    return byFeature
  }

  return { frames, project }
}
