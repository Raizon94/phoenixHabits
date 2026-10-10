import { PHOTO_BUCKET, supabase } from '@/lib/supabase'
import { fetchAll, getQueue, hasQueue } from './sync'

/** Tablas que RENACER vacía (las plantillas de entrenamiento se conservan). */
const WIPED = ['habit_logs', 'workout_sessions', 'workout_exercises', 'workout_sets', 'body_weight_logs', 'progress_photos'] as const

/**
 * RENACER: reinicia todos los datos como si todo empezase ahora.
 * Requiere conexión. Primero borra los archivos de fotos y después llama a la RPC
 * transaccional `rebirth()`, que vacía los registros y reinicia la fecha de inicio.
 */
export async function rebirth(onProgress?: (msg: string) => void): Promise<string> {
  // Los cambios pendientes de esas tablas recrearían datos borrados: se descartan.
  if (hasQueue()) {
    getQueue().dropTables([...WIPED])
    await getQueue().flush()
  }
  onProgress?.('Borrando fotos…')
  const photos = await fetchAll<{ storage_path: string }>((f, t) => supabase.from('progress_photos').select('storage_path').range(f, t))
  for (let i = 0; i < photos.length; i += 100) {
    const { error } = await supabase.storage.from(PHOTO_BUCKET).remove(photos.slice(i, i + 100).map((p) => p.storage_path))
    if (error) throw new Error(`No se pudieron borrar las fotos: ${error.message}`)
  }
  onProgress?.('Reiniciando registros…')
  const { data, error } = await supabase.rpc('rebirth')
  if (error) throw new Error(error.message)
  try {
    localStorage.removeItem('phoenix.activeSession')
  } catch {
    /* noop */
  }
  return data as string
}
