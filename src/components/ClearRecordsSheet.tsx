import { useMemo } from 'react'
import { Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from './Sheet'
import { deletePhoto, forgetPhotoUrl } from '../lib/photos'
import { isWithin } from '../lib/regions'
import { useStore } from '../store/useStore'
import type { RegionId } from '../types'

/** Themed confirmation for erasing a region's records (own only, or including everything below it). */
export function ClearRecordsSheet({ id, name, onClose }: { id: RegionId; name: string; onClose: () => void }) {
  const { t } = useTranslation()
  const regions = useStore((s) => s.regions)
  const trips = useStore((s) => s.trips)
  const clear = useStore((s) => s.clearRegionRecords)

  const stats = useMemo(() => {
    const count = (match: (rid: RegionId) => boolean) => {
      const ts = trips.filter((tr) => match(tr.regionId))
      const quick = Object.values(regions).filter((r) => match(r.id) && r.quickLevel > 0).length
      return { trips: ts.length, photos: ts.reduce((n, tr) => n + tr.photos.length, 0), quick }
    }
    return { own: count((r) => r === id), all: count((r) => isWithin(r, id)) }
  }, [regions, trips, id])

  const hasOwn = stats.own.trips + stats.own.quick > 0
  const belowExists = stats.all.trips + stats.all.quick > stats.own.trips + stats.own.quick

  async function run(withChildren: boolean) {
    const photoIds = clear(id, withChildren)
    onClose()
    for (const p of photoIds) {
      await deletePhoto(p).catch(() => undefined)
      forgetPhotoUrl(p)
    }
  }

  const summary = (x: { trips: number; photos: number; quick: number }) =>
    [x.trips && t('clear.trips', { count: x.trips }), x.photos && t('clear.photos', { count: x.photos }), x.quick && t('clear.quick', { count: x.quick })]
      .filter(Boolean)
      .join(' · ') || t('clear.nothing')

  return (
    <Sheet title={t('clear.title')} onClose={onClose}>
      <div className="grid gap-4 overflow-y-auto">
        <p className="m-0 text-[15px] leading-relaxed">{t('clear.body', { name })}</p>

        {(hasOwn || !belowExists) && (
          <button className="clear-opt" onClick={() => void run(false)}>
            <span className="font-bold">{belowExists ? t('clear.ownOnly') : t('clear.confirm')}</span>
            <span className="text-[12px] t-dim">{summary(stats.own)}</span>
          </button>
        )}

        {belowExists && (
          <button className="clear-opt" onClick={() => void run(true)}>
            <span className="font-bold">{t('clear.withChildren')}</span>
            <span className="text-[12px] t-dim">{summary(stats.all)}</span>
          </button>
        )}

        <p className="m-0 flex items-center gap-2 text-[12px] t-dim">
          <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
          {t('clear.warning')}
        </p>
        <button className="pill-btn ghost" onClick={onClose}>
          {t('clear.cancel')}
        </button>
      </div>
    </Sheet>
  )
}
