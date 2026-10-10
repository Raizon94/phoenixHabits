import { useMemo } from 'react'
import { Flame, Star, Trophy } from 'lucide-react'
import { useHabits } from '@/hooks/useHabits'
import { useSettings } from '@/contexts/SettingsContext'
import { Card, CardTitle, Stat } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/Controls'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { habitIcon } from '@/components/habits/habitIcons'
import { SimpleBarChart } from './Charts'
import { addMonths, formatDate, formatLongDate, formatShort, WEEKDAY_SHORT, type ISODate } from '@/utils/date'
import { computeGlobalStreak, computeHabitStreaks, globalCompletionRate, habitCompletionRate, perfectDays } from '@/utils/habits'
import { activityHeatmap, completionByPeriod, heatLevel } from '@/utils/stats'
import { cn } from '@/utils/cn'

const HEAT = ['var(--surface-2)', 'color-mix(in srgb, var(--accent) 30%, var(--surface-2))', 'color-mix(in srgb, var(--accent) 55%, var(--surface-2))', 'color-mix(in srgb, var(--accent) 80%, var(--surface-2))', 'var(--accent)']
const pct = (r: number | null) => (r == null ? '—' : `${Math.round(r * 100)}%`)

export function HabitStats({ from }: { from: ISODate | null }) {
  const { habits, index, starts, loading, error, refetch } = useHabits()
  const { today } = useSettings()

  // Inicio efectivo: el filtro o el primer día con datos.
  const earliest = useMemo(() => {
    let e = today
    for (const s of starts.values()) if (s < e) e = s
    return e
  }, [starts, today])
  const start = from && from > earliest ? from : earliest

  const global = globalCompletionRate(habits, index, starts, start, today, today)
  const perfect = perfectDays(habits, index, starts, start, today, today)
  const gStreak = useMemo(() => computeGlobalStreak(habits, index, starts, today), [habits, index, starts, today])

  const perHabit = useMemo(
    () =>
      habits
        .map((h) => ({
          habit: h,
          rate: habitCompletionRate(h, index.get(h.id), starts.get(h.id) ?? today, start, today, today),
          streak: computeHabitStreaks(h, index.get(h.id), starts.get(h.id) ?? today, today),
        }))
        .sort((a, b) => (b.rate.rate ?? -1) - (a.rate.rate ?? -1)),
    [habits, index, starts, start, today],
  )

  const weekly = useMemo(() => completionByPeriod(habits, index, starts, start, today, 'week').map((w) => ({ ...w, pct: Math.round((w.rate ?? 0) * 100) })), [habits, index, starts, start, today])
  const monthly = useMemo(() => completionByPeriod(habits, index, starts, start, today, 'month').map((w) => ({ ...w, pct: Math.round((w.rate ?? 0) * 100) })), [habits, index, starts, start, today])

  // El heatmap muestra como mucho un año para seguir siendo legible en móvil.
  const heatFrom = start < addMonths(today, -12) ? addMonths(today, -12) : start
  const heat = useMemo(() => activityHeatmap(habits, index, starts, heatFrom, today), [habits, index, starts, heatFrom, today])

  if (error) return <ErrorState error={error} onRetry={refetch} />
  if (loading) return <Skeleton className="h-96" />

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Cumplimiento global" value={pct(global.rate)} hint={`${global.completed}/${global.scheduled} registros`} />
        <Stat label="Días perfectos" value={perfect} hint="todos los hábitos" />
        <Stat label="Racha actual" value={<span className="flex items-center gap-1"><Flame size={16} className="text-accent" aria-hidden />{gStreak.current}</span>} hint="días completos" />
        <Stat label="Racha máxima" value={<span className="flex items-center gap-1"><Trophy size={16} className="text-warning" aria-hidden />{gStreak.best}</span>} hint="días completos" />
      </div>

      <Card>
        <CardTitle>Calendario de actividad</CardTitle>
        <div className="overflow-x-auto pb-1">
          <div className="flex gap-[3px]" role="img" aria-label="Calendario de actividad: intensidad según el porcentaje de hábitos completados cada día">
            <div className="mr-1 flex flex-col gap-[3px] text-[9px] text-muted">
              {WEEKDAY_SHORT.map((d, i) => (
                <span key={d} className="flex h-3 items-center">{i % 2 === 0 ? d : ''}</span>
              ))}
            </div>
            {heat.map((w) => (
              <div key={w[0].date} className="flex flex-col gap-[3px]">
                {w.map((c) => (
                  <span
                    key={c.date}
                    title={c.future || c.before ? undefined : `${formatLongDate(c.date)}: ${pct(c.ratio)}`}
                    className={cn('h-3 w-3 rounded-[3px]', (c.future || c.before) && 'opacity-0')}
                    style={{ background: HEAT[heatLevel(c.ratio)] }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted">
          Menos {HEAT.map((c) => <span key={c} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: c }} />)} Más
        </div>
      </Card>

      <Card>
        <CardTitle>Constancia por hábito</CardTitle>
        <ul className="space-y-3">
          {perHabit.map(({ habit, rate, streak }, i) => {
            const Icon = habitIcon(habit.icon)
            return (
              <li key={habit.id} className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: habit.color + '22', color: habit.color }}>
                  <Icon size={18} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium">
                      {i === 0 && rate.rate != null && <Star size={12} className="mr-1 inline text-warning" aria-label="Más constante" />}
                      {habit.name}
                    </span>
                    <span className="tabular text-sm font-semibold">{pct(rate.rate)}</span>
                  </div>
                  <ProgressBar value={rate.rate ?? 0} color={habit.color} className="mt-1 h-1.5" />
                  <div className="tabular mt-1 text-xs text-muted">
                    Racha {streak.current} · máx. {streak.best} · {rate.completed}/{rate.scheduled} días
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Evolución semanal (%)</CardTitle>
          <SimpleBarChart data={weekly} xKey="period" yKey="pct" name="Cumplimiento" xFormat={formatShort} format={(v) => `${v}%`} />
        </Card>
        <Card>
          <CardTitle>Evolución mensual (%)</CardTitle>
          <SimpleBarChart data={monthly} xKey="period" yKey="pct" name="Cumplimiento" xFormat={(d) => formatDate(d, { month: 'short', year: '2-digit' })} format={(v) => `${v}%`} />
        </Card>
      </div>
    </div>
  )
}
