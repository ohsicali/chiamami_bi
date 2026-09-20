import Footer from '../../components/Layout/Footer'
import LegalHeader from '../../components/Layout/LegalHeader'
import LegalSection from '../../components/Layout/LegalSection'
import MetaTags from '../../components/SEO/MetaTags'

const linkStyle = { color: 'var(--color-corallo-ink)', fontWeight: 600, textDecoration: 'underline' }

export default function TermsPage() {
  return (
    <div className="min-h-dvh md:min-h-[calc(100dvh-80px)] flex flex-col" style={{ background: 'var(--color-page)' }}>
      <MetaTags
        title="Termini e Condizioni — ChiamamiBi"
        description="Termini di utilizzo del servizio ChiamamiBi: regole di accesso, contenuti, sconti e responsabilità."
        url="https://chiamamibi.com/terms"
        canonical="https://chiamamibi.com/terms"
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
          Termini di Servizio
        </h1>
        <p style={{ color: 'var(--color-ink-55)', fontSize: 13.5, marginTop: 10, marginBottom: 28 }}>
          Le regole d'uso di ChiamamiBi: accesso, contenuti, sconti e responsabilità.
          <br />
          <strong style={{ color: 'var(--color-ink-70)' }}>Ultimo aggiornamento:</strong> Marzo 2026
        </p>

        <div className="flex flex-col gap-3.5">
          <LegalSection n={1} title="Accettazione dei termini">
            <p>
              Utilizzando ChiamamiBi accetti i presenti Termini di Servizio. Se non li accetti,
              ti preghiamo di non utilizzare il servizio.
            </p>
          </LegalSection>

          <LegalSection n={2} title="Descrizione del servizio">
            <p>
              ChiamamiBi è una piattaforma web che offre consigli personalizzati su ristoranti,
              bar e locali a Torino. Il servizio include la scoperta di locali, il sistema di
              sconti esclusivi e la possibilità di salvare i propri posti preferiti.
            </p>
          </LegalSection>

          <LegalSection n={3} title="Account utente">
            <ul className="list-disc pl-5 space-y-1">
              <li>La registrazione richiede un indirizzo email valido</li>
              <li>Sei responsabile della sicurezza del tuo account</li>
              <li>Puoi cancellare il tuo account in qualsiasi momento dal profilo</li>
            </ul>
          </LegalSection>

          <LegalSection n={4} title="Segnalazioni">
            <p>
              ChiamamiBi non pubblica contenuti generati dagli utenti (recensioni, foto).
              Tutti i contenuti pubblici sono prodotti dalla redazione. Puoi segnalare
              errori o imprecisioni via email a <a href="mailto:info@chiamamibi.com" style={linkStyle}>info@chiamamibi.com</a>.
            </p>
          </LegalSection>

          <LegalSection n={5} title="Sistema sconti">
            <ul className="list-disc pl-5 space-y-1">
              <li>Gli sconti sono soggetti a disponibilità e condizioni specifiche</li>
              <li>Ogni sconto può essere utilizzato una sola volta</li>
              <li>Gli sconti hanno una data di scadenza</li>
              <li>ChiamamiBi non è responsabile per eventuali disservizi del ristorante</li>
            </ul>
          </LegalSection>

          <LegalSection n={6} title="Proprietà intellettuale">
            <p>
              I contenuti editoriali di ChiamamiBi (recensioni di Bi, fotografie, design)
              sono protetti dal diritto d'autore. È vietata la riproduzione senza autorizzazione.
            </p>
          </LegalSection>

          <LegalSection n={7} title="Limitazione di responsabilità">
            <p>
              ChiamamiBi fornisce informazioni a scopo orientativo. Non garantiamo l'accuratezza
              di orari, prezzi o disponibilità dei ristoranti. Le opinioni espresse sono personali
              e soggettive.
            </p>
          </LegalSection>

          <LegalSection n={8} title="Età minima">
            <p>
              Il servizio è rivolto a persone di età pari o superiore a 16 anni.
              Utilizzando il servizio, confermi di avere almeno 16 anni.
            </p>
          </LegalSection>

          <LegalSection n={9} title="Modifiche ai termini">
            <p>
              Ci riserviamo il diritto di modificare questi termini. Le modifiche saranno
              comunicate tramite il sito e, per gli utenti registrati, via email.
            </p>
          </LegalSection>

          <LegalSection n={10} title="Legge applicabile">
            <p>
              I presenti termini sono regolati dalla legge italiana.
              Per controversie è competente il Foro di Torino.
            </p>
          </LegalSection>

          <LegalSection n={11} title="Contatti">
            <p>
              Per domande: <a href="mailto:info@chiamamibi.com" style={linkStyle}>info@chiamamibi.com</a>
            </p>
          </LegalSection>
        </div>
      </div>

      <Footer />
    </div>
  )
}
