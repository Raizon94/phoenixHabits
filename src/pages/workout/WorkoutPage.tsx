import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ChartLine, ChevronDown, ChevronUp, ClipboardList, Copy, Dumbbell, History, Pencil, Play, Plus, Trash, Zap } from 'lucide-react'
import type { RoutineWithExercises } from '@/types'
import { useActiveSessionId, useRoutines } from '@/hooks/useWorkoutData'
import { useUserId } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useFeedback } from '@/contexts/FeedbackContext'
import { duplicateRoutine, newRoutine, reorderRoutines, startEmptySession, startSession } from '@/services/workoutService'
import { writeActiveSnapshot } from '@/services/activeSession'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { moveItem } from '@/utils/workout'

export default function WorkoutPage() {
  const { routines, loading, error, refetch, remove, setAll } = useRoutines()
  const { data: activeId } = useActiveSessionId()
  const userId = useUserId()
  const { today } = useSettings()
  const { confirm, toast } = useFeedback()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [starting, setStarting] = useState<string | null>(null)

  async function start(routine: RoutineWithExercises | null) {
    if (activeId) {
      toast('Ya tienes un entrenamiento en curso', 'info')
      navigate(`/workout/session/${activeId}`)
      return
    }
    setStarting(routine?.id ?? 'empty')
    try {
      let session
      let previous
      if (routine) {
        const r = await startSession(routine, userId, today)
        session = r.session
        previous = r.previous
      } else {
        session = startEmptySession(userId, today, 'Entrenamiento libre')
      }
      qc.setQueryData(['session', session.id], { session, previous: previous ? [...previous.entries()] : [] })
      qc.setQueryData(['activeSession', userId], session.id)
      writeActiveSnapshot(session, previous)
      navigate(`/workout/session/${session.id}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo iniciar', 'error')
    } finally {
      setStarting(null)
    }
  }

  function move(i: number, dir: -1 | 1) {
    const next = moveItem(routines, i, i + dir).map((r, idx) => ({ ...r, sort_order: idx }))
    setAll(next)
    reorderRoutines(next)
  }

  function duplicate(r: RoutineWithExercises) {
    const copy = duplicateRoutine(r, routines.length)
    setAll([...routines, copy])
    toast('Rutina duplicada')
  }

  async function del(r: RoutineWithExercises) {
    const ok = await confirm({ title: `¿Eliminar "${r.name}"?`, message: 'El historial de entrenamientos de esta rutina se conserva.', confirmLabel: 'Eliminar', danger: true })
    if (ok) {
      remove(r.id)
      toast('Rutina eliminada')
    }
  }

  if (error) return <ErrorState error={error} onRetry={refetch} />

  return (
    <div className="animate-fade-in">
      <PageHeader title="Entreno" />

      <div className="mb-6 grid grid-cols-3 gap-2">
        {[
          { to: '/workout/history', icon: History, label: 'Historial' },
          { to: '/workout/exercises', icon: ClipboardList, label: 'Ejercicios' },
          { to: '/workout/progress', icon: ChartLine, label: 'Progreso' },
        ].map((l) => (
          <Link key={l.to} to={l.to} className="flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-surface py-3 text-sm font-medium transition hover:bg-surface-2">
            <l.icon size={20} className="text-accent" aria-hidden />
            {l.label}
          </Link>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Rutinas</h2>
        <Button size="sm" variant="secondary" onClick={() => navigate(`/workout/routines/new`, { state: newRoutine(userId, routines.length) })}>
          <Plus size={16} /> Nueva rutina
        </Button>
      </div>

      {loading && [0, 1].map((i) => <Skeleton key={i} className="mb-3 h-32" />)}
      {!loading && !routines.length && (
        <EmptyState
          icon={Dumbbell}
          title="Aún no tienes rutinas"
          description="Crea rutinas como Push, Pull o Legs con tus propios ejercicios."
          action={<Button onClick={() => navigate(`/workout/routines/new`, { state: newRoutine(userId, 0) })}>Crear rutina</Button>}
        />
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {routines.map((r, i) => (
          <Card key={r.id} className="flex flex-col">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-lg font-bold">{r.name}</h3>
                {r.description && <p className="truncate text-sm text-muted">{r.description}</p>}
              </div>
              <div className="flex">
                <IconButton size="sm" label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ChevronUp size={16} />
                </IconButton>
                <IconButton size="sm" label="Bajar" disabled={i === routines.length - 1} onClick={() => move(i, 1)}>
                  <ChevronDown size={16} />
                </IconButton>
              </div>
            </div>
            <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted">{r.exercises.length ? r.exercises.map((e) => e.exercise.name).join(' · ') : 'Sin ejercicios'}</p>
            <div className="mt-4 flex items-center gap-1">
              <Button className="flex-1" onClick={() => start(r)} loading={starting === r.id} disabled={!!starting || !r.exercises.length}>
                <Play size={16} fill="currentColor" /> Empezar
              </Button>
              <IconButton label="Editar" onClick={() => navigate(`/workout/routines/${r.id}`)}>
                <Pencil size={18} />
              </IconButton>
              <IconButton label="Duplicar" onClick={() => duplicate(r)}>
                <Copy size={18} />
              </IconButton>
              <IconButton label="Eliminar" className="hover:text-danger" onClick={() => del(r)}>
                <Trash size={18} />
              </IconButton>
            </div>
          </Card>
        ))}
      </div>

      {!loading && (
        <Button variant="ghost" className="mt-4 w-full" onClick={() => start(null)} loading={starting === 'empty'} disabled={!!starting}>
          <Zap size={16} /> Entrenamiento libre (sin rutina)
        </Button>
      )}
    </div>
  )
}
