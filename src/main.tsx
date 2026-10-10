import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { registerSW } from 'virtual:pwa-register'
import { queryClient, persister } from '@/lib/queryClient'
import { App } from './App'
import '@/styles/index.css'

registerSW({ immediate: true })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        buster: 'v1',
        // Las URLs firmadas de fotos caducan: no se guardan en caché persistente.
        // Las URLs firmadas caducan y la sesión activa tiene su propia copia local: no se persisten.
        dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' && !['photoUrls', 'activeSession', 'session'].includes(String(q.queryKey[0])) },
      }}
      // La caché restaurada se muestra al instante y se revalida en segundo plano.
      onSuccess={() => queryClient.invalidateQueries()}
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
)
