import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** true si faltan las variables de entorno públicas de Supabase. */
export const supabaseMissingConfig = !url || !anonKey || url.includes('TU-PROYECTO')

// Solo se usan claves públicas (anon). La seguridad de los datos depende de RLS.
export const supabase: SupabaseClient = createClient(url || 'http://localhost:54321', anonKey || 'missing-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'phoenix.auth',
  },
})

export const PHOTO_BUCKET = 'progress-photos'
