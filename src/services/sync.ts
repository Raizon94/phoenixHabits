import { supabase } from '@/lib/supabase'
import { SyncQueue, type EnqueueInput, type ExecResult, type Row, type SyncOp, type SyncTable } from './syncQueue'

/** Clave de conflicto natural de las tablas que no se escriben por id. */
export const CONFLICT_KEYS: Partial<Record<SyncTable, string>> = {
  habit_logs: 'habit_id,log_date',
  body_weight_logs: 'user_id,log_date',
  user_settings: 'user_id',
}

function isNetworkError(message: string | undefined, code: string | undefined): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  if (!code) return true
  const m = (message ?? '').toLowerCase()
  return m.includes('fetch') || m.includes('network') || m.includes('timeout') || code === 'PGRST301' || code.startsWith('5')
}

async function executeOps(ops: SyncOp[]): Promise<ExecResult> {
  const first = ops[0]
  try {
    if (first.kind === 'upsert') {
      const rows = ops.map((o) => o.row as Row)
      const { error } = await supabase.from(first.table).upsert(rows, { onConflict: first.onConflict ?? CONFLICT_KEYS[first.table] ?? 'id', defaultToNull: false })
      if (error) return { ok: false, retry: isNetworkError(error.message, error.code), message: error.message, code: error.code }
    } else {
      const { error } = await supabase.from(first.table).delete().match(first.match ?? {})
      if (error) return { ok: false, retry: isNetworkError(error.message, error.code), message: error.message, code: error.code }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, retry: true, message: e instanceof Error ? e.message : String(e) }
  }
}

let queue: SyncQueue | null = null
let queueUser: string | null = null
let flushTimer: ReturnType<typeof setTimeout> | null = null
const afterFlush = new Set<() => void>()

/** Inicializa la cola para el usuario autenticado (una cola por usuario). */
export function initSync(userId: string): SyncQueue {
  if (queue && queueUser === userId) return queue
  queue = new SyncQueue(executeOps, typeof window !== 'undefined' ? window.localStorage : null, userId)
  queueUser = userId
  scheduleFlush(0)
  return queue
}

export function getQueue(): SyncQueue {
  if (!queue) throw new Error('Sync no inicializado')
  return queue
}

export function hasQueue(): boolean {
  return queue !== null
}

export function scheduleFlush(delay = 400) {
  if (flushTimer) clearTimeout(flushTimer)
  flushTimer = setTimeout(async () => {
    flushTimer = null
    if (!queue) return
    await queue.flush()
    if (queue.getState().pending === 0) for (const fn of afterFlush) fn()
  }, delay)
}

export function onFlushed(fn: () => void): () => void {
  afterFlush.add(fn)
  return () => afterFlush.delete(fn)
}

/** Encola una escritura (optimista) y programa el envío. */
export function write(input: EnqueueInput | EnqueueInput[]) {
  const q = getQueue()
  const list = Array.isArray(input) ? input : [input]
  q.enqueueMany(list.map((i) => ({ ...i, onConflict: i.onConflict ?? (i.kind === 'upsert' ? CONFLICT_KEYS[i.table] : undefined) })))
  scheduleFlush()
}

export function upsert(table: SyncTable, row: Row | Row[]) {
  const rows = Array.isArray(row) ? row : [row]
  write(rows.map((r) => ({ table, kind: 'upsert' as const, row: r })))
}

export function remove(table: SyncTable, match: Row) {
  write({ table, kind: 'delete', match })
}

/**
 * Aplica las escrituras pendientes de la cola sobre filas leídas del servidor, para que
 * la UI nunca "retroceda" mientras hay cambios sin sincronizar.
 */
export function overlayPending<T extends object>(table: SyncTable, rows: T[], include: (row: T) => boolean = () => true): T[] {
  if (!queue) return rows
  const ops = queue.getOps().filter((o) => o.table === table)
  if (!ops.length) return rows
  const conflict = CONFLICT_KEYS[table]
  const keyOf = (r: Row) => (conflict ? conflict.split(',').map((c) => String(r[c])).join('|') : String(r.id))
  const out = [...rows] as unknown as Row[]
  for (const op of ops) {
    if (op.kind === 'upsert' && op.row) {
      const k = keyOf(op.row)
      const idx = out.findIndex((r) => keyOf(r) === k)
      if (idx >= 0) out[idx] = { ...out[idx], ...op.row }
      else if (include(op.row as unknown as T)) out.push(op.row)
    } else if (op.kind === 'delete' && op.match) {
      const m = op.match
      for (let i = out.length - 1; i >= 0; i--) {
        if (Object.entries(m).every(([c, v]) => out[i][c] === v)) out.splice(i, 1)
      }
    }
  }
  return out as unknown as T[]
}

const PAGE = 1000

/** Lee todas las filas de una consulta paginando (Supabase limita a 1000 por petición). */
export async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    out.push(...(data ?? []))
    if (!data || data.length < PAGE) break
  }
  return out
}

/** Desempaqueta una respuesta de Supabase lanzando el error si lo hay. */
export function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

/** Normaliza columnas numeric (llegan como string desde PostgREST si son muy grandes). */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}
