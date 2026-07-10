import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Build du document interactif envoyé au client : un seul fichier HTML, sans
 * requête réseau. Tout est inliné ensuite par `scripts/inline-standalone.mjs`.
 */
export default defineConfig({
  root: resolve(__dirname),
  base: './',
  resolve: { alias: { '@': resolve(__dirname, 'src') } },
  plugins: [react(), tailwindcss()],
  build: {
    outDir: resolve(__dirname, 'out/standalone'),
    emptyOutDir: true,
    cssCodeSplit: false,
    // Images et polices en data URI — le fichier doit rester autonome.
    assetsInlineLimit: 100 * 1024 * 1024,
    rollupOptions: {
      input: resolve(__dirname, 'standalone.html'),
      output: { inlineDynamicImports: true, entryFileNames: 'app.js', assetFileNames: 'app.[ext]' }
    }
  }
})
