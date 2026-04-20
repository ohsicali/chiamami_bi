import { Link } from 'react-router-dom'
import { LogoFull } from '../../components/UI/Logo'
import Footer from '../../components/Layout/Footer'

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-bg flex flex-col">
      {/* Header */}
      <nav className="sticky top-0 z-40 glass">
        <div className="flex items-center justify-between px-4 py-3 max-w-screen-lg mx-auto">
          <Link to="/">
            <LogoFull height={28} />
          </Link>
        </div>
      </nav>

      <div className="flex-1 max-w-screen-md mx-auto px-5 py-8">
        <h1
          className="text-2xl font-bold text-primary mb-6"
          style={{ fontFamily: 'var(--font-sans)', fontWeight: 900, letterSpacing: '-0.02em' }}
        >
          Privacy Policy
        </h1>

        <div className="prose prose-sm text-secondary leading-relaxed space-y-6">
          <p><strong>Ultimo aggiornamento:</strong> Aprile 2026</p>

          <h2 className="text-lg font-semibold text-primary">1. Titolare del trattamento</h2>
          <p>
            Il titolare del trattamento dei dati è ChiamamiBi, contattabile all'indirizzo email:
            <a href="mailto:info@chiamamibi.com" className="text-accent"> info@chiamamibi.com</a>
          </p>

          <h2 className="text-lg font-semibold text-primary">2. Dati raccolti</h2>
          <p>Raccogliamo i seguenti dati personali:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Dati di registrazione:</strong> nome, indirizzo email</li>
            <li><strong>Dati di navigazione:</strong> indirizzo IP, tipo di browser, pagine visitate</li>
            <li><strong>Dati di geolocalizzazione:</strong> posizione GPS (solo con consenso esplicito)</li>
            <li><strong>Contenuti generati:</strong> ristoranti salvati</li>
            <li><strong>Dati di utilizzo sconti:</strong> codici QR generati e utilizzati</li>
          </ul>

          <h2 className="text-lg font-semibold text-primary">3. Finalità del trattamento</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Erogazione del servizio di scoperta ristoranti</li>
            <li>Gestione dell'account utente e delle preferenze</li>
            <li>Gestione del sistema sconti e QR code</li>
            <li>Invio della newsletter (con consenso)</li>
            <li>Miglioramento del servizio e analisi aggregate</li>
          </ul>

          <h2 className="text-lg font-semibold text-primary">4. Base giuridica</h2>
          <p>
            Il trattamento si basa su: consenso dell'interessato (Art. 6(1)(a) GDPR),
            esecuzione di un contratto (Art. 6(1)(b) GDPR), legittimo interesse (Art. 6(1)(f) GDPR).
          </p>

          <h2 className="text-lg font-semibold text-primary">5. Sub-processori</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Supabase</strong> (database, autenticazione) — UE</li>
            <li><strong>Vercel</strong> (hosting) — Global CDN</li>
            <li><strong>Mapbox</strong> (mappe) — USA</li>
            <li><strong>Google</strong> (OAuth, Places API) — USA</li>
            <li><strong>Anthropic</strong> (traduzione AI contenuti) — USA</li>
          </ul>

          <h2 className="text-lg font-semibold text-primary">6. Diritti dell'interessato</h2>
          <p>Ai sensi degli articoli 15-22 del GDPR, hai diritto a:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Accesso:</strong> ottenere conferma e copia dei tuoi dati</li>
            <li><strong>Rettifica:</strong> correggere dati inesatti</li>
            <li><strong>Cancellazione:</strong> richiedere la rimozione dei tuoi dati</li>
            <li><strong>Portabilità:</strong> ricevere i tuoi dati in formato leggibile</li>
            <li><strong>Opposizione:</strong> opporti al trattamento per legittimo interesse</li>
            <li><strong>Revoca del consenso:</strong> in qualsiasi momento</li>
          </ul>
          <p>
            Per esercitare i tuoi diritti, puoi utilizzare le funzioni nel tuo profilo
            o scrivere a <a href="mailto:info@chiamamibi.com" className="text-accent">info@chiamamibi.com</a>.
          </p>

          <h2 className="text-lg font-semibold text-primary">7. Conservazione dei dati</h2>
          <p>
            I dati personali vengono conservati per il tempo necessario alle finalità per cui sono stati raccolti.
            Alla cancellazione dell'account, tutti i dati vengono rimossi entro 30 giorni.
          </p>

          <h2 className="text-lg font-semibold text-primary">8. Cookie</h2>
          <p>
            Utilizziamo solo cookie tecnici necessari al funzionamento del servizio e cookie
            analitici anonimi. Nessun cookie di profilazione viene installato senza il tuo consenso.
          </p>

          <h2 className="text-lg font-semibold text-primary">9. Età minima</h2>
          <p>
            Il servizio è rivolto a persone di età pari o superiore a 16 anni.
          </p>

          <h2 className="text-lg font-semibold text-primary">10. Contatti</h2>
          <p>
            Per domande sulla privacy: <a href="mailto:info@chiamamibi.com" className="text-accent">info@chiamamibi.com</a>
          </p>
        </div>
      </div>

      <Footer />
    </div>
  )
}
