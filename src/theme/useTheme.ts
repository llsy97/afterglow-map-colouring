import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import type { ModeSetting, ResolvedMode } from '../types'

const META_COLOR: Record<ResolvedMode, Record<string, string>> = {
  night: { moonlight: '#0b0b0d', champagne: '#0f0e0c', electric: '#08090a' },
  day: { moonlight: '#f7f7f5', champagne: '#f3efe8', electric: '#f2f3ef' },
}

/** 18:00–06:00 is night. */
export function resolveMode(mode: ModeSetting, now = new Date()): ResolvedMode {
  if (mode !== 'auto') return mode
  const h = now.getHours()
  return h >= 18 || h < 6 ? 'night' : 'day'
}

export function useResolvedMode(): ResolvedMode {
  const mode = useStore((s) => s.settings.mode)
  const [resolved, setResolved] = useState(() => resolveMode(mode))
  useEffect(() => {
    setResolved(resolveMode(mode))
    if (mode !== 'auto') return
    const id = setInterval(() => setResolved(resolveMode('auto')), 60_000)
    return () => clearInterval(id)
  }, [mode])
  return resolved
}

/** Applies data-theme / data-mode / lang to <html>. Call once at the app root. */
export function useApplyTheme() {
  const theme = useStore((s) => s.settings.theme)
  const locale = useStore((s) => s.settings.locale)
  const mode = useResolvedMode()
  useEffect(() => {
    const el = document.documentElement
    el.dataset.theme = theme
    el.dataset.mode = mode
    el.lang = locale
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLOR[mode][theme])
  }, [theme, mode, locale])
}
