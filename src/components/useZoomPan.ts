import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'

type View = { k: number; x: number; y: number }

/**
 * Zoom/pan without re-rendering React: the transform goes straight onto the map <g>.
 * Wheel (desktop), pinch + drag (touch), buttons (everywhere). No double-tap zoom: quickly
 * re-tapping a region is how its brightness is cycled.
 * Coordinates are viewBox units (w x h).
 */
export function useZoomPan(
  svgRef: RefObject<SVGSVGElement | null>,
  gRef: RefObject<SVGGElement | null>,
  o: { w: number; h: number; max: number; enabled: boolean },
) {
  const view = useRef<View>({ k: 1, x: 0, y: 0 })
  const opts = useRef(o)
  opts.current = o

  const apply = useCallback(() => {
    const { k, x, y } = view.current
    gRef.current?.setAttribute('transform', `translate(${x} ${y}) scale(${k})`)
    // at 1x a finger on the map still scrolls the page; zoomed in, it pans the map
    if (svgRef.current) svgRef.current.style.touchAction = k > 1.001 ? 'none' : 'pan-y'
  }, [gRef, svgRef])

  const clamp = useCallback((v: View) => {
    const { w, h, max } = opts.current
    const m = 40
    v.k = Math.min(max, Math.max(1, v.k))
    v.x = Math.min(m, Math.max(w - w * v.k - m, v.x))
    v.y = Math.min(m, Math.max(h - h * v.k - m, v.y))
    if (v.k === 1) {
      v.x = 0
      v.y = 0
    }
    return v
  }, [])

  /** client px -> viewBox units */
  const toVB = useCallback(
    (cx: number, cy: number) => {
      const ctm = svgRef.current?.getScreenCTM()
      if (!ctm) return { x: 0, y: 0 }
      const p = new DOMPoint(cx, cy).matrixTransform(ctm.inverse())
      return { x: p.x, y: p.y }
    },
    [svgRef],
  )

  const zoomAt = useCallback(
    (factor: number, cx: number, cy: number) => {
      const v = view.current
      const k = Math.min(opts.current.max, Math.max(1, v.k * factor))
      const f = k / v.k
      view.current = clamp({ k, x: cx - (cx - v.x) * f, y: cy - (cy - v.y) * f })
      apply()
    },
    [apply, clamp],
  )

  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !o.enabled) return
    apply()
    const pointers = new Map<number, { x: number; y: number }>()
    let moved = false
    let lastDist = 0

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = toVB(e.clientX, e.clientY)
      zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018)), p.x, p.y)
    }
    const onDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      moved = false
      lastDist = 0
    }
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId)
      if (!prev) return
      const cur = { x: e.clientX, y: e.clientY }
      if (pointers.size === 1) {
        if (view.current.k <= 1.001 && e.pointerType === 'touch') return // let the page scroll
        if (!moved) {
          const slop = e.pointerType === 'mouse' ? 3 : 5
          if (Math.hypot(cur.x - prev.x, cur.y - prev.y) < slop) return
          moved = true
          svg.setPointerCapture(e.pointerId) // clicks now land on the svg, not on a region
        }
        const a = toVB(prev.x, prev.y)
        const b = toVB(cur.x, cur.y)
        const v = view.current
        view.current = clamp({ ...v, x: v.x + (b.x - a.x), y: v.y + (b.y - a.y) })
        pointers.set(e.pointerId, cur)
        apply()
      } else if (pointers.size === 2) {
        moved = true
        pointers.set(e.pointerId, cur)
        const [p1, p2] = [...pointers.values()]
        const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y)
        if (lastDist) {
          const c = toVB((p1.x + p2.x) / 2, (p1.y + p2.y) / 2)
          zoomAt(dist / lastDist, c.x, c.y)
        }
        lastDist = dist
      }
    }
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      lastDist = 0
    }
    const onClickCapture = (e: MouseEvent) => {
      if (moved) {
        e.stopPropagation()
        e.preventDefault()
        moved = false
      }
    }

    svg.addEventListener('wheel', onWheel, { passive: false })
    svg.addEventListener('pointerdown', onDown)
    svg.addEventListener('pointermove', onMove)
    svg.addEventListener('pointerup', onUp)
    svg.addEventListener('pointercancel', onUp)
    svg.addEventListener('click', onClickCapture, true)
    return () => {
      svg.removeEventListener('wheel', onWheel)
      svg.removeEventListener('pointerdown', onDown)
      svg.removeEventListener('pointermove', onMove)
      svg.removeEventListener('pointerup', onUp)
      svg.removeEventListener('pointercancel', onUp)
      svg.removeEventListener('click', onClickCapture, true)
    }
  }, [o.enabled, svgRef, apply, clamp, toVB, zoomAt])

  return {
    by: (factor: number) => zoomAt(factor, o.w / 2, o.h / 2),
    reset: useCallback(() => {
      view.current = { k: 1, x: 0, y: 0 }
      apply()
    }, [apply]),
  }
}
