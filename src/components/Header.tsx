import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../store/useStore'
import { useResolvedMode } from '../theme/useTheme'

export function useTaglineKey() {
  const theme = useStore((s) => s.settings.theme)
  const mode = useResolvedMode()
  if (mode === 'night') return 'night'
  return theme === 'moonlight' ? 'dayMoonlight' : 'day'
}

export function ModeToggle() {
  const { t } = useTranslation()
  const mode = useResolvedMode()
  const setSettings = useStore((s) => s.setSettings)
  const seg = (m: 'day' | 'night') => ({
    'aria-pressed': mode === m,
    'aria-label': t(m === 'day' ? 'mode.toggleDay' : 'mode.toggleNight'),
    onClick: () => setSettings({ mode: m }),
    className: 'mode-seg',
  })
  return (
    <div className="mode-toggle" role="group">
      <button {...seg('day')}>
        <Sun size={18} strokeWidth={1.5} />
      </button>
      <button {...seg('night')}>
        <Moon size={18} strokeWidth={1.5} />
      </button>
    </div>
  )
}

export function Header() {
  const { t } = useTranslation()
  const key = useTaglineKey()
  return (
    <header className="flex items-center justify-between gap-3 px-5 pt-[max(12px,env(safe-area-inset-top))]">
      <p className="m-0 text-[13px] t-dim">{t(`tagline.${key}`)}</p>
      <ModeToggle />
    </header>
  )
}
