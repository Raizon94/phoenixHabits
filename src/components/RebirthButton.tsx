import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Flame } from 'lucide-react'
import { useFeedback } from '@/contexts/FeedbackContext'
import { useSync } from '@/contexts/SyncContext'
import { rebirth } from '@/services/rebirthService'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { TextInput } from '@/components/ui/Field'

const WORD = 'RENACER'

/** Botón RENACER: reinicia todo el progreso desde este momento, conservando las rutinas. */
export function RebirthButton() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')
  const { toast } = useFeedback()
  const { online } = useSync()
  const qc = useQueryClient()
  const navigate = useNavigate()

  async function go() {
    setBusy(true)
    try {
      await rebirth(setProgress)
      await qc.resetQueries()
      setOpen(false)
      setText('')
      toast('🔥 Has renacido. Todo empieza hoy.')
      navigate('/')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error', 'error')
    } finally {
      setBusy(false)
      setProgress('')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-600 via-orange-500 to-amber-400 px-5 py-4 text-lg font-black tracking-[0.2em] text-black shadow-lg shadow-orange-500/25 transition active:scale-[0.98]"
      >
        <Flame size={22} className="transition group-hover:scale-110" aria-hidden />
        RENACER
      </button>
      <Modal open={open} onClose={() => !busy && setOpen(false)} title="Renacer" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted">Todo vuelve a empezar desde este momento:</p>
          <ul className="space-y-1 text-sm">
            <li>🔥 Se borran los hábitos cumplidos, rachas y estadísticas.</li>
            <li>🔥 Se borra el historial de entrenamientos, el peso y las fotos.</li>
            <li>✅ Se conservan tus rutinas, ejercicios y hábitos configurados.</li>
          </ul>
          <p className="text-sm font-semibold text-danger">Esta acción no se puede deshacer. Si quieres conservar algo, crea antes una copia de seguridad.</p>
          <TextInput label={`Escribe ${WORD} para confirmar`} value={text} onChange={(e) => setText(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" />
          {!online && <p className="text-sm text-warning">Necesitas conexión para renacer.</p>}
          {progress && <p role="status" className="text-xs text-muted">{progress}</p>}
          <Button variant="danger" size="lg" className="w-full" disabled={text !== WORD || !online} loading={busy} onClick={go}>
            <Flame size={18} /> Renacer ahora
          </Button>
        </div>
      </Modal>
    </>
  )
}
