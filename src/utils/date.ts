/**
 * Utilidades de fecha basadas en días de calendario "YYYY-MM-DD" (ISODate).
 *
 * Los registros diarios nunca se convierten a UTC: el "día" se calcula en la zona
 * horaria del usuario y a partir de ahí toda la aritmética es puramente de calendario
 * (Date.UTC se usa solo como calculadora, nunca para representar un instante local).
 */

export type ISODate = string

const DAY_MS = 86_400_000

export function defaultTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid'
  } catch {
    return 'Europe/Madrid'
  }
}

/** Día actual (YYYY-MM-DD) en la zona horaria indicada. */
export function todayISO(timeZone: string = defaultTimezone(), now: Date = new Date()): ISODate {
  return toISODateInTz(now, timeZone)
}

/** Convierte un instante a día de calendario en una zona horaria concreta. */
export function toISODateInTz(instant: Date, timeZone: string): ISODate {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

function toUTC(iso: ISODate): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUTC(ms: number): ISODate {
  const dt = new Date(ms)
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(iso: ISODate, n: number): ISODate {
  return fromUTC(toUTC(iso) + n * DAY_MS)
}

export function addMonths(iso: ISODate, n: number): ISODate {
  const [y, m, d] = iso.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + n, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return fromUTC(target.getTime())
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(a) - toUTC(b)) / DAY_MS)
}

/** Día de la semana ISO: 1 = lunes … 7 = domingo. */
export function isoWeekday(iso: ISODate): number {
  const wd = new Date(toUTC(iso)).getUTCDay()
  return wd === 0 ? 7 : wd
}

/** Lunes de la semana del día dado. */
export function startOfWeek(iso: ISODate): ISODate {
  return addDays(iso, 1 - isoWeekday(iso))
}

export function startOfMonth(iso: ISODate): ISODate {
  return iso.slice(0, 8) + '01'
}

export function endOfMonth(iso: ISODate): ISODate {
  return addDays(addMonths(startOfMonth(iso), 1), -1)
}

/** Lista inclusiva de días entre from y to. */
export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

/**
 * Cuadrícula mensual con semanas de lunes a domingo.
 * Devuelve semanas de 7 posiciones; los días fuera del mes se marcan con inMonth=false.
 */
export function monthGrid(monthISO: ISODate): { date: ISODate; inMonth: boolean }[][] {
  const first = startOfMonth(monthISO)
  const last = endOfMonth(monthISO)
  const gridStart = startOfWeek(first)
  const gridEnd = addDays(startOfWeek(last), 6)
  const weeks: { date: ISODate; inMonth: boolean }[][] = []
  let week: { date: ISODate; inMonth: boolean }[] = []
  for (const d of eachDay(gridStart, gridEnd)) {
    week.push({ date: d, inMonth: d >= first && d <= last })
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }
  return weeks
}

const LOCALE = 'es-ES'

/** Formatea un ISODate sin desplazamientos de zona horaria. */
export function formatDate(iso: ISODate, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }): string {
  // Una fecha vacía o inválida nunca debe tumbar la pantalla.
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return ''
  return new Intl.DateTimeFormat(LOCALE, { ...options, timeZone: 'UTC' }).format(new Date(toUTC(iso.slice(0, 10))))
}

export function formatLongDate(iso: ISODate): string {
  const s = formatDate(iso, { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formatMonth(iso: ISODate): string {
  const s = formatDate(iso, { month: 'long', year: 'numeric' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formatShort(iso: ISODate): string {
  return formatDate(iso, { day: 'numeric', month: 'short' })
}

/** Nombres cortos de los días, empezando en lunes. */
export const WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D']
export const WEEKDAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function formatDurationHuman(totalSeconds: number): string {
  const m = Math.round(totalSeconds / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

/** Hora local HH:MM en la zona del usuario para un timestamp ISO. */
export function formatTime(timestamp: string, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit', timeZone }).format(new Date(timestamp))
}
