import { useCallback, useEffect, useSyncExternalStore } from 'react'
import countries from './countries'
import { countryNameOf } from './countryNames'
import { loadLevel } from '../maps/mapData'
import { getCountryMap, levelIndexOfCode } from '../maps/registry'
import { useStore } from '../store/useStore'
import type { Locale, RegionId } from '../types'
import { splitId } from './regions'

export function countryName(iso3: string, locale: Locale): string {
  return countryNameOf(iso3, locale) ?? countries.getName(iso3, locale) ?? countries.getName(iso3, 'en') ?? iso3
}

/** The "other" language, shown as a secondary name. */
export function otherLocale(l: Locale): Locale {
  return l === 'ko' ? 'en' : 'ko'
}

export function allCountryCodes(): string[] {
  return Object.keys(countries.getAlpha3Codes())
}

// ---- sub-region names (from the loaded TopoJSON), shared across screens ----
type Names = { ko?: string; en: string }
const names = new Map<RegionId, Names>()
const loading = new Set<string>()
let version = 0
const listeners = new Set<() => void>()
const bump = () => {
  version++
  listeners.forEach((l) => l())
}

/** Loads the names of one level (levels can be megabytes, so only what records actually need). */
function ensureNames(iso3: string, levelIndex: number) {
  const cfg = getCountryMap(iso3)
  const level = cfg?.levels[levelIndex]
  const key = `${iso3}:${levelIndex}`
  if (!cfg || !level || loading.has(key)) return
  loading.add(key)
  loadLevel(level)
    .then((fc) => {
      for (const f of fc.features) {
        const code = f.properties?.[level.idProp] ?? String(f.id)
        names.set(`${iso3}:${code}`, {
          ko: level.nameProps.ko ? f.properties?.[level.nameProps.ko] : undefined,
          en: f.properties?.[level.nameProps.en] ?? code,
        })
      }
      bump()
    })
    .catch(() => loading.delete(key))
}

function ensureForId(id: string) {
  const { iso3, code } = splitId(id)
  const cfg = getCountryMap(iso3)
  if (!cfg || code === undefined) return
  for (let i = levelIndexOfCode(cfg, code); i >= 0; i--) ensureNames(iso3, i)
}

/** Make sure these regions (and their parents) can be named, even when no record mentions them yet. */
export function useEnsureNames(...ids: string[]) {
  const key = ids.join('|')
  useEffect(() => {
    key.split('|').filter(Boolean).forEach(ensureForId)
  }, [key])
}

/** Returns a function that names any region id (country or sub-region) in the current language. */
export function useRegionNamer(): (id: RegionId) => string {
  const locale = useStore((s) => s.settings.locale)
  const trips = useStore((s) => s.trips)
  const regions = useStore((s) => s.regions)
  const v = useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => version,
  )
  useEffect(() => {
    // every recorded region needs its own level's names, plus its parents' levels for "Gangwon-do › Gangneung" labels
    const ids = new Set<string>([...trips.map((t) => t.regionId), ...Object.keys(regions)])
    ids.forEach(ensureForId)
  }, [trips, regions])

  return useCallback(
    (id: RegionId) => {
      void v
      const { iso3, code } = splitId(id)
      if (code === undefined) return countryName(iso3, locale)
      const n = names.get(id)
      return n ? ((locale === 'ko' ? n.ko : n.en) ?? n.en) : code
    },
    [locale, v],
  )
}
