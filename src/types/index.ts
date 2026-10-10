import type { ISODate } from '@/utils/date'

export type UUID = string
export type Timestamp = string

export type ThemeMode = 'dark' | 'light'
export type WeightUnit = 'kg' | 'lb'

export interface UserSettings {
  user_id: UUID
  theme: ThemeMode
  weight_unit: WeightUnit
  target_weight_kg: number | null
  timezone: string
  locale: string
  /** Momento del último RENACER (null si nunca) */
  reborn_at?: string | null
  updated_at: Timestamp
}

export interface Profile {
  id: UUID
  display_name: string | null
  created_at: Timestamp
}

// ───────────── Hábitos ─────────────

export type HabitType = 'binary' | 'numeric'

export interface Habit {
  id: UUID
  user_id: UUID
  name: string
  icon: string
  color: string
  type: HabitType
  target_value: number | null
  unit: string | null
  /** Días ISO (1 = lunes … 7 = domingo) en los que el hábito está programado. */
  schedule_days: number[]
  sort_order: number
  /** Clave de sistema para integraciones (p. ej. 'gym' se marca al terminar un entreno). */
  system_key: string | null
  archived_at: Timestamp | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface HabitLog {
  id: UUID
  user_id: UUID
  habit_id: UUID
  log_date: ISODate
  completed: boolean
  value: number | null
  updated_at: Timestamp
}

// ───────────── Entrenamiento ─────────────

export type SetType = 'normal' | 'warmup' | 'approach' | 'failure'
export type ExerciseType = 'weight_reps' | 'bodyweight' | 'assisted' | 'duration'
export type SessionStatus = 'in_progress' | 'completed' | 'cancelled'

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'abs',
  'full_body',
  'cardio',
  'other',
] as const
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

export interface Exercise {
  id: UUID
  user_id: UUID
  name: string
  muscle_group: MuscleGroup
  exercise_type: ExerciseType
  notes: string | null
  weight_unit: WeightUnit
  archived_at: Timestamp | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface WorkoutRoutine {
  id: UUID
  user_id: UUID
  name: string
  description: string | null
  sort_order: number
  created_at: Timestamp
  updated_at: Timestamp
}

export interface RoutineExercise {
  id: UUID
  user_id: UUID
  routine_id: UUID
  exercise_id: UUID
  position: number
  notes: string | null
  updated_at: Timestamp
}

/** Series plantilla de la rutina: se usan solo si el ejercicio nunca se ha hecho. */
export interface RoutineSet {
  id: UUID
  user_id: UUID
  routine_exercise_id: UUID
  position: number
  set_type: SetType
  target_weight: number | null
  target_reps: number | null
  updated_at: Timestamp
}

export interface WorkoutSession {
  id: UUID
  user_id: UUID
  routine_id: UUID | null
  routine_name: string
  session_date: ISODate
  started_at: Timestamp
  ended_at: Timestamp | null
  status: SessionStatus
  notes: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface WorkoutExercise {
  id: UUID
  user_id: UUID
  session_id: UUID
  exercise_id: UUID
  position: number
  notes: string | null
  updated_at: Timestamp
}

export interface WorkoutSet {
  id: UUID
  user_id: UUID
  workout_exercise_id: UUID
  position: number
  set_type: SetType
  weight: number | null
  reps: number | null
  completed: boolean
  completed_at: Timestamp | null
  updated_at: Timestamp
}

/** Serie de la última sesión completada (devuelta por la RPC last_completed_sets). */
export interface PreviousSet {
  exercise_id: UUID
  session_id: UUID
  ended_at: Timestamp
  position: number
  set_type: SetType
  weight: number | null
  reps: number | null
  completed: boolean
}

// Agregados de UI
export interface RoutineWithExercises extends WorkoutRoutine {
  exercises: (RoutineExercise & { exercise: Exercise; sets: RoutineSet[] })[]
}

export interface SessionExerciseFull extends WorkoutExercise {
  exercise: Exercise
  sets: WorkoutSet[]
}

export interface SessionFull extends WorkoutSession {
  exercises: SessionExerciseFull[]
}

// ───────────── Cuerpo ─────────────

export interface BodyWeightLog {
  id: UUID
  user_id: UUID
  log_date: ISODate
  weight_kg: number
  notes: string | null
  created_at: Timestamp
  updated_at: Timestamp
}

export interface ProgressPhoto {
  id: UUID
  user_id: UUID
  photo_date: ISODate
  storage_path: string
  notes: string | null
  width: number | null
  height: number | null
  size_bytes: number | null
  created_at: Timestamp
  updated_at: Timestamp
}
