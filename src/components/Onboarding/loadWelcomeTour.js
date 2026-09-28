/**
 * Il chunk del tutorial, in un posto solo: lo usano il Gate (lazy) e la
 * pagina di login, che lo scarica mentre si scrive il codice di conferma —
 * così quando il codice passa il tutorial parte subito, senza un attimo di
 * vuoto ad aspettare la rete.
 */
export const loadWelcomeTour = () => import('./WelcomeTour')

export function preloadWelcomeTour() {
  loadWelcomeTour().catch(() => {})
}
