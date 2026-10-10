import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import type { Habit, HabitLog } from '@/types'
import { isLogCompleted } from '@/utils/habits'
import { cn } from '@/utils/cn'
import { habitIcon } from './habitIcons'
import { NumberInput } from '@/components/ui/Field'
import { ProgressBar } from '@/components/ui/Controls'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

const nf = new Intl.NumberFormat('es-ES')

interface Props {
  habit: Habit
  log: HabitLog | undefined
  onToggle: () => void
  onValue: (v: number | null) => void
  disabled?: boolean
  streak?: number
}

/** Fila de hábito con control de completado (binario) o registro de cantidad (numérico). */
export function HabitRow({ habit, log, onToggle, onValue, disabled, streak }: Props) {
  const done = isLogCompleted(habit, log)
  const Icon = habitIcon(habit.icon)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<number | null>(null)
  const value = log?.value ?? 0
  const target = habit.target_value ?? 0

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border p-3 transition',
        done ? 'border-transparent' : 'border-border bg-surface',
      )}
      style={done ? { background: habit.color + '1f' } : undefined}
    >
      <div
        className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition')}
        style={{ background: done ? habit.color : habit.color + '22', color: done ? '#0a0a0b' : habit.color }}
        aria-hidden
      >
        <Icon size={22} />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn('truncate font-semibold', done && 'opacity-90')}>{habit.name}</div>
        {habit.type === 'numeric' ? (
          <div className="mt-1 space-y-1">
            <div className="tabular text-xs text-muted">
              {nf.format(value)} / {nf.format(target)} {habit.unit ?? ''}
            </div>
            <ProgressBar value={target ? value / target : 0} color={habit.color} className="h-1.5" />
          </div>
        ) : (
          streak !== undefined && streak > 0 && <div className="text-xs text-muted">🔥 {streak} {streak === 1 ? 'día' : 'días'}</div>
        )}
      </div>
      {habit.type === 'numeric' ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => {
            setDraft(log?.value ?? null)
            setEditing(true)
          }}
          aria-label={`Registrar ${habit.name}`}
          className={cn(
            'flex h-11 min-w-11 items-center justify-center rounded-xl px-2 transition active:scale-95',
            done ? 'text-black' : 'bg-surface-2 text-muted hover:text-text',
          )}
          style={done ? { background: habit.color } : undefined}
        >
          {done ? <Check size={22} strokeWidth={3} /> : <Plus size={22} />}
        </button>
      ) : (
        <button
          type="button"
          role="checkbox"
          aria-checked={done}
          aria-label={`${habit.name}: ${done ? 'completado' : 'pendiente'}`}
          disabled={disabled}
          onClick={onToggle}
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 transition active:scale-90',
            done ? 'animate-pop border-transparent text-black' : 'border-border text-transparent hover:border-muted',
          )}
          style={done ? { background: habit.color } : undefined}
        >
          <Check size={22} strokeWidth={3} />
        </button>
      )}

      <Modal open={editing} onClose={() => setEditing(false)} title={habit.name} size="sm">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            onValue(draft)
            setEditing(false)
          }}
        >
          <div>
            <label className="mb-1.5 block text-sm text-muted" htmlFor={`v-${habit.id}`}>
              {habit.unit ? `Cantidad (${habit.unit})` : 'Cantidad'} · objetivo {nf.format(target)}
            </label>
            <NumberInput id={`v-${habit.id}`} value={draft} onValue={setDraft} decimals={false} min={0} max={1_000_000} className="h-14 text-2xl font-bold" autoFocus />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[1000, 2500, 5000].map((n) => (
              <Button key={n} variant="secondary" size="sm" onClick={() => setDraft((d) => (d ?? 0) + n)}>
                +{nf.format(n)}
              </Button>
            ))}
            <Button variant="secondary" size="sm" onClick={() => setDraft(target)}>
              Meta
            </Button>
          </div>
          <Button type="submit" className="w-full" size="lg">
            Guardar
          </Button>
        </form>
      </Modal>
    </div>
  )
}
