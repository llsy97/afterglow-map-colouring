import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, List, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useTaglineKey } from '../components/Header'
import { Legend } from '../components/Legend'
import { RegionListSheet } from '../components/RegionListSheet'
import { Select } from '../components/Select'
import { MapView } from '../components/MapView'
import { BigStat, LevelDot, PhotoThumbs } from '../components/ui'
import { formatNumber, formatRange } from '../lib/format'
import { nextQuickLevel } from '../lib/levels'
import { useRegionNamer } from '../lib/names'
import { computeLevels, sortTripsNewestFirst, tripsIn } from '../lib/regions'
import { regionName, useCountryShape, useLevelList, useLevelShapes } from '../maps/mapData'
import type { ShapesState } from '../maps/mapData'
import { getCountryMap } from '../maps/registry'
import { useNav } from '../store/useNav'
import { useStore } from '../store/useStore'
import type { Level, RegionId } from '../types'

/** The Map tab: the default country. */
export function MapScreen() {
  const home = useStore((s) => s.settings.homeCountry)
  return <CountryMap iso3={home} />
}

/**
 * A country's map with its levels (states → cities → …), list picker and scope picker.
 * Used for the Map tab and — opened from the World tab — for any other country (`embedded`).
 */
export function CountryMap({
  iso3,
  embedded,
  initialLevel = 0,
  initialScope = '',
}: {
  iso3: string
  embedded?: boolean
  initialLevel?: number
  initialScope?: string
}) {
  const { t } = useTranslation()
  const locale = useStore((s) => s.settings.locale)
  const homeCountry = iso3
  const regions = useStore((s) => s.regions)
  const trips = useStore((s) => s.trips)
  const setQuickLevel = useStore((s) => s.setQuickLevel)
  const push = useNav((s) => s.push)
  const taglineKey = useTaglineKey()
  const nameOf = useRegionNamer()

  const cfg = getCountryMap(homeCountry)
  const [pickedLevel, setLevelIndex] = useState(initialLevel)
  // a different default country may have fewer levels than the one we were on
  const levelIndex = cfg && pickedLevel < cfg.levels.length ? pickedLevel : 0
  const [attempt, setAttempt] = useState(0)
  const [selectedId, setSelectedId] = useState<RegionId>()

  // Countries without a detailed map are drawn as one large silhouette.
  // dense levels (cities, 읍·면·동): optionally narrow the map to one top-level region
  const [listOpen, setListOpen] = useState(false)
  const [scope, setScope] = useState(initialScope)
  useEffect(() => {
    setScope(initialScope)
    setLevelIndex(initialLevel)
    setSelectedId(undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeCountry])
  const roots = useLevelList(levelIndex > 0 ? cfg : undefined, 0)
  const scoped = levelIndex > 0 && scope ? scope : undefined
  const detailed = useLevelShapes(cfg, levelIndex, { parentCode: scoped }, attempt)
  const single = useCountryShape(cfg ? undefined : homeCountry, undefined, undefined, attempt)
  const state: ShapesState = cfg ? detailed : single
  const shapes = state.status === 'ready' ? state.shapes : []

  const levelMap = useMemo(() => computeLevels(regions, trips), [regions, trips])
  const levels = levelMap as Record<RegionId, Level>
  const lit = useMemo(() => shapes.filter((s) => (levelMap[s.id] ?? 0) > 0).length, [shapes, levelMap])
  const levelLabel = useCallback((l: Level) => t(`level.${l}`), [t])
  const quickMode = !cfg || levelIndex === 0

  const onSelect = useCallback(
    (id: RegionId) => {
      if (!quickMode) {
        push({ t: 'region', id })
        return
      }
      setSelectedId(id)
      const s = useStore.getState()
      const current = (computeLevels(s.regions, s.trips)[id] ?? 0) as Level
      setQuickLevel(id, nextQuickLevel(current))
    },
    [quickMode, push, setQuickLevel],
  )

  const selected = shapes.find((s) => s.id === selectedId)
  const selectedLevel = selected ? (levelMap[selected.id] ?? 0) : 0
  const latestTrip = useMemo(() => sortTripsNewestFirst(tripsIn(homeCountry, trips))[0], [homeCountry, trips])

  return (
    <div className={`map-screen${embedded ? ' embedded' : ''}`}>
      <div className="panel-top">
      <BigStat
        value={formatNumber(lit, locale)}
        unit={t(`unit.${taglineKey}`)}
        total={t('map.of', { total: formatNumber(shapes.length, locale) })}
      />

      {cfg && (
        <div className="flex gap-2 overflow-x-auto px-5 pt-3 pb-1" role="group">
          {cfg.levels.map((lv, i) => (
            <button
              key={lv.key}
              className="chip"
              aria-pressed={i === levelIndex}
              onClick={() => {
                setLevelIndex(i)
                setScope('')
                setSelectedId(undefined)
              }}
            >
              {lv.label[locale]}
            </button>
          ))}
          <button className="chip chip-list" onClick={() => setListOpen(true)}>
            <List size={14} strokeWidth={1.5} />
            {t('list.open')}
          </button>
          {cfg.lockedLevel && (
            <button className="chip" aria-disabled="true" disabled>
              <Lock size={14} strokeWidth={1.5} />
              {cfg.lockedLevel[locale]}
            </button>
          )}
        </div>
      )}

      {cfg && levelIndex > 0 && (
        <>
          <div className="scope-row">
            <Select
              label={t('map.scopeLabel')}
              value={scope}
              options={[
                { value: '', label: t('map.scopeAll', { level: cfg.levels[0].label[locale] }) },
                ...roots.map((r) => ({ value: r.code, label: regionName(r.names, locale) })),
              ]}
              onChange={(v) => {
                setScope(v)
                setSelectedId(undefined)
              }}
            />
          </div>
          {shapes.length > 600 && !scope && <p className="scope-hint">{t('map.denseHint')}</p>}
        </>
      )}

      </div>

      {listOpen && cfg && <RegionListSheet cfg={cfg} onClose={() => setListOpen(false)} />}

      <div className="map-area">
        {state.status === 'loading' && <p className="absolute inset-0 grid place-items-center t-dim">{t('map.loading')}</p>}
        {state.status === 'error' && (
          <div className="absolute inset-0 grid place-content-center justify-items-center gap-3">
            <p className="m-0 t-dim">{t('map.loadError')}</p>
            <button className="pill-btn" onClick={() => setAttempt((a) => a + 1)}>
              {t('map.retry')}
            </button>
          </div>
        )}
        {state.status === 'ready' && (
          <MapView zoomable maxZoom={14} frames={state.status === "ready" ? state.frames : undefined} shapes={shapes} levels={levels} selectedId={selectedId} locale={locale} levelLabel={levelLabel} onSelect={onSelect} />
        )}
      </div>

      <div className="panel-bottom">
        {!cfg && <p className="m-0 mb-2 text-center text-[13px] t-dim">{t('map.detailSoon')}</p>}
        <Legend />
        {quickMode ? (
          <section className="card mt-3 flex min-h-[92px] items-center gap-3 px-4 py-3" aria-live="polite">
            {selected ? (
              <>
                <div className="grid min-w-0 flex-1 gap-1">
                  <span className="t-label">{t(`level.${selectedLevel}`)}</span>
                  <span className="t-name truncate">{regionName(selected.names, locale)}</span>
                  <span className="text-[13px] t-dim">
                    {(() => {
                      const n = tripsIn(selected.id, trips).length
                      if (n > 0) return t('record.visitCount', { count: n })
                      return selectedLevel > 0 && selectedLevel < 4 ? t('hint.tapAgain') : ''
                    })()}
                  </span>
                </div>
                <button className="pill-btn flex-none" onClick={() => push({ t: 'region', id: selected.id })}>
                  {t('record.open')}
                  <ArrowRight size={16} strokeWidth={1.5} />
                </button>
              </>
            ) : (
              <p className="m-0 w-full text-center text-[14px] t-dim">{lit === 0 ? t('empty.map') : t('map.tapRegion')}</p>
            )}
          </section>
        ) : (
          <section className="card mt-3 grid min-h-[92px] gap-2 px-4 py-3">
            {latestTrip ? (
              <button className="card-btn" onClick={() => push({ t: 'region', id: latestTrip.regionId })}>
                <span className="flex items-center gap-2">
                  <LevelDot level={latestTrip.level} />
                  <span className="t-name min-w-0 flex-1 truncate">{nameOf(latestTrip.regionId)}</span>
                  <span className="flex-none text-[12px] t-dim">{formatRange(latestTrip.startDate, latestTrip.endDate, locale)}</span>
                </span>
                <PhotoThumbs ids={latestTrip.photos.map((p) => p.id)} ratio="1 / 1" />
              </button>
            ) : (
              <p className="m-0 my-auto text-center text-[14px] t-dim">{t('map.tapDistrict')}</p>
            )}
          </section>
        )}
      </div>
    </div>
  )
}
