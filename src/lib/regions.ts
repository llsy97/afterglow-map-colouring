import { getCountryMap } from '../maps/registry'
import type { Level, Region, RegionId, Trip } from '../types'

export function splitId(id: RegionId): { iso3: string; code?: string } {
  const i = id.indexOf(':')
  return i < 0 ? { iso3: id } : { iso3: id.slice(0, i), code: id.slice(i + 1) }
}

export function isCountry(id: RegionId) {
  return !id.includes(':')
}

/** Parent chain, nearest first: 'KOR:11010' -> ['KOR:11', 'KOR'] */
export function ancestorsOf(id: RegionId): RegionId[] {
  const { iso3, code } = splitId(id)
  if (code === undefined) return []
  const cfg = getCountryMap(iso3)
  const out: RegionId[] = []
  let cur: string | undefined = cfg?.parentOf?.(code)
  while (cur !== undefined) {
    out.push(`${iso3}:${cur}`)
    cur = cfg?.parentOf?.(cur)
  }
  out.push(iso3)
  return out
}

export function parentOf(id: RegionId): RegionId | undefined {
  return ancestorsOf(id)[0]
}

/** true when `id` is `ancestor` itself or lies below it. */
export function isWithin(id: RegionId, ancestor: RegionId) {
  return id === ancestor || ancestorsOf(id).includes(ancestor)
}

export function tripsIn(id: RegionId, trips: Trip[]): Trip[] {
  return trips.filter((t) => isWithin(t.regionId, id))
}

export function sortTripsNewestFirst(trips: Trip[]): Trip[] {
  return [...trips].sort((a, b) => b.startDate.localeCompare(a.startDate) || b.createdAt - a.createdAt)
}

/**
 * Displayed level of every region that has any record.
 *   own = max(quick level, level of the region's own trips)
 *   a recorded sub-region lights each ancestor to at least 1 (never above the children's best)
 */
export function computeLevels(regions: Record<RegionId, Region>, trips: Trip[]): Record<RegionId, Level> {
  const own: Record<RegionId, number> = {}
  for (const r of Object.values(regions)) if (r.quickLevel > 0) own[r.id] = r.quickLevel
  for (const t of trips) own[t.regionId] = Math.max(own[t.regionId] ?? 0, t.level)

  const out: Record<RegionId, number> = { ...own }
  for (const id of Object.keys(own)) {
    for (const a of ancestorsOf(id)) out[a] = Math.max(out[a] ?? 0, 1)
  }
  return out as Record<RegionId, Level>
}

/** Cover photos for cards: chosen covers, otherwise photos of the most recent trip that has any. */
export function regionPhotoIds(id: RegionId, regions: Record<RegionId, Region>, trips: Trip[]): string[] {
  const cover = regions[id]?.coverPhotoIds
  if (cover?.length) return cover.slice(0, 3)
  for (const t of sortTripsNewestFirst(tripsIn(id, trips))) {
    if (t.photos.length) return t.photos.slice(0, 3).map((p) => p.id)
  }
  return []
}
