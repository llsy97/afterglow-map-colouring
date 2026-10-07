import { memo, useEffect, useMemo, useState } from 'react'
import { Check, Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { countryName, otherLocale } from '../lib/names'
import { buildSilhouettes } from '../maps/mapData'
import { getCountryMap } from '../maps/registry'
import { useStore } from '../store/useStore'
import type { Locale } from '../types'

let silhouettePromise: Promise<Record<string, string>> | undefined

function useSilhouettes() {
  const [paths, setPaths] = useState<Record<string, string>>({})
  useEffect(() => {
    silhouettePromise ??= buildSilhouettes(44)
    let alive = true
    silhouettePromise.then((p) => alive && setPaths(p)).catch(() => (silhouettePromise = undefined))
    return () => {
      alive = false
    }
  }, [])
  return paths
}

const Row = memo(function Row(p: {
  iso3: string
  d?: string
  name: string
  other: string
  badge?: string
  selected: boolean
  onPick: (iso3: string) => void
}) {
  return (
    <button className="row-btn" aria-pressed={p.selected} onClick={() => p.onPick(p.iso3)}>
      <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true" className="flex-none">
        <g transform="translate(2 2)">{p.d && <path d={p.d} fill="var(--light)" fillOpacity="0.85" />}</g>
      </svg>
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="flex items-center gap-2">
          <span className="t-name truncate">{p.name}</span>
          {p.badge && <span className="badge">{p.badge}</span>}
        </span>
        <span className="truncate text-[12px] t-dim">{p.other}</span>
      </span>
      {p.selected && <Check size={20} strokeWidth={1.5} className="flex-none" />}
    </button>
  )
})

/** Search + list of countries with silhouette mini maps. Countries with a detailed map come first. */
export function CountryPicker({ selected, onPick, showBadge = true }: { selected: string; onPick: (iso3: string) => void; showBadge?: boolean }) {
  const { t } = useTranslation()
  const locale = useStore((s) => s.settings.locale)
  const paths = useSilhouettes()
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return Object.keys(paths)
      .map((iso3) => {
        const levels = getCountryMap(iso3)?.levels
        const level = levels?.[levels.length - 1].label[locale as Locale] // the finest level we can map
        return {
          iso3,
          name: countryName(iso3, locale),
          other: countryName(iso3, otherLocale(locale as Locale)),
          detailed: !!level,
          // "down to provinces" / "시·도까지"
          badge: level && t('country.detailBadge', { level: locale === 'en' ? level.toLowerCase() : level }),
        }
      })
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.other.toLowerCase().includes(q) || r.iso3.toLowerCase() === q)
      .sort((a, b) => Number(b.detailed) - Number(a.detailed) || a.name.localeCompare(b.name, locale))
  }, [paths, locale, query, t])

  return (
    <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] gap-3">
      <label className="relative block">
        <span className="sr-only">{t('country.search')}</span>
        <Search size={18} strokeWidth={1.5} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 t-dim" />
        <input
          className="field !pl-10"
          type="search"
          value={query}
          placeholder={t('country.search')}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <ul className="m-0 grid min-h-0 list-none content-start gap-2 overflow-y-auto p-0 pb-4">
        {rows.map((r) => (
          <li key={r.iso3}>
            <Row iso3={r.iso3} name={r.name} other={r.other} badge={showBadge ? r.badge : undefined} d={paths[r.iso3]} selected={r.iso3 === selected} onPick={onPick} />
          </li>
        ))}
        {rows.length === 0 && <li className="py-8 text-center t-dim">{t('country.noResult')}</li>}
      </ul>
    </div>
  )
}
