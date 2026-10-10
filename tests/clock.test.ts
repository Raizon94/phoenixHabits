import { describe, expect, it } from 'vitest'
import { computeOffset } from '@/lib/clock'
import { opKey } from '@/services/syncQueue'

describe('reloj corregido con el servidor', () => {
  it('compensa la latencia usando el punto medio del viaje', () => {
    // El móvil va 5 minutos atrasado; la petición tarda 200 ms.
    const sentAt = Date.parse('2026-10-10T12:00:00.000Z')
    const receivedAt = sentAt + 200
    const server = '2026-10-10T12:05:00.100Z'
    expect(computeOffset(server, sentAt, receivedAt)).toBe(5 * 60_000)
  })

  it('una fecha inválida no altera el reloj', () => {
    expect(computeOffset('basura', 0, 0)).toBe(0)
  })
})

describe('claves de la cola', () => {
  it('el borrado y el upsert del peso de un día comparten clave (se fusionan)', () => {
    const upsertKey = opKey('body_weight_logs', { id: 'x', user_id: 'u', log_date: '2026-10-10' }, 'user_id,log_date')
    const deleteKey = opKey('body_weight_logs', { user_id: 'u', log_date: '2026-10-10' }, 'user_id,log_date')
    expect(deleteKey).toBe(upsertKey)
  })
})
