# 🔥 Phoenix Habits

Aplicación web personal (PWA) para hábitos diarios, entrenamiento de gimnasio con sobrecarga progresiva, peso corporal, fotos de progreso y estadísticas.

**Stack:** React 19 + TypeScript · Vite · Tailwind CSS v4 · Supabase (Postgres, Auth, Storage) · TanStack Query · Recharts · Lucide · React Router · PWA (Workbox) · Vitest.

---

## Funcionalidades

| Sección | Qué hace |
|---|---|
| **Inicio** | Hábitos de hoy, anillo de progreso, racha actual y máxima, resumen semanal, siguiente rutina de la rotación y último peso. |
| **Hábitos** | CRUD, iconos, colores, días programados, hábitos binarios o numéricos (p. ej. 10.000 pasos), archivado, calendario mensual y edición de días anteriores. |
| **Entreno** | Biblioteca de ejercicios, rutinas (crear, editar, duplicar, reordenar), sesiones con autoguardado, **precarga automática de las series de la última sesión completada**, series de calentamiento, aproximación y fallo, temporizador, volumen, resumen con récords, historial editable y progreso por ejercicio (peso, repeticiones, volumen y 1RM estimado con Epley). |
| **Cuerpo** | Registro diario de peso (uno por día), gráfico con media móvil de 7 días, tendencia y objetivo, fotos privadas comprimidas y comparador con deslizador. |
| **Estadísticas** | Hábitos (calendario de actividad estilo GitHub, constancia), entrenamiento (frecuencia, volumen, grupos musculares, récords) y cuerpo (medias, comparación de periodos, objetivo). |
| **Ajustes** | Tema oscuro o claro, kg/lb, peso objetivo, zona horaria, exportación CSV/JSON, copia de seguridad completa con fotos, restauración sin duplicados, cambio de contraseña y **RENACER**. |

### 🔥 RENACER
Botón en Ajustes que reinicia todo **como si empezases en ese momento**:
- **Se borra:** registros de hábitos, entrenamientos realizados, pesos y fotos.
- **Se conserva:** rutinas, ejercicios y la configuración de los hábitos.
- **Se reinicia:** la fecha de inicio de los hábitos, para que rachas y porcentajes partan de cero.

Para evitar pulsaciones accidentales, hay que escribir `RENACER` para confirmar. Se ejecuta en una sola transacción en la base de datos (`rebirth()`).

---

## Arquitectura

```
src/
  components/   UI reutilizable (ui/), layout, hábitos, entreno, cuerpo, estadísticas
  pages/        Pantallas (carga diferida por ruta)
  hooks/        Acceso a datos con TanStack Query + operaciones optimistas
  services/     Supabase, cola de sincronización offline, exportación, RENACER
  contexts/     Auth, ajustes y tema, sincronización, avisos y confirmaciones
  utils/        Lógica pura y probada: fechas, rachas, volumen, 1RM, peso, estadísticas
  i18n/         Textos (es). Para añadir un idioma, crea un archivo con las mismas claves
  types/        Tipos del dominio
  styles/       Tokens de tema (oscuro/claro) y Tailwind
supabase/migrations/   Migraciones SQL reproducibles (esquema, RLS, Storage, RENACER)
tests/                 Vitest; incluye pruebas de seguridad RLS sobre la migración real (PGlite)
```

**Decisiones clave**
- **Fechas:** los registros diarios son `date` (`YYYY-MM-DD`) calculados en la zona horaria del usuario, nunca mediante conversiones UTC. Las semanas empiezan en lunes.
- **Seguridad:** cada tabla tiene `user_id` con RLS `user_id = auth.uid()`. Las claves foráneas compuestas `(id, user_id)` impiden enlazar datos de otro usuario y el rol `anon` no tiene acceso. El frontend solo usa la clave **pública**.
- **Historial inmutable:** cada entrenamiento crea filas nuevas. La función `last_completed_sets()` devuelve las series de la última sesión **completada** de cada ejercicio, sea cual sea la rutina.
- **Offline:** todas las escrituras pasan por una cola persistida en `localStorage`, que fusiona las operaciones y reintenta al volver la conexión. Los IDs se generan en el cliente (reintentos idempotentes, sin duplicados). El entrenamiento en curso tiene además una copia local para recuperarlo.
- **Multidispositivo:** un trigger descarta las escrituras con `updated_at` más antiguo que el guardado, para no pisar datos más recientes.

