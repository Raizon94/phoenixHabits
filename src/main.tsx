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
        dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === 'success' && q.queryKey[0] !== 'photoUrls' },
      }}
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
)
