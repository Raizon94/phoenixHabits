import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getQueue, hasQueue, onFlushed, scheduleFlush } from '@/services/sync'
import type { SyncState } from '@/services/syncQueue'

const initial: SyncState = { status: 'idle', pending: 0, lastError: null, lastSyncedAt: null }
const SyncContext = createContext<SyncState & { online: boolean }>({ ...initial, online: true })

export function SyncProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const [state, setState] = useState<SyncState>(initial)
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  const qc = useQueryClient()

  useEffect(() => {
    if (!hasQueue()) return
    return getQueue().subscribe(setState)
  }, [userId])

  useEffect(() => {
    // Al terminar de sincronizar, refrescar vistas agregadas calculadas en el servidor.
    return onFlushed(() => {
      qc.invalidateQueries({ queryKey: ['sessionSummaries'] })
      qc.invalidateQueries({ queryKey: ['exerciseHistory'] })
      qc.invalidateQueries({ queryKey: ['trainingStats'] })
    })
  }, [qc])

  useEffect(() => {
    const on = () => {
      setOnline(true)
      scheduleFlush(0)
    }
    const off = () => setOnline(false)
    const vis = () => document.visibilityState === 'visible' && scheduleFlush(0)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    document.addEventListener('visibilitychange', vis)
    // Reintento periódico si quedan cambios pendientes.
    const iv = setInterval(() => {
      if (hasQueue() && getQueue().getState().pending > 0) scheduleFlush(0)
    }, 20_000)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      document.removeEventListener('visibilitychange', vis)
      clearInterval(iv)
    }
  }, [])

  return <SyncContext.Provider value={{ ...state, online }}>{children}</SyncContext.Provider>
}

export function useSync() {
  return useContext(SyncContext)
}
