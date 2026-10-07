import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CountryPicker } from '../components/CountryPicker'
import { Segmented, ThemePicker } from '../components/ThemePicker'
import { deviceCountry } from '../lib/countries'
import { loadWorld } from '../maps/mapData'
import { useStore } from '../store/useStore'
import type { Locale } from '../types'

const LOCALES: { id: Locale; label: string }[] = [
  { id: 'ko', label: '한국어' },
  { id: 'en', label: 'English' },
]

/** First run only: language → default country → theme. */
export function Onboarding() {
  const { t } = useTranslation()
  const { locale, homeCountry } = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const complete = useStore((s) => s.completeOnboarding)
  const [step, setStep] = useState(0)

  // Pre-select the country of the device's region setting (when we have its outline).
  useEffect(() => {
    const guess = deviceCountry()
    if (!guess) return
    void loadWorld().then((w) => {
      if (w.some((f) => f.iso3 === guess)) setSettings({ homeCountry: guess })
    })
  }, [setSettings])

  const last = step === 2
  return (
    <>
    <div className="modal-bg" aria-hidden="true" />
    <div className="screen onboard">
      <div
        className="flex items-center justify-center gap-2 pt-[max(20px,env(safe-area-inset-top))]"
        role="img"
        aria-label={`${step + 1} / 3`}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 rounded-full transition-all"
            style={{ width: i === step ? 24 : 8, background: i <= step ? 'var(--light)' : 'var(--line)' }}
          />
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col px-5 pt-6">
        <h1 className="t-name-lg m-0">
          {step === 0 && t('onboarding.language')}
          {step === 1 && t('country.title')}
          {step === 2 && t('theme.title')}
        </h1>

        {step === 0 && (
          <div className="mt-6 grid gap-3">
            <Segmented value={locale} options={LOCALES} onChange={(l) => setSettings({ locale: l })} />
          </div>
        )}
        {step === 1 && (
          <div className="mt-4 flex min-h-0 flex-1 flex-col">
            <CountryPicker selected={homeCountry} onPick={(iso3) => setSettings({ homeCountry: iso3 })} />
          </div>
        )}
        {step === 2 && (
          <div className="mt-5 min-h-0 flex-1 overflow-y-auto pb-4">
            <ThemePicker />
          </div>
        )}
      </div>

      <div className="bottom-bar">
        {step > 0 && (
          <button className="pill-btn ghost !flex-none" onClick={() => setStep(step - 1)}>
            {t('common.back')}
          </button>
        )}
        <button className="pill-btn" onClick={() => (last ? complete() : setStep(step + 1))}>
          {last ? t('onboarding.start') : t('common.next')}
        </button>
      </div>
    </div>
    </>
  )
}
