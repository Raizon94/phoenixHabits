import { useState, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useFeedback } from '@/contexts/FeedbackContext'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Field'
import { t } from '@/i18n'

export function LoginPage() {
  const { signIn, signUp, resetPassword } = useAuth()
  const { toast } = useFeedback()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Introduce un correo válido')
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres')
    setBusy(true)
    try {
      if (mode === 'login') await signIn(email, password)
      else {
        const r = await signUp(email, password)
        if (r.needsConfirmation) toast('Revisa tu correo para confirmar la cuenta', 'info')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setBusy(false)
    }
  }

  async function forgot() {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError('Escribe tu correo para recuperar la contraseña')
    try {
      await resetPassword(email)
      toast('Te hemos enviado un correo para restablecer la contraseña', 'info')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    }
  }

  return (
    <div className="pt-safe flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={submit} className="animate-slide-up w-full max-w-sm space-y-5" noValidate>
        <div className="flex flex-col items-center gap-3 text-center">
          <img src={`${import.meta.env.BASE_URL}icons/favicon.svg`} alt="" className="h-16 w-16" />
          <h1 className="text-2xl font-bold tracking-tight">{t().app.name}</h1>
          <p className="text-sm text-muted">{mode === 'login' ? 'Inicia sesión para continuar' : 'Crea tu cuenta personal'}</p>
        </div>
        <TextInput label="Correo electrónico" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <TextInput
          label="Contraseña"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        {error && (
          <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          {mode === 'login' ? 'Entrar' : 'Crear cuenta'}
        </Button>
        <div className="flex justify-between text-sm">
          <button type="button" className="text-muted hover:text-text" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            {mode === 'login' ? 'Crear cuenta' : 'Ya tengo cuenta'}
          </button>
          {mode === 'login' && (
            <button type="button" className="text-muted hover:text-text" onClick={forgot}>
              ¿Olvidaste la contraseña?
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
