import { createContext, useContext, useState, useCallback } from 'react'

const CityContext = createContext(null)

const DEFAULT_CITY = { name: 'Torino', lng: 7.6869, lat: 45.0703 }

export function CityProvider({ children }) {
  const [city, setCity] = useState(() => {
    try {
      const saved = localStorage.getItem('selectedCity')
      return saved ? JSON.parse(saved) : DEFAULT_CITY
    } catch { return DEFAULT_CITY }
  })

  const selectCity = useCallback(({ name, lng, lat }) => {
    const c = { name, lng, lat }
    setCity(c)
    try { localStorage.setItem('selectedCity', JSON.stringify(c)) } catch {}
  }, [])

  return (
    <CityContext.Provider value={{ city, selectCity }}>
      {children}
    </CityContext.Provider>
  )
}

export function useCity() {
  const ctx = useContext(CityContext)
  if (!ctx) return { city: DEFAULT_CITY, selectCity: () => {} }
  return ctx
}
