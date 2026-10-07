import { useEffect, useState } from 'react'

const DB = 'tlm-photos'
const STORE = 'photos'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    t.oncomplete = () => {
      db.close()
      resolve(req.result)
    }
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error)
  })
}

/**
 * Stored as { type, data: ArrayBuffer } rather than a raw Blob: some WebKit builds (notably Safari
 * private browsing and embedded WebViews) refuse to persist Blobs in IndexedDB, ArrayBuffers always work.
 */
type Stored = { type: string; data: ArrayBuffer }

export async function putPhoto(id: string, blob: Blob): Promise<void> {
  const record: Stored = { type: blob.type || 'image/jpeg', data: await blob.arrayBuffer() }
  await tx('readwrite', (s) => s.put(record, id))
}

export async function getPhoto(id: string): Promise<Blob | undefined> {
  const r = await tx<Stored | Blob | undefined>('readonly', (s) => s.get(id))
  if (!r) return undefined
  return r instanceof Blob ? r : new Blob([r.data], { type: r.type }) // Blob = records from before this format
}
export const deletePhoto = (id: string) => tx('readwrite', (s) => s.delete(id)).then(() => undefined)
export const clearPhotos = () => tx('readwrite', (s) => s.clear()).then(() => undefined)

/** Resize to a long edge of 1200px and re-encode as JPEG q0.8. */
export async function resizePhoto(file: Blob, maxEdge = 1200, quality = 0.8): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const scale = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff' // JPEG has no alpha
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(bmp, 0, 0, w, h)
  bmp.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/jpeg', quality),
  )
}

const urlCache = new Map<string, Promise<string | undefined>>()

function photoUrl(id: string) {
  let p = urlCache.get(id)
  if (!p) {
    p = getPhoto(id).then((b) => (b ? URL.createObjectURL(b) : undefined))
    urlCache.set(id, p)
  }
  return p
}

export function forgetPhotoUrl(id: string) {
  const p = urlCache.get(id)
  urlCache.delete(id)
  void p?.then((u) => u && URL.revokeObjectURL(u))
}

/** Object URL for a stored photo (cached for the session). */
export function usePhotoUrl(id: string | undefined): string | undefined {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    let alive = true
    setUrl(undefined)
    if (id) void photoUrl(id).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [id])
  return url
}

/** UUID v4. randomUUID() only exists in secure contexts (https/localhost), and phones testing over http://LAN-IP are not. */
export function newId() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0'))
  return `${h.slice(0, 4).join('')}-${h.slice(4, 6).join('')}-${h.slice(6, 8).join('')}-${h.slice(8, 10).join('')}-${h.slice(10).join('')}`
}
