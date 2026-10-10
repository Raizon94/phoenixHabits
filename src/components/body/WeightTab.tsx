import { useMemo, useState, type FormEvent } from 'react'
import { CartesianGrid, ComposedChart, Line, ReferenceLine, Scatter, Tooltip, XAxis, YAxis } from 'recharts'
import { Pencil, Scale, Target, Trash } from 'lucide-react'
import type { BodyWeightLog } from '@/types'
import { useWeights } from '@/hooks/useBody'
import { useSettings } from '@/contexts/SettingsContext'
import { useFeedback } from '@/contexts/FeedbackContext'
import { Button, IconButton } from '@/components/ui/Button'
import { Card, CardTitle, Stat } from '@/components/ui/Card'
import { NumberInput, TextInput } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Controls'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { AXIS, ChartBox, ChartTooltip, Legend } from '@/components/stats/Charts'
import { formatDate, formatShort, isValidISODate, type ISODate } from '@/utils/date'
import { computeWeightStats, fmtNum, fmtSigned, linearTrend, movingAverage, RANGE_OPTIONS, rangeStart, trendValueAt, type RangeKey } from '@/utils/weight'
import { convertWeight } from '@/utils/workout'

const MA_COLOR = 'var(--accent)'
const DAILY_COLOR = 'var(--muted)'
const TREND_COLOR = '#60a5fa'

