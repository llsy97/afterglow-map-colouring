import { useCallback, useMemo, useState } from 'react'
import { List } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTaglineKey } from '../components/Header'
import { CountryPicker } from '../components/CountryPicker'
import { Legend } from '../components/Legend'
import { RegionActionSheet } from '../components/RegionActionSheet'
import { RegionListSheet } from '../components/RegionListSheet'
import type { Step } from '../components/RegionListSheet'
import { Sheet } from '../components/Sheet'
import { MapView } from '../components/MapView'
import { BigStat, LevelDot, PhotoThumbs } from '../components/ui'
import { formatNumber } from '../lib/format'
import { countryName, otherLocale } from '../lib/names'
import { computeLevels, regionPhotoIds, splitId, tripsIn } from '../lib/regions'
import { WORLD_H, WORLD_W, useWorldShapes, useWorldStates } from '../maps/mapData'
import type { CountryMapConfig } from '../maps/registry'
import { useStore } from '../store/useStore'
import type { Level, RegionId } from '../types'

export function WorldScreen() {
  const { t } = useTranslation()
  const locale = useStore((s) => s.settings.locale)
  const regions = useStore((s) => s.regions)
  const trips = useStore((s) => s.trips)
  const taglineKey = useTaglineKey()
  const [attempt, setAttempt] = useState(0)
  const [listOpen, setListOpen] = useState(false)
  const [action, setAction] = useState<RegionId>() // the country / state whose options are showing
  const [listFor, setListFor] = useState<{ cfg: CountryMapConfig; trail: Step[] }>()
  const [mode, setMode] = useState<'countries' | 'states'>('countries')
  const countries = useWorldShapes(attempt)
  const states = useWorldStates(mode === 'states', attempt)
  const state = mode === 'states' ? states : countries
  const shapes = state.status === 'ready' ? state.shapes : []
  const countryShapes = countries.status === 'ready' ? countries.shapes : []

  const levelMap = useMemo(() => computeLevels(regions, trips), [regions, trips])
  const levels = levelMap as Record<RegionId, Level>
  const levelLabel = useCallback((l: Level) => t(`level.${l}`), [t])
  const onSelect = useCallback((id: RegionId) => setAction(id), [])

  // Countries that are lit, most recently touched first.
  const recent = useMemo(() => {
    const activity = new Map<string, number>()
    for (const tr of trips) {
      const iso = splitId(tr.regionId).iso3
      activity.set(iso, Math.max(activity.get(iso) ?? 0, tr.createdAt))
    }
    for (const r of Object.values(regions)) {
      const iso = splitId(r.id).iso3
      activity.set(iso, Math.max(activity.get(iso) ?? 0, r.updatedAt ?? 0))
    }
    return countryShapes
      .filter((s) => (levelMap[s.id] ?? 0) > 0)
      .sort((a, b) => (activity.get(b.id) ?? 0) - (activity.get(a.id) ?? 0))
  }, [countryShapes, levelMap, regions, trips])
  const lit = mode === 'states' ? shapes.filter((s) => (levelMap[s.id] ?? 0) > 0).length : recent.length

  return (
    <div className="world-screen">
      <div className="world-main">
      <BigStat
        value={formatNumber(lit, locale)}
        unit={t(`unit.${taglineKey}`)}
        total={t('map.of', { total: formatNumber(shapes.length, locale) })}
      />

      <div className="flex gap-2 px-5 pt-3 pb-1" role="group">
        <button className="chip" aria-pressed={mode === 'countries'} onClick={() => setMode('countries')}>
          {t('world.countries')}
        </button>
        <button className="chip" aria-pressed={mode === 'states'} onClick={() => setMode('states')}>
          {t('world.states')}
        </button>
        <button className="chip chip-list" onClick={() => setListOpen(true)}>
          <List size={14} strokeWidth={1.5} />
          {t('world.listOpen')}
        </button>
      </div>

      {listOpen && (
        <Sheet title={t('world.listOpen')} onClose={() => setListOpen(false)}>
          <div className="flex min-h-0 flex-1 flex-col">
            <CountryPicker
              selected=""
              showBadge={false}
              onPick={(iso3) => {
                setListOpen(false)
                setAction(iso3)
              }}
            />
          </div>
        </Sheet>
      )}

      {action && <RegionActionSheet id={action} onClose={() => setAction(undefined)} onList={(cfg, trail) => setListFor({ cfg, trail })} />}
      {listFor && <RegionListSheet cfg={listFor.cfg} startTrail={listFor.trail} onClose={() => setListFor(undefined)} />}

      <div className="world-map" style={{ aspectRatio: `${WORLD_W} / ${WORLD_H}` }}>
        {state.status === 'ready' && (
          <MapView zoomable maxZoom={mode === 'states' ? 48 : 16} w={WORLD_W} h={WORLD_H} shapes={shapes} levels={levels} locale={locale} levelLabel={levelLabel} onSelect={onSelect} />
        )}
        {state.status === 'loading' && <p className="m-0 grid h-full place-items-center t-dim">{t('map.loading')}</p>}
        {state.status === 'error' && (
          <div className="grid h-full place-content-center justify-items-center gap-3">
            <p className="m-0 t-dim">{t('map.loadError')}</p>
            <button className="pill-btn" onClick={() => setAttempt((a) => a + 1)}>
              {t('map.retry')}
            </button>
          </div>
        )}
      </div>
      <div className="px-5">
        <Legend />
      </div>
      </div>

      <section className="world-list">
        <h2 className="t-label m-0">{t('world.recent')}</h2>
        {recent.length === 0 ? (
          <p className="m-0 mt-4 text-center text-[14px] t-dim">{t('world.empty')}</p>
        ) : (
          <ul className="m-0 mt-3 grid list-none gap-3 p-0">
            {recent.map((s) => {
              const level = (levelMap[s.id] ?? 0) as Level
              const n = tripsIn(s.id, trips).length
              return (
                <li key={s.id}>
                  <button className="card card-btn w-full px-4 py-3" onClick={() => setAction(s.id)}>
                    <span className="flex items-center gap-3">
                      <LevelDot level={level} />
                      <span className="grid min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className="t-name truncate">{countryName(s.id, locale)}</span>
                          <span className="truncate text-[12px] t-dim">{countryName(s.id, otherLocale(locale))}</span>
                        </span>
                        <span className="text-[13px] t-dim">
                          {t(`level.${level}`)}
                          {n > 0 && ` · ${t('record.visitCount', { count: n })}`}
                        </span>
                      </span>
                    </span>
                    <PhotoThumbs ids={regionPhotoIds(s.id, regions, trips)} ratio="1 / 1" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
