import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { fmtNum } from '@/utils/weight'

/**
 * Gráficos compartidos con un estilo común: líneas de 2 px, cuadrícula discreta,
 * un solo eje Y, tooltip al pasar el dedo/ratón y colores tomados de los tokens del tema.
 */

export const AXIS = { stroke: 'var(--muted)', fontSize: 11, tickLine: false, axisLine: false } as const

export function ChartTooltip({ active, payload, label, format, labelFormat }: {
  active?: boolean
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[]
  label?: string | number
  format?: (v: number, key?: string) => string
  labelFormat?: (l: string) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-semibold">{labelFormat ? labelFormat(String(label)) : label}</div>
      {payload
        .filter((p) => p.value != null)
        .map((p) => (
          <div key={p.dataKey ?? p.name} className="tabular flex items-center gap-2 text-muted">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} aria-hidden />
            <span>{p.name}</span>
            <span className="ml-auto font-semibold text-text">{format ? format(p.value as number, p.dataKey) : fmtNum(p.value as number)}</span>
          </div>
        ))}
    </div>
  )
}

export function ChartBox({ height = 220, children, empty }: { height?: number; children: ReactNode; empty?: boolean }) {
  if (empty) return <div className="flex items-center justify-center rounded-2xl bg-surface-2 text-sm text-muted" style={{ height }}>Sin datos en este periodo</div>
  return (
    <div style={{ height }} className="-ml-2 w-[calc(100%+0.5rem)]">
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  )
}

interface SeriesDef {
  key: string
  name: string
  color?: string
  dashed?: boolean
  dots?: boolean
}

export function SimpleLineChart<T extends object>({
  data,
  xKey,
  series,
  height,
  format,
  xFormat,
  domain = ['auto', 'auto'],
}: {
  data: T[]
  xKey: string
  series: SeriesDef[]
  height?: number
  format?: (v: number, key?: string) => string
  xFormat?: (v: string) => string
  domain?: [number | string, number | string]
}) {
  return (
    <ChartBox height={height} empty={!data.length}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} {...AXIS} tickFormatter={xFormat} minTickGap={24} />
        <YAxis {...AXIS} width={44} domain={domain} tickFormatter={(v: number) => fmtNum(v, Math.abs(v) < 10 ? 1 : 0)} />
        <Tooltip content={<ChartTooltip format={format} labelFormat={xFormat} />} cursor={{ stroke: 'var(--muted)', strokeDasharray: '3 3' }} />
        {series.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color ?? 'var(--accent)'}
            strokeWidth={2}
            strokeDasharray={s.dashed ? '5 4' : undefined}
            dot={s.dots === false ? false : data.length <= 40 ? { r: 3, strokeWidth: 0, fill: s.color ?? 'var(--accent)' } : false}
            activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }}
            connectNulls
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ChartBox>
  )
}

export function SimpleBarChart<T extends object>({
  data,
  xKey,
  yKey,
  name,
  height,
  format,
  xFormat,
  color = 'var(--accent)',
  layout = 'horizontal',
}: {
  data: T[]
  xKey: string
  yKey: string
  name: string
  height?: number
  format?: (v: number) => string
  xFormat?: (v: string) => string
  color?: string
  layout?: 'horizontal' | 'vertical'
}) {
  const vertical = layout === 'vertical'
  return (
    <ChartBox height={height} empty={!data.length}>
      <BarChart data={data} layout={vertical ? 'vertical' : 'horizontal'} margin={{ top: 8, right: 12, bottom: 0, left: vertical ? 8 : 0 }} barCategoryGap={vertical ? 6 : '20%'}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={vertical} horizontal={!vertical} />
        {vertical ? (
          <>
            <XAxis type="number" {...AXIS} tickFormatter={(v: number) => fmtNum(v, 0)} />
            <YAxis type="category" dataKey={xKey} {...AXIS} width={96} tickFormatter={xFormat} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} {...AXIS} tickFormatter={xFormat} minTickGap={12} />
            <YAxis {...AXIS} width={44} tickFormatter={(v: number) => fmtNum(v, 0)} allowDecimals={false} />
          </>
        )}
        <Tooltip content={<ChartTooltip format={format ? (v) => format(v) : undefined} labelFormat={xFormat} />} cursor={{ fill: 'var(--surface-2)' }} />
        <Bar dataKey={yKey} name={name} fill={color} radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36} isAnimationActive={false} />
      </BarChart>
    </ChartBox>
  )
}

/** Leyenda explícita para gráficos con más de una serie (la identidad nunca solo por color). */
export function Legend({ items }: { items: { name: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
      {items.map((i) => (
        <span key={i.name} className="flex items-center gap-1.5">
          <svg width="16" height="4" aria-hidden>
            <line x1="0" y1="2" x2="16" y2="2" stroke={i.color} strokeWidth="2" strokeDasharray={i.dashed ? '4 3' : undefined} />
          </svg>
          {i.name}
        </span>
      ))}
    </div>
  )
}
