import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { usePhotoUrl } from '../lib/photos'
import type { Level } from '../types'

export function LevelDot({ level, className }: { level: Level; className?: string }) {
  return <span className={`legend-dot ${className ?? ''}`} style={{ opacity: level ? `var(--op-${level})` : 0.25 }} aria-hidden="true" />
}

/** Big number + unit + "/ total" row shared by the Map and World tabs. */
export function BigStat({ value, unit, total }: { value: string; unit: string; total: string }) {
  return (
    <div className="flex items-end gap-2 px-5 pt-4">
      <span className="t-num">{value}</span>
      <span className="min-w-0 pb-1.5 text-[15px] font-semibold">{unit}</span>
      <span className="ml-auto flex-none pb-1.5 text-[15px] t-dim">{total}</span>
    </div>
  )
}

export function Thumb({ id, ratio = '3 / 4', className }: { id?: string; ratio?: string; className?: string }) {
  const url = usePhotoUrl(id)
  return (
    <div className={`thumb ${className ?? ''}`} style={{ aspectRatio: ratio }}>
      {url && <img src={url} alt="" loading="lazy" draggable={false} />}
    </div>
  )
}

/** Three photo slots; missing ones stay as empty frames so rows line up. */
export function PhotoThumbs({ ids, ratio }: { ids: string[]; ratio?: string }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[0, 1, 2].map((i) => (
        <Thumb key={i} id={ids[i]} ratio={ratio} />
      ))}
    </div>
  )
}

export function BackButton({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation()
  return (
    <button className="icon-btn" aria-label={t('common.back')} onClick={onClick}>
      <ChevronLeft size={24} strokeWidth={1.5} />
    </button>
  )
}

export function TopBar({ onBack, label, right }: { onBack: () => void; label?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center gap-1 px-2 pt-[max(8px,env(safe-area-inset-top))]">
      <BackButton onClick={onBack} />
      <span className="t-label min-w-0 flex-1 truncate">{label}</span>
      {right}
    </div>
  )
}

export function Spinner({ label }: { label: string }) {
  return <p className="m-0 grid place-items-center t-dim">{label}</p>
}
