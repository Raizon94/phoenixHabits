import { describe, expect, it } from 'vitest'
import type { Habit, HabitLog } from '@/types'
import { activityHeatmap, completionByPeriod, heatLevel } from '@/utils/stats'
import { indexLogs } from '@/utils/habits'

const h: Habit = { id: 'a', user_id: 'u', name: 'A', icon: 'check', color: '#fff', type: 'binary', target_value: null, unit: null, schedule_days: [1, 2, 3, 4, 5, 6, 7], sort_order: 0, system_key: null, archived_at: null, created_at: '', updated_at: '' }
const log = (d: string): HabitLog => ({ id: d, user_id: 'u', habit_id: 'a', log_date: d, completed: true, value: null, updated_at: '' })

describe('estadísticas de hábitos', () => {
  const idx = indexLogs(['2026-10-05', '2026-10-06', '2026-10-12'].map(log))
  const starts = new Map([['a', '2026-10-05']])

  it('calcula el cumplimiento semanal sin contar días futuros', () => {
    const w = completionByPeriod([h], idx, starts, '2026-10-05', '2026-10-13', 'week')
    expect(w).toEqual([
      { period: '2026-10-05', rate: 2 / 7 },
      { period: '2026-10-12', rate: 1 / 2 },
    ])
  })

  it('genera semanas completas de lunes a domingo para el heatmap', () => {
    const weeks = activityHeatmap([h], idx, starts, '2026-10-05', '2026-10-13')
    expect(weeks).toHaveLength(2)
    expect(weeks[0][0]).toMatchObject({ date: '2026-10-05', ratio: 1 })
    expect(weeks[1][2].future).toBe(true)
    expect(heatLevel(1)).toBe(4)
    expect(heatLevel(0.5)).toBe(2)
    expect(heatLevel(null)).toBe(0)
  })
})
