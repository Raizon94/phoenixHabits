import { useState } from 'react'
import { Archive, ArchiveRestore, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ListChecks, Pencil, Plus, Trash } from 'lucide-react'
import type { Habit } from '@/types'
import { useHabits } from '@/hooks/useHabits'
import { useSettings } from '@/contexts/SettingsContext'
import { useFeedback } from '@/contexts/FeedbackContext'
import { useUserId } from '@/contexts/AuthContext'
import { newHabit } from '@/services/habitsService'
import { nowISO } from '@/lib/id'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Segmented } from '@/components/ui/Controls'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { HabitRow } from '@/components/habits/HabitRow'
import { HabitEditor } from '@/components/habits/HabitEditor'
import { HabitCalendar } from '@/components/habits/HabitCalendar'
import { habitIcon } from '@/components/habits/habitIcons'
import { addDays, formatLongDate, startOfMonth, WEEKDAY_SHORT, type ISODate } from '@/utils/date'
import { computeHabitStreaks, dayCompletion, isScheduled } from '@/utils/habits'
import { moveItem } from '@/utils/workout'
import { cn } from '@/utils/cn'

type Tab = 'day' | 'calendar' | 'manage'

export default function HabitsPage() {
  const [tab, setTab] = useState<Tab>('day')
  const { today } = useSettings()
  const [date, setDate] = useState<ISODate>(today)
  const [month, setMonth] = useState<ISODate>(startOfMonth(today))
  const data = useHabits()
  const [editing, setEditing] = useState<Habit | null>(null)
  const userId = useUserId()

  if (data.error) return <ErrorState error={data.error} onRetry={data.refetch} />

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Hábitos"
        actions={
          <Button size="sm" onClick={() => setEditing(newHabit(userId, data.allHabits.length))}>
            <Plus size={16} /> Nuevo
          </Button>
        }
      />
      <Segmented<Tab>
        label="Vista"
        className="mb-5"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'day', label: 'Registro' },
          { value: 'calendar', label: 'Calendario' },
          { value: 'manage', label: 'Gestionar' },
        ]}
      />

      {tab === 'day' && <DayView date={date} setDate={setDate} data={data} />}
      {tab === 'calendar' && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <HabitCalendar
              habits={data.habits}
              index={data.index}
              starts={data.starts}
              month={month}
              onMonth={setMonth}
              selected={date}
              onSelect={setDate}
              today={today}
            />
          </Card>
          <DayView date={date} setDate={setDate} data={data} compact />
        </div>
      )}
      {tab === 'manage' && <ManageView data={data} onEdit={setEditing} />}

      <HabitEditor habit={editing} open={!!editing} onClose={() => setEditing(null)} onSave={data.upsertHabit} />
    </div>
  )
}

function DayView({ date, setDate, data, compact }: { date: ISODate; setDate: (d: ISODate) => void; data: ReturnType<typeof useHabits>; compact?: boolean }) {
  const { today } = useSettings()
  const future = date > today
  const scheduled = data.habits.filter((h) => isScheduled(h, date))
  const others = data.habits.filter((h) => !isScheduled(h, date))
  const c = dayCompletion(data.habits, data.index, date, data.starts)
  return (
    <section aria-label={formatLongDate(date)}>
      <div className={cn('mb-3 flex items-center gap-2', compact && 'mt-0')}>
        <IconButton label="Día anterior" onClick={() => setDate(addDays(date, -1))}>
          <ChevronLeft size={20} />
        </IconButton>
        <div className="flex-1 text-center">
          <div className="font-semibold">{date === today ? 'Hoy' : date === addDays(today, -1) ? 'Ayer' : formatLongDate(date)}</div>
          <div className="tabular text-xs text-muted">
            {c.completed}/{c.scheduled} completados
          </div>
        </div>
        <IconButton label="Día siguiente" disabled={date >= today} onClick={() => setDate(addDays(date, 1))}>
          <ChevronRight size={20} />
        </IconButton>
      </div>
      <input
        type="date"
        aria-label="Elegir fecha"
        value={date}
        max={today}
        onChange={(e) => e.target.value && setDate(e.target.value)}
        className="mb-4 h-11 w-full rounded-2xl border border-border bg-surface-2 px-4 text-sm"
      />
      {future && <p className="mb-3 rounded-2xl bg-surface-2 p-3 text-sm text-muted">No se pueden registrar días futuros.</p>}
      <div className="space-y-2">
        {data.loading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-[70px]" />)}
        {scheduled.map((h) => (
          <HabitRow
            key={h.id}
            habit={h}
            log={data.index.get(h.id)?.get(date)}
            disabled={future}
            onToggle={() => data.toggle(h, date)}
            onValue={(v) => data.setLog(h, date, { value: v })}
          />
        ))}
        {!data.loading && !data.habits.length && <EmptyState icon={ListChecks} title="Sin hábitos" description="Crea tu primer hábito con el botón Nuevo." />}
      </div>
      {others.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-muted">No programados este día ({others.length})</summary>
          <div className="mt-2 space-y-2 opacity-80">
            {others.map((h) => (
              <HabitRow key={h.id} habit={h} log={data.index.get(h.id)?.get(date)} disabled={future} onToggle={() => data.toggle(h, date)} onValue={(v) => data.setLog(h, date, { value: v })} />
            ))}
          </div>
        </details>
      )}
    </section>
  )
}

