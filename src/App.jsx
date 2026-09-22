import { Routes, Route, Navigate, matchPath, Link } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect, useRef, useState, Component } from 'react'
import { PageLoader } from './components/UI/LoadingSpinner'
import MobileTabBar from './components/Layout/MobileTabBar'
import DesktopNavbar from './components/Layout/DesktopNavbar'
import { usePageTracking } from './lib/hooks/usePageTracking'
import AdsProvider from './components/Ads/AdsProvider'
import { useMediaQuery } from './lib/hooks/useMediaQuery'

// CookieConsent is rendered after first paint via requestIdleCallback so it
// doesn't compete with the LCP. The library + its CSS adds ~20 kB to the
// entry chunk if imported eagerly.
const CookieConsent = lazy(() => import('react-cookie-consent'))

// Un nuovo deploy rinomina i file delle pagine caricate con `lazy()`
// (hash diverso nel nome). Chi ha il sito già aperto e naviga verso una
// pagina non ancora scaricata prova a prendere il vecchio file: Vercel non
// lo trova più e restituisce la pagina HTML del routing SPA al suo posto,
// da cui il "text/html is not a valid JavaScript MIME type". Non è un bug
// dell'app, è il sito vecchio in mano all'utente: un ricaricamento prende
// l'HTML nuovo con i riferimenti giusti e risolve. `RELOAD_KEY` evita di
// ricaricare in loop se il problema fosse un altro.
const CHUNK_ERROR_PATTERN = /dynamically imported module|is not a valid JavaScript MIME type|Importing a module script failed|Failed to fetch dynamically imported module|Unable to preload CSS/i
const RELOAD_KEY = 'chiamamibi-chunk-reload'

function isChunkLoadError(error) {
  return CHUNK_ERROR_PATTERN.test(error?.message || '')
}

