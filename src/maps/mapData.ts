import { useEffect, useState } from 'react'
import { geoArea, geoEquirectangular, geoPath } from 'd3-geo'
import type { GeoProjection } from 'd3-geo'
import { countryNameOf } from '../lib/countryNames'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry } from 'geojson'
import type { Topology } from 'topojson-specification'
import type { Locale, RegionId } from '../types'
import { dotPath, makeLayout } from './layout'
import type { Frame, Layout } from './layout'
import type { CountryMapConfig, MapLevel } from './registry'

export const MAP_W = 390
export const MAP_H = 420
export const MAP_PAD = 14

export type { Frame }
export type ShapeSet = { shapes: RegionShape[]; frames: Frame[] }

export type RegionShape = {
  id: RegionId
  names: { ko?: string; en: string }
  /** pre-computed SVG path string (computed once per level + size) */
  d: string
  /** projected area in px², used to draw small islands on top */
  area: number
}

type Props = Record<string, string | undefined>
type FC = FeatureCollection<Geometry, Props>

// ---------- loading ----------
const cache = new Map<string, Promise<FC>>()

export function loadLevel(level: MapLevel): Promise<FC> {
  let p = cache.get(level.url)
  if (!p) {
    p = fetch(level.url)
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} ${level.url}`)
        return r.json() as Promise<Topology>
      })
      .then((topo) => feature(topo, topo.objects[level.object]) as unknown as FC)
    p.catch(() => cache.delete(level.url)) // allow retry
    cache.set(level.url, p)
  }
  return p
}

type WorldCountry = Feature<Geometry, Props> & { iso3: string }
let worldPromise: Promise<WorldCountry[]> | undefined

function toCountries(topo: Topology, object: string): WorldCountry[] {
  const fc = feature(topo, topo.objects[object]) as unknown as FC
  return fc.features.map((f) => Object.assign(f, { iso3: String(f.properties?.iso3) }))
}

/** All countries and territories (Natural Earth map units, see scripts/build-world.mjs), coarse outlines. */
export function loadWorld(): Promise<WorldCountry[]> {
  if (!worldPromise) {
    worldPromise = fetch('/maps/world.json')
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} world.json`)
        return r.json() as Promise<Topology>
      })
      .then((topo) => toCountries(topo, 'countries'))
    worldPromise.catch(() => (worldPromise = undefined))
  }
  return worldPromise
}

/** A single country's outline: the finer per-country file when there is one, else the coarse world outline. */
async function loadOutline(iso3: string): Promise<WorldCountry[]> {
  try {
    const res = await fetch(`/maps/country/${iso3}.json`)
    if (res.ok) {
      const found = toCountries((await res.json()) as Topology, 'country')
      if (found.length) return found.map((f) => Object.assign(f, { iso3 }))
    }
  } catch {
    /* fall through to the world outline */
  }
  return (await loadWorld()).filter((f) => f.iso3 === iso3)
}

// ---------- projection ----------
function codeOf(level: MapLevel, f: Feature<Geometry, Props>) {
  return f.properties?.[level.idProp] ?? String(f.id)
}

function describeLevel(cfg: CountryMapConfig, level: MapLevel) {
  return (f: Feature<Geometry, Props>) => {
    const code = codeOf(level, f)
    return {
      id: `${cfg.iso3}:${code}`,
      names: {
        ko: level.nameProps.ko ? f.properties?.[level.nameProps.ko] : undefined,
        en: f.properties?.[level.nameProps.en] ?? code,
      },
    }
  }
}

/** Sorted: large regions first, tiny islands last so they stay on top and tappable. */
function toShapes<F extends Feature<Geometry, Props>>(
  features: F[],
  projected: { d: string; area: number }[],
  describe: (f: F) => { id: RegionId; names: RegionShape['names'] },
): RegionShape[] {
  return features
    .map((f, i) => ({ ...describe(f), d: projected[i].d, area: projected[i].area }))
    .filter((s) => s.d)
    .sort((a, b) => b.area - a.area)
}

const layouts = new Map<string, Layout>()
function layoutFor(key: string, make: () => Layout): Layout {
  let l = layouts.get(key)
  if (!l) {
    l = make()
    layouts.set(key, l)
  }
  return l
}

export type LevelOpts = {
  w?: number
  h?: number
  /** only regions below this region code (at any depth), framed to fit them */
  parentCode?: string
}

