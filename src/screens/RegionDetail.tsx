import { useMemo, useState } from 'react'
import { ImagePlus, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ClearRecordsSheet } from '../components/ClearRecordsSheet'
import { Legend } from '../components/Legend'
import { MapView } from '../components/MapView'
import { LevelDot, Thumb, TopBar } from '../components/ui'
import { formatRange } from '../lib/format'
import { useEnsureNames, useRegionNamer } from '../lib/names'
import { ancestorsOf, computeLevels, isCountry, isWithin, parentOf, sortTripsNewestFirst, splitId, tripsIn } from '../lib/regions'
import { useCountryShape, useLevelShapes } from '../maps/mapData'
import type { ShapesState } from '../maps/mapData'
import { getCountryMap } from '../maps/registry'
import { useNav } from '../store/useNav'
import { useStore } from '../store/useStore'
import type { Level, RegionId, Trip } from '../types'

const MINI_W = 390
const MINI_H = 230

export function RegionDetail({ id }: { id: RegionId }) {
  const { t } = useTranslation()
  const locale = useStore((s) => s.settings.locale)
  const regions = useStore((s) => s.regions)
  const allTrips = useStore((s) => s.trips)
  const setQuickLevel = useStore((s) => s.setQuickLevel)
  const { push, back } = useNav()
  const nameOf = useRegionNamer()
  useEnsureNames(id)
  const [clearOpen, setClearOpen] = useState(false)

  const { iso3 } = splitId(id)
  const cfg = getCountryMap(iso3)
  const country = isCountry(id)
  const parent = parentOf(id)
  const depth = country ? -1 : ancestorsOf(id).length - 1 // index into cfg.levels
  const parentCode = parent && parent !== iso3 ? splitId(parent).code : undefined

  const levelMap = useMemo(() => computeLevels(regions, allTrips), [regions, allTrips])
  const level = (levelMap[id] ?? 0) as Level
  const trips = useMemo(() => sortTripsNewestFirst(tripsIn(id, allTrips)), [id, allTrips])
  const hasPhotos = trips.some((tr) => tr.photos.length > 0)
  // anything recorded here or below (trips, quick levels, covers)?
  const hasRecords = trips.length > 0 || Object.values(regions).some((x) => isWithin(x.id, id) && (x.quickLevel > 0 || !!x.coverPhotoIds?.length))

  // Parent map: this region glows, its siblings stay as unlit land.
  const sub = useLevelShapes(cfg, Math.max(depth, 0), { w: MINI_W, h: MINI_H, parentCode })
  const solo = useCountryShape(cfg ? undefined : iso3, MINI_W, MINI_H)
  const state: ShapesState = cfg ? sub : solo
  const miniLevels = useMemo(() => {
    if (country && cfg) return levelMap as Record<RegionId, Level> // whole country: show every province as recorded
    return { [id]: level } as Record<RegionId, Level>
  }, [country, cfg, levelMap, id, level])

  return (
    <div className="screen">
      <TopBar onBack={back} label={country ? t('region.country') : nameOf(parent ?? iso3)} />
      <div className="screen-scroll px-5 pb-6">
        <h1 className="t-name-lg m-0 mt-1 break-words">{nameOf(id)}</h1>
        <p className="m-0 mt-1 text-[14px] t-dim">
          {trips.length > 0 ? t('record.visitCount', { count: trips.length }) : t('region.noTrips')}
        </p>

        <div className="mt-4" style={{ aspectRatio: `${MINI_W} / ${MINI_H}` }}>
          {state.status === 'ready' ? (
            <MapView
              w={MINI_W}
              h={MINI_H}
              shapes={state.shapes}
              frames={state.frames}
              levels={miniLevels}
              selectedId={country && cfg ? undefined : id}
              locale={locale}
            />
          ) : (
            <p className="m-0 grid h-full place-items-center t-dim">{state.status === 'loading' ? t('map.loading') : t('map.loadError')}</p>
          )}
        </div>
        <div className="mt-1">
          <Legend />
        </div>

        {country && (
          <section className="mt-6 grid gap-2">
            <h2 className="t-label m-0">{t('region.quick')}</h2>
            <div className="grid grid-cols-5 gap-1.5" role="group">
              {([0, 1, 2, 3, 4] as Level[]).map((l) => (
                <button
                  key={l}
                  className="level-btn !h-[52px] !text-[11px]"
                  aria-pressed={(regions[id]?.quickLevel ?? 0) === l}
                  onClick={() => setQuickLevel(id, l)}
                >
                  <span className="max-w-full truncate">{t(`level.${l}`)}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        <div className="mt-7 flex items-center justify-between gap-3">
          <h2 className="t-label m-0">{t('region.timeline')}</h2>
          {hasPhotos && (
            <button className="chip" onClick={() => push({ t: 'cover', regionId: id })}>
              <ImagePlus size={16} strokeWidth={1.5} />
              {t('region.pickCover')}
            </button>
          )}
        </div>

        <ul className="m-0 mt-3 grid list-none gap-3 p-0">
          {trips.map((trip) => (
            <li key={trip.id}>
              <TripCard trip={trip} showRegion={trip.regionId !== id} regionLabel={nameOf(trip.regionId)} />
            </li>
          ))}
        </ul>
        {trips.length === 0 && <p className="m-0 mt-6 text-center t-dim">{t('region.emptyTimeline')}</p>}

        {hasRecords && (
          <button className="pill-btn ghost mt-8 w-full" onClick={() => setClearOpen(true)}>
            <Trash2 size={16} strokeWidth={1.5} />
            {t('clear.open')}
          </button>
        )}
        {clearOpen && <ClearRecordsSheet id={id} name={nameOf(id)} onClose={() => setClearOpen(false)} />}
      </div>

      <div className="bottom-bar">
        <button className="pill-btn" onClick={() => push({ t: 'trip', regionId: id })}>
          <Plus size={18} strokeWidth={1.5} />
          {t('record.newTrip')}
        </button>
      </div>
    </div>
  )
}

function TripCard({ trip, showRegion, regionLabel }: { trip: Trip; showRegion: boolean; regionLabel: string }) {
  const { t } = useTranslation()
  const locale = useStore((s) => s.settings.locale)
  const push = useNav((s) => s.push)
  return (
    <button
      className="card card-btn w-full px-4 py-3"
      onClick={() => push({ t: 'trip', regionId: trip.regionId, tripId: trip.id })}
    >
      <span className="flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate text-[15px] font-bold">{formatRange(trip.startDate, trip.endDate, locale)}</span>
        <span className="flex flex-none items-center gap-1.5 text-[12px] t-dim">
          <LevelDot level={trip.level} />
          {t(`level.${trip.level}`)}
        </span>
      </span>
      {showRegion && <span className="t-label truncate">{regionLabel}</span>}
      {trip.photos.length > 0 && (
        <span className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className="grid gap-1">
              <Thumb id={trip.photos[i]?.id} ratio="3 / 4" />
              <span className="truncate text-[11px] t-dim">{trip.photos[i]?.caption}</span>
            </span>
          ))}
        </span>
      )}
      {trip.note && <span className="truncate text-[13px]">{trip.note}</span>}
    </button>
  )
}
