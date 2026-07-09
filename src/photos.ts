// Fotografies dels elements: viuen a IndexedDB (no a localStorage, que té un
// límit d'uns 5 MB i només accepta cadenes). Són locals al dispositiu: no
// viatgen amb l'exportació del JSON ni es sincronitzen entre dispositius.
import { useEffect, useState } from 'react'

const DB_NAME = 'fardell'
const STORE = 'photos'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const req = fn(db.transaction(STORE, mode).objectStore(STORE))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  } finally {
    db.close()
  }
}

export function getPhoto(id: string): Promise<Blob | undefined> {
  return withStore('readonly', (s) => s.get(id) as IDBRequest<Blob | undefined>)
}

export async function savePhoto(id: string, blob: Blob): Promise<void> {
  await withStore('readwrite', (s) => s.put(blob, id))
}

export async function deletePhoto(id: string): Promise<void> {
  await withStore('readwrite', (s) => s.delete(id))
}

/** Esborra les fotografies d'elements que ja no existeixen (després d'importar o restaurar). */
export async function prunePhotos(validIds: Set<string>): Promise<void> {
  const keys = await withStore('readonly', (s) => s.getAllKeys())
  await Promise.all(
    keys
      .filter((k): k is string => typeof k === 'string' && !validIds.has(k))
      .map((k) => deletePhoto(k)),
  )
}

/**
 * Redueix la imatge abans de desar-la: costat màxim 1280 px, JPEG al 80 %.
 * Una foto de càmera de 3-5 MB queda en uns 150-250 kB.
 */
export async function downscale(file: File, maxSide = 1280): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('No s’ha pogut llegir la imatge'))
      el.src = url
    })
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.8),
    )
    if (!blob) throw new Error('No s’ha pogut convertir la imatge')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** URL de la fotografia d'un element, o null si no en té. `refresh()` la torna a llegir. */
export function usePhoto(id: string | undefined) {
  const [url, setUrl] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!id) return
    let objectUrl: string | null = null
    let cancelled = false
    getPhoto(id)
      .then((blob) => {
        if (cancelled) return
        objectUrl = blob ? URL.createObjectURL(blob) : null
        setUrl(objectUrl)
      })
      .catch(() => {
        if (!cancelled) setUrl(null)
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id, version])

  return { url, refresh: () => setVersion((v) => v + 1) }
}
