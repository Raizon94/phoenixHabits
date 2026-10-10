import { supabase } from '@/lib/supabase'
import { newId, nowISO } from '@/lib/id'
import type { Habit, HabitLog } from '@/types'
import type { ISODate } from '@/utils/date'
import { numericCompleted } from '@/utils/habits'
import { fetchAll, num, overlayPending, remove, unwrap, upsert } from './sync'

function normHabit(h: Habit): Habit {
  return { ...h, target_value: num(h.target_value), schedule_days: (h.schedule_days ?? []).map(Number).sort() }
}

function normLog(l: HabitLog): HabitLog {
  return { ...l, value: num(l.value) }
}

export async function fetchHabits(): Promise<Habit[]> {
  const rows = unwrap(await supabase.from('habits').select('*').order('sort_order').order('created_at'))
  return overlayPending('habits', rows as Habit[])
    .map(normHabit)
    .sort((a, b) => a.sort_order - b.sort_order)
}

/** Todos los registros de hábitos (paginados): las rachas y estadísticas usan el historial completo. */
export async function fetchHabitLogs(): Promise<HabitLog[]> {
  const rows = await fetchAll<HabitLog>((from, to) => supabase.from('habit_logs').select('*').order('log_date').range(from, to))
  return overlayPending('habit_logs', rows).map(normLog)
}

export function saveHabit(habit: Habit) {
  const row = { ...habit, name: habit.name.trim(), updated_at: nowISO() }
  upsert('habits', row as unknown as Record<string, unknown>)
  return row
}

export function newHabit(userId: string, sortOrder: number): Habit {
  const now = nowISO()
  return {
    id: newId(),
    user_id: userId,
    name: '',
    icon: 'check',
    color: '#f97316',
    type: 'binary',
    target_value: null,
    unit: null,
    schedule_days: [1, 2, 3, 4, 5, 6, 7],
    sort_order: sortOrder,
    system_key: null,
    archived_at: null,
    created_at: now,
    updated_at: now,
  }
}

export function deleteHabit(id: string) {
  remove('habits', { id })
}

/**
 * Crea o actualiza el registro de un día. Un único registro por hábito y día
 * (clave natural habit_id + log_date), así no hay duplicados entre dispositivos.
 */
export function buildLog(habit: Habit, userId: string, date: ISODate, patch: { completed?: boolean; value?: number | null }): HabitLog {
  let completed = patch.completed ?? false
  let value = patch.value ?? null
  if (habit.type === 'numeric' && patch.value !== undefined) {
    completed = numericCompleted(habit.target_value, value)
  } else if (habit.type === 'numeric' && patch.completed !== undefined) {
    // Marcar un hábito numérico como hecho rellena el objetivo; desmarcar lo pone a 0.
    value = patch.completed ? habit.target_value : 0
    completed = patch.completed
  }
  return { id: '', user_id: userId, habit_id: habit.id, log_date: date, completed, value, updated_at: nowISO() }
}

export function saveLog(log: HabitLog) {
  // Sin id: el servidor usa (habit_id, log_date) como clave de conflicto.
  const { id: _id, ...row } = log
  void _id
  upsert('habit_logs', row as unknown as Record<string, unknown>)
}
