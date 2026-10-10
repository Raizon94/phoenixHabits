import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { Medal, Pencil, TrendingDown, TrendingUp, Trophy } from 'lucide-react'
import { useSessionEditor } from '@/hooks/useSessionEditor'
import { useSettings } from '@/contexts/SettingsContext'
import { fetchHistoricalBest, fetchPreviousSummary } from '@/services/workoutService'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle, Stat } from '@/components/ui/Card'
import { ErrorState, Spinner } from '@/components/ui/States'
import { formatDurationHuman, formatLongDate } from '@/utils/date'
import { completedSetCount, convertWeight, detectPRs, sessionDurationSeconds, sessionVolume, type PRKind } from '@/utils/workout'
import { fmtNum, fmtSigned } from '@/utils/weight'

const PR_LABEL: Record<PRKind, string> = { weight: 'Peso máximo', '1rm': '1RM estimado', volume: 'Mejor serie (volumen)' }

export default function SessionSummaryPage() {
  const { id = '' } = useParams()
  const { session: s, error } = useSessionEditor(id)
  const { settings } = useSettings()
  const unit = settings.weight_unit
  const navigate = useNavigate()

  const exerciseIds = useMemo(() => s?.exercises.map((e) => e.exercise_id) ?? [], [s])
  const prevQ = useQuery({ queryKey: ['sessionSummaries', 'previous', id], queryFn: () => fetchPreviousSummary(s!), enabled: !!s })
  const bestQ = useQuery({ queryKey: ['exerciseHistory', 'best', id, exerciseIds], queryFn: () => fetchHistoricalBest(exerciseIds, id), enabled: !!s })

  if (error && !s) return <ErrorState error={error} />
  if (!s) return <Spinner />

  const duration = sessionDurationSeconds(s)
  const volumeKg = sessionVolume(s.exercises, 'kg')
  const sets = completedSetCount(s.exercises)
  const doneExercises = s.exercises.filter((e) => e.sets.some((x) => x.completed)).length
  const prs = bestQ.data ? detectPRs(s.exercises, bestQ.data) : []
  const prev = prevQ.data
  const show = (kg: number, d = 0) => fmtNum(convertWeight(kg, 'kg', unit), d)

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader title="¡Entrenamiento completado!" subtitle={`${s.routine_name} · ${formatLongDate(s.session_date)}`} back="/workout" />

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Duración" value={formatDurationHuman(duration)} />
        <Stat label="Ejercicios" value={doneExercises} />
        <Stat label="Series completadas" value={sets} />
        <Stat label="Volumen total" value={`${show(volumeKg)} ${unit}`} />
      </div>

      <Card>
        <CardTitle>Comparación con la sesión anterior</CardTitle>
        {prevQ.isPending ? (
          <Spinner className="py-4" />
        ) : prev ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Volumen', diff: volumeKg - prev.volume_kg, fmt: (v: number) => `${fmtSigned(convertWeight(v, 'kg', unit), 0)} ${unit}` },
              { label: 'Series', diff: sets - prev.completed_sets, fmt: (v: number) => fmtSigned(v, 0) },
              { label: 'Duración', diff: (duration - prev.duration_seconds) / 60, fmt: (v: number) => `${fmtSigned(v, 0)} min` },
            ].map((c) => (
              <div key={c.label} className="rounded-2xl bg-surface-2 p-3">
                <div className="text-xs text-muted">{c.label}</div>
                <div className={`tabular mt-1 flex items-center justify-center gap-1 font-bold ${c.diff > 0 ? 'text-success' : c.diff < 0 ? 'text-muted' : ''}`}>
                  {c.diff > 0 ? <TrendingUp size={14} aria-hidden /> : c.diff < 0 ? <TrendingDown size={14} aria-hidden /> : null}
                  {c.fmt(c.diff)}
                </div>
              </div>
            ))}
            <p className="col-span-3 text-xs text-muted">Frente a {prev.routine_name} del {formatLongDate(prev.session_date)}</p>
          </div>
        ) : (
          <p className="text-sm text-muted">Es tu primera sesión de esta rutina. ¡Buen comienzo!</p>
        )}
      </Card>

      <Card>
        <CardTitle>Récords personales</CardTitle>
        {bestQ.isPending ? (
          <Spinner className="py-4" />
        ) : prs.length ? (
          <ul className="space-y-2">
            {prs.map((p) => {
              const ex = s.exercises.find((e) => e.exercise_id === p.exercise_id)!.exercise
              return (
                <li key={p.exercise_id + p.kind} className="flex items-center gap-3 rounded-2xl bg-warning/10 p-3">
                  <Trophy size={20} className="shrink-0 text-warning" aria-hidden />
                  <div className="flex-1">
                    <div className="font-semibold">{ex.name}</div>
                    <div className="text-xs text-muted">{PR_LABEL[p.kind]}{p.kind === '1rm' && ' (estimación)'}</div>
                  </div>
                  <div className="tabular text-right">
                    <div className="font-bold">
                      {fmtNum(p.value, 1)} {ex.weight_unit}
                    </div>
                    <div className="text-xs text-muted">antes {fmtNum(p.previous, 1)}</div>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Medal size={16} aria-hidden /> Sin récords nuevos esta vez. La constancia es lo que cuenta.
          </p>
        )}
      </Card>

      <Card>
        <CardTitle>Ejercicios</CardTitle>
        <ul className="divide-y divide-border">
          {s.exercises.map((we) => (
            <li key={we.id} className="py-2">
              <div className="font-medium">{we.exercise.name}</div>
              <div className="tabular text-sm text-muted">
                {we.sets.filter((x) => x.completed).map((x) => `${fmtNum(x.weight ?? 0, (x.weight ?? 0) % 1 ? 1 : 0)}×${x.reps ?? 0}`).join(' · ') || 'Sin series completadas'}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => navigate(`/workout/session/${s.id}`)}>
          <Pencil size={16} /> Editar
        </Button>
        <Button className="flex-1" onClick={() => navigate('/')}>
          Ir al inicio
        </Button>
      </div>
    </div>
  )
}
