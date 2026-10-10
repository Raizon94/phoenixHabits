import { PHOTO_BUCKET, supabase } from '@/lib/supabase'
import { newId, nowISO } from '@/lib/id'
import type { BodyWeightLog, ProgressPhoto } from '@/types'
import type { ISODate } from '@/utils/date'
import { compressImage } from '@/utils/image'
import { fetchAll, num, overlayPending, remove, upsert } from './sync'

// ───────────── Peso corporal ─────────────

export async function fetchWeightLogs(): Promise<BodyWeightLog[]> {
  const rows = await fetchAll<BodyWeightLog>((f, t) => supabase.from('body_weight_logs').select('*').order('log_date').range(f, t))
  return overlayPending('body_weight_logs', rows)
    .map((r) => ({ ...r, weight_kg: num(r.weight_kg) ?? 0 }))
    .sort((a, b) => a.log_date.localeCompare(b.log_date))
}

/** Guarda el peso de un día. Si ya existe registro ese día, se actualiza (uno por día). */
export function saveWeight(userId: string, date: ISODate, weightKg: number, notes: string | null, existing?: BodyWeightLog): BodyWeightLog {
  const now = nowISO()
  const row: BodyWeightLog = {
    id: existing?.id ?? newId(),
    user_id: userId,
    log_date: date,
    weight_kg: Math.round(weightKg * 100) / 100,
    notes: notes?.trim() || null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  }
  upsert('body_weight_logs', row as unknown as Record<string, unknown>)
  return row
}

export function deleteWeight(log: BodyWeightLog) {
  remove('body_weight_logs', { user_id: log.user_id, log_date: log.log_date })
}

// ───────────── Fotografías (bucket privado + URLs firmadas) ─────────────

export async function fetchPhotos(): Promise<ProgressPhoto[]> {
  const rows = await fetchAll<ProgressPhoto>((f, t) => supabase.from('progress_photos').select('*').order('photo_date', { ascending: false }).range(f, t))
  return rows.sort((a, b) => (a.photo_date === b.photo_date ? b.created_at.localeCompare(a.created_at) : b.photo_date.localeCompare(a.photo_date)))
}

const SIGNED_URL_TTL = 60 * 10 // 10 minutos

/** URLs firmadas de corta duración para un conjunto de rutas privadas. */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {}
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL)
  if (error) throw new Error(error.message)
  const out: Record<string, string> = {}
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl
  return out
}

/**
 * Comprime y sube una foto. Las fotos necesitan conexión: el archivo va a Storage
 * y después se registra la fila en la base de datos.
 */
export async function uploadPhoto(userId: string, file: File, date: ISODate, notes: string | null): Promise<ProgressPhoto> {
  const compressed = await compressImage(file)
  const id = newId()
  const path = `${userId}/${date}/${id}.jpg`
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, compressed.blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '3600' })
  if (error) throw new Error(error.message)
  const now = nowISO()
  const row: ProgressPhoto = {
    id, user_id: userId, photo_date: date, storage_path: path, notes: notes?.trim() || null,
    width: compressed.width, height: compressed.height, size_bytes: compressed.blob.size, created_at: now, updated_at: now,
  }
  const res = await supabase.from('progress_photos').insert(row)
  if (res.error) {
    await supabase.storage.from(PHOTO_BUCKET).remove([path])
    throw new Error(res.error.message)
  }
  return row
}

export function updatePhoto(photo: ProgressPhoto) {
  upsert('progress_photos', { ...photo, updated_at: nowISO() } as unknown as Record<string, unknown>)
}

export async function deletePhoto(photo: ProgressPhoto) {
  const { error } = await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path])
  if (error) throw new Error(error.message)
  const { error: delErr } = await supabase.rpc('sync_delete', { p_table: 'progress_photos', p_key: photo.id, p_deleted_at: nowISO() })
  if (delErr) throw new Error(delErr.message)
}
