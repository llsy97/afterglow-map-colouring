import { useRef, useState } from 'react'
import { ChevronRight, Download, Upload } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Segmented, ThemePicker } from '../components/ThemePicker'
import { exportBackup, importBackup } from '../lib/backup'
import { countryName } from '../lib/names'
import { useNav } from '../store/useNav'
import { useStore } from '../store/useStore'
import type { Locale } from '../types'

const LOCALES: { id: Locale; label: string }[] = [
  { id: 'ko', label: '한국어' },
  { id: 'en', label: 'English' },
]

export function SettingsScreen() {
  const { t } = useTranslation()
  const { locale, homeCountry } = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const push = useNav((s) => s.push)
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string>()

  async function run(job: () => Promise<void>, ok: string, fail: string) {
    setMessage(t('settings.working'))
    try {
      await job()
      setMessage(ok)
    } catch {
      setMessage(fail)
    }
  }

  return (
    <div className="page-scroll"><div className="page-narrow">
      <h1 className="t-name-lg m-0">{t('settings.title')}</h1>

      <section className="mt-6 grid gap-3">
        <h2 className="t-label m-0">{t('settings.language')}</h2>
        <Segmented value={locale} options={LOCALES} onChange={(l) => setSettings({ locale: l })} />
      </section>

      <section className="mt-8 grid gap-2">
        <h2 className="t-label m-0">{t('settings.homeCountry')}</h2>
        <button className="row-btn" onClick={() => push({ t: 'country' })}>
          <span className="grid min-w-0 flex-1 gap-0.5">
            <span className="t-name truncate">{countryName(homeCountry, locale)}</span>
            <span className="text-[12px] t-dim">{t('settings.recordsStay')}</span>
          </span>
          <ChevronRight size={20} strokeWidth={1.5} className="flex-none t-dim" />
        </button>
      </section>

      <section className="mt-8 grid gap-0">
        <h2 className="t-label m-0 mb-3">{t('settings.theme')}</h2>
        <ThemePicker />
      </section>

      <section className="mt-8 grid gap-3">
        <h2 className="t-label m-0">{t('settings.data')}</h2>
        <div className="flex flex-wrap gap-2">
          <button className="pill-btn ghost" onClick={() => void run(exportBackup, t('settings.exported'), t('settings.exportError'))}>
            <Download size={16} strokeWidth={1.5} />
            {t('settings.export')}
          </button>
          <button className="pill-btn ghost" onClick={() => fileRef.current?.click()}>
            <Upload size={16} strokeWidth={1.5} />
            {t('settings.import')}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (!file || !window.confirm(t('settings.importConfirm'))) return
              void run(() => importBackup(file), t('settings.imported'), t('settings.importError'))
            }}
          />
        </div>
        <p className="m-0 text-[13px] t-dim" role="status" aria-live="polite">
          {message ?? t('settings.dataNote')}
        </p>
      </section>

      <section className="mt-8 grid gap-2">
        <h2 className="t-label m-0">{t('settings.credits')}</h2>
        <p className="m-0 text-[13px] leading-relaxed t-dim">{t('settings.creditsText')}</p>
      </section>
    </div></div>
  )
}
