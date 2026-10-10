/**
 * Cola de escrituras pendientes con persistencia en localStorage.
 *
 * - Todas las escrituras de la app pasan por aquí: se aplican primero en la UI
 *   (optimista) y la cola las envía a Supabase en orden.
 * - Varias escrituras sobre la misma fila se fusionan (gana la última) manteniendo la
 *   posición original, para que una fila padre siempre se inserte antes que sus hijas.
 * - Los ids se generan en el cliente, así que reintentar un upsert nunca duplica filas.
 * - Si falla la red, la operación se queda en la cola y se reintenta al volver la conexión.
 */

export type SyncTable =
  | 'habits'
  | 'habit_logs'
  | 'exercises'
  | 'workout_routines'
  | 'routine_exercises'
  | 'routine_sets'
  | 'workout_sessions'
  | 'workout_exercises'
  | 'workout_sets'
  | 'body_weight_logs'
  | 'progress_photos'
  | 'user_settings'

export type Row = Record<string, unknown>

export interface SyncOp {
  key: string
  table: SyncTable
  kind: 'upsert' | 'delete'
  /** upsert: fila completa o parcial */
  row?: Row
  /** delete: columnas para el filtro .match() */
  match?: Row
  onConflict?: string
  ts: number
  attempts: number
}

export type EnqueueInput = Omit<SyncOp, 'key' | 'ts' | 'attempts'> & { key?: string }

export interface ExecResult {
  ok: boolean
  /** true si el fallo es de red/transitorio y debe reintentarse */
  retry?: boolean
  message?: string
  code?: string
}

export type Executor = (ops: SyncOp[]) => Promise<ExecResult>

export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncState {
  status: SyncStatus
  pending: number
  lastError: string | null
  lastSyncedAt: number | null
}

export interface StorageLike {
  getItem(k: string): string | null
  setItem(k: string, v: string): void
  removeItem(k: string): void
}

const MAX_ATTEMPTS = 6

export function opKey(table: SyncTable, row: Row | undefined, onConflict?: string): string {
  if (!row) return `${table}:?`
  if (onConflict) return `${table}:${onConflict.split(',').map((c) => String(row[c.trim()])).join('|')}`
  return `${table}:${String(row.id)}`
}

/** Fusiona una operación nueva con la cola existente (función pura). */
export function coalesce(queue: SyncOp[], op: SyncOp): SyncOp[] {
  const idx = queue.findIndex((q) => q.key === op.key)
  if (idx === -1) return [...queue, op]
  const prev = queue[idx]
  if (op.kind === 'upsert') {
    if (prev.kind === 'upsert') {
      // Mantener la posición (orden padre→hijo) y fusionar columnas.
      const merged: SyncOp = { ...op, row: { ...prev.row, ...op.row }, attempts: 0 }
      return queue.map((q, i) => (i === idx ? merged : q))
    }
    // delete seguido de upsert: se recrea al final.
    return [...queue.filter((_, i) => i !== idx), op]
  }
  // delete: descartar el upsert pendiente y borrar al final (después de sus hijas).
  return [...queue.filter((_, i) => i !== idx), op]
}

export class SyncQueue {
  private ops: SyncOp[] = []
  private listeners = new Set<(s: SyncState) => void>()
  private flushing: Promise<void> | null = null
  private state: SyncState = { status: 'idle', pending: 0, lastError: null, lastSyncedAt: null }
  private storageKey: string

  constructor(
    private executor: Executor,
    private storage: StorageLike | null,
    namespace = 'default',
  ) {
    this.storageKey = `phoenix.syncQueue.${namespace}`
    this.load()
  }

  private load() {
    if (!this.storage) return
    try {
      const raw = this.storage.getItem(this.storageKey)
      this.ops = raw ? (JSON.parse(raw) as SyncOp[]) : []
    } catch {
      this.ops = []
    }
    this.setState({ pending: this.ops.length })
  }

  private persist() {
    if (!this.storage) return
    try {
      if (this.ops.length) this.storage.setItem(this.storageKey, JSON.stringify(this.ops))
      else this.storage.removeItem(this.storageKey)
    } catch {
      // almacenamiento lleno o no disponible: la cola sigue en memoria
    }
  }

