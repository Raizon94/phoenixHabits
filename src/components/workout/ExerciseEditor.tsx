import { useEffect, useState } from 'react'
import { MUSCLE_GROUPS, type Exercise, type ExerciseType, type WeightUnit } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, Select, TextArea, TextInput } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Controls'
import { t } from '@/i18n'

export function ExerciseEditor({ exercise, open, onClose, onSave, existingNames }: { exercise: Exercise | null; open: boolean; onClose: () => void; onSave: (e: Exercise) => void; existingNames: string[] }) {
  const [ex, setEx] = useState(exercise)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setEx(exercise)
    setError(null)
  }, [exercise, open])
  if (!ex) return null
  const set = (p: Partial<Exercise>) => setEx({ ...ex, ...p })

  function submit() {
    if (!ex) return
    const name = ex.name.trim()
    if (!name) return setError('El nombre es obligatorio')
    if (name.length > 80) return setError('Máximo 80 caracteres')
    if (existingNames.some((n) => n.toLowerCase() === name.toLowerCase())) return setError('Ya existe un ejercicio con ese nombre')
    onSave({ ...ex, name })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={exercise?.name ? 'Editar ejercicio' : 'Nuevo ejercicio'}
      footer={
        <Button className="w-full" size="lg" onClick={submit}>
          Guardar
        </Button>
      }
    >
      <div className="space-y-4">
        <TextInput label="Nombre" value={ex.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} placeholder="p. ej. Press banca" error={error} autoFocus />
        <Select label="Grupo muscular" value={ex.muscle_group} onChange={(e) => set({ muscle_group: e.target.value as Exercise['muscle_group'] })}>
          {MUSCLE_GROUPS.map((m) => (
            <option key={m} value={m}>
              {t().muscle[m]}
            </option>
          ))}
        </Select>
        <Select label="Tipo de ejercicio" value={ex.exercise_type} onChange={(e) => set({ exercise_type: e.target.value as ExerciseType })}>
          {(Object.keys(t().exerciseType) as ExerciseType[]).map((k) => (
            <option key={k} value={k}>
              {t().exerciseType[k]}
            </option>
          ))}
        </Select>
        <Field label="Unidad de peso">
          <Segmented<WeightUnit>
            label="Unidad"
            value={ex.weight_unit}
            onChange={(weight_unit) => set({ weight_unit })}
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lb' },
            ]}
          />
        </Field>
        <TextArea label="Notas (opcional)" value={ex.notes ?? ''} maxLength={2000} onChange={(e) => set({ notes: e.target.value })} placeholder="Ajustes de la máquina, técnica…" />
      </div>
    </Modal>
  )
}
