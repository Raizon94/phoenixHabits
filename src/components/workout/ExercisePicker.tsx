import { useMemo, useState } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import { MUSCLE_GROUPS, type Exercise, type MuscleGroup } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Field'
import { useExercises } from '@/hooks/useWorkoutData'
import { useUserId } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { newExercise } from '@/services/workoutService'
import { ExerciseEditor } from './ExerciseEditor'
import { t } from '@/i18n'
import { cn } from '@/utils/cn'

export function normalize(s: string) {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
}

export function MuscleFilter({ value, onChange }: { value: MuscleGroup | 'all'; onChange: (v: MuscleGroup | 'all') => void }) {
  return (
    <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="Grupo muscular">
      {(['all', ...MUSCLE_GROUPS] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={value === m}
          onClick={() => onChange(m)}
          className={cn('h-9 shrink-0 rounded-full px-3 text-sm whitespace-nowrap transition', value === m ? 'bg-accent text-black' : 'bg-surface-2 text-muted hover:text-text')}
        >
          {m === 'all' ? t().common.all : t().muscle[m]}
        </button>
      ))}
    </div>
  )
}

/** Selector de ejercicios de la biblioteca (multiselección) con creación rápida. */
export function ExercisePicker({ open, onClose, onPick, exclude = [] }: { open: boolean; onClose: () => void; onPick: (ex: Exercise[]) => void; exclude?: string[] }) {
  const { exercises, upsert } = useExercises()
  const userId = useUserId()
  const { settings } = useSettings()
  const [q, setQ] = useState('')
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState<Exercise | null>(null)

  const list = useMemo(
    () => exercises.filter((e) => (muscle === 'all' || e.muscle_group === muscle) && normalize(e.name).includes(normalize(q))),
    [exercises, q, muscle],
  )

  function done() {
    const picked = selected.map((id) => exercises.find((e) => e.id === id)).filter(Boolean) as Exercise[]
    onPick(picked)
    setSelected([])
    setQ('')
    onClose()
  }

  return (
    <>
      <Modal
        open={open && !creating}
        onClose={onClose}
        title="Añadir ejercicios"
        footer={
          <Button className="w-full" size="lg" disabled={!selected.length} onClick={done}>
            Añadir {selected.length ? `(${selected.length})` : ''}
          </Button>
        }
      >
        <div className="space-y-3">
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" aria-hidden />
            <TextInput aria-label="Buscar ejercicio" placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-11" />
          </div>
          <MuscleFilter value={muscle} onChange={setMuscle} />
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => setCreating({ ...newExercise(userId, settings.weight_unit), name: q, muscle_group: muscle === 'all' ? 'chest' : muscle })}
          >
            <Plus size={16} /> Crear ejercicio {q && `"${q}"`}
          </Button>
          <ul className="space-y-1">
            {list.map((e) => {
              const isSel = selected.includes(e.id)
              const disabled = exclude.includes(e.id)
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    aria-pressed={isSel}
                    onClick={() => setSelected((s) => (isSel ? s.filter((x) => x !== e.id) : [...s, e.id]))}
                    className={cn('flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition', isSel ? 'bg-accent-soft' : 'hover:bg-surface-2', disabled && 'opacity-40')}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{e.name}</div>
                      <div className="text-xs text-muted">{t().muscle[e.muscle_group]}{disabled ? ' · ya añadido' : ''}</div>
                    </div>
                    <div className={cn('flex h-7 w-7 items-center justify-center rounded-full border-2', isSel ? 'border-accent bg-accent text-black' : 'border-border')}>
                      {isSel && <Check size={16} strokeWidth={3} />}
                    </div>
                  </button>
                </li>
              )
            })}
            {!list.length && <li className="py-6 text-center text-sm text-muted">No hay ejercicios. Crea uno nuevo.</li>}
          </ul>
        </div>
      </Modal>
      <ExerciseEditor
        exercise={creating}
        open={!!creating}
        onClose={() => setCreating(null)}
        existingNames={exercises.map((e) => e.name)}
        onSave={(ex) => {
          const saved = upsert(ex)
          setSelected((s) => [...s, saved.id])
        }}
      />
    </>
  )
}
