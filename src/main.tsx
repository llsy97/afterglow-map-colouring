import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import i18n, { initI18n } from './i18n'
import { getCountryMap, loadAdminIndex } from './maps/registry'
import { useStore } from './store/useStore'
import './index.css'

initI18n(useStore.getState().settings.locale)

// Keep i18n in sync with the persisted locale (language switch needs no reload).
useStore.subscribe((s, prev) => {
  if (s.settings.locale !== prev.settings.locale) void i18n.changeLanguage(s.settings.locale)
})

// Make the default country's map available offline: once the service worker is in charge,
// fetching it lets the runtime cache keep a copy (the very first page load happens before the SW controls the page).
function warmOffline(iso3: string) {
  const cfg = getCountryMap(iso3)
  if (!cfg || !('serviceWorker' in navigator)) return
  const fetchAll = () => Promise.all(cfg.levels.map((l) => fetch(l.url).catch(() => undefined)))
  void navigator.serviceWorker.ready.then(() => {
    if (navigator.serviceWorker.controller) void fetchAll()
    else navigator.serviceWorker.addEventListener('controllerchange', () => void fetchAll(), { once: true })
  })
}
useStore.subscribe((s, prev) => {
  if (s.settings.homeCountry !== prev.settings.homeCountry) warmOffline(s.settings.homeCountry)
})

// the list of countries with a detailed map is tiny; have it ready before the first paint
void loadAdminIndex().then(() => {
  warmOffline(useStore.getState().settings.homeCountry)
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
