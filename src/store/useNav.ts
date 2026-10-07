import { create } from 'zustand'
import type { RegionId } from '../types'
import type { Tab } from '../components/TabBar'

export type Route =
  | { t: 'region'; id: RegionId }
  | { t: 'trip'; regionId: RegionId; tripId?: string }
  | { t: 'cover'; regionId: RegionId }
  | { t: 'poster' }
  | { t: 'country' }
  /** a country's own map, opened from the World tab (optionally at a level / narrowed to one region) */
  | { t: 'countrymap'; iso3: string; level?: number; scope?: string }

type Nav = {
  tab: Tab
  stack: Route[]
  setTab: (t: Tab) => void
  push: (r: Route) => void
  back: () => void
}

/** The stack mirrors browser history so the system back button / swipe works. */
export const useNav = create<Nav>((set, get) => ({
  tab: 'map',
  stack: [],
  setTab: (tab) => set({ tab, stack: [] }),
  push: (r) => {
    const stack = [...get().stack, r]
    window.history.pushState({ depth: stack.length }, '')
    set({ stack })
  },
  back: () => {
    if (get().stack.length) window.history.back()
  },
}))

window.addEventListener('popstate', (e) => {
  const depth: number = e.state?.depth ?? 0
  const { stack } = useNav.getState()
  if (depth < stack.length) useNav.setState({ stack: stack.slice(0, depth) })
})