---

## 1. Configurar Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com) (el plan gratuito basta).
2. **Esquema:** en *SQL Editor*, ejecuta **en orden** el contenido de:
   1. `supabase/migrations/20261010000001_init.sql`: tablas, índices, RLS, triggers, alta de usuario con los 5 hábitos iniciales, RPC y vistas.
   2. `supabase/migrations/20261010000002_storage.sql`: bucket privado `progress-photos` y sus políticas.
   3. `supabase/migrations/20261010000003_rebirth.sql`: función RENACER.

   También puedes aplicarlas con la CLI: `npx supabase link --project-ref <ref>` y luego `npx supabase db push`.
3. **Storage:** la migración 2 crea el bucket **privado** `progress-photos` (5 MB por archivo; jpeg, webp o png). Las fotos se sirven con URLs firmadas de 10 minutos y cada usuario solo accede a su carpeta `<user_id>/…`.
4. **Auth** (*Authentication → URL Configuration*):
   - *Site URL:* la URL donde esté publicada la app (p. ej. `https://raizon94.github.io/phoenixHabits/`).
   - *Redirect URLs:* añade la misma URL y `http://localhost:5173/**` para desarrollo.
5. Crea tu cuenta desde la propia app ("Crear cuenta").
6. **Recomendado:** después, desactiva los registros nuevos en *Authentication → Sign In / Providers → Allow new users to sign up* para que nadie más pueda crearse una cuenta.
7. Copia la **Project URL** y la **publishable key** (o la *anon* legacy) desde *Project Settings → API Keys*.

> ⚠️ **Nunca** uses la `secret` / `service_role` key en el frontend ni la subas al repositorio: salta el RLS y da acceso a todos los datos.

## 2. Desarrollo local

```bash
cp .env.example .env.local   # rellena VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev                  # http://localhost:5173
npm test                     # pruebas (incluye seguridad RLS)
npm run build                # build de producción
```

## 3. Despliegue en GitHub Pages

El workflow `.github/workflows/deploy.yml` prueba, compila y publica en cada push a `main`.

1. En GitHub, ve a *Settings → Pages → Source*: **GitHub Actions**.
2. En *Settings → Secrets and variables → Actions → Variables*, crea:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (la publishable key)
3. Haz push a `main`. La app quedará en `https://<usuario>.github.io/phoenixHabits/`.

El enrutado al recargar una ruta funciona gracias a `404.html` (copia de `index.html`) y a la ruta base `BASE_PATH`.

## 4. Despliegue alternativo en Vercel

1. Importa el repo en [vercel.com](https://vercel.com) (framework: Vite).
2. Añade las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. `vercel.json` ya incluye el *rewrite* para que React Router funcione al recargar.

## 5. Instalar en el móvil (PWA)

- **iPhone (Safari):** Compartir → *Añadir a pantalla de inicio*.
- **Android (Chrome):** menú → *Instalar aplicación*.

---

## Pruebas

`npm test` cubre la lógica crítica:
- Cálculo de rachas: solo días programados, sin contar el futuro, con "hoy" aún en curso.
- Recuperación de series anteriores y construcción de sesiones nuevas.
- Volumen, conversión kg/lb, 1RM y récords.
- Estadísticas de peso: media móvil, tendencia y variaciones.
- Cola de sincronización: fusión de operaciones, modo offline, persistencia y errores.
- Exportación CSV y restauración sin duplicados.
- **Seguridad:** ejecuta la migración real en PostgreSQL (PGlite) y comprueba que un usuario no puede leer, modificar, borrar ni enlazar datos de otro; que `anon` no tiene acceso; y que RENACER solo afecta a quien lo ejecuta.
