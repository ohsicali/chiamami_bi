import { Link, useNavigate } from 'react-router-dom'
import { LogoFull } from '../UI/Logo'

/**
 * Header per le pagine legali (Privacy, Termini): un tasto indietro che
 * torna alla pagina da cui si è arrivati — non sempre la Home, dato che
 * questi link stanno nel footer di ogni pagina, nel form di login e nelle
 * impostazioni — con fallback alla Home solo se la pagina è stata aperta
 * direttamente (nessuna history, es. da un link esterno o una nuova scheda).
 * Il logo resta cliccabile verso "/" ma più piccolo: qui è solo un rimando
 * al brand, non l'azione principale della pagina.
 */
export default function LegalHeader() {
  const navigate = useNavigate()

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  return (
    <nav className="sticky top-0 z-40 glass">
      <div className="flex items-center justify-between px-4 py-3 max-w-screen-lg mx-auto">
        <button
          type="button"
          onClick={handleBack}
          aria-label="Torna indietro"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'none',
            border: 'none',
            padding: '4px 4px 4px 0',
            margin: 0,
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--color-ink-70)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Indietro
        </button>

        <Link to="/" aria-label="ChiamamiBi — Home">
          <LogoFull height={18} subtitle={false} />
        </Link>
      </div>
    </nav>
  )
}