class ErrorBoundary extends Component {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }
  componentDidCatch(error) {
    if (!isChunkLoadError(error)) return
    let alreadyTried = false
    try {
      alreadyTried = sessionStorage.getItem(RELOAD_KEY) === '1'
      if (!alreadyTried) sessionStorage.setItem(RELOAD_KEY, '1')
    } catch {
      // storage non disponibile (privacy mode ecc.): mostra il fallback normale
      return
    }
    if (!alreadyTried) window.location.reload()
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 text-center">
          <p className="text-lg font-semibold text-primary mb-2">Qualcosa è andato storto</p>
          <p className="text-sm text-secondary mb-4">{this.state.error?.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium"
          >
            Ricarica pagina
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Lazy load pages
const HomePage = lazy(() => import('./pages/public/HomePage'))
const HomeFeedV4 = lazy(() => import('./pages/public/HomeFeedV4'))
// La home del computer è quella di prima del rifacimento v10, quella del
// telefono è la v10: due strutture diverse, due file. Vedi la nota in cima
// a HomeDesktopClassic.jsx.
const HomeDesktopClassic = lazy(() => import('./pages/public/HomeDesktopClassic'))
const RestaurantPage = lazy(() => import('./pages/public/RestaurantPage'))
const ListView = lazy(() => import('./pages/public/ListView'))
const AboutPage = lazy(() => import('./pages/public/AboutPage'))
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminRestaurants = lazy(() => import('./pages/admin/AdminRestaurants'))
const AnalyticsPage = lazy(() => import('./pages/admin/AnalyticsPage'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const NewRestaurant = lazy(() => import('./pages/admin/NewRestaurant'))
const EditRestaurant = lazy(() => import('./pages/admin/EditRestaurant'))
const CategoryManager = lazy(() => import('./pages/admin/CategoryManager'))
const LoginPage = lazy(() => import('./pages/public/LoginPage'))
const ProfilePage = lazy(() => import('./pages/public/ProfilePage'))
const MyChatPage = lazy(() => import('./pages/public/MyChatPage'))
const MyPreferencesPage = lazy(() => import('./pages/public/MyPreferencesPage'))
const ChiediPage = lazy(() => import('./pages/public/ChiediPage'))
const DealsPage = lazy(() => import('./pages/public/SconteRedesignPage'))
const SavedPage = lazy(() => import('./pages/public/SavedPage'))
const VerifyPage = lazy(() => import('./pages/public/VerifyPage'))
const DiscountManager = lazy(() => import('./pages/admin/DiscountManager'))
const PartnerManager = lazy(() => import('./pages/admin/PartnerManager'))
const PlacementManager = lazy(() => import('./pages/admin/PlacementManager'))
const PartnerLandingPage = lazy(() => import('./pages/public/PartnerLandingPage'))
const NewsletterManager = lazy(() => import('./pages/admin/NewsletterManager'))
const ApplicationManager = lazy(() => import('./pages/admin/ApplicationManager'))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'))
const SuggestionsManager = lazy(() => import('./pages/admin/SuggestionsManager'))
const PrivacyPage = lazy(() => import('./pages/public/PrivacyPage'))
const EmailPreferencesPage = lazy(() => import('./pages/public/EmailPreferencesPage'))
const TermsPage = lazy(() => import('./pages/public/TermsPage'))
const AuthCallback = lazy(() => import('./pages/public/AuthCallback'))
const ResetPasswordPage = lazy(() => import('./pages/public/ResetPasswordPage'))
const SettingsPage = lazy(() => import('./pages/public/SettingsPage'))

// Preload RestaurantPage chunk so it's ready instantly when a pin is tapped
const preloadRestaurantPage = () => import('./pages/public/RestaurantPage')

export default function App() {
  const location = useLocation()

  // Siamo arrivati fin qui senza che l'ErrorBoundary scattasse: la pagina è
  // sana, quindi un eventuale chunk error futuro merita un altro tentativo
  // di ricaricamento (vedi RELOAD_KEY sopra).
  useEffect(() => {
    try {
      sessionStorage.removeItem(RELOAD_KEY)
    } catch {
      // storage non disponibile, nessun problema: il flag semplicemente non si azzera
    }
  }, [])

  // 1024 e non 768: sotto i 1024 le due home si assomigliano (una colonna,
  // riga che scorre), e la piega a due colonne — quella che non piaceva —
  // è esattamente quella che nasce da lì in su.
  const homeDaComputer = useMediaQuery('(min-width: 1024px)')

  // Track page views (skips /admin routes internally)
  usePageTracking()

  // Preload the restaurant page chunk after initial render
  useEffect(() => {
    const timer = setTimeout(preloadRestaurantPage, 1000)
    return () => clearTimeout(timer)
  }, [])

  // Defer the cookie banner until the browser is idle. If the user has already
  // chosen, the lib short-circuits internally and renders nothing.
  const [showCookieBanner, setShowCookieBanner] = useState(false)
  useEffect(() => {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1500))
    const cancel = window.cancelIdleCallback || clearTimeout
    const handle = idle(() => setShowCookieBanner(true), { timeout: 3000 })
    return () => cancel(handle)
  }, [])

  // Il banner è `position: fixed` e appare un attimo dopo il primo
  // rendering: su una pagina corta (es. Salvati con uno o due locali) quello
  // che c'era già in cima — qui, il bottone "Metti in una lista" sotto la
  // card — può ritrovarsi esattamente sotto al banner appena spunta, senza
  // che nulla in pagina suggerisca di scorrere. Un tocco vero lì (provato con
  // eventi touch reali, non `.click()`) arriva al banner, non al bottone: chi
  // preme non vede succedere niente. Qui si scorre la pagina di quanto è alto
  // il banner, ma solo se l'utente non ha già scorso lui stesso (altrimenti
  // lo spiazzerebbe) e solo di quanto basta — mai oltre la fine reale del
  // contenuto.
  useEffect(() => {
    if (!showCookieBanner) return

    const nudge = (banner) => {
      if (window.scrollY > 4) return
      const bannerH = banner.getBoundingClientRect().height
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      const delta = Math.min(bannerH, Math.max(0, maxScroll - window.scrollY))
      if (delta > 0) window.scrollBy({ top: delta, behavior: 'smooth' })
    }

    const already = document.querySelector('.CookieConsent')
    if (already) {
      nudge(already)
      return
    }
    // `<CookieConsent>` è caricato con `lazy()`: al momento in cui questo
    // effetto parte il chunk potrebbe non essere ancora arrivato, quindi si
    // osserva il DOM finché non compare invece di controllare una volta sola.
    const observer = new MutationObserver(() => {
      const banner = document.querySelector('.CookieConsent')
      if (banner) {
        observer.disconnect()
        nudge(banner)
      }
    })
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [showCookieBanner])

  // Scroll to top on route change — but preserve scroll when transitioning
  // between the map (/) and a restaurant detail (/restaurant/:slug), since
  // HomePage stays mounted and we don't want to disturb the map state.
  const prevPath = useRef(location.pathname)
  useEffect(() => {
    const isMapFamily = (p) => p === '/esplora' || p.startsWith('/restaurant/')
    const crossingWithinMap = isMapFamily(prevPath.current) && isMapFamily(location.pathname)
    prevPath.current = location.pathname
    if (crossingWithinMap) return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [location.pathname])

  const isRestaurantDetail = matchPath('/restaurant/:slug', location.pathname)
  const isEsplora = location.pathname === '/esplora' || isRestaurantDetail

  // La mappa resta montata sotto la scheda di un locale per non perderne
  // posizione e zoom quando la scheda si apre e si chiude — ma questo ha senso
  // solo se ci si è passati davvero. Su un arrivo diretto a /restaurant/...
  // (Google, link condiviso, Bi Club) non c'è nessuno stato da conservare, e
  // montarla costerebbe 1,67 MB di Mapbox (456 KB gzip) per non mostrare nulla:
  // la scheda copre tutto lo schermo. Da lì "indietro" porta a `/`, il feed,
  // che la mappa non la usa.
  // NB: `isEsplora` non va toccato — governa anche il blocco <Routes>, e
  // /restaurant/:slug non ha una Route propria: finirebbe sul redirect "*".
  // È `state` e non `ref` di proposito: il valore decide cosa renderizzare, e
  // un ref cambiato non farebbe ri-renderizzare (lo segnala anche eslint).
  const [mapWasVisited, setMapWasVisited] = useState(location.pathname === '/esplora')
  if (location.pathname === '/esplora' && !mapWasVisited) setMapWasVisited(true)
  const showMap = location.pathname === '/esplora' || (isRestaurantDetail && mapWasVisited)
  const isAdmin = location.pathname.startsWith('/admin')
  const isPartner = location.pathname === '/partner'
  const isVerify = location.pathname === '/verify'
  const isLogin = location.pathname === '/login'
  const isChiedi = location.pathname.startsWith('/chiedi')
  const showTabBar = !isAdmin && !isRestaurantDetail && !isPartner && !isVerify && !isLogin && !isChiedi
  const showDesktopNav = !isAdmin && !isVerify && !isLogin

  return (
    <>
    <ErrorBoundary>
    {/* Campagne pubblicitarie: un fetch per sessione, un'estrazione per pagina.
        Sta qui dentro perché legge la route corrente per riestrarre. */}
    <AdsProvider>
    {/* Desktop Navbar — hidden on mobile, hidden on admin */}
    {showDesktopNav && <DesktopNavbar />}

    <Suspense fallback={<PageLoader />}>
      {/* Map page stays mounted when viewing restaurant detail — but only if
          the map was actually visited in this session (see `showMap` above) */}
      {showMap && <HomePage />}

      {/* Restaurant detail overlays on top */}
      {isRestaurantDetail && <RestaurantPage />}

      {/* Other routes replace the page normally */}
      {!isEsplora && (
        <div className={!isAdmin ? 'desktop-nav-offset' : undefined}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={homeDaComputer ? <HomeDesktopClassic /> : <HomeFeedV4 />} />
          <Route path="/chiedi" element={<ChiediPage />} />
          <Route path="/chiedi/:conversationId" element={<ChiediPage />} />
          <Route path="/list" element={<ListView />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/chat" element={<MyChatPage />} />
          <Route path="/profile/preferences" element={<MyPreferencesPage />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/analytics" element={<AnalyticsPage />} />
          <Route path="/admin/restaurants" element={<AdminRestaurants />} />
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/restaurant/new" element={<NewRestaurant />} />
          <Route path="/admin/restaurant/:id/edit" element={<EditRestaurant />} />
          <Route path="/admin/categories" element={<CategoryManager />} />
          <Route path="/admin/discounts" element={<DiscountManager />} />
          <Route path="/admin/partners" element={<PartnerManager />} />
          <Route path="/admin/placements" element={<PlacementManager />} />
          <Route path="/admin/newsletter" element={<NewsletterManager />} />
          <Route path="/admin/applications" element={<ApplicationManager />} />
          <Route path="/admin/suggestions" element={<SuggestionsManager />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/partner" element={<PartnerLandingPage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/sconti" element={<DealsPage />} />
          <Route path="/saved" element={<SavedPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/preferenze-email" element={<EmailPreferencesPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </div>
      )}
    {/* Mobile Tab Bar */}
    {showTabBar && <MobileTabBar />}
    </Suspense>
    </AdsProvider>
    </ErrorBoundary>

    {/* Cookie Banner GDPR — deferred to idle to protect LCP */}
    {showCookieBanner && (
    <Suspense fallback={null}>
    <CookieConsent
      location="bottom"
      buttonText="Accetta tutti"
      declineButtonText="Solo necessari"
      enableDeclineButton
      overlay={false}
      style={{
        background: 'rgba(26, 26, 26, 0.96)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        padding: '18px 20px',
        fontSize: '13px',
        alignItems: 'center',
        // Sopra la bottom-nav (z 50) ma sotto qualunque sheet/modale
        // dell'app (60+): con 9999 il banner restava sopra la sheet di
        // "Consiglia un ristorante" (e ogni altra sheet) e ne mangiava i
        // tap sui bottoni in fondo — invisibile perché sotto, ma lì.
        zIndex: 51,
        borderTop: '1px solid rgba(255,255,255,0.1)',
      }}
      buttonStyle={{
        background: '#E8453C',
        color: '#fff',
        fontSize: '13px',
        borderRadius: '10px',
        padding: '10px 24px',
        fontWeight: '600',
        margin: '4px 8px',
      }}
      declineButtonStyle={{
        background: 'transparent',
        border: '1px solid rgba(255,255,255,0.3)',
        color: '#fff',
        fontSize: '13px',
        borderRadius: '10px',
        padding: '10px 24px',
        fontWeight: '500',
        margin: '4px 8px',
      }}
      cookieName="chiamamibi_cookie_consent"
      expires={365}
    >
      Questo sito utilizza cookie tecnici necessari al funzionamento. Non utilizziamo cookie di profilazione.{' '}
      <Link to="/privacy" style={{ color: '#E8453C', textDecoration: 'underline' }}>Privacy Policy</Link>
    </CookieConsent>
    </Suspense>
    )}
    </>
  )
}
