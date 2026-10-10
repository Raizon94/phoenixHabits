import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/utils/cn'

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-3xl border border-border bg-surface p-4', className)} {...rest} />
}

export function CardTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-3 flex items-center justify-between gap-2', className)}>
      <h2 className="text-sm font-semibold text-muted">{children}</h2>
      {action}
    </div>
  )
}

export function Stat({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-2xl bg-surface-2 p-3', className)}>
      <div className="text-xs text-muted">{label}</div>
      <div className="tabular mt-1 text-lg font-bold leading-tight">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-muted">{hint}</div>}
    </div>
  )
}

export function Badge({ children, className, color }: { children: ReactNode; className?: string; color?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted', className)}
      style={color ? { background: color + '22', color } : undefined}
    >
      {children}
    </span>
  )
}
