import { describe, expect, it } from 'vitest'
import type { Exercise, PreviousSet, RoutineWithExercises, WorkoutSet } from '@/types'
import { buildSessionDraft, detectPRs, epley1RM, exerciseVolume, groupPreviousSets, sessionVolume, bestOfSets, convertWeight, previousForPosition } from '@/utils/workout'

const bench: Exercise = { id: 'bench', user_id: 'u', name: 'Press banca', muscle_group: 'chest', exercise_type: 'weight_reps', notes: null, weight_unit: 'kg', archived_at: null, created_at: '', updated_at: '' }
const squat: Exercise = { ...bench, id: 'squat', name: 'Sentadilla', muscle_group: 'quadriceps' }
const curl: Exercise = { ...bench, id: 'curl', name: 'Curl', muscle_group: 'biceps', weight_unit: 'lb' }

const routine: RoutineWithExercises = {
  id: 'r1', user_id: 'u', name: 'Push', description: null, sort_order: 0, created_at: '', updated_at: '',
  exercises: [
    { id: 're2', user_id: 'u', routine_id: 'r1', exercise_id: 'squat', position: 1, notes: null, updated_at: '', exercise: squat,
      sets: [{ id: 'rs1', user_id: 'u', routine_exercise_id: 're2', position: 0, set_type: 'normal', target_weight: 80, target_reps: 5, updated_at: '' }] },
    { id: 're1', user_id: 'u', routine_id: 'r1', exercise_id: 'bench', position: 0, notes: null, updated_at: '', exercise: bench, sets: [] },
    { id: 're3', user_id: 'u', routine_id: 'r1', exercise_id: 'curl', position: 2, notes: null, updated_at: '', exercise: curl, sets: [] },
  ],
}

function prev(exercise_id: string, position: number, weight: number, reps: number, set_type: PreviousSet['set_type'] = 'normal'): PreviousSet {
  return { exercise_id, session_id: 'old', ended_at: '2026-10-08T19:00:00Z', position, set_type, weight, reps, completed: true }
}

function idGen() {
  let n = 0
  return () => `id-${++n}`
}

describe('sobrecarga progresiva: recuperación de series anteriores', () => {
  const previous = groupPreviousSets([prev('bench', 2, 65, 7), prev('bench', 0, 60, 10), prev('bench', 1, 65, 8)])
  const draft = buildSessionDraft(routine, previous, { userId: 'u', sessionDate: '2026-10-10', now: '2026-10-10T18:00:00Z', newId: idGen() })

  it('precarga los pesos y repeticiones de la última sesión completada', () => {
    const benchEx = draft.exercises.find((e) => e.exercise_id === 'bench')!
    const sets = draft.sets.filter((s) => s.workout_exercise_id === benchEx.id).sort((a, b) => a.position - b.position)
    expect(sets.map((s) => [s.weight, s.reps])).toEqual([[60, 10], [65, 8], [65, 7]])
    expect(sets.every((s) => !s.completed)).toBe(true)
  })

  it('crea filas nuevas sin reutilizar ids del historial', () => {
    expect(draft.session.status).toBe('in_progress')
    expect(draft.sets.every((s) => s.id.startsWith('id-'))).toBe(true)
    expect(new Set(draft.sets.map((s) => s.id)).size).toBe(draft.sets.length)
  })

  it('sin historial usa la plantilla de la rutina o series vacías', () => {
    const sq = draft.exercises.find((e) => e.exercise_id === 'squat')!
    const sqSets = draft.sets.filter((s) => s.workout_exercise_id === sq.id)
    expect(sqSets.map((s) => [s.weight, s.reps])).toEqual([[80, 5]])
    const cu = draft.exercises.find((e) => e.exercise_id === 'curl')!
    expect(draft.sets.filter((s) => s.workout_exercise_id === cu.id)).toHaveLength(3)
  })

  it('respeta el orden de la rutina', () => {
    expect(draft.exercises.map((e) => e.exercise_id)).toEqual(['bench', 'squat', 'curl'])
  })

  it('usa la configuración de series de la última sesión (series añadidas/eliminadas)', () => {
    const fourSets = groupPreviousSets([prev('bench', 0, 60, 10, 'warmup'), prev('bench', 1, 70, 6), prev('bench', 2, 70, 6), prev('bench', 3, 70, 5, 'failure')])
    const d = buildSessionDraft(routine, fourSets, { userId: 'u', sessionDate: '2026-10-10', now: 'x', newId: idGen() })
    const b = d.exercises.find((e) => e.exercise_id === 'bench')!
    const sets = d.sets.filter((s) => s.workout_exercise_id === b.id)
    expect(sets).toHaveLength(4)
    expect(sets.map((s) => s.set_type)).toEqual(['warmup', 'normal', 'normal', 'failure'])
  })

  it('encuentra la serie anterior equivalente por posición', () => {
    expect(previousForPosition(previous.get('bench'), 1)?.weight).toBe(65)
    expect(previousForPosition(previous.get('bench'), 5)).toBeUndefined()
  })
})

