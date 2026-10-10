import { describe, expect, it } from 'vitest'
import type { Habit, HabitLog } from '@/types'
import { computeGlobalStreak, computeHabitStreaks, habitCompletionRate, indexLogs, isLogCompleted, numericCompleted, perfectDays } from '@/utils/habits'

const ALL = [1, 2, 3, 4, 5, 6, 7]
function habit(p: Partial<Habit> = {}): Habit {
  return {
    id: p.id ?? 'h1', user_id: 'u', name: 'H', icon: 'check', color: '#f97316', type: 'binary', target_value: null, unit: null,
    schedule_days: ALL, sort_order: 0, system_key: null, archived_at: null, created_at: '2026-09-01T10:00:00Z', updated_at: '', ...p,
  }
}
function log(habit_id: string, log_date: string, completed = true, value: number | null = null): HabitLog {
  return { id: `${habit_id}-${log_date}`, user_id: 'u', habit_id, log_date, completed, value, updated_at: '' }
}
const byDate = (logs: HabitLog[]) => indexLogs(logs).get(logs[0]?.habit_id ?? '') ?? new Map()

describe('rachas', () => {
  it('cuenta días consecutivos completados', () => {
    const logs = ['2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'].map((d) => log('h1', d))
    // 2026-10-10 es hoy y aún no está completado: no rompe la racha
    expect(computeHabitStreaks(habit(), byDate(logs), '2026-10-01', '2026-10-10')).toEqual({ current: 4, best: 4 })
  })

  it('un día programado sin completar rompe la racha', () => {
    const logs = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-09'].map((d) => log('h1', d))
    expect(computeHabitStreaks(habit(), byDate(logs), '2026-10-05', '2026-10-10')).toEqual({ current: 1, best: 3 })
  })

  it('solo tiene en cuenta los días programados', () => {
    // Lunes, miércoles, viernes. 2026-10-05 es lunes.
    const h = habit({ schedule_days: [1, 3, 5] })
    const logs = ['2026-10-05', '2026-10-07', '2026-10-09'].map((d) => log('h1', d))
    // Sábado 10: no programado; martes/jueves no rompen.
    expect(computeHabitStreaks(h, byDate(logs), '2026-10-05', '2026-10-10')).toEqual({ current: 3, best: 3 })
  })

  it('los días futuros no se cuentan como incumplimientos', () => {
    const logs = [log('h1', '2026-10-09')]
    const res = computeHabitStreaks(habit(), byDate(logs), '2026-10-09', '2026-10-09')
    expect(res.current).toBe(1)
    const rate = habitCompletionRate(habit(), byDate(logs), '2026-10-09', '2026-10-05', '2026-10-11', '2026-10-09')
    expect(rate).toEqual({ scheduled: 1, completed: 1, rate: 1 })
  })

  it('hoy completado suma a la racha', () => {
    const logs = ['2026-10-09', '2026-10-10'].map((d) => log('h1', d))
    expect(computeHabitStreaks(habit(), byDate(logs), '2026-10-01', '2026-10-10').current).toBe(2)
  })

  it('hábitos numéricos se completan al alcanzar el objetivo', () => {
    const h = habit({ type: 'numeric', target_value: 10000 })
    expect(isLogCompleted(h, log('h1', '2026-10-10', false, 10000))).toBe(true)
    expect(isLogCompleted(h, log('h1', '2026-10-10', true, 9999))).toBe(false)
    expect(numericCompleted(10000, 12000)).toBe(true)
    expect(numericCompleted(10000, null)).toBe(false)
  })

  it('racha global requiere todos los hábitos programados', () => {
    const a = habit({ id: 'a' })
    const b = habit({ id: 'b', schedule_days: [1, 2, 3, 4, 5] }) // no fines de semana
    const logs = [
      log('a', '2026-10-08'), log('b', '2026-10-08'),
      log('a', '2026-10-09'), log('b', '2026-10-09'),
      log('a', '2026-10-10'), // sábado: b no programado
      log('a', '2026-10-07'), // b falló el 7
    ]
    const idx = indexLogs(logs)
    const starts = new Map([['a', '2026-10-07'], ['b', '2026-10-07']])
    expect(computeGlobalStreak([a, b], idx, starts, '2026-10-10')).toEqual({ current: 3, best: 3 })
    expect(perfectDays([a, b], idx, starts, '2026-10-01', '2026-10-31', '2026-10-10')).toBe(3)
  })

  it('no cuenta días anteriores a la creación del hábito', () => {
    const logs = [log('h1', '2026-10-10')]
    const rate = habitCompletionRate(habit(), byDate(logs), '2026-10-10', '2026-10-01', '2026-10-31', '2026-10-10')
    expect(rate.scheduled).toBe(1)
  })
})
