import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ChartLine, Info } from 'lucide-react'
import { useExercises } from '@/hooks/useWorkoutData'
import { useUserId } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { fetchExerciseHistory } from '@/services/workoutService'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardTitle, Stat } from '@/components/ui/Card'
import { Select } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Controls'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/States'
import { SimpleBarChart, SimpleLineChart } from '@/components/stats/Charts'
import { formatDate, formatShort, type ISODate } from '@/utils/date'
import { epley1RM } from '@/utils/workout'
import { aggregatePoints, sessionPoint, type Granularity } from '@/utils/progress'
import { fmtNum, RANGE_OPTIONS, rangeStart, type RangeKey } from '@/utils/weight'

export default function ExerciseProgressPage() {
  const { exerciseId } = useParams()
  const navigate = useNavigate()
  const userId = useUserId()
  const { today } = useSettings()
  const { allExercises, loading } = useExercises()
  const [range, setRange] = useState<RangeKey>('all')
  const [gran, setGran] = useState<Granularity>('session')
  const exercise = allExercises.find((e) => e.id === exerciseId)

  const q = useQuery({
    queryKey: ['exerciseHistory', userId, exerciseId],
    queryFn: () => fetchExerciseHistory({ exerciseIds: [exerciseId!] }),
    enabled: !!exerciseId,
  })

  const from = rangeStart(range, today)
  const entries = useMemo(() => (q.data ?? []).filter((h) => !from || h.session_date >= from), [q.data, from])
  const points = useMemo(() => aggregatePoints(entries.map(sessionPoint), gran), [entries, gran])

  const best = useMemo(() => {
    let bestSet: { w: number; r: number; e: number; date: ISODate } | null = null
    let prWeight = 0
    for (const h of q.data ?? []) {
      for (const s of h.sets) {
        if (!s.completed || s.set_type === 'warmup' || !s.reps) continue
        const e = epley1RM(s.weight, s.reps)
        if (!bestSet || e > bestSet.e) bestSet = { w: s.weight ?? 0, r: s.reps, e, date: h.session_date }
        prWeight = Math.max(prWeight, s.weight ?? 0)
      }
    }
    return { bestSet, prWeight }
  }, [q.data])

  const unit = exercise?.weight_unit ?? 'kg'
  const xFormat = (d: string) => (gran === 'month' ? formatDate(d, { month: 'short', year: '2-digit' }) : formatShort(d))
  const fmtW = (v: number) => `${fmtNum(v, v % 1 ? 1 : 0)} ${unit}`

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader title="Progreso" subtitle="Evolución de fuerza por ejercicio" back="/workout" />

      <Select aria-label="Ejercicio" value={exerciseId ?? ''} onChange={(e) => navigate(`/workout/progress/${e.target.value}`, { replace: true })}>
        <option value="" disabled>
          Elige un ejercicio…
        </option>
        {allExercises.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
            {e.archived_at ? ' (archivado)' : ''}
          </option>
        ))}
      </Select>

      {!exerciseId && !loading && <EmptyState icon={ChartLine} title="Selecciona un ejercicio" description="Verás la evolución del peso, las repeticiones, el volumen y tu 1RM estimado." />}
      {q.error && <ErrorState error={q.error} onRetry={() => q.refetch()} />}
      {exerciseId && q.isPending && <Spinner />}

      {exercise && q.data && (
        <>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <Stat label="Récord de peso" value={best.prWeight ? fmtW(best.prWeight) : '—'} />
            <Stat label="Mejor serie" value={best.bestSet ? `${fmtNum(best.bestSet.w, best.bestSet.w % 1 ? 1 : 0)} × ${best.bestSet.r}` : '—'} hint={best.bestSet ? formatShort(best.bestSet.date) : undefined} />
            <Stat label="1RM estimado" value={best.bestSet ? fmtW(Math.round(best.bestSet.e * 10) / 10) : '—'} hint="Fórmula de Epley" />
            <Stat label="Sesiones" value={q.data.length} />
          </div>

          <div className="space-y-2">
            <Segmented<RangeKey> label="Periodo" value={range} onChange={setRange} options={RANGE_OPTIONS.map((o) => ({ value: o.key, label: o.label }))} />
            <Segmented<Granularity>
              label="Agrupar"
              value={gran}
              onChange={setGran}
              options={[
                { value: 'session', label: 'Por sesión' },
                { value: 'week', label: 'Semanal' },
                { value: 'month', label: 'Mensual' },
              ]}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardTitle>Peso máximo ({unit})</CardTitle>
              <SimpleLineChart data={points} xKey="date" xFormat={xFormat} series={[{ key: 'maxWeight', name: 'Peso máximo' }]} format={fmtW} />
            </Card>
            <Card>
              <CardTitle>1RM estimado ({unit})</CardTitle>
              <SimpleLineChart data={points} xKey="date" xFormat={xFormat} series={[{ key: 'e1rm', name: '1RM estimado' }]} format={(v) => fmtW(Math.round(v * 10) / 10)} />
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                <Info size={12} aria-hidden /> Estimación con la fórmula de Epley (peso × (1 + reps/30)), no una medición real.
              </p>
            </Card>
            <Card>
              <CardTitle>Volumen ({unit})</CardTitle>
              <SimpleBarChart data={points} xKey="date" yKey="volume" name="Volumen" xFormat={xFormat} format={(v) => fmtW(Math.round(v))} />
            </Card>
            <Card>
              <CardTitle>Repeticiones totales</CardTitle>
              <SimpleBarChart data={points} xKey="date" yKey="reps" name="Repeticiones" xFormat={xFormat} format={(v) => `${v} reps`} />
            </Card>
          </div>

          <Card>
            <CardTitle>Sesiones</CardTitle>
            {!entries.length && <p className="text-sm text-muted">Sin sesiones en este periodo.</p>}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Historial de {exercise.name}</caption>
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="py-2 font-medium">Fecha</th>
                    <th className="py-2 font-medium">Series</th>
                    <th className="py-2 text-right font-medium">1RM est.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[...entries].reverse().map((h) => (
                    <tr key={h.workout_exercise_id}>
                      <td className="py-2 pr-3 whitespace-nowrap">{formatShort(h.session_date)}</td>
                      <td className="tabular py-2 text-muted">
                        {h.sets.filter((s) => s.completed).map((s) => `${fmtNum(s.weight ?? 0, (s.weight ?? 0) % 1 ? 1 : 0)}×${s.reps ?? 0}`).join(' · ')}
                      </td>
                      <td className="tabular py-2 text-right">{fmtNum(sessionPoint(h).e1rm, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
