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
