import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Exercise, RoutineWithExercises } from '@/types'
import { useUserId } from '@/contexts/AuthContext'
import { deleteExercise, deleteRoutine, fetchActiveSessionId, fetchExercises, fetchRoutines, saveExercise, saveRoutineFull } from '@/services/workoutService'

export function useExercises() {
  const userId = useUserId()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['exercises', userId], queryFn: fetchExercises })
  const all = useMemo(() => q.data ?? [], [q.data])
  const active = useMemo(() => all.filter((e) => !e.archived_at), [all])

  const upsert = useCallback(
    (ex: Exercise) => {
      const saved = saveExercise(ex)
      qc.setQueryData<Exercise[]>(['exercises', userId], (prev = []) => {
        const i = prev.findIndex((x) => x.id === ex.id)
        const next = i === -1 ? [...prev, saved] : prev.map((x) => (x.id === ex.id ? saved : x))
        return next.sort((a, b) => a.name.localeCompare(b.name, 'es'))
      })
      qc.invalidateQueries({ queryKey: ['routines', userId] })
      return saved
    },
    [qc, userId],
  )

  const remove = useCallback(
    (id: string) => {
      deleteExercise(id)
      qc.setQueryData<Exercise[]>(['exercises', userId], (prev = []) => prev.filter((x) => x.id !== id))
      qc.setQueryData<RoutineWithExercises[]>(['routines', userId], (prev = []) =>
        prev.map((r) => ({ ...r, exercises: r.exercises.filter((e) => e.exercise_id !== id) })),
      )
    },
    [qc, userId],
  )

  return { exercises: active, allExercises: all, loading: q.isPending, error: q.data ? null : q.error, refetch: q.refetch, upsert, remove }
}

export function useRoutines() {
  const userId = useUserId()
  const qc = useQueryClient()
  const { allExercises, loading: exLoading } = useExercises()
  const q = useQuery({
    queryKey: ['routines', userId],
    queryFn: () => fetchRoutines(allExercises),
    enabled: !exLoading,
  })
  const routines = useMemo(() => q.data ?? [], [q.data])

  const save = useCallback(
    (next: RoutineWithExercises) => {
      const prev = routines.find((r) => r.id === next.id) ?? null
      saveRoutineFull(next, prev)
      qc.setQueryData<RoutineWithExercises[]>(['routines', userId], (list = []) => {
        const i = list.findIndex((r) => r.id === next.id)
        const out = i === -1 ? [...list, next] : list.map((r) => (r.id === next.id ? next : r))
        return out.sort((a, b) => a.sort_order - b.sort_order)
      })
    },
    [routines, qc, userId],
  )

  const setAll = useCallback((list: RoutineWithExercises[]) => qc.setQueryData(['routines', userId], list), [qc, userId])

  const remove = useCallback(
    (id: string) => {
      deleteRoutine(id)
      qc.setQueryData<RoutineWithExercises[]>(['routines', userId], (list = []) => list.filter((r) => r.id !== id))
    },
    [qc, userId],
  )

  return { routines, loading: q.isPending || exLoading, error: q.data ? null : q.error, refetch: q.refetch, save, remove, setAll }
}

export function useActiveSessionId() {
  const userId = useUserId()
  return useQuery({ queryKey: ['activeSession', userId], queryFn: fetchActiveSessionId, staleTime: 0 })
}
