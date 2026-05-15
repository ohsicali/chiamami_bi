import { useEffect, useRef, useState } from 'react'

/**
 * Cloudflare Turnstile invisible/managed widget.
 *
 * Loads the Turnstile script lazily (only when the component mounts) and
 * renders an invisible challenge inside a hidden div. The parent form calls
 * `getToken()` via the ref API before submit to obtain a fresh token; tokens
 * are single-use and expire after 5 minutes.
 *
 * If `VITE_TURNSTILE_SITE_KEY` is not set (e.g. local dev without env var)
 * the component renders nothing and `onToken('')` is fired immediately, so
 * the form can submit as before. The server still validates the token when
 * `TURNSTILE_SECRET_KEY` is configured — when it isn't, validation is
 * skipped server-side too. This way captcha is a true no-op in dev.
 *
 * Usage:
 *   const [captchaToken, setCaptchaToken] = useState('')
 *   <Turnstile onToken={setCaptchaToken} />
 *   // ...later, in submit handler:
 *   body: JSON.stringify({ ...payload, captcha_token: captchaToken })
 */

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=__chiamamibi_ts_onload&render=explicit'
const SCRIPT_ID = 'cf-turnstile-script'

let scriptLoaded = false
let scriptLoading = null

function loadScript() {
  if (typeof window === 'undefined') return Promise.resolve()
  if (scriptLoaded) return Promise.resolve()
  if (scriptLoading) return scriptLoading
  scriptLoading = new Promise((resolve) => {
    window.__chiamamibi_ts_onload = () => {
      scriptLoaded = true
      resolve()
    }
    const existing = document.getElementById(SCRIPT_ID)
    if (existing) return
    const s = document.createElement('script')
    s.id = SCRIPT_ID
    s.src = SCRIPT_SRC
    s.async = true
    s.defer = true
    document.head.appendChild(s)
  })
  return scriptLoading
}

export default function Turnstile({ onToken, action = 'submit' }) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY
  const containerRef = useRef(null)
  const widgetIdRef = useRef(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!siteKey) {
      // Dev mode — skip captcha entirely
      onToken?.('')
      return
    }
    let cancelled = false
    loadScript().then(() => {
      if (cancelled || !containerRef.current || !window.turnstile) return
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        action,
        callback: (token) => onToken?.(token),
        'error-callback': () => onToken?.(''),
        'expired-callback': () => onToken?.(''),
        'timeout-callback': () => onToken?.(''),
      })
      setReady(true)
    })
    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current) } catch (_) {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey])

  if (!siteKey) return null
  // Container is required by Turnstile even for invisible/managed mode; we
  // keep it compact and unstyled — Cloudflare paints its own UI inside.
  return (
    <div
      ref={containerRef}
      data-turnstile-ready={ready ? '1' : '0'}
      style={{ minHeight: 0 }}
    />
  )
}
