import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ProgressPhoto } from '@/types'
import { useUserId } from '@/contexts/AuthContext'
import { deletePhoto, fetchPhotos, signedUrls, updatePhoto, uploadPhoto } from '@/services/bodyService'
import type { ISODate } from '@/utils/date'

export function usePhotos() {
  const userId = useUserId()
  const qc = useQueryClient()
  const q = useQuery({ queryKey: ['photos', userId], queryFn: fetchPhotos })
  const photos = useMemo(() => q.data ?? [], [q.data])

  const upload = useCallback(
    async (files: File[], date: ISODate, notes: string | null) => {
      const added: ProgressPhoto[] = []
      for (const f of files) added.push(await uploadPhoto(userId, f, date, notes))
      qc.setQueryData<ProgressPhoto[]>(['photos', userId], (prev = []) => [...added, ...prev].sort((a, b) => b.photo_date.localeCompare(a.photo_date)))
      return added
    },
    [userId, qc],
  )

  const update = useCallback(
    (p: ProgressPhoto) => {
      updatePhoto(p)
      qc.setQueryData<ProgressPhoto[]>(['photos', userId], (prev = []) => prev.map((x) => (x.id === p.id ? p : x)).sort((a, b) => b.photo_date.localeCompare(a.photo_date)))
    },
    [userId, qc],
  )

  const remove = useCallback(
    async (p: ProgressPhoto) => {
      await deletePhoto(p)
      qc.setQueryData<ProgressPhoto[]>(['photos', userId], (prev = []) => prev.filter((x) => x.id !== p.id))
    },
    [userId, qc],
  )

  return { photos, loading: q.isPending, error: q.data ? null : q.error, refetch: q.refetch, upload, update, remove }
}

/** URLs firmadas (10 min) para mostrar fotos privadas; se renuevan antes de caducar. */
export function usePhotoUrls(paths: string[]) {
  const key = [...paths].sort()
  return useQuery({
    queryKey: ['photoUrls', ...key],
    queryFn: () => signedUrls(key),
    enabled: key.length > 0,
    staleTime: 8 * 60_000,
    gcTime: 9 * 60_000,
    refetchInterval: 8 * 60_000,
  })
}
