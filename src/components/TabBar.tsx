import { Globe, Images, Map as MapIcon, Settings } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type Tab = 'map' | 'world' | 'album' | 'settings'
const TABS = [
  { id: 'map', Icon: MapIcon },
  { id: 'world', Icon: Globe },
  { id: 'album', Icon: Images },
  { id: 'settings', Icon: Settings },
] as const

/** Bottom tab bar on phones, left rail on desktop (see .tab-bar in index.css). */
export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const { t } = useTranslation()
  return (
    <nav className="tab-bar" aria-label={t('app.name')}>
      <span className="brand">{t('app.name')}</span>
      <div className="tab-list">
        {TABS.map(({ id, Icon }) => (
          <button key={id} className="tab-btn" aria-current={tab === id ? 'page' : undefined} onClick={() => onChange(id)}>
            <Icon size={22} strokeWidth={1.5} />
            <span>{t(`tab.${id}`)}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