export function WeightTab() {
  const { logs, byDate, loading, error, refetch, save, remove } = useWeights()
  const { settings, today, update } = useSettings()
  const { confirm, toast } = useFeedback()
  const unit = settings.weight_unit
  const toUnit = (kg: number) => convertWeight(kg, 'kg', unit)
  const toKg = (v: number) => convertWeight(v, unit, 'kg')

  const [date, setDate] = useState<ISODate>(today)
  const [value, setValue] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [range, setRange] = useState<RangeKey>('30d')
  const [editing, setEditing] = useState<BodyWeightLog | null>(null)
  const [targetOpen, setTargetOpen] = useState(false)

  const existing = byDate.get(date)

  function submit(e: FormEvent) {
    e.preventDefault()
    setErr(null)
    if (!isValidISODate(date)) return setErr('Fecha no válida')
    if (date > today) return setErr('No se pueden registrar fechas futuras')
    if (value == null) return setErr('Introduce tu peso')
    const kg = toKg(value)
    if (kg < 20 || kg > 400) return setErr('Introduce un peso válido')
    save(date, kg, notes || null)
    toast(existing ? 'Peso actualizado' : 'Peso registrado')
    setValue(null)
    setNotes('')
  }

  const from = rangeStart(range, today)
  const inRange = useMemo(() => logs.filter((l) => !from || l.log_date >= from), [logs, from])
  const stats = useMemo(() => computeWeightStats(logs, settings.target_weight_kg), [logs, settings.target_weight_kg])
  const rangeStats = useMemo(() => computeWeightStats(inRange), [inRange])

  const chartData = useMemo(() => {
    const ma = new Map(movingAverage(logs).map((m) => [m.log_date, m.avg]))
    const trend = linearTrend(inRange)
    return inRange.map((l) => ({
      date: l.log_date,
      daily: toUnit(l.weight_kg),
      avg: toUnit(ma.get(l.log_date) ?? l.weight_kg),
      trend: trend ? toUnit(trendValueAt(trend, l.log_date)) : null,
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logs, inRange, unit])

  const target = settings.target_weight_kg
  const fmtU = (kg: number | null | undefined, d = 1) => (kg == null ? '—' : `${fmtNum(toUnit(kg), d)} ${unit}`)
  const fmtDiff = (kg: number | null) => (kg == null ? '—' : `${fmtSigned(toUnit(kg))} ${unit}`)

  if (error) return <ErrorState error={error} onRetry={refetch} />

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        <Card>
          <CardTitle>Registrar peso</CardTitle>
          <form onSubmit={submit} className="space-y-3" noValidate>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-sm text-muted">
                Fecha
                <input
                  type="date"
                  value={date}
                  max={today}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1.5 h-12 w-full rounded-2xl border border-border bg-surface-2 px-3 text-text"
                />
              </label>
              <label className="text-sm text-muted">
                Peso ({unit})
                <NumberInput className="mt-1.5 text-lg font-bold" value={value} onValue={setValue} min={0} max={900} placeholder={existing ? fmtNum(toUnit(existing.weight_kg)) : '0,0'} />
              </label>
            </div>
            <TextInput aria-label="Notas (opcional)" placeholder="Notas (opcional)" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
            {err && <p role="alert" className="text-sm text-danger">{err}</p>}
            {existing && <p className="text-xs text-muted">Ya hay un registro ese día ({fmtU(existing.weight_kg)}); se actualizará.</p>}
            <Button type="submit" className="w-full" size="lg">
              {existing ? 'Actualizar' : 'Guardar'}
            </Button>
          </form>
        </Card>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 content-start">
          <Stat label="Actual" value={fmtU(stats.current?.weight_kg)} hint={stats.current ? formatShort(stats.current.log_date) : undefined} />
          <Stat label="Inicial" value={fmtU(stats.initial?.weight_kg)} hint={stats.initial ? formatShort(stats.initial.log_date) : undefined} />
          <Stat label="Variación total" value={fmtDiff(stats.totalChange)} />
          <Stat label="Mínimo" value={fmtU(stats.min?.weight_kg)} hint={stats.min ? formatShort(stats.min.log_date) : undefined} />
          <Stat label="Máximo" value={fmtU(stats.max?.weight_kg)} hint={stats.max ? formatShort(stats.max.log_date) : undefined} />
          <Stat label="Últimos 7 días" value={fmtDiff(stats.weeklyChange)} />
          <Stat label="Último mes" value={fmtDiff(stats.monthlyChange)} />
          <button type="button" onClick={() => setTargetOpen(true)} className="col-span-1 rounded-2xl bg-surface-2 p-3 text-left transition hover:bg-surface-3 sm:col-span-2">
            <div className="flex items-center gap-1 text-xs text-muted">
              <Target size={12} aria-hidden /> Objetivo {target != null && `· ${fmtU(target)}`}
            </div>
            <div className="tabular mt-1 text-lg leading-tight font-bold">
              {target == null ? 'Configurar' : stats.toTarget == null ? '—' : Math.abs(stats.toTarget) < 0.05 ? '¡Alcanzado!' : `${fmtNum(Math.abs(toUnit(stats.toTarget)))} ${unit} por recorrer`}
            </div>
          </button>
        </div>
      </div>

      <Card>
        <CardTitle>Evolución</CardTitle>
        <Segmented<RangeKey> label="Periodo" className="mb-3" value={range} onChange={setRange} options={RANGE_OPTIONS.map((o) => ({ value: o.key, label: o.label }))} />
        {loading ? (
          <Skeleton className="h-[260px]" />
        ) : (
          <>
            <ChartBox height={260} empty={!chartData.length}>
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" {...AXIS} tickFormatter={formatShort} minTickGap={24} />
                <YAxis {...AXIS} width={44} domain={['dataMin - 1', 'dataMax + 1']} tickFormatter={(v: number) => fmtNum(v, 0)} />
                <Tooltip content={<ChartTooltip labelFormat={(d) => formatDate(d)} format={(v) => `${fmtNum(v)} ${unit}`} />} cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }} />
                {target != null && <ReferenceLine y={toUnit(target)} stroke="var(--success)" strokeDasharray="4 4" label={{ value: 'Objetivo', position: 'insideTopRight', fill: 'var(--muted)', fontSize: 11 }} />}
                <Scatter dataKey="daily" name="Diario" fill={DAILY_COLOR} isAnimationActive={false} />
                <Line dataKey="avg" name="Media 7 días" type="monotone" stroke={MA_COLOR} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
                <Line dataKey="trend" name="Tendencia" type="linear" stroke={TREND_COLOR} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={false} isAnimationActive={false} />
              </ComposedChart>
            </ChartBox>
            <Legend
              items={[
                { name: 'Peso diario (puntos)', color: DAILY_COLOR },
                { name: 'Media móvil 7 días', color: MA_COLOR },
                { name: 'Tendencia', color: TREND_COLOR, dashed: true },
                ...(target != null ? [{ name: 'Objetivo', color: 'var(--success)', dashed: true }] : []),
              ]}
            />
            {rangeStats.count > 1 && (
              <p className="mt-3 text-xs text-muted">
                En este periodo: {fmtDiff(rangeStats.totalChange)} · media {fmtU(rangeStats.average)} · {rangeStats.count} registros
              </p>
            )}
          </>
        )}
      </Card>

      <Card>
        <CardTitle>Historial</CardTitle>
        {!loading && !logs.length && <EmptyState icon={Scale} title="Sin registros" description="Registra tu peso para empezar a ver tu evolución." />}
        <ul className="divide-y divide-border">
          {[...logs].reverse().map((l, i, arr) => {
            const prev = arr[i + 1]
            return (
              <li key={l.log_date} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <div className="tabular font-semibold">{fmtU(l.weight_kg)}</div>
                  <div className="truncate text-xs text-muted">
                    {formatDate(l.log_date)}
                    {l.notes ? ` · ${l.notes}` : ''}
                  </div>
                </div>
                {prev && <span className="tabular text-xs text-muted">{fmtDiff(l.weight_kg - prev.weight_kg)}</span>}
                <IconButton label="Editar" onClick={() => setEditing(l)}>
                  <Pencil size={16} />
                </IconButton>
                <IconButton
                  label="Eliminar"
                  className="hover:text-danger"
                  onClick={async () => {
                    if (await confirm({ title: '¿Eliminar registro?', message: `${formatDate(l.log_date)} · ${fmtU(l.weight_kg)}`, confirmLabel: 'Eliminar', danger: true })) {
                      remove(l)
                      toast('Registro eliminado')
                    }
                  }}
                >
                  <Trash size={16} />
                </IconButton>
              </li>
            )
          })}
        </ul>
      </Card>

      <EditWeightModal
        log={editing}
        onClose={() => setEditing(null)}
        unit={unit}
        today={today}
        onSave={(d, kg, n, orig) => {
          if (d !== orig.log_date && byDate.has(d)) return 'Ya existe un registro en esa fecha'
          save(d, kg, n, orig)
          toast('Registro actualizado')
          return null
        }}
      />
      <TargetModal
        open={targetOpen}
        onClose={() => setTargetOpen(false)}
        current={target != null ? toUnit(target) : null}
        unit={unit}
        onSave={(v) => {
          const kg = v == null ? null : Math.round(toKg(v) * 100) / 100
          if (kg != null && (kg < 20 || kg > 400)) return toast('Introduce un objetivo válido', 'error')
          update({ target_weight_kg: kg })
          toast(kg == null ? 'Objetivo eliminado' : 'Objetivo guardado')
        }}
      />
    </div>
  )
}

