import { Routes, Route, Navigate, matchPath } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect } from 'react'
import { LoadingSpinner } from './components/UI/LoadingSpinner'

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
const VerifyPage = lazy(() => import('./pages/public/VerifyPage'))
const DiscountManager = lazy(() => import('./pages/admin/DiscountManager'))
const PartnerManager = lazy(() => import('./pages/admin/PartnerManager'))

// Preload RestaurantPage chunk so it's ready instantly when a pin is tapped
const preloadRestaurantPage = () => import('./pages/public/RestaurantPage')

function PageLoader() {
  return (
    <div className="h-full flex items-center justify-center bg-bg">
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

  return (
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
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </Suspense>
  )
}
