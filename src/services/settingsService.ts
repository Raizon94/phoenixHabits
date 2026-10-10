import { supabase } from '@/lib/supabase'
import { nowISO } from '@/lib/id'
import type { UserSettings } from '@/types'
import { defaultTimezone } from '@/utils/date'
import { num, overlayPending, upsert } from './sync'

export function defaultSettings(userId: string): UserSettings {
  return { user_id: userId, theme: 'dark', weight_unit: 'kg', target_weight_kg: null, timezone: defaultTimezone(), locale: 'es', updated_at: nowISO() }
}

export async function fetchSettings(userId: string): Promise<UserSettings> {
  const { data, error } = await supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  const rows = overlayPending('user_settings', data ? [data as UserSettings] : [], (r) => r.user_id === userId)
  const s = rows[0]
  if (!s) {
    // Fila ausente (p. ej. migración aplicada tras crear el usuario): se crea con valores por defecto.
    const d = defaultSettings(userId)
    upsert('user_settings', d as unknown as Record<string, unknown>)
    return d
  }
  return { ...s, target_weight_kg: num(s.target_weight_kg) }
}

export function saveSettings(s: UserSettings): UserSettings {
  const row = { ...s, updated_at: nowISO() }
  upsert('user_settings', row as unknown as Record<string, unknown>)
  return row
}
