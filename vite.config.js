import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // Inline tiny assets (≤4 kB) as base64 to skip extra round-trips.
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    // Drop sourcemaps in prod — they bloat the deploy artifact.
    sourcemap: false,
    // Bigger chunks are fine if they cache well; suppress the noisy warning.
    chunkSizeWarningLimit: 800,
    // Vite/rolldown speculatively `modulepreload`s every chunk reachable from
    // the entry's transitive graph, even when behind a `lazy()` import.
    // Strip the ones that are admin- / verify-only so mobile users on the
    // public home don't download ~130 kB they'll never use.
    modulePreload: {
      // ⚠️ Qui si filtra per NOME del file, ma con rolldown il nome di un
      // chunk non dice cosa c'e' dentro. Verificato aprendo i file in `dist`:
      // `cookie-consent-*.js` contiene il core di React
      // (`Symbol.for('react.transitional.element')`), e `dnd-kit-*.js`
      // contiene codice del reconciler React insieme a dnd-kit. Sono due
      // chunk che la home usa subito: toglierli da qui non li evita, li fa
      // solo scoprire un giro di rete piu' tardi, quando il browser parsa il
      // modulo che li importa. Il filtro su `dnd-kit` faceva gia' questo.
      // Prima di aggiungere una riga qui, apri il chunk e guarda cosa
      // contiene davvero — il nome non basta.
      resolveDependencies(_filename, deps) {
        return deps.filter(d => {
          // `qr-*.js` e' l'unico verificato come davvero solo suo: dentro c'e'
          // qrcode/qr-scanner e nessun React. Serve alla riscossione dello
          // sconto e alla pagina di verifica, mai al primo disegno.
          if (/\/qr-[A-Za-z0-9_-]+\.js$/.test(d)) return false
          return true
        })
      },
    },
    rollupOptions: {
      output: {
        // Group third-party deps into stable, well-cached chunks. Each chunk
        // is loaded only when a route/component that needs it is rendered, so
        // putting heavy libs in dedicated chunks keeps the entry tiny.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('mapbox-gl')) return 'mapbox'
          if (id.includes('supercluster') || id.includes('kdbush')) return 'mapbox'
          if (id.includes('framer-motion')) return 'motion'
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n'
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory-')) return 'recharts'
          if (id.includes('@react-pdf')) return 'react-pdf'
          if (id.includes('@dnd-kit')) return 'dnd-kit'
          if (id.includes('qrcode') || id.includes('qr-scanner')) return 'qr'
          if (id.includes('@tanstack/react-virtual')) return 'virtual'
          if (id.includes('react-cookie-consent')) return 'cookie-consent'
          if (id.includes('react-router')) return 'router'
          if (id.includes('react-dom') || /\/react\//.test(id)) return 'react'
          return undefined
        },
      },
    },
  },
})
