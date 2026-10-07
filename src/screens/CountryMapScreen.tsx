import { TopBar } from '../components/ui'
import { countryName } from '../lib/names'
import { useNav } from '../store/useNav'
import { useStore } from '../store/useStore'
import { CountryMap } from './MapScreen'

/** Another country's map, to pick states / cities precisely before recording. */
export function CountryMapScreen({ iso3, level, scope }: { iso3: string; level?: number; scope?: string }) {
  const back = useNav((s) => s.back)
  const locale = useStore((s) => s.settings.locale)
  return (
    <div className="screen">
      <TopBar onBack={back} label={countryName(iso3, locale)} />
      <div className="flex min-h-0 flex-1 flex-col">
        <CountryMap key={iso3} iso3={iso3} embedded initialLevel={level} initialScope={scope} />
      </div>
    </div>
  )
}
