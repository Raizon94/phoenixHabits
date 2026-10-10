import { useMemo } from 'react'
import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ChevronRight, Dumbbell, Flame, Scale, Trophy } from 'lucide-react'
import { useHabits } from '@/hooks/useHabits'
import { useRoutines } from '@/hooks/useWorkoutData'
import { useWeights } from '@/hooks/useBody'
import { useSettings } from '@/contexts/SettingsContext'
import { useUserId } from '@/contexts/AuthContext'
import { fetchRecentSummaries, nextRoutineInRotation } from '@/services/workoutService'
import { HabitRow } from '@/components/habits/HabitRow'
import { Card, CardTitle } from '@/components/ui/Card'
import { ProgressRing } from '@/components/ui/Controls'
import { ErrorState, Skeleton } from '@/components/ui/States'
import { addDays, formatLongDate, formatShort, startOfWeek, WEEKDAY_SHORT } from '@/utils/date'
import { computeGlobalStreak, computeHabitStreaks, dayCompletion, globalCompletionRate, isScheduled } from '@/utils/habits'
import { fmtNum, fmtSigned } from '@/utils/weight'
import { convertWeight } from '@/utils/workout'
import { cn } from '@/utils/cn'

function greeting() {
  const h = new Date().getHours()
  if (h < 6) return 'Buenas noches'
  if (h < 13) return 'Buenos días'
  if (h < 21) return 'Buenas tardes'
  return 'Buenas noches'
}

