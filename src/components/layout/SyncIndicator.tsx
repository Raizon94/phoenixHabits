import { Cloud, CloudOff, LoaderCircle, TriangleAlert } from 'lucide-react'
import { useSync } from '@/contexts/SyncContext'
import { t } from '@/i18n'
import { cn } from '@/utils/cn'

/** Indicador discreto del estado de sincronización. */
export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const s = useSync()
  const offline = !s.online || s.status === 'offline'
  let Icon = Cloud
  let label: string = t().sync.synced
  let tone = 'text-muted'
  if (offline) {
    Icon = CloudOff
    label = s.pending ? `${t().sync.offline} (${s.pending})` : 'Sin conexión'
    tone = 'text-warning'
  } else if (s.status === 'syncing' || s.pending > 0) {
    Icon = LoaderCircle
    label = t().sync.syncing
  } else if (s.status === 'error') {
    Icon = TriangleAlert
    label = `${t().sync.error}: ${s.lastError ?? ''}`
    tone = 'text-danger'
  }
  return (
    <div role="status" aria-live="polite" title={label} className={cn('flex items-center gap-1.5 text-xs', tone)}>
      <Icon size={14} className={cn(Icon === LoaderCircle && 'animate-spin')} aria-hidden />
      {compact ? <span className="sr-only">{label}</span> : <span className="truncate">{label}</span>}
    </div>
  )
}
