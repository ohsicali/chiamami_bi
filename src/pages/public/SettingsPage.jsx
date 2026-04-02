import { useState, useEffect } from 'react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { TAB_BAR_HEIGHT } from '../../components/Layout/MobileTabBar'

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [saving, setSaving] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteStep, setDeleteStep] = useState(0) // 0=hidden, 1=first confirm, 2=final confirm

  const [msg, setMsg] = useState('')
  const [emailMsg, setEmailMsg] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [deleteMsg, setDeleteMsg] = useState('')

  useEffect(() => {
    if (!user?.id) return
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setProfile(data)
          setFullName(data.full_name || '')
        }
      })
    setEmail(user.email || '')
  }, [user?.id])

  if (!authLoading && !user) return <Navigate to="/login" replace />

  const handleSaveName = async () => {
    if (!fullName.trim()) return
    setSaving(true)
    setMsg('')
    const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() }).eq('id', user.id)
    if (error) setMsg('Errore nel salvataggio')
    else setMsg('Nome aggiornato')
    setSaving(false)
  }

  const handleSaveEmail = async () => {
    if (!email.trim() || email === user.email) return
    setSavingEmail(true)
    setEmailMsg('')
    const { error } = await supabase.auth.updateUser({ email: email.trim() })
    if (error) setEmailMsg(error.message)
    else setEmailMsg('Email di verifica inviata al nuovo indirizzo')
    setSavingEmail(false)
  }

  const handleSavePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      setPwMsg('La password deve avere almeno 6 caratteri')
      return
    }
    if (newPassword !== confirmPassword) {
      setPwMsg('Le password non coincidono')
      return
    }
    setSavingPassword(true)
    setPwMsg('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setPwMsg(error.message)
    else {
      setPwMsg('Password aggiornata')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    }
    setSavingPassword(false)
  }

  const handleDeleteAccount = async () => {
    if (deleteStep < 2) {
      setDeleteStep(deleteStep + 1)
      return
    }
    setDeleting(true)
    setDeleteMsg('')
    // Delete user data then sign out — actual auth.users deletion needs admin/edge function
    try {
      await supabase.from('saved_restaurants').delete().eq('user_id', user.id)
      await supabase.from('discount_redemptions').delete().eq('user_id', user.id)
      await supabase.from('user_reviews').delete().eq('user_id', user.id)
      await supabase.from('restaurant_suggestions').delete().eq('user_id', user.id)
      await supabase.from('profiles').delete().eq('id', user.id)
      await supabase.auth.signOut()
      navigate('/')
    } catch {
      setDeleteMsg('Errore durante l\'eliminazione')
      setDeleting(false)
    }
  }

  const inputStyle = {
    width: '100%', background: 'var(--color-bg)', borderRadius: 14,
    padding: '14px 16px', border: 'none', fontSize: 14,
    color: 'var(--color-primary)', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
  }

  const labelStyle = {
    fontSize: 12, fontWeight: 600, color: 'var(--color-secondary)',
    marginBottom: 6, display: 'block',
  }

  const btnStyle = {
    background: 'var(--color-accent)', color: '#fff', borderRadius: 14,
    padding: '13px 0', fontSize: 14, fontWeight: 600,
    border: 'none', cursor: 'pointer', width: '100%',
  }

  const msgStyle = (text) => ({
    fontSize: 12, marginTop: 8, textAlign: 'center',
    color: text?.includes('Errore') || text?.includes('non coincidono') || text?.includes('almeno')
      ? 'var(--color-accent)' : 'var(--color-success)',
  })

  return (
    <div className="flex flex-col min-h-dvh" style={{ background: 'var(--color-bg)' }}>
      {/* ── STICKY HEADER ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 22px 0',
        background: '#FAF7F2',
      }}>
        <div className="flex items-center justify-between" style={{ paddingBottom: 14 }}>
          <button onClick={() => navigate(-1)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 600, color: 'var(--color-primary)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Impostazioni
          </button>
        </div>
        <div style={{ height: 1, background: 'var(--color-bordo)', margin: '0 -22px' }} />
      </div>

      <div style={{ padding: '24px 22px', paddingBottom: TAB_BAR_HEIGHT + 40, display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* ── NOME ── */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 14 }}>Profilo</h2>
          <label style={labelStyle}>Nome</label>
          <input value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} placeholder="Il tuo nome" />
          <button onClick={handleSaveName} disabled={saving} style={{ ...btnStyle, marginTop: 12, opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Salvataggio...' : 'Salva nome'}
          </button>
          {msg && <p style={msgStyle(msg)}>{msg}</p>}
        </div>

        <div style={{ height: 1, background: 'var(--color-bordo)' }} />

        {/* ── EMAIL ── */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 14 }}>Email</h2>
          <label style={labelStyle}>Nuovo indirizzo email</label>
          <input value={email} onChange={e => setEmail(e.target.value)} type="email" style={inputStyle} placeholder="nuova@email.com" />
          <p style={{ fontSize: 11, color: 'var(--color-secondary)', marginTop: 6 }}>
            Riceverai un'email di verifica al nuovo indirizzo
          </p>
          <button onClick={handleSaveEmail} disabled={savingEmail || email === user?.email} style={{
            ...btnStyle, marginTop: 12,
            opacity: savingEmail || email === user?.email ? 0.5 : 1,
          }}>
            {savingEmail ? 'Invio...' : 'Aggiorna email'}
          </button>
          {emailMsg && <p style={msgStyle(emailMsg)}>{emailMsg}</p>}
        </div>

        <div style={{ height: 1, background: 'var(--color-bordo)' }} />

        {/* ── PASSWORD ── */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-primary)', marginBottom: 14 }}>Password</h2>
          <label style={labelStyle}>Nuova password</label>
          <input value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" style={{ ...inputStyle, marginBottom: 10 }} placeholder="Almeno 6 caratteri" />
          <label style={labelStyle}>Conferma password</label>
          <input value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type="password" style={inputStyle} placeholder="Ripeti la password" />
          <button onClick={handleSavePassword} disabled={savingPassword || !newPassword} style={{
            ...btnStyle, marginTop: 12,
            opacity: savingPassword || !newPassword ? 0.5 : 1,
          }}>
            {savingPassword ? 'Aggiornamento...' : 'Aggiorna password'}
          </button>
          {pwMsg && <p style={msgStyle(pwMsg)}>{pwMsg}</p>}
        </div>

        <div style={{ height: 1, background: 'var(--color-bordo)' }} />

        {/* ── ELIMINA ACCOUNT ── */}
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-accent)', marginBottom: 8 }}>Zona pericolosa</h2>
          <p style={{ fontSize: 12, color: 'var(--color-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
            Eliminando il tuo account perderai tutti i dati: ristoranti salvati, sconti, recensioni e suggerimenti.
          </p>

          {deleteStep === 0 && (
            <button onClick={() => setDeleteStep(1)} style={{
              width: '100%', padding: '13px 0', borderRadius: 14,
              background: 'none', border: '1.5px solid var(--color-accent)',
              color: 'var(--color-accent)', fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}>
              Elimina account
            </button>
          )}

          {deleteStep === 1 && (
            <div style={{ background: '#FEF2F2', borderRadius: 16, padding: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#991B1B', marginBottom: 12 }}>
                Sei sicuro? Questa azione è irreversibile.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDeleteStep(0)} style={{
                  flex: 1, padding: '11px 0', borderRadius: 12,
                  background: 'var(--color-bg)', border: 'none', fontSize: 13, fontWeight: 600,
                  color: 'var(--color-primary)', cursor: 'pointer',
                }}>
                  Annulla
                </button>
                <button onClick={() => setDeleteStep(2)} style={{
                  flex: 1, padding: '11px 0', borderRadius: 12,
                  background: 'var(--color-accent)', border: 'none', fontSize: 13, fontWeight: 600,
                  color: '#fff', cursor: 'pointer',
                }}>
                  Si, continua
                </button>
              </div>
            </div>
          )}

          {deleteStep === 2 && (
            <div style={{ background: '#FEF2F2', borderRadius: 16, padding: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: '#991B1B', marginBottom: 4 }}>
                Ultima conferma
              </p>
              <p style={{ fontSize: 12, color: '#991B1B', marginBottom: 12, lineHeight: 1.5 }}>
                Tutti i tuoi dati verranno eliminati permanentemente. Non potremo recuperarli.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDeleteStep(0)} style={{
                  flex: 1, padding: '11px 0', borderRadius: 12,
                  background: '#fff', border: 'none', fontSize: 13, fontWeight: 600,
                  color: 'var(--color-primary)', cursor: 'pointer',
                }}>
                  Annulla
                </button>
                <button onClick={handleDeleteAccount} disabled={deleting} style={{
                  flex: 1, padding: '11px 0', borderRadius: 12,
                  background: '#DC2626', border: 'none', fontSize: 13, fontWeight: 700,
                  color: '#fff', cursor: deleting ? 'default' : 'pointer',
                  opacity: deleting ? 0.6 : 1,
                }}>
                  {deleting ? 'Eliminazione...' : 'Elimina definitivamente'}
                </button>
              </div>
            </div>
          )}

          {deleteMsg && <p style={{ fontSize: 12, color: 'var(--color-accent)', marginTop: 8, textAlign: 'center' }}>{deleteMsg}</p>}
        </div>
      </div>
    </div>
  )
}
