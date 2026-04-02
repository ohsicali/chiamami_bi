import { Routes, Route, Navigate, matchPath, Link } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect, Component } from 'react'
import CookieConsent from 'react-cookie-consent'
import { LoadingSpinner } from './components/UI/LoadingSpinner'
import MobileTabBar from './components/Layout/MobileTabBar'

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
const RestaurantPage = lazy(() => import('./pages/public/RestaurantPage'))
const ListView = lazy(() => import('./pages/public/ListView'))
const AboutPage = lazy(() => import('./pages/public/AboutPage'))
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const RestaurantForm = lazy(() => import('./pages/admin/RestaurantForm'))
const CategoryManager = lazy(() => import('./pages/admin/CategoryManager'))
const LoginPage = lazy(() => import('./pages/public/LoginPage'))
const ProfilePage = lazy(() => import('./pages/public/ProfilePage'))
const DealsPage = lazy(() => import('./pages/public/DealsPage'))
const SavedPage = lazy(() => import('./pages/public/SavedPage'))
const VerifyPage = lazy(() => import('./pages/public/VerifyPage'))
const DiscountManager = lazy(() => import('./pages/admin/DiscountManager'))
const PartnerManager = lazy(() => import('./pages/admin/PartnerManager'))
const ReviewModerator = lazy(() => import('./pages/admin/ReviewModerator'))
const PartnerLandingPage = lazy(() => import('./pages/public/PartnerLandingPage'))
const NewsletterManager = lazy(() => import('./pages/admin/NewsletterManager'))
const ApplicationManager = lazy(() => import('./pages/admin/ApplicationManager'))
const AdminSettings = lazy(() => import('./pages/admin/AdminSettings'))
const PrivacyPage = lazy(() => import('./pages/public/PrivacyPage'))
const TermsPage = lazy(() => import('./pages/public/TermsPage'))
const AuthCallback = lazy(() => import('./pages/public/AuthCallback'))
const ResetPasswordPage = lazy(() => import('./pages/public/ResetPasswordPage'))

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

  // Preload the restaurant page chunk after initial render
  useEffect(() => {
    const timer = setTimeout(preloadRestaurantPage, 1000)
    return () => clearTimeout(timer)
  }, [])

  const isRestaurantDetail = matchPath('/restaurant/:slug', location.pathname)
  const isHome = location.pathname === '/' || isRestaurantDetail
  const isAdmin = location.pathname.startsWith('/admin')
  const showTabBar = !isAdmin && !isRestaurantDetail

  return (
    <>
    <ErrorBoundary>
    <Suspense fallback={<PageLoader />}>
      {/* HomePage stays mounted when viewing restaurant detail */}
      {isHome && <HomePage />}

      {/* Restaurant detail overlays on top */}
      {isRestaurantDetail && <RestaurantPage />}

      {/* Other routes replace the page normally */}
      {!isHome && (
        <Routes location={location} key={location.pathname}>
          <Route path="/list" element={<ListView />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/restaurant/new" element={<RestaurantForm />} />
          <Route path="/admin/restaurant/:id/edit" element={<RestaurantForm />} />
          <Route path="/admin/categories" element={<CategoryManager />} />
          <Route path="/admin/discounts" element={<DiscountManager />} />
          <Route path="/admin/partners" element={<PartnerManager />} />
          <Route path="/admin/reviews" element={<ReviewModerator />} />
          <Route path="/admin/newsletter" element={<NewsletterManager />} />
          <Route path="/admin/applications" element={<ApplicationManager />} />
          <Route path="/admin/settings" element={<AdminSettings />} />
          <Route path="/partner" element={<PartnerLandingPage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/saved" element={<SavedPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </Suspense>
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
