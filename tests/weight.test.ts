import { describe, expect, it } from 'vitest'
import { computeWeightStats, linearTrend, movingAverage, parseDecimal, periodAverages, rangeStart, fmtSigned } from '@/utils/weight'
import { startOfWeek } from '@/utils/date'

const l = (log_date: string, weight_kg: number) => ({ log_date, weight_kg })

describe('estadísticas de peso', () => {
  const logs = [l('2026-09-01', 92), l('2026-09-10', 91), l('2026-10-01', 90), l('2026-10-03', 89.5), l('2026-10-10', 89)]

  it('calcula inicial, actual, mínimo, máximo y variaciones', () => {
    const s = computeWeightStats(logs, 85)
    expect(s.initial?.weight_kg).toBe(92)
    expect(s.current?.weight_kg).toBe(89)
    expect(s.min?.weight_kg).toBe(89)
    expect(s.max?.weight_kg).toBe(92)
    expect(s.totalChange).toBe(-3)
    expect(s.weeklyChange).toBe(-0.5) // vs 2026-10-03
    expect(s.monthlyChange).toBe(-2) // vs 2026-09-10 (último antes del 10/09)
    expect(s.toTarget).toBe(-4)
  })

  it('sin datos devuelve nulos', () => {
    expect(computeWeightStats([]).current).toBeNull()
  })

  it('media móvil por días naturales', () => {
    const ma = movingAverage([l('2026-10-01', 90), l('2026-10-02', 92), l('2026-10-09', 88)])
    expect(ma.map((m) => m.avg)).toEqual([90, 91, 88]) // el 9 ya no incluye el 1 ni el 2
  })

  it('tendencia lineal', () => {
    const t = linearTrend([l('2026-10-01', 90), l('2026-10-11', 89)])!
    expect(t.slopePerDay).toBeCloseTo(-0.1, 6)
  })

  it('promedios semanales', () => {
    const w = periodAverages([l('2026-10-05', 90), l('2026-10-07', 89), l('2026-10-12', 88)], startOfWeek)
    expect(w).toEqual([{ period: '2026-10-05', avg: 89.5, count: 2 }, { period: '2026-10-12', avg: 88, count: 1 }])
  })

  it('rangos de fecha', () => {
    expect(rangeStart('7d', '2026-10-10')).toBe('2026-10-04')
    expect(rangeStart('all', '2026-10-10')).toBeNull()
  })

  it('acepta coma decimal', () => {
    expect(parseDecimal('89,5')).toBe(89.5)
    expect(parseDecimal('89.5')).toBe(89.5)
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('')).toBeNull()
    expect(fmtSigned(-0.5)).toBe('−0,5')
  })
})
