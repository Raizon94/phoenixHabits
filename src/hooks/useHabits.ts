import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Habit, HabitLog } from '@/types'
import { useUserId } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { buildLog, deleteHabit, fetchHabitLogs, fetchHabits, saveHabit, saveLog } from '@/services/habitsService'
import { habitStartDate, indexLogs, isScheduled } from '@/utils/habits'
import type { ISODate } from '@/utils/date'

export function useHabits() {
  const userId = useUserId()
  const { settings } = useSettings()
  const qc = useQueryClient()
  const habitsQ = useQuery({ queryKey: ['habits', userId], queryFn: fetchHabits })
  const logsQ = useQuery({ queryKey: ['habitLogs', userId], queryFn: fetchHabitLogs })

  const allHabits = useMemo(() => habitsQ.data ?? [], [habitsQ.data])
  const habits = useMemo(() => allHabits.filter((h) => !h.archived_at), [allHabits])
  const logs = useMemo(() => logsQ.data ?? [], [logsQ.data])
  const index = useMemo(() => indexLogs(logs), [logs])
  const starts = useMemo(() => {
    const m = new Map<string, ISODate>()
    for (const h of allHabits) m.set(h.id, habitStartDate(h, index.get(h.id), settings.timezone))
    return m
  }, [allHabits, index, settings.timezone])

  const setLogs = useCallback(
    (fn: (prev: HabitLog[]) => HabitLog[]) => qc.setQueryData<HabitLog[]>(['habitLogs', userId], (prev) => fn(prev ?? [])),
    [qc, userId],
  )

  /** Crea/actualiza el registro de un día de forma optimista. */
  const setLog = useCallback(
    (habit: Habit, date: ISODate, patch: { completed?: boolean; value?: number | null }) => {
      const log = buildLog(habit, userId, date, patch)
      setLogs((prev) => {
        const i = prev.findIndex((l) => l.habit_id === habit.id && l.log_date === date)
        if (i === -1) return [...prev, log]
        const copy = [...prev]
        copy[i] = { ...copy[i], ...log, id: copy[i].id }
        return copy
      })
      saveLog(log)
    },
    [userId, setLogs],
  )

  const toggle = useCallback(
    (habit: Habit, date: ISODate) => {
      const cur = index.get(habit.id)?.get(date)
      const done = habit.type === 'numeric' ? (cur?.value ?? 0) >= (habit.target_value ?? Infinity) : !!cur?.completed
      setLog(habit, date, { completed: !done })
    },
    [index, setLog],
  )

  const upsertHabit = useCallback(
    (h: Habit) => {
      const saved = saveHabit(h)
      qc.setQueryData<Habit[]>(['habits', userId], (prev = []) => {
        const i = prev.findIndex((x) => x.id === h.id)
        const next = i === -1 ? [...prev, saved] : prev.map((x) => (x.id === h.id ? saved : x))
        return next.sort((a, b) => a.sort_order - b.sort_order)
      })
    },
    [qc, userId],
  )

  const removeHabit = useCallback(
    (id: string) => {
      deleteHabit(id)
      qc.setQueryData<Habit[]>(['habits', userId], (prev = []) => prev.filter((x) => x.id !== id))
      setLogs((prev) => prev.filter((l) => l.habit_id !== id))
    },
    [qc, userId, setLogs],
  )

  /** Marca el hábito de gimnasio como hecho ese día, si está programado. */
  const markGym = useCallback(
    (date: ISODate) => {
      const gym = habits.find((h) => h.system_key === 'gym')
      if (!gym || !isScheduled(gym, date)) return false
      if (index.get(gym.id)?.get(date)?.completed) return true
      setLog(gym, date, { completed: true })
      return true
    },
    [habits, index, setLog],
  )

  return {
    habits,
    allHabits,
    logs,
    index,
    starts,
    loading: habitsQ.isPending || logsQ.isPending,
    error: habitsQ.data && logsQ.data ? null : (habitsQ.error ?? logsQ.error),
    refetch: () => {
      habitsQ.refetch()
      logsQ.refetch()
    },
    setLog,
    toggle,
    upsertHabit,
    removeHabit,
    markGym,
  }
}
