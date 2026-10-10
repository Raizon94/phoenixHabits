// Genera los iconos PNG de la PWA a partir de public/icons/favicon.svg
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
const svg = readFileSync('public/icons/favicon.svg')
const out = 'public/icons/'
await sharp(svg).resize(192, 192).png().toFile(out + 'icon-192.png')
await sharp(svg).resize(512, 512).png().toFile(out + 'icon-512.png')
await sharp(svg).resize(180, 180).flatten({ background: '#0a0a0b' }).png().toFile(out + 'apple-touch-icon.png')
// Maskable: logo reducido dentro de la zona segura sobre fondo completo
const inner = await sharp(svg).resize(360, 360).png().toBuffer()
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#0a0a0b' } })
  .composite([{ input: inner, top: 76, left: 76 }]).png().toFile(out + 'icon-maskable-512.png')
console.log('iconos generados')
