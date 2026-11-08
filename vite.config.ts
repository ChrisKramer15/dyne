import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// GitHub Pages serves 404.html for unknown paths. Making it a copy of the
// built index.html lets the client router resolve deep links.
function spaFallback(): Plugin {
  let outDir = ''
  return {
    name: 'dyne-spa-404',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const indexPath = resolve(outDir, 'index.html')
      if (!existsSync(indexPath)) {
        throw new Error(`dyne-spa-404: ${indexPath} not found; cannot create 404.html`)
      }
      copyFileSync(indexPath, resolve(outDir, '404.html'))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/dyne/',
  plugins: [react(), spaFallback()],
  build: {
    rolldownOptions: {
      output: {
        // Third-party code changes far less often than app code; separate
        // chunks let returning visitors keep them cached across deploys.
        codeSplitting: {
          groups: [
            { name: 'supabase', test: /node_modules[\\/]@supabase[\\/]/ },
            { name: 'react', test: /node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    // Placeholder credentials so src/supabase.ts can load without a real
    // project (CI has no .env). Tests inject or mock clients; none should
    // reach a real backend.
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
    setupFiles: ['./src/test/setup.ts'],
    // Async property tests render many times per case; the default 5s is too tight.
    testTimeout: 60000,
    // Each file creates its own jsdom; too many parallel workers time out on startup.
    maxWorkers: 4,
    include: [
      'src/**/*.test.{ts,tsx}',
      'supabase/functions/**/*.test.ts',
    ],
  },
})
