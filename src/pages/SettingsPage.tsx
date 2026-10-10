import { useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ChevronRight, ClipboardList, DatabaseBackup, Download, Dumbbell, KeyRound, ListChecks, LogOut, Moon, Sun, Upload } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import type { WeightUnit } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
import { useFeedback } from '@/contexts/FeedbackContext'
import { useSync } from '@/contexts/SyncContext'
import { createBackup, download, exportHabits, exportWeights, exportWorkouts, restoreBackup, toCSV, validateBackup } from '@/services/exportService'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { NumberInput, Select, TextInput } from '@/components/ui/Field'
import { Segmented, Switch } from '@/components/ui/Controls'
import { SyncIndicator } from '@/components/layout/SyncIndicator'
import { RebirthButton } from '@/components/RebirthButton'
import { convertWeight } from '@/utils/workout'
import { defaultTimezone, todayISO } from '@/utils/date'

const TIMEZONES = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? []
  } catch {
    return []
  }
})()

function Row({ to, icon: Icon, children }: { to: string; icon: typeof ListChecks; children: ReactNode }) {
  return (
    <Link to={to} className="flex h-12 items-center gap-3 rounded-2xl px-2 transition hover:bg-surface-2">
      <Icon size={20} className="text-muted" aria-hidden />
      <span className="flex-1 text-sm font-medium">{children}</span>
      <ChevronRight size={18} className="text-muted" aria-hidden />
    </Link>
  )
}

