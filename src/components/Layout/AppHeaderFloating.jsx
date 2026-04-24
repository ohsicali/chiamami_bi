// AppHeaderFloating — header floating pill signature Bi (stile home, montato
// globalmente in App.jsx). PR19 richiede un componente shared con nome esplicito
// per Esplora desktop; DesktopNavbar gia' implementa il pattern (sticky top,
// backdrop-blur, border-radius 999, max-width 1240, padding 0 40), quindi qui
// facciamo un re-export per usare il nome canonico negli step successivi.
//
// Scope ristretto PR19: non rimpiazzare DesktopNavbar in App.jsx, non cambiarne
// lo stile. Augusto puo' in futuro rinominare/rimuovere il file originale senza
// rompere il resto del sito.

export { default } from './DesktopNavbar'
