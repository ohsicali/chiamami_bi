import Footer from '../../components/Layout/Footer'
import LegalHeader from '../../components/Layout/LegalHeader'
import LegalSection from '../../components/Layout/LegalSection'
import MetaTags from '../../components/SEO/MetaTags'

const linkStyle = { color: 'var(--color-corallo-ink)', fontWeight: 600, textDecoration: 'underline' }

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh md:min-h-[calc(100dvh-80px)] flex flex-col" style={{ background: 'var(--color-page)' }}>
      <MetaTags
        title="Privacy Policy — ChiamamiBi"
        description="Informativa sulla privacy di ChiamamiBi: come trattiamo i dati personali in conformità al GDPR."
        url="https://chiamamibi.com/privacy"
        canonical="https://chiamamibi.com/privacy"
      />
      <LegalHeader />

      <div className="flex-1 max-w-screen-md mx-auto w-full px-5 py-8 md:py-12">
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
          color: 'var(--color-corallo-ink)', marginBottom: 8,
        }}>
          Documento legale
        </div>
        <h1
          className="text-primary"
          style={{
            fontFamily: 'var(--font-sans)', fontWeight: 900, letterSpacing: '-0.025em',
            fontSize: 32, lineHeight: 1.08, margin: 0,
          }}
        >
          Privacy Policy
        </h1>
        <p style={{ color: 'var(--color-ink-55)', fontSize: 13.5, marginTop: 10, marginBottom: 28 }}>
          Come raccogliamo e trattiamo i tuoi dati personali, in conformità al GDPR.
          <br />
          <strong style={{ color: 'var(--color-ink-70)' }}>Ultimo aggiornamento:</strong> Aprile 2026
        </p>

        <div className="flex flex-col gap-3.5">
          <LegalSection n={1} title="Titolare del trattamento">
            <p>
              Il titolare del trattamento dei dati è ChiamamiBi, contattabile all'indirizzo email{' '}
              <a href="mailto:info@chiamamibi.com" style={linkStyle}>info@chiamamibi.com</a>.
            </p>
          </LegalSection>

          <LegalSection n={2} title="Dati raccolti">
            <p>Raccogliamo i seguenti dati personali:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong style={{ color: 'var(--color-ink)' }}>Dati di registrazione:</strong> nome, indirizzo email</li>
              <li><strong style={{ color: 'var(--color-ink)' }}>Dati di navigazione:</strong> indirizzo IP, tipo di browser, pagine visitate</li>
              <li><strong style={{ color: 'var(--color-ink)' }}>Dati di geolocalizzazione:</strong> posizione GPS (solo con consenso esplicito)</li>
              <li><strong style={{ color: 'var(--color-ink)' }}>Contenuti generati:</strong> ristoranti salvati</li>
              <li><strong style={{ color: 'var(--color-ink)' }}>Dati di utilizzo sconti:</strong> codici QR generati e utilizzati</li>
            </ul>
          </LegalSection>

          <LegalSection n={3} title="Finalità del trattamento">
            <ul className="list-disc pl-5 space-y-1">
              <li>Erogazione del servizio di scoperta ristoranti</li>
              <li>Gestione dell'account utente e delle preferenze</li>
              <li>Gestione del sistema sconti e QR code</li>
              <li>Invio della newsletter (con consenso)</li>
              <li>Miglioramento del servizio e analisi aggregate</li>
            </ul>
          </LegalSection>

          <LegalSection n={4} title="Base giuridica">
            <p>
              Il trattamento si basa su: consenso dell'interessato (Art. 6(1)(a) GDPR),
              esecuzione di un contratto (Art. 6(1)(b) GDPR), legittimo interesse (Art. 6(1)(f) GDPR).
            </p>
          </LegalSection>

          <LegalSection n={5} title="Sub-processori">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong style={{ color: 'var(--color-ink)' }}>Supabase</strong> (database, autenticazione) — UE</li>
              <li><strong style={{ color: 'var(--color-ink)' }}>Vercel</strong> (hosting) — Global CDN</li>
              <li><strong style={{ color: 'var(--color-ink)' }}>Mapbox</strong> (mappe) — USA</li>
              <li><strong style={{ color: 'var(--color-ink)' }}>Google</strong> (OAuth, Places API) — USA</li>
              <li><strong style={{ color: 'var(--color-ink)' }}>Anthropic</strong> (traduzione AI contenuti) — USA</li>
            </ul>
          </LegalSection>

          <LegalSection n={6} title="Diritti dell'interessato">
            <p>Ai sensi degli articoli 15-22 del GDPR, hai diritto a:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong style={{ color: 'var(--color-ink)' }}>Accesso:</strong> ottenere conferma e copia dei tuoi dati</li>
              <li><strong style={{ color: 'var(--color-ink)' }}>Rettifica:</strong> correggere dati inesatti</li>
              <li><strong style={{ color: 'var(--color-ink)' }}>Cancellazione:</strong> richiedere la rimozione dei tuoi dati</li>
              <li><strong style={{ color: 'var(--color-ink)' }}>Portabilità:</strong> ricevere i tuoi dati in formato leggibile</li>
              <li><strong style={{ color: 'var(--color-ink)' }}>Opposizione:</strong> opporti al trattamento per legittimo interesse</li>
              <li><strong style={{ color: 'var(--color-ink)' }}>Revoca del consenso:</strong> in qualsiasi momento</li>
            </ul>
            <p>
              Per esercitare i tuoi diritti, puoi utilizzare le funzioni nel tuo profilo
              o scrivere a <a href="mailto:info@chiamamibi.com" style={linkStyle}>info@chiamamibi.com</a>.
            </p>
          </LegalSection>

          <LegalSection n={7} title="Conservazione dei dati">
            <p>
              I dati personali vengono conservati per il tempo necessario alle finalità per cui sono stati raccolti.
              Alla cancellazione dell'account, tutti i dati vengono rimossi entro 30 giorni.
            </p>
          </LegalSection>

          <LegalSection n={8} title="Cookie">
            <p>
              Utilizziamo solo cookie tecnici necessari al funzionamento del servizio e cookie
              analitici anonimi. Nessun cookie di profilazione viene installato senza il tuo consenso.
            </p>
          </LegalSection>

          <LegalSection n={9} title="Età minima">
            <p>Il servizio è rivolto a persone di età pari o superiore a 16 anni.</p>
          </LegalSection>

          <LegalSection n={10} title="Contatti">
            <p>
              Per domande sulla privacy: <a href="mailto:info@chiamamibi.com" style={linkStyle}>info@chiamamibi.com</a>
            </p>
          </LegalSection>
        </div>
      </div>

      <Footer />
    </div>
  )
}
