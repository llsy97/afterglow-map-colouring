import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DateField } from '../components/DateField'
import { LevelDot, TopBar } from '../components/ui'
import { todayIso } from '../lib/format'
import { useEnsureNames, useRegionNamer } from '../lib/names'
import { deletePhoto, forgetPhotoUrl, newId, putPhoto, resizePhoto, usePhotoUrl } from '../lib/photos'
import { useNav } from '../store/useNav'
import { useStore } from '../store/useStore'
import type { RegionId, Trip, TripLevel } from '../types'

type Slot = { id: string; caption: string; blob?: Blob; previewUrl?: string }

const LEVELS: TripLevel[] = [1, 2, 3, 4]

function SlotImage({ slot }: { slot: Slot }) {
  const stored = usePhotoUrl(slot.blob ? undefined : slot.id)
  const src = slot.previewUrl ?? stored
  return (
    <div className="thumb" style={{ aspectRatio: '3 / 4' }}>
      {src && <img src={src} alt="" draggable={false} />}
    </div>
  )
}

export function TripEdit({ regionId, tripId }: { regionId: RegionId; tripId?: string }) {
  const { t } = useTranslation()
  const back = useNav((s) => s.back)
  const existing = useStore((s) => s.trips.find((tr) => tr.id === tripId))
  const saveTrip = useStore((s) => s.saveTrip)
  const deleteTrip = useStore((s) => s.deleteTrip)
  const nameOf = useRegionNamer()
  useEnsureNames(regionId)

  const [startDate, setStartDate] = useState(existing?.startDate ?? todayIso())
  const [endDate, setEndDate] = useState(existing?.endDate ?? '')
  const [level, setLevel] = useState<TripLevel>(existing?.level ?? 3)
  const [note, setNote] = useState(existing?.note ?? '')
  const [slots, setSlots] = useState<Slot[]>(() => existing?.photos.map((p) => ({ id: p.id, caption: p.caption })) ?? [])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const fileRef = useRef<HTMLInputElement>(null)
  const previews = useRef<string[]>([])

  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), [])

  const dateError = endDate && endDate < startDate ? t('trip.endBeforeStart') : undefined
  const canSave = !!startDate && !dateError && !busy

  async function addFiles(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    setError(undefined)
    try {
      const room = 3 - slots.length
      const added: Slot[] = []
      for (const file of Array.from(files).slice(0, room)) {
        const blob = await resizePhoto(file)
        const previewUrl = URL.createObjectURL(blob)
        previews.current.push(previewUrl)
        added.push({ id: newId(), caption: '', blob, previewUrl })
      }
      setSlots((s) => [...s, ...added].slice(0, 3))
    } catch {
      setError(t('trip.photoError'))
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function save() {
    if (!canSave) return
    setBusy(true)
    try {
      for (const s of slots) if (s.blob) await putPhoto(s.id, s.blob)
      const keep = new Set(slots.map((s) => s.id))
      for (const p of existing?.photos ?? []) {
        if (!keep.has(p.id)) {
          await deletePhoto(p.id)
          forgetPhotoUrl(p.id)
        }
      }
      const trip: Trip = {
        id: existing?.id ?? newId(),
        regionId: existing?.regionId ?? regionId,
        startDate,
        endDate: endDate && endDate !== startDate ? endDate : undefined,
        level,
        photos: slots.map((s) => ({ id: s.id, caption: s.caption.trim() })),
        note: note.trim() || undefined,
        createdAt: existing?.createdAt ?? Date.now(),
      }
      saveTrip(trip)
      back()
    } catch {
      setError(t('trip.saveError'))
      setBusy(false)
    }
  }

  async function remove() {
    if (!existing || !window.confirm(t('trip.deleteConfirm'))) return
    for (const p of existing.photos) {
      await deletePhoto(p.id).catch(() => undefined)
      forgetPhotoUrl(p.id)
    }
    deleteTrip(existing.id)
    back()
  }

  const rid = existing?.regionId ?? regionId

  return (
    <div className="screen">
      <TopBar onBack={back} label={nameOf(rid)} />
      <div className="screen-scroll px-5 pb-6">
        <h1 className="t-name-lg m-0 mt-1">{existing ? t('trip.edit') : t('record.newTrip')}</h1>

        <section className="mt-6 grid gap-2">
          <h2 className="t-label m-0">{t('trip.period')}</h2>
          <div className="grid grid-cols-2 gap-2">
            <DateField label={t('trip.start')} value={startDate} required onChange={(v) => setStartDate(v || startDate)} />
            <DateField label={t('trip.end')} value={endDate} min={startDate} clearable onChange={setEndDate} />
          </div>
          {dateError && <p className="m-0 text-[13px]" role="alert">{dateError}</p>}
        </section>

        <section className="mt-7 grid gap-2">
          <h2 className="t-label m-0">{t('trip.stay')}</h2>
          <div className="grid grid-cols-4 gap-2" role="group">
            {LEVELS.map((l) => (
              <button key={l} className="level-btn" aria-pressed={level === l} onClick={() => setLevel(l)}>
                <LevelDot level={l} />
                <span className="max-w-full truncate">{t(`level.${l}`)}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-7 grid gap-2">
          <div className="flex items-baseline justify-between">
            <h2 className="t-label m-0">{t('record.photos')}</h2>
            <span className="text-[13px] t-dim" aria-live="polite">
              {slots.length} / 3
            </span>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void addFiles(e.target.files)} />
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((i) => {
              const slot = slots[i]
              return slot ? (
                <div key={slot.id} className="grid gap-1.5">
                  <div className="relative">
                    <SlotImage slot={slot} />
                    <button
                      className="icon-btn absolute -top-1 -right-1"
                      aria-label={t('trip.removePhoto')}
                      onClick={() => setSlots((s) => s.filter((x) => x.id !== slot.id))}
                    >
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--bg)] border border-[var(--line)]">
                        <X size={16} strokeWidth={1.5} />
                      </span>
                    </button>
                  </div>
                  <input
                    className="field !min-h-[40px] !px-2 !text-[13px]"
                    value={slot.caption}
                    maxLength={40}
                    placeholder={t('trip.caption')}
                    aria-label={t('trip.caption')}
                    onChange={(e) => setSlots((s) => s.map((x) => (x.id === slot.id ? { ...x, caption: e.target.value } : x)))}
                  />
                </div>
              ) : (
                <div key={`empty-${i}`} className="grid gap-1.5">
                  <button
                    className="thumb grid place-items-center t-dim"
                    style={{ aspectRatio: '3 / 4' }}
                    aria-label={t('trip.addPhoto')}
                    disabled={busy || i !== slots.length}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Plus size={22} strokeWidth={1.5} />
                  </button>
                </div>
              )
            })}
          </div>
          {error && <p className="m-0 text-[13px]" role="alert">{error}</p>}
        </section>

        <section className="mt-7 grid gap-2">
          <label className="t-label" htmlFor="trip-note">
            {t('trip.note')}
          </label>
          <input
            id="trip-note"
            className="field"
            value={note}
            maxLength={80}
            placeholder={t('trip.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
          />
        </section>

        {existing && (
          <button className="pill-btn destructive mt-8 w-full" onClick={() => void remove()}>
            {t('trip.delete')}
          </button>
        )}
      </div>

      <div className="bottom-bar">
        <button className="pill-btn" disabled={!canSave} style={{ opacity: canSave ? 1 : 0.5 }} onClick={() => void save()}>
          {t('common.save')}
        </button>
      </div>
    </div>
  )
}
