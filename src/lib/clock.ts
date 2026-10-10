/**
 * Reloj corregido con la hora del servidor. Las marcas updated_at deciden qué cambio
 * es "el último" entre dispositivos; si la hora de un móvil está desajustada, se
 * compensa con la diferencia medida contra Supabase.
 */
let offsetMs = 0

export function now(): number {
  return Date.now() + offsetMs
}

export function getClockOffset(): number {
  return offsetMs
}

/** Calcula la diferencia con el servidor compensando la latencia (punto medio del viaje). */
export function computeOffset(serverIso: string, sentAt: number, receivedAt: number): number {
  const server = new Date(serverIso).getTime()
  if (!Number.isFinite(server)) return 0
  return server - (sentAt + receivedAt) / 2
}

export async function syncClock(fetchServerNow: () => Promise<string>): Promise<void> {
  try {
    const sentAt = Date.now()
    const serverIso = await fetchServerNow()
    const receivedAt = Date.now()
    // Si la respuesta tarda demasiado la medida no es fiable.
    if (receivedAt - sentAt > 5000) return
    offsetMs = computeOffset(serverIso, sentAt, receivedAt)
  } catch {
    /* sin conexión: se mantiene el último desfase conocido */
  }
}
