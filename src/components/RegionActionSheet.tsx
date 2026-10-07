import { List, Map as MapIcon, PencilLine } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from './Sheet'
import type { Step } from './RegionListSheet'
import { useEnsureNames, useRegionNamer } from '../lib/names'
import { splitId } from '../lib/regions'
import { getCountryMap, levelIndexOfCode } from '../maps/registry'
import type { CountryMapConfig } from '../maps/registry'
import { useNav } from '../store/useNav'
import { useStore } from '../store/useStore'
import type { RegionId } from '../types'

/**
 * What to do with a country / state you tapped on the World tab: open its map to pick precisely,
 * pick from lists, or record the whole thing. Never jumps straight into a record.
 */
export function RegionActionSheet({
  id,
  onClose,
  onList,
}: {
  id: RegionId
  onClose: () => void
  onList: (cfg: CountryMapConfig, trail: Step[]) => void
}) {
  const { t } = useTranslation()
  const locale = useStore((s) => s.settings.locale)
  const push = useNav((s) => s.push)
  const nameOf = useRegionNamer()
  useEnsureNames(id)

  const { iso3, code } = splitId(id)
  const cfg = getCountryMap(iso3)
  const name = nameOf(id)
  const levelIdx = cfg && code !== undefined ? levelIndexOfCode(cfg, code) : -1
  const nextIdx = levelIdx + 1
  const hasChildren = !!cfg && nextIdx < cfg.levels.length
  const labels = cfg ? cfg.levels.slice(nextIdx).map((l) => l.label[locale]).join(' › ') : ''

  const go = (fn: () => void) => () => {
    onClose()
    fn()
  }

  return (
    <Sheet title={name} onClose={onClose}>
      <div className="grid gap-3 overflow-y-auto">
        {cfg && (hasChildren || code === undefined) && (
          <button
            className="clear-opt action-opt"
            onClick={go(() => push({ t: 'countrymap', iso3, level: hasChildren ? nextIdx : 0, scope: code !== undefined && levelIdx === 0 ? code : undefined }))}
          >
            <span className="flex items-center gap-2 font-bold">
              <MapIcon size={18} strokeWidth={1.5} aria-hidden="true" />
              {t('action.openMap')}
            </span>
            <span className="text-[12px] t-dim">{labels}</span>
          </button>
        )}
        {cfg && hasChildren && (
          <button
            className="clear-opt action-opt"
            onClick={go(() => onList(cfg, code === undefined ? [] : [{ code, id, name }]))}
          >
            <span className="flex items-center gap-2 font-bold">
              <List size={18} strokeWidth={1.5} aria-hidden="true" />
              {t('action.list')}
            </span>
            <span className="text-[12px] t-dim">{labels}</span>
          </button>
        )}
        <button className="clear-opt action-opt" onClick={go(() => push({ t: 'region', id }))}>
          <span className="flex items-center gap-2 font-bold">
            <PencilLine size={18} strokeWidth={1.5} aria-hidden="true" />
            {t('action.record', { name })}
          </span>
          <span className="text-[12px] t-dim">{t('action.recordSub')}</span>
        </button>
        {!cfg && <p className="m-0 text-[13px] t-dim">{t('action.noDetail')}</p>}
      </div>
    </Sheet>
  )
}
