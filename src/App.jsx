import { Routes, Route, Navigate } from 'react-router-dom'
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

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes location={location} key={location.pathname}>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/restaurant/:slug" element={<RestaurantPage />} />
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
    </Suspense>
  )
}
