/**
 * Pruebas de seguridad de acceso a datos sobre la migración SQL real.
 *
 * Se ejecuta la migración en PGlite (PostgreSQL en memoria) con una simulación mínima
 * de Supabase Auth (esquema auth, auth.uid(), roles anon/authenticated) y se comprueba
 * que las políticas RLS impiden a un usuario leer o modificar datos de otro.
 */
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

let db: PGlite

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  -- Supabase concede por defecto todos los privilegios a anon/authenticated: la seguridad recae en RLS.
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`

async function as(user: string | null, sql: string, params: unknown[] = []) {
  await db.exec('reset role')
  if (user) {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [user])
    await db.exec('set role authenticated')
  } else {
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`)
    await db.exec('set role anon')
  }
  try {
    return await db.query<Record<string, unknown>>(sql, params)
  } finally {
    await db.exec('reset role')
  }
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(SUPABASE_STUB)
  for (const f of ['20261010000001_init.sql', '20261010000003_rebirth.sql', '20261010000005_user_delete.sql']) {
    await db.exec(readFileSync(`supabase/migrations/${f}`, 'utf8'))
  }
  await db.exec(`insert into auth.users (id, email) values ('${A}', 'a@x.com'), ('${B}', 'b@x.com')`)
}, 60_000)

afterAll(async () => {
  await db?.close()
})

describe('alta de usuario', () => {
  it('crea perfil, ajustes y los 5 hábitos iniciales', async () => {
    const r = await as(A, 'select name, type, target_value, system_key from habits order by sort_order')
    expect(r.rows.map((h) => h.name)).toEqual(['Dieta', 'Lectura de la Biblia', 'Rezo', '10.000 pasos', 'Gimnasio'])
    expect(r.rows[3]).toMatchObject({ type: 'numeric' })
    expect(Number(r.rows[3].target_value)).toBe(10000)
    expect(r.rows[4].system_key).toBe('gym')
    const s = await as(A, 'select theme, weight_unit from user_settings')
    expect(s.rows).toEqual([{ theme: 'dark', weight_unit: 'kg' }])
  })
})

describe('Row Level Security', () => {
  it('cada usuario solo ve sus propias filas', async () => {
    const a = await as(A, 'select user_id from habits')
    expect(a.rows).toHaveLength(5)
    expect(a.rows.every((r) => r.user_id === A)).toBe(true)
    const b = await as(B, 'select user_id from habits')
    expect(b.rows.every((r) => r.user_id === B)).toBe(true)
  })

  it('un usuario anónimo no tiene acceso', async () => {
    await expect(as(null, 'select * from habits')).rejects.toThrow(/permission denied/)
    await expect(as(null, 'select * from workout_sets')).rejects.toThrow(/permission denied/)
  })

  it('no se pueden insertar filas a nombre de otro usuario', async () => {
    await expect(
      as(B, `insert into body_weight_logs (user_id, log_date, weight_kg) values ($1, '2026-10-10', 80)`, [A]),
    ).rejects.toThrow(/row-level security/)
  })

  it('no se pueden modificar ni borrar filas de otro usuario', async () => {
    await as(A, `insert into body_weight_logs (log_date, weight_kg) values ('2026-10-10', 89.5)`)
    const upd = await as(B, `update body_weight_logs set weight_kg = 50 where user_id = $1 returning id`, [A])
    expect(upd.rows).toHaveLength(0)
    const del = await as(B, `delete from body_weight_logs where user_id = $1 returning id`, [A])
    expect(del.rows).toHaveLength(0)
    const still = await as(A, `select weight_kg from body_weight_logs`)
    expect(Number(still.rows[0].weight_kg)).toBe(89.5)
  })

  it('no se puede enlazar un registro propio con un hábito ajeno (FK compuesta)', async () => {
    const habitA = (await as(A, `select id from habits limit 1`)).rows[0].id
    await expect(
      as(B, `insert into habit_logs (habit_id, log_date, completed) values ($1, '2026-10-10', true)`, [habitA]),
    ).rejects.toThrow(/foreign key/)
  })

  it('la RPC de series anteriores solo devuelve datos propios', async () => {
    const ex = (await as(A, `insert into exercises (name, muscle_group) values ('Press banca', 'chest') returning id`)).rows[0].id as string
    const s = (await as(A, `insert into workout_sessions (routine_name, session_date, started_at, ended_at, status)
      values ('Push', '2026-10-08', '2026-10-08T18:00Z', '2026-10-08T19:00Z', 'completed') returning id`)).rows[0].id
    const we = (await as(A, `insert into workout_exercises (session_id, exercise_id, position) values ($1, $2, 0) returning id`, [s, ex])).rows[0].id
    await as(A, `insert into workout_sets (workout_exercise_id, position, weight, reps, completed) values
      ($1, 0, 60, 10, true), ($1, 1, 65, 8, true), ($1, 2, 65, 7, true)`, [we])
    // Sesión más antigua: no debe usarse
    const s0 = (await as(A, `insert into workout_sessions (routine_name, session_date, started_at, ended_at, status)
      values ('Upper', '2026-10-01', '2026-10-01T18:00Z', '2026-10-01T19:00Z', 'completed') returning id`)).rows[0].id
    const we0 = (await as(A, `insert into workout_exercises (session_id, exercise_id, position) values ($1, $2, 0) returning id`, [s0, ex])).rows[0].id
    await as(A, `insert into workout_sets (workout_exercise_id, position, weight, reps, completed) values ($1, 0, 50, 10, true)`, [we0])

    const mine = await as(A, `select * from last_completed_sets(array[$1]::uuid[])`, [ex])
    expect(mine.rows.map((r) => [Number(r.weight), r.reps])).toEqual([[60, 10], [65, 8], [65, 7]])
    const other = await as(B, `select * from last_completed_sets(array[$1]::uuid[])`, [ex])
    expect(other.rows).toHaveLength(0)
    const summaries = await as(B, `select * from workout_session_summaries`)
    expect(summaries.rows).toHaveLength(0)
    const sumA = await as(A, `select volume_kg from workout_session_summaries where session_id = $1`, [s])
    expect(Number(sumA.rows[0].volume_kg)).toBe(600 + 520 + 455)
  })
})

