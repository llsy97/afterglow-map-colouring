export type Level = 0 | 1 | 2 | 3 | 4
export type TripLevel = 1 | 2 | 3 | 4

/** 'KOR:11' (province), 'KOR:11010' (district), 'JPN' (country) */
export type RegionId = string

export type Region = {
  id: RegionId
  quickLevel: Level
  coverPhotoIds?: string[]
  /** last time the quick level changed; used to order "recently lit" */
  updatedAt?: number
}

export type Trip = {
  id: string
  regionId: RegionId
  startDate: string
  endDate?: string
  level: TripLevel
  photos: { id: string; caption: string }[]
  note?: string
  createdAt: number
}

export type Locale = 'ko' | 'en'
export type ThemeName = 'moonlight' | 'champagne' | 'electric'
export type ModeSetting = 'auto' | 'day' | 'night'
export type ResolvedMode = 'day' | 'night'

export type Settings = {
  locale: Locale
  homeCountry: string
  theme: ThemeName
  mode: ModeSetting
}
