import { forwardRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useTaglineKey } from './Header'
import { MapView } from './MapView'
import type { Paint } from './MapView'
import { Thumb } from './ui'
import { formatNumber } from '../lib/format'
import { countryName, useRegionNamer } from '../lib/names'
import { computeLevels, sortTripsNewestFirst, tripsIn } from '../lib/regions'
import { useCountryShape, useLevelList, useLevelShapes, useWorldShapes } from '../maps/mapData'
import { getCountryMap } from '../maps/registry'
import { useResolvedMode } from '../theme/useTheme'
import { useStore } from '../store/useStore'
import type { Level, RegionId } from '../types'

export const POSTER_W = 1080
export const POSTER_H = 1350
const MAP_BOX_W = 560
const MAP_BOX_H = 640

/** WebKit drops the weight axis of a variable font inside the exported SVG image; pin it explicitly. */
const W = (n: number) => ({ fontWeight: n, fontVariationSettings: `'wght' ${n}` })

function Stat({ value, total, label, small }: { value: number; total?: number; label: string; small?: boolean }) {
  const locale = useStore((s) => s.settings.locale)
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontSize: small ? 84 : 112, ...W(200), letterSpacing: '-0.05em', lineHeight: 1, color: 'var(--num)' }}>
          {formatNumber(value, locale)}
        </span>
        {total !== undefined && (
          <span style={{ fontSize: 30, color: 'var(--dim)', ...W(400) }}>/ {formatNumber(total, locale)}</span>
        )}
      </div>
      <span className="t-label" style={{ fontSize: 22, ...W(600) }}>
        {label}
      </span>
    </div>
  )
}

/** Fixed 1080x1350 canvas. The parent scales it for preview; export renders it at full size. */
export const Poster = forwardRef<HTMLDivElement, { scale: number }>(function Poster({ scale }, ref) {
  const { t } = useTranslation()
  const { locale, homeCountry } = useStore((s) => s.settings)
  const regions = useStore((s) => s.regions)
  const trips = useStore((s) => s.trips)
  const mode = useResolvedMode()
  const taglineKey = useTaglineKey()
  const nameOf = useRegionNamer()
  const cfg = getCountryMap(homeCountry)

  const l1 = useLevelShapes(cfg, 0, { w: MAP_BOX_W, h: MAP_BOX_H })
  // counts for the finer levels (names/ids only, no projection work)
  const l2 = useLevelList(cfg && cfg.levels.length > 1 ? cfg : undefined, 1)
  const l3 = useLevelList(cfg && cfg.levels.length > 2 ? cfg : undefined, 2)
  const solo = useCountryShape(cfg ? undefined : homeCountry, MAP_BOX_W, MAP_BOX_H)
  const world = useWorldShapes()
  const mapState = cfg ? l1 : solo
  const theme = useStore((s) => s.settings.theme)
  // The export renders in an isolated document where CSS variables are gone, so hand the map literal colours.
  const paint = useMemo<Paint>(() => {
    const cs = getComputedStyle(document.documentElement)
    const v = (n: string) => cs.getPropertyValue(n).trim()
    return { land: v('--land'), edge: v('--edge'), light: v('--light'), filter: v('--map-filter'), opacity: [0, 1, 2, 3, 4].map((l) => Number(v(`--op-${l}`)) || 0) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, mode])

  const many = !!cfg && cfg.levels.length > 2 // 5 stats instead of 4: shrink the numbers a little
  const levelMap = useMemo(() => computeLevels(regions, trips), [regions, trips])
  const litIn = (ids: string[]) => ids.filter((id) => (levelMap[id] ?? 0) > 0).length
  const l1Ids = l1.status === 'ready' ? l1.shapes.map((s) => s.id) : []
  const l2Ids = l2.map((r) => r.id)
  const l3Ids = l3.map((r) => r.id)
  const worldIds = world.status === 'ready' ? world.shapes.map((s) => s.id) : []

  // Three photos, one per recently visited region (chosen cover first, else the latest trip's first photo).
  const photos = useMemo(() => {
    const ids = new Set<RegionId>([...trips.map((tr) => tr.regionId), ...Object.values(regions).filter((r) => r.coverPhotoIds?.length).map((r) => r.id)])
    const out: { photoId: string; regionId: RegionId; at: string }[] = []
    for (const id of ids) {
      const own = sortTripsNewestFirst(trips.filter((tr) => tr.regionId === id))
      const photoId = regions[id]?.coverPhotoIds?.[0] ?? own.find((tr) => tr.photos.length)?.photos[0].id
      if (photoId) out.push({ photoId, regionId: id, at: own[0]?.startDate ?? '' })
    }
    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3)
  }, [regions, trips])

  const tripCount = tripsIn(homeCountry, trips).length || trips.length
  const levels = levelMap as Record<RegionId, Level>

  return (
    <div
      ref={ref}
      style={{
        width: POSTER_W,
        height: POSTER_H,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        background: 'var(--bg)',
        color: 'var(--text)',
        padding: 72,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'SUIT Variable', system-ui, sans-serif",
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="t-label" style={{ fontSize: 22, ...W(600) }}>
          {t('poster.atlas')} · {new Date().getFullYear()}
        </span>
        <span className="t-label" style={{ fontSize: 22, ...W(600) }}>
          {t(`poster.edition.${mode}`)}
        </span>
      </div>

      <h2 style={{ margin: '28px 0 0', fontSize: 76, ...W(700), letterSpacing: '-0.03em', lineHeight: 1.1 }}>
        {t(`poster.title.${taglineKey}`)}
      </h2>

      <div style={{ display: 'flex', gap: 40, marginTop: 36, flex: 1, minHeight: 0 }}>
        <div style={{ width: MAP_BOX_W, height: MAP_BOX_H, flex: 'none' }}>
          {mapState.status === 'ready' && (
            <MapView w={MAP_BOX_W} h={MAP_BOX_H} shapes={mapState.shapes} frames={mapState.frames} levels={levels} locale={locale} className="poster-map" paint={paint} />
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flex: 1, minWidth: 0, paddingTop: 8 }}>
          {cfg ? (
            <>
              <Stat value={litIn(l1Ids)} total={l1Ids.length} label={cfg.levels[0].label[locale]} small={many} />
              {cfg.levels.length > 1 && <Stat value={litIn(l2Ids)} total={l2Ids.length} label={cfg.levels[1].label[locale]} small={many} />}
              {cfg.levels.length > 2 && <Stat value={litIn(l3Ids)} total={l3Ids.length} label={cfg.levels[2].label[locale]} small={many} />}
            </>
          ) : (
            <Stat value={(levelMap[homeCountry] ?? 0) > 0 ? 1 : 0} total={1} label={countryName(homeCountry, locale)} />
          )}
          <Stat value={litIn(worldIds)} total={worldIds.length} label={t('world.countries')} small={many} />
          <Stat value={tripCount} label={t('poster.trips')} small={many} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginTop: 36 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: 'grid', gap: 12 }}>
            <Thumb id={photos[i]?.photoId} ratio="4 / 3" />
            <span style={{ fontSize: 26, ...W(700), minHeight: 32, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {photos[i] ? nameOf(photos[i].regionId) : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
})