function ManageView({ data, onEdit }: { data: ReturnType<typeof useHabits>; onEdit: (h: Habit) => void }) {
  const { confirm, toast } = useFeedback()
  const { today } = useSettings()
  const active = data.allHabits.filter((h) => !h.archived_at)
  const archived = data.allHabits.filter((h) => h.archived_at)

  function move(i: number, dir: -1 | 1) {
    const next = moveItem(active, i, i + dir)
    next.forEach((h, idx) => h.sort_order !== idx && data.upsertHabit({ ...h, sort_order: idx }))
  }

  async function del(h: Habit) {
    const ok = await confirm({
      title: `¿Eliminar "${h.name}"?`,
      message: 'Se borrará el hábito y todo su historial. Si solo quieres dejar de verlo, archívalo.',
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (ok) {
      data.removeHabit(h.id)
      toast('Hábito eliminado')
    }
  }

  const row = (h: Habit, i: number, isArchived: boolean) => {
    const Icon = habitIcon(h.icon)
    const s = computeHabitStreaks(h, data.index.get(h.id), data.starts.get(h.id) ?? today, today)
    return (
      <li key={h.id} className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-2 pl-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: h.color + '22', color: h.color }}>
          <Icon size={20} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{h.name}</div>
          <div className="truncate text-xs text-muted">
            {h.schedule_days.length === 7 ? 'Todos los días' : h.schedule_days.map((d) => WEEKDAY_SHORT[d - 1]).join(' ')}
            {h.type === 'numeric' && ` · ${h.target_value} ${h.unit ?? ''}`} · racha {s.current} (máx. {s.best})
          </div>
        </div>
        {!isArchived && (
          <div className="flex flex-col">
            <IconButton size="sm" label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
              <ChevronUp size={16} />
            </IconButton>
            <IconButton size="sm" label="Bajar" disabled={i === active.length - 1} onClick={() => move(i, 1)}>
              <ChevronDown size={16} />
            </IconButton>
          </div>
        )}
        <IconButton label="Editar" onClick={() => onEdit(h)}>
          <Pencil size={18} />
        </IconButton>
        <IconButton
          label={isArchived ? 'Restaurar' : 'Archivar'}
          onClick={() => {
            data.upsertHabit({ ...h, archived_at: isArchived ? null : nowISO() })
            toast(isArchived ? 'Hábito restaurado' : 'Hábito archivado')
          }}
        >
          {isArchived ? <ArchiveRestore size={18} /> : <Archive size={18} />}
        </IconButton>
        <IconButton label="Eliminar" className="hover:text-danger" onClick={() => del(h)}>
          <Trash size={18} />
        </IconButton>
      </li>
    )
  }

  return (
    <div className="space-y-6">
      <ul className="space-y-2">{active.map((h, i) => row(h, i, false))}</ul>
      {archived.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted">Archivados</h2>
          <ul className="space-y-2 opacity-70">{archived.map((h, i) => row(h, i, true))}</ul>
        </section>
      )}
    </div>
  )
}
