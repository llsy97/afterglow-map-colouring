import { memo, useCallback, useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { Minus, Plus, RotateCcw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useZoomPan } from './useZoomPan'
import { MAP_H, MAP_W, regionName } from '../maps/mapData'
import type { Frame, RegionShape } from '../maps/mapData'
import type { Level, Locale, RegionId } from '../types'

/** Literal colours, for rendering where CSS variables do not resolve (poster export). */
export type Paint = { land: string; edge: string; light: string; filter: string; opacity: number[] }

type Props = {
  paint?: Paint
  /** viewBox size; must match the size the shapes were projected for */
  w?: number
  h?: number
  shapes: RegionShape[]
  /** inset boxes for far-flung territories */
  frames?: Frame[]
  levels: Record<RegionId, Level>
  selectedId?: RegionId
  locale: Locale
  levelLabel?: (l: Level) => string
  /** omit for a static, non-interactive map */
  onSelect?: (id: RegionId) => void
  className?: string
  /** wheel / pinch / drag zoom plus +/- buttons */
  zoomable?: boolean
  maxZoom?: number
}

// Paths are memoized per region, so a tap re-renders one <path>, not hundreds.
const BasePath = memo(function BasePath({ d, paint }: { d: string; paint?: Paint }) {
  return <path d={d} style={paint && { fill: paint.land, stroke: paint.edge, strokeWidth: 0.35 }} />
})

const LightPath = memo(function LightPath({ d, level, paint }: { d: string; level: Level; paint?: Paint }) {
  const opacity = level ? (paint ? paint.opacity[level] : `var(--op-${level})`) : 0
  return <path d={d} style={{ fillOpacity: opacity, ...(paint && { fill: paint.light, stroke: 'none' }) }} />
})

const HitPath = memo(function HitPath(p: {
  id: RegionId
  d: string
  name: string
  label: string
  selected: boolean
  tiny: boolean
  onSelect: (id: RegionId) => void
}) {
  const onKeyDown = (e: KeyboardEvent<SVGPathElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      p.onSelect(p.id)
    }
  }
  return (
    <path
      d={p.d}
      tabIndex={0}
      role="button"
      aria-label={`${p.name}, ${p.label}`}
      className={[p.selected && 'selected', p.tiny && 'tiny'].filter(Boolean).join(' ') || undefined}
      onClick={() => p.onSelect(p.id)}
      onKeyDown={onKeyDown}
    >
      <title>{p.name}</title>
    </path>
  )
})

export function MapView({
  zoomable,
  maxZoom = 10,
  paint,
  frames,
  w = MAP_W,
  h = MAP_H,
  shapes,
  levels,
  selectedId,
  locale,
  levelLabel,
  onSelect,
  className,
}: Props) {
  const { t } = useTranslation()
  const select = useCallback((id: RegionId) => onSelect?.(id), [onSelect])
  const svgRef = useRef<SVGSVGElement>(null)
  const gRef = useRef<SVGGElement>(null)
  const zoom = useZoomPan(svgRef, gRef, { w, h, max: maxZoom, enabled: !!zoomable })
  const resetZoom = zoom.reset
  useEffect(() => resetZoom(), [shapes, resetZoom])

  const svg = (
    <svg
      ref={svgRef}
      className={className ?? 'map-svg'}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ overflow: zoomable ? 'hidden' : 'visible' }}
    >
      <g ref={gRef}>
        {frames?.map((f, i) => (
          <rect key={i} className="map-frame" x={f.x} y={f.y} width={f.w} height={f.h} rx={8} aria-hidden="true" />
        ))}
        {/* 1) base: every region in land colour with a 0.35px edge */}
        <g className="map-base" aria-hidden="true">
          {shapes.map((s) => (
            <BasePath key={s.id} d={s.d} paint={paint} />
          ))}
        </g>
        {/* 2) light: lit regions only visible (level 0 = opacity 0); glow filter on the whole layer */}
        <g className="map-light" aria-hidden="true" style={paint && { filter: paint.filter }}>
          {shapes
            // thousands of districts: only draw the lit ones (a fade-in is not worth thousands of extra nodes)
            .filter((s) => shapes.length <= 800 || (levels[s.id] ?? 0) > 0)
            .map((s) => (
              <LightPath key={s.id} d={s.d} level={levels[s.id] ?? 0} paint={paint} />
            ))}
        </g>
        {!onSelect && selectedId && (
          <g className="map-outline" aria-hidden="true">
            {shapes.filter((s) => s.id === selectedId).map((s) => (
              <path key={s.id} d={s.d} />
            ))}
          </g>
        )}
        {/* 3) hit layer: transparent, focusable, carries the accessible name */}
        {onSelect && (
        <g className="map-hit">
          {shapes.map((s) => (
            <HitPath
              key={s.id}
              id={s.id}
              d={s.d}
              name={regionName(s.names, locale)}
              label={levelLabel?.(levels[s.id] ?? 0) ?? ''}
              selected={s.id === selectedId}
              tiny={s.area < 80}
              onSelect={select}
            />
          ))}
        </g>
        )}
      </g>
    </svg>
  )
  if (!zoomable) return svg
  return (
    <div className="relative h-full w-full overflow-hidden rounded-[18px]">
      {svg}
      <div className="zoom-controls">
        <button className="zoom-btn" aria-label={t('map.zoomIn')} onClick={() => zoom.by(1.6)}>
          <Plus size={18} strokeWidth={1.5} />
        </button>
        <button className="zoom-btn" aria-label={t('map.zoomOut')} onClick={() => zoom.by(1 / 1.6)}>
          <Minus size={18} strokeWidth={1.5} />
        </button>
        <button className="zoom-btn" aria-label={t('map.zoomReset')} onClick={resetZoom}>
          <RotateCcw size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  )
}