export function DashboardPage() {
  const { today, settings } = useSettings()
  const userId = useUserId()
  const { habits, index, starts, loading, error, refetch, toggle, setLog } = useHabits()
  const { routines } = useRoutines()
  const { logs: weights } = useWeights()
  const recent = useQuery({ queryKey: ['sessionSummaries', userId, 'recent'], queryFn: () => fetchRecentSummaries(10) })

  const todayHabits = useMemo(() => habits.filter((h) => isScheduled(h, today)), [habits, today])
  const otherHabits = useMemo(() => habits.filter((h) => !isScheduled(h, today)), [habits, today])
  const completion = dayCompletion(habits, index, today, starts)
  const streak = useMemo(() => computeGlobalStreak(habits, index, starts, today), [habits, index, starts, today])
  const weekStart = startOfWeek(today)
  const weekRate = globalCompletionRate(habits, index, starts, weekStart, addDays(weekStart, 6), today)

  const lastSession = recent.data?.[0]
  const trainedToday = recent.data?.some((s) => s.session_date === today)
  const next = nextRoutineInRotation(routines, lastSession?.routine_id)
  const gym = habits.find((h) => h.system_key === 'gym')
  const gymToday = gym ? isScheduled(gym, today) : false

  const lastW = weights[weights.length - 1]
  const prevW = weights[weights.length - 2]
  const unit = settings.weight_unit
  const showW = (kg: number) => fmtNum(convertWeight(kg, 'kg', unit))

  if (error) return <ErrorState error={error} onRetry={refetch} />

  return (
    <div className="animate-fade-in space-y-5">
      <header>
        <p className="text-sm text-muted">{formatLongDate(today)}</p>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{greeting()}</h1>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {/* Progreso diario */}
          <Card className="flex items-center gap-5">
            <ProgressRing value={completion.ratio ?? 0} size={112} stroke={11}>
              <span className="tabular text-2xl font-bold">{Math.round((completion.ratio ?? 0) * 100)}%</span>
              <span className="text-[11px] text-muted">hoy</span>
            </ProgressRing>
            <div className="flex-1 space-y-3">
              <div>
                <div className="tabular text-xl font-bold">
                  {completion.completed} / {completion.scheduled}
                </div>
                <div className="text-sm text-muted">hábitos completados</div>
              </div>
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <Flame size={16} className="text-accent" aria-hidden />
                  <span className="tabular font-semibold">{streak.current}</span>
                  <span className="text-muted">racha</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Trophy size={16} className="text-warning" aria-hidden />
                  <span className="tabular font-semibold">{streak.best}</span>
                  <span className="text-muted">máx.</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Hábitos de hoy */}
          <section aria-labelledby="today-habits">
            <div className="mb-2 flex items-center justify-between">
              <h2 id="today-habits" className="font-semibold">
                Hábitos de hoy
              </h2>
              <Link to="/habits" className="text-sm text-muted hover:text-text">
                Gestionar
              </Link>
            </div>
            <div className="space-y-2">
              {loading && [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[70px]" />)}
              {todayHabits.map((h) => (
                <HabitRow
                  key={h.id}
                  habit={h}
                  log={index.get(h.id)?.get(today)}
                  onToggle={() => toggle(h, today)}
                  onValue={(v) => setLog(h, today, { value: v })}
                  streak={computeHabitStreaks(h, index.get(h.id), starts.get(h.id) ?? today, today).current}
                />
              ))}
              {!loading && !todayHabits.length && <p className="rounded-2xl bg-surface p-4 text-sm text-muted">No hay hábitos programados para hoy.</p>}
            </div>
            {otherHabits.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm text-muted">No programados hoy ({otherHabits.length})</summary>
                <div className="mt-2 space-y-2 opacity-80">
                  {otherHabits.map((h) => (
                    <HabitRow key={h.id} habit={h} log={index.get(h.id)?.get(today)} onToggle={() => toggle(h, today)} onValue={(v) => setLog(h, today, { value: v })} />
                  ))}
                </div>
              </details>
            )}
          </section>
        </div>

        <div className="space-y-5">
          {/* Resumen semanal */}
          <Card>
            <CardTitle action={<span className="tabular text-sm font-semibold">{weekRate.rate == null ? '—' : `${Math.round(weekRate.rate * 100)}%`}</span>}>Esta semana</CardTitle>
            <div className="grid grid-cols-7 gap-1.5">
              {WEEKDAY_SHORT.map((d, i) => {
                const date = addDays(weekStart, i)
                const c = dayCompletion(habits, index, date, starts)
                const future = date > today
                return (
                  <div key={d} className="flex flex-col items-center gap-1.5">
                    <div className="relative flex h-20 w-full items-end overflow-hidden rounded-lg bg-surface-2" aria-label={`${d}: ${c.completed}/${c.scheduled}`}>
                      {!future && <div className="w-full rounded-lg bg-accent transition-all" style={{ height: `${(c.ratio ?? 0) * 100}%` }} />}
                    </div>
                    <span className={cn('text-xs', date === today ? 'font-bold text-accent' : 'text-muted')}>{d}</span>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Entrenamiento */}
          <Card>
            <CardTitle>Entrenamiento de hoy</CardTitle>
            {trainedToday ? (
              <p className="text-sm">✅ Hoy ya has entrenado ({recent.data?.find((s) => s.session_date === today)?.routine_name}).</p>
            ) : next ? (
              <Link to="/workout" className="flex items-center gap-3 rounded-2xl bg-surface-2 p-3 transition hover:bg-surface-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <Dumbbell size={22} aria-hidden />
                </div>
                <div className="flex-1">
                  <div className="font-semibold">{next.name}</div>
                  <div className="text-xs text-muted">
                    {gymToday ? 'Día de gimnasio' : 'Descanso programado'} · {next.exercises.length} ejercicios
                  </div>
                </div>
                <ChevronRight size={18} className="text-muted" aria-hidden />
              </Link>
            ) : (
              <Link to="/workout" className="text-sm text-accent">
                Crea tu primera rutina →
              </Link>
            )}
            {lastSession && <p className="mt-3 text-xs text-muted">Último: {lastSession.routine_name} · {formatShort(lastSession.session_date)}</p>}
          </Card>

          {/* Peso */}
          <Card>
            <CardTitle action={<Link to="/body" className="text-sm text-muted hover:text-text">Ver</Link>}>Peso corporal</CardTitle>
            {lastW ? (
              <div className="flex items-end justify-between">
                <div>
                  <div className="tabular text-3xl font-bold">
                    {showW(lastW.weight_kg)} <span className="text-base font-medium text-muted">{unit}</span>
                  </div>
                  <div className="text-xs text-muted">{formatShort(lastW.log_date)}</div>
                </div>
                {prevW && (
                  <div className="tabular text-sm text-muted">
                    {fmtSigned(convertWeight(lastW.weight_kg - prevW.weight_kg, 'kg', unit))} {unit}
                  </div>
                )}
              </div>
            ) : (
              <Link to="/body" className="flex items-center gap-2 text-sm text-accent">
                <Scale size={16} aria-hidden /> Registra tu peso
              </Link>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