export default function SettingsPage() {
  const { user, signOut, updatePassword } = useAuth()
  const { settings, update, theme, setTheme } = useSettings()
  const { toast, confirm } = useFeedback()
  const { pending } = useSync()
  const qc = useQueryClient()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [pwErr, setPwErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [progress, setProgress] = useState('')
  const [withPhotos, setWithPhotos] = useState(true)
  const fileRef = useRef<HTMLInputElement>(null)
  const unit = settings.weight_unit
  const stamp = todayISO(settings.timezone)

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key)
    try {
      await fn()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setBusy(null)
      setProgress('')
    }
  }

  const exporters = {
    habits: { fn: exportHabits, cols: ['fecha', 'habito', 'completado', 'valor', 'unidad'], name: 'habitos' },
    workouts: { fn: exportWorkouts, cols: ['fecha', 'rutina', 'inicio', 'fin', 'ejercicio', 'orden_ejercicio', 'serie', 'tipo', 'peso', 'unidad', 'repeticiones', 'completada'], name: 'entrenamientos' },
    weights: { fn: exportWeights, cols: ['fecha', 'peso_kg', 'notas'], name: 'peso' },
  } as const

  function exportData(kind: keyof typeof exporters, format: 'csv' | 'json') {
    run(`${kind}-${format}`, async () => {
      const e = exporters[kind]
      const rows = await e.fn()
      if (format === 'csv') download(`phoenix-${e.name}-${stamp}.csv`, toCSV(rows, [...e.cols]), 'text/csv')
      else download(`phoenix-${e.name}-${stamp}.json`, JSON.stringify(rows, null, 2))
      toast(`${rows.length} registros exportados`)
    })
  }

  async function savePassword() {
    setPwErr(null)
    if (pw.length < 8) return setPwErr('Mínimo 8 caracteres')
    if (pw !== pw2) return setPwErr('Las contraseñas no coinciden')
    await run('pw', async () => {
      await updatePassword(pw)
      setPw('')
      setPw2('')
      toast('Contraseña actualizada')
    })
  }

  async function onRestoreFile(file: File | undefined) {
    if (!file || !user) return
    await run('restore', async () => {
      const parsed = JSON.parse(await file.text())
      validateBackup(parsed)
      const ok = await confirm({
        title: '¿Restaurar copia de seguridad?',
        message: `Copia del ${new Date(parsed.exported_at).toLocaleString('es-ES')}. Los registros existentes se actualizarán y no se duplicará nada. Los datos más recientes de esta cuenta no se sobrescriben.`,
        confirmLabel: 'Restaurar',
      })
      if (!ok) return
      await restoreBackup(parsed, user.id, setProgress)
      await qc.invalidateQueries()
      toast('Copia restaurada')
    })
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="animate-fade-in space-y-5">
      <PageHeader title="Ajustes" subtitle={user?.email} />

      <Card>
        <CardTitle>Apariencia y unidades</CardTitle>
        <div className="space-y-4">
          <Segmented<'dark' | 'light'>
            label="Tema"
            value={theme}
            onChange={setTheme}
            options={[
              { value: 'dark', label: <span className="flex items-center justify-center gap-1.5"><Moon size={14} /> Oscuro</span> },
              { value: 'light', label: <span className="flex items-center justify-center gap-1.5"><Sun size={14} /> Claro</span> },
            ]}
          />
          <div>
            <div className="mb-1.5 text-sm text-muted">Unidad de peso</div>
            <Segmented<WeightUnit>
              label="Unidad de peso"
              value={unit}
              onChange={(weight_unit) => update({ weight_unit })}
              options={[
                { value: 'kg', label: 'Kilogramos (kg)' },
                { value: 'lb', label: 'Libras (lb)' },
              ]}
            />
          </div>
          <label className="block text-sm text-muted">
            Peso objetivo ({unit})
            <NumberInput
              className="mt-1.5"
              value={settings.target_weight_kg != null ? Math.round(convertWeight(settings.target_weight_kg, 'kg', unit) * 10) / 10 : null}
              onValue={(v) => {
                const kg = v == null ? null : Math.round(convertWeight(v, unit, 'kg') * 100) / 100
                if (kg != null && (kg < 20 || kg > 400)) return toast('Introduce un objetivo válido', 'error')
                update({ target_weight_kg: kg })
              }}
              min={0}
              max={900}
              placeholder="Sin objetivo"
            />
          </label>
          <Select label="Zona horaria (define qué es «hoy»)" value={settings.timezone} onChange={(e) => update({ timezone: e.target.value })}>
            {!TIMEZONES.includes(settings.timezone) && <option value={settings.timezone}>{settings.timezone}</option>}
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </Select>
          {settings.timezone !== defaultTimezone() && (
            <button type="button" className="text-xs text-accent" onClick={() => update({ timezone: defaultTimezone() })}>
              Usar la zona de este dispositivo ({defaultTimezone()})
            </button>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Gestionar</CardTitle>
        <Row to="/habits" icon={ListChecks}>Hábitos</Row>
        <Row to="/workout/exercises" icon={ClipboardList}>Ejercicios</Row>
        <Row to="/workout" icon={Dumbbell}>Rutinas</Row>
      </Card>

      <Card>
        <CardTitle>Exportar datos</CardTitle>
        <div className="space-y-2">
          {(
            [
              ['habits', 'Historial de hábitos'],
              ['workouts', 'Historial de entrenamientos'],
              ['weights', 'Historial de peso corporal'],
            ] as const
          ).map(([k, label]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="flex-1 text-sm">{label}</span>
              <Button size="sm" variant="secondary" loading={busy === `${k}-csv`} onClick={() => exportData(k, 'csv')}>
                <Download size={14} /> CSV
              </Button>
              <Button size="sm" variant="secondary" loading={busy === `${k}-json`} onClick={() => exportData(k, 'json')}>
                <Download size={14} /> JSON
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle>Copia de seguridad completa</CardTitle>
        <p className="mb-3 text-sm text-muted">Incluye todos tus registros{withPhotos ? ' y fotografías' : ''}. Puedes restaurarla en cualquier momento sin duplicar datos.</p>
        <Switch checked={withPhotos} onChange={setWithPhotos} label="Incluir fotografías" description="El archivo será más grande" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            loading={busy === 'backup'}
            disabled={!!busy}
            onClick={() =>
              run('backup', async () => {
                if (!user) return
                const b = await createBackup(user.id, withPhotos, setProgress)
                download(`phoenix-backup-${stamp}.json`, JSON.stringify(b))
                toast('Copia de seguridad descargada')
              })
            }
          >
            <DatabaseBackup size={16} /> Crear copia
          </Button>
          <Button variant="secondary" loading={busy === 'restore'} disabled={!!busy} onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Restaurar
          </Button>
        </div>
        {progress && <p className="mt-2 text-xs text-muted" role="status">{progress}</p>}
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onRestoreFile(e.target.files?.[0])} />
      </Card>

      <Card>
        <CardTitle>Renacer</CardTitle>
        <p className="mb-3 text-sm text-muted">
          Empieza de cero: borra todo el progreso y las estadísticas, y conserva tus rutinas y ejercicios.
          {settings.reborn_at && ` Último renacimiento: ${new Date(settings.reborn_at).toLocaleDateString('es-ES')}.`}
        </p>
        <RebirthButton />
      </Card>

      <Card>
        <CardTitle>Cambiar contraseña</CardTitle>
        <div className="space-y-3">
          <TextInput type="password" autoComplete="new-password" placeholder="Nueva contraseña" aria-label="Nueva contraseña" value={pw} onChange={(e) => setPw(e.target.value)} />
          <TextInput type="password" autoComplete="new-password" placeholder="Repite la contraseña" aria-label="Repite la contraseña" value={pw2} onChange={(e) => setPw2(e.target.value)} error={pwErr} />
          <Button variant="secondary" className="w-full" loading={busy === 'pw'} onClick={savePassword}>
            <KeyRound size={16} /> Actualizar contraseña
          </Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <SyncIndicator />
        <Button
          variant="ghost"
          className="w-full text-danger"
          onClick={async () => {
            const ok = await confirm({
              title: '¿Cerrar sesión?',
              message: pending ? `Hay ${pending} cambios sin sincronizar. Se intentarán enviar antes de salir; si no hay conexión podrían perderse.` : undefined,
              confirmLabel: 'Cerrar sesión',
              danger: pending > 0,
            })
            if (ok) await signOut()
          }}
        >
          <LogOut size={16} /> Cerrar sesión
        </Button>
        <p className="text-center text-xs text-muted">Phoenix Habits · v{import.meta.env.VITE_APP_VERSION ?? '0.1.0'}</p>
      </Card>
    </div>
  )
}
