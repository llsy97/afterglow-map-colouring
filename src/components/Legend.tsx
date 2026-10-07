import { useTranslation } from 'react-i18next'

export function Legend() {
  const { t } = useTranslation()
  return (
    <ul className="m-0 flex list-none flex-wrap items-center justify-center gap-x-4 gap-y-1 p-0" aria-label={t('map.legend')}>
      {[1, 2, 3, 4].map((l) => (
        <li key={l} className="flex items-center gap-1.5 text-[11px] t-dim">
          <span className="legend-dot" style={{ opacity: `var(--op-${l})` }} />
          {t(`level.${l}`)}
        </li>
      ))}
    </ul>
  )
}
