import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ChevronDown, ChevronUp, Clock, Dumbbell, EllipsisVertical, Plus, Trash, X } from 'lucide-react'
import type { SessionExerciseFull } from '@/types'
import { useSessionEditor } from '@/hooks/useSessionEditor'
import { useHabits } from '@/hooks/useHabits'
import { useSettings } from '@/contexts/SettingsContext'
import { useFeedback } from '@/contexts/FeedbackContext'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { TextArea } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, Spinner } from '@/components/ui/States'
import { SET_GRID, SetRow } from '@/components/workout/SetRow'
import { ExercisePicker } from '@/components/workout/ExercisePicker'
import { formatDuration, formatLongDate } from '@/utils/date'
import { completedSetCount, convertWeight, exerciseVolume, previousForPosition, sessionDurationSeconds, sessionVolume } from '@/utils/workout'
import { fmtNum } from '@/utils/weight'
import { t } from '@/i18n'
import { cn } from '@/utils/cn'

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    const request = () =>
      navigator.wakeLock
        .request('screen')
        .then((l) => (lock = l))
        .catch(() => undefined)
    request()
    const vis = () => document.visibilityState === 'visible' && request()
    document.addEventListener('visibilitychange', vis)
    return () => {
      document.removeEventListener('visibilitychange', vis)
      lock?.release().catch(() => undefined)
    }
  }, [active])
}

