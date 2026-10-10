import { describe, expect, it } from 'vitest'
import { addDays, addMonths, isoWeekday, monthGrid, startOfWeek, todayISO, toISODateInTz, isValidISODate, formatDate, endOfMonth } from '@/utils/date'

describe('fechas de calendario', () => {
  it('calcula el día en la zona horaria del usuario, no en UTC', () => {
    // 23:30 UTC del 9 de octubre = 01:30 del 10 de octubre en Madrid (UTC+2)
    const instant = new Date('2026-10-09T23:30:00Z')
    expect(toISODateInTz(instant, 'Europe/Madrid')).toBe('2026-10-10')
    expect(toISODateInTz(instant, 'America/New_York')).toBe('2026-10-09')
    expect(todayISO('UTC', instant)).toBe('2026-10-09')
  })

  it('suma días cruzando cambios de hora y de año', () => {
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30') // cambio de hora en España
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29')
  })

  it('suma meses ajustando al último día', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-10-10', -12)).toBe('2025-10-10')
    expect(endOfMonth('2028-02-10')).toBe('2028-02-29')
  })

  it('las semanas empiezan en lunes', () => {
    expect(isoWeekday('2026-10-10')).toBe(6) // sábado
    expect(isoWeekday('2026-10-11')).toBe(7) // domingo
    expect(startOfWeek('2026-10-11')).toBe('2026-10-05')
    const grid = monthGrid('2026-10-01')
    expect(grid[0][0].date).toBe('2026-09-28')
    expect(grid.every((w) => w.length === 7)).toBe(true)
    expect(grid.flat().filter((d) => d.inMonth)).toHaveLength(31)
  })

  it('formatea en español sin desplazar el día', () => {
    expect(formatDate('2026-10-10')).toBe('10/10/2026')
  })

  it('valida fechas', () => {
    expect(isValidISODate('2026-02-30')).toBe(false)
    expect(isValidISODate('2026-02-28')).toBe(true)
    expect(isValidISODate('10/10/2026')).toBe(false)
  })
})
