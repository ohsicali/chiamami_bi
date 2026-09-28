import { useState, useEffect, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { fetchAnnouncementsEnabled, setAnnouncementsEnabled } from '../../lib/emailPrefs'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'
import Footer from '../../components/Layout/Footer'
import { openWelcomeTour } from '../../lib/welcomeTour'

const inputStyle = {
  width: '100%', background: 'var(--color-page)', borderRadius: 'var(--radius-md)',
  padding: '14px 16px', border: 'none', fontSize: 14,
  color: 'var(--color-ink)', outline: 'none',
  fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
}

const btnAccent = {
  background: 'var(--color-cta)', color: '#fff', borderRadius: 'var(--radius-md)',
  padding: '13px 20px', fontSize: 13, fontWeight: 600,
  border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
}

const cardStyle = {
  background: 'var(--color-card)', borderRadius: 'var(--radius-lg)', padding: 20,
  border: '1px solid var(--color-line)',
}

/* ── Delete Account Modal ── */
function DeleteAccountModal({ onConfirm, onClose, busy = false, error = '' }) {
  const [step, setStep] = useState(1)
  const [confirmText, setConfirmText] = useState('')

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        style={{ margin: '0 20px', width: '100%', maxWidth: 360, borderRadius: 'var(--radius-xl)', background: 'var(--color-card)', padding: 24 }}
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
        onClick={e => e.stopPropagation()}
      >
        {step === 1 ? (
          <>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <span style={{ fontSize: 36 }}>⚠️</span>
              <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, letterSpacing: '-0.02em', fontSize: 18, color: 'var(--color-ink)', marginTop: 12 }}>
                Sei sicuro?
              </h3>
              <p style={{ fontSize: 13, color: 'var(--color-ink-55)', marginTop: 8, lineHeight: 1.5 }}>
                Tutti i tuoi dati verranno eliminati permanentemente: profilo, salvati e sconti.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} style={{
                flex: 1, padding: '12px 0', borderRadius: 14, background: 'var(--color-page)',
                border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--color-ink-55)', cursor: 'pointer',
              }}>Annulla</button>
              <button onClick={() => setStep(2)} style={{
                flex: 1, padding: '12px 0', borderRadius: 14, background: 'var(--color-cta)',
                border: 'none', fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
              }}>Continua</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, letterSpacing: '-0.02em', fontSize: 18, color: 'var(--color-corallo)' }}>
                Conferma cancellazione
              </h3>
              <p style={{ fontSize: 13, color: 'var(--color-ink-55)', marginTop: 8 }}>
                Digita <strong style={{ color: 'var(--color-corallo)' }}>ELIMINA</strong> per confermare.
              </p>
            </div>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="Digita ELIMINA"
              autoFocus
              style={{
                ...inputStyle, textAlign: 'center', letterSpacing: 3,
                fontWeight: 700, marginBottom: 16, border: '2px solid var(--color-line)',
              }}
            />
            {error && (
              <p role="alert" style={{ fontSize: 12.5, color: 'var(--color-danger)', textAlign: 'center', margin: '-4px 0 14px', lineHeight: 1.4 }}>
                {error}
              </p>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={onClose} disabled={busy} style={{
                flex: 1, padding: '12px 0', borderRadius: 14, background: 'var(--color-page)',
                border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--color-ink-55)',
                cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1,
              }}>Annulla</button>
              {/* Spento mentre la richiesta è in corso: il secondo tocco partiva
                  mentre il primo stava già cancellando l'account. */}
              <button onClick={onConfirm} disabled={busy || confirmText !== 'ELIMINA'} aria-busy={busy} style={{
                flex: 1, padding: '12px 0', borderRadius: 14, background: '#DC2626',
                border: 'none', fontSize: 13, fontWeight: 700, color: '#fff',
                cursor: !busy && confirmText === 'ELIMINA' ? 'pointer' : 'default',
                opacity: confirmText === 'ELIMINA' ? (busy ? 0.7 : 1) : 0.4,
              }}>{busy ? 'Elimino…' : 'Elimina account'}</button>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

/* ── Status message ── */
function StatusMsg({ msg }) {
  if (!msg) return null
  return (
    <p style={{
      fontSize: 12, marginTop: 8, fontWeight: 500,
      color: msg.type === 'error' ? 'var(--color-corallo)' : 'var(--color-success)',
    }}>{msg.text}</p>
  )
}

export default function SettingsPage() {
  const { user, profile, loading: authLoading, signOut, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const isGoogleUser = user?.app_metadata?.provider === 'google' || user?.app_metadata?.providers?.includes('google')

  // ── Name ──
  const [fullName, setFullName] = useState('')
  const [saving, setSaving] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)

  // ── Email ──
  const [emailStep, setEmailStep] = useState('form') // 'form' | 'otp' | 'recovery_otp' | 'done'
  const [newEmail, setNewEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [emailStatus, setEmailStatus] = useState(null)
  const [emailLoading, setEmailLoading] = useState(false)

  // ── Recovery email ──
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [savingRecovery, setSavingRecovery] = useState(false)
  const [recoverySaved, setRecoverySaved] = useState(false)

  // ── Password ──
  const [pwdUnlocked, setPwdUnlocked] = useState(false)
  const [currentPwd, setCurrentPwd] = useState('')
  const [passwordForm, setPasswordForm] = useState({ new: '', confirm: '' })
  const [passwordMsg, setPasswordMsg] = useState(null)
  const [pwdVerifying, setPwdVerifying] = useState(false)

  // ── Google: add email+password login ──
  const [loginStep, setLoginStep] = useState('form')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginOtp, setLoginOtp] = useState('')
  const [loginPassword, setLoginPassword] = useState({ new: '', confirm: '' })
  const [loginMsg, setLoginMsg] = useState(null)
  const [loginLoading, setLoginLoading] = useState(false)

  // ── Newsletter ──
  const [newsletterEnabled, setNewsletterEnabled] = useState(true)
  const [loadingNewsletter, setLoadingNewsletter] = useState(true)
  const newsletterRef = useRef(null)

  // ── Delete ──
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // ── Init ──
  useEffect(() => {
    if (!profile) return
    setFullName(profile.full_name || '')
    setRecoveryEmail(profile.recovery_email || '')
  }, [profile])

  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured()) { setLoadingNewsletter(false); return }
    // Lo stato vero delle email di annuncio: vedi lib/emailPrefs.js.
    fetchAnnouncementsEnabled(user.id)
      .then((on) => setNewsletterEnabled(on))
      .catch(() => {})
      .finally(() => setLoadingNewsletter(false))
  }, [user?.id])

  // Scroll to #newsletter anchor when hash is present
  useEffect(() => {
    if (window.location.hash === '#newsletter' && newsletterRef.current) {
      setTimeout(() => {
        newsletterRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 300)
    }
  }, [loadingNewsletter])

  if (!authLoading && !user) return <Navigate to="/login" replace />

  // ── Handlers: Name ──
  const handleSaveName = async () => {
    if (!fullName.trim() || !isSupabaseConfigured()) return
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', user.id)
    setSaving(false)
    if (!error) { setNameSaved(true); setTimeout(() => setNameSaved(false), 2000); refreshProfile?.() }
  }

  // ── Handlers: Email (non-Google) ──
  const handleSendOtp = async () => {
    if (!newEmail.trim() || newEmail === user?.email) return
    setEmailLoading(true); setEmailStatus(null)
    const { error } = await supabase.auth.signInWithOtp({ email: user.email })
    setEmailLoading(false)
    if (error) { setEmailStatus({ type: 'error', text: error.message }) }
    else { setEmailStep('otp'); setEmailStatus({ type: 'success', text: `Codice di verifica inviato a ${user.email}` }) }
  }

  const handleVerifyAndChangeEmail = async () => {
    if (!otpCode.trim()) return
    setEmailLoading(true); setEmailStatus(null)
    const { error: verifyErr } = await supabase.auth.verifyOtp({ email: user.email, token: otpCode.trim(), type: 'email' })
    if (verifyErr) { setEmailLoading(false); setEmailStatus({ type: 'error', text: 'Codice non valido o scaduto' }); return }
    const { error: updateErr } = await supabase.auth.updateUser({ email: newEmail })
    setEmailLoading(false)
    if (updateErr) { setEmailStatus({ type: 'error', text: updateErr.message }) }
    else {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user?.email === newEmail) {
        await supabase.from('profiles').update({ email: newEmail }).eq('id', user.id)
        await supabase.auth.refreshSession()
        refreshProfile?.()
        setEmailStep('done'); setEmailStatus({ type: 'success', text: 'Email aggiornata con successo!' })
      } else {
        setEmailStep('done'); setEmailStatus({ type: 'success', text: `Controlla ${newEmail} e clicca il link di conferma.` })
      }
    }
  }

  // ── Handlers: Email (Google) ──
  const handleGoogleEmailChange = async () => {
    if (!newEmail.trim() || newEmail === (profile?.email || user?.email)) return
    setEmailLoading(true); setEmailStatus(null)
    const { error } = await supabase.from('profiles').update({ email: newEmail.trim() }).eq('id', user.id)
    setEmailLoading(false)
    if (error) { setEmailStatus({ type: 'error', text: error.message }) }
    else { setEmailStep('done'); setEmailStatus({ type: 'success', text: 'Email di contatto aggiornata!' }); refreshProfile?.() }
  }

  // ── Handlers: Recovery email OTP ──
  const handleRecoveryOtp = async () => {
    if (!newEmail.trim()) return
    setEmailLoading(true); setEmailStatus(null)
    try {
      // Col token di sessione il server salta il captcha, che questa pagina
      // non ha: senza, con Turnstile attivo la richiesta veniva respinta.
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      const resp = await fetch('/api/recovery-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ email: user.email, action: 'verify_recovery' }),
      })
      const data = await resp.json()
      if (data.no_recovery) { setEmailStatus({ type: 'error', text: 'Nessuna email di recupero configurata. Contatta supporto@chiamamibi.com' }) }
      else if (data.success) { setEmailStep('recovery_otp'); setEmailStatus({ type: 'success', text: `Codice inviato a ${data.masked_email}` }) }
      else { setEmailStatus({ type: 'error', text: data.error || 'Errore nell\'invio del codice' }) }
    } catch { setEmailStatus({ type: 'error', text: 'Errore di connessione' }) }
    setEmailLoading(false)
  }

  const handleVerifyRecoveryAndChangeEmail = async () => {
    if (!otpCode.trim() || !newEmail.trim()) return
    setEmailLoading(true); setEmailStatus(null)
    try {
      // Endpoint consolidato (PR21): /api/recovery-otp con `otp` nel body → verify
      const resp = await fetch('/api/recovery-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: user.email, otp: otpCode, new_email: newEmail }) })
      const data = await resp.json()
      if (data.success) { await supabase.auth.refreshSession(); refreshProfile?.(); setEmailStep('done'); setEmailStatus({ type: 'success', text: 'Email aggiornata con successo!' }) }
      else { setEmailStatus({ type: 'error', text: data.error || 'Codice non valido' }) }
    } catch { setEmailStatus({ type: 'error', text: 'Errore di connessione' }) }
    setEmailLoading(false)
  }

  const handleEmailReset = () => { setEmailStep('form'); setNewEmail(''); setOtpCode(''); setEmailStatus(null) }

  // ── Handlers: Recovery email save ──
  const handleSaveRecoveryEmail = async () => {
    if (!isSupabaseConfigured()) return
    setSavingRecovery(true)
    const { error } = await supabase.from('profiles').update({ recovery_email: recoveryEmail.trim() || null }).eq('id', user.id)
    setSavingRecovery(false)
    if (!error) { setRecoverySaved(true); setTimeout(() => setRecoverySaved(false), 2000); refreshProfile?.() }
  }

  // ── Handlers: Password ──
  const handleVerifyCurrentPwd = async () => {
    if (!currentPwd) return
    setPwdVerifying(true); setPasswordMsg(null)
    const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPwd })
    setPwdVerifying(false)
    if (error) { setPasswordMsg({ type: 'error', text: 'Password attuale non corretta' }) }
    else { setPwdUnlocked(true); setPasswordMsg(null) }
  }

  const handleChangePassword = async () => {
    setPasswordMsg(null)
    if (passwordForm.new.length < 6) { setPasswordMsg({ type: 'error', text: 'La password deve avere almeno 6 caratteri' }); return }
    if (passwordForm.new !== passwordForm.confirm) { setPasswordMsg({ type: 'error', text: 'Le password non coincidono' }); return }
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.new })
      if (error) throw error
      setPasswordMsg({ type: 'success', text: 'Password aggiornata!' })
      setPasswordForm({ new: '', confirm: '' }); setCurrentPwd(''); setPwdUnlocked(false)
    } catch (err) { setPasswordMsg({ type: 'error', text: err.message || 'Errore nel cambio password' }) }
  }

  // ── Handlers: Google add email+password ──
  const handleLoginSendOtp = async () => {
    setLoginLoading(true); setLoginMsg(null)
    const { error } = await supabase.auth.signInWithOtp({ email: user.email })
    setLoginLoading(false)
    if (error) { setLoginMsg({ type: 'error', text: error.message }) }
    else { setLoginStep('otp'); setLoginMsg({ type: 'success', text: `Codice inviato a ${user.email}` }) }
  }

  const handleLoginVerifyOtp = async () => {
    if (!loginOtp.trim()) return
    setLoginLoading(true); setLoginMsg(null)
    const { error } = await supabase.auth.verifyOtp({ email: user.email, token: loginOtp.trim(), type: 'email' })
    setLoginLoading(false)
    if (error) { setLoginMsg({ type: 'error', text: 'Codice non valido o scaduto' }) }
    else { setLoginStep('set_password'); setLoginMsg(null) }
  }

  const handleAddEmailLogin = async () => {
    setLoginMsg(null)
    const email = loginEmail.trim()
    if (!email) { setLoginMsg({ type: 'error', text: 'Inserisci un\'email' }); return }
    if (loginPassword.new.length < 6) { setLoginMsg({ type: 'error', text: 'La password deve avere almeno 6 caratteri' }); return }
    if (loginPassword.new !== loginPassword.confirm) { setLoginMsg({ type: 'error', text: 'Le password non coincidono' }); return }
    setLoginLoading(true)
    try {
      const { error: pwdErr } = await supabase.auth.updateUser({ password: loginPassword.new })
      if (pwdErr) throw pwdErr
      if (email !== user.email) {
        const { error: emailErr } = await supabase.auth.updateUser({ email })
        if (emailErr) throw emailErr
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user?.email === email) {
          await supabase.from('profiles').update({ email }).eq('id', user.id)
          await supabase.auth.refreshSession(); refreshProfile?.()
          setLoginMsg({ type: 'success', text: `Fatto! Ora puoi accedere con ${email} e password.` })
        } else {
          setLoginMsg({ type: 'success', text: `Password impostata! Controlla ${email} per confermare.` })
        }
      } else {
        setLoginMsg({ type: 'success', text: 'Password impostata! Ora puoi accedere anche con email e password.' })
      }
      setLoginStep('done')
    } catch (err) { setLoginMsg({ type: 'error', text: err.message || 'Errore' }) }
    setLoginLoading(false)
  }

  const handleLoginReset = () => { setLoginStep('form'); setLoginEmail(''); setLoginOtp(''); setLoginPassword({ new: '', confirm: '' }); setLoginMsg(null) }

  // ── Handlers: Newsletter ──
  const handleToggleNewsletter = async () => {
    if (!user?.email || !isSupabaseConfigured()) return
    const newState = !newsletterEnabled
    setNewsletterEnabled(newState)
    try {
      await setAnnouncementsEnabled(user.id, newState)
    } catch {
      setNewsletterEnabled(!newState) // non salvato: l'interruttore torna com'era
    }
  }

  // ── Handlers: Delete ──
  /**
   * Fuori dall'account appena cancellato, e di sicuro.
   *
   * Prima si faceva il logout normale e si aspettava: ma l'account non
   * esisteva più, il logout restava appeso e il popup restava aperto come se
   * non fosse successo niente. Chi ripremeva "Elimina account" leggeva
   * "Invalid or expired token" (28/09, dai log di Supabase: cancellazione
   * riuscita, poi due richieste con la sessione morta).
   *
   * Ora: logout solo su questo dispositivo con un tempo massimo; poi la
   * sessione salvata si toglie comunque a mano (anche col logout "locale" la
   * libreria prova a parlare col server, e se quello resta appeso la
   * sessione resterebbe lì); infine la home ricaricata da zero, così nessun
   * pezzo della pagina si ricorda dell'utente che non c'è più.
   */
  const leaveDeletedAccount = async () => {
    await Promise.race([
      signOut({ scope: 'local' }).catch(() => {}),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ])
    try {
      Object.keys(window.localStorage)
        .filter((k) => k.startsWith('sb-') && k.endsWith('-auth-token'))
        .forEach((k) => window.localStorage.removeItem(k))
    } catch {
      // storage bloccato: il ricaricamento più sotto basta lo stesso, la
      // sessione di un account cancellato non si rinnova
    }
    window.location.replace('/')
  }

  const callDeleteAccount = (token) => fetch('/api/delete-account', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
  })

  const handleDeleteAccount = async () => {
    // Un tocco solo: il secondo partiva mentre il primo stava già cancellando.
    if (!user || deleting) return
    setDeleting(true)
    setDeleteError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { leaveDeletedAccount(); return }

      let response = await callDeleteAccount(session.access_token)

      // 401: il server non riconosce la sessione. O è scaduta (si rinnova e si
      // riprova una volta), o l'account non c'è già più (cancellato da un
      // altro dispositivo o da un tocco precedente): in quel caso il rinnovo
      // fallisce e non resta niente da cancellare, si esce e basta.
      if (response.status === 401) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError || !refreshed?.session?.access_token) { leaveDeletedAccount(); return }
        response = await callDeleteAccount(refreshed.session.access_token)
        if (response.status === 401) { leaveDeletedAccount(); return }
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${response.status}`)
      }
      leaveDeletedAccount()
    } catch (err) {
      console.error('Delete account failed:', err)
      setDeleteError('Non sono riuscito a eliminare l’account. Controlla la connessione e riprova.')
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col min-h-dvh md:min-h-[calc(100dvh-80px)]" style={{ background: 'var(--color-page)' }}>
      {/* ── STICKY HEADER (mobile only) ── */}
      <div className="md:hidden" style={{
        position: 'sticky', top: 0, zIndex: 50,
        padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 22px 0',
        background: 'var(--color-page)',
      }}>
        <div className="flex items-center justify-between" style={{ paddingBottom: 14 }}>
          <button onClick={() => navigate(-1)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-sans)', fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', color: 'var(--color-ink)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Impostazioni
          </button>
        </div>
        <div style={{ height: 1, background: 'var(--color-line)', margin: '0 -22px' }} />
      </div>

      {/* ── CONTENT ── */}
      <div className="md:max-w-[640px] md:mx-auto md:w-full" style={{ padding: '20px 22px', paddingBottom: TAB_BAR_HEIGHT + 40, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── NOME ── */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ink)', marginBottom: 12 }}>Nome</h3>
          <div style={{ display: 'flex', gap: 10 }}>
            <input value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} placeholder="Il tuo nome" />
            <button onClick={handleSaveName} disabled={saving || !fullName.trim()} style={{ ...btnAccent, opacity: saving || !fullName.trim() ? 0.5 : 1 }}>
              {nameSaved ? '✓' : saving ? '...' : 'Salva'}
            </button>
          </div>
        </div>

        {/* ── EMAIL ── */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ink)', marginBottom: 4 }}>
            {isGoogleUser ? 'Email di contatto' : 'Email'}
          </h3>
          {isGoogleUser ? (
            <p style={{ fontSize: 12, color: 'var(--color-ink-55)', marginBottom: 12, lineHeight: 1.5 }}>
              Accedi con Google ({user?.email}). Qui puoi impostare un'email di contatto diversa.
              {profile?.email && profile.email !== user?.email && (
                <><br />Email di contatto: <strong style={{ color: 'var(--color-ink)' }}>{profile.email}</strong></>
              )}
            </p>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--color-ink-55)', marginBottom: 12 }}>
              Email attuale: <strong style={{ color: 'var(--color-ink)' }}>{user?.email}</strong>
            </p>
          )}

          {/* Google: simple change */}
          {emailStep === 'form' && isGoogleUser && (
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={inputStyle} placeholder="Email di contatto" />
              <button onClick={handleGoogleEmailChange} disabled={emailLoading || !newEmail.trim() || newEmail === (profile?.email || user?.email)} style={{ ...btnAccent, opacity: emailLoading || !newEmail.trim() ? 0.5 : 1 }}>
                {emailLoading ? '...' : 'Salva'}
              </button>
            </div>
          )}

          {/* Non-Google: OTP flow */}
          {emailStep === 'form' && !isGoogleUser && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={inputStyle} placeholder="Nuova email" />
                <button onClick={handleSendOtp} disabled={emailLoading || !newEmail.trim() || newEmail === user?.email} style={{ ...btnAccent, opacity: emailLoading || !newEmail.trim() || newEmail === user?.email ? 0.5 : 1 }}>
                  {emailLoading ? '...' : 'Cambia'}
                </button>
              </div>
              <button onClick={handleRecoveryOtp} disabled={emailLoading || !newEmail.trim()} style={{ fontSize: 12, color: 'var(--color-ink-55)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>
                Non ho accesso all'email attuale
              </button>
            </div>
          )}

          {/* OTP verification */}
          {emailStep === 'otp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 12, color: 'var(--color-ink-55)' }}>Inserisci il codice ricevuto su <strong>{user?.email}</strong></p>
              <div style={{ display: 'flex', gap: 10 }}>
                <input type="text" value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Codice di verifica" inputMode="numeric" autoComplete="one-time-code" style={{ ...inputStyle, textAlign: 'center', letterSpacing: 3, fontFamily: 'monospace' }} />
                <button onClick={handleVerifyAndChangeEmail} disabled={emailLoading || otpCode.length < 6} style={{ ...btnAccent, opacity: emailLoading || otpCode.length < 6 ? 0.5 : 1 }}>
                  {emailLoading ? '...' : 'Conferma'}
                </button>
              </div>
              <button onClick={handleEmailReset} style={{ fontSize: 12, color: 'var(--color-ink-55)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>Annulla</button>
            </div>
          )}

          {/* Recovery OTP */}
          {emailStep === 'recovery_otp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 12, color: 'var(--color-ink-55)' }}>Inserisci il codice inviato alla tua <strong>email di recupero</strong></p>
              <div style={{ display: 'flex', gap: 10 }}>
                <input type="text" value={otpCode} onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Codice di recupero" inputMode="numeric" autoComplete="one-time-code" style={{ ...inputStyle, textAlign: 'center', letterSpacing: 3, fontFamily: 'monospace' }} />
                <button onClick={handleVerifyRecoveryAndChangeEmail} disabled={emailLoading || otpCode.length < 6} style={{ ...btnAccent, opacity: emailLoading || otpCode.length < 6 ? 0.5 : 1 }}>
                  {emailLoading ? '...' : 'Conferma'}
                </button>
              </div>
              <button onClick={handleEmailReset} style={{ fontSize: 12, color: 'var(--color-ink-55)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>Annulla</button>
            </div>
          )}

          {/* Done */}
          {emailStep === 'done' && (
            <button onClick={handleEmailReset} style={{ fontSize: 12, color: 'var(--color-corallo)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Cambia di nuovo</button>
          )}

          <StatusMsg msg={emailStatus} />
        </div>

        {/* ── RECOVERY EMAIL ── */}
        <div style={cardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ink)', marginBottom: 4 }}>Email di recupero</h3>
          <p style={{ fontSize: 12, color: 'var(--color-ink-55)', marginBottom: 12 }}>
            Usata per recuperare l'accesso se perdi l'email principale
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <input type="email" value={recoveryEmail} onChange={e => setRecoveryEmail(e.target.value)} style={inputStyle} placeholder="email-di-recupero@esempio.com" />
            <button onClick={handleSaveRecoveryEmail} disabled={savingRecovery || recoveryEmail === (profile?.recovery_email || '')} style={{ ...btnAccent, opacity: savingRecovery || recoveryEmail === (profile?.recovery_email || '') ? 0.5 : 1 }}>
              {recoverySaved ? '✓' : savingRecovery ? '...' : 'Salva'}
            </button>
          </div>
        </div>

        {/* ── GOOGLE: ADD EMAIL+PASSWORD LOGIN ── */}
        {isGoogleUser && (
          <div style={cardStyle}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ink)', marginBottom: 4 }}>Aggiungi accesso con email e password</h3>
            <p style={{ fontSize: 12, color: 'var(--color-ink-55)', marginBottom: 12, lineHeight: 1.5 }}>
              Attualmente accedi solo con Google. Aggiungi un accesso con email e password come alternativa.
            </p>

            {loginStep === 'form' && (
              <button onClick={handleLoginSendOtp} disabled={loginLoading} style={{ ...btnAccent, width: '100%', textAlign: 'center', opacity: loginLoading ? 0.5 : 1 }}>
                {loginLoading ? 'Invio...' : 'Verifica la tua identità'}
              </button>
            )}

            {loginStep === 'otp' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 12, color: 'var(--color-ink-55)' }}>Inserisci il codice ricevuto su <strong>{user?.email}</strong></p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input type="text" value={loginOtp} onChange={e => setLoginOtp(e.target.value.replace(/\D/g, '').slice(0, 8))} placeholder="Codice di verifica" inputMode="numeric" autoComplete="one-time-code" style={{ ...inputStyle, textAlign: 'center', letterSpacing: 3, fontFamily: 'monospace' }} />
                  <button onClick={handleLoginVerifyOtp} disabled={loginLoading || loginOtp.length < 6} style={{ ...btnAccent, opacity: loginLoading || loginOtp.length < 6 ? 0.5 : 1 }}>
                    {loginLoading ? '...' : 'Conferma'}
                  </button>
                </div>
                <button onClick={handleLoginReset} style={{ fontSize: 12, color: 'var(--color-ink-55)', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}>Annulla</button>
              </div>
            )}

            {loginStep === 'set_password' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 500 }}>Identità verificata! Imposta il tuo nuovo accesso.</p>
                <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} style={inputStyle} placeholder="Email per il login" />
                <input type="password" value={loginPassword.new} onChange={e => setLoginPassword(p => ({ ...p, new: e.target.value }))} style={inputStyle} placeholder="Password (min. 6 caratteri)" />
                <input type="password" value={loginPassword.confirm} onChange={e => setLoginPassword(p => ({ ...p, confirm: e.target.value }))} style={inputStyle} placeholder="Conferma password" />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleAddEmailLogin} disabled={loginLoading || !loginEmail.trim() || !loginPassword.new} style={{ ...btnAccent, flex: 1, textAlign: 'center', opacity: loginLoading || !loginEmail.trim() || !loginPassword.new ? 0.5 : 1 }}>
                    {loginLoading ? 'Salvataggio...' : 'Attiva accesso con email'}
                  </button>
                  <button onClick={handleLoginReset} style={{ flex: 0, padding: '13px 16px', borderRadius: 14, background: 'var(--color-page)', border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--color-ink-55)', cursor: 'pointer' }}>Annulla</button>
                </div>
              </div>
            )}

            {loginStep === 'done' && (
              <button onClick={handleLoginReset} style={{ fontSize: 12, color: 'var(--color-corallo)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>Modifica di nuovo</button>
            )}

            <StatusMsg msg={loginMsg} />
          </div>
        )}

        {/* ── PASSWORD (non-Google) ── */}
        {!isGoogleUser && (
          <div style={cardStyle}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ink)', marginBottom: 12 }}>Cambia password</h3>
            {!pwdUnlocked ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <p style={{ fontSize: 12, color: 'var(--color-ink-55)' }}>Inserisci la password attuale per procedere</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} style={inputStyle} placeholder="Password attuale" />
                  <button onClick={handleVerifyCurrentPwd} disabled={pwdVerifying || !currentPwd} style={{ ...btnAccent, background: 'var(--color-ink)', opacity: pwdVerifying || !currentPwd ? 0.5 : 1 }}>
                    {pwdVerifying ? '...' : 'Verifica'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input type="password" value={passwordForm.new} onChange={e => setPasswordForm(p => ({ ...p, new: e.target.value }))} style={inputStyle} placeholder="Nuova password (min. 6 caratteri)" />
                <input type="password" value={passwordForm.confirm} onChange={e => setPasswordForm(p => ({ ...p, confirm: e.target.value }))} style={inputStyle} placeholder="Conferma nuova password" />
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={handleChangePassword} disabled={!passwordForm.new || !passwordForm.confirm} style={{ ...btnAccent, flex: 1, textAlign: 'center', opacity: !passwordForm.new || !passwordForm.confirm ? 0.5 : 1 }}>
                    Aggiorna password
                  </button>
                  <button onClick={() => { setPwdUnlocked(false); setCurrentPwd(''); setPasswordForm({ new: '', confirm: '' }); setPasswordMsg(null) }} style={{ flex: 0, padding: '13px 16px', borderRadius: 14, background: 'var(--color-page)', border: 'none', fontSize: 13, fontWeight: 600, color: 'var(--color-ink-55)', cursor: 'pointer' }}>
                    Annulla
                  </button>
                </div>
              </div>
            )}
            <StatusMsg msg={passwordMsg} />
          </div>
        )}

        {/* ── NEWSLETTER ── */}
        <div id="newsletter" ref={newsletterRef} style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-ink)' }}>Newsletter</h3>
              <p style={{ fontSize: 12, color: 'var(--color-ink-55)', marginTop: 2 }}>Ricevi novità e offerte esclusive</p>
            </div>
            <button onClick={handleToggleNewsletter} disabled={loadingNewsletter} style={{
              position: 'relative', width: 48, height: 28, borderRadius: 14,
              background: newsletterEnabled ? 'var(--color-corallo)' : 'var(--color-ink-15)',
              border: 'none', cursor: 'pointer', transition: 'background 0.2s',
              flexShrink: 0,
            }}>
              <motion.div
                style={{
                  position: 'absolute', top: 2, width: 24, height: 24,
                  borderRadius: 12, background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                }}
                animate={{ left: newsletterEnabled ? 22 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        </div>

        {/* ── TUTORIAL ── Lo stesso che parte dopo la registrazione
            (components/Onboarding/WelcomeTour.jsx), per chi l'ha saltato. */}
        <button onClick={() => openWelcomeTour()} style={{
          ...cardStyle, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          cursor: 'pointer', textAlign: 'left',
        }}>
          <span>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--color-ink)' }}>Rivedi il tutorial</span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--color-ink-55)', marginTop: 2 }}>Come funzionano mappa, sconti e salvati</span>
          </span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-ink-55)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>

        {/* ── DELETE ACCOUNT ── */}
        <button onClick={() => setShowDeleteModal(true)} style={{
          ...cardStyle, width: '100%', display: 'flex', alignItems: 'center', gap: 12,
          cursor: 'pointer', textAlign: 'left',
        }}>
          <span style={{ fontSize: 18 }}>🗑️</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-corallo)' }}>Cancella il mio account</span>
        </button>
      </div>

      {/* Desktop footer */}
      <div className="hidden md:block">
        <Footer />
      </div>

      {/* ── DELETE MODAL ── */}
      <AnimatePresence>
        {showDeleteModal && (
          <DeleteAccountModal
            onConfirm={handleDeleteAccount}
            onClose={() => { if (!deleting) { setShowDeleteModal(false); setDeleteError('') } }}
            busy={deleting}
            error={deleteError}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
