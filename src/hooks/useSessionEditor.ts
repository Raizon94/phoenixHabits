import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Exercise, PreviousSet, SessionExerciseFull, SessionFull, WorkoutSet } from '@/types'
import { useUserId } from '@/contexts/AuthContext'
import { useExercises } from './useWorkoutData'
import {
  deleteSession,
  deleteSet,
  deleteWorkoutExercise,
  fetchPreviousSets,
  fetchSessionFull,
  newWorkoutSet,
  saveSessionHeader,
  saveSet,
  saveWorkoutExercise,
} from '@/services/workoutService'
import { clearActiveSnapshot, readActiveSnapshot, writeActiveSnapshot } from '@/services/activeSession'
import { newId, nowISO } from '@/lib/id'
import { moveItem, renumber } from '@/utils/workout'
import { scheduleFlush } from '@/services/sync'

interface SessionCache {
  session: SessionFull
  previous: [string, PreviousSet[]][]
}

/**
 * Estado y operaciones de una sesión de entrenamiento (en curso o del historial).
 * Cada cambio se aplica al instante en la UI, se guarda en la copia local y se encola
 * para Supabase: si se cierra la app, nada se pierde.
 */
export function useSessionEditor(id: string) {
  const userId = useUserId()
  const qc = useQueryClient()
  const { allExercises, loading: exLoading } = useExercises()

  const q = useQuery<SessionCache | null>({
    queryKey: ['session', id],
    enabled: !exLoading,
    staleTime: Infinity,
    queryFn: async () => {
      const snap = readActiveSnapshot()
      try {
        const session = await fetchSessionFull(id, allExercises)
        if (!session) return snap?.id === id ? { session: snap, previous: snap.previous ?? [] } : null
        let previous: [string, PreviousSet[]][] = []
        if (session.status === 'in_progress') {
          try {
            previous = [...(await fetchPreviousSets(session.exercises.map((e) => e.exercise_id))).entries()]
          } catch {
            previous = snap?.id === id ? (snap.previous ?? []) : []
          }
        }
        return { session, previous }
      } catch (e) {
        // Sin conexión: recuperar el entrenamiento desde la copia local.
        if (snap?.id === id) return { session: snap, previous: snap.previous ?? [] }
        throw e
      }
    },
  })

  const [session, setSession] = useState<SessionFull | null>(null)
  const [previous, setPrevious] = useState<Map<string, PreviousSet[]>>(new Map())
  const loadedFor = useRef<string | null>(null)

  useEffect(() => {
    if (q.data && loadedFor.current !== id) {
      loadedFor.current = id
      setSession(q.data.session)
      setPrevious(new Map(q.data.previous))
    }
  }, [q.data, id])

  /** Aplica un cambio local y lo persiste en caché + copia local. */
  const commit = useCallback(
    (next: SessionFull, prevMap?: Map<string, PreviousSet[]>) => {
      setSession(next)
      const pm = prevMap ?? previous
      qc.setQueryData<SessionCache>(['session', id], { session: next, previous: [...pm.entries()] })
      if (next.status === 'in_progress') writeActiveSnapshot(next, pm)
    },
    [qc, id, previous],
  )

  const mapExercise = (s: SessionFull, weId: string, fn: (we: SessionExerciseFull) => SessionExerciseFull): SessionFull => ({
    ...s,
    exercises: s.exercises.map((we) => (we.id === weId ? fn(we) : we)),
  })

  const updateSet = useCallback(
    (weId: string, setId: string, patch: Partial<WorkoutSet>) => {
      if (!session) return
      let changed: WorkoutSet | null = null
      const next = mapExercise(session, weId, (we) => ({
        ...we,
        sets: we.sets.map((s) => {
          if (s.id !== setId) return s
          changed = { ...s, ...patch, updated_at: nowISO() }
          return changed
        }),
      }))
      commit(next)
      if (changed) saveSet(changed)
    },
    [session, commit],
  )

  const toggleSet = useCallback(
    (weId: string, set: WorkoutSet) => {
      const completed = !set.completed
      updateSet(weId, set.id, { completed, completed_at: completed ? nowISO() : null })
    },
    [updateSet],
  )

  const addSet = useCallback(
    (weId: string) => {
      if (!session) return
      const we = session.exercises.find((e) => e.id === weId)
      if (!we) return
      const last = we.sets[we.sets.length - 1]
      const s = newWorkoutSet(userId, weId, we.sets.length, { set_type: last?.set_type === 'warmup' ? 'normal' : last?.set_type, weight: last?.weight, reps: last?.reps })
      commit(mapExercise(session, weId, (x) => ({ ...x, sets: [...x.sets, s] })))
      saveSet(s)
    },
    [session, commit, userId],
  )

  const removeSet = useCallback(
    (weId: string, setId: string) => {
      if (!session) return
      const we = session.exercises.find((e) => e.id === weId)
      if (!we) return
      const filtered = we.sets.filter((s) => s.id !== setId)
      const remaining = renumber(filtered)
      commit(mapExercise(session, weId, (x) => ({ ...x, sets: remaining })))
      deleteSet(setId)
      // Solo se guardan las series cuya posición ha cambiado.
      remaining.forEach((s, i) => s !== filtered[i] && saveSet(s))
    },
    [session, commit],
  )

  const addExercises = useCallback(
    async (list: Exercise[]) => {
      if (!session) return
      let prevMap = previous
      if (session.status === 'in_progress') {
        try {
          const fetched = await fetchPreviousSets(list.map((e) => e.id))
          prevMap = new Map([...previous, ...fetched])
          setPrevious(prevMap)
        } catch {
          /* sin conexión: series vacías */
        }
      }
      const added: SessionExerciseFull[] = list.map((ex, k) => {
        const weId = newId()
        const prev = prevMap.get(ex.id)
        const sets = prev?.length
          ? prev.map((p, i) => newWorkoutSet(userId, weId, i, { set_type: p.set_type, weight: p.weight, reps: p.reps }))
          : [0, 1, 2].map((i) => newWorkoutSet(userId, weId, i))
        return { id: weId, user_id: userId, session_id: session.id, exercise_id: ex.id, position: session.exercises.length + k, notes: null, updated_at: nowISO(), exercise: ex, sets }
      })
      commit({ ...session, exercises: [...session.exercises, ...added] }, prevMap)
      for (const we of added) {
        saveWorkoutExercise(we)
        we.sets.forEach(saveSet)
      }
    },
    [session, previous, commit, userId],
  )

  const removeExercise = useCallback(
    (weId: string) => {
      if (!session) return
      const exercises = renumber(session.exercises.filter((e) => e.id !== weId))
      commit({ ...session, exercises })
      deleteWorkoutExercise(weId)
      exercises.forEach(saveWorkoutExercise)
    },
    [session, commit],
  )

  const moveExercise = useCallback(
    (from: number, to: number) => {
      if (!session) return
      const exercises = renumber(moveItem(session.exercises, from, to))
      commit({ ...session, exercises })
      exercises.forEach(saveWorkoutExercise)
    },
    [session, commit],
  )

  const updateExerciseNotes = useCallback(
    (weId: string, notes: string) => {
      if (!session) return
      const next = mapExercise(session, weId, (we) => ({ ...we, notes: notes || null }))
      commit(next)
      const we = next.exercises.find((e) => e.id === weId)
      if (we) saveWorkoutExercise(we)
    },
    [session, commit],
  )

  const updateHeader = useCallback(
    (patch: Partial<SessionFull>) => {
      if (!session) return
      const next = { ...session, ...patch }
      commit(next)
      saveSessionHeader(next)
    },
    [session, commit],
  )

  const finish = useCallback(() => {
    if (!session) return null
    const next: SessionFull = { ...session, status: 'completed', ended_at: nowISO() }
    commit(next)
    saveSessionHeader(next)
    clearActiveSnapshot(session.id)
    qc.setQueryData(['activeSession', userId], null)
    scheduleFlush(0)
    return next
  }, [session, commit, qc, userId])

  const cancel = useCallback(() => {
    if (!session) return
    deleteSession(session.id)
    clearActiveSnapshot(session.id)
    qc.removeQueries({ queryKey: ['session', session.id] })
    qc.setQueryData(['activeSession', userId], null)
    qc.invalidateQueries({ queryKey: ['sessionSummaries'] })
  }, [session, qc, userId])

  return {
    session,
    previous,
    loading: exLoading || q.isPending,
    error: q.error,
    notFound: q.isSuccess && q.data === null,
    updateSet,
    toggleSet,
    addSet,
    removeSet,
    addExercises,
    removeExercise,
    moveExercise,
    updateExerciseNotes,
    updateHeader,
    finish,
    cancel,
  }
}
