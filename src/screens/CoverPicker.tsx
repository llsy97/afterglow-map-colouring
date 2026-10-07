import { useMemo, useState } from 'react'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Thumb, TopBar } from '../components/ui'
import { useRegionNamer } from '../lib/names'
import { regionPhotoIds, sortTripsNewestFirst, tripsIn } from '../lib/regions'
import { useNav } from '../store/useNav'
import { useStore } from '../store/useStore'
import type { RegionId } from '../types'

/** Pick up to 3 of a region's photos to represent it on cards and the poster. */
export function CoverPicker({ regionId }: { regionId: RegionId }) {
  const { t } = useTranslation()
  const back = useNav((s) => s.back)
  const regions = useStore((s) => s.regions)
  const trips = useStore((s) => s.trips)
  const setCoverPhotos = useStore((s) => s.setCoverPhotos)
  const nameOf = useRegionNamer()

  const photos = useMemo(
    () => sortTripsNewestFirst(tripsIn(regionId, trips)).flatMap((tr) => tr.photos.map((p) => ({ ...p, tripId: tr.id }))),
    [regionId, trips],
  )
  const [picked, setPicked] = useState<string[]>(() => regions[regionId]?.coverPhotoIds ?? regionPhotoIds(regionId, regions, trips))

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 3 ? p : [...p, id]))

  return (
    <div className="screen">
      <TopBar onBack={back} label={nameOf(regionId)} />
      <div className="screen-scroll px-5 pb-6">
        <h1 className="t-name-lg m-0 mt-1">{t('region.pickCover')}</h1>
        <p className="m-0 mt-2 text-[14px] t-dim">
          {t('cover.hint')} · {picked.length} / 3
        </p>
        <ul className="m-0 mt-5 grid list-none grid-cols-3 gap-2 p-0">
          {photos.map((p) => {
            const order = picked.indexOf(p.id)
            return (
              <li key={p.id}>
                <button
                  className="card-btn relative"
                  aria-pressed={order >= 0}
                  aria-label={p.caption || t('cover.photo')}
                  onClick={() => toggle(p.id)}
                >
                  <Thumb id={p.id} />
                  {order >= 0 && (
                    <span className="absolute top-1.5 left-1.5 grid h-6 w-6 place-items-center rounded-full bg-[var(--btn-bg)] text-[var(--btn-fg)] text-[12px] font-bold">
                      {order + 1}
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
      <div className="bottom-bar">
        <button
          className="pill-btn"
          onClick={() => {
            setCoverPhotos(regionId, picked)
            back()
          }}
        >
          <Check size={18} strokeWidth={1.5} />
          {t('common.save')}
        </button>
      </div>
    </div>
  )
}
