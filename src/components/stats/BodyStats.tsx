import { useMemo } from 'react'
import { useWeights } from '@/hooks/useBody'
import { useSettings } from '@/contexts/SettingsContext'
import { Card, CardTitle, Stat } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/Controls'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { SimpleLineChart } from './Charts'
import { addDays, diffDays, formatDate, formatShort, startOfMonth, startOfWeek, type ISODate } from '@/utils/date'
import { computeWeightStats, fmtNum, fmtSigned, periodAverages } from '@/utils/weight'
import { convertWeight } from '@/utils/workout'

export function BodyStats({ from }: { from: ISODate | null }) {
  const { logs, loading, error, refetch } = useWeights()
  const { today, settings } = useSettings()
  const unit = settings.weight_unit
  const u = (kg: number) => convertWeight(kg, 'kg', unit)

  const inRange = useMemo(() => logs.filter((l) => !from || l.log_date >= from), [logs, from])
  const stats = computeWeightStats(inRange)
  const overall = computeWeightStats(logs, settings.target_weight_kg)

  const weekly = useMemo(() => periodAverages(inRange, startOfWeek).map((w) => ({ period: w.period, avg: u(w.avg) })), [inRange, unit]) // eslint-disable-line react-hooks/exhaustive-deps
  const monthly = useMemo(() => periodAverages(inRange, startOfMonth).map((w) => ({ period: w.period, avg: u(w.avg) })), [inRange, unit]) // eslint-disable-line react-hooks/exhaustive-deps

  // Comparación con el periodo anterior de la misma duración.
  const comparison = useMemo(() => {
    const start = from ?? logs[0]?.log_date
    if (!start) return null
    const len = diffDays(today, start) + 1
    const prevFrom = addDays(start, -len)
    const prev = logs.filter((l) => l.log_date >= prevFrom && l.log_date < start)
    const avg = (xs: typeof logs) => (xs.length ? xs.reduce((a, l) => a + l.weight_kg, 0) / xs.length : null)
    return { current: avg(inRange), previous: avg(prev), prevFrom, start }
  }, [from, logs, inRange, today])

  const target = settings.target_weight_kg
  const progress =
    target != null && overall.initial && overall.current && overall.initial.weight_kg !== target
      ? Math.max(0, Math.min(1, (overall.initial.weight_kg - overall.current.weight_kg) / (overall.initial.weight_kg - target)))
      : null

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (loading) return <Skeleton className="h-96" />

  const show = (kg: number | null | undefined) => (kg == null ? '—' : `${fmtNum(u(kg))} ${unit}`)
  const diff = (kg: number | null | undefined) => (kg == null ? '—' : `${fmtSigned(u(kg))} ${unit}`)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Variación en el periodo" value={diff(stats.totalChange)} hint={stats.initial ? `desde ${formatShort(stats.initial.log_date)}` : undefined} />
        <Stat label="Media del periodo" value={show(stats.average)} />
        <Stat label="Mínimo" value={show(stats.min?.weight_kg)} />
        <Stat label="Máximo" value={show(stats.max?.weight_kg)} />
      </div>

      {target != null && (
        <Card>
          <CardTitle>Progreso hacia el objetivo</CardTitle>
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted">Inicio {show(overall.initial?.weight_kg)}</span>
            <span className="font-semibold">Actual {show(overall.current?.weight_kg)}</span>
            <span className="text-muted">Objetivo {show(target)}</span>
          </div>
          <ProgressBar value={progress ?? 0} color="var(--success)" className="h-3" />
          <p className="mt-2 text-xs text-muted">
            {progress != null && `${Math.round(progress * 100)}% del camino`}
            {overall.toTarget != null && ` · ${Math.abs(overall.toTarget) < 0.05 ? 'objetivo alcanzado' : `${fmtNum(Math.abs(u(overall.toTarget)))} ${unit} por recorrer`}`}
          </p>
        </Card>
      )}

      {comparison && comparison.previous != null && comparison.current != null && (
        <Card>
          <CardTitle>Comparación con el periodo anterior</CardTitle>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-2xl bg-surface-2 p-3">
              <div className="text-xs text-muted">Anterior</div>
              <div className="tabular font-bold">{show(comparison.previous)}</div>
              <div className="text-[11px] text-muted">desde {formatShort(comparison.prevFrom)}</div>
            </div>
            <div className="rounded-2xl bg-surface-2 p-3">
              <div className="text-xs text-muted">Actual</div>
              <div className="tabular font-bold">{show(comparison.current)}</div>
              <div className="text-[11px] text-muted">desde {formatShort(comparison.start)}</div>
            </div>
            <div className="rounded-2xl bg-surface-2 p-3">
              <div className="text-xs text-muted">Diferencia de medias</div>
              <div className="tabular font-bold">{diff(comparison.current - comparison.previous)}</div>
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Promedio semanal ({unit})</CardTitle>
          <SimpleLineChart data={weekly} xKey="period" series={[{ key: 'avg', name: 'Media semanal' }]} xFormat={formatShort} format={(v) => `${fmtNum(v)} ${unit}`} />
        </Card>
        <Card>
          <CardTitle>Tendencia mensual ({unit})</CardTitle>
          <SimpleLineChart data={monthly} xKey="period" series={[{ key: 'avg', name: 'Media mensual' }]} xFormat={(d) => formatDate(d, { month: 'short', year: '2-digit' })} format={(v) => `${fmtNum(v)} ${unit}`} />
        </Card>
      </div>
    </div>
  )
}
