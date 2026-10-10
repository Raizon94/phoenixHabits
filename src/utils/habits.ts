import type { Habit, HabitLog } from '@/types'
import { addDays, eachDay, isoWeekday, toISODateInTz, type ISODate } from './date'

export type LogsByDate = Map<ISODate, HabitLog>
/** habit_id → (fecha → registro) */
export type LogIndex = Map<string, LogsByDate>

export function indexLogs(logs: HabitLog[]): LogIndex {
  const idx: LogIndex = new Map()
  for (const log of logs) {
    let byDate = idx.get(log.habit_id)
    if (!byDate) idx.set(log.habit_id, (byDate = new Map()))
    byDate.set(log.log_date, log)
  }
  return idx
}

export function isScheduled(habit: Pick<Habit, 'schedule_days'>, date: ISODate): boolean {
  return habit.schedule_days.includes(isoWeekday(date))
}

/** Un registro numérico se completa al alcanzar el objetivo; uno binario según su marca. */
export function isLogCompleted(habit: Pick<Habit, 'type' | 'target_value'>, log: Pick<HabitLog, 'completed' | 'value'> | undefined): boolean {
  if (!log) return false
  if (habit.type === 'numeric') {
    if (habit.target_value == null) return log.completed
    return (log.value ?? 0) >= habit.target_value
  }
  return log.completed
}

/** Calcula el flag completed que se guarda para un valor numérico. */
export function numericCompleted(target: number | null, value: number | null): boolean {
  if (value == null) return false
  if (target == null) return value > 0
  return value >= target
}

/**
 * Primer día en que el hábito cuenta: el día de creación (en la zona del usuario)
 * o el registro más antiguo si se registraron días anteriores.
 */
export function habitStartDate(habit: Pick<Habit, 'created_at'>, logs: LogsByDate | undefined, timeZone: string): ISODate {
  let start = toISODateInTz(new Date(habit.created_at), timeZone)
  if (logs) for (const d of logs.keys()) if (d < start) start = d
  return start
}

export interface StreakResult {
  current: number
  best: number
}

/**
 * Rachas de un hábito contando solo los días programados.
 * - Los días no programados se ignoran (ni suman ni rompen).
 * - Los días futuros no cuentan.
 * - Hoy, si aún no está completado, no rompe la racha (el día sigue en curso).
 */
export function computeHabitStreaks(
  habit: Pick<Habit, 'schedule_days' | 'type' | 'target_value'>,
  logs: LogsByDate | undefined,
  start: ISODate,
  today: ISODate,
): StreakResult {
  if (start > today || habit.schedule_days.length === 0) return { current: 0, best: 0 }
  let best = 0
  let run = 0
  for (const d of eachDay(start, today)) {
    if (!isScheduled(habit, d)) continue
    const done = isLogCompleted(habit, logs?.get(d))
    if (done) {
      run++
      if (run > best) best = run
    } else if (d !== today) {
      run = 0
    }
  }
  return { current: run, best }
}

export interface DayCompletion {
  scheduled: number
  completed: number
  /** 0..1, o null si no había nada programado ese día */
  ratio: number | null
}

export function dayCompletion(habits: Habit[], index: LogIndex, date: ISODate, starts?: Map<string, ISODate>): DayCompletion {
  let scheduled = 0
  let completed = 0
  for (const h of habits) {
    if (!isScheduled(h, date)) continue
    const st = starts?.get(h.id)
    if (st && date < st) continue
    scheduled++
    if (isLogCompleted(h, index.get(h.id)?.get(date))) completed++
  }
  return { scheduled, completed, ratio: scheduled ? completed / scheduled : null }
}

/**
 * Racha global: días consecutivos con TODOS los hábitos programados completados.
 * Los días sin hábitos programados se ignoran; hoy incompleto no rompe la racha.
 */
export function computeGlobalStreak(habits: Habit[], index: LogIndex, starts: Map<string, ISODate>, today: ISODate): StreakResult {
  if (habits.length === 0) return { current: 0, best: 0 }
  let earliest = today
  for (const s of starts.values()) if (s < earliest) earliest = s
  let best = 0
  let run = 0
  for (const d of eachDay(earliest, today)) {
    const c = dayCompletion(habits, index, d, starts)
    if (c.ratio === null) continue
    if (c.ratio === 1) {
      run++
      if (run > best) best = run
    } else if (d !== today) {
      run = 0
    }
  }
  return { current: run, best }
}

export interface CompletionRate {
  scheduled: number
  completed: number
  rate: number | null
}

/** % de cumplimiento de un hábito en [from, to], sin contar días futuros ni previos al inicio. */
export function habitCompletionRate(
  habit: Habit,
  logs: LogsByDate | undefined,
  start: ISODate,
  from: ISODate,
  to: ISODate,
  today: ISODate,
): CompletionRate {
  const realFrom = from < start ? start : from
  const realTo = to > today ? today : to
  let scheduled = 0
  let completed = 0
  if (realFrom <= realTo) {
    for (const d of eachDay(realFrom, realTo)) {
      if (!isScheduled(habit, d)) continue
      scheduled++
      if (isLogCompleted(habit, logs?.get(d))) completed++
    }
  }
  return { scheduled, completed, rate: scheduled ? completed / scheduled : null }
}

/** Cumplimiento global (todos los hábitos) en un periodo. */
export function globalCompletionRate(
  habits: Habit[],
  index: LogIndex,
  starts: Map<string, ISODate>,
  from: ISODate,
  to: ISODate,
  today: ISODate,
): CompletionRate {
  let scheduled = 0
  let completed = 0
  for (const h of habits) {
    const r = habitCompletionRate(h, index.get(h.id), starts.get(h.id) ?? from, from, to, today)
    scheduled += r.scheduled
    completed += r.completed
  }
  return { scheduled, completed, rate: scheduled ? completed / scheduled : null }
}

/** Número de días del periodo con todos los hábitos programados completados. */
export function perfectDays(habits: Habit[], index: LogIndex, starts: Map<string, ISODate>, from: ISODate, to: ISODate, today: ISODate): number {
  const realTo = to > today ? today : to
  let n = 0
  if (from > realTo) return 0
  for (const d of eachDay(from, realTo)) {
    const c = dayCompletion(habits, index, d, starts)
    if (c.ratio === 1) n++
  }
  return n
}

export function previousScheduledDay(habit: Pick<Habit, 'schedule_days'>, date: ISODate): ISODate | null {
  if (!habit.schedule_days.length) return null
  let d = addDays(date, -1)
  for (let i = 0; i < 7; i++, d = addDays(d, -1)) if (isScheduled(habit, d)) return d
  return null
}
