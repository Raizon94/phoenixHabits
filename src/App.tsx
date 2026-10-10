import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'
import { SettingsProvider } from '@/contexts/SettingsContext'
import { SyncProvider } from '@/contexts/SyncContext'
import { FeedbackProvider } from '@/contexts/FeedbackContext'
import { AppShell } from '@/components/layout/AppShell'
import { Spinner } from '@/components/ui/States'
import { supabaseMissingConfig } from '@/lib/supabase'
import { SetupPage } from '@/pages/SetupPage'
import { LoginPage } from '@/pages/LoginPage'
import { DashboardPage } from '@/pages/DashboardPage'

// Carga diferida de secciones para que la app abra rápido.
const HabitsPage = lazy(() => import('@/pages/HabitsPage'))
const WorkoutPage = lazy(() => import('@/pages/workout/WorkoutPage'))
const RoutineEditorPage = lazy(() => import('@/pages/workout/RoutineEditorPage'))
const ExercisesPage = lazy(() => import('@/pages/workout/ExercisesPage'))
const SessionPage = lazy(() => import('@/pages/workout/SessionPage'))
const SessionSummaryPage = lazy(() => import('@/pages/workout/SessionSummaryPage'))
const HistoryPage = lazy(() => import('@/pages/workout/HistoryPage'))
const ExerciseProgressPage = lazy(() => import('@/pages/workout/ExerciseProgressPage'))
const BodyPage = lazy(() => import('@/pages/body/BodyPage'))
const StatsPage = lazy(() => import('@/pages/StatsPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))

function Protected() {
  const { user, loading } = useAuth()
  if (loading) return <Spinner className="min-h-dvh" />
  if (!user) return <LoginPage />
  return (
    <SyncProvider userId={user.id}>
      <SettingsProvider userId={user.id}>
        <Suspense fallback={<Spinner className="min-h-dvh" />}>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<DashboardPage />} />
              <Route path="habits" element={<HabitsPage />} />
              <Route path="workout" element={<WorkoutPage />} />
              <Route path="workout/routines/:id" element={<RoutineEditorPage />} />
              <Route path="workout/exercises" element={<ExercisesPage />} />
              <Route path="workout/session/:id" element={<SessionPage />} />
              <Route path="workout/session/:id/summary" element={<SessionSummaryPage />} />
              <Route path="workout/history" element={<HistoryPage />} />
              <Route path="workout/progress" element={<ExerciseProgressPage />} />
              <Route path="workout/progress/:exerciseId" element={<ExerciseProgressPage />} />
              <Route path="body" element={<BodyPage />} />
              <Route path="stats" element={<StatsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </SettingsProvider>
    </SyncProvider>
  )
}

export function App() {
  if (supabaseMissingConfig) return <SetupPage />
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <FeedbackProvider>
        <AuthProvider>
          <Protected />
        </AuthProvider>
      </FeedbackProvider>
    </BrowserRouter>
  )
}
