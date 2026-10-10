import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/utils/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
  footer?: ReactNode
}

/** Diálogo accesible: hoja inferior en móvil, ventana centrada en escritorio. */
export function Modal({ open, onClose, title, children, size = 'md', footer }: ModalProps) {
  const titleId = useId()
  const panel = useRef<HTMLDivElement>(null)
  const lastFocus = useRef<Element | null>(null)

  useEffect(() => {
    if (!open) return
    lastFocus.current = document.activeElement
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    setTimeout(() => {
      if (panel.current && !panel.current.contains(document.activeElement)) {
        panel.current.querySelector<HTMLElement>('[autofocus], input, button:not([data-close])')?.focus()
      }
    }, 30)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      ;(lastFocus.current as HTMLElement | null)?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
      <div className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'animate-slide-up relative flex max-h-[92dvh] w-full flex-col rounded-t-3xl border border-border bg-surface shadow-2xl sm:rounded-3xl',
          size === 'sm' && 'sm:max-w-sm',
          size === 'md' && 'sm:max-w-lg',
          size === 'lg' && 'sm:max-w-3xl',
        )}
      >
        <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-2">
          <h2 id={titleId} className="text-lg font-bold">
            {title}
          </h2>
          <button data-close type="button" onClick={onClose} aria-label="Cerrar" className="-mr-2 flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="border-t border-border px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">{footer}</div>}
        {!footer && <div className="pb-[env(safe-area-inset-bottom)]" />}
      </div>
    </div>,
    document.body,
  )
}