function set(weight: number | null, reps: number | null, completed = true, set_type: WorkoutSet['set_type'] = 'normal'): WorkoutSet {
  return { id: Math.random().toString(), user_id: 'u', workout_exercise_id: 'we', position: 0, set_type, weight, reps, completed, completed_at: null, updated_at: '' }
}

describe('volumen y 1RM', () => {
  it('calcula el volumen solo con series completadas que no son calentamiento', () => {
    expect(exerciseVolume([set(60, 10), set(65, 8), set(40, 10, true, 'warmup'), set(70, 5, false)])).toBe(600 + 520)
  })

  it('suma el volumen de la sesión convirtiendo unidades', () => {
    const v = sessionVolume([
      { exercise: bench, sets: [set(100, 1)] },
      { exercise: curl, sets: [set(22.0462262, 10)] }, // 220,46 lb = 100 kg
    ], 'kg')
    expect(v).toBeCloseTo(200, 3)
    expect(convertWeight(100, 'kg', 'lb')).toBeCloseTo(220.462, 2)
  })

  it('estima el 1RM con Epley', () => {
    expect(epley1RM(100, 1)).toBe(100)
    expect(epley1RM(100, 10)).toBeCloseTo(133.33, 2)
    expect(epley1RM(0, 10)).toBe(0)
    expect(epley1RM(null, 5)).toBe(0)
  })

  it('detecta récords personales frente al histórico', () => {
    const best = new Map([['bench', bestOfSets([set(65, 8), set(65, 7)])]])
    const prs = detectPRs([{ exercise_id: 'bench', sets: [set(67.5, 8)] }, { exercise_id: 'squat', sets: [set(100, 5)] }], best)
    expect(prs.map((p) => p.kind).sort()).toEqual(['1rm', 'volume', 'weight'])
    expect(prs.every((p) => p.exercise_id === 'bench')).toBe(true)
  })
})

import { aggregatePoints, sessionPoint } from '@/utils/progress'

describe('evolución de fuerza', () => {
  it('calcula métricas por sesión y agrega por semana', () => {
    const p1 = sessionPoint({ session_date: '2026-10-05', sets: [set(60, 10), set(40, 12, true, 'warmup'), set(65, 8)] })
    expect(p1).toMatchObject({ maxWeight: 65, volume: 1120, reps: 18 })
    expect(p1.e1rm).toBeCloseTo(65 * (1 + 8 / 30), 5)
    const p2 = sessionPoint({ session_date: '2026-10-08', sets: [set(70, 5)] })
    const weekly = aggregatePoints([p1, p2], 'week')
    expect(weekly).toHaveLength(1)
    expect(weekly[0]).toMatchObject({ date: '2026-10-05', maxWeight: 70, volume: 1470, reps: 23 })
  })
})
