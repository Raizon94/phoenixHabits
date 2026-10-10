/** Pantalla mostrada cuando faltan las variables de entorno de Supabase. */
export function SetupPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-md space-y-4 rounded-3xl border border-border bg-surface p-6">
        <img src={`${import.meta.env.BASE_URL}icons/favicon.svg`} alt="" className="h-12 w-12" />
        <h1 className="text-xl font-bold">Configura Supabase</h1>
        <p className="text-sm text-muted">
          Faltan las variables de entorno <code className="text-accent">VITE_SUPABASE_URL</code> y{' '}
          <code className="text-accent">VITE_SUPABASE_ANON_KEY</code>.
        </p>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>Copia <code>.env.example</code> como <code>.env.local</code>.</li>
          <li>Rellena los valores de Supabase → Project Settings → API.</li>
          <li>Reinicia <code>npm run dev</code>. En Vercel, añádelas en Settings → Environment Variables.</li>
        </ol>
      </div>
    </div>
  )
}
