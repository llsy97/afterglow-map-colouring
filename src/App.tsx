import { Header } from './components/Header'
import { TabBar } from './components/TabBar'
import { AlbumScreen } from './screens/AlbumScreen'
import { CountryMapScreen } from './screens/CountryMapScreen'
import { CountryRoute } from './screens/CountryRoute'
import { CoverPicker } from './screens/CoverPicker'
import { MapScreen } from './screens/MapScreen'
import { Onboarding } from './screens/Onboarding'
import { PosterScreen } from './screens/PosterScreen'
import { RegionDetail } from './screens/RegionDetail'
import { SettingsScreen } from './screens/SettingsScreen'
import { TripEdit } from './screens/TripEdit'
import { WorldScreen } from './screens/WorldScreen'
import { useNav } from './store/useNav'
import type { Route } from './store/useNav'
import { useStore } from './store/useStore'
import { useApplyTheme } from './theme/useTheme'

function Overlay({ route }: { route: Route }) {
  switch (route.t) {
    case 'region':
      return <RegionDetail key={route.id} id={route.id} />
    case 'trip':
      return <TripEdit key={route.tripId ?? 'new'} regionId={route.regionId} tripId={route.tripId} />
    case 'cover':
      return <CoverPicker regionId={route.regionId} />
    case 'poster':
      return <PosterScreen />
    case 'country':
      return <CountryRoute />
    case 'countrymap':
      return <CountryMapScreen iso3={route.iso3} level={route.level} scope={route.scope} />
  }
}

export default function App() {
  const onboarded = useStore((s) => s.onboarded)
  const { tab, stack, setTab, back } = useNav()
  useApplyTheme()

  const top = stack[stack.length - 1]
  return (
    <div className="app">
      {/* Tabs stay mounted under overlays so map selection / zoom survive.
          Phones: the overlay is a full screen. Desktop: it is a side drawer over the still-visible app. */}
      <div className={`app-col${top ? ' max-lg:hidden' : ''}`} inert={!!top}>
        <Header />
        <main className="app-main">
          {tab === 'map' && <MapScreen />}
          {tab === 'world' && <WorldScreen />}
          {tab === 'album' && <AlbumScreen />}
          {tab === 'settings' && <SettingsScreen />}
        </main>
      </div>
      <div className={top ? 'contents max-lg:hidden' : 'contents'} inert={!!top}>
        <TabBar tab={tab} onChange={setTab} />
      </div>
      {top && <div className="drawer-backdrop" onClick={back} aria-hidden="true" />}
      {top && <Overlay key={stack.length} route={top} />}
      {!onboarded && <Onboarding />}
    </div>
  )
}
