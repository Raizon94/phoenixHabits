import type { ReactNode } from 'react'
import { LoaderCircle, type LucideIcon } from 'lucide-react'
import { cn } from '@/utils/cn'
import { Button } from './Button'

export function Spinner({ className, label = 'Cargando…' }: { className?: string; label?: string }) {
  return (
    <div role="status" className={cn('flex items-center justify-center py-12 text-muted', className)}>
      <LoaderCircle className="animate-spin" size={24} aria-hidden />
      <span className="sr-only">{label}</span>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-2xl bg-surface-2', className)} aria-hidden />
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-border px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <Icon size={24} aria-hidden />
      </div>
      <div>
        <h3 className="font-semibold">{title}</h3>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Error desconocido'
  return (
    <div role="alert" className="rounded-3xl border border-danger/30 bg-danger/5 p-4 text-sm">
      <p className="font-semibold text-danger">No se pudieron cargar los datos</p>
      <p className="mt-1 text-muted">{msg}</p>
      {onRetry && (
        <Button size="sm" variant="secondary" className="mt-3" onClick={onRetry}>
          Reintentar
        </Button>
      )}
    </div>
  )
}
