import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ArchiveRestore, ChartLine, Dumbbell, Pencil, Plus, Search, Trash } from 'lucide-react'
import type { Exercise, MuscleGroup } from '@/types'
import { useExercises } from '@/hooks/useWorkoutData'
import { useUserId } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useFeedback } from '@/contexts/FeedbackContext'
import { exerciseHasHistory, newExercise } from '@/services/workoutService'
import { nowISO } from '@/lib/id'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button, IconButton } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Field'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { ExerciseEditor } from '@/components/workout/ExerciseEditor'
import { MuscleFilter, normalize } from '@/components/workout/ExercisePicker'
import { t } from '@/i18n'

export default function ExercisesPage() {
  const { allExercises, loading, error, refetch, upsert, remove } = useExercises()
  const userId = useUserId()
  const { settings } = useSettings()
  const { confirm, toast } = useFeedback()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all')
  const [editing, setEditing] = useState<Exercise | null>(null)

  const list = useMemo(
    () => allExercises.filter((e) => (muscle === 'all' || e.muscle_group === muscle) && normalize(e.name).includes(normalize(q))),
    [allExercises, q, muscle],
  )
  const active = list.filter((e) => !e.archived_at)
  const archived = list.filter((e) => e.archived_at)

  async function del(e: Exercise) {
    let hasHistory = false
    try {
      hasHistory = await exerciseHasHistory(e.id)
    } catch {
      toast('Necesitas conexión para eliminar ejercicios', 'error')
      return
    }
    if (hasHistory) {
      const ok = await confirm({
        title: `"${e.name}" tiene historial`,
        message: 'Para no perder tus entrenamientos anteriores, el ejercicio se archivará: dejará de aparecer en la biblioteca pero su historial se conserva.',
        confirmLabel: 'Archivar',
      })
      if (ok) {
        upsert({ ...e, archived_at: nowISO() })
        toast('Ejercicio archivado')
      }
      return
    }
    const ok = await confirm({ title: `¿Eliminar "${e.name}"?`, message: 'También se quitará de las rutinas que lo usen.', confirmLabel: 'Eliminar', danger: true })
    if (ok) {
      remove(e.id)
      toast('Ejercicio eliminado')
    }
  }

  if (error) return <ErrorState error={error} onRetry={refetch} />

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Ejercicios"
        subtitle={`${active.length} en la biblioteca`}
        back="/workout"
        actions={
          <Button size="sm" onClick={() => setEditing(newExercise(userId, settings.weight_unit))}>
            <Plus size={16} /> Nuevo
          </Button>
        }
      />
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" aria-hidden />
          <TextInput aria-label="Buscar ejercicio" placeholder="Buscar ejercicio…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-11" />
        </div>
        <MuscleFilter value={muscle} onChange={setMuscle} />
      </div>

      {loading && [0, 1, 2, 3].map((i) => <Skeleton key={i} className="mb-2 h-16" />)}
      {!loading && !allExercises.length && (
        <EmptyState
          icon={Dumbbell}
          title="Tu biblioteca está vacía"
          description="Crea los ejercicios que haces habitualmente para usarlos en tus rutinas."
          action={<Button onClick={() => setEditing(newExercise(userId, settings.weight_unit))}>Crear ejercicio</Button>}
        />
      )}

      <ul className="space-y-2">
        {active.map((e) => (
          <li key={e.id} className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-2 pl-4">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{e.name}</div>
              <div className="truncate text-xs text-muted">
                {t().muscle[e.muscle_group]} · {t().exerciseType[e.exercise_type]} · {e.weight_unit}
                {e.notes ? ` · ${e.notes}` : ''}
              </div>
            </div>
            <Link to={`/workout/progress/${e.id}`} aria-label={`Progreso de ${e.name}`} className="flex h-11 w-11 items-center justify-center rounded-xl text-muted hover:bg-surface-2 hover:text-text">
              <ChartLine size={18} />
            </Link>
            <IconButton label="Editar" onClick={() => setEditing(e)}>
              <Pencil size={18} />
            </IconButton>
            <IconButton label="Eliminar" className="hover:text-danger" onClick={() => del(e)}>
              <Trash size={18} />
            </IconButton>
          </li>
        ))}
      </ul>

      {archived.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-semibold text-muted">Archivados</h2>
          <ul className="space-y-2 opacity-70">
            {archived.map((e) => (
              <li key={e.id} className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-2 pl-4">
                <div className="flex-1 truncate">{e.name}</div>
                <IconButton label="Restaurar" onClick={() => upsert({ ...e, archived_at: null })}>
                  <ArchiveRestore size={18} />
                </IconButton>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ExerciseEditor
        exercise={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onSave={upsert}
        existingNames={allExercises.filter((x) => x.id !== editing?.id).map((x) => x.name)}
      />
    </div>
  )
}
