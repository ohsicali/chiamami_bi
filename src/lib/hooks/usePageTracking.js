import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from '../supabase'

const SESSION_KEY = 'chiamamibi_session_id'
const SESSION_TIMESTAMP_KEY = 'chiamamibi_session_ts'
const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 min inactivity = new session

function generateSessionId() {
  const rand = Math.random().toString(36).slice(2, 12)
  const ts = Date.now().toString(36)
  return `${ts}-${rand}`
}

function getOrCreateSessionId() {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY)
    const lastActivity = parseInt(sessionStorage.getItem(SESSION_TIMESTAMP_KEY) || '0', 10)
    const now = Date.now()

    if (existing && now - lastActivity < SESSION_TIMEOUT_MS) {
      sessionStorage.setItem(SESSION_TIMESTAMP_KEY, String(now))
      return existing
    }

    const fresh = generateSessionId()
    sessionStorage.setItem(SESSION_KEY, fresh)
    sessionStorage.setItem(SESSION_TIMESTAMP_KEY, String(now))
    return fresh
  } catch {
    // sessionStorage unavailable (private mode, etc.)
    return generateSessionId()
  }
}

/**
 * Page tracking hook — inserts a row into page_views on every route change.
 * Skips admin routes (we don't want admin noise polluting visitor metrics).
 */
export function usePageTracking() {
  const location = useLocation()
  const lastTrackedPath = useRef(null)

  useEffect(() => {
    if (!isSupabaseConfigured()) return

    const path = location.pathname

    // Don't track admin routes
    if (path.startsWith('/admin')) return

    // Avoid double-tracking the same path (e.g. StrictMode double-invoke)
    if (lastTrackedPath.current === path) return
    lastTrackedPath.current = path

    const sessionId = getOrCreateSessionId()

    // Fire-and-forget — never block navigation or surface errors to the user
    ;(async () => {
      try {
        const { data: authData } = await supabase.auth.getUser()
        const userId = authData?.user?.id || null

        await supabase.from('page_views').insert({
          path,
          user_id: userId,
          session_id: sessionId,
          referrer: document.referrer || null,
          user_agent: navigator.userAgent?.slice(0, 255) || null,
        })
      } catch {
        // silent fail — analytics must never break the app
      }
    })()
  }, [location.pathname])
}