function EditWeightModal({ log, onClose, unit, today, onSave }: { log: BodyWeightLog | null; onClose: () => void; unit: 'kg' | 'lb'; today: ISODate; onSave: (d: ISODate, kg: number, notes: string | null, orig: BodyWeightLog) => string | null }) {
  const [date, setDate] = useState('')
  const [v, setV] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  if (log && loadedFor !== log.id + log.updated_at) {
    setLoadedFor(log.id + log.updated_at)
    setDate(log.log_date)
    setV(Math.round(convertWeight(log.weight_kg, 'kg', unit) * 10) / 10)
    setNotes(log.notes ?? '')
    setErr(null)
  }
  return (
    <Modal open={!!log} onClose={onClose} title="Editar registro" size="sm">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!log) return
          if (!isValidISODate(date) || date > today) return setErr('Fecha no válida')
          const kg = v == null ? null : convertWeight(v, unit, 'kg')
          if (kg == null || kg < 20 || kg > 400) return setErr('Peso no válido')
          const r = onSave(date, kg, notes || null, log)
          if (r) return setErr(r)
          onClose()
        }}
      >
        <input type="date" aria-label="Fecha" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-surface-2 px-3" />
        <NumberInput aria-label={`Peso (${unit})`} value={v} onValue={setV} min={0} max={900} className="text-lg font-bold" />
        <TextInput aria-label="Notas" placeholder="Notas" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
        {err && <p role="alert" className="text-sm text-danger">{err}</p>}
        <Button type="submit" className="w-full">Guardar</Button>
      </form>
    </Modal>
  )
}

function TargetModal({ open, onClose, current, unit, onSave }: { open: boolean; onClose: () => void; current: number | null; unit: string; onSave: (v: number | null) => void }) {
  const [v, setV] = useState<number | null>(current)
  return (
    <Modal open={open} onClose={onClose} title="Peso objetivo" size="sm">
      <div className="space-y-3">
        <NumberInput aria-label={`Peso objetivo (${unit})`} value={v ?? current} onValue={setV} min={0} max={900} className="text-lg font-bold" autoFocus />
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => { onSave(null); onClose() }}>
            Quitar
          </Button>
          <Button className="flex-1" onClick={() => { onSave(v ?? current); onClose() }}>
            Guardar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
