import { NavLink, Outlet, useLocation } from 'react-router'
import { ChartColumn, Dumbbell, House, ListChecks, Scale, Settings } from 'lucide-react'
import { t } from '@/i18n'
import { cn } from '@/utils/cn'
import { SyncIndicator } from './SyncIndicator'
import { ActiveWorkoutBanner } from '@/components/workout/ActiveWorkoutBanner'

const NAV = [
  { to: '/', label: () => t().nav.dashboard, short: () => t().nav.dashboard, icon: House, end: true },
  { to: '/habits', label: () => t().nav.habits, short: () => t().nav.habits, icon: ListChecks },
  { to: '/workout', label: () => t().nav.workout, short: () => t().nav.workout, icon: Dumbbell },
  { to: '/body', label: () => t().nav.body, short: () => t().nav.body, icon: Scale },
  { to: '/stats', label: () => t().nav.stats, short: () => t().nav.statsShort, icon: ChartColumn },
]

export function AppShell() {
  const { pathname } = useLocation()
  const inSession = pathname.startsWith('/workout/session/')
  return (
    <div className="min-h-dvh md:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:rounded-xl focus:bg-surface focus:px-3 focus:py-2">
        Saltar al contenido
      </a>
      {/* Barra lateral (escritorio) */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <img src={`${import.meta.env.BASE_URL}icons/favicon.svg`} alt="" className="h-9 w-9" />
          <span className="text-lg font-bold tracking-tight">{t().app.name}</span>
        </div>
        <nav aria-label="Principal" className="flex flex-1 flex-col gap-1">
          {[...NAV, { to: '/settings', label: () => t().nav.settings, short: () => t().nav.settings, icon: Settings, end: false }].map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn('flex h-11 items-center gap-3 rounded-2xl px-3 text-sm font-medium transition', isActive ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-surface-2 hover:text-text')
              }
            >
              <n.icon size={20} aria-hidden />
              {n.label()}
            </NavLink>
          ))}
        </nav>
        <div className="px-2">
          <SyncIndicator />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Cabecera móvil */}
        <div className="pt-safe sticky top-0 z-30 border-b border-border/60 bg-bg/85 backdrop-blur-xl md:hidden">
          <div className="flex h-12 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <img src={`${import.meta.env.BASE_URL}icons/favicon.svg`} alt="" className="h-7 w-7" />
              <span className="font-bold tracking-tight">{t().app.name}</span>
            </div>
            <div className="flex items-center gap-1">
              <SyncIndicator compact />
              <NavLink to="/settings" aria-label={t().nav.settings} className="flex h-10 w-10 items-center justify-center rounded-xl text-muted hover:bg-surface-2">
                <Settings size={20} />
              </NavLink>
            </div>
          </div>
        </div>

        <main id="main" className="mb-safe-nav mx-auto w-full max-w-5xl px-4 pt-5 md:px-8 md:pt-8 md:pb-12">
          {!inSession && <ActiveWorkoutBanner />}
          <Outlet />
        </main>
      </div>

      {/* Barra inferior (móvil) */}
      <nav aria-label="Principal" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/90 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => cn('flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition', isActive ? 'text-accent' : 'text-muted')}
            >
              <n.icon size={22} aria-hidden />
              {n.short()}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
