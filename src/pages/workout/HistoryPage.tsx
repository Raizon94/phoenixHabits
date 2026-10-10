import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Clock, Dumbbell, Layers, Weight } from 'lucide-react'
import { useRoutines } from '@/hooks/useWorkoutData'
import { useUserId } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useSync } from '@/contexts/SyncContext'
import { fetchSessionSummaries, type SessionSummary } from '@/services/workoutService'
import { PageHeader } from '@/components/ui/PageHeader'
import { Select } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { formatDate, formatDurationHuman, formatMonth } from '@/utils/date'
import { convertWeight } from '@/utils/workout'
import { fmtNum } from '@/utils/weight'

export default function HistoryPage() {
  const userId = useUserId()
  const { settings } = useSettings()
  const { pending } = useSync()
  const { routines } = useRoutines()
  const [routineId, setRoutineId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const q = useQuery({
    queryKey: ['sessionSummaries', userId, 'history', routineId, from, to],
    queryFn: () => fetchSessionSummaries({ routineId: routineId || undefined, from: from || undefined, to: to || undefined }),
  })

  const groups = useMemo(() => {
    const m = new Map<string, SessionSummary[]>()
    for (const s of q.data ?? []) {
      const k = s.session_date.slice(0, 7)
      m.set(k, [...(m.get(k) ?? []), s])
    }
    return [...m.entries()]
  }, [q.data])

  const unit = settings.weight_unit

  return (
    <div className="animate-fade-in">
      <PageHeader title="Historial" subtitle={q.data ? `${q.data.length} entrenamientos` : undefined} back="/workout" />

      <div className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-3">
        <div className="col-span-2 md:col-span-1">
          <Select aria-label="Filtrar por rutina" value={routineId} onChange={(e) => setRoutineId(e.target.value)}>
            <option value="">Todas las rutinas</option>
            {routines.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </div>
        <label className="text-xs text-muted">
          Desde
          <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="mt-1 h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-sm text-text" />
        </label>
        <label className="text-xs text-muted">
          Hasta
          <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="mt-1 h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-sm text-text" />
        </label>
      </div>

      {pending > 0 && <p className="mb-3 text-xs text-muted">Hay cambios pendientes de sincronizar; aparecerán aquí al guardarse.</p>}
      {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {q.isPending && [0, 1, 2].map((i) => <Skeleton key={i} className="mb-2 h-20" />)}
      {q.data && !q.data.length && <EmptyState icon={Dumbbell} title="Sin entrenamientos" description="Los entrenamientos que finalices aparecerán aquí." />}

      <div className="space-y-6">
        {groups.map(([month, list]) => (
          <section key={month}>
            <h2 className="mb-2 text-sm font-semibold text-muted">{formatMonth(month + '-01')}</h2>
            <ul className="space-y-2">
              {list.map((s) => (
                <li key={s.session_id}>
                  <Link to={`/workout/session/${s.session_id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3 transition hover:bg-surface-2">
                    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-surface-2">
                      <span className="text-lg leading-none font-bold">{Number(s.session_date.slice(8))}</span>
                      <span className="text-[10px] text-muted uppercase">{formatDate(s.session_date, { weekday: 'short' })}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{s.routine_name}</div>
                      <div className="tabular mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Clock size={12} aria-hidden /> {formatDurationHuman(s.duration_seconds)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Layers size={12} aria-hidden /> {s.completed_sets} series
                        </span>
                        <span className="flex items-center gap-1">
                          <Weight size={12} aria-hidden /> {fmtNum(convertWeight(s.volume_kg, 'kg', unit), 0)} {unit}
                        </span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
