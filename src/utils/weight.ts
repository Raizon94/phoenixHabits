import type { BodyWeightLog } from '@/types'
import { addDays, addMonths, diffDays, type ISODate } from './date'

export type RangeKey = '7d' | '30d' | '90d' | '6m' | '1y' | 'all'

export const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7 d' },
  { key: '30d', label: '30 d' },
  { key: '90d', label: '90 d' },
  { key: '6m', label: '6 m' },
  { key: '1y', label: '1 año' },
  { key: 'all', label: 'Todo' },
]

/** Fecha de inicio (inclusiva) de un rango; null = sin límite. */
export function rangeStart(key: RangeKey, today: ISODate): ISODate | null {
  switch (key) {
    case '7d':
      return addDays(today, -6)
    case '30d':
      return addDays(today, -29)
    case '90d':
      return addDays(today, -89)
    case '6m':
      return addMonths(today, -6)
    case '1y':
      return addMonths(today, -12)
    case 'all':
      return null
  }
}

type WeightPoint = Pick<BodyWeightLog, 'log_date' | 'weight_kg'>

export function sortByDate<T extends { log_date: ISODate }>(logs: T[]): T[] {
  return [...logs].sort((a, b) => (a.log_date < b.log_date ? -1 : a.log_date > b.log_date ? 1 : 0))
}

/**
 * Media móvil por días de calendario: para cada registro, media de los registros
 * de los 7 días naturales que terminan en esa fecha (no de los 7 registros previos).
 */
export function movingAverage(logs: WeightPoint[], windowDays = 7): { log_date: ISODate; avg: number }[] {
  const sorted = sortByDate(logs)
  const out: { log_date: ISODate; avg: number }[] = []
  let startIdx = 0
  let sum = 0
  for (let i = 0; i < sorted.length; i++) {
    sum += sorted[i].weight_kg
    while (diffDays(sorted[i].log_date, sorted[startIdx].log_date) >= windowDays) {
      sum -= sorted[startIdx].weight_kg
      startIdx++
    }
    out.push({ log_date: sorted[i].log_date, avg: sum / (i - startIdx + 1) })
  }
  return out
}

/** Regresión lineal por mínimos cuadrados. slopePerDay en kg/día. */
export function linearTrend(logs: WeightPoint[]): { slopePerDay: number; intercept: number; origin: ISODate } | null {
  const sorted = sortByDate(logs)
  if (sorted.length < 2) return null
  const origin = sorted[0].log_date
  const xs = sorted.map((l) => diffDays(l.log_date, origin))
  const ys = sorted.map((l) => l.weight_kg)
  const n = xs.length
  const mx = xs.reduce((a, b) => a + b, 0) / n
  const my = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my)
    den += (xs[i] - mx) ** 2
  }
  if (den === 0) return null
  const slope = num / den
  return { slopePerDay: slope, intercept: my - slope * mx, origin }
}

export function trendValueAt(trend: NonNullable<ReturnType<typeof linearTrend>>, date: ISODate): number {
  return trend.intercept + trend.slopePerDay * diffDays(date, trend.origin)
}

/** Último registro en o antes de una fecha. */
export function valueOnOrBefore(sorted: WeightPoint[], date: ISODate): WeightPoint | undefined {
  let found: WeightPoint | undefined
  for (const l of sorted) {
    if (l.log_date <= date) found = l
    else break
  }
  return found
}

export interface WeightStats {
  count: number
  initial: WeightPoint | null
  current: WeightPoint | null
  min: WeightPoint | null
  max: WeightPoint | null
  totalChange: number | null
  /** Variación respecto al registro de hace ≥7 días (o null si no hay datos) */
  weeklyChange: number | null
  monthlyChange: number | null
  average: number | null
  toTarget: number | null
}

export function computeWeightStats(logs: WeightPoint[], target: number | null = null): WeightStats {
  const sorted = sortByDate(logs)
  if (!sorted.length) {
    return { count: 0, initial: null, current: null, min: null, max: null, totalChange: null, weeklyChange: null, monthlyChange: null, average: null, toTarget: null }
  }
  const initial = sorted[0]
  const current = sorted[sorted.length - 1]
  let min = sorted[0]
  let max = sorted[0]
  let sum = 0
  for (const l of sorted) {
    if (l.weight_kg < min.weight_kg) min = l
    if (l.weight_kg > max.weight_kg) max = l
    sum += l.weight_kg
  }
  const weekRef = valueOnOrBefore(sorted, addDays(current.log_date, -7))
  const monthRef = valueOnOrBefore(sorted, addMonths(current.log_date, -1))
  return {
    count: sorted.length,
    initial,
    current,
    min,
    max,
    totalChange: current.weight_kg - initial.weight_kg,
    weeklyChange: weekRef ? current.weight_kg - weekRef.weight_kg : null,
    monthlyChange: monthRef ? current.weight_kg - monthRef.weight_kg : null,
    average: sum / sorted.length,
    toTarget: target != null ? target - current.weight_kg : null,
  }
}

/** Media de peso por semana (lunes) o por mes. */
export function periodAverages(logs: WeightPoint[], keyFn: (d: ISODate) => ISODate): { period: ISODate; avg: number; count: number }[] {
  const groups = new Map<ISODate, { sum: number; count: number }>()
  for (const l of logs) {
    const k = keyFn(l.log_date)
    const g = groups.get(k) ?? { sum: 0, count: 0 }
    g.sum += l.weight_kg
    g.count++
    groups.set(k, g)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([period, g]) => ({ period, avg: g.sum / g.count, count: g.count }))
}

/** Formato de número español con decimales fijos. */
export function fmtNum(n: number, decimals = 1): string {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n)
}

export function fmtSigned(n: number, decimals = 1): string {
  const s = fmtNum(Math.abs(n), decimals)
  if (Math.abs(n) < 10 ** -decimals / 2) return fmtNum(0, decimals)
  return (n > 0 ? '+' : '−') + s
}

/** Acepta "89,5" o "89.5". Devuelve null si no es un número válido. */
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(/\s/g, '').replace(',', '.')
  if (!s) return null
  if (!/^-?\d*\.?\d+$|^-?\d+\.?$/.test(s)) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}
