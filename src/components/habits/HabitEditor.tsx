import { useEffect, useState } from 'react'
import type { Habit, HabitType } from '@/types'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Field, NumberInput, TextInput } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Controls'
import { WEEKDAY_NAMES, WEEKDAY_SHORT } from '@/utils/date'
import { cn } from '@/utils/cn'
import { HABIT_COLORS, HABIT_ICONS } from './habitIcons'

interface Props {
  habit: Habit | null
  open: boolean
  onClose: () => void
  onSave: (h: Habit) => void
}

export function HabitEditor({ habit, open, onClose, onSave }: Props) {
  const [h, setH] = useState<Habit | null>(habit)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    setH(habit)
    setError(null)
  }, [habit, open])
  if (!h) return null
  const set = (patch: Partial<Habit>) => setH({ ...h, ...patch })

  function submit() {
    if (!h) return
    if (!h.name.trim()) return setError('El nombre es obligatorio')
    if (h.name.trim().length > 60) return setError('Máximo 60 caracteres')
    if (!h.schedule_days.length) return setError('Elige al menos un día')
    if (h.type === 'numeric' && !(h.target_value && h.target_value > 0)) return setError('Indica un objetivo mayor que 0')
    onSave({ ...h, target_value: h.type === 'numeric' ? h.target_value : null, unit: h.type === 'numeric' ? h.unit?.trim() || null : null })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={habit?.name ? 'Editar hábito' : 'Nuevo hábito'}
      footer={
        <Button className="w-full" size="lg" onClick={submit}>
          Guardar
        </Button>
      }
    >
      <div className="space-y-5">
        <TextInput label="Nombre" value={h.name} maxLength={60} onChange={(e) => set({ name: e.target.value })} placeholder="p. ej. Meditar" error={error} />

        <Field label="Icono">
          <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="Icono">
            {Object.entries(HABIT_ICONS).map(([name, Icon]) => (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={h.icon === name}
                aria-label={name}
                onClick={() => set({ icon: name })}
                className={cn('flex aspect-square items-center justify-center rounded-xl transition', h.icon === name ? 'text-black' : 'bg-surface-2 text-muted hover:text-text')}
                style={h.icon === name ? { background: h.color } : undefined}
              >
                <Icon size={18} />
              </button>
            ))}
          </div>
        </Field>

        <Field label="Color">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
            {HABIT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={h.color === c}
                aria-label={c}
                onClick={() => set({ color: c })}
                className={cn('h-9 w-9 rounded-full transition', h.color === c && 'ring-2 ring-text ring-offset-2 ring-offset-surface')}
                style={{ background: c }}
              />
            ))}
          </div>
        </Field>

        <Field label="Tipo">
          <Segmented<HabitType>
            label="Tipo de hábito"
            value={h.type}
            onChange={(type) => set({ type, target_value: type === 'numeric' ? (h.target_value ?? 1) : null })}
            options={[
              { value: 'binary', label: 'Sí / No' },
              { value: 'numeric', label: 'Cantidad' },
            ]}
          />
        </Field>

        {h.type === 'numeric' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Objetivo diario">
              <NumberInput value={h.target_value} onValue={(v) => set({ target_value: v })} min={0} max={1_000_000} />
            </Field>
            <TextInput label="Unidad" value={h.unit ?? ''} maxLength={20} onChange={(e) => set({ unit: e.target.value })} placeholder="pasos, vasos…" />
          </div>
        )}

        <Field label="Días programados">
          <div className="flex gap-1.5">
            {WEEKDAY_SHORT.map((d, i) => {
              const day = i + 1
              const on = h.schedule_days.includes(day)
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  aria-label={WEEKDAY_NAMES[i]}
                  onClick={() => set({ schedule_days: on ? h.schedule_days.filter((x) => x !== day) : [...h.schedule_days, day].sort() })}
                  className={cn('h-11 flex-1 rounded-xl text-sm font-semibold transition', on ? 'text-black' : 'bg-surface-2 text-muted')}
                  style={on ? { background: h.color } : undefined}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </Field>
      </div>
    </Modal>
  )
}
