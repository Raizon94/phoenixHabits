import { forwardRef, useEffect, useId, useState, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/utils/cn'
import { parseDecimal } from '@/utils/weight'

const inputBase =
  'w-full rounded-2xl border border-border bg-surface-2 px-4 text-base text-text placeholder:text-muted/70 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:opacity-60'

export function Field({ label, error, hint, children, htmlFor }: { label: string; error?: string | null; hint?: ReactNode; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-muted">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string | null; hint?: ReactNode }>(
  function TextInput({ label, error, hint, className, id, ...rest }, ref) {
    const auto = useId()
    const input = <input ref={ref} id={id ?? auto} aria-invalid={!!error} className={cn(inputBase, 'h-12', className)} {...rest} />
    if (!label) return input
    return (
      <Field label={label} error={error} hint={hint} htmlFor={id ?? auto}>
        {input}
      </Field>
    )
  },
)

export function TextArea({ label, className, id, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  const auto = useId()
  const el = <textarea id={id ?? auto} className={cn(inputBase, 'min-h-20 py-3', className)} {...rest} />
  if (!label) return el
  return (
    <Field label={label} htmlFor={id ?? auto}>
      {el}
    </Field>
  )
}

export function Select({ label, className, id, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  const auto = useId()
  const el = (
    <select id={id ?? auto} className={cn(inputBase, 'h-12 appearance-none pr-10', className)} {...rest}>
      {children}
    </select>
  )
  if (!label) return el
  return (
    <Field label={label} htmlFor={id ?? auto}>
      {el}
    </Field>
  )
}

interface NumberInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: number | null
  onValue: (v: number | null) => void
  decimals?: boolean
  min?: number
  max?: number
}

/**
 * Campo numérico cómodo en pantallas táctiles: teclado numérico, acepta coma decimal,
 * selecciona el contenido al enfocar y solo confirma valores válidos.
 */
export const NumberInput = forwardRef<HTMLInputElement, NumberInputProps>(function NumberInput(
  { value, onValue, decimals = true, min, max, className, onBlur, ...rest },
  ref,
) {
  const format = (v: number | null) => (v == null ? '' : decimals ? String(v).replace('.', ',') : String(Math.round(v)))
  const [text, setText] = useState(format(value))
  const [focused, setFocused] = useState(false)

  useEffect(() => {
    if (!focused) setText(format(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused])

  const commit = (raw: string) => {
    let n = parseDecimal(raw)
    if (n != null) {
      if (!decimals) n = Math.round(n)
      if (min != null) n = Math.max(min, n)
      if (max != null) n = Math.min(max, n)
    }
    if (n !== value) onValue(n)
    return n
  }

  return (
    <input
      ref={ref}
      type="text"
      inputMode={decimals ? 'decimal' : 'numeric'}
      autoComplete="off"
      enterKeyHint="next"
      className={cn(inputBase, 'tabular h-12 text-center', className)}
      value={text}
      onFocus={(e) => {
        setFocused(true)
        e.currentTarget.select()
      }}
      onChange={(e) => {
        const v = e.target.value.replace(/[^\d.,]/g, '')
        setText(v)
        const n = parseDecimal(v)
        if (n != null || v === '') commit(v)
      }}
      onBlur={(e) => {
        setFocused(false)
        const n = commit(text)
        setText(format(n))
        onBlur?.(e)
      }}
      {...rest}
    />
  )
})
