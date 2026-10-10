/**
 * Compresión de fotos en el cliente antes de subirlas.
 * 1600 px en el lado mayor y JPEG 0,82: unos 200-400 KB con calidad suficiente
 * para comparar cambios físicos.
 */
export const MAX_PHOTO_SIDE = 1600
export const PHOTO_QUALITY = 0.82

export function fitWithin(width: number, height: number, max = MAX_PHOTO_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height))
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      // Respeta la orientación EXIF de las fotos del móvil.
      return await createImageBitmap(file, { imageOrientation: 'from-image' })
    } catch {
      /* fallback a <img> (p. ej. HEIC en Safari) */
    }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function compressImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const src = await loadBitmap(file)
  const w = 'naturalWidth' in src ? src.naturalWidth : src.width
  const h = 'naturalHeight' in src ? src.naturalHeight : src.height
  const size = fitWithin(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo procesar la imagen')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, size.width, size.height)
  if ('close' in src) src.close()
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo comprimir la imagen'))), 'image/jpeg', PHOTO_QUALITY),
  )
  return { blob, ...size }
}
