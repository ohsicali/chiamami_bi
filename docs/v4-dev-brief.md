# Chiamami Bi v4 — brief per il dev (Claude Code)

> Lascia questo file dove lo trovi. Leggi tutto prima di proporre un plan.

---

## Contesto in 30 secondi

**chiamami.bi** è una **guida curata** ai ristoranti di Torino. Non è TripAdvisor, non è Google Maps. Il valore è la selezione: chi entra in Guida è stato validato da Augusto/Bi, niente recensioni utente, niente stelline.

- **Live in produzione:** chiamamibi.com (React + Vite + Vercel + Supabase + Mapbox)
- **71 ristoranti** già in DB, **4 utenti** (fase early)
- **PIN-auth ristoratore** già in prod su `/verify`
- **Mancano:** reskin v4, orari Google Places sulla scheda, sistema email (Resend), disattivazione recensioni

Stai lavorando a una **evoluzione v4 su prodotto live** — non green-field. Respect del codice esistente, zero migrazioni distruttive.

---

## Cosa c'è in questo repo + cosa legge prima di partire

File che trovi in `docs/` (o nella cartella da cui leggi questo brief):

| File | Cosa contiene | Quando leggerlo |
|---|---|---|
| `v4-pre-handoff.md` | **Gap analysis completa.** Scope v4, stato attuale live, rischi, decisioni chiuse, legacy da gestire. | Prima di tutto. È la mappa. |
| `v4-email-manifesto.md` | Voce di Bi per email + 4 email plug-and-play (benvenuto ristoratore + PIN, conferma suggerimento, notifica interna, newsletter) + template HTML con token v4. | Quando lavori su track email. |
| `v4-ops-google-places.md` | Setup Google Places API (fatto da Augusto). Utile come reference se il dev deve generare chiavi ulteriori. | Raramente. |
| `v4-ops-resend.md` | Setup Resend (fatto da Augusto). Reference per domini verificati/DNS. | Raramente. |
| `v4-*.html` (mockup) | Mockup high-fidelity HTML di tutte le schermate v4 (mobile + desktop: home, scheda, esplora, sconti, salvati, profilo, verify, admin). | Reference visuale per il reskin. Non sono codice da portare in prod, sono specifiche. |

**First move:** leggi `v4-pre-handoff.md` interamente, poi torna qui.

---

## Stack confermato (NON introdurre dipendenze nuove senza chiedere)

- **Frontend:** React + Vite + Tailwind (o CSS-in-JS esistente — verifica nel repo)
- **Hosting:** Vercel
- **Backend:** Supabase (project id: `urcwnontifybzugmmiov`)
- **Auth ristoratore:** PIN 6-cifre custom + cookie `verify_device_token` (NON Supabase Auth)
- **Mappe:** Mapbox GL
- **Email:** Resend (dominio `chiamamibi.com` verificato EU-west-1)
- **External API:** Google Places API (New) per orari

---

## Variabili d'ambiente che ti servono

Verifica che esistano in Vercel → Project Settings → Environment Variables. Se mancanti, chiedi a Augusto:

```env
# Supabase (già presenti)
VITE_SUPABASE_URL=https://urcwnontifybzugmmiov.supabase.co
VITE_SUPABASE_ANON_KEY=...

# Mapbox (già presente)
VITE_MAPBOX_TOKEN=...

# Google Places API (da configurare — Augusto ha la chiave)
VITE_GOOGLE_PLACES_KEY=AIzaSy...
# Nota: questa chiave è referrer-restricted su chiamamibi.com + *.vercel.app + localhost,
# quindi è safe nel bundle frontend

# Resend (da configurare — Augusto ha la chiave)
RESEND_API_KEY=re_...
# Nota: server-side only, NON prefissare con VITE_
```

---

## Scope v4 — tre tracce, tre livelli di priorità

Non c'è un ordine imposto. Organizza tu il piano in funzione di dipendenze, rischio, e context switching. Proponi un plan a Augusto prima di partire.

### Track A — Compliance & cleanup (P0 legale)

Blocco legale attuale: il live ha un sistema recensioni/foto utenti attivo nel backend, menzionato nella Privacy Policy, ma non più desiderato. Va disattivato.

- **A1** Disattivare scrittura recensioni e upload foto utenti a livello di **API/endpoint/RLS Supabase** (non solo nascondere la UI)
- **A2** Rimuovere tutti gli entry point UI (form recensione, bottone "scrivi recensione", foto upload, ecc.)
- **A3** Rimuovere la sezione "Moderazione recensioni" dall'admin + bottom-nav item "Mod" → sostituire con "Segnalazioni" (errori orari/chiusura/telefono) o rimuovere
- **A4** Aggiornare Privacy Policy togliendo riferimenti a "recensioni" e "foto caricate dagli utenti"
- **A5** **NON cancellare** dati storici (recensioni vecchie restano in DB per integrity, semplicemente non accessibili/scrivibili)

### Track B — Reskin v4 (P1 visuale)

Ridisegno visivo del sito. I mockup v4 (file `v4-*.html`) sono la **source of truth per layout e design**, ma:
- Sono mockup HTML statici, **non codice da portare 1:1**
- Rispetta il **component model esistente** — non riscrivere da zero
- Applica i design token nuovi, ridisegna componente per componente

