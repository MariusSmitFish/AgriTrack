import type {
  Animal,
  AnimalAchievement,
  AnimalInoculation,
  AnimalWeight,
  BreedingEvent,
  Encampment,
  FarmLocation,
  HealthOption,
  Profile,
} from './types'

const DB_NAME = 'agriscale-offline'
const DB_VERSION = 1
const PROFILES = 'profiles'
const SNAPSHOTS = 'snapshots'

export interface FarmSnapshot {
  savedAt: string
  animals: Animal[]
  locations: FarmLocation[]
  encampments: Encampment[]
  breedingEvents: BreedingEvent[]
  inoculations: AnimalInoculation[]
  weights: AnimalWeight[]
  achievements: AnimalAchievement[]
  healthOptions: HealthOption[]
}

export function errorText(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return fallback
}

export function isOfflineError(error: unknown) {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  return /failed to fetch|networkerror|network request failed|load failed|offline|internet connection/i.test(
    errorText(error, ''),
  )
}

export class OfflineUnavailableError extends Error {
  constructor() {
    super('No herd is saved on this device yet. Open AgriScale Farm once while you are online.')
    this.name = 'OfflineUnavailableError'
  }
}

function openDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PROFILES)) db.createObjectStore(PROFILES)
      if (!db.objectStoreNames.contains(SNAPSHOTS)) db.createObjectStore(SNAPSHOTS)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
) {
  const db = await openDb()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode)
      const request = run(tx.objectStore(storeName))
      tx.oncomplete = () => resolve(request.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function loadCachedProfile(userId: string) {
  try {
    return (await withStore(PROFILES, 'readonly', (store) => store.get(userId))) as Profile | undefined
  } catch {
    return undefined
  }
}

export async function saveCachedProfile(profile: Profile) {
  try {
    await withStore(PROFILES, 'readwrite', (store) => store.put(profile, profile.id))
  } catch {
    // The herd can still be read online if storage is unavailable.
  }
}

export async function deleteCachedProfile(userId: string) {
  try {
    await withStore(PROFILES, 'readwrite', (store) => store.delete(userId))
  } catch {
    // Signing out still proceeds when storage cannot be cleared.
  }
}

export async function loadFarmSnapshot(companyId: string) {
  try {
    return (await withStore(SNAPSHOTS, 'readonly', (store) => store.get(companyId))) as
      | FarmSnapshot
      | undefined
  } catch {
    return undefined
  }
}

export async function saveFarmSnapshot(companyId: string, snapshot: FarmSnapshot) {
  await withStore(SNAPSHOTS, 'readwrite', (store) => store.put(snapshot, companyId))
}

export async function deleteFarmSnapshot(companyId: string) {
  try {
    await withStore(SNAPSHOTS, 'readwrite', (store) => store.delete(companyId))
  } catch {
    // Signing out still proceeds when storage cannot be cleared.
  }
}

export async function readOrRestore<T>(
  snapshot: FarmSnapshot | null,
  pick: (saved: FarmSnapshot) => T,
  fetcher: () => Promise<T>,
  onCache?: () => void,
): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (!snapshot) throw new OfflineUnavailableError()
    onCache?.()
    return pick(snapshot)
  }

  try {
    return await fetcher()
  } catch (error) {
    if (snapshot && isOfflineError(error)) {
      onCache?.()
      return pick(snapshot)
    }
    throw error
  }
}
