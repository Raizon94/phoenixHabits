import { describe, expect, it } from 'vitest'
import { prepareRestore, toCSV, type Backup } from '@/services/exportService'

const OLD = 'old-user'
const NEW = 'new-user'

const backup: Backup = {
  app: 'phoenix-habits', version: 1, exported_at: '2026-10-10T10:00:00Z', user_id: OLD, photos: [],
  tables: {
    habits: [
      { id: 'h-gym-old', user_id: OLD, name: 'Gimnasio', system_key: 'gym' },
      { id: 'h-custom', user_id: OLD, name: 'Meditar', system_key: null },
    ],
    habit_logs: [
      { id: 'l1', user_id: OLD, habit_id: 'h-gym-old', log_date: '2026-10-01', completed: true },
      { id: 'l2', user_id: OLD, habit_id: 'h-custom', log_date: '2026-10-01', completed: true },
    ],
    exercises: [{ id: 'e-old', user_id: OLD, name: 'Press banca' }],
    workout_exercises: [{ id: 'we1', user_id: OLD, session_id: 's1', exercise_id: 'e-old' }],
    body_weight_logs: [{ id: 'w1', user_id: OLD, log_date: '2026-10-01', weight_kg: 90 }],
    progress_photos: [{ id: 'p1', user_id: OLD, storage_path: `${OLD}/2026-10-01/p1.jpg` }],
  },
}

describe('restauración de copias de seguridad', () => {
  it('reasigna el usuario y fusiona hábitos/ejercicios existentes sin duplicarlos', () => {
    const r = prepareRestore(backup, NEW, {
      habits: [{ id: 'h-gym-new', name: 'Gimnasio', system_key: 'gym' }],
      exercises: [{ id: 'e-new', name: 'press banca' }],
    })
    expect(r.habits.map((h) => h.id)).toEqual(['h-custom'])
    expect(r.habit_logs.map((l) => l.habit_id)).toEqual(['h-gym-new', 'h-custom'])
    expect(r.habit_logs.every((l) => !('id' in l) && l.user_id === NEW)).toBe(true)
    expect(r.exercises).toHaveLength(0)
    expect(r.workout_exercises[0].exercise_id).toBe('e-new')
    expect(r.progress_photos[0].storage_path).toBe(`${NEW}/2026-10-01/p1.jpg`)
  })

  it('restaurar en la misma cuenta mantiene los ids (upsert idempotente)', () => {
    const r = prepareRestore(backup, OLD, { habits: backup.tables.habits, exercises: backup.tables.exercises })
    expect(r.habits.map((h) => h.id)).toEqual(['h-gym-old', 'h-custom'])
    expect(r.exercises.map((e) => e.id)).toEqual(['e-old'])
  })
})

describe('CSV', () => {
  it('usa ";" , coma decimal y escapa comillas', () => {
    const csv = toCSV([{ a: 1.5, b: 'x;"y"' }], ['a', 'b'])
    expect(csv).toBe('﻿a;b\r\n1,5;"x;""y"""')
  })
})
