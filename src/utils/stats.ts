import type { Habit } from '@/types'
import { addDays, addMonths, eachDay, endOfMonth, startOfMonth, startOfWeek, type ISODate } from './date'
import { dayCompletion, globalCompletionRate, type LogIndex } from './habits'

/** Cumplimiento global por semana (lunes) o por mes dentro de [from, today]. */
export function completionByPeriod(
  habits: Habit[],
  index: LogIndex,
  starts: Map<string, ISODate>,
  from: ISODate,
  today: ISODate,
  period: 'week' | 'month',
): { period: ISODate; rate: number | null }[] {
  const out: { period: ISODate; rate: number | null }[] = []
  let cur = period === 'week' ? startOfWeek(from) : startOfMonth(from)
  while (cur <= today) {
    const end = period === 'week' ? addDays(cur, 6) : endOfMonth(cur)
    const r = globalCompletionRate(habits, index, starts, cur < from ? from : cur, end, today)
    out.push({ period: cur, rate: r.rate })
    cur = period === 'week' ? addDays(cur, 7) : addMonths(cur, 1)
  }
  return out
}

/** Celdas del calendario de actividad estilo GitHub: columnas = semanas, filas = L..D. */
export function activityHeatmap(habits: Habit[], index: LogIndex, starts: Map<string, ISODate>, from: ISODate, today: ISODate) {
  const gridStart = startOfWeek(from)
  const weeks: { date: ISODate; ratio: number | null; future: boolean; before: boolean }[][] = []
  let week: (typeof weeks)[number] = []
  for (const d of eachDay(gridStart, addDays(startOfWeek(today), 6))) {
    const c = d > today || d < from ? null : dayCompletion(habits, index, d, starts).ratio
    week.push({ date: d, ratio: c, future: d > today, before: d < from })
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  return weeks
}

/** Nivel de intensidad 0..4 para el heatmap. */
export function heatLevel(ratio: number | null): number {
  if (ratio == null || ratio === 0) return 0
  if (ratio < 0.34) return 1
  if (ratio < 0.67) return 2
  if (ratio < 1) return 3
  return 4
}
