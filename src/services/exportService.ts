import { PHOTO_BUCKET, supabase } from '@/lib/supabase'
import { fetchAll } from './sync'
import type { SyncTable } from './syncQueue'

type Row = Record<string, unknown>

// ───────────── Utilidades de descarga ─────────────

export function download(filename: string, content: Blob | string, type = 'application/json') {
  const blob = typeof content === 'string' ? new Blob([content], { type: `${type};charset=utf-8` }) : content
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** CSV con separador ";" y BOM para que Excel en español lo abra correctamente. */
export function toCSV(rows: Row[], columns: string[]): string {
  const esc = (v: unknown) => {
    if (v == null) return ''
    const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v)
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + [columns.join(';'), ...rows.map((r) => columns.map((c) => esc(r[c])).join(';'))].join('\r\n')
}

async function all(table: string, order = 'id'): Promise<Row[]> {
  return fetchAll<Row>((f, t) => supabase.from(table).select('*').order(order).range(f, t))
}

// ───────────── Exportaciones por tipo ─────────────

export async function exportHabits(): Promise<Row[]> {
  const [habits, logs] = await Promise.all([all('habits'), all('habit_logs', 'log_date')])
  const byId = new Map(habits.map((h) => [h.id, h]))
  return logs.map((l) => ({
    fecha: l.log_date,
    habito: byId.get(l.habit_id)?.name ?? '',
    completado: l.completed ? 'sí' : 'no',
    valor: l.value,
    unidad: byId.get(l.habit_id)?.unit ?? '',
  }))
}

export async function exportWorkouts(): Promise<Row[]> {
  const [sessions, wes, sets, exercises] = await Promise.all([all('workout_sessions', 'started_at'), all('workout_exercises'), all('workout_sets'), all('exercises')])
  const sById = new Map(sessions.map((s) => [s.id, s]))
  const weById = new Map(wes.map((w) => [w.id, w]))
  const exById = new Map(exercises.map((e) => [e.id, e]))
  return sets
    .map((st) => {
      const we = weById.get(st.workout_exercise_id)
      const s = we && sById.get(we.session_id)
      const ex = we && exById.get(we.exercise_id)
      if (!we || !s || s.status !== 'completed') return null
      return {
        fecha: s.session_date,
        rutina: s.routine_name,
        inicio: s.started_at,
        fin: s.ended_at,
        ejercicio: ex?.name ?? '',
        orden_ejercicio: Number(we.position) + 1,
        serie: Number(st.position) + 1,
        tipo: st.set_type,
        peso: st.weight == null ? null : Number(st.weight),
        unidad: ex?.weight_unit ?? 'kg',
        repeticiones: st.reps,
        completada: st.completed ? 'sí' : 'no',
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(a!.inicio).localeCompare(String(b!.inicio)) || a!.orden_ejercicio - b!.orden_ejercicio || a!.serie - b!.serie) as Row[]
}

export async function exportWeights(): Promise<Row[]> {
  const logs = await all('body_weight_logs', 'log_date')
  return logs.map((l) => ({ fecha: l.log_date, peso_kg: Number(l.weight_kg), notas: l.notes ?? '' }))
}

// ───────────── Copia de seguridad completa ─────────────

/** Orden de restauración: los padres antes que los hijos. */
export const BACKUP_TABLES: SyncTable[] = [
  'user_settings',
  'habits',
  'habit_logs',
  'exercises',
  'workout_routines',
  'routine_exercises',
  'routine_sets',
  'workout_sessions',
  'workout_exercises',
  'workout_sets',
  'body_weight_logs',
  'progress_photos',
]

const CONFLICT: Partial<Record<SyncTable, string>> = { habit_logs: 'habit_id,log_date', body_weight_logs: 'user_id,log_date', user_settings: 'user_id' }

export interface Backup {
  app: 'phoenix-habits'
  version: 1
  exported_at: string
  user_id: string
  tables: Record<string, Row[]>
  photos: { path: string; data: string }[]
}

async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer())
  let s = ''
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(s)
}

function base64ToBlob(data: string, type = 'image/jpeg'): Blob {
  const bin = atob(data)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type })
}

export async function createBackup(userId: string, includePhotos: boolean, onProgress?: (msg: string) => void): Promise<Backup> {
  const tables: Record<string, Row[]> = {}
  for (const t of BACKUP_TABLES) {
    onProgress?.(`Leyendo ${t}…`)
    tables[t] = await all(t, t === 'user_settings' ? 'user_id' : 'id')
  }
  const photos: Backup['photos'] = []
  if (includePhotos) {
    const list = tables.progress_photos ?? []
    for (let i = 0; i < list.length; i++) {
      onProgress?.(`Descargando fotos ${i + 1}/${list.length}…`)
      const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(String(list[i].storage_path))
      if (error || !data) throw new Error(`No se pudo descargar una foto: ${error?.message ?? ''}`)
      photos.push({ path: String(list[i].storage_path), data: await blobToBase64(data) })
    }
  }
  return { app: 'phoenix-habits', version: 1, exported_at: new Date().toISOString(), user_id: userId, tables, photos }
}

