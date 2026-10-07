import type { Locale } from '../types'

const intlLocale = (l: Locale) => (l === 'ko' ? 'ko-KR' : 'en-US')

function parse(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** ko 2026.08.14 / en Aug 14, 2026 */
export function formatDate(iso: string, locale: Locale): string {
  const date = parse(iso)
  if (locale === 'ko') {
    const parts = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date)
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
    return `${get('year')}.${get('month')}.${get('day')}`
  }
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export function formatRange(start: string, end: string | undefined, locale: Locale): string {
  return end && end !== start ? `${formatDate(start, locale)} – ${formatDate(end, locale)}` : formatDate(start, locale)
}

export function formatNumber(n: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale)).format(n)
}

export function todayIso(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
