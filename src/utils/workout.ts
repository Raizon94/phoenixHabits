import type {
  PreviousSet,
  RoutineWithExercises,
  SessionExerciseFull,
  SetType,
  UUID,
  WeightUnit,
  WorkoutExercise,
  WorkoutSession,
  WorkoutSet,
} from '@/types'
import type { ISODate } from './date'

export const LB_PER_KG = 2.20462262

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value
  return from === 'kg' ? value * LB_PER_KG : value / LB_PER_KG
}

export function round(value: number, decimals = 1): number {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

/**
 * 1RM estimado con la fórmula de Epley: peso × (1 + reps / 30).
 * Es una estimación, no una medición real.
 */
export function epley1RM(weight: number | null, reps: number | null): number {
  if (!weight || !reps || weight <= 0 || reps <= 0) return 0
  if (reps === 1) return weight
  return weight * (1 + reps / 30)
}

/** Series que cuentan para el volumen: completadas y que no son de calentamiento. */
export function countsForVolume(set: Pick<WorkoutSet, 'completed' | 'set_type'>): boolean {
  return set.completed && set.set_type !== 'warmup'
}

export function setVolume(set: Pick<WorkoutSet, 'weight' | 'reps' | 'completed' | 'set_type'>): number {
  if (!countsForVolume(set)) return 0
  return (set.weight ?? 0) * (set.reps ?? 0)
}

/** Volumen de un ejercicio en su propia unidad. */
export function exerciseVolume(sets: Pick<WorkoutSet, 'weight' | 'reps' | 'completed' | 'set_type'>[]): number {
  return sets.reduce((acc, s) => acc + setVolume(s), 0)
}

/** Volumen total de una sesión convertido a la unidad pedida. */
export function sessionVolume(exercises: Pick<SessionExerciseFull, 'exercise' | 'sets'>[], unit: WeightUnit): number {
  return exercises.reduce((acc, ex) => acc + convertWeight(exerciseVolume(ex.sets), ex.exercise.weight_unit, unit), 0)
}

export function completedSetCount(exercises: Pick<SessionExerciseFull, 'sets'>[]): number {
  return exercises.reduce((acc, ex) => acc + ex.sets.filter((s) => s.completed).length, 0)
}

/** Agrupa las filas de la RPC last_completed_sets por ejercicio, ordenadas por posición. */
export function groupPreviousSets(rows: PreviousSet[]): Map<UUID, PreviousSet[]> {
  const map = new Map<UUID, PreviousSet[]>()
  for (const r of rows) {
    const list = map.get(r.exercise_id) ?? []
    list.push(r)
    map.set(r.exercise_id, list)
  }
  for (const list of map.values()) list.sort((a, b) => a.position - b.position)
  return map
}

export interface SessionDraft {
  session: WorkoutSession
  exercises: WorkoutExercise[]
  sets: WorkoutSet[]
}

export interface DraftOptions {
  userId: UUID
  sessionDate: ISODate
  now: string
  newId: () => UUID
  /** Nº de series vacías si un ejercicio no tiene historial ni plantilla. */
  defaultSets?: number
}

/**
 * Construye una nueva sesión a partir de una rutina (sobrecarga progresiva).
 *
 * Para cada ejercicio, las series se precargan con:
 *  1. Las series de la última sesión COMPLETADA de ese ejercicio (de cualquier rutina),
 *     respetando su número de series, tipo, peso y repeticiones.
 *  2. Si nunca se ha hecho, las series plantilla de la rutina.
 *  3. Si tampoco hay plantilla, `defaultSets` series vacías.
 *
 * Siempre se crean filas NUEVAS (ids nuevos): el historial anterior nunca se modifica.
 */
export function buildSessionDraft(routine: RoutineWithExercises, previous: Map<UUID, PreviousSet[]>, opts: DraftOptions): SessionDraft {
  const { userId, sessionDate, now, newId, defaultSets = 3 } = opts
  const session: WorkoutSession = {
    id: newId(),
    user_id: userId,
    routine_id: routine.id,
    routine_name: routine.name,
    session_date: sessionDate,
    started_at: now,
    ended_at: null,
    status: 'in_progress',
    notes: null,
    created_at: now,
    updated_at: now,
  }
  const exercises: WorkoutExercise[] = []
  const sets: WorkoutSet[] = []
  const ordered = [...routine.exercises].sort((a, b) => a.position - b.position)
  ordered.forEach((re, i) => {
    const we: WorkoutExercise = {
      id: newId(),
      user_id: userId,
      session_id: session.id,
      exercise_id: re.exercise_id,
      position: i,
      notes: null,
      updated_at: now,
    }
    exercises.push(we)
    const prev = previous.get(re.exercise_id)
    let template: { set_type: SetType; weight: number | null; reps: number | null }[]
    if (prev && prev.length) {
      template = prev.map((p) => ({ set_type: p.set_type, weight: p.weight, reps: p.reps }))
    } else if (re.sets.length) {
      template = [...re.sets]
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ set_type: s.set_type, weight: s.target_weight, reps: s.target_reps }))
    } else {
      template = Array.from({ length: defaultSets }, () => ({ set_type: 'normal' as SetType, weight: null, reps: null }))
    }
    template.forEach((t, pos) => {
      sets.push({
        id: newId(),
        user_id: userId,
        workout_exercise_id: we.id,
        position: pos,
        set_type: t.set_type,
        weight: t.weight,
        reps: t.reps,
        completed: false,
        completed_at: null,
        updated_at: now,
      })
    })
  })
  return { session, exercises, sets }
}

/** Para una serie de la sesión actual, la serie equivalente de la sesión anterior (misma posición). */
export function previousForPosition(previous: PreviousSet[] | undefined, position: number): PreviousSet | undefined {
  return previous?.find((p) => p.position === position)
}

export interface ExerciseBest {
  maxWeight: number
  best1RM: number
  bestSetVolume: number
}

export const EMPTY_BEST: ExerciseBest = { maxWeight: 0, best1RM: 0, bestSetVolume: 0 }

export function bestOfSets(sets: Pick<WorkoutSet, 'weight' | 'reps' | 'completed' | 'set_type'>[]): ExerciseBest {
  const best = { ...EMPTY_BEST }
  for (const s of sets) {
    if (!s.completed || s.set_type === 'warmup') continue
    const w = s.weight ?? 0
    const r = s.reps ?? 0
    if (r <= 0) continue
    best.maxWeight = Math.max(best.maxWeight, w)
    best.best1RM = Math.max(best.best1RM, epley1RM(w, r))
    best.bestSetVolume = Math.max(best.bestSetVolume, w * r)
  }
  return best
}

export type PRKind = 'weight' | '1rm' | 'volume'
export interface PersonalRecord {
  exercise_id: UUID
  kind: PRKind
  value: number
  previous: number
}

/** Récords nuevos de una sesión comparados con el mejor histórico previo de cada ejercicio. */
export function detectPRs(exercises: Pick<SessionExerciseFull, 'exercise_id' | 'sets'>[], historicalBest: Map<UUID, ExerciseBest>): PersonalRecord[] {
  const prs: PersonalRecord[] = []
  for (const ex of exercises) {
    const cur = bestOfSets(ex.sets)
    const prev = historicalBest.get(ex.exercise_id)
    // Sin historial previo no hay récord que "batir": la primera sesión establece la marca.
    if (!prev) continue
    if (cur.maxWeight > prev.maxWeight) prs.push({ exercise_id: ex.exercise_id, kind: 'weight', value: cur.maxWeight, previous: prev.maxWeight })
    if (cur.best1RM > prev.best1RM + 1e-9) prs.push({ exercise_id: ex.exercise_id, kind: '1rm', value: cur.best1RM, previous: prev.best1RM })
    if (cur.bestSetVolume > prev.bestSetVolume) prs.push({ exercise_id: ex.exercise_id, kind: 'volume', value: cur.bestSetVolume, previous: prev.bestSetVolume })
  }
  return prs
}

export function mergeBest(a: ExerciseBest, b: ExerciseBest): ExerciseBest {
  return {
    maxWeight: Math.max(a.maxWeight, b.maxWeight),
    best1RM: Math.max(a.best1RM, b.best1RM),
    bestSetVolume: Math.max(a.bestSetVolume, b.bestSetVolume),
  }
}

export function sessionDurationSeconds(session: Pick<WorkoutSession, 'started_at' | 'ended_at'>, now: number = Date.now()): number {
  const start = new Date(session.started_at).getTime()
  const end = session.ended_at ? new Date(session.ended_at).getTime() : now
  return Math.max(0, Math.round((end - start) / 1000))
}

/** Renumera posiciones 0..n-1 tras añadir/eliminar/reordenar. */
export function renumber<T extends { position: number }>(items: T[]): T[] {
  return items.map((it, i) => (it.position === i ? it : { ...it, position: i }))
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list
  const copy = [...list]
  const [it] = copy.splice(from, 1)
  copy.splice(to, 0, it)
  return copy
}
