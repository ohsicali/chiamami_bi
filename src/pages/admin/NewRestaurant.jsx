import { useState, useEffect } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import AdminLayout from '../../components/Layout/AdminLayout'

/**
 * NewRestaurant — crea subito una bozza e redirige a /admin/restaurant/:id/edit.
 *
 * Così l'utente vede tutti e 6 i tab (con TabsShell) immediatamente, senza
 * dover prima "salvare i dettagli essenziali" in una pagina separata.
 * Il tab SEO resta bloccato finché non vengono compilati nome + città + racconto.
 *
 * Pre-fill da query params: ?name=…&email=…&city=…&phone=…&website=…
 * (usato dal flusso Candidature → "+ Apri pre-compilata").
 */
export default function NewRestaurant() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [error, setError] = useState(null)

  useEffect(() => {
    if (authLoading || !user || !isAdmin) return
    createAndRedirect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, isAdmin])

  async function createAndRedirect() {
    if (!isSupabaseConfigured()) {
      setError('Supabase non configurato.')
      return
    }

    const name = (searchParams.get('name') || '').trim()
    const email = (searchParams.get('email') || '').trim()
    const city = (searchParams.get('city') || 'Torino').trim()
    const phone = (searchParams.get('phone') || '').trim()
    const website = (searchParams.get('website') || '').trim()

    const draftName = name || 'Nuovo ristorante'
    const uniqueSuffix = Date.now().toString(36)

    // PIN opzionale: alla creazione NON viene generato. L'admin lo attiva
    // dalla tab Credenziali quando serve (è prerequisito per gli sconti).
    const payload = {
      name: draftName,
      slug: slugify(draftName) + '-' + uniqueSuffix,
      address: '',
      city: city || 'Torino',
      partner_email: email || null,
      phone: phone || null,
      website: website || null,
      verify_pin: null,
      last_pin_rotation_at: null,
      is_published: false,
      is_disabled: false,
      category: [],
      recommended_for: [],
      photos: [],
      price_range: 2,
    }

    try {
      const { data, error: err } = await supabase
        .from('restaurants')
        .insert(payload)
        .select('id')
        .single()
      if (err) throw err
      navigate(`/admin/restaurant/${data.id}/edit?new=1`, { replace: true })
    } catch (err) {
      setError('Errore durante la creazione: ' + (err.message || 'unknown'))
    }
  }

  if (authLoading) return <Spinner />
  if (!user || !isAdmin) return <Navigate to="/admin/login" replace />

  if (error) {
    return (
      <AdminLayout title="Nuovo ristorante">
        <div
          style={{
            padding: '60px 32px',
            textAlign: 'center',
            fontFamily: 'var(--font-sans)',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 14 }}>⚠️</div>
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-danger, #C0392B)',
              marginBottom: 20,
            }}
          >
            {error}
          </p>
          <button
            type="button"
            onClick={() => { setError(null); createAndRedirect() }}
            style={{
              background: 'var(--color-corallo, #E8453C)',
              color: '#fff',
              border: 0,
              padding: '10px 20px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 6px 14px rgba(232,69,60,0.28)',
            }}
          >
            Riprova
          </button>
        </div>
      </AdminLayout>
    )
  }

  return <Spinner />
}

function Spinner() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        background: 'var(--color-page, #FAF7F2)',
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: '3px solid var(--color-corallo, #E8453C)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'new-spin 0.7s linear infinite',
        }}
      />
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--color-ink-55, rgba(34,24,28,0.55))',
        }}
      >
        Creo il ristorante…
      </span>
      <style>{`@keyframes new-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

