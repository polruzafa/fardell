// Migracions úniques d'arrencada. S'executen abans de renderitzar (vegeu
// main.tsx) i no fan res si no hi ha rastres antics:
//  - Canvi de nom (For·Gear → Fardell, juliol del 2026): mou les claus de
//    localStorage i la base de fotografies d'IndexedDB al nom nou.
//  - Retirada de la llavor (juliol del 2026): la clau «fardell:seed-base» de
//    la fusió amb la llavor ja no serveix; les dades són 100 % de l'usuari.
// Es podrà esborrar quan tots els dispositius s'hagin actualitzat.

const OLD_PREFIX = 'for-gear:'
const NEW_PREFIX = 'fardell:'
const OLD_DB = 'for-gear'
const NEW_DB = 'fardell'
const STORE = 'photos'

function migrateLocalStorage(): void {
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(OLD_PREFIX)) continue
    const newKey = NEW_PREFIX + key.slice(OLD_PREFIX.length)
    const value = localStorage.getItem(key)
    if (value != null && localStorage.getItem(newKey) == null) {
      localStorage.setItem(newKey, value)
    }
    localStorage.removeItem(key)
  }
  // El bucle de dalt ja ha mogut qualsevol «for-gear:seed-base» al nom nou.
  localStorage.removeItem('fardell:seed-base')
}

function openDb(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1)
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function migratePhotos(): Promise<void> {
  // Si el navegador sap llistar les bases i l'antiga no hi és, no cal fer res.
  try {
    const dbs = await indexedDB.databases?.()
    if (dbs && !dbs.some((db) => db.name === OLD_DB)) return
  } catch {
    // sense databases(): es prova la migració igualment
  }
  const oldDb = await openDb(OLD_DB)
  try {
    const [keys, values] = await new Promise<[IDBValidKey[], unknown[]]>((resolve, reject) => {
      const store = oldDb.transaction(STORE, 'readonly').objectStore(STORE)
      const keysReq = store.getAllKeys()
      const valuesReq = store.getAll()
      valuesReq.onsuccess = () => resolve([keysReq.result, valuesReq.result])
      valuesReq.onerror = () => reject(valuesReq.error)
    })
    if (keys.length > 0) {
      const newDb = await openDb(NEW_DB)
      try {
        await new Promise<void>((resolve, reject) => {
          const tx = newDb.transaction(STORE, 'readwrite')
          const store = tx.objectStore(STORE)
          keys.forEach((key, i) => store.put(values[i], key))
          tx.oncomplete = () => resolve()
          tx.onerror = () => reject(tx.error)
        })
      } finally {
        newDb.close()
      }
    }
  } finally {
    oldDb.close()
  }
  indexedDB.deleteDatabase(OLD_DB)
}

export async function migrateOldStorage(): Promise<void> {
  try {
    migrateLocalStorage()
    await migratePhotos()
  } catch {
    // Una migració fallida no ha d'impedir arrencar; com a molt, les
    // fotografies es queden a la base antiga fins a la pròxima arrencada.
  }
}
