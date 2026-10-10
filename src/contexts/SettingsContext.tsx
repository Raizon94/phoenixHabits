import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ThemeMode, UserSettings } from '@/types'
import { defaultSettings, fetchSettings, saveSettings } from '@/services/settingsService'
import { todayISO, type ISODate } from '@/utils/date'
import { setLocale } from '@/i18n'

interface SettingsState {
  settings: UserSettings
  update: (patch: Partial<UserSettings>) => void
  theme: ThemeMode
  setTheme: (t: ThemeMode) => void
  /** Día actual en la zona horaria del usuario (se actualiza al cambiar de día). */
  today: ISODate
}

const SettingsContext = createContext<SettingsState | null>(null)

const THEME_KEY = 'phoenix.theme'

export function applyTheme(theme: ThemeMode) {
  const root = document.documentElement
  root.classList.toggle('dark', theme === 'dark')
  const meta = document.querySelector('meta[name="theme-color"]')
  meta?.setAttribute('content', theme === 'dark' ? '#0a0a0b' : '#f6f6f7')
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* noop */
  }
}

export function storedTheme(): ThemeMode {
  try {
    return localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function SettingsProvider({ userId, children }: { userId: string; children: ReactNode }) {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['settings', userId], queryFn: () => fetchSettings(userId) })
  const settings = useMemo(() => data ?? { ...defaultSettings(userId), theme: storedTheme() }, [data, userId])
  const [today, setToday] = useState(() => todayISO(settings.timezone))

  useEffect(() => {
    applyTheme(settings.theme)
    setLocale(settings.locale)
  }, [settings.theme, settings.locale])

  useEffect(() => {
    const tick = () => setToday(todayISO(settings.timezone))
    tick()
    const iv = setInterval(tick, 30_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(iv)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [settings.timezone])

  const update = useCallback(
    (patch: Partial<UserSettings>) => {
      const next = saveSettings({ ...settings, ...patch })
      qc.setQueryData(['settings', userId], next)
    },
    [settings, qc, userId],
  )

  const value = useMemo<SettingsState>(
    () => ({ settings, update, theme: settings.theme, setTheme: (theme) => update({ theme }), today }),
    [settings, update, today],
  )
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}

export function useSettings(): SettingsState {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings fuera de SettingsProvider')
  return ctx
}
