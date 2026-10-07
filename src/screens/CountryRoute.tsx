import { useTranslation } from 'react-i18next'
import { CountryPicker } from '../components/CountryPicker'
import { TopBar } from '../components/ui'
import { useNav } from '../store/useNav'
import { useStore } from '../store/useStore'

/** Settings → choose the default map country (same picker as onboarding step 2). */
export function CountryRoute() {
  const { t } = useTranslation()
  const back = useNav((s) => s.back)
  const home = useStore((s) => s.settings.homeCountry)
  const setSettings = useStore((s) => s.setSettings)
  return (
    <div className="screen">
      <TopBar onBack={back} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 px-5 pb-2">
        <div>
          <h1 className="t-name-lg m-0 mt-1">{t('country.title')}</h1>
          <p className="m-0 mt-2 text-[14px] t-dim">{t('settings.recordsStay')}</p>
        </div>
        <CountryPicker
          selected={home}
          onPick={(iso3) => {
            setSettings({ homeCountry: iso3 })
            back()
          }}
        />
      </div>
    </div>
  )
}
