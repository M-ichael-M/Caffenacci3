import { defineConfig, type PluginOption } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig(() => {
  const analyze = process.env.ANALYZE === '1'

  return {
    plugins: [
      react(),
      analyze && visualizer({ filename: 'stats.html', template: 'treemap', gzipSize: true, brotliSize: true, open: true }),
    ].filter(Boolean) as PluginOption[],

    optimizeDeps: { exclude: ['maplibre-gl'] },

    build: {
      target: ['chrome100', 'safari15', 'firefox100'],
      cssCodeSplit: true,
      sourcemap: process.env.SOURCEMAP === '1',
      modulePreload: { polyfill: false },
      chunkSizeWarningLimit: 900,            // maplibre-gl jest ciężki i ładowany leniwie
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return
            if (id.includes('maplibre-gl') && !id.endsWith('.css')) return 'maplibre'
            if (id.includes('lucide-react')) return 'lucide'
            if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react'
          },
        },
      },
    },
  }
})