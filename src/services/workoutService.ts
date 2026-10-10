import { supabase } from '@/lib/supabase'
import { newId, nowISO } from '@/lib/id'
import type {
  Exercise,
  PreviousSet,
  RoutineExercise,
  RoutineSet,
  RoutineWithExercises,
  SessionFull,
  SetType,
  WorkoutExercise,
  WorkoutRoutine,
  WorkoutSession,
  WorkoutSet,
} from '@/types'
import type { ISODate } from '@/utils/date'
import { bestOfSets, buildSessionDraft, groupPreviousSets, mergeBest, type ExerciseBest } from '@/utils/workout'
import { fetchAll, getQueue, num, overlayPending, remove, unwrap, upsert, write } from './sync'
import type { Row } from './syncQueue'

const asRow = (x: object) => x as unknown as Row

// ───────────── Ejercicios ─────────────

export async function fetchExercises(): Promise<Exercise[]> {
  const rows = await fetchAll<Exercise>((f, t) => supabase.from('exercises').select('*').order('name').range(f, t))
  return overlayPending('exercises', rows).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export function newExercise(userId: string, unit: Exercise['weight_unit']): Exercise {
  const now = nowISO()
  return { id: newId(), user_id: userId, name: '', muscle_group: 'chest', exercise_type: 'weight_reps', notes: null, weight_unit: unit, archived_at: null, created_at: now, updated_at: now }
}

export function saveExercise(ex: Exercise): Exercise {
  const row = { ...ex, name: ex.name.trim(), notes: ex.notes?.trim() || null, updated_at: nowISO() }
  upsert('exercises', asRow(row))
  return row
}

/** ¿Tiene el ejercicio sesiones registradas? (si es así se archiva en vez de borrarse) */
export async function exerciseHasHistory(exerciseId: string): Promise<boolean> {
  const { count, error } = await supabase.from('workout_exercises').select('id', { count: 'exact', head: true }).eq('exercise_id', exerciseId)
  if (error) throw new Error(error.message)
  return (count ?? 0) > 0
}

export function deleteExercise(id: string) {
  remove('exercises', { id })
}

// ───────────── Rutinas ─────────────

export async function fetchRoutines(exercises: Exercise[]): Promise<RoutineWithExercises[]> {
  const [routines, res, sets] = await Promise.all([
    fetchAll<WorkoutRoutine>((f, t) => supabase.from('workout_routines').select('*').order('sort_order').range(f, t)),
    fetchAll<RoutineExercise>((f, t) => supabase.from('routine_exercises').select('*').order('position').range(f, t)),
    fetchAll<RoutineSet>((f, t) => supabase.from('routine_sets').select('*').order('position').range(f, t)),
  ])
  return assembleRoutines(
    overlayPending('workout_routines', routines),
    overlayPending('routine_exercises', res),
    overlayPending('routine_sets', sets).map((s) => ({ ...s, target_weight: num(s.target_weight) })),
    exercises,
  )
}

export function assembleRoutines(routines: WorkoutRoutine[], res: RoutineExercise[], sets: RoutineSet[], exercises: Exercise[]): RoutineWithExercises[] {
  const exById = new Map(exercises.map((e) => [e.id, e]))
  const setsByRe = new Map<string, RoutineSet[]>()
  for (const s of sets) setsByRe.set(s.routine_exercise_id, [...(setsByRe.get(s.routine_exercise_id) ?? []), s])
  return routines
    .map((r) => ({
      ...r,
      exercises: res
        .filter((re) => re.routine_id === r.id && exById.has(re.exercise_id))
        .sort((a, b) => a.position - b.position)
        .map((re) => ({ ...re, exercise: exById.get(re.exercise_id)!, sets: (setsByRe.get(re.id) ?? []).sort((a, b) => a.position - b.position) })),
    }))
    .sort((a, b) => a.sort_order - b.sort_order)
}

export function newRoutine(userId: string, sortOrder: number): WorkoutRoutine {
  const now = nowISO()
  return { id: newId(), user_id: userId, name: '', description: null, sort_order: sortOrder, created_at: now, updated_at: now }
}

/** Guarda una rutina completa (cabecera, ejercicios y series plantilla), borrando lo eliminado. */
export function saveRoutineFull(next: RoutineWithExercises, prev: RoutineWithExercises | null) {
  const now = nowISO()
  const { exercises, ...routine } = next
  const ops: Parameters<typeof write>[0] = []
  ops.push({ table: 'workout_routines', kind: 'upsert', row: asRow({ ...routine, name: routine.name.trim(), description: routine.description?.trim() || null, updated_at: now }) })
  exercises.forEach((re, i) => {
    const { exercise: _e, sets, ...reRow } = re
    void _e
    ops.push({ table: 'routine_exercises', kind: 'upsert', row: asRow({ ...reRow, position: i, updated_at: now }) })
    sets.forEach((s, j) => ops.push({ table: 'routine_sets', kind: 'upsert', row: asRow({ ...s, position: j, updated_at: now }) }))
  })
  if (prev) {
    const keepRe = new Set(exercises.map((e) => e.id))
    const keepSets = new Set(exercises.flatMap((e) => e.sets.map((s) => s.id)))
    for (const re of prev.exercises) {
      if (!keepRe.has(re.id)) ops.push({ table: 'routine_exercises', kind: 'delete', match: { id: re.id } })
      else for (const s of re.sets) if (!keepSets.has(s.id)) ops.push({ table: 'routine_sets', kind: 'delete', match: { id: s.id } })
    }
  }
  write(ops)
}

export function duplicateRoutine(src: RoutineWithExercises, sortOrder: number): RoutineWithExercises {
  const now = nowISO()
  const id = newId()
  const copy: RoutineWithExercises = {
    ...src,
    id,
    name: `${src.name} (copia)`.slice(0, 60),
    sort_order: sortOrder,
    created_at: now,
    updated_at: now,
    exercises: src.exercises.map((re) => {
      const reId = newId()
      return { ...re, id: reId, routine_id: id, sets: re.sets.map((s) => ({ ...s, id: newId(), routine_exercise_id: reId })) }
    }),
  }
  saveRoutineFull(copy, null)
  return copy
}

export function deleteRoutine(id: string) {
  remove('workout_routines', { id })
}

export function reorderRoutines(routines: WorkoutRoutine[]) {
  const now = nowISO()
  write(routines.map((r, i) => ({ table: 'workout_routines' as const, kind: 'upsert' as const, row: asRow({ ...stripRoutine(r), sort_order: i, updated_at: now }) })))
}

function stripRoutine(r: WorkoutRoutine | RoutineWithExercises): WorkoutRoutine {
  const { id, user_id, name, description, sort_order, created_at, updated_at } = r
  return { id, user_id, name, description, sort_order, created_at, updated_at }
}

export function newRoutineSet(userId: string, routineExerciseId: string, position: number, base?: Partial<RoutineSet>): RoutineSet {
  return { id: newId(), user_id: userId, routine_exercise_id: routineExerciseId, position, set_type: 'normal', target_weight: null, target_reps: null, updated_at: nowISO(), ...base }
}

// ───────────── Sesiones ─────────────

function normSet(s: WorkoutSet): WorkoutSet {
  return { ...s, weight: num(s.weight), reps: s.reps == null ? null : Number(s.reps) }
}

/** Series de la última sesión completada de cada ejercicio (RPC con RLS). */
export async function fetchPreviousSets(exerciseIds: string[]): Promise<Map<string, PreviousSet[]>> {
  if (!exerciseIds.length) return new Map()
  const { data, error } = await supabase.rpc('last_completed_sets', { p_exercise_ids: exerciseIds })
  if (error) throw new Error(error.message)
  return groupPreviousSets(((data ?? []) as PreviousSet[]).map((p) => ({ ...p, weight: num(p.weight) })))
}

export async function fetchActiveSessionId(): Promise<string | null> {
  const { data, error } = await supabase.from('workout_sessions').select('id').eq('status', 'in_progress').limit(1)
  if (error) throw new Error(error.message)
  const pending = overlayPending('workout_sessions', (data ?? []) as Row[], (r) => r.status === 'in_progress')
  const active = pending.find((r) => r.status === undefined || r.status === 'in_progress')
  return (active?.id as string) ?? null
}

export async function fetchSessionFull(id: string, exercises: Exercise[]): Promise<SessionFull | null> {
  const { data: s, error } = await supabase.from('workout_sessions').select('*').eq('id', id).maybeSingle()
  if (error) throw new Error(error.message)
  const sessions = overlayPending('workout_sessions', s ? [s as WorkoutSession] : [], (r) => r.id === id)
  const session = sessions.find((x) => x.id === id)
  if (!session) return null
  const wes = overlayPending(
    'workout_exercises',
    unwrap(await supabase.from('workout_exercises').select('*').eq('session_id', id).order('position')) as WorkoutExercise[],
    (r) => r.session_id === id,
  )
  const weIds = wes.map((w) => w.id)
  const sets = weIds.length
    ? overlayPending(
        'workout_sets',
        unwrap(await supabase.from('workout_sets').select('*').in('workout_exercise_id', weIds).order('position')) as WorkoutSet[],
        (r) => weIds.includes(r.workout_exercise_id),
      )
    : []
  return assembleSession(session, wes, sets.map(normSet), exercises)
}

export function assembleSession(session: WorkoutSession, wes: WorkoutExercise[], sets: WorkoutSet[], exercises: Exercise[]): SessionFull {
  const exById = new Map(exercises.map((e) => [e.id, e]))
  return {
    ...session,
    exercises: wes
      .filter((we) => exById.has(we.exercise_id))
      .sort((a, b) => a.position - b.position)
      .map((we) => ({
        ...we,
        exercise: exById.get(we.exercise_id)!,
        sets: sets.filter((s) => s.workout_exercise_id === we.id).sort((a, b) => a.position - b.position),
      })),
  }
}

/** Crea una sesión nueva precargando las series de la última sesión de cada ejercicio. */
export async function startSession(routine: RoutineWithExercises, userId: string, date: ISODate): Promise<{ session: SessionFull; previous: Map<string, PreviousSet[]> }> {
  let previous = new Map<string, PreviousSet[]>()
  try {
    previous = await fetchPreviousSets(routine.exercises.map((e) => e.exercise_id))
  } catch {
    // Sin conexión: se usan las plantillas de la rutina; los datos se completan al reconectar.
  }
  const draft = buildSessionDraft(routine, previous, { userId, sessionDate: date, now: nowISO(), newId })
  write([
    { table: 'workout_sessions', kind: 'upsert', row: asRow(draft.session) },
    ...draft.exercises.map((e) => ({ table: 'workout_exercises' as const, kind: 'upsert' as const, row: asRow(e) })),
    ...draft.sets.map((s) => ({ table: 'workout_sets' as const, kind: 'upsert' as const, row: asRow(s) })),
  ])
  const exercises = routine.exercises.map((re) => re.exercise)
  return { session: assembleSession(draft.session, draft.exercises, draft.sets, exercises), previous }
}

export function startEmptySession(userId: string, date: ISODate, name: string): SessionFull {
  const now = nowISO()
  const session: WorkoutSession = {
    id: newId(), user_id: userId, routine_id: null, routine_name: name, session_date: date, started_at: now,
    ended_at: null, status: 'in_progress', notes: null, created_at: now, updated_at: now,
  }
  upsert('workout_sessions', asRow(session))
  return { ...session, exercises: [] }
}

export function saveSessionHeader(s: WorkoutSession) {
  const { id, user_id, routine_id, routine_name, session_date, started_at, ended_at, status, notes, created_at } = s
  upsert('workout_sessions', asRow({ id, user_id, routine_id, routine_name, session_date, started_at, ended_at, status, notes, created_at, updated_at: nowISO() }))
}

export function saveWorkoutExercise(we: WorkoutExercise) {
  const { id, user_id, session_id, exercise_id, position, notes } = we
  upsert('workout_exercises', asRow({ id, user_id, session_id, exercise_id, position, notes, updated_at: nowISO() }))
}

export function saveSet(s: WorkoutSet) {
  const { id, user_id, workout_exercise_id, position, set_type, weight, reps, completed, completed_at } = s
  upsert('workout_sets', asRow({ id, user_id, workout_exercise_id, position, set_type, weight, reps, completed, completed_at, updated_at: nowISO() }))
}

export function deleteSet(id: string) {
  remove('workout_sets', { id })
}

export function deleteWorkoutExercise(id: string) {
  remove('workout_exercises', { id })
}

export function deleteSession(id: string, workoutExerciseIds: string[] = []) {
  // Las escrituras pendientes de sus ejercicios/series ya no tienen sentido (y fallarían por FK).
  const weIds = new Set(workoutExerciseIds)
  getQueue().dropWhere(
    (o) =>
      (o.table === 'workout_exercises' && (o.row?.session_id === id || weIds.has(String(o.row?.id ?? o.match?.id)))) ||
      (o.table === 'workout_sets' && weIds.has(String(o.row?.workout_exercise_id))),
  )
  remove('workout_sessions', { id })
}

export function newWorkoutSet(userId: string, weId: string, position: number, base?: { set_type?: SetType; weight?: number | null; reps?: number | null }): WorkoutSet {
  return {
    id: newId(), user_id: userId, workout_exercise_id: weId, position, set_type: base?.set_type ?? 'normal',
    weight: base?.weight ?? null, reps: base?.reps ?? null, completed: false, completed_at: null, updated_at: nowISO(),
  }
}

// ───────────── Historial y estadísticas ─────────────

export interface SessionSummary {
  session_id: string
  routine_id: string | null
  routine_name: string
  session_date: ISODate
  started_at: string
  ended_at: string | null
  status: WorkoutSession['status']
  duration_seconds: number
  exercise_count: number
  completed_sets: number
  volume_kg: number
}

export async function fetchSessionSummaries(opts: { from?: ISODate; to?: ISODate; routineId?: string } = {}): Promise<SessionSummary[]> {
  const rows = await fetchAll<SessionSummary>((f, t) => {
    let q = supabase.from('workout_session_summaries').select('*').eq('status', 'completed')
    if (opts.from) q = q.gte('session_date', opts.from)
    if (opts.to) q = q.lte('session_date', opts.to)
    if (opts.routineId) q = q.eq('routine_id', opts.routineId)
    return q.order('session_date', { ascending: false }).order('started_at', { ascending: false }).range(f, t)
  })
  return rows.map((r) => ({ ...r, volume_kg: num(r.volume_kg) ?? 0 }))
}

export interface ExerciseHistoryEntry {
  workout_exercise_id: string
  exercise_id: string
  session_id: string
  session_date: ISODate
  ended_at: string | null
  routine_name: string
  sets: WorkoutSet[]
}

/** Historial completo de sesiones completadas, opcionalmente filtrado por ejercicio o fechas. */
export async function fetchExerciseHistory(opts: { exerciseIds?: string[]; from?: ISODate; to?: ISODate; excludeSessionId?: string } = {}): Promise<ExerciseHistoryEntry[]> {
  type Raw = { id: string; exercise_id: string; session: { id: string; session_date: string; ended_at: string | null; routine_name: string; status: string }; sets: WorkoutSet[] }
  const rows = await fetchAll<Raw>((f, t) => {
    let q = supabase
      .from('workout_exercises')
      .select('id, exercise_id, session:workout_sessions!inner(id, session_date, ended_at, routine_name, status), sets:workout_sets(*)')
      .eq('session.status', 'completed')
    if (opts.exerciseIds) q = q.in('exercise_id', opts.exerciseIds)
    if (opts.from) q = q.gte('session.session_date', opts.from)
    if (opts.to) q = q.lte('session.session_date', opts.to)
    if (opts.excludeSessionId) q = q.neq('session_id', opts.excludeSessionId)
    return q.order('id').range(f, t) as unknown as PromiseLike<{ data: Raw[] | null; error: { message: string } | null }>
  })
  return rows
    .map((r) => ({
      workout_exercise_id: r.id,
      exercise_id: r.exercise_id,
      session_id: r.session.id,
      session_date: r.session.session_date,
      ended_at: r.session.ended_at,
      routine_name: r.session.routine_name,
      sets: (r.sets ?? []).map(normSet).sort((a, b) => a.position - b.position),
    }))
    .sort((a, b) => (a.session_date === b.session_date ? (a.ended_at ?? '').localeCompare(b.ended_at ?? '') : a.session_date.localeCompare(b.session_date)))
}

/** Mejor marca histórica de cada ejercicio (excluyendo una sesión), para detectar récords. */
export async function fetchHistoricalBest(exerciseIds: string[], excludeSessionId: string): Promise<Map<string, ExerciseBest>> {
  const map = new Map<string, ExerciseBest>()
  if (!exerciseIds.length) return map
  const hist = await fetchExerciseHistory({ exerciseIds, excludeSessionId })
  for (const h of hist) {
    const b = bestOfSets(h.sets)
    const prev = map.get(h.exercise_id)
    map.set(h.exercise_id, prev ? mergeBest(prev, b) : b)
  }
  return map
}

/** Sesión completada anterior de la misma rutina (para comparar en el resumen). */
export async function fetchPreviousSummary(session: WorkoutSession): Promise<SessionSummary | null> {
  let q = supabase.from('workout_session_summaries').select('*').eq('status', 'completed').neq('session_id', session.id).lt('started_at', session.started_at)
  q = session.routine_id ? q.eq('routine_id', session.routine_id) : q.eq('routine_name', session.routine_name)
  const { data, error } = await q.order('started_at', { ascending: false }).limit(1)
  if (error) throw new Error(error.message)
  const r = (data?.[0] as SessionSummary | undefined) ?? null
  return r ? { ...r, volume_kg: num(r.volume_kg) ?? 0 } : null
}

/** Últimas sesiones completadas (para el dashboard y la rotación de rutinas). */
export async function fetchRecentSummaries(limit = 10): Promise<SessionSummary[]> {
  const { data, error } = await supabase
    .from('workout_session_summaries')
    .select('*')
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return ((data ?? []) as SessionSummary[]).map((r) => ({ ...r, volume_kg: num(r.volume_kg) ?? 0 }))
}

/** Siguiente rutina de la rotación: la posterior (por orden) a la última completada. */
export function nextRoutineInRotation<T extends { id: string }>(routines: T[], lastRoutineId: string | null | undefined): T | null {
  if (!routines.length) return null
  const i = routines.findIndex((r) => r.id === lastRoutineId)
  return routines[(i + 1) % routines.length] ?? routines[0]
}
