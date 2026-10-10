import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Dumbbell, ChevronRight } from 'lucide-react'
import { useActiveSessionId } from '@/hooks/useWorkoutData'
import { readActiveSnapshot } from '@/services/activeSession'
import { formatDuration } from '@/utils/date'

/** Aviso persistente de entrenamiento en curso para poder retomarlo. */
export function ActiveWorkoutBanner() {
  const { data: activeId } = useActiveSessionId()
  const snap = readActiveSnapshot()
  const id = activeId ?? (snap?.status === 'in_progress' ? snap.id : null)
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!id) return
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [id])
  if (!id) return null
  const started = snap?.id === id ? new Date(snap.started_at).getTime() : null
  return (
    <Link
      to={`/workout/session/${id}`}
      className="animate-slide-up mb-4 flex items-center gap-3 rounded-2xl bg-accent px-4 py-3 text-black shadow-lg shadow-accent/20"
    >
      <Dumbbell size={20} aria-hidden />
      <div className="flex-1">
        <div className="text-sm font-bold">Entrenamiento en curso{snap?.id === id ? ` · ${snap.routine_name}` : ''}</div>
        {started && <div className="tabular text-xs opacity-80">{formatDuration((now - started) / 1000)}</div>}
      </div>
      <span className="text-sm font-semibold">Continuar</span>
      <ChevronRight size={18} aria-hidden />
    </Link>
  )
}