  private setState(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch }
    for (const l of this.listeners) l(this.state)
  }

  getState(): SyncState {
    return this.state
  }

  getOps(): readonly SyncOp[] {
    return this.ops
  }

  subscribe(fn: (s: SyncState) => void): () => void {
    this.listeners.add(fn)
    fn(this.state)
    return () => this.listeners.delete(fn)
  }

  enqueue(input: EnqueueInput): void {
    const key = input.key ?? opKey(input.table, input.kind === 'delete' ? input.match : input.row, input.kind === 'delete' ? undefined : input.onConflict)
    const op: SyncOp = { ...input, key, ts: Date.now(), attempts: 0 }
    this.ops = coalesce(this.ops, op)
    this.persist()
    this.setState({ pending: this.ops.length })
  }

  enqueueMany(inputs: EnqueueInput[]): void {
    for (const i of inputs) {
      const key = i.key ?? opKey(i.table, i.kind === 'delete' ? i.match : i.row, i.kind === 'delete' ? undefined : i.onConflict)
      this.ops = coalesce(this.ops, { ...i, key, ts: Date.now(), attempts: 0 })
    }
    this.persist()
    this.setState({ pending: this.ops.length })
  }

  /** Envía la cola. Devuelve cuando termina o se detiene por error de red. */
  flush(): Promise<void> {
    if (this.flushing) return this.flushing
    this.flushing = this.run().finally(() => {
      this.flushing = null
    })
    return this.flushing
  }

  private async run() {
    if (!this.ops.length) {
      this.setState({ status: 'idle', pending: 0 })
      return
    }
    this.setState({ status: 'syncing' })
    while (this.ops.length) {
      const batch = takeBatch(this.ops)
      const res = await this.executor(batch)
      if (res.ok) {
        this.removeOps(batch)
        continue
      }
      if (res.retry) {
        this.setState({ status: 'offline', lastError: res.message ?? null })
        return
      }
      // Error permanente (validación, RLS…) o de orden (FK). Se reintenta unas veces y se descarta.
      const keys = new Set(batch.map((b) => b.key))
      let dropped = false
      this.ops = this.ops.flatMap((o) => {
        if (!keys.has(o.key)) return [o]
        const attempts = o.attempts + 1
        if (attempts >= MAX_ATTEMPTS || res.code !== '23503') {
          dropped = true
          return []
        }
        return [{ ...o, attempts }]
      })
      this.persist()
      this.setState({ status: 'error', lastError: res.message ?? 'Error de sincronización', pending: this.ops.length })
      if (!dropped) {
        // Mover el lote al final para dejar pasar antes a sus dependencias.
        const moved = this.ops.filter((o) => keys.has(o.key))
        this.ops = [...this.ops.filter((o) => !keys.has(o.key)), ...moved]
        this.persist()
        if (this.ops.every((o) => keys.has(o.key))) return
      }
    }
    this.setState({ status: 'idle', pending: 0, lastSyncedAt: Date.now(), lastError: null })
  }

  private removeOps(batch: SyncOp[]) {
    // Si una operación se fusionó con otra más nueva mientras se enviaba, el objeto
    // ya no es el mismo y se conserva para el siguiente envío.
    const sent = new Set(batch)
    this.ops = this.ops.filter((o) => !sent.has(o))
    this.persist()
    this.setState({ pending: this.ops.length })
  }

  /** Descarta operaciones pendientes que cumplan una condición. */
  dropWhere(pred: (op: SyncOp) => boolean) {
    this.ops = this.ops.filter((o) => !pred(o))
    this.persist()
    this.setState({ pending: this.ops.length })
  }

  /** Descarta operaciones pendientes de ciertas tablas (p. ej. tras RENACER). */
  dropTables(tables: SyncTable[]) {
    const set = new Set(tables)
    this.ops = this.ops.filter((o) => !set.has(o.table))
    this.persist()
    this.setState({ pending: this.ops.length })
  }

  clear() {
    this.ops = []
    this.persist()
    this.setState({ pending: 0, status: 'idle' })
  }
}

/** Agrupa operaciones consecutivas compatibles (misma tabla, tipo y onConflict) en un lote. */
export function takeBatch(ops: SyncOp[], max = 200): SyncOp[] {
  if (!ops.length) return []
  const first = ops[0]
  const batch = [first]
  for (let i = 1; i < ops.length && batch.length < max; i++) {
    const o = ops[i]
    if (o.table !== first.table || o.kind !== first.kind || o.onConflict !== first.onConflict) break
    if (o.kind === 'delete') break // los deletes van uno a uno (filtros distintos)
    // PostgREST necesita las mismas columnas en todas las filas de un upsert múltiple
    if (sameKeys(o.row, first.row) === false) break
    batch.push(o)
  }
  return batch
}

function sameKeys(a: Row | undefined, b: Row | undefined): boolean {
  const ka = Object.keys(a ?? {}).sort().join(',')
  const kb = Object.keys(b ?? {}).sort().join(',')
  return ka === kb
}