export async function buildLevelShapes(cfg: CountryMapConfig, levelIndex: number, opts: LevelOpts = {}): Promise<ShapeSet> {
  const { w = MAP_W, h = MAP_H, parentCode } = opts
  const level = cfg.levels[levelIndex]
  const [fc, frame] = await Promise.all([loadLevel(level), loadLevel(cfg.levels[0])])
  const describe = describeLevel(cfg, level)

  if (parentCode !== undefined) {
    const below = (code: string) => {
      for (let c = cfg.parentOf?.(code); c !== undefined; c = cfg.parentOf?.(c)) if (c === parentCode) return true
      return false
    }
    const sub = fc.features.filter((f) => below(codeOf(level, f)))
    const layout = layoutFor(`${cfg.iso3}:${levelIndex}:${parentCode}:${w}x${h}`, () => makeLayout(sub, w, h))
    return { shapes: toShapes(sub, layout.project(sub), describe), frames: layout.frames }
  }
  // levels[0] frames the whole country so every level lines up with it
  const layout = layoutFor(`${cfg.iso3}:all:${w}x${h}`, () => makeLayout(frame.features, w, h))
  return { shapes: toShapes(fc.features, layout.project(fc.features), describe), frames: layout.frames }
}

let statesPromise: Promise<FC> | undefined
/** Every first-level region on Earth (scripts/build-world-states.mjs): states, provinces, prefectures … */
function loadWorldStates(): Promise<FC> {
  if (!statesPromise) {
    statesPromise = fetch('/maps/world-states.json')
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status} world-states.json`)
        return r.json() as Promise<Topology>
      })
      .then((topo) => feature(topo, topo.objects.states) as unknown as FC)
    statesPromise.catch(() => (statesPromise = undefined))
  }
  return statesPromise
}

export const WORLD_W = 390
export const WORLD_H = 176

export async function buildWorldShapes(w = WORLD_W, h = WORLD_H): Promise<ShapeSet> {
  const world = await loadWorld()
  // flat, rectangular world map (plate carrée): no curved edges, east/west stay where you expect them
  const projection: GeoProjection = geoEquirectangular().fitSize([w - 8, h - 8], { type: 'FeatureCollection', features: world })
  const path = geoPath(projection).digits(1)
  const shapes = toShapes(
    world,
    world.map((f) => {
      // micro-states and islands (Monaco, Réunion, Singapore …) would be invisible at this scale: draw a dot
      const [[x0, y0], [x1, y1]] = path.bounds(f)
      if (x1 - x0 < 2.5 && y1 - y0 < 2.5 && Number.isFinite(x0)) return { d: dotPath((x0 + x1) / 2, (y0 + y1) / 2), area: 7 }
      return { d: path(f) ?? '', area: path.area(f) }
    }),
    (f) => ({
      id: f.iso3,
      names: { ko: countryNameOf(f.iso3, 'ko'), en: countryNameOf(f.iso3, 'en') ?? f.iso3 },
    }),
  )
  return { shapes, frames: [] }
}

/** All first-level regions on the same flat world frame as buildWorldShapes. */
export async function buildWorldStatesShapes(w = WORLD_W, h = WORLD_H): Promise<ShapeSet> {
  const [world, fc] = await Promise.all([loadWorld(), loadWorldStates()])
  const projection: GeoProjection = geoEquirectangular().fitSize([w - 8, h - 8], { type: 'FeatureCollection', features: world })
  const path = geoPath(projection).digits(1)
  const shapes: RegionShape[] = []
  for (const f of fc.features) {
    const id = String(f.properties?.id)
    // polygons stored as slivers would be filled as "the whole sphere": leave them out
    const polys = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : []).filter(
      (c) => {
        const a = geoArea({ type: 'Polygon', coordinates: c })
        return a > 0 && a <= 2 && c[0].length >= 4
      },
    )
    if (!polys.length) continue
    const geom = { type: 'MultiPolygon' as const, coordinates: polys }
    const d = path(geom)
    if (!d) continue
    const { iso3, code } = id.includes(':') ? { iso3: id.slice(0, id.indexOf(':')), code: id.slice(id.indexOf(':') + 1) } : { iso3: id, code: undefined }
    shapes.push({
      id,
      names:
        code === undefined
          ? { ko: countryNameOf(iso3, 'ko'), en: countryNameOf(iso3, 'en') ?? iso3 }
          : { ko: f.properties?.name_ko, en: f.properties?.name ?? code },
      d,
      area: path.area(geom),
    })
  }
  return { shapes: shapes.sort((a, b) => b.area - a.area), frames: [] }
}

/** One country, large, on its own (used when there is no detailed map). Date line safe, overseas parts as insets. */
export async function buildCountryShape(iso3: string, w = MAP_W, h = MAP_H): Promise<ShapeSet> {
  const one = await loadOutline(iso3)
  if (!one.length) return { shapes: [], frames: [] }
  const layout = layoutFor(`world:${iso3}:${w}x${h}`, () => makeLayout(one, w, h))
  const shapes = toShapes(one, layout.project(one), (f) => ({
    id: f.iso3,
    names: { ko: countryNameOf(f.iso3, 'ko'), en: countryNameOf(f.iso3, 'en') ?? f.iso3 },
  }))
  return { shapes, frames: layout.frames }
}

/** Tiny silhouettes for country lists: main landmass only, rotated so the date line cannot split it. */
export async function buildSilhouettes(size = 44): Promise<Record<string, string>> {
  const world = await loadWorld()
  const out: Record<string, string> = {}
  for (const f of world) {
    const one = [f]
    const layout = makeLayout(one, size, size, { pad: 2, mainOnly: true })
    out[f.iso3] = layout.project(one)[0].d
  }
  return out
}

export function regionName(names: RegionShape['names'], locale: Locale): string {
  return (locale === 'ko' ? names.ko : names.en) ?? names.en
}

// ---------- hooks ----------
export type ShapesState =
  | { status: 'loading' }
  | { status: 'error' }
  | ({ status: 'ready' } & ShapeSet)

function useShapes(key: string, produce: (() => Promise<ShapeSet>) | undefined, attempt: number): ShapesState {
  const [state, setState] = useState<ShapesState>({ status: 'loading' })
  useEffect(() => {
    if (!produce) return
    let alive = true
    setState({ status: 'loading' })
    produce()
      .then((set) => alive && setState({ status: 'ready', ...set }))
      .catch(() => alive && setState({ status: 'error' }))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])
  return state
}

export function useLevelShapes(cfg: CountryMapConfig | undefined, levelIndex: number, opts: LevelOpts = {}, attempt = 0) {
  const key = `${cfg?.iso3}:${levelIndex}:${opts.parentCode}:${opts.w}:${opts.h}`
  return useShapes(key, cfg ? () => buildLevelShapes(cfg, levelIndex, opts) : undefined, attempt)
}

/** Region codes + names of one level (no geometry work), e.g. for the "narrow to a province" picker or counting. */
export function useLevelList(cfg: CountryMapConfig | undefined, levelIndex: number) {
  const [list, setList] = useState<{ code: string; id: RegionId; names: RegionShape['names'] }[]>([])
  useEffect(() => {
    setList([])
    if (!cfg || !cfg.levels[levelIndex]) return
    const level = cfg.levels[levelIndex]
    let alive = true
    loadLevel(level)
      .then((fc) => {
        if (!alive) return
        const describe = describeLevel(cfg, level)
        setList(
          fc.features
            .map((f) => ({ code: codeOf(level, f), ...describe(f) }))
            .sort((a, b) => (a.names.ko ?? a.names.en).localeCompare(b.names.ko ?? b.names.en)),
        )
      })
      .catch(() => undefined)
    return () => {
      alive = false
    }
  }, [cfg, levelIndex])
  return list
}

export type RegionItem = { code: string; id: RegionId; names: RegionShape['names'] }

/** The regions directly below `parentCode` (or the top level when undefined), for list pickers. */
export function useChildren(cfg: CountryMapConfig | undefined, levelIndex: number, parentCode?: string) {
  const [state, setState] = useState<{ loading: boolean; list: RegionItem[] }>({ loading: true, list: [] })
  useEffect(() => {
    const level = cfg?.levels[levelIndex]
    if (!cfg || !level) {
      setState({ loading: false, list: [] })
      return
    }
    let alive = true
    setState({ loading: true, list: [] })
    loadLevel(level)
      .then((fc) => {
        if (!alive) return
        const describe = describeLevel(cfg, level)
        const list = fc.features
          .map((f) => ({ code: codeOf(level, f), ...describe(f) }))
          .filter((r) => cfg.parentOf?.(r.code) === parentCode)
          .sort((a, b) => (a.names.ko ?? a.names.en).localeCompare(b.names.ko ?? b.names.en, 'ko'))
        setState({ loading: false, list })
      })
      .catch(() => alive && setState({ loading: false, list: [] }))
    return () => {
      alive = false
    }
  }, [cfg, levelIndex, parentCode])
  return state
}

export function useWorldShapes(attempt = 0) {
  return useShapes('world', () => buildWorldShapes(), attempt)
}

export function useWorldStates(enabled: boolean, attempt = 0) {
  return useShapes(enabled ? 'world-states' : 'world-states:off', enabled ? () => buildWorldStatesShapes() : undefined, attempt)
}

export function useCountryShape(iso3: string | undefined, w = MAP_W, h = MAP_H, attempt = 0) {
  return useShapes(`country:${iso3}:${w}:${h}`, iso3 ? () => buildCountryShape(iso3, w, h) : undefined, attempt)
}
