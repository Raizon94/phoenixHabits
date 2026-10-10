import { QueryClient } from '@tanstack/react-query'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Los datos se muestran al instante desde caché y se revalidan en segundo plano.
      staleTime: 30_000,
      gcTime: 1000 * 60 * 60 * 24 * 7,
      retry: (count, err) => count < 2 && !(err instanceof Error && /JWT|permission/i.test(err.message)),
      networkMode: 'offlineFirst',
      refetchOnWindowFocus: true,
    },
    mutations: { networkMode: 'always' },
  },
})

export const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'phoenix.queryCache',
  throttleTime: 1000,
})
