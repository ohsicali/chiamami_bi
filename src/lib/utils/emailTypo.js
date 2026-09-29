/**
 * "Intendevi …@libero.it?" — il dominio dell'email scritto male.
 *
 * Chi sbaglia una lettera nel dominio (gmsil.com, libeto.it) si registra lo
 * stesso: Supabase accetta l'indirizzo e manda il codice di conferma in un
 * posto che non esiste. La persona aspetta un'email che non arriverà mai.
 * Il 29/09, fra i 21 account degli ultimi otto giorni mai confermati, tre
 * erano così: libeto.it, gmsil.com, libero.com.
 *
 * Solo un suggerimento: se il dominio è giusto (un'email aziendale, un
 * provider che non conosciamo) non cambiamo niente e non blocchiamo nessuno.
 */

// Provider che esistono con un solo dominio: gmail.it, libero.com e simili
// non ricevono posta, quindi qualsiasi altra estensione è un errore.
const SINGLE_TLD = {
  gmail: 'gmail.com',
  googlemail: 'googlemail.com',
  libero: 'libero.it',
  icloud: 'icloud.com',
  virgilio: 'virgilio.it',
  alice: 'alice.it',
  tiscali: 'tiscali.it',
  fastwebnet: 'fastwebnet.it',
}

// Domini veri e comuni in Italia. Un dominio che è qui non viene mai corretto.
const KNOWN = [
  'gmail.com', 'googlemail.com', 'libero.it', 'icloud.com', 'me.com', 'mac.com',
  'hotmail.it', 'hotmail.com', 'outlook.it', 'outlook.com', 'live.it', 'live.com',
  'msn.com', 'yahoo.it', 'yahoo.com', 'virgilio.it', 'alice.it', 'tiscali.it',
  'fastwebnet.it', 'tim.it', 'tin.it', 'inwind.it', 'email.it', 'protonmail.com',
  'proton.me', 'aol.com', 'poste.it', 'pec.it',
]

// Estensioni che non esistono e sono a un tasto da quelle vere.
const TLD_TYPOS = {
  con: 'com', cmo: 'com', cpm: 'com', vom: 'com', xom: 'com', ocm: 'com', comm: 'com', coom: 'com',
  ti: 'it', itt: 'it', iy: 'it', ot: 'it',
}

function distance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = up
    }
  }
  return prev[b.length]
}

/**
 * Restituisce l'indirizzo corretto, o `null` se non c'è niente da dire.
 */
export function suggestEmailFix(email) {
  const at = String(email || '').trim().toLowerCase().lastIndexOf('@')
  if (at < 1) return null
  const clean = String(email).trim()
  const local = clean.slice(0, at)
  const domain = clean.slice(at + 1).toLowerCase()
  // Dominio non ancora finito ("gmail", "gmail.c"): niente da suggerire.
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(domain)) return null
  if (KNOWN.includes(domain)) return null

  // 0) estensione sbagliata, su qualsiasi dominio: .con, .cmo, .ti
  const tld = domain.slice(domain.lastIndexOf('.') + 1)
  if (TLD_TYPOS[tld]) {
    const fixed = `${local}@${domain.slice(0, domain.lastIndexOf('.') + 1)}${TLD_TYPOS[tld]}`
    return suggestEmailFix(fixed) || fixed
  }

  // 1) nome del provider giusto (o quasi), estensione sbagliata: libero.com
  const dot = domain.indexOf('.')
  const name = domain.slice(0, dot)
  for (const [provider, canonical] of Object.entries(SINGLE_TLD)) {
    if (distance(name, provider) <= (provider.length >= 6 ? 1 : 0)) {
      return canonical === domain ? null : `${local}@${canonical}`
    }
  }

  // 2) una o due lettere sbagliate nel dominio intero: gmsil.com, hotmial.it
  let best = null
  let bestDist = Infinity
  for (const known of KNOWN) {
    const d = distance(domain, known)
    if (d < bestDist) { best = known; bestDist = d }
  }
  // Sui domini corti una lettera cambia tutto (tim.it / tin.it sono veri
  // tutti e due): lì si corregge solo con una differenza sola.
  const max = best && best.length >= 9 ? 2 : 1
  if (!(bestDist >= 1 && bestDist <= max)) return null
  // Stesso provider, altra estensione: hotmail.fr, yahoo.es, outlook.de
  // esistono davvero. Quelli con un'estensione sola li ha già presi il punto 1.
  if (best.slice(0, best.indexOf('.')) === name) return null
  return `${local}@${best}`
}