describe('integridad', () => {
  it('solo un registro de peso por día', async () => {
    await expect(as(A, `insert into body_weight_logs (log_date, weight_kg) values ('2026-10-10', 90)`)).rejects.toThrow(/duplicate key/)
  })

  it('solo un entrenamiento en curso a la vez', async () => {
    await as(A, `insert into workout_sessions (routine_name, session_date) values ('Pull', '2026-10-10')`)
    await expect(as(A, `insert into workout_sessions (routine_name, session_date) values ('Legs', '2026-10-10')`)).rejects.toThrow(/duplicate key/)
  })

  it('ignora escrituras más antiguas que la versión guardada', async () => {
    await as(A, `update body_weight_logs set weight_kg = 89, updated_at = '2030-01-01T00:00Z' where log_date = '2026-10-10'`)
    await as(A, `update body_weight_logs set weight_kg = 70, updated_at = '2029-01-01T00:00Z' where log_date = '2026-10-10'`)
    const r = await as(A, `select weight_kg from body_weight_logs where log_date = '2026-10-10'`)
    expect(Number(r.rows[0].weight_kg)).toBe(89)
  })

  it('un ejercicio con historial no se puede borrar', async () => {
    await expect(as(A, `delete from exercises where name = 'Press banca'`)).rejects.toThrow(/foreign key/)
  })

  it('la ruta de una foto debe estar en la carpeta del usuario', async () => {
    await expect(as(A, `insert into progress_photos (photo_date, storage_path) values ('2026-10-10', $1)`, [`${B}/x.jpg`])).rejects.toThrow(/check constraint/)
  })
})

describe('RENACER', () => {
  it('borra los datos del usuario, conserva las plantillas y no toca a otros usuarios', async () => {
    await as(B, `insert into body_weight_logs (log_date, weight_kg) values ('2026-10-01', 70)`)
    const r = (await as(A, `insert into workout_routines (name) values ('Push') returning id`)).rows[0].id
    const ex = (await as(A, `select id from exercises where name = 'Press banca'`)).rows[0].id
    await as(A, `insert into routine_exercises (routine_id, exercise_id, position) values ($1, $2, 0)`, [r, ex])
    const habitA = (await as(A, `select id from habits where system_key = 'gym'`)).rows[0].id
    await as(A, `insert into habit_logs (habit_id, log_date, completed) values ($1, '2026-10-09', true)`, [habitA])

    await expect(as(null, `select rebirth()`)).rejects.toThrow(/permission denied/)
    await as(A, `select rebirth()`)

    for (const t of ['habit_logs', 'workout_sessions', 'workout_exercises', 'workout_sets', 'body_weight_logs', 'progress_photos']) {
      expect((await as(A, `select count(*)::int as n from ${t}`)).rows[0].n).toBe(0)
    }
    expect((await as(A, `select count(*)::int as n from workout_routines`)).rows[0].n).toBe(1)
    expect((await as(A, `select count(*)::int as n from routine_exercises`)).rows[0].n).toBe(1)
    expect((await as(A, `select count(*)::int as n from exercises`)).rows[0].n).toBe(1)
    expect((await as(A, `select count(*)::int as n from habits`)).rows[0].n).toBe(5)
    const s = await as(A, `select reborn_at from user_settings`)
    expect(s.rows[0].reborn_at).not.toBeNull()
    // El otro usuario conserva sus datos
    expect((await as(B, `select count(*)::int as n from body_weight_logs`)).rows[0].n).toBe(1)
  })
})

describe('borrado de cuenta', () => {
  it('se puede borrar un usuario con historial de entrenamientos', async () => {
    const ex = (await as(B, `insert into exercises (name) values ('Sentadilla') returning id`)).rows[0].id
    const s = (await as(B, `insert into workout_sessions (routine_name, session_date, started_at, ended_at, status) values ('Legs', '2026-10-10', '2026-10-10T10:00Z', '2026-10-10T11:00Z', 'completed') returning id`)).rows[0].id
    await as(B, `insert into workout_exercises (session_id, exercise_id, position) values ($1, $2, 0)`, [s, ex])
    await db.exec(`delete from auth.users where id = '${B}'`)
    const left = await db.query(`select count(*)::int as n from public.exercises where user_id = '${B}'`)
    expect((left.rows[0] as { n: number }).n).toBe(0)
  })
})
