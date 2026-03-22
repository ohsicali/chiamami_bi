import { Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
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

  // Determine if we're on a restaurant detail page (overlay on top of map)
  const isRestaurantPage = location.pathname.startsWith('/restaurant/')

  return (
    <Suspense fallback={<PageLoader />}>
      {/* Base routes — always render, stay mounted under restaurant overlay */}
      <Routes location={isRestaurantPage ? { ...location, pathname: '/' } : location} key={isRestaurantPage ? '/' : location.pathname}>
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

      {/* Restaurant detail — renders as overlay with smooth animation */}
      <AnimatePresence>
        {isRestaurantPage && (
          <Routes location={location} key="restaurant-overlay">
            <Route path="/restaurant/:slug" element={<RestaurantPage />} />
          </Routes>
        )}
      </AnimatePresence>
    </Suspense>
  )
}
