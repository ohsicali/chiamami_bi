import BiLogoMark from '../UI/BiLogoMark'

/**
 * Avviso a tutto schermo mentre il sito è in manutenzione
 * (interruttore in src/lib/siteMaintenance.js).
 */
export default function SiteMaintenance() {
  return (
    <main
      role="main"
      className="min-h-screen bg-bg flex flex-col items-center justify-center px-6 py-12 text-center"
      style={{ paddingTop: 'max(3rem, env(safe-area-inset-top))', paddingBottom: 'max(3rem, env(safe-area-inset-bottom))' }}
    >
      <div
        className="flex items-center justify-center rounded-full bg-accent text-white mb-7"
        style={{ width: 88, height: 88 }}
      >
        <BiLogoMark style={{ width: '78%', height: '78%' }} />
      </div>
      <h1 className="text-2xl font-bold text-primary mb-3" style={{ maxWidth: 420 }}>
        Stiamo risolvendo alcuni problemi tecnici
      </h1>
      <p className="text-base text-secondary mb-2" style={{ maxWidth: 420, lineHeight: 1.5 }}>
        Il sito è momentaneamente non disponibile. Ci stiamo lavorando e torniamo online il prima possibile.
      </p>
      <p className="text-base text-secondary mb-8" style={{ maxWidth: 420, lineHeight: 1.5 }}>
        Scusaci per il disagio, a prestissimo!
      </p>
      <p className="text-sm text-secondary" style={{ maxWidth: 420, opacity: 0.8 }}>
        We&rsquo;re fixing some technical issues — we&rsquo;ll be back online shortly.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-8 px-5 py-2.5 rounded-xl bg-accent text-white text-sm font-medium"
      >
        Riprova
      </button>
    </main>
  )
}

/** Promemoria per l'admin: il sito che sta guardando gli altri non lo vedono. */
export function SiteMaintenanceAdminBadge() {
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 'calc(84px + env(safe-area-inset-bottom))',
        transform: 'translateX(-50%)',
        zIndex: 55,
        background: '#22181C',
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        padding: '6px 12px',
        borderRadius: 999,
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
      }}
    >
      🔧 Sito in manutenzione · lo vedi solo tu
    </div>
  )
}
