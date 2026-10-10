import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router'
import { ChevronDown, ChevronUp, Minus, Plus, Trash } from 'lucide-react'
import type { Exercise, RoutineWithExercises, WorkoutRoutine } from '@/types'
import { useRoutines } from '@/hooks/useWorkoutData'
import { useUserId } from '@/contexts/AuthContext'
import { useFeedback } from '@/contexts/FeedbackContext'
import { newRoutine, newRoutineSet } from '@/services/workoutService'
import { newId, nowISO } from '@/lib/id'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { NumberInput, TextArea, TextInput } from '@/components/ui/Field'
import { Spinner } from '@/components/ui/States'
import { ExercisePicker } from '@/components/workout/ExercisePicker'
import { moveItem } from '@/utils/workout'
import { t } from '@/i18n'

export default function RoutineEditorPage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const userId = useUserId()
  const { routines, loading, save } = useRoutines()
  const { toast } = useFeedback()
  const [r, setR] = useState<RoutineWithExercises | null>(null)
  const [picker, setPicker] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isNew = id === 'new'

  useEffect(() => {
    if (r) return
    if (isNew) {
      const base = (location.state as WorkoutRoutine | null) ?? newRoutine(userId, routines.length)
      setR({ ...base, exercises: [] })
    } else if (!loading) {
      const found = routines.find((x) => x.id === id)
      if (found) setR(structuredClone(found))
    }
  }, [isNew, loading, routines, id, r, location.state, userId])

  if (!r) return loading ? <Spinner /> : <p className="text-muted">Rutina no encontrada.</p>

  const update = (patch: Partial<RoutineWithExercises>) => setR({ ...r, ...patch })
  const updateEx = (i: number, patch: Partial<RoutineWithExercises['exercises'][number]>) =>
    update({ exercises: r.exercises.map((e, idx) => (idx === i ? { ...e, ...patch } : e)) })

  function addExercises(list: Exercise[]) {
    if (!r) return
    const added = list.map((ex, k) => {
      const reId = newId()
      return {
        id: reId,
        user_id: userId,
        routine_id: r.id,
        exercise_id: ex.id,
        position: r.exercises.length + k,
        notes: null,
        updated_at: nowISO(),
        exercise: ex,
        sets: [0, 1, 2].map((p) => newRoutineSet(userId, reId, p)),
      }
    })
    update({ exercises: [...r.exercises, ...added] })
  }

  function submit() {
    if (!r) return
    if (!r.name.trim()) return setError('Ponle un nombre a la rutina')
    save({ ...r, name: r.name.trim(), exercises: r.exercises.map((e, i) => ({ ...e, position: i })) })
    toast('Rutina guardada')
    navigate('/workout')
  }

  return (
    <div className="animate-fade-in pb-24">
      <PageHeader title={isNew ? 'Nueva rutina' : 'Editar rutina'} back="/workout" actions={<Button size="sm" onClick={submit}>Guardar</Button>} />
      <Card className="mb-5 space-y-4">
        <TextInput label="Nombre" value={r.name} maxLength={60} placeholder="Push, Pull, Pierna…" onChange={(e) => update({ name: e.target.value })} error={error} autoFocus={isNew} />
        <TextArea label="Descripción (opcional)" value={r.description ?? ''} maxLength={500} onChange={(e) => update({ description: e.target.value })} />
      </Card>

      <h2 className="mb-1 font-semibold">Ejercicios</h2>
      <p className="mb-3 text-xs text-muted">
        Las series de abajo son la plantilla inicial. Cuando ya hayas hecho un ejercicio, el entrenamiento cargará automáticamente los pesos y repeticiones de tu última sesión.
      </p>

      <div className="space-y-3">
        {r.exercises.map((re, i) => (
          <Card key={re.id} className="p-3">
            <div className="flex items-center gap-1">
              <div className="min-w-0 flex-1 pl-1">
                <div className="truncate font-semibold">{re.exercise.name}</div>
                <div className="text-xs text-muted">{t().muscle[re.exercise.muscle_group]}</div>
              </div>
              <IconButton size="sm" label="Subir" disabled={i === 0} onClick={() => update({ exercises: moveItem(r.exercises, i, i - 1) })}>
                <ChevronUp size={16} />
              </IconButton>
              <IconButton size="sm" label="Bajar" disabled={i === r.exercises.length - 1} onClick={() => update({ exercises: moveItem(r.exercises, i, i + 1) })}>
                <ChevronDown size={16} />
              </IconButton>
              <IconButton size="sm" label="Quitar ejercicio" className="hover:text-danger" onClick={() => update({ exercises: r.exercises.filter((_, idx) => idx !== i) })}>
                <Trash size={16} />
              </IconButton>
            </div>
            <div className="mt-2 grid grid-cols-[2rem_1fr_1fr] items-center gap-2 text-xs text-muted">
              <span className="text-center">#</span>
              <span className="text-center">{re.exercise.weight_unit}</span>
              <span className="text-center">reps</span>
              {re.sets.map((s, j) => (
                <div key={s.id} className="contents">
                  <span className="tabular text-center text-sm font-semibold text-text">{j + 1}</span>
                  <NumberInput
                    aria-label={`Peso serie ${j + 1}`}
                    className="h-10"
                    value={s.target_weight}
                    min={0}
                    max={9999}
                    onValue={(v) => updateEx(i, { sets: re.sets.map((x) => (x.id === s.id ? { ...x, target_weight: v } : x)) })}
                  />
                  <NumberInput
                    aria-label={`Repeticiones serie ${j + 1}`}
                    className="h-10"
                    decimals={false}
                    value={s.target_reps}
                    min={0}
                    max={1000}
                    onValue={(v) => updateEx(i, { sets: re.sets.map((x) => (x.id === s.id ? { ...x, target_reps: v } : x)) })}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  const last = re.sets[re.sets.length - 1]
                  updateEx(i, { sets: [...re.sets, newRoutineSet(userId, re.id, re.sets.length, { target_weight: last?.target_weight ?? null, target_reps: last?.target_reps ?? null })] })
                }}
              >
                <Plus size={14} /> Serie
              </Button>
              <Button size="sm" variant="ghost" className="flex-1" disabled={re.sets.length <= 1} onClick={() => updateEx(i, { sets: re.sets.slice(0, -1) })}>
                <Minus size={14} /> Serie
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Button variant="secondary" size="lg" className="mt-4 w-full" onClick={() => setPicker(true)}>
        <Plus size={18} /> Añadir ejercicios
      </Button>

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={addExercises} exclude={r.exercises.map((e) => e.exercise_id)} />
    </div>
  )
}
