import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

// Pruebas contra un proyecto Supabase real: SUPABASE_SECRET=... npm run test:cloud
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'jsdom', include: ['tests/integration/**/*.test.ts'], testTimeout: 30_000, fileParallelism: false },
})
