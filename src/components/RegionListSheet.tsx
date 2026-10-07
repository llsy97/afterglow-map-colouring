import { useMemo, useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from './Sheet'
import { LevelDot } from './ui'
import { countryName } from '../lib/names'
import { computeLevels } from '../lib/regions'
import { regionName, useChildren } from '../maps/mapData'
import type { CountryMapConfig } from '../maps/registry'
import { useNav } from '../store/useNav'
import { useStore } from '../store/useStore'
import type { Level, RegionId } from '../types'

export type Step = { code: string; id: RegionId; name: string }

/**
 * Pick any region from lists instead of the map: top level → next level → … → the finest level of the country
 * (e.g. 시·도 → 시·군·구 → 읍·면·동). Every step can also be recorded on its own.
 */
export function RegionListSheet({ cfg, onClose, startTrail = [] }: { cfg: CountryMapConfig; onClose: () => void; startTrail?: Step[] }) {
  const { t } = useTranslation()
  const locale = useStore((s) => s.settings.locale)
  const regions = useStore((s) => s.regions)
  const trips = useStore((s) => s.trips)
  const push = useNav((s) => s.push)
  const [trail, setTrail] = useState<Step[]>(startTrail)
  const [query, setQuery] = useState('')

  const depth = trail.length
  const current = trail[depth - 1]
  const { loading, list } = useChildren(cfg, depth, current?.code)
  const hasNext = depth + 1 < cfg.levels.length
  const levels = useMemo(() => computeLevels(regions, trips), [regions, trips])

  const q = query.trim().toLowerCase()
  const rows = useMemo(
    () =>
      list
        .map((r) => ({ ...r, name: regionName(r.names, locale), alt: (locale === 'ko' ? r.names.en : (r.names.ko ?? '')).toLowerCase() }))
        .filter((r) => !q || r.name.toLowerCase().includes(q) || r.alt.includes(q)),
    [list, locale, q],
  )

  const open = (id: RegionId) => {
    onClose()
    push({ t: 'region', id })
  }
  const goTo = (n: number) => {
    setTrail(trail.slice(0, n))
    setQuery('')
  }

  return (
    <Sheet title={t('list.title')} onClose={onClose}>
      {/* breadcrumb: country › 시·도 › 시·군·구 */}
      <nav className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[13px]" aria-label={t('list.path')}>
        {[{ id: cfg.iso3, name: countryName(cfg.iso3, locale) }, ...trail].map((s, i) => (
          <span key={s.id} className="flex items-center gap-1">
            {i > 0 && <ChevronRight size={14} strokeWidth={1.5} className="t-dim" aria-hidden="true" />}
            <button
              className="crumb"
              aria-current={i === depth ? 'step' : undefined}
              disabled={i === depth}
              onClick={() => goTo(i)}
            >
              {s.name}
            </button>
          </span>
        ))}
      </nav>

      <p className="t-label m-0">{cfg.levels[depth].label[locale]}</p>

      <label className="relative block">
        <span className="sr-only">{t('list.search')}</span>
        <Search size={18} strokeWidth={1.5} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 t-dim" />
        <input className="field !pl-10" type="search" value={query} placeholder={t('list.search')} onChange={(e) => setQuery(e.target.value)} />
      </label>

      <ul className="m-0 grid min-h-0 flex-1 list-none content-start gap-2 overflow-y-auto p-0 pb-1">
        {/* record on the parent itself */}
        <li>
          <button className="row-btn !min-h-[52px] !border-dashed" onClick={() => open(current ? current.id : cfg.iso3)}>
            <span className="min-w-0 flex-1 truncate font-semibold">
              {t(current ? 'list.recordHere' : 'list.recordCountry', { name: current ? current.name : countryName(cfg.iso3, locale) })}
            </span>
          </button>
        </li>
        {loading && <li className="py-6 text-center t-dim">{t('map.loading')}</li>}
        {!loading && rows.length === 0 && <li className="py-6 text-center t-dim">{t('list.empty')}</li>}
        {rows.map((r) => (
          <li key={r.id}>
            <button
              className="row-btn !min-h-[52px]"
              onClick={() => {
                if (hasNext) {
                  setTrail([...trail, { code: r.code, id: r.id, name: r.name }])
                  setQuery('')
                } else open(r.id)
              }}
            >
              <LevelDot level={(levels[r.id] ?? 0) as Level} />
              <span className="grid min-w-0 flex-1">
                <span className="truncate font-semibold">{r.name}</span>
                {locale === 'ko' && r.names.en !== r.name && <span className="truncate text-[11px] t-dim">{r.names.en}</span>}
              </span>
              {hasNext && <ChevronRight size={18} strokeWidth={1.5} className="flex-none t-dim" aria-hidden="true" />}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
