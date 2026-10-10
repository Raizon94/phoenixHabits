import { useMemo, useRef, useState } from 'react'
import { Camera, ImagePlus, Images, Trash } from 'lucide-react'
import type { ProgressPhoto } from '@/types'
import { usePhotos, usePhotoUrls } from '@/hooks/usePhotos'
import { useWeights } from '@/hooks/useBody'
import { useSettings } from '@/contexts/SettingsContext'
import { useFeedback } from '@/contexts/FeedbackContext'
import { useSync } from '@/contexts/SyncContext'
import { Button } from '@/components/ui/Button'
import { Card, CardTitle } from '@/components/ui/Card'
import { TextArea, TextInput } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/States'
import { formatLongDate, formatMonth, type ISODate } from '@/utils/date'
import { fmtNum } from '@/utils/weight'
import { convertWeight } from '@/utils/workout'

export function PhotosTab() {
  const { photos, loading, error, refetch, upload, update, remove } = usePhotos()
  const { today, settings } = useSettings()
  const { byDate } = useWeights()
  const { online } = useSync()
  const { toast, confirm } = useFeedback()
  const [date, setDate] = useState<ISODate>(today)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [viewing, setViewing] = useState<ProgressPhoto | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const camRef = useRef<HTMLInputElement>(null)

  const urls = usePhotoUrls(photos.map((p) => p.storage_path))

  const groups = useMemo(() => {
    const m = new Map<string, ProgressPhoto[]>()
    for (const p of photos) m.set(p.photo_date, [...(m.get(p.photo_date) ?? []), p])
    return [...m.entries()]
  }, [photos])

  async function onFiles(list: FileList | null) {
    const files = [...(list ?? [])].filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))
    if (!files.length) return
    if (!online) return toast('Necesitas conexión para subir fotos', 'error')
    setBusy(true)
    try {
      await upload(files, date, notes || null)
      toast(files.length > 1 ? `${files.length} fotos subidas` : 'Foto subida')
      setNotes('')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al subir', 'error')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
      if (camRef.current) camRef.current.value = ''
    }
  }

  if (error) return <ErrorState error={error} onRetry={refetch} />

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle>Añadir fotos</CardTitle>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm text-muted">
              Fecha
              <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="mt-1.5 h-12 w-full rounded-2xl border border-border bg-surface-2 px-3 text-text" />
            </label>
            <label className="text-sm text-muted">
              Notas
              <TextInput className="mt-1.5" placeholder="Opcional" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="lg" loading={busy} onClick={() => camRef.current?.click()}>
              <Camera size={18} /> Cámara
            </Button>
            <Button size="lg" loading={busy} onClick={() => fileRef.current?.click()}>
              <ImagePlus size={18} /> Galería
            </Button>
          </div>
          <p className="text-xs text-muted">Las fotos se comprimen antes de subirse y se guardan de forma privada: solo tú puedes verlas.</p>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFiles(e.target.files)} />
        </div>
      </Card>

      {loading && <Skeleton className="h-40" />}
      {!loading && !photos.length && <EmptyState icon={Images} title="Sin fotos todavía" description="Sube fotos periódicamente con la misma luz y postura para comparar tu progreso." />}

      {groups.map(([d, list], gi) => {
        const showMonth = gi === 0 || groups[gi - 1][0].slice(0, 7) !== d.slice(0, 7)
        const w = byDate.get(d)
        return (
          <section key={d}>
            {showMonth && <h2 className="mb-2 text-sm font-semibold text-muted">{formatMonth(d)}</h2>}
            <div className="mb-1.5 flex items-baseline justify-between text-xs text-muted">
              <span>{formatLongDate(d)}</span>
              {w && <span className="tabular">{fmtNum(convertWeight(w.weight_kg, 'kg', settings.weight_unit))} {settings.weight_unit}</span>}
            </div>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-6">
              {list.map((p) => (
                <button key={p.id} type="button" onClick={() => setViewing(p)} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-surface-2" aria-label={`Foto del ${formatLongDate(p.photo_date)}${p.notes ? `: ${p.notes}` : ''}`}>
                  {urls.data?.[p.storage_path] ? <img src={urls.data[p.storage_path]} alt="" loading="lazy" className="h-full w-full object-cover" /> : <Skeleton className="h-full w-full rounded-none" />}
                </button>
              ))}
            </div>
          </section>
        )
      })}

      <PhotoViewer
        photo={viewing}
        url={viewing ? urls.data?.[viewing.storage_path] : undefined}
        onClose={() => setViewing(null)}
        onSave={(p) => {
          update(p)
          toast('Foto actualizada')
        }}
        onDelete={async (p) => {
          if (!(await confirm({ title: '¿Eliminar foto?', message: 'Se borrará de forma permanente.', confirmLabel: 'Eliminar', danger: true }))) return
          try {
            await remove(p)
            setViewing(null)
            toast('Foto eliminada')
          } catch (e) {
            toast(e instanceof Error ? e.message : 'Error', 'error')
          }
        }}
      />
    </div>
  )
}

function PhotoViewer({ photo, url, onClose, onSave, onDelete }: { photo: ProgressPhoto | null; url?: string; onClose: () => void; onSave: (p: ProgressPhoto) => void; onDelete: (p: ProgressPhoto) => void }) {
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState('')
  const [loaded, setLoaded] = useState<string | null>(null)
  if (photo && loaded !== photo.id) {
    setLoaded(photo.id)
    setNotes(photo.notes ?? '')
    setDate(photo.photo_date)
  }
  return (
    <Modal open={!!photo} onClose={onClose} title={photo ? formatLongDate(photo.photo_date) : ''} size="lg">
      {photo && (
        <div className="space-y-3">
          <div className="flex justify-center overflow-hidden rounded-2xl bg-black">
            {url ? <img src={url} alt={`Foto de progreso del ${formatLongDate(photo.photo_date)}`} className="max-h-[60dvh] object-contain" /> : <Skeleton className="h-80 w-full" />}
          </div>
          <input type="date" aria-label="Fecha" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 w-full rounded-2xl border border-border bg-surface-2 px-3" />
          <TextArea aria-label="Notas" placeholder="Notas" value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
          <div className="flex gap-2">
            <Button variant="ghost" className="text-danger" onClick={() => onDelete(photo)}>
              <Trash size={16} /> Eliminar
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                onSave({ ...photo, notes: notes.trim() || null, photo_date: date || photo.photo_date })
                onClose()
              }}
            >
              Guardar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
