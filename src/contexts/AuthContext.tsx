import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { initSync, getQueue, hasQueue } from '@/services/sync'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
  updatePassword: (password: string) => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

function translateAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login')) return 'Correo o contraseña incorrectos'
  if (m.includes('email not confirmed')) return 'Confirma tu correo antes de entrar'
  if (m.includes('already registered')) return 'Ya existe una cuenta con ese correo'
  if (m.includes('password should be')) return 'La contraseña debe tener al menos 8 caracteres'
  if (m.includes('signups not allowed') || m.includes('signup is disabled')) return 'El registro está desactivado'
  if (m.includes('fetch')) return 'Sin conexión con el servidor'
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) initSync(data.session.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s) initSync(s.user.id)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw new Error(translateAuthError(error.message))
      },
      async signUp(email, password) {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
        if (error) throw new Error(translateAuthError(error.message))
        return { needsConfirmation: !data.session }
      },
      async signOut() {
        // Intentar enviar cambios pendientes antes de salir.
        if (hasQueue()) await getQueue().flush().catch(() => undefined)
        await supabase.auth.signOut()
        queryClient.clear()
        try {
          localStorage.removeItem('phoenix.queryCache')
          localStorage.removeItem('phoenix.activeSession')
        } catch {
          /* noop */
        }
      },
      async updatePassword(password) {
        const { error } = await supabase.auth.updateUser({ password })
        if (error) throw new Error(translateAuthError(error.message))
      },
      async resetPassword(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}settings` })
        if (error) throw new Error(translateAuthError(error.message))
      },
    }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth fuera de AuthProvider')
  return ctx
}

/** Usuario autenticado (solo dentro de rutas protegidas). */
export function useUserId(): string {
  const { user } = useAuth()
  if (!user) throw new Error('Usuario no autenticado')
  return user.id
}
