import type { WorkoutSet } from '@/types'
import { startOfMonth, startOfWeek, type ISODate } from './date'
import { epley1RM, exerciseVolume } from './workout'

export type Granularity = 'session' | 'week' | 'month'

export interface Point {
  date: ISODate
  maxWeight: number
  e1rm: number
  volume: number
  reps: number
}

/** Métricas por sesión de un ejercicio (solo series completadas que no son calentamiento). */
export function sessionPoint(h: { session_date: ISODate; sets: WorkoutSet[] }): Point {
  const work = h.sets.filter((s) => s.completed && s.set_type !== 'warmup')
  return {
    date: h.session_date,
    maxWeight: Math.max(0, ...work.map((s) => s.weight ?? 0)),
    e1rm: Math.max(0, ...work.map((s) => epley1RM(s.weight, s.reps))),
    volume: exerciseVolume(h.sets),
    reps: work.reduce((a, s) => a + (s.reps ?? 0), 0),
  }
}

/** Agrupa por semana/mes: máximos para peso y 1RM, sumas para volumen y repeticiones. */
export function aggregatePoints(points: Point[], g: Granularity): Point[] {
  if (g === 'session') return points
  const key = g === 'week' ? startOfWeek : startOfMonth
  const m = new Map<string, Point>()
  for (const p of points) {
    const k = key(p.date)
    const cur = m.get(k)
    m.set(
      k,
      cur
        ? { date: k, maxWeight: Math.max(cur.maxWeight, p.maxWeight), e1rm: Math.max(cur.e1rm, p.e1rm), volume: cur.volume + p.volume, reps: cur.reps + p.reps }
        : { ...p, date: k },
    )
  }
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date))
}