**Design tokens v4** (da creare come CSS variables, o Tailwind config, o theme file):
```css
--ink: #22181C;        /* testo principale */
--corallo: #E8453C;    /* CTA, accenti, wordmark */
--page: #FAF7F2;       /* background */
--cream: #F5F0E4;      /* card / elevazioni leggere */
--oro-deep: #8E6B3E;   /* footer, dettagli */
--verde-guida: [TBD — estratto dal live 'NELLA GUIDA' badge, vedi v4-pre-handoff]
```

**Font:**
- Wordmark ChiamamiBi / "LA GUIDA DI BI": **Alfa Slab One** (corallo)
- Titoli editoriali ("Secondo Bi"): **Caveat** (solo nei blocchi editoriali, vedi sotto)
- Body + nomi locali: **Poppins** (bold per nomi locali — NON più TAN Songbird italic, decisione del 17/04)
- Font custom in email: fallback sicuro + wordmark come PNG (Alfa Slab One non renderizza in Gmail/Outlook)

**Schermate toccate (vedi mockup):**
- Home mobile + desktop (mappa + cards esplora)
- Scheda ristorante mobile + desktop
- Pagine utente (Esplora, Sconti, Salvati, Profilo)
- `/verify` ristoratore (mobile + desktop) — già PIN-auth, è solo reskin
- Admin (mobile + desktop) — pulizia: no sezione recensioni, no pill "IA premium", no Caveat in admin

### Track C — Feature nuove (P1/P2)

**C1 — Orari Google Places (P1)**
- Sulla scheda locale mostra orari di apertura correnti
- Fetch da Google Places API (New) usando il `place_id` del locale
- **Strategia suggerita:** salva `place_id` nella tabella `restaurants`, fetch orari lato server (Supabase edge function) con cache 24-48h nel DB per evitare rate limit
- Pattern UX: "Aperto ora · chiude alle 23:00" verde / "Chiuso · apre domani alle 19:00" grigio
- Edge case: locali senza `place_id` (fallback: non mostrare il blocco orari)

**C2 — Email transazionali con Resend (P1)**
- Voce Bi obbligatoria (vedi `v4-email-manifesto.md`)
- 3 email transazionali prioritarie:
  1. **Benvenuto ristoratore + PIN** (trigger: admin aggiunge locale + genera PIN)
  2. **Conferma suggerimento utente** (trigger: form "Suggerisci un locale" submitted)
  3. **Notifica interna ad Augusto** (trigger: nuovo suggerimento, destinatario `info@chiamamibi.com`)
- Template HTML minimale con token v4, max-width 560px, CTA pill corallo
- From consigliato: `Bi <ciao@chiamamibi.com>`, Reply-to: `info@chiamamibi.com`

**C3 — Newsletter (P2, nice to have)**
- Double opt-in form sul sito
- Bozza tonale della prima uscita nel manifesto email
- Gestita via Resend (Broadcasts o invio programmato)

---

## Non-negoziabili (regole che non vanno violate mai)

1. **Niente recensioni utente, niente stelline, nessun rating medio.** Da nessuna parte. Il valore della Guida è la curatela. Se aggiungi stelle diventi TripAdvisor.
2. **PIN-only auth ristoratore.** No email+password, no Supabase Auth classico per i ristoratori. Il ristoratore entra con PIN 6-cifre assegnato da Augusto.
3. **Voce di Bi in prima persona singolare.** Nelle email, nei copy UI, nei blocchi editoriali ("Secondo Bi"). Mai "noi", "il nostro team", "la piattaforma". Mai "Gentile" / "Cordiali saluti".
4. **"Secondo Bi"** è il nome del blocco editoriale sulla scheda (non "Recensione", non "Opinione"). Font: Caveat.
5. **Font Caveat SOLO** nei blocchi editoriali Bi (tips, signature, "Secondo Bi"). Mai in navigazione, bottoni, form, admin.
6. **Niente TAN Songbird** — rimosso in v4. Nomi locali in Poppins bold.
7. **Non cancellare dati storici** (recensioni esistenti, utenti, ecc.) — solo disabilitare scrittura/lettura.
8. **Mobile-first** — Torino è mobile. Desktop è rifinitura.

---

## Come lavoriamo

- **Proponi un plan prima di partire.** Breakdown delle tre tracce in step ordinati secondo dipendenze tecniche che tu scegli.
- **Un PR per task logico**, branch nominati tipo `v4/track-a-disable-reviews`, `v4/track-b-reskin-home`, ecc.
- **Verifica con Augusto** prima di toccare Privacy Policy, DB schema, deploy production.
- **Fail gracefully:** se Google Places rate-limita o Resend va giù, il sito non deve rompersi.
- **Nessun secret nel repo.** Tutto via env vars Vercel.

---

## Punti di contatto

- **Prodotto / decisioni:** Augusto (owner)
- **Email contatto:** `info@chiamamibi.com`
- **Dove vive la discussione:** chat con Augusto (questo Claude Code)

---

## Quando sei pronto

Dopo aver letto `v4-pre-handoff.md` e i file referenziati:

1. **Fai un inventario del codebase** (lanci `ls`, esplori `src/`, capisci la struttura)
2. **Identifichi i punti di ingresso** per le tre tracce (dove stanno i componenti recensioni, dove sta la scheda locale, dove sta `/verify`)
3. **Proponi un plan** a Augusto diviso per track, con stima in giorni e dipendenze esplicite
4. **Aspetti conferma** prima di toccare production

Nessuno step è obbligatorio "per primo". Tu proponi, Augusto approva, si parte.

---

*v1.0 · 19 aprile 2026 · Bi sta cambiando vestito, orari, e impara a scrivere email. Il cuore — curatela + voce — resta uguale.*
