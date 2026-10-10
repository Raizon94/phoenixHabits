import { useMemo } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Trophy, TrendingUp } from 'lucide-react'
import { useUserId } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useExercises } from '@/hooks/useWorkoutData'
import { fetchExerciseHistory, fetchSessionSummaries } from '@/services/workoutService'
import { Card, CardTitle, Stat } from '@/components/ui/Card'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { SimpleBarChart } from './Charts'
import { addDays, addMonths, eachDay, formatDate, formatDurationHuman, formatShort, startOfMonth, startOfWeek, type ISODate } from '@/utils/date'
import { convertWeight, epley1RM } from '@/utils/workout'
import { sessionPoint } from '@/utils/progress'
import { fmtNum } from '@/utils/weight'
import { t } from '@/i18n'

export function TrainingStats({ from }: { from: ISODate | null }) {
  const userId = useUserId()
  const { today, settings } = useSettings()
  const { allExercises } = useExercises()
  const unit = settings.weight_unit

  // Estadísticas sobre TODOS los registros del periodo (consultas paginadas), no solo lo cargado en pantalla.
  const sumQ = useQuery({ queryKey: ['trainingStats', userId, 'summaries', from], queryFn: () => fetchSessionSummaries({ from: from ?? undefined }) })
  const histQ = useQuery({ queryKey: ['trainingStats', userId, 'history', from], queryFn: () => fetchExerciseHistory({ from: from ?? undefined }) })
  // Récords históricos (todo el historial) para la lista de récords.
  const allQ = useQuery({ queryKey: ['trainingStats', userId, 'history', 'all'], queryFn: () => fetchExerciseHistory({}), enabled: !!from })

  const summaries = useMemo(() => sumQ.data ?? [], [sumQ.data])
  const history = useMemo(() => histQ.data ?? [], [histQ.data])
  const allHistory = from ? (allQ.data ?? []) : history
  const exById = useMemo(() => new Map(allExercises.map((e) => [e.id, e])), [allExercises])

  const totals = useMemo(() => {
    const secs = summaries.reduce((a, s) => a + s.duration_seconds, 0)
    const vol = summaries.reduce((a, s) => a + s.volume_kg, 0)
    const sets = summaries.reduce((a, s) => a + s.completed_sets, 0)
    return { secs, vol, sets, count: summaries.length }
  }, [summaries])

  const start = from ?? (summaries.length ? summaries[summaries.length - 1].session_date : today)

  const perWeek = useMemo(() => {
    const m = new Map<string, number>()
    for (let w = startOfWeek(start); w <= today; w = addDays(w, 7)) m.set(w, 0)
    for (const s of summaries) m.set(startOfWeek(s.session_date), (m.get(startOfWeek(s.session_date)) ?? 0) + 1)
    return [...m.entries()].sort().map(([period, count]) => ({ period, count })).slice(-26)
  }, [summaries, start, today])

  const perMonth = useMemo(() => {
    const m = new Map<string, number>()
    for (let mo = startOfMonth(start); mo <= today; mo = addMonths(mo, 1)) m.set(mo, 0)
    for (const s of summaries) m.set(startOfMonth(s.session_date), (m.get(startOfMonth(s.session_date)) ?? 0) + 1)
    return [...m.entries()].sort().map(([period, count]) => ({ period, count }))
  }, [summaries, start, today])

  const muscles = useMemo(() => {
    const m = new Map<string, number>()
    for (const h of history) {
      const ex = exById.get(h.exercise_id)
      if (!ex) continue
      const sets = h.sets.filter((s) => s.completed && s.set_type !== 'warmup').length
      if (sets) m.set(ex.muscle_group, (m.get(ex.muscle_group) ?? 0) + sets)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([g, sets]) => ({ group: t().muscle[g as keyof ReturnType<typeof t>['muscle']], sets }))
  }, [history, exById])

  /** Evolución de fuerza: 1RM estimado al principio vs al final del periodo, por ejercicio. */
  const strength = useMemo(() => {
    const by = new Map<string, { first: number; last: number; sessions: number }>()
    for (const h of history) {
      const p = sessionPoint(h)
      if (!p.e1rm) continue
      const cur = by.get(h.exercise_id)
      if (!cur) by.set(h.exercise_id, { first: p.e1rm, last: p.e1rm, sessions: 1 })
      else by.set(h.exercise_id, { ...cur, last: p.e1rm, sessions: cur.sessions + 1 })
    }
    return [...by.entries()]
      .filter(([, v]) => v.sessions >= 2)
      .map(([id, v]) => ({ ex: exById.get(id), change: (v.last - v.first) / v.first, ...v }))
      .filter((x) => x.ex)
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 8)
  }, [history, exById])

  const records = useMemo(() => {
    const by = new Map<string, { weight: number; e1rm: number; date: ISODate }>()
    for (const h of allHistory) {
      for (const s of h.sets) {
        if (!s.completed || s.set_type === 'warmup' || !s.reps) continue
        const e = epley1RM(s.weight, s.reps)
        const cur = by.get(h.exercise_id)
        if (!cur || e > cur.e1rm) by.set(h.exercise_id, { weight: Math.max(cur?.weight ?? 0, s.weight ?? 0), e1rm: e, date: h.session_date })
        else if ((s.weight ?? 0) > cur.weight) by.set(h.exercise_id, { ...cur, weight: s.weight ?? 0 })
      }
    }
    return [...by.entries()].map(([id, r]) => ({ ex: exById.get(id), ...r })).filter((r) => r.ex).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10)
  }, [allHistory, exById])

  const err = sumQ.error ?? histQ.error
  if (err) return <ErrorState error={err} onRetry={() => { sumQ.refetch(); histQ.refetch() }} />
  if (sumQ.isPending || histQ.isPending) return <Skeleton className="h-96" />

  const weeks = Math.max(1, eachDay(start, today).length / 7)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Entrenamientos" value={totals.count} hint={`${fmtNum(totals.count / weeks, 1)} por semana`} />
        <Stat label="Tiempo total" value={formatDurationHuman(totals.secs)} />
        <Stat label="Volumen total" value={`${fmtNum(convertWeight(totals.vol, 'kg', unit) / 1000, 1)} t`} hint={unit === 'lb' ? 'miles de lb' : 'toneladas'} />
        <Stat label="Series realizadas" value={totals.sets} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Entrenamientos por semana</CardTitle>
          <SimpleBarChart data={perWeek} xKey="period" yKey="count" name="Entrenamientos" xFormat={formatShort} format={(v) => String(v)} />
        </Card>
        <Card>
          <CardTitle>Entrenamientos por mes</CardTitle>
          <SimpleBarChart data={perMonth} xKey="period" yKey="count" name="Entrenamientos" xFormat={(d) => formatDate(d, { month: 'short', year: '2-digit' })} format={(v) => String(v)} />
        </Card>
      </div>

      <Card>
        <CardTitle>Series por grupo muscular</CardTitle>
        <SimpleBarChart data={muscles} xKey="group" yKey="sets" name="Series" layout="vertical" height={Math.max(160, muscles.length * 30)} format={(v) => `${v} series`} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Evolución de fuerza (1RM estimado)</CardTitle>
          {!strength.length && <p className="text-sm text-muted">Necesitas al menos dos sesiones de un ejercicio en el periodo.</p>}
          <ul className="divide-y divide-border">
            {strength.map((s) => (
              <li key={s.ex!.id}>
                <Link to={`/workout/progress/${s.ex!.id}`} className="flex items-center gap-2 py-2 hover:text-accent">
                  <span className="flex-1 truncate text-sm font-medium">{s.ex!.name}</span>
                  <span className="tabular text-xs text-muted">
                    {fmtNum(s.first, 1)} → {fmtNum(s.last, 1)} {s.ex!.weight_unit}
                  </span>
                  <span className={`tabular w-16 text-right text-sm font-semibold ${s.change > 0 ? 'text-success' : 'text-muted'}`}>
                    {s.change > 0 && <TrendingUp size={12} className="mr-0.5 inline" aria-hidden />}
                    {s.change >= 0 ? '+' : ''}
                    {fmtNum(s.change * 100, 0)}%
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitle>Récords personales</CardTitle>
          {!records.length && <p className="text-sm text-muted">Aún no hay récords.</p>}
          <ul className="divide-y divide-border">
            {records.map((r) => (
              <li key={r.ex!.id} className="flex items-center gap-2 py-2">
                <Trophy size={14} className="shrink-0 text-warning" aria-hidden />
                <span className="flex-1 truncate text-sm font-medium">{r.ex!.name}</span>
                <span className="tabular text-right text-xs">
                  <span className="font-semibold">{fmtNum(r.weight, r.weight % 1 ? 1 : 0)} {r.ex!.weight_unit}</span>
                  <span className="text-muted"> · 1RM≈{fmtNum(r.e1rm, 0)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">El 1RM es una estimación (Epley), no una medición real.</p>
        </Card>
      </div>
    </div>
  )
}
