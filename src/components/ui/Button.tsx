import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn } from '@/utils/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
type Size = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-black hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface-2 text-text hover:bg-surface-3 border border-border',
  ghost: 'text-text hover:bg-surface-2',
  danger: 'bg-danger text-white hover:brightness-110',
  success: 'bg-success text-black hover:brightness-110',
}
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3 text-sm rounded-xl gap-1.5',
  md: 'h-11 px-4 text-sm rounded-2xl gap-2',
  lg: 'h-13 px-5 text-base rounded-2xl gap-2',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-semibold transition select-none active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {loading && <LoaderCircle size={16} className="animate-spin" aria-hidden />}
      {children}
    </button>
  )
})

export const IconButton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: 'sm' | 'md' }>(
  function IconButton({ label, className, children, size = 'md', type = 'button', ...rest }, ref) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-2 hover:text-text active:scale-95 disabled:opacity-40',
          size === 'md' ? 'h-11 w-11' : 'h-9 w-9',
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    )
  },
)
