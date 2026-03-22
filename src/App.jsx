import { Routes, Route, Navigate, useLocation, matchPath } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
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

  // Check if current route is a restaurant detail page
  const restaurantMatch = matchPath('/restaurant/:slug', location.pathname)

  return (
    <Suspense fallback={<PageLoader />}>
      {/* Base routes — keep HomePage mounted when restaurant overlay is open */}
      <Routes location={restaurantMatch ? { ...location, pathname: '/' } : location} key={restaurantMatch ? '/' : location.pathname}>
        <Route path="/" element={<HomePage />} />
        <Route path="/list" element={<ListView />} />
        <Route path="/about" element={<AboutPage />} />

        {/* Admin routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/restaurant/new" element={<RestaurantForm />} />
        <Route path="/admin/restaurant/:id/edit" element={<RestaurantForm />} />
        <Route path="/admin/categories" element={<CategoryManager />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Restaurant detail — rendered directly as AnimatePresence child (not inside Routes) */}
      <AnimatePresence>
        {restaurantMatch && (
          <RestaurantPage key={restaurantMatch.params.slug} slug={restaurantMatch.params.slug} />
        )}
      </AnimatePresence>
    </Suspense>
  )
}
