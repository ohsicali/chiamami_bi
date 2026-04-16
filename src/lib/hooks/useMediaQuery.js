import { useEffect, useState } from 'react'

/**
 * React hook: reactive media query matcher.
 *
 * Returns `true` if the query currently matches, updating on window resize /
 * orientation change. Safe on the very first render (no flicker on SSR-like
 * environments because the initial value is evaluated synchronously).
 *
 * Usage:
 *   const isDesktop = useMediaQuery('(min-width: 768px)')
 */
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false
    }
    return window.matchMedia(query).matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mql = window.matchMedia(query)
    const onChange = (e) => setMatches(e.matches)
    // Sync in case the value changed between render and effect
    setMatches(mql.matches)
    if (mql.addEventListener) {
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    }
    // Safari < 14 fallback
    mql.addListener(onChange)
    return () => mql.removeListener(onChange)
  }, [query])

  return matches
}

/**
 * Convenience: desktop = viewport ≥ 768px (Tailwind's `md` breakpoint).
 * Use this to render a single branch of JSX instead of duplicating the DOM
 * with `hidden md:block` / `md:hidden` twins.
 */
export function useIsDesktop() {
  return useMediaQuery('(min-width: 768px)')
}
