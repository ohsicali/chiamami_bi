import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/hooks/useAuth'
import { useActiveDiscounts } from '../../lib/hooks/useDiscounts'
import { prewarmExplore } from '../../lib/prewarmExplore'

const TAB_BAR_HEIGHT = 68

// Filled black SVG icons (fill: currentColor, stroke: none).
// ExploreIcon e DealsIcon usano fillRule="evenodd" per bucare i cerchi interni.
const HomeIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 11l9-8 9 8v10a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2V11z" />
  </svg>
)

// Il cerchio interno è "bucato" via fillRule evenodd — nessun fill="#fff" fisso
const ExploreIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" clipRule="evenodd" aria-hidden="true">
    <path d="M12 2c-4 0-7 3-7 7 0 5.2 7 13 7 13s7-7.8 7-13c0-4-3-7-7-7z M12 11.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8z" />
  </svg>
)

// Icona tag/etichetta filled — classica per "sconti/deals", con il buco in alto a sinistra
const DealsIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" fillRule="evenodd" clipRule="evenodd" aria-hidden="true">
    <path d="M2 2h10l8.59 8.59a2 2 0 0 1 0 2.82l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2z M7 5.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
  </svg>
)

const SavedIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
)

const ProfileIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4.4 0-8 2.5-8 6v2h16v-2c0-3.5-3.6-6-8-6z" />
  </svg>
)

export { TAB_BAR_HEIGHT }

// Il vetro è solo CSS (`.bottom-nav` in globals.css), uguale su iPhone e
// Android. Fino al 29/09 su Android sopra c'era liquidGL: un canvas WebGL a
// tutto schermo ridisegnato a ogni fotogramma e, sotto, html2canvas che
// fotografava l'intera pagina al caricamento, a ogni cambio di pagina e a
// ogni cambio d'altezza del body (1,5 s + 2,5 s di processore misurati sulla
// home con un telefono medio). Un tocco che capitava in mezzo aspettava:
// l'INP su Android era 0,4 s. Non rimetterlo.

export default function MobileTabBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { discounts } = useActiveDiscounts()

  const path = location.pathname

  const isHome = path === '/'
  const isExplore = path === '/esplora' || path === '/list' || path.startsWith('/restaurant/')
  const isDeals = path === '/sconti' || path === '/deals'
  const isSaved = path === '/saved'
  const isProfile = path === '/profile' || path === '/settings'

  const hasActiveDrop = Array.isArray(discounts) && discounts.length > 0

  const tabs = [
    { key: 'home', label: 'Home', href: '/', Icon: HomeIcon, active: isHome, onClick: () => navigate('/') },
    { key: 'explore', label: 'Esplora', href: '/esplora', Icon: ExploreIcon, active: isExplore, onClick: () => navigate('/esplora') },
    { key: 'deals', label: 'Sconti', href: '/sconti', Icon: DealsIcon, active: isDeals, badge: hasActiveDrop, onClick: () => navigate('/sconti') },
    // Chi non è registrato tocca "Salvati" e finisce sul login: gli si dice
    // perché (`reason`) e da dove riprendere dopo (`returnTo`), altrimenti
    // legge "Bentornato" senza aver mai avuto un account e poi si ritrova in
    // home invece che nella sezione che voleva aprire.
    { key: 'saved', label: 'Salvati', href: '/saved', Icon: SavedIcon, active: isSaved, onClick: () => (user ? navigate('/saved') : navigate('/login', { state: { returnTo: '/saved', reason: 'saved', mode: 'register' } })) },
    { key: 'profile', label: 'Profilo', href: '/profile', Icon: ProfileIcon, active: isProfile, onClick: () => (user ? navigate('/profile') : navigate('/login', { state: { returnTo: '/profile', reason: 'profile', mode: 'register' } })) },
  ]

  return (
    <nav
      className="bottom-nav md:hidden"
      aria-label="Navigazione principale"
    >
      {/* Link veri (<a href>) e non bottoni: Google guarda il sito da
          telefono e segue solo i link, e questa barra è l'unico posto della
          home mobile che porta a Esplora e Sconti — senza, non le trovava
          come sezioni del sito. Il clic resta nostro (navigate, login per
          Salvati e Profilo); Cmd/Ctrl-clic apre in un'altra scheda. */}
      {tabs.map((tab) => (
        <a
          key={tab.key}
          href={tab.href}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
            e.preventDefault()
            tab.onClick()
          }}
          // Al primo contatto col dito su Esplora la mappa comincia a
          // prepararsi, prima ancora che il tocco diventi un click.
          onPointerDown={tab.key === 'explore' ? prewarmExplore : undefined}
          className={`nav-item${tab.active ? ' active' : ''}`}
          aria-label={tab.label}
          aria-current={tab.active ? 'page' : undefined}
          title={tab.label}
        >
          <span className="nav-icon-wrap">
            <tab.Icon />
            {tab.badge && <span className="nav-badge" aria-hidden="true" />}
          </span>
          <span className="nav-label">{tab.label}</span>
        </a>
      ))}
    </nav>
  )
}