export default function SessionPage() {
  const { id = '' } = useParams()
  const ed = useSessionEditor(id)
  const { settings } = useSettings()
  const { markGym } = useHabits()
  const { confirm, toast } = useFeedback()
  const navigate = useNavigate()
  const [now, setNow] = useState(Date.now())
  const [picker, setPicker] = useState(false)
  const [menuFor, setMenuFor] = useState<SessionExerciseFull | null>(null)
  const s = ed.session
  const live = s?.status === 'in_progress'

  useWakeLock(!!live)
  useEffect(() => {
    if (!live) return
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [live])

  if (ed.error && !s) return <ErrorState error={ed.error} />
  if (ed.notFound) return <EmptyState icon={Dumbbell} title="Entrenamiento no encontrado" action={<Button onClick={() => navigate('/workout')}>Volver</Button>} />
  if (!s) return <Spinner />

  const unit = settings.weight_unit
  const volume = sessionVolume(s.exercises, unit)
  const doneSets = completedSetCount(s.exercises)
  const totalSets = s.exercises.reduce((a, e) => a + e.sets.length, 0)

  async function finish() {
    if (!s) return
    const pending = s.exercises.flatMap((e) => e.sets).filter((x) => !x.completed).length
    if (doneSets === 0) {
      toast('Marca al menos una serie como completada', 'info')
      return
    }
    const ok = await confirm({
      title: '¿Finalizar entrenamiento?',
      message: pending ? `Hay ${pending} serie${pending > 1 ? 's' : ''} sin completar. No contarán para el volumen ni los récords.` : 'Se guardará en tu historial.',
      confirmLabel: 'Finalizar',
    })
    if (!ok) return
    const done = ed.finish()
    if (done && markGym(done.session_date)) toast('Hábito de gimnasio completado 💪')
    navigate(`/workout/session/${s.id}/summary`, { replace: true })
  }

  async function cancel() {
    const ok = await confirm({
      title: live ? '¿Cancelar entrenamiento?' : '¿Eliminar entrenamiento?',
      message: live ? 'Se descartará esta sesión y todas sus series.' : 'Se eliminará del historial de forma permanente.',
      confirmLabel: live ? 'Descartar' : 'Eliminar',
      danger: true,
    })
    if (!ok) return
    ed.cancel()
    toast(live ? 'Entrenamiento descartado' : 'Entrenamiento eliminado')
    navigate(live ? '/workout' : '/workout/history', { replace: true })
  }

  return (
    <div className="pb-24">
      {/* Cabecera fija */}
      <div className="sticky top-[calc(env(safe-area-inset-top)+3rem)] z-20 -mx-4 mb-4 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur-xl md:top-0 md:-mx-8 md:px-8">
        <div className="flex items-center gap-3">
          <IconButton label="Salir" className="-ml-2" onClick={() => navigate(live ? '/workout' : '/workout/history')}>
            <X size={22} />
          </IconButton>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">{s.routine_name}</h1>
            <div className="tabular flex gap-3 text-xs text-muted">
              <span className="flex items-center gap-1">
                <Clock size={12} aria-hidden />
                {live ? formatDuration(sessionDurationSeconds(s, now)) : formatDuration(sessionDurationSeconds(s))}
              </span>
              <span>
                {fmtNum(volume, 0)} {unit}
              </span>
              <span>
                {doneSets}/{totalSets} series
              </span>
            </div>
          </div>
          {live ? (
            <Button onClick={finish} variant="success">
              Finalizar
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => navigate(`/workout/session/${s.id}/summary`)}>
              Resumen
            </Button>
          )}
        </div>
      </div>

      {!live && (
        <Card className="mb-4 space-y-3">
          <p className="text-sm text-muted">Editando un entrenamiento del {formatLongDate(s.session_date)}. Los cambios se guardan automáticamente.</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm text-muted">
              Fecha
              <input
                type="date"
                value={s.session_date}
                onChange={(e) => e.target.value && ed.updateHeader({ session_date: e.target.value })}
                className="mt-1 h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-text"
              />
            </label>
            <label className="text-sm text-muted">
              Duración (min)
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={1440}
                value={Math.round(sessionDurationSeconds(s) / 60)}
                onChange={(e) => {
                  const m = Number(e.target.value)
                  if (m > 0 && m <= 1440) ed.updateHeader({ ended_at: new Date(new Date(s.started_at).getTime() + m * 60000).toISOString() })
                }}
                className="tabular mt-1 h-11 w-full rounded-2xl border border-border bg-surface-2 px-3 text-text"
              />
            </label>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        {s.exercises.map((we, i) => {
          const prev = ed.previous.get(we.exercise_id)
          let n = 0
          const repsLabel = we.exercise.exercise_type === 'duration' ? 'seg' : 'reps'
          return (
            <Card key={we.id} className="p-3 sm:p-4">
              <div className="mb-2 flex items-start gap-2">
                <div className="min-w-0 flex-1 pl-1">
                  <h2 className="truncate font-bold text-accent">{we.exercise.name}</h2>
                  <div className="text-xs text-muted">
                    {t().muscle[we.exercise.muscle_group]}
                    {exerciseVolume(we.sets) > 0 && ` · ${fmtNum(convertWeight(exerciseVolume(we.sets), we.exercise.weight_unit, unit), 0)} ${unit}`}
                  </div>
                  {we.exercise.notes && <p className="mt-1 text-xs text-muted italic">{we.exercise.notes}</p>}
                </div>
                <IconButton size="sm" label="Opciones del ejercicio" onClick={() => setMenuFor(we)}>
                  <EllipsisVertical size={18} />
                </IconButton>
              </div>
              <div className={cn(SET_GRID, 'px-1 pb-1 text-[11px] font-medium tracking-wide text-muted uppercase')} aria-hidden>
                <span className="text-center">Serie</span>
                <span className="text-center">Anterior</span>
                <span className="text-center">{we.exercise.weight_unit}</span>
                <span className="text-center">{repsLabel}</span>
                <span className="text-center">✓</span>
              </div>
              <div className="space-y-1">
                {we.sets.map((set, j) => {
                  const label = set.set_type === 'warmup' ? 'C' : String(++n) + (set.set_type === 'failure' ? 'F' : set.set_type === 'approach' ? 'A' : '')
                  return (
                    <SetRow
                      key={set.id}
                      set={set}
                      index={j}
                      label={label}
                      previous={live ? previousForPosition(prev, set.position) : undefined}
                      unit={we.exercise.weight_unit}
                      repsLabel={repsLabel}
                      onChange={(patch) => ed.updateSet(we.id, set.id, patch)}
                      onToggle={() => ed.toggleSet(we.id, set)}
                      onRemove={() => ed.removeSet(we.id, set.id)}
                    />
                  )
                })}
              </div>
              {we.notes && <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">{we.notes}</p>}
              <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => ed.addSet(we.id)}>
                <Plus size={16} /> Añadir serie
              </Button>
              <span className="sr-only">Ejercicio {i + 1} de {s.exercises.length}</span>
            </Card>
          )
        })}
      </div>

      {!s.exercises.length && <EmptyState icon={Dumbbell} title="Sin ejercicios" description="Añade ejercicios para empezar a registrar series." />}

      <Button variant="secondary" size="lg" className="mt-4 w-full" onClick={() => setPicker(true)}>
        <Plus size={18} /> Añadir ejercicio
      </Button>
      <Button variant="ghost" className="mt-2 w-full text-danger" onClick={cancel}>
        <Trash size={16} /> {live ? 'Cancelar entrenamiento' : 'Eliminar entrenamiento'}
      </Button>

      <ExercisePicker open={picker} onClose={() => setPicker(false)} onPick={ed.addExercises} exclude={s.exercises.map((e) => e.exercise_id)} />

      <Modal open={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.exercise.name ?? ''} size="sm">
        {menuFor && (
          <ExerciseMenu
            we={menuFor}
            index={s.exercises.findIndex((e) => e.id === menuFor.id)}
            count={s.exercises.length}
            onMove={(to) => {
              ed.moveExercise(s.exercises.findIndex((e) => e.id === menuFor.id), to)
              setMenuFor(null)
            }}
            onNotes={(v) => ed.updateExerciseNotes(menuFor.id, v)}
            onRemove={async () => {
              setMenuFor(null)
              const ok = await confirm({ title: `¿Quitar ${menuFor.exercise.name}?`, message: 'Se eliminarán sus series de esta sesión.', confirmLabel: 'Quitar', danger: true })
              if (ok) ed.removeExercise(menuFor.id)
            }}
          />
        )}
      </Modal>
    </div>
  )
}

function ExerciseMenu({ we, index, count, onMove, onNotes, onRemove }: { we: SessionExerciseFull; index: number; count: number; onMove: (to: number) => void; onNotes: (v: string) => void; onRemove: () => void }) {
  const [notes, setNotes] = useState(we.notes ?? '')
  return (
    <div className="space-y-3">
      <TextArea label="Notas de hoy" value={notes} maxLength={1000} onChange={(e) => {
          setNotes(e.target.value)
          onNotes(e.target.value.trim())
        }} />
      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" disabled={index === 0} onClick={() => onMove(index - 1)}>
          <ChevronUp size={16} /> Subir
        </Button>
        <Button variant="secondary" disabled={index === count - 1} onClick={() => onMove(index + 1)}>
          <ChevronDown size={16} /> Bajar
        </Button>
      </div>
      <Button variant="ghost" className="w-full text-danger" onClick={onRemove}>
        <Trash size={16} /> Quitar ejercicio
      </Button>
    </div>
  )
}
