import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { ChevronLeft } from 'lucide-react'
import { IconButton } from './Button'

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: string | true }) {
  const navigate = useNavigate()
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-1">
        {back && (
          <IconButton label="Volver" className="-ml-3" onClick={() => (back === true ? navigate(-1) : navigate(back))}>
            <ChevronLeft size={24} />
          </IconButton>
        )}
        <div className="min-w-0 pt-1">
          <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </header>
  )
}
