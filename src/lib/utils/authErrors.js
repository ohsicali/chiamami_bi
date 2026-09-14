/**
 * Da errore di Supabase a frase che una persona capisce.
 *
 * `err.message` arriva dal server ed è in inglese e tecnico: "Failed to
 * fetch", "Error sending confirmation email", "User already registered".
 * Mostrarlo così in pagina lascia chi legge senza sapere né cosa è successo
 * né cosa fare. Qui ogni caso noto diventa una frase in italiano che dice
 * anche la mossa successiva; quello che non riconosciamo non lo mostriamo
 * affatto, perché una stringa inglese a caso è peggio di un messaggio
 * generico.
 */

// Chiave (minuscola, come sottostringa del messaggio) → frase da mostrare.
const KNOWN = [
  ['invalid login credentials', 'Email o password non corretti.'],
  ['email not confirmed', 'Devi prima confermare l’email: controlla la posta, anche nello spam.'],
  ['user already registered', 'Esiste già un account con questa email. Prova ad accedere.'],
  ['already registered', 'Esiste già un account con questa email. Prova ad accedere.'],
  ['password should be at least', 'La password è troppo corta: servono almeno 6 caratteri.'],
  ['unable to validate email address', 'Questo indirizzo email non sembra valido.'],
  ['invalid email', 'Questo indirizzo email non sembra valido.'],
  ['for security purposes, you can only request this once every 60 seconds',
    'Per sicurezza puoi riprovare fra un minuto.'],
  ['email rate limit exceeded', 'Troppi tentativi ravvicinati. Riprova fra qualche minuto.'],
  ['over_email_send_rate_limit', 'Troppi tentativi ravvicinati. Riprova fra qualche minuto.'],
  ['token has expired', 'Il codice è scaduto. Richiedine uno nuovo.'],
  ['invalid token', 'Il codice non è corretto. Controlla e riprova.'],
  // La posta di Supabase non riesce a partire (credenziali SMTP rifiutate,
  // provider giù): non è colpa di chi si sta registrando e non c'è niente
  // che possa fare riprovando subito.
  ['error sending confirmation email', 'Non riusciamo a inviare l’email di conferma: è un problema nostro, non tuo. Riprova più tardi o scrivici a info@chiamamibi.com.'],
  ['error sending recovery email', 'Non riusciamo a inviare l’email di recupero: è un problema nostro, non tuo. Riprova più tardi o scrivici a info@chiamamibi.com.'],
  ['error sending', 'Non riusciamo a inviare l’email: è un problema nostro, non tuo. Riprova più tardi o scrivici a info@chiamamibi.com.'],
  // La richiesta è partita e non è mai tornata: `withTimeout` in useAuth la
  // chiude dopo 20 secondi, se no il bottone resterebbe in attesa per sempre.
  ['auth request timed out', 'Ci sta mettendo troppo: la rete non risponde. Riprova fra qualche secondo.'],
  // Fetch fallita = niente rete, o il nostro server non risponde.
  ['failed to fetch', 'Connessione assente. Controlla la rete e riprova.'],
  ['networkerror', 'Connessione assente. Controlla la rete e riprova.'],
  ['network request failed', 'Connessione assente. Controlla la rete e riprova.'],
  ['load failed', 'Connessione assente. Controlla la rete e riprova.'],
]

export function authErrorMessage(err, fallback = 'Qualcosa non ha funzionato. Riprova.') {
  const raw = String(err?.message || err || '').toLowerCase()
  if (!raw) return fallback
  for (const [needle, message] of KNOWN) {
    if (raw.includes(needle)) return message
  }
  // Un 5xx generico è comunque un problema nostro: diciamolo.
  if (err?.status >= 500 || raw.includes('unexpected_failure')) {
    return 'Il servizio non risponde in questo momento. È un problema nostro: riprova fra poco.'
  }
  return fallback
}
