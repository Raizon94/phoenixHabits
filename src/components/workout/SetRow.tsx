import { useState } from 'react'
import { Check, Trash } from 'lucide-react'
import type { PreviousSet, SetType, WeightUnit, WorkoutSet } from '@/types'
import { NumberInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { t } from '@/i18n'
import { cn } from '@/utils/cn'
import { fmtNum } from '@/utils/weight'

const SET_TYPE_STYLE: Record<SetType, string> = {
  normal: 'text-text',
  warmup: 'text-warning',
  approach: 'text-sky-400',
  failure: 'text-danger',
}

interface Props {
  set: WorkoutSet
  index: number
  /** Número a mostrar (las series de calentamiento no cuentan) */
  label: string
  previous?: PreviousSet
  unit: WeightUnit
  repsLabel: string
  onChange: (patch: Partial<WorkoutSet>) => void
  onToggle: () => void
  onRemove: () => void
  showComplete?: boolean
}

export const SET_GRID = 'grid grid-cols-[2.25rem_minmax(0,1fr)_4.5rem_4rem_2.75rem] items-center gap-1.5 sm:grid-cols-[2.5rem_minmax(0,1fr)_6rem_5rem_3rem] sm:gap-2'

/** Fila de serie: tipo · anterior · peso · repeticiones · completar. */
export function SetRow({ set, index, label, previous, unit, repsLabel, onChange, onToggle, onRemove, showComplete = true }: Props) {
  const [menu, setMenu] = useState(false)
  const prevText = previous && (previous.weight != null || previous.reps != null) ? `${previous.weight != null ? fmtNum(previous.weight, previous.weight % 1 ? 1 : 0) : '–'} × ${previous.reps ?? '–'}` : '—'

  return (
    <div className={cn(SET_GRID, 'rounded-xl px-1 py-1 transition', set.completed && 'bg-success/12')}>
      <button
        type="button"
        onClick={() => setMenu(true)}
        aria-label={`Serie ${index + 1}, ${t().setType[set.set_type]}. Cambiar tipo o eliminar`}
        className={cn('tabular h-10 rounded-lg text-sm font-bold hover:bg-surface-2', SET_TYPE_STYLE[set.set_type])}
      >
        {label}
      </button>
      <button
        type="button"
        className="tabular truncate text-center text-xs text-muted hover:text-text"
        title="Usar valores anteriores"
        aria-label={`Anterior: ${prevText}. Copiar`}
        onClick={() => previous && onChange({ weight: previous.weight, reps: previous.reps })}
      >
        {prevText}
      </button>
      <NumberInput aria-label={`Peso serie ${index + 1} (${unit})`} className="h-10 rounded-xl px-1 font-semibold" value={set.weight} min={0} max={9999} onValue={(v) => onChange({ weight: v })} />
      <NumberInput aria-label={`${repsLabel} serie ${index + 1}`} className="h-10 rounded-xl px-1 font-semibold" decimals={false} value={set.reps} min={0} max={1000} onValue={(v) => onChange({ reps: v })} />
      {showComplete ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={set.completed}
          aria-label={`Completar serie ${index + 1}`}
          onClick={onToggle}
          className={cn(
            'flex h-10 w-full items-center justify-center rounded-xl transition active:scale-90',
            set.completed ? 'animate-pop bg-success text-black' : 'bg-surface-2 text-muted hover:text-text',
          )}
        >
          <Check size={20} strokeWidth={3} />
        </button>
      ) : (
        <span />
      )}

      <Modal open={menu} onClose={() => setMenu(false)} title={`Serie ${index + 1}`} size="sm">
        <div className="space-y-2">
          {(Object.keys(t().setType) as SetType[]).map((st) => (
            <button
              key={st}
              type="button"
              aria-pressed={set.set_type === st}
              onClick={() => {
                onChange({ set_type: st })
                setMenu(false)
              }}
              className={cn('flex h-12 w-full items-center gap-3 rounded-2xl px-4 text-left transition', set.set_type === st ? 'bg-accent-soft' : 'bg-surface-2 hover:bg-surface-3')}
            >
              <span className={cn('w-5 font-bold', SET_TYPE_STYLE[st])}>{t().setTypeShort[st] || '#'}</span>
              {t().setType[st]}
            </button>
          ))}
          <Button
            variant="ghost"
            className="mt-2 w-full text-danger"
            onClick={() => {
              onRemove()
              setMenu(false)
            }}
          >
            <Trash size={16} /> Eliminar serie
          </Button>
        </div>
      </Modal>
    </div>
  )
}
