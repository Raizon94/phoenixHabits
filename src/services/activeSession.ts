import type { PreviousSet, SessionFull } from '@/types'

/**
 * Copia local del entrenamiento en curso. Permite recuperarlo aunque se cierre la app
 * sin conexión (la cola de sincronización guarda los cambios pendientes por separado).
 */
const KEY = 'phoenix.activeSession'

export interface ActiveSnapshot extends SessionFull {
  previous?: [string, PreviousSet[]][]
}

export function readActiveSnapshot(): ActiveSnapshot | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ActiveSnapshot) : null
  } catch {
    return null
  }
}

export function writeActiveSnapshot(s: SessionFull, previous?: Map<string, PreviousSet[]>) {
  try {
    const snap: ActiveSnapshot = { ...s, previous: previous ? [...previous.entries()] : readActiveSnapshot()?.previous }
    localStorage.setItem(KEY, JSON.stringify(snap))
  } catch {
    /* almacenamiento lleno: los cambios siguen en la cola */
  }
}

export function clearActiveSnapshot(id?: string) {
  try {
    if (!id || readActiveSnapshot()?.id === id) localStorage.removeItem(KEY)
  } catch {
    /* noop */
  }
}
