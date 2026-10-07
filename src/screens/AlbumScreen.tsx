import { useMemo } from 'react'
import { Share2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Thumb } from '../components/ui'
import { formatDate } from '../lib/format'
import { useRegionNamer } from '../lib/names'
import { sortTripsNewestFirst } from '../lib/regions'
import { useNav } from '../store/useNav'
import { useStore } from '../store/useStore'

/** Every remembered scene, newest trip first. Entry point to the share poster. */
export function AlbumScreen() {
  const { t } = useTranslation()
  const locale = useStore((s) => s.settings.locale)
  const trips = useStore((s) => s.trips)
  const push = useNav((s) => s.push)
  const nameOf = useRegionNamer()

  const photos = useMemo(
    () => sortTripsNewestFirst(trips).flatMap((tr) => tr.photos.map((p) => ({ ...p, trip: tr }))),
    [trips],
  )

  return (
    <div className="page-scroll">
      <div className="flex items-center justify-between gap-3">
        <h1 className="t-name-lg m-0">{t('tab.album')}</h1>
        <button className="pill-btn" onClick={() => push({ t: 'poster' })}>
          <Share2 size={16} strokeWidth={1.5} />
          {t('poster.make')}
        </button>
      </div>
      {photos.length === 0 ? (
        <p className="m-0 mt-16 text-center t-dim">{t('album.empty')}</p>
      ) : (
        <ul className="m-0 mt-5 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3 xl:grid-cols-4">
          {photos.map((p) => (
            <li key={p.id}>
              <button
                className="card-btn"
                aria-label={`${nameOf(p.trip.regionId)}, ${formatDate(p.trip.startDate, locale)}`}
                onClick={() => push({ t: 'trip', regionId: p.trip.regionId, tripId: p.trip.id })}
              >
                <Thumb id={p.id} />
                <span className="grid gap-0.5">
                  <span className="truncate text-[13px] font-bold">{p.caption || nameOf(p.trip.regionId)}</span>
                  <span className="truncate text-[11px] t-dim">
                    {p.caption ? `${nameOf(p.trip.regionId)} · ` : ''}
                    {formatDate(p.trip.startDate, locale)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
