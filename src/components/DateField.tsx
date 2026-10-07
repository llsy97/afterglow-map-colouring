import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatDate, todayIso } from '../lib/format'
import { useStore } from '../store/useStore'

const pad = (n: number) => String(n).padStart(2, '0')
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}` // m is 0-based
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return { y, m: m - 1, d }
}
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate()

type View = 'days' | 'months' | 'years'

type Props = {
  label: string
  value: string
  onChange: (iso: string) => void
  min?: string
  /** optional fields can be cleared */
  clearable?: boolean
  required?: boolean
}

/** A themed replacement for <input type="date">: formatted value + calendar sheet. */
export function DateField({ label, value, onChange, min, clearable, required }: Props) {
  const { t } = useTranslation()
  const locale = useStore((s) => s.settings.locale)
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const labelId = useId()

  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }

  return (
    <div className="grid gap-1">
      <span className="text-[12px] t-dim" id={labelId}>
        {label}
      </span>
      <div className="relative">
        <button
          ref={trigger}
          type="button"
          className="field date-trigger"
          aria-haspopup="dialog"
          aria-labelledby={labelId}
          aria-required={required}
          onClick={() => setOpen(true)}
        >
          <span className={value ? '' : 't-dim'}>{value ? formatDate(value, locale) : t('date.notSet')}</span>
          <CalendarDays size={18} strokeWidth={1.5} className="flex-none t-dim" aria-hidden="true" />
        </button>
        {clearable && value && (
          <button type="button" className="date-clear" aria-label={t('date.clear')} onClick={() => onChange('')}>
            <X size={16} strokeWidth={1.5} />
          </button>
        )}
      </div>
      {open &&
        createPortal(
          <CalendarSheet
            title={label}
            value={value}
            min={min}
            clearable={clearable}
            onPick={(v) => {
              onChange(v)
              close()
            }}
            onClose={close}
          />,
          document.body,
        )}
    </div>
  )
}

function CalendarSheet(p: {
  title: string
  value: string
  min?: string
  clearable?: boolean
  onPick: (iso: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const locale = useStore((s) => s.settings.locale)
  const lc = locale === 'ko' ? 'ko-KR' : 'en-US'
  const today = todayIso()
  const start = parse(p.value || (p.min && p.min > today ? p.min : today))
  const [view, setView] = useState<View>('days')
  const [ym, setYm] = useState({ y: start.y, m: start.m })
  const [focus, setFocus] = useState(p.value || (p.min && p.min > today ? p.min : today))
  const panel = useRef<HTMLDivElement>(null)
  const yearsRef = useRef<HTMLDivElement>(null)

  const monthTitle = useMemo(
    () => new Intl.DateTimeFormat(lc, { year: 'numeric', month: 'long' }).format(new Date(ym.y, ym.m, 1)),
    [lc, ym],
  )
  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(lc, { weekday: 'short' })
    return [0, 1, 2, 3, 4, 5, 6].map((i) => f.format(new Date(2023, 0, 1 + i))) // 2023-01-01 is a Sunday
  }, [lc])
  const monthNames = useMemo(() => {
    const f = new Intl.DateTimeFormat(lc, { month: 'short' })
    return Array.from({ length: 12 }, (_, i) => f.format(new Date(2000, i, 1)))
  }, [lc])

  // keyboard: Esc closes, Tab stays inside the dialog
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        p.onClose()
      }
      if (e.key === 'Tab' && panel.current) {
        const els = [...panel.current.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]')]
        if (!els.length) return
        const first = els[0]
        const last = els[els.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      document.body.style.overflow = prevOverflow
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // put focus on the day we are on
  useEffect(() => {
    if (view !== 'days') return
    panel.current?.querySelector<HTMLElement>('[data-focus="true"]')?.focus()
  }, [focus, view, ym])

  useEffect(() => {
    if (view === 'years') yearsRef.current?.querySelector<HTMLElement>('[aria-current="true"]')?.scrollIntoView({ block: 'center' })
  }, [view])

  const shiftMonth = (delta: number) => {
    const d = new Date(ym.y, ym.m + delta, 1)
    setYm({ y: d.getFullYear(), m: d.getMonth() })
  }

  const moveFocus = (days: number) => {
    const { y, m, d } = parse(focus)
    const next = new Date(y, m, d + days)
    const nextIso = iso(next.getFullYear(), next.getMonth(), next.getDate())
    if (p.min && nextIso < p.min) return
    setFocus(nextIso)
    setYm({ y: next.getFullYear(), m: next.getMonth() })
  }

  const onGridKey = (e: React.KeyboardEvent) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (e.key in step) {
      e.preventDefault()
      moveFocus(step[e.key])
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault()
      shiftMonth(e.key === 'PageUp' ? -1 : 1)
      const { y, m, d } = parse(focus)
      const target = new Date(y, m + (e.key === 'PageUp' ? -1 : 1), 1)
      const day = Math.min(d, daysIn(target.getFullYear(), target.getMonth()))
      setFocus(iso(target.getFullYear(), target.getMonth(), day))
    }
  }

  const firstDow = new Date(ym.y, ym.m, 1).getDay()
  const cells: (number | null)[] = [...Array(firstDow).fill(null), ...Array.from({ length: daysIn(ym.y, ym.m) }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)

  const thisYear = new Date().getFullYear()
  const years = Array.from({ length: thisYear + 5 - 1950 + 1 }, (_, i) => thisYear + 5 - i)

  return (
    <div className="dp-backdrop" onMouseDown={(e) => e.target === e.currentTarget && p.onClose()}>
      <div ref={panel} className="dp-panel" role="dialog" aria-modal="true" aria-label={p.title}>
        <div className="flex items-center gap-1">
          {view === 'days' && (
            <button type="button" className="icon-btn" aria-label={t('date.prevMonth')} onClick={() => shiftMonth(-1)}>
              <ChevronLeft size={22} strokeWidth={1.5} />
            </button>
          )}
          {view === 'months' && (
            <button type="button" className="icon-btn" aria-label={t('date.prevYear')} onClick={() => setYm({ ...ym, y: ym.y - 1 })}>
              <ChevronLeft size={22} strokeWidth={1.5} />
            </button>
          )}
          {view === 'years' && <span className="icon-btn" aria-hidden="true" />}
          <button
            type="button"
            className="dp-title"
            aria-live="polite"
            onClick={() => setView(view === 'days' ? 'months' : view === 'months' ? 'years' : 'days')}
          >
            {view === 'days' && monthTitle}
            {view === 'months' && new Intl.DateTimeFormat(lc, { year: 'numeric' }).format(new Date(ym.y, 0, 1))}
            {view === 'years' && t('date.pickYear')}
          </button>
          {view === 'days' && (
            <button type="button" className="icon-btn" aria-label={t('date.nextMonth')} onClick={() => shiftMonth(1)}>
              <ChevronRight size={22} strokeWidth={1.5} />
            </button>
          )}
          {view === 'months' && (
            <button type="button" className="icon-btn" aria-label={t('date.nextYear')} onClick={() => setYm({ ...ym, y: ym.y + 1 })}>
              <ChevronRight size={22} strokeWidth={1.5} />
            </button>
          )}
          {view === 'years' && <span className="icon-btn" aria-hidden="true" />}
        </div>

        {view === 'days' && (
          <div role="grid" aria-label={monthTitle} onKeyDown={onGridKey}>
            <div className="dp-grid" role="row">
              {weekdays.map((w, i) => (
                <span key={i} className="dp-dow t-label" role="columnheader">
                  {w}
                </span>
              ))}
            </div>
            <div className="dp-grid">
              {cells.map((d, i) => {
                if (d === null) return <span key={i} />
                const v = iso(ym.y, ym.m, d)
                const disabled = !!p.min && v < p.min
                const selected = v === p.value
                const isToday = v === today
                return (
                  <button
                    key={i}
                    type="button"
                    role="gridcell"
                    className="dp-day"
                    data-focus={v === focus}
                    tabIndex={v === focus ? 0 : -1}
                    aria-selected={selected}
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={formatDate(v, locale)}
                    disabled={disabled}
                    onClick={() => p.onPick(v)}
                  >
                    {d}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {view === 'months' && (
          <div className="dp-months">
            {monthNames.map((n, i) => (
              <button
                key={i}
                type="button"
                className="dp-cell"
                aria-pressed={ym.m === i}
                onClick={() => {
                  setYm({ ...ym, m: i })
                  setFocus(iso(ym.y, i, Math.min(parse(focus).d, daysIn(ym.y, i))))
                  setView('days')
                }}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        {view === 'years' && (
          <div ref={yearsRef} className="dp-years">
            {years.map((y) => (
              <button
                key={y}
                type="button"
                className="dp-cell"
                aria-pressed={ym.y === y}
                aria-current={ym.y === y ? 'true' : undefined}
                onClick={() => {
                  setYm({ ...ym, y })
                  setView('months')
                }}
              >
                {y}
              </button>
            ))}
          </div>
        )}

        <div className="dp-footer">
          <button type="button" className="pill-btn ghost !min-h-[44px]" disabled={!!p.min && today < p.min} onClick={() => p.onPick(today)}>
            {t('date.today')}
          </button>
          {p.clearable && (
            <button type="button" className="pill-btn ghost !min-h-[44px]" onClick={() => p.onPick('')}>
              {t('date.clear')}
            </button>
          )}
          <button type="button" className="pill-btn !min-h-[44px] ml-auto" onClick={p.onClose}>
            {t('date.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
