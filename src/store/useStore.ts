import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { detectLocale } from '../i18n'
import { isWithin } from '../lib/regions'
import type { Level, Region, RegionId, Settings, Trip } from '../types'

export type PersistedData = {
  settings: Settings
  onboarded: boolean
  regions: Record<RegionId, Region>
  trips: Trip[]
}

type State = PersistedData & {
  setSettings: (patch: Partial<Settings>) => void
  completeOnboarding: () => void
  setQuickLevel: (id: RegionId, level: Level) => void
  setCoverPhotos: (id: RegionId, photoIds: string[]) => void
  saveTrip: (trip: Trip) => void
  deleteTrip: (tripId: string) => void
  /** Erase quick level, covers and trips of a region (and optionally everything below it). Returns the photo ids that became orphans. */
  clearRegionRecords: (id: RegionId, withChildren: boolean) => string[]
  replaceAll: (data: PersistedData) => void
}

/** Drop region records that carry no information any more. */
function tidy(regions: Record<RegionId, Region>, id: RegionId) {
  const r = regions[id]
  if (r && r.quickLevel === 0 && !r.coverPhotoIds?.length) delete regions[id]
}

export const useStore = create<State>()(
  persist(
    (set) => ({
      settings: {
        locale: detectLocale(),
        homeCountry: 'KOR',
        theme: 'moonlight',
        mode: 'auto',
      },
      onboarded: false,
      regions: {},
      trips: [],
      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      completeOnboarding: () => set({ onboarded: true }),
      setQuickLevel: (id, level) =>
        set((s) => {
          const regions = { ...s.regions, [id]: { ...s.regions[id], id, quickLevel: level, updatedAt: Date.now() } }
          tidy(regions, id)
          return { regions }
        }),
      setCoverPhotos: (id, photoIds) =>
        set((s) => {
          const prev = s.regions[id]
          const regions = {
            ...s.regions,
            [id]: { id, quickLevel: prev?.quickLevel ?? 0, updatedAt: prev?.updatedAt, coverPhotoIds: photoIds.slice(0, 3) },
          }
          tidy(regions, id)
          return { regions }
        }),
      saveTrip: (trip) =>
        set((s) => {
          const i = s.trips.findIndex((t) => t.id === trip.id)
          const trips = [...s.trips]
          if (i >= 0) trips[i] = trip
          else trips.push(trip)
          return { trips }
        }),
      clearRegionRecords: (id, withChildren) => {
        const hit = (rid: RegionId) => (withChildren ? isWithin(rid, id) : rid === id)
        let photoIds: string[] = []
        set((s) => {
          const gone = s.trips.filter((t) => hit(t.regionId))
          photoIds = gone.flatMap((t) => t.photos.map((p) => p.id))
          const regions = { ...s.regions }
          for (const rid of Object.keys(regions)) if (hit(rid)) delete regions[rid]
          return { trips: s.trips.filter((t) => !hit(t.regionId)), regions }
        })
        return photoIds
      },
      deleteTrip: (tripId) =>
        set((s) => {
          const gone = s.trips.find((t) => t.id === tripId)
          const trips = s.trips.filter((t) => t.id !== tripId)
          if (!gone) return {}
          // a deleted trip's photos can no longer be a cover
          const removed = new Set(gone.photos.map((p) => p.id))
          const regions = { ...s.regions }
          const r = regions[gone.regionId]
          if (r?.coverPhotoIds) {
            regions[gone.regionId] = { ...r, coverPhotoIds: r.coverPhotoIds.filter((p) => !removed.has(p)) }
            tidy(regions, gone.regionId)
          }
          return { trips, regions }
        }),
      replaceAll: (data) => set({ ...data }),
    }),
    {
      name: 'tlm:v1',
      version: 1,
      partialize: (s): PersistedData => ({
        settings: s.settings,
        onboarded: s.onboarded,
        regions: s.regions,
        trips: s.trips,
      }),
      // data saved by stage 1 had no `onboarded` flag: treat as not onboarded -> shown once
    },
  ),
)
