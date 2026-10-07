import { useTranslation } from 'react-i18next'
import { useStore } from '../store/useStore'
import type { ModeSetting, ThemeName } from '../types'

const THEMES: ThemeName[] = ['moonlight', 'champagne', 'electric']
const MODES: ModeSetting[] = ['auto', 'day', 'night']

export function Segmented<T extends string>(props: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2" role="group">
      {props.options.map((o) => (
        <button key={o.id} className="chip" aria-pressed={props.value === o.id} onClick={() => props.onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Three theme cards (applied instantly = live preview) + day/night setting. Shared by onboarding and settings. */
export function ThemePicker() {
  const { t } = useTranslation()
  const { theme, mode } = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  return (
    <>
      <section className="grid gap-3">
        <p className="m-0 text-[15px] font-semibold">{t('theme.title')}</p>
        <div className="grid gap-2">
          {THEMES.map((id) => (
            <button
              key={id}
              aria-pressed={theme === id}
              onClick={() => setSettings({ theme: id })}
              className="theme-card card flex min-h-[64px] items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="grid min-w-0 gap-0.5">
                <span className="t-name">{t(`theme.${id}`)}</span>
                <span className="truncate text-[13px] t-dim">{t(`theme.${id}Desc`)}</span>
              </span>
              <span className="theme-swatches" aria-hidden="true">
                <span className="swatch" data-theme={id} data-mode="night" />
                <span className="swatch" data-theme={id} data-mode="day" />
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="mt-6 grid gap-3">
        <h2 className="t-label m-0">{t('settings.mode')}</h2>
        <Segmented value={mode} options={MODES.map((id) => ({ id, label: t(`mode.${id}`) }))} onChange={(m) => setSettings({ mode: m })} />
      </section>
    </>
  )
}
