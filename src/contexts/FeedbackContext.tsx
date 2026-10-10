import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { TriangleAlert, CircleCheck, Info, CircleX } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'

type ToastKind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ConfirmOptions {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
}

interface FeedbackState {
  toast: (message: string, kind?: ToastKind) => void
  confirm: (opts: ConfirmOptions) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackState | null>(null)

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [pending, setPending] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null)
  const seq = useRef(0)

  const toast = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = ++seq.current
    setToasts((t) => [...t.slice(-2), { id, kind, message }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 5000 : 2800)
  }, [])

  const confirm = useCallback((opts: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...opts, resolve })), [])

  const close = (v: boolean) => {
    pending?.resolve(v)
    setPending(null)
  }

  const icons = { success: CircleCheck, error: CircleX, info: Info }

  return (
    <FeedbackContext.Provider value={{ toast, confirm }}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex flex-col items-center gap-2 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        {toasts.map((t) => {
          const Icon = icons[t.kind]
          return (
            <div
              key={t.id}
              role={t.kind === 'error' ? 'alert' : 'status'}
              className="animate-slide-up pointer-events-auto flex max-w-sm items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 text-sm shadow-xl"
            >
              <Icon size={18} className={t.kind === 'error' ? 'text-danger' : t.kind === 'success' ? 'text-success' : 'text-accent'} aria-hidden />
              <span>{t.message}</span>
            </div>
          )
        })}
      </div>
      <Modal open={!!pending} onClose={() => close(false)} title={pending?.title ?? ''} size="sm">
        <div className="space-y-5">
          {pending?.message && (
            <p className="flex gap-3 text-sm text-muted">
              {pending.danger && <TriangleAlert size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden />}
              {pending.message}
            </p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => close(false)}>
              Cancelar
            </Button>
            <Button variant={pending?.danger ? 'danger' : 'primary'} className="flex-1" onClick={() => close(true)} autoFocus>
              {pending?.confirmLabel ?? 'Confirmar'}
            </Button>
          </div>
        </div>
      </Modal>
    </FeedbackContext.Provider>
  )
}

export function useFeedback(): FeedbackState {
  const ctx = useContext(FeedbackContext)
  if (!ctx) throw new Error('useFeedback fuera de FeedbackProvider')
  return ctx
}
