import { useEffect, useMemo, useState } from 'react'
import { Columns2, Images, SlidersHorizontal } from 'lucide-react'
import type { ProgressPhoto } from '@/types'
import { usePhotos, usePhotoUrls } from '@/hooks/usePhotos'
import { useWeights } from '@/hooks/useBody'
import { useSettings } from '@/contexts/SettingsContext'
import { Card } from '@/components/ui/Card'
import { Select } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Controls'
import { EmptyState, Skeleton } from '@/components/ui/States'
import { diffDays, formatDate, formatShort } from '@/utils/date'
import { fmtNum, fmtSigned, valueOnOrBefore } from '@/utils/weight'
import { convertWeight } from '@/utils/workout'
import { cn } from '@/utils/cn'

type Mode = 'slider' | 'side'

/** Comparador de fotos de dos fechas: deslizador superpuesto o lado a lado. */
export function CompareTab() {
  const { photos, loading } = usePhotos()
  const { logs } = useWeights()
  const { settings } = useSettings()
  const unit = settings.weight_unit
  const dates = useMemo(() => [...new Set(photos.map((p) => p.photo_date))].sort(), [photos])
  const [dateA, setDateA] = useState('')
  const [dateB, setDateB] = useState('')
  const [idxA, setIdxA] = useState(0)
  const [idxB, setIdxB] = useState(0)
  const [mode, setMode] = useState<Mode>('slider')
  const [pos, setPos] = useState(50)

  useEffect(() => {
    if (dates.length && !dateA) {
      setDateA(dates[0])
      setDateB(dates[dates.length - 1])
    }
  }, [dates, dateA])

  const listA = photos.filter((p) => p.photo_date === dateA)
  const listB = photos.filter((p) => p.photo_date === dateB)
  const a: ProgressPhoto | undefined = listA[idxA] ?? listA[0]
  const b: ProgressPhoto | undefined = listB[idxB] ?? listB[0]
  const urls = usePhotoUrls([a?.storage_path, b?.storage_path].filter(Boolean) as string[])
  const urlA = a && urls.data?.[a.storage_path]
  const urlB = b && urls.data?.[b.storage_path]

  const wA = dateA ? valueOnOrBefore(logs, dateA) : undefined
  const wB = dateB ? valueOnOrBefore(logs, dateB) : undefined
  const show = (kg: number) => `${fmtNum(convertWeight(kg, 'kg', unit))} ${unit}`

  if (loading) return <Skeleton className="h-96" />
  if (dates.length < 2) return <EmptyState icon={Images} title="Necesitas fotos de al menos dos fechas" description="Sube fotos en distintos días para poder compararlas." />

  const picker = (label: string, date: string, setDate: (d: string) => void, list: ProgressPhoto[], idx: number, setIdx: (i: number) => void) => (
    <div className="space-y-2">
      <Select aria-label={label} value={date} onChange={(e) => { setDate(e.target.value); setIdx(0) }}>
        {dates.map((d) => (
          <option key={d} value={d}>
            {formatDate(d)}
          </option>
        ))}
      </Select>
      {list.length > 1 && (
        <div className="flex gap-1">
          {list.map((p, i) => (
            <button key={p.id} type="button" aria-pressed={i === idx} onClick={() => setIdx(i)} className={cn('h-8 flex-1 rounded-lg text-xs', i === idx ? 'bg-accent text-black' : 'bg-surface-2 text-muted')}>
              Foto {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {picker('Fecha A (antes)', dateA, setDateA, listA, idxA, setIdxA)}
        {picker('Fecha B (después)', dateB, setDateB, listB, idxB, setIdxB)}
      </div>

      <Segmented<Mode>
        label="Modo de comparación"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'slider', label: <span className="flex items-center justify-center gap-1.5"><SlidersHorizontal size={14} /> Deslizador</span> },
          { value: 'side', label: <span className="flex items-center justify-center gap-1.5"><Columns2 size={14} /> Lado a lado</span> },
        ]}
      />

      {mode === 'slider' ? (
        <div className="space-y-3">
          <div className="relative mx-auto aspect-[3/4] max-h-[70dvh] w-full max-w-md touch-none overflow-hidden rounded-3xl bg-black select-none">
            {urlB ? <img src={urlB} alt={`Después: ${formatDate(dateB)}`} className="absolute inset-0 h-full w-full object-contain" draggable={false} /> : <Skeleton className="absolute inset-0" />}
            {urlA && <img src={urlA} alt={`Antes: ${formatDate(dateA)}`} className="absolute inset-0 h-full w-full object-contain" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }} draggable={false} />}
            <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white shadow" style={{ left: `${pos}%` }} aria-hidden>
              <div className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-black shadow-lg">
                <SlidersHorizontal size={16} />
              </div>
            </div>
            <span className="absolute top-3 left-3 rounded-full bg-black/60 px-2 py-1 text-xs text-white">{formatShort(dateA)}</span>
            <span className="absolute top-3 right-3 rounded-full bg-black/60 px-2 py-1 text-xs text-white">{formatShort(dateB)}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={pos}
              onChange={(e) => setPos(Number(e.target.value))}
              aria-label="Deslizador de comparación"
              className="absolute inset-0 h-full w-full cursor-ew-resize opacity-0"
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {[
            { url: urlA, d: dateA, label: 'Antes' },
            { url: urlB, d: dateB, label: 'Después' },
          ].map((x) => (
            <figure key={x.label} className="overflow-hidden rounded-2xl bg-black">
              {x.url ? <img src={x.url} alt={`${x.label}: ${formatDate(x.d)}`} className="aspect-[3/4] w-full object-contain" /> : <Skeleton className="aspect-[3/4] w-full" />}
              <figcaption className="bg-surface p-2 text-center text-xs text-muted">{formatDate(x.d)}</figcaption>
            </figure>
          ))}
        </div>
      )}

      <Card className="grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-xs text-muted">{formatShort(dateA)}</div>
          <div className="tabular font-bold">{wA ? show(wA.weight_kg) : '—'}</div>
        </div>
        <div>
          <div className="text-xs text-muted">Diferencia</div>
          <div className="tabular font-bold">{wA && wB ? `${fmtSigned(convertWeight(wB.weight_kg - wA.weight_kg, 'kg', unit))} ${unit}` : '—'}</div>
          {dateA && dateB && <div className="text-[11px] text-muted">{Math.abs(diffDays(dateB, dateA))} días</div>}
        </div>
        <div>
          <div className="text-xs text-muted">{formatShort(dateB)}</div>
          <div className="tabular font-bold">{wB ? show(wB.weight_kg) : '—'}</div>
        </div>
        {(wA?.log_date !== dateA || wB?.log_date !== dateB) && (wA || wB) && (
          <p className="col-span-3 text-[11px] text-muted">Se muestra el último peso registrado en o antes de cada fecha.</p>
        )}
      </Card>
    </div>
  )
}