export function validateBackup(x: unknown): asserts x is Backup {
  const b = x as Backup
  if (!b || b.app !== 'phoenix-habits' || b.version !== 1 || typeof b.tables !== 'object') throw new Error('El archivo no es una copia de seguridad válida de Phoenix Habits')
}

/**
 * Prepara las filas de una copia para restaurarlas en la cuenta actual (función pura):
 * - Reasigna user_id y rutas de fotos al usuario actual.
 * - Los hábitos/ejercicios que ya existen con otro id (mismo nombre o system_key) se
 *   fusionan con el existente para no duplicarlos; sus referencias se reescriben.
 */
export function prepareRestore(backup: Backup, userId: string, existing: { habits: Row[]; exercises: Row[] }): Record<string, Row[]> {
  const norm = (s: unknown) => String(s ?? '').trim().toLowerCase()
  const habitMap = new Map<string, string>()
  const exMap = new Map<string, string>()
  for (const h of backup.tables.habits ?? []) {
    const match = existing.habits.find((e) => e.id !== h.id && ((h.system_key && e.system_key === h.system_key) || norm(e.name) === norm(h.name)))
    if (match) habitMap.set(String(h.id), String(match.id))
  }
  for (const x of backup.tables.exercises ?? []) {
    const match = existing.exercises.find((e) => e.id !== x.id && norm(e.name) === norm(x.name))
    if (match) exMap.set(String(x.id), String(match.id))
  }
  const oldPrefix = `${backup.user_id}/`
  const out: Record<string, Row[]> = {}
  for (const t of BACKUP_TABLES) {
    let rows: Row[] = (backup.tables[t] ?? []).map((r) => ({ ...r, user_id: userId }))
    if (t === 'habits') rows = rows.filter((r) => !habitMap.has(String(r.id)))
    if (t === 'exercises') rows = rows.filter((r) => !exMap.has(String(r.id)))
    if (t === 'habit_logs') rows = rows.map(({ id: _id, ...r }) => ({ ...r, habit_id: habitMap.get(String(r.habit_id)) ?? r.habit_id }))
    if (t === 'routine_exercises' || t === 'workout_exercises') rows = rows.map((r) => ({ ...r, exercise_id: exMap.get(String(r.exercise_id)) ?? r.exercise_id }))
    if (t === 'body_weight_logs') rows = rows.map(({ id: _id, ...r }) => r)
    if (t === 'progress_photos') rows = rows.map((r) => ({ ...r, storage_path: String(r.storage_path).replace(oldPrefix, `${userId}/`) }))
    out[t] = rows
  }
  return out
}

export async function restoreBackup(backup: Backup, userId: string, onProgress?: (msg: string) => void): Promise<void> {
  validateBackup(backup)
  const [habits, exercises] = await Promise.all([all('habits'), all('exercises')])
  const prepared = prepareRestore(backup, userId, { habits, exercises })

  // Las fotos primero, para que sus filas nunca apunten a archivos inexistentes.
  for (let i = 0; i < backup.photos.length; i++) {
    onProgress?.(`Subiendo fotos ${i + 1}/${backup.photos.length}…`)
    const p = backup.photos[i]
    const path = p.path.replace(`${backup.user_id}/`, `${userId}/`)
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, base64ToBlob(p.data), { upsert: true, contentType: 'image/jpeg' })
    if (error) throw new Error(`Error al subir una foto: ${error.message}`)
  }
  const photoPaths = new Set(backup.photos.map((p) => p.path.replace(`${backup.user_id}/`, `${userId}/`)))

  for (const t of BACKUP_TABLES) {
    let rows = prepared[t]
    if (t === 'progress_photos' && backup.photos.length) rows = rows.filter((r) => photoPaths.has(String(r.storage_path)))
    if (t === 'progress_photos' && !backup.photos.length) continue
    for (let i = 0; i < rows.length; i += 500) {
      onProgress?.(`Restaurando ${t} (${Math.min(i + 500, rows.length)}/${rows.length})…`)
      // upsert idempotente: restaurar dos veces la misma copia no duplica nada.
      const { error } = await supabase.from(t).upsert(rows.slice(i, i + 500), { onConflict: CONFLICT[t] ?? 'id', defaultToNull: false })
      if (error) throw new Error(`Error restaurando ${t}: ${error.message}`)
    }
  }
}
