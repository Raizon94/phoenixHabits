import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { BodyWeightLog } from '@/types'
import { useUserId } from '@/contexts/AuthContext'
import { deleteWeight, fetchWeightLogs, saveWeight } from '@/services/bodyService'
import type { ISODate } from '@/utils/date'

export function useWeights() {
  const userId = useUserId()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['weights', userId], queryFn: fetchWeightLogs })
  const logs = useMemo(() => q.data ?? [], [q.data])
  const byDate = useMemo(() => new Map(logs.map((l) => [l.log_date, l])), [logs])

  const save = useCallback(
    (date: ISODate, weightKg: number, notes: string | null, original?: BodyWeightLog) => {
      // Si se cambia la fecha de un registro existente, se elimina el del día original.
      if (original && original.log_date !== date) deleteWeight(original)
      const existing = byDate.get(date)
      const row = saveWeight(userId, date, weightKg, notes, existing ?? (original?.log_date === date ? original : undefined))
      qc.setQueryData<BodyWeightLog[]>(['weights', userId], (prev = []) =>
        [...prev.filter((l) => l.log_date !== date && l.log_date !== original?.log_date), row].sort((a, b) => a.log_date.localeCompare(b.log_date)),
      )
    },
    [userId, qc, byDate],
  )

  const remove = useCallback(
    (log: BodyWeightLog) => {
      deleteWeight(log)
      qc.setQueryData<BodyWeightLog[]>(['weights', userId], (prev = []) => prev.filter((l) => l.log_date !== log.log_date))
    },
    [userId, qc],
  )

  return { logs, byDate, loading: q.isPending, error: q.error, refetch: q.refetch, save, remove }
}
