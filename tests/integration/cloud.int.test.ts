/**
 * Prueba de integración contra un proyecto Supabase REAL (no se ejecuta con `npm test`).
 *
 *   SUPABASE_SECRET=... npx vitest run --config vitest.integration.config.ts
 *
 * Crea dos usuarios temporales (con la clave secreta, solo en este proceso), ejercita el
 * código real de la app (servicios, cola de sincronización, RPC, Storage) y los borra al final.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { initSync, getQueue } from '@/services/sync'
import { buildLog, fetchHabitLogs, fetchHabits, saveLog } from '@/services/habitsService'
import {
  fetchActiveSessionId, fetchExerciseHistory, fetchExercises, fetchRoutines, fetchSessionFull, fetchSessionSummaries,
  newExercise, newRoutine, newRoutineSet, saveExercise, saveRoutineFull, saveSessionHeader, saveSet, startSession,
} from '@/services/workoutService'
import { fetchWeightLogs, saveWeight } from '@/services/bodyService'
import { fetchSettings } from '@/services/settingsService'
import { rebirth } from '@/services/rebirthService'
import { PHOTO_BUCKET } from '@/lib/supabase'
import { newId, nowISO } from '@/lib/id'
import type { RoutineWithExercises } from '@/types'

const URL_ = import.meta.env.VITE_SUPABASE_URL as string
const SECRET = process.env.SUPABASE_SECRET as string
const admin = createClient(URL_, SECRET, { auth: { persistSession: false } })
const stamp = Date.now()
const users = [
  { email: `phoenix-test-a-${stamp}@example.com`, password: `Test-${stamp}-a!`, id: '' },
  { email: `phoenix-test-b-${stamp}@example.com`, password: `Test-${stamp}-b!`, id: '' },
]

async function flush() {
  await getQueue().flush()
  expect(getQueue().getState().pending).toBe(0)
}

async function signIn(i: number) {
  await supabase.auth.signOut()
  const { data, error } = await supabase.auth.signInWithPassword({ email: users[i].email, password: users[i].password })
  if (error) throw error
  initSync(data.user.id)
  return data.user.id
}

beforeAll(async () => {
  for (const u of users) {
    const { data, error } = await admin.auth.admin.createUser({ email: u.email, password: u.password, email_confirm: true })
    if (error) throw error
    u.id = data.user.id
  }
}, 30_000)

afterAll(async () => {
  await supabase.auth.signOut()
  for (const u of users) {
    if (!u.id) continue
    const { data } = await admin.storage.from(PHOTO_BUCKET).list(u.id, { limit: 1000 })
    for (const folder of data ?? []) {
      const inner = await admin.storage.from(PHOTO_BUCKET).list(`${u.id}/${folder.name}`)
      const paths = (inner.data ?? []).map((f) => `${u.id}/${folder.name}/${f.name}`)
      if (paths.length) await admin.storage.from(PHOTO_BUCKET).remove(paths)
    }
    await admin.auth.admin.deleteUser(u.id)
  }
}, 30_000)

describe('flujo completo contra Supabase', () => {
  let routine: RoutineWithExercises

  it('alta: ajustes y 5 hábitos iniciales', async () => {
    const uid = await signIn(0)
    const s = await fetchSettings(uid)
    expect(s.theme).toBe('dark')
    const habits = await fetchHabits()
    expect(habits.map((h) => h.name)).toEqual(['Dieta', 'Lectura de la Biblia', 'Rezo', '10.000 pasos', 'Gimnasio'])
  })

  it('hábitos: marcar, desmarcar y pasos numéricos sin duplicados', async () => {
    const uid = users[0].id
    const habits = await fetchHabits()
    const dieta = habits[0]
    const pasos = habits[3]
    saveLog(buildLog(dieta, uid, '2026-10-09', { completed: true }))
    saveLog(buildLog(dieta, uid, '2026-10-10', { completed: true }))
    saveLog(buildLog(pasos, uid, '2026-10-10', { value: 12000 }))
    await flush()
    saveLog(buildLog(dieta, uid, '2026-10-10', { completed: false }))
    await flush()
    const logs = await fetchHabitLogs()
    expect(logs.filter((l) => l.habit_id === dieta.id && l.log_date === '2026-10-10')).toHaveLength(1)
    expect(logs.find((l) => l.habit_id === dieta.id && l.log_date === '2026-10-10')?.completed).toBe(false)
    expect(logs.find((l) => l.habit_id === pasos.id)).toMatchObject({ value: 12000, completed: true })
  })

  it('rutinas: crear ejercicios y una rutina con plantilla', async () => {
    const uid = users[0].id
    const bench = saveExercise({ ...newExercise(uid, 'kg'), name: 'Press banca', muscle_group: 'chest' })
    const row = saveExercise({ ...newExercise(uid, 'kg'), name: 'Remo', muscle_group: 'back' })
    const r = newRoutine(uid, 0)
    const reB = newId()
    const reR = newId()
    routine = {
      ...r, name: 'Push',
      exercises: [
        { id: reB, user_id: uid, routine_id: r.id, exercise_id: bench.id, position: 0, notes: null, updated_at: nowISO(), exercise: bench, sets: [newRoutineSet(uid, reB, 0, { target_weight: 50, target_reps: 10 })] },
        { id: reR, user_id: uid, routine_id: r.id, exercise_id: row.id, position: 1, notes: null, updated_at: nowISO(), exercise: row, sets: [] },
      ],
    }
    saveRoutineFull(routine, null)
    await flush()
    const ex = await fetchExercises()
    const routines = await fetchRoutines(ex)
    expect(routines).toHaveLength(1)
    expect(routines[0].exercises.map((e) => e.exercise.name)).toEqual(['Press banca', 'Remo'])
  })

  it('sobrecarga progresiva: la 2ª sesión precarga los valores de la 1ª', async () => {
    const uid = users[0].id
    // Sesión 1: sin historial → plantilla (50×10) en press banca
    const { session: s1 } = await startSession(routine, uid, '2026-10-08')
    await flush()
    expect(await fetchActiveSessionId()).toBe(s1.id)
    const bench1 = s1.exercises[0]
    expect(bench1.sets.map((s) => [s.weight, s.reps])).toEqual([[50, 10]])
    // Edito: 60×10 y añado 65×8, ambas completadas
    saveSet({ ...bench1.sets[0], weight: 60, completed: true, completed_at: nowISO() })
    saveSet({ id: newId(), user_id: uid, workout_exercise_id: bench1.id, position: 1, set_type: 'normal', weight: 65, reps: 8, completed: true, completed_at: nowISO(), updated_at: nowISO() })
    saveSessionHeader({ ...s1, status: 'completed', ended_at: new Date(Date.now() + 1000).toISOString() })
    await flush()
    expect(await fetchActiveSessionId()).toBeNull()

    // Sesión 2: precarga 60×10 y 65×8
    const { session: s2, previous } = await startSession(routine, uid, '2026-10-10')
    await flush()
    expect(previous.get(bench1.exercise_id)?.map((p) => [p.weight, p.reps])).toEqual([[60, 10], [65, 8]])
    expect(s2.exercises[0].sets.map((s) => [s.weight, s.reps, s.completed])).toEqual([[60, 10, false], [65, 8, false]])
    expect(s2.exercises[0].sets.every((s) => !bench1.sets.some((o) => o.id === s.id))).toBe(true)

    // Sobrescribo y finalizo: el historial de la sesión 1 queda intacto
    saveSet({ ...s2.exercises[0].sets[0], weight: 62.5, completed: true, completed_at: nowISO() })
    saveSessionHeader({ ...s2, status: 'completed', ended_at: new Date(Date.now() + 2000).toISOString() })
    await flush()
    const ex = await fetchExercises()
    const old = await fetchSessionFull(s1.id, ex)
    expect(old?.exercises[0].sets.map((s) => s.weight)).toEqual([60, 65])

    const summaries = await fetchSessionSummaries()
    expect(summaries).toHaveLength(2)
    expect(summaries.find((s) => s.session_id === s1.id)?.volume_kg).toBe(60 * 10 + 65 * 8)
    const hist = await fetchExerciseHistory({ exerciseIds: [bench1.exercise_id] })
    expect(hist).toHaveLength(2)
  })

  it('peso: un registro por día, modificable', async () => {
    const uid = users[0].id
    saveWeight(uid, '2026-10-10', 89.5, null)
    await flush()
    const existing = (await fetchWeightLogs())[0]
    saveWeight(uid, '2026-10-10', 89.2, 'mañana', existing)
    await flush()
    const logs = await fetchWeightLogs()
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ weight_kg: 89.2, notes: 'mañana' })
  })

  it('fotos: bucket privado, URL firmada y acceso solo del dueño', async () => {
    const uid = users[0].id
    const path = `${uid}/2026-10-10/${newId()}.jpg`
    // Bytes JPEG mínimos (el Blob de jsdom no es compatible con el fetch de Node; en el navegador se sube un Blob real).
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    const up = await supabase.storage.from(PHOTO_BUCKET).upload(path, jpeg, { contentType: 'image/jpeg' })
    expect(up.error).toBeNull()
    const ins = await supabase.from('progress_photos').insert({ user_id: uid, photo_date: '2026-10-10', storage_path: path })
    expect(ins.error).toBeNull()
    const signed = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, 60)
    expect(signed.data?.signedUrl).toBeTruthy()
    const publicUrl = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path).data.publicUrl
    expect((await fetch(publicUrl)).status).toBeGreaterThanOrEqual(400)
    // Un usuario no puede subir a la carpeta de otro
    const bad = await supabase.storage.from(PHOTO_BUCKET).upload(`${users[1].id}/x.jpg`, jpeg, { contentType: 'image/jpeg' })
    expect(bad.error).not.toBeNull()
  })

  it('aislamiento: el usuario B no ve nada del usuario A', async () => {
    await signIn(1)
    for (const t of ['habit_logs', 'exercises', 'workout_routines', 'workout_sessions', 'workout_sets', 'body_weight_logs', 'progress_photos']) {
      const { data, error } = await supabase.from(t).select('*')
      expect(error).toBeNull()
      expect(data).toHaveLength(0)
    }
    const { data } = await supabase.storage.from(PHOTO_BUCKET).list(users[0].id)
    expect(data ?? []).toHaveLength(0)
    const upd = await supabase.from('habits').update({ name: 'hack' }).eq('user_id', users[0].id).select()
    expect(upd.data).toHaveLength(0)
  })

  it('RENACER: borra el progreso y conserva rutinas y ejercicios', async () => {
    await signIn(0)
    await rebirth()
    for (const t of ['habit_logs', 'workout_sessions', 'workout_sets', 'body_weight_logs', 'progress_photos']) {
      const { data } = await supabase.from(t).select('id')
      expect(data).toHaveLength(0)
    }
    const { data: files } = await supabase.storage.from(PHOTO_BUCKET).list(`${users[0].id}/2026-10-10`)
    expect(files ?? []).toHaveLength(0)
    const ex = await fetchExercises()
    expect(ex).toHaveLength(2)
    expect(await fetchRoutines(ex)).toHaveLength(1)
    expect(await fetchHabits()).toHaveLength(5)
    const s = await fetchSettings(users[0].id)
    expect(s.reborn_at).toBeTruthy()
  })
})
