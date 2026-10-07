import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { useStore } from '../store/useStore'
import type { PersistedData } from '../store/useStore'
import { clearPhotos, forgetPhotoUrl, getPhoto, putPhoto } from './photos'
import { saveFile } from './saveFile'

const VERSION = 1

type BackupFile = { app: 'travel-light-map'; version: number; exportedAt: string; data: PersistedData }

function stamp() {
  return new Date().toISOString().slice(0, 10)
}

/** data.json + photos/<id>.jpg inside one zip. */
export async function exportBackup() {
  const { settings, onboarded, regions, trips } = useStore.getState()
  const file: BackupFile = { app: 'travel-light-map', version: VERSION, exportedAt: new Date().toISOString(), data: { settings, onboarded, regions, trips } }
  const files: Record<string, Uint8Array> = { 'data.json': strToU8(JSON.stringify(file, null, 2)) }
  const ids = new Set(trips.flatMap((t) => t.photos.map((p) => p.id)))
  for (const id of ids) {
    const blob = await getPhoto(id)
    if (blob) files[`photos/${id}.jpg`] = new Uint8Array(await blob.arrayBuffer())
  }
  const zip = zipSync(files, { level: 0 }) // JPEGs are already compressed
  await saveFile(new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' }), `travel-light-map-${stamp()}.zip`)
}

function validate(raw: unknown): PersistedData {
  const f = raw as Partial<BackupFile> | undefined
  const d = f?.data
  if (f?.app !== 'travel-light-map' || !d || !Array.isArray(d.trips) || typeof d.regions !== 'object' || !d.settings) {
    throw new Error('invalid backup')
  }
  for (const t of d.trips) {
    if (typeof t.id !== 'string' || typeof t.regionId !== 'string' || typeof t.startDate !== 'string' || ![1, 2, 3, 4].includes(t.level) || !Array.isArray(t.photos)) {
      throw new Error('invalid trip')
    }
  }
  return { settings: d.settings, onboarded: true, regions: d.regions, trips: d.trips }
}

/** Replaces all local data (records, settings and photos) with the backup's. */
export async function importBackup(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const entries = unzipSync(bytes)
  const json = entries['data.json']
  if (!json) throw new Error('data.json missing')
  const data = validate(JSON.parse(strFromU8(json)))

  const old = useStore.getState().trips.flatMap((t) => t.photos.map((p) => p.id))
  await clearPhotos()
  old.forEach(forgetPhotoUrl)
  for (const [name, content] of Object.entries(entries)) {
    const m = /^photos\/(.+)\.jpg$/.exec(name)
    if (m) await putPhoto(m[1], new Blob([content.buffer as ArrayBuffer], { type: 'image/jpeg' }))
  }
  useStore.getState().replaceAll(data)
}
