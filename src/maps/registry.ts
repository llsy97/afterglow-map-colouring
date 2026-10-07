export type MapLevel = {
  key: string
  label: { ko: string; en: string }
  url: string
  object: string
  idProp: string
  nameProps: { ko?: string; en: string }
}

export type CountryMapConfig = {
  iso3: string
  levels: MapLevel[]
  lockedLevel?: { ko: string; en: string }
  /** parent code of a region code (undefined = the parent is the country itself) */
  parentOf?: (code: string) => string | undefined
}

export type AdminIndex = Record<string, { n: number; label: { ko: string; en: string } }>

/**
 * Hand-tuned maps (finer than the generic data). Everything else is generated:
 *   level 1  Natural Earth admin-1        scripts/build-admin1.mjs → /public/maps/admin1/<ISO3>.json
 *   level 2  geoBoundaries ADM2 (cities)  scripts/build-admin2.mjs → /public/maps/admin2/<ISO3>.json
 * each described by an index.json — so adding a country is "run the scripts", not "write code".
 * Data is self-hosted so the app also works offline.
 */
const STATIC_MAPS: Record<string, CountryMapConfig> = {
  KOR: {
    iso3: 'KOR',
    levels: [
      {
        key: 'provinces',
        label: { ko: '시·도', en: 'Provinces' },
        url: '/maps/kor/skorea-provinces-2018-topo-simple.json',
        object: 'skorea_provinces_2018_geo',
        idProp: 'code',
        nameProps: { ko: 'name', en: 'name_eng' },
      },
      {
        key: 'districts',
        label: { ko: '시·군·구', en: 'Districts' },
        url: '/maps/kor/skorea-municipalities-2018-topo-simple.json',
        object: 'skorea_municipalities_2018_geo',
        idProp: 'code',
        nameProps: { ko: 'name', en: 'name_eng' },
      },
      {
        key: 'neighborhoods',
        label: { ko: '읍·면·동', en: 'Neighborhoods' },
        url: '/maps/kor/skorea-submunicipalities-2018-topo-simple.json',
        object: 'skorea_submunicipalities_2018_geo',
        idProp: 'code',
        nameProps: { ko: 'name', en: 'name_eng' },
      },
    ],
    // 2-digit province → 5-digit district → 7-digit 읍·면·동, each code starts with its parent's
    parentOf: (code) => (code.length >= 7 ? code.slice(0, 5) : code.length >= 5 ? code.slice(0, 2) : undefined),
  },
}

/** generated countries: a level-2 code is "<parent>.<n>" */
const dotParent = (code: string) => (code.includes('.') ? code.slice(0, code.indexOf('.')) : undefined)

let index1: AdminIndex = {}
let index2: AdminIndex = {}
const generated = new Map<string, CountryMapConfig>()

async function loadIndex(url: string): Promise<AdminIndex | undefined> {
  try {
    const res = await fetch(url)
    return res.ok ? ((await res.json()) as AdminIndex) : undefined
  } catch {
    return undefined
  }
}

/** Call once at start-up; without it (offline, first visit) only the static maps exist. */
export async function loadAdminIndex(): Promise<void> {
  const [a, b] = await Promise.all([loadIndex('/maps/admin1/index.json'), loadIndex('/maps/admin2/index.json')])
  if (a) index1 = a
  if (b) index2 = b
  generated.clear()
}

export function getCountryMap(iso3: string): CountryMapConfig | undefined {
  if (STATIC_MAPS[iso3]) return STATIC_MAPS[iso3]
  const m1 = index1[iso3]
  if (!m1) return undefined
  let cfg = generated.get(iso3)
  if (!cfg) {
    const m2 = index2[iso3]
    cfg = {
      iso3,
      levels: [
        {
          key: 'admin1',
          label: m1.label,
          url: `/maps/admin1/${iso3}.json`,
          object: 'admin1',
          idProp: 'id',
          nameProps: { ko: 'name_ko', en: 'name' },
        },
        ...(m2
          ? [
              {
                key: 'admin2',
                label: m2.label,
                url: `/maps/admin2/${iso3}.json`,
                object: 'admin2',
                idProp: 'id',
                nameProps: { en: 'name' },
              },
            ]
          : []),
      ],
      lockedLevel: m2 ? undefined : { ko: '하위 지역', en: 'Sub-regions' },
      parentOf: dotParent,
    }
    generated.set(iso3, cfg)
  }
  return cfg
}

export const hasDetailMap = (iso3: string) => !!getCountryMap(iso3)

/** Index of the level a region code belongs to (0 = top level), by walking its parents. */
export function levelIndexOfCode(cfg: CountryMapConfig, code: string): number {
  let depth = 0
  let cur = cfg.parentOf?.(code)
  while (cur !== undefined) {
    depth++
    cur = cfg.parentOf?.(cur)
  }
  return depth
}
