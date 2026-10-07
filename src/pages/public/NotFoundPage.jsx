import { Link } from 'react-router-dom'
import MetaTags from '../../components/SEO/MetaTags'

// Un indirizzo che non esiste. Fino al 07/10 la Route "*" rimandava alla home
// con un redirect fatto da JavaScript: per Google ogni indirizzo sbagliato
// (vecchi link, refusi, /r/... dal pannello) diventava una copia della home o
// un "reindirizzamento", e finiva tra gli errori di Search Console. Ora la
// pagina dice che non c'è e chiede di non indicizzarla.
export default function NotFoundPage() {
  return (
    <div className="min-h-dvh md:min-h-[calc(100dvh-80px)] flex flex-col items-center justify-center px-6 text-center" style={{ background: 'var(--color-page)' }}>
      <MetaTags
        title="Pagina non trovata — ChiamamiBi"
        description="Questa pagina non esiste o è stata spostata."
        noindex
      />
      <div className="mb-4 text-6xl" aria-hidden="true">🍽️</div>
      <h1 className="mb-2 text-2xl font-bold text-primary" style={{ fontFamily: 'var(--font-sans)' }}>
        Pagina non trovata
      </h1>
      <p className="mb-6 text-secondary">
        Questa pagina non esiste o è stata spostata.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link
          to="/"
          className="rounded-full bg-accent px-6 py-3 text-sm font-semibold text-white shadow-md transition-transform active:scale-95"
        >
          Torna alla home
        </Link>
        <Link
          to="/esplora"
          className="rounded-full border border-current px-6 py-3 text-sm font-semibold text-primary transition-transform active:scale-95"
        >
          Apri la mappa
        </Link>
      </div>
    </div>
  )
}
