import { Link } from 'react-router-dom'
import { LogoFull } from '../../components/UI/Logo'
import Footer from '../../components/Layout/Footer'

export default function TermsPage() {
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
          style={{ fontFamily: "'TAN Songbird', serif" }}
        >
          Termini di Servizio
        </h1>

        <div className="prose prose-sm text-secondary leading-relaxed space-y-6">
          <p><strong>Ultimo aggiornamento:</strong> Marzo 2026</p>

          <h2 className="text-lg font-semibold text-primary">1. Accettazione dei termini</h2>
          <p>
            Utilizzando La Guida di Bi (di seguito anche "ChiamamiBi") accetti i presenti Termini di Servizio. Se non li accetti,
            ti preghiamo di non utilizzare il servizio.
          </p>

          <h2 className="text-lg font-semibold text-primary">2. Descrizione del servizio</h2>
          <p>
            ChiamamiBi è una piattaforma web che offre consigli personalizzati su ristoranti,
            bar e locali a Torino. Il servizio include la scoperta di locali, il sistema di
            sconti esclusivi e la possibilità di salvare i propri posti preferiti.
          </p>

          <h2 className="text-lg font-semibold text-primary">3. Account utente</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>La registrazione richiede un indirizzo email valido</li>
            <li>Sei responsabile della sicurezza del tuo account</li>
            <li>Puoi cancellare il tuo account in qualsiasi momento dal profilo</li>
          </ul>

          <h2 className="text-lg font-semibold text-primary">4. Contenuti degli utenti</h2>
          <p>
            Pubblicando recensioni o foto su ChiamamiBi, concedi una licenza non esclusiva
            per la visualizzazione dei contenuti sulla piattaforma. I contenuti devono essere
            veritieri, rispettosi e non violare diritti di terzi.
          </p>
          <p>Ci riserviamo il diritto di rimuovere contenuti che violino queste linee guida.</p>

          <h2 className="text-lg font-semibold text-primary">5. Sistema sconti</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Gli sconti sono soggetti a disponibilità e condizioni specifiche</li>
            <li>Ogni sconto può essere utilizzato una sola volta</li>
            <li>Gli sconti hanno una data di scadenza</li>
            <li>ChiamamiBi non è responsabile per eventuali disservizi del ristorante</li>
          </ul>

          <h2 className="text-lg font-semibold text-primary">6. Proprietà intellettuale</h2>
          <p>
            I contenuti editoriali di ChiamamiBi (recensioni di Bi, fotografie, design)
            sono protetti dal diritto d'autore. È vietata la riproduzione senza autorizzazione.
          </p>

          <h2 className="text-lg font-semibold text-primary">7. Limitazione di responsabilità</h2>
          <p>
            ChiamamiBi fornisce informazioni a scopo orientativo. Non garantiamo l'accuratezza
            di orari, prezzi o disponibilità dei ristoranti. Le opinioni espresse sono personali
            e soggettive.
          </p>

          <h2 className="text-lg font-semibold text-primary">8. Età minima</h2>
          <p>
            Il servizio è rivolto a persone di età pari o superiore a 16 anni.
            Utilizzando il servizio, confermi di avere almeno 16 anni.
          </p>

          <h2 className="text-lg font-semibold text-primary">9. Modifiche ai termini</h2>
          <p>
            Ci riserviamo il diritto di modificare questi termini. Le modifiche saranno
            comunicate tramite il sito e, per gli utenti registrati, via email.
          </p>

          <h2 className="text-lg font-semibold text-primary">10. Legge applicabile</h2>
          <p>
            I presenti termini sono regolati dalla legge italiana.
            Per controversie è competente il Foro di Torino.
          </p>

          <h2 className="text-lg font-semibold text-primary">11. Contatti</h2>
          <p>
            Per domande: <a href="mailto:info@chiamamibi.com" className="text-accent">info@chiamamibi.com</a>
          </p>
        </div>
      </div>

      <Footer />
    </div>
  )
}
