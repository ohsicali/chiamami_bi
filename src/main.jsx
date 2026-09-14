import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from './App'
import { ToastProvider } from './components/UI/Toast'
import { CityProvider } from './lib/CityContext'
import { AuthProvider } from './lib/hooks/useAuth'
// Self-hosted fonts (latin subset). Served from our own origin with immutable
// caching instead of the Google Fonts CDN — same glyphs/weights, no extra
// preconnect + render-blocking request chain to fonts.googleapis.com.
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-500.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource/poppins/latin-800.css'
import '@fontsource/poppins/latin-900.css'
import '@fontsource/caveat/latin-400.css'
import './lib/i18n'
import './styles/globals.css'

/**
 * La pagina si apre da capo, non da dove l'avevi lasciata.
 *
 * Il browser si ricorda lo scroll e lo rimette al ricaricamento — ma lo fa
 * quando la pagina ha ripreso la sua altezza, e qui l'altezza arriva dopo:
 * prima il guscio vuoto, poi il chunk della route, poi i locali da Supabase.
 * Lo `scrollTo(0, 0)` che App.jsx fa al cambio di route parte ben prima di
 * quel momento, quindi il ripristino del browser arriva per ultimo e vince.
 * Da telefono si vedeva bene: aprivi la home e ti trovavi in mezzo al feed,
 * con l'intestazione e la fascia del momento già passate.
 *
 * `manual` spegne il ripristino del browser e lascia decidere a noi. Non
 * perdiamo niente: la navigazione interna non ci contava già, perché App.jsx
 * riporta in cima a ogni cambio di percorso (tranne mappa ↔ scheda locale,
 * che resta montata e non ricarica).
 */
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual'
}

// Register service worker for push notifications
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CityProvider>
          <ToastProvider>
            <App />
            <Analytics />
            <SpeedInsights />
          </ToastProvider>
        </CityProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
)
