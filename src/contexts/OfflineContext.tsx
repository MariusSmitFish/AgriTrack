import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { fetchFarmSnapshot } from '../lib/farmSnapshot'
import {
  loadFarmSnapshot,
  readOrRestore,
  saveFarmSnapshot,
  type FarmSnapshot,
} from '../lib/offlineHerd'

interface OfflineContextValue {
  ready: boolean
  online: boolean
  readOnly: boolean
  /** Changes when connectivity or the saved herd changes, so screens reload from the right source. */
  cacheKey: string
  savedAt: string | null
  read: <T>(pick: (saved: FarmSnapshot) => T, fetcher: () => Promise<T>) => Promise<T>
}

const OfflineContext = createContext<OfflineContextValue | null>(null)

function formatSavedAt(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

export function OfflineProvider({
  companyId,
  children,
}: {
  companyId: string | null
  children: ReactNode
}) {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [ready, setReady] = useState(false)
  const [snapshot, setSnapshot] = useState<FarmSnapshot | null>(null)
  const [syncKey, setSyncKey] = useState(0)
  const snapshotRef = useRef<FarmSnapshot | null>(null)
  const companyIdRef = useRef(companyId)
  const needsScreenRefresh = useRef(!navigator.onLine)
  const inFlight = useRef<Promise<boolean> | null>(null)
  const retryTimer = useRef<number | null>(null)
  const retryDelay = useRef(2000)
  snapshotRef.current = snapshot
  companyIdRef.current = companyId

  const clearRetry = () => {
    if (retryTimer.current == null) return
    window.clearTimeout(retryTimer.current)
    retryTimer.current = null
  }

  const refreshNow = useCallback(async () => {
    const id = companyIdRef.current
    if (!id || !navigator.onLine) return false
    if (inFlight.current) return inFlight.current

    const task = (async () => {
      try {
        const next = await fetchFarmSnapshot(id)
        await saveFarmSnapshot(id, next)
        setSnapshot(next)
        retryDelay.current = 2000
        if (navigator.onLine) setOnline(true)
        if (needsScreenRefresh.current) {
          needsScreenRefresh.current = false
          setSyncKey((current) => current + 1)
        }
        return true
      } catch {
        needsScreenRefresh.current = true
        return false
      } finally {
        inFlight.current = null
      }
    })()

    inFlight.current = task
    return task
  }, [])

  const scheduleRetry = useCallback(() => {
    if (!navigator.onLine || retryTimer.current != null) return
    retryTimer.current = window.setTimeout(() => {
      retryTimer.current = null
      void refreshNow().then((ok) => {
        if (ok || !navigator.onLine) return
        retryDelay.current = Math.min(retryDelay.current * 2, 30_000)
        scheduleRetry()
      })
    }, retryDelay.current)
  }, [refreshNow])

  const requestRefresh = useCallback(() => {
    void refreshNow().then((ok) => {
      if (!ok) scheduleRetry()
    })
  }, [refreshNow, scheduleRetry])

  useEffect(() => {
    const onOnline = () => {
      needsScreenRefresh.current = true
      retryDelay.current = 1000
      requestRefresh()
    }
    const onOffline = () => {
      needsScreenRefresh.current = true
      clearRetry()
      setOnline(false)
    }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [requestRefresh])

  useEffect(() => {
    if (!companyId) {
      setSnapshot(null)
      setReady(true)
      return
    }

    let cancelled = false
    setReady(false)
    loadFarmSnapshot(companyId)
      .then((cached) => {
        if (cancelled) return
        setSnapshot(cached ?? null)
        setReady(true)
      })
      .catch(() => {
        if (!cancelled) setReady(true)
      })

    return () => {
      cancelled = true
    }
  }, [companyId])

  useEffect(() => {
    if (!ready || !companyId || !navigator.onLine) return
    requestRefresh()
  }, [ready, companyId, requestRefresh])

  useEffect(() => {
    if (!companyId) return

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const nowOnline = navigator.onLine
      setOnline(nowOnline)
      if (!nowOnline) {
        needsScreenRefresh.current = true
        return
      }
      requestRefresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    const interval = window.setInterval(() => requestRefresh(), 10 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(interval)
      clearRetry()
    }
  }, [companyId, requestRefresh])

  const noteCachedRead = useCallback(() => {
    needsScreenRefresh.current = true
    if (navigator.onLine) scheduleRetry()
  }, [scheduleRetry])

  const read = useCallback(
    <T,>(pick: (saved: FarmSnapshot) => T, fetcher: () => Promise<T>) =>
      readOrRestore(snapshotRef.current, pick, fetcher, noteCachedRead),
    [noteCachedRead],
  )

  const cacheKey = online ? `online:${syncKey}` : (snapshot?.savedAt ?? 'empty')

  return (
    <OfflineContext.Provider
      value={{
        ready,
        online,
        readOnly: !online,
        cacheKey,
        savedAt: snapshot?.savedAt ?? null,
        read,
      }}
    >
      {children}
    </OfflineContext.Provider>
  )
}

export function useOfflineRead() {
  const value = useContext(OfflineContext)
  if (!value) throw new Error('useOfflineRead must be used within OfflineProvider')
  return value
}

export function OfflineBanner() {
  const { ready, online, savedAt } = useOfflineRead()
  if (!ready || online) return null

  return (
    <div className="rounded-xl border border-field-dark bg-barn-100 px-4 py-3 text-sm text-soil-800">
      {savedAt ? (
        <>
          You are offline. Showing the herd saved on this device at {formatSavedAt(savedAt)}. Changes,
          photos, and documents need a connection.
        </>
      ) : (
        <>
          You are offline. Open AgriScale Farm once while online to save the herd on this device.
        </>
      )}
    </div>
  )
}
