import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export type Option = { value: string; label: string }

/**
 * Themed drop-down (the native <select> popup ignores our colours). Keyboard: ↑ ↓ Home End Enter Esc,
 * type-ahead on the first letters, click outside closes. Options are 44px tall for touch.
 */
export function Select({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: string
  options: Option[]
  onChange: (value: string) => void
  /** accessible name */
  label: string
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const id = useId()

  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value))
  const selected = options[selectedIndex]
  const optionId = (i: number) => `${id}-o${i}`

  const show = () => {
    setActive(selectedIndex)
    setOpen(true)
  }
  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) trigger.current?.focus()
  }
  const choose = (i: number) => {
    const o = options[i]
    if (o) onChange(o.value)
    close()
  }

  // outside click
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close(false)
    }
    document.addEventListener('pointerdown', down)
    return () => document.removeEventListener('pointerdown', down)
  }, [open])

  // focus the list when it opens, keep the active option in view
  useEffect(() => {
    if (open) list.current?.focus({ preventScroll: true })
  }, [open])
  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open])

  const labels = useMemo(() => options.map((o) => o.label.toLowerCase()), [options])

  const onListKey = (e: React.KeyboardEvent) => {
    const last = options.length - 1
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActive((a) => Math.min(last, a + 1))
        return
      case 'ArrowUp':
        e.preventDefault()
        setActive((a) => Math.max(0, a - 1))
        return
      case 'Home':
        e.preventDefault()
        setActive(0)
        return
      case 'End':
        e.preventDefault()
        setActive(last)
        return
      case 'PageDown':
        e.preventDefault()
        setActive((a) => Math.min(last, a + 7))
        return
      case 'PageUp':
        e.preventDefault()
        setActive((a) => Math.max(0, a - 7))
        return
      case 'Enter':
      case ' ':
        e.preventDefault()
        choose(active)
        return
      case 'Escape':
        e.preventDefault()
        e.stopPropagation()
        close()
        return
      case 'Tab':
        close(false)
        return
    }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      const now = Date.now()
      typed.current = { text: (now - typed.current.at > 700 ? '' : typed.current.text) + e.key.toLowerCase(), at: now }
      const from = typed.current.text.length === 1 ? active + 1 : active
      const i = [...labels.slice(from), ...labels.slice(0, from)].findIndex((l) => l.startsWith(typed.current.text))
      if (i >= 0) setActive((from + i) % labels.length)
    }
  }

  return (
    <div ref={root} className={`select ${className ?? ''}`}>
      <button
        ref={trigger}
        type="button"
        className="field select-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => (open ? close(false) : show())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            show()
          }
        }}
      >
        <span className="min-w-0 truncate">{selected?.label}</span>
        <ChevronDown size={18} strokeWidth={1.5} className={`flex-none t-dim transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>
      {open && (
        <ul
          ref={list}
          className="select-pop"
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={optionId(active)}
          onKeyDown={onListKey}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={optionId(i)}
              role="option"
              aria-selected={o.value === value}
              data-active={i === active}
              className="select-opt"
              onPointerMove={() => i !== active && setActive(i)}
              onClick={() => choose(i)}
            >
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.value === value && <Check size={16} strokeWidth={1.5} className="flex-none" aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
