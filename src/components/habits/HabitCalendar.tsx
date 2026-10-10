import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Habit } from '@/types'
import { addMonths, formatLongDate, formatMonth, monthGrid, startOfMonth, WEEKDAY_SHORT, type ISODate } from '@/utils/date'
import { dayCompletion, isLogCompleted, isScheduled, type LogIndex } from '@/utils/habits'
import { cn } from '@/utils/cn'
import { IconButton } from '@/components/ui/Button'

interface Props {
  habits: Habit[]
  index: LogIndex
  starts: Map<string, ISODate>
  month: ISODate
  onMonth: (m: ISODate) => void
  selected: ISODate
  onSelect: (d: ISODate) => void
  today: ISODate
}

/** Calendario mensual: intensidad según % cumplido y un punto de color por hábito programado. */
export function HabitCalendar({ habits, index, starts, month, onMonth, selected, onSelect, today }: Props) {
  const weeks = monthGrid(month)
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <IconButton label="Mes anterior" onClick={() => onMonth(addMonths(startOfMonth(month), -1))}>
          <ChevronLeft size={20} />
        </IconButton>
        <h2 className="font-semibold">{formatMonth(month)}</h2>
        <IconButton label="Mes siguiente" onClick={() => onMonth(addMonths(startOfMonth(month), 1))}>
          <ChevronRight size={20} />
        </IconButton>
      </div>
      <div role="grid" aria-label={formatMonth(month)} className="space-y-1">
        <div role="row" className="grid grid-cols-7 gap-1">
          {WEEKDAY_SHORT.map((d) => (
            <div key={d} role="columnheader" className="py-1 text-center text-xs font-medium text-muted">
              {d}
            </div>
          ))}
        </div>
        {weeks.map((w) => (
          <div role="row" key={w[0].date} className="grid grid-cols-7 gap-1">
            {w.map(({ date, inMonth }) => {
              const future = date > today
              const c = dayCompletion(habits, index, date, starts)
              const scheduledHabits = habits.filter((h) => isScheduled(h, date) && !(starts.get(h.id) && date < starts.get(h.id)!))
              const ratio = future ? null : c.ratio
              return (
                <button
                  key={date}
                  role="gridcell"
                  type="button"
                  aria-selected={selected === date}
                  aria-label={`${formatLongDate(date)}: ${c.completed} de ${c.scheduled} hábitos`}
                  onClick={() => onSelect(date)}
                  className={cn(
                    'relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl text-sm transition',
                    !inMonth && 'opacity-30',
                    selected === date ? 'ring-2 ring-accent' : 'hover:bg-surface-2',
                    date === today && 'font-bold text-accent',
                  )}
                  style={ratio ? { background: `color-mix(in srgb, var(--accent) ${Math.round(ratio * 32)}%, transparent)` } : undefined}
                >
                  <span className="tabular leading-none">{Number(date.slice(8))}</span>
                  {!future && scheduledHabits.length > 0 && (
                    <span className="flex max-w-full flex-wrap justify-center gap-[2px] px-0.5" aria-hidden>
                      {scheduledHabits.slice(0, 6).map((h) => (
                        <span
                          key={h.id}
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: isLogCompleted(h, index.get(h.id)?.get(date)) ? h.color : 'var(--surface-3)' }}
                        />
                      ))}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
