import { Routes, Route, Navigate, matchPath, Link } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect, useRef, Component } from 'react'
import CookieConsent from 'react-cookie-consent'
import { LoadingSpinner } from './components/UI/LoadingSpinner'
import MobileTabBar from './components/Layout/MobileTabBar'
import DesktopNavbar from './components/Layout/DesktopNavbar'
import { usePageTracking } from './lib/hooks/usePageTracking'
import MaintenanceGate from './components/MaintenanceGate'

class ErrorBoundary extends Component {
  state = { hasError: false, error: null }
  static getDerivedStateFromError(error) {
    return { hasError: true, error }
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
// NOTE: RestaurantForm.jsx is the legacy full-page edit form. Replaced by
// EditRestaurant.jsx (PR15g.2, same 6 shared tabs used in NewRestaurant).
// The file is preserved as dead code but will be removed in a cleanup PR.
const CategoryManager = lazy(() => import('./pages/admin/CategoryManager'))
const LoginPage = lazy(() => import('./pages/public/LoginPage'))
const ProfilePage = lazy(() => import('./pages/public/ProfilePage'))
const MyChatPage = lazy(() => import('./pages/public/MyChatPage'))
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
const TermsPage = lazy(() => import('./pages/public/TermsPage'))
const AuthCallback = lazy(() => import('./pages/public/AuthCallback'))
const ResetPasswordPage = lazy(() => import('./pages/public/ResetPasswordPage'))
const SettingsPage = lazy(() => import('./pages/public/SettingsPage'))

// Preload RestaurantPage chunk so it's ready instantly when a pin is tapped
const preloadRestaurantPage = () => import('./pages/public/RestaurantPage')

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <LoadingSpinner />
    </div>
  )
}

export default function App() {
  const location = useLocation()

  // Track page views (skips /admin routes internally)
  usePageTracking()

  // Preload the restaurant page chunk after initial render
  useEffect(() => {
    const timer = setTimeout(preloadRestaurantPage, 1000)
    return () => clearTimeout(timer)
  }, [])

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
  const isAdmin = location.pathname.startsWith('/admin')
  const isPartner = location.pathname === '/partner'
  const isVerify = location.pathname === '/verify'
  const showTabBar = !isAdmin && !isRestaurantDetail && !isPartner && !isVerify
  const showDesktopNav = !isAdmin && !isVerify

  return (
    <>
    <ErrorBoundary>
    <MaintenanceGate>
    {/* Desktop Navbar — hidden on mobile, hidden on admin */}
    {showDesktopNav && <DesktopNavbar />}

    <Suspense fallback={<PageLoader />}>
      {/* Map page stays mounted when viewing restaurant detail */}
      {isEsplora && <HomePage />}

      {/* Restaurant detail overlays on top */}
      {isRestaurantDetail && <RestaurantPage />}

      {/* Other routes replace the page normally */}
      {!isEsplora && (
        <div className={!isAdmin ? 'desktop-nav-offset' : undefined}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<HomeFeedV4 />} />
          <Route path="/chiedi" element={<ChiediPage />} />
          <Route path="/chiedi/:conversationId" element={<ChiediPage />} />
          <Route path="/list" element={<ListView />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/chat" element={<MyChatPage />} />
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
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </div>
      )}
    </Suspense>
    </MaintenanceGate>
    </ErrorBoundary>

    {/* Mobile Tab Bar */}
    {showTabBar && <MobileTabBar />}

    {/* Cookie Banner GDPR */}
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
        zIndex: 9999,
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
    </>
  )
}
