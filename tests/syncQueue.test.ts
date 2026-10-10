import { describe, expect, it } from 'vitest'
import { SyncQueue, coalesce, takeBatch, type ExecResult, type SyncOp, type StorageLike } from '@/services/syncQueue'

function memStorage(): StorageLike & { data: Record<string, string> } {
  const data: Record<string, string> = {}
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v), removeItem: (k) => void delete data[k] }
}

describe('cola de sincronización', () => {
  it('fusiona escrituras sobre la misma fila manteniendo el orden', () => {
    const q = new SyncQueue(async () => ({ ok: true }), null)
    q.enqueue({ table: 'workout_sessions', kind: 'upsert', row: { id: 's1', status: 'in_progress' } })
    q.enqueue({ table: 'workout_sets', kind: 'upsert', row: { id: 'x1', weight: 60 } })
    q.enqueue({ table: 'workout_sessions', kind: 'upsert', row: { id: 's1', status: 'completed' } })
    q.enqueue({ table: 'workout_sets', kind: 'upsert', row: { id: 'x1', weight: 62.5 } })
    const ops = q.getOps()
    expect(ops).toHaveLength(2)
    expect(ops[0].row).toEqual({ id: 's1', status: 'completed' }) // la sesión sigue antes que la serie
    expect(ops[1].row).toEqual({ id: 'x1', weight: 62.5 })
  })

  it('un borrado reemplaza al upsert pendiente y va al final', () => {
    let queue: SyncOp[] = []
    const mk = (key: string, kind: 'upsert' | 'delete'): SyncOp => ({ key, table: 'workout_sets', kind, row: { id: key }, match: { id: key }, ts: 0, attempts: 0 })
    queue = coalesce(queue, mk('a', 'upsert'))
    queue = coalesce(queue, mk('b', 'upsert'))
    queue = coalesce(queue, mk('a', 'delete'))
    expect(queue.map((o) => `${o.key}:${o.kind}`)).toEqual(['b:upsert', 'a:delete'])
  })

  it('usa la clave de conflicto para evitar duplicados por día', () => {
    const q = new SyncQueue(async () => ({ ok: true }), null)
    q.enqueue({ table: 'habit_logs', kind: 'upsert', onConflict: 'habit_id,log_date', row: { habit_id: 'h', log_date: '2026-10-10', completed: true } })
    q.enqueue({ table: 'habit_logs', kind: 'upsert', onConflict: 'habit_id,log_date', row: { habit_id: 'h', log_date: '2026-10-10', completed: false } })
    expect(q.getOps()).toHaveLength(1)
    expect(q.getOps()[0].row?.completed).toBe(false)
  })

  it('conserva los cambios si falla la red y los envía al reconectar', async () => {
    const storage = memStorage()
    let online = false
    const sent: SyncOp[][] = []
    const exec = async (ops: SyncOp[]): Promise<ExecResult> => {
      if (!online) return { ok: false, retry: true, message: 'offline' }
      sent.push(ops)
      return { ok: true }
    }
    const q = new SyncQueue(exec, storage, 'u1')
    q.enqueue({ table: 'workout_sets', kind: 'upsert', row: { id: 'x1', weight: 60 } })
    await q.flush()
    expect(q.getState().status).toBe('offline')
    expect(q.getOps()).toHaveLength(1)
    // Simula cerrar la app: una nueva cola lee lo pendiente del almacenamiento local.
    const q2 = new SyncQueue(exec, storage, 'u1')
    expect(q2.getOps()).toHaveLength(1)
    online = true
    await q2.flush()
    expect(q2.getOps()).toHaveLength(0)
    expect(q2.getState().status).toBe('idle')
    expect(sent.flat().map((o) => o.row?.id)).toEqual(['x1'])
    expect(storage.data['phoenix.syncQueue.u1']).toBeUndefined()
  })

  it('agrupa upserts consecutivos de la misma tabla con las mismas columnas', () => {
    const mk = (table: SyncOp['table'], id: string, extra = {}): SyncOp => ({ key: id, table, kind: 'upsert', row: { id, ...extra }, ts: 0, attempts: 0 })
    const ops = [mk('workout_sets', '1'), mk('workout_sets', '2'), mk('workout_sets', '3', { weight: 1 }), mk('habits', '4')]
    expect(takeBatch(ops).map((o) => o.key)).toEqual(['1', '2'])
  })

  it('descarta errores permanentes sin bloquear la cola', async () => {
    const exec = async (ops: SyncOp[]): Promise<ExecResult> => (ops[0].row?.id === 'bad' ? { ok: false, message: 'RLS', code: '42501' } : { ok: true })
    const q = new SyncQueue(exec, null)
    q.enqueue({ table: 'habits', kind: 'upsert', row: { id: 'bad', name: 1 } })
    q.enqueue({ table: 'habit_logs', kind: 'upsert', row: { id: 'good' } })
    await q.flush()
    expect(q.getOps()).toHaveLength(0)
  })
})
