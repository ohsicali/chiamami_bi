# Chiamami Bi — pre-handoff checklist

**Cosa manca prima di passare il lavoro a un LLM dev (code Claude).**

> ⚠️ **Contesto cruciale:** il sito è **già live** su `chiamamibi.com`. Questo non è un progetto green-field. Il dev deve fare un **reskin visivo v4** dei contenuti esistenti + implementare **2 feature nuove** (email system + orari Google Places).

---

## Stato attuale (cosa c'è già) — **confermato via audit live 19/04/2026**

| Item | Stato | Note |
|---|---|---|
| Dati ristoranti | ✅ **71 ristoranti** in DB, tutti pubblicati | migrare da Supabase prod |
| Utenti registrati | ✅ 4 utenti | base utenti minima |
| Sconti | ✅ 4 attivi, 7 QR usati | log validato/generato completo |
| Logo wordmark | ✅ `CHIAMAMI BI` Alfa Slab One corallo | conferma v4 |
| Favicon | ✅ solo la "B" tonda corallo | derivare dal mark |
| **Frontend** | ✅ **React + Vite** (single bundle `index-<hash>.js`) | reskin componente-per-componente |
| **Hosting** | ✅ **Vercel** (incluso `_vercel/insights`) | branch preview nativo |
| **Backend / DB** | ✅ **Supabase** (project `urcwnontifybzugmmiov`) | auth utente standard |
| **Mappe** | ✅ **Mapbox GL** integrato | chiavi già configurate |
| **PIN auth ristoratore** | ✅ **GIÀ IN PRODUZIONE** — 6 cifre + cookie `verify_device_token` | **reskin only, no feature-new** |
| **Dashboard ristoratore** | ✅ KPI (views/saves/gen/used), sconto attivo + scadenza, barre andamento 30gg, log attività | reskin only |
| **Admin Bi** | ✅ `/admin` full (nuovo ristorante, nuovo sconto, suggerimenti utenti, candidature partner, ultimi aggiunti) | reskin only |
| **Tone of voice Bi** | ✅ già applicato in `/verify` + legal | copy-editing minimo |
| **Legal URLs** | ✅ `/privacy` `/termini` `/cookies` `/chi-e-bi` `/about` `/terms` tutte attive (privacy updated Marzo 2026) | **update contenuti** (vedi R7) |
| **Multi-city / multi-lang** | ✅ `selectedCity` + `chiamamibi_lang` in localStorage | architettura pronta |
| **SEO sitemap** | ❌ `/sitemap.xml` ritorna SPA fallback, non XML | **gap da chiudere** |
| Font Poppins / Alfa Slab / Caveat | ✅ già caricati nel live | conferma v4 |
| TAN Songbird | ⚠️ **ancora usato nel live** per titoli display ("Area Ristoratori", "Privacy Policy") | decidere se mantenere nei titoli generali o rimuovere ovunque |
| **Sistema recensioni utenti** | ⚠️ **esiste nel backend** ma va **DISATTIVATO** | privacy cita "recensioni, foto caricate" — vedi sezione nuova §0 |

**Quello che cambia con v4:** solo il livello visivo/UX + 2 feature davvero nuove (Google Places orari + sistema email) + disattivazione recensioni/foto utenti. Infrastruttura, dominio, PIN auth, dashboard ristoratore, admin — restano.

---

## 🚨 BLOCCANTI — senza questi il v4 non parte

### 0. Disattivare recensioni e foto utenti (decisione Augusto 19/04/2026)
Il live ha un sistema recensioni attivo: l'Admin mostra "recensioni da moderare", la Privacy Policy elenca "recensioni, foto caricate" tra i dati raccolti. Il v4 è una **guida curata**: zero recensioni, zero stelle.
- **Disabilitare endpoint di scrittura** `POST /reviews`, upload foto utenti
- **Rimuovere ogni entry point UI** (card recensione scheda, bottoni "scrivi recensione", admin "Moderazione recensioni")
- **Non cancellare i dati storici** — preserve integrity (sono 4 utenti totali, low stakes, ma meglio conservare)
- **Aggiornare Privacy Policy**: togliere "recensioni, foto caricate" dalla sezione "Dati raccolti"
- Nell'Admin v4 la sezione "DA GESTIRE" va ridotta a: Suggerimenti utenti + Candidature partner (via lo star-button "recensioni da moderare")

### 1. Accessi dev al live (stack ora confermato)
Stack: **React + Vite + Vercel + Supabase + Mapbox**. Il dev deve avere:
- **Repo git** del progetto (GitHub/GitLab?) + permessi push su branch
- **Supabase dashboard** (project `urcwnontifybzugmmiov`): lettura schema, diritti di migration
- **Vercel project**: deploy access + settings per env vars
- **Mapbox account**: rotazione chiave se necessario
- **Email**: `info@chiamamibi.com` per reset / contatti partner

**Azione Augusto:** aggiungere il dev come collaborator su GitHub/Vercel/Supabase/Mapbox, condividere `.env` template (non i valori) via canale sicuro.

### 2. Sistema email (nuovo, da costruire da zero)
**Scope:**
- **Transazionali ristoratore:**
  - Benvenuto + PIN generato (quando Augusto aggiunge un locale)
  - Reset PIN (se Augusto lo rigenera)
  - Notifica nuovo redemption (daily digest, opzionale)
- **Transazionali utente:**
  - Conferma "Suggerisci un locale" ricevuto
  - Notifica Augusto quando arriva un suggerimento nuovo
- **Newsletter:**
  - Double opt-in
  - Cadenza (settimanale? mensile?)
  - Template brand-aligned (corallo + Alfa Slab + Poppins)
  - Gestione iscritti + unsubscribe

**Decisioni da prendere:**
- Provider: **Resend** (developer-friendly, tier free 3k/mese) · **Loops** (più newsletter-oriented) · **Mailchimp** (più ricco, più costoso)
- Consigliato: **Resend** per transazionali + **Loops** per newsletter, oppure tutto Resend se si vuole semplicità
- Dominio mail: `bi@chiamamibi.com` o `ciao@chiamamibi.com` — verificare SPF/DKIM/DMARC
- Tone of voice email: scrivere 1 email-manifesto che definisce la voce (Bi parla, non una macchina)

### 3. Integrazione Google Places (nuovo)
Il mockup scheda ha una card **"Orari" da Google Places**. Implementazione:
- **API key** da attivare (Google Cloud Console, billing account necessario anche per tier free)
- **Mapping** place_id ⇄ slug ristorante (serve tabella di join, se non c'è già)
- **Caching aggressivo:** min 12h per locale (quota 10k/mese gratis, con caching bastano)
- **Badge "Aperto ora"** calcolato server-side con timezone Europe/Rome
- **Footer "Fonte: Google Places, aggiornato in automatico"** — obbligatorio per ToS Google
- **Fallback:** se la chiamata fallisce, mostrare solo "Chiama il locale per gli orari"

**Azione Augusto:** aprire Google Cloud Project, abilitare Places API (New) + Geocoding, dare la key al dev.

### 4. Migrazione dati v3 → v4 (ridotta)
Molti campi v4 esistono già nel live. Quello che il dev deve aggiungere/ritoccare:
- `place_id` — **nuovo**, necessario per orari Google Places (tabella `restaurants` o join)
- `copy_secondo_bi` — se esiste come "descrizione curata", va solo rinominato a livello di UI label (o lasciato nel DB e mappato nel model)
- `tip_cosa_prendere` — probabilmente già presente come "consiglio"; verifica ORM
- ~~`pin_ristoratore_hash`~~ — **già esistente** (PIN auth già in prod), non serve migration
- `reviews.disabled_at` (opzionale) — flag per marcare il feature-off senza cancellare storico

**Azione dev:** `list_tables` Supabase + confronto con requisiti v4-handoff §4, scrivere migrazione non-distruttiva reversibile ed eseguire prima su branch Supabase (non direttamente in prod).

---

## ⚠️ IMPORTANTI — da verificare, non bloccanti

### 5. Legal — update contenuti (non creation)
Audit live 19/04: `/privacy` `/termini` `/cookies` `/chi-e-bi` `/about` `/terms` sono tutte attive, privacy updated a Marzo 2026. Non serve produrre ex-novo, serve **aggiornare**:
- `/privacy` §2 "Dati raccolti": rimuovere "Contenuti generati: recensioni, foto caricate, ristoranti salvati" → lasciare solo "ristoranti salvati"
- `/termini`: verificare assenza di clausole su recensioni/UGC utente
- `/cookies`: verificare presenza `verify_device_token` nell'elenco cookie

**Il dev porta i contenuti dentro la nuova shell v4** (stesso URL, stesso testo, tipografia aggiornata al token-set v4).

### 6. Flussi mancanti nei mockup
Il v4 copre "happy path". Il dev deve aggiungere, seguendo gli stessi pattern:
- Empty state Esplora (nessun match filtro)
- Empty state Salvati (utente nuovo)
- Errori form "Suggerisci" (validazione inline + success)
- Errori PIN ristoratore (tentativi errati, lockout)
- Reset PIN (flow preciso: chiama Bi? form? email?)
- 404 / 500 stylized
- Onboarding primo accesso (conferma: NON c'è nel live? → nemmeno in v4)
- QR redemption flow lato ristoratore (scansione → conferma → feedback)
- Disclosure sponsorizzato (quando un locale è "sponsored native")

**Il dev può produrli da solo** partendo dai pattern in `v4-handoff.md §4`.

### 7. Microcopy passata finale
Tutto l'italiano dei mockup è funzionale ma non editato. Prima del go-live serve:
- Copywriter/Augusto rilegge ogni CTA, empty state, messaggio di errore
- Tone of voice **Bi** applicato: caldo, diretto, scritto in prima persona, mai corporate
- Email automatiche: 1 manifesto tonale scritto da Augusto, il dev adatta le altre

### 8. Accessibilità deep review
Target WCAG 2.1 AA. Il dev deve esplicitamente:
- Testare contrasto verde sconto su ink (potenziale fail)
- Screen reader test (VoiceOver + NVDA)
- Keyboard nav completa
- `prefers-reduced-motion` per blink/hover/transizioni
- Focus visible con ring corallo

---

## ✨ DECISIONI MINORI — il dev può decidere

- Image optimization (Vercel Image o similar)
- Search interno (full-text postgres basta a v1)
- Sitemap XML + robots.txt
- Schema.org Restaurant markup (SEO)
- Rate limiting su PIN endpoint + suggest form
- Error tracking (Sentry free)
- Logging strutturato

---

## 🔥 RISCHI REALI (aggiornati post-audit 19/04/2026)

### R1. ~~Foto ristoranti~~ RISOLTO
Le foto sono già nel live (71 locali).

### R2. ~~PIN ristoratore~~ RISOLTO
Audit live confermato: **PIN 6-cifre + cookie `verify_device_token` già in produzione**. `/verify` funzionante, Dashboard operativa. Il reskin è solo CSS/markup.

### R3. QR spoofing
Il QR è già in uso nel live (7 QR usati storicamente, log attività completo). Verificare che il token sia firmato server-side + single-use. Se la validazione oggi è solo client-side, hardening prima di scale.

### R4. Google Places quota
10k req/mese free tier. Con 1000 DAU × 5 schede/giorno = 150k/mese senza caching. **Caching 12h obbligatorio** — il dev deve partire assumendolo.

### R5. Downtime durante reskin
Il sito è live con 4 utenti + 71 locali. Un deploy v4 che rompe qualcosa = traffico reale perso (benché base utenti piccola). Il dev deve:
- Lavorare in **Vercel preview branch** (automatico)
- Usare **feature flags** per toggle graduale
- Fare **Supabase branch** DB prima di migrazioni
- Avere un **rollback plan** documentato (Vercel rollback istantaneo)

### R6. SEO / URL preservation
Gli URL del live hanno posizionamento organico. Pattern osservato: `/restaurant/<slug>-<hash>` (es `/restaurant/rise-fusion-mnypbnkt`). Il reskin v4 deve:
- **Mantenere** gli slug esistenti 1:1
- Se il routing v4 vuole `/locale/<slug>`, serve **301 redirect** massivo da `/restaurant/<slug>` → `/locale/<slug>`
- **Sitemap.xml NON esiste oggi** (fetch ritorna SPA fallback) → produrla: dev deve buildare una sitemap con tutti i 71 slug + pagine statiche

### R7. Privacy Policy update contestuale
L'update della Privacy (togliere "recensioni, foto caricate") deve avvenire **contemporaneamente** alla disattivazione del feature — non prima (o i dati verrebbero ancora raccolti contro quanto dichiarato), non dopo (violazione GDPR). Coordinamento dev + Augusto al deploy.

### R8. TAN Songbird coerenza
Il live usa TAN Songbird per titoli display big (Privacy Policy, Area Ristoratori). Il v4 lo tiene solo nel wordmark/PIN (Alfa Slab One). **Decisione aperta**: rimuoverlo ovunque (incluso legal + verify landing) per coerenza totale, o tenerlo come display serif per "page titles" di pagine non-core.

---

## Pacchetto finale da consegnare al dev

```
/Chiamami_Bi/
├── v4-index.html                  ← hub navigabile
├── v4-sitemap-reskin.md           ← mappa route
├── v4-handoff.md                  ← specs tecniche
├── v4-pre-handoff.md              ← questo doc
├── v4-mobile-*.html × 5
├── v4-desktop-*.html × 3
└── v4-verify.html
```

Da ottenere dal dev/Augusto prima del kickoff:
```
├── [access] repo git del live
├── [access] hosting + DB prod/staging
├── [access] CMS/admin attuale
├── [key] Google Cloud (Places API)
├── [key] Email provider (Resend / Loops)
├── [key] Mapbox/MapTiler se non già nel live
└── [link] URL delle pagine legal esistenti
```

---

## Scope effettivo del dev (v4 reskin) — **ridotto post-audit**

1. **Audit stack live + ADR** (1 giorno): repo walk + decisioni (ora che stack è noto: React+Vite+Vercel+Supabase+Mapbox)
2. **Setup staging** (0.5 giorni): Vercel preview branch + Supabase branch
3. **Reskin CSS/markup v4** (1-2 settimane): port dei mockup dentro i componenti React esistenti, componente per componente
4. **Disattivazione recensioni + update privacy** (1 giorno): feature-flag off + UI cleanup + contenuto `/privacy`
5. **Feature: orari Google Places** (2-3 giorni): integration + caching + fallback
6. **Feature: sistema email** (1 settimana): provider setup (Resend) + templates + transazionali + newsletter basic
7. ~~Feature: PIN auth~~ **eliminato** (già in prod)
8. **Migrazione dati minimal** (0.5 giorni): aggiungere `place_id` + mapping
9. **Flussi mancanti** (2 giorni): empty state, error, 404 (molti già presenti)
10. **Sitemap.xml + robots.txt** (0.5 giorni): build-time generation + deploy
11. **A11y + QA finale** (2-3 giorni): audit + fix
12. **Deploy production** (0.5 giorni): rollout graduale + monitoring 48h

**Stima totale dev:** 3-4 settimane con 1 dev full-time (prima 4-6, ridotto di 1-2 settimane grazie alle conferme dell'audit). Raddoppiare se part-time.

---

## Prompt suggerito per aprire la sessione con code Claude

> "Sei un agente dev senior. Il sito chiamamibi.com è già live. Hai accesso al repo, a staging, al DB. Leggi in ordine: v4-pre-handoff.md (questo contesto), v4-handoff.md (specs), v4-sitemap-reskin.md (routing), v4-index.html (hub), poi i mockup. Primo output: un ADR che spieghi come proponi di procedere — quale parte del live si tiene, quale si riscrive, che migration serve, in che ordine shipparla. Poi staging setup. Poi reskin componente per componente. I mockup sono source of truth visivo — i token non si negoziano. Ferma e chiedi se trovi gap tra live e specs."

---

## Domande aperte per Augusto (rispondere prima del dev kickoff)

Molte chiuse dall'audit 19/04, rimangono:

1. ~~Stack~~ ✅ React+Vite / Vercel / Supabase / Mapbox
2. ~~PIN auth~~ ✅ già in prod
3. **Sistema email**: confermato nessun provider ora? Vuoi partire con **Resend** per tutto o Loops per newsletter?
4. ~~Legal URL~~ ✅ tutte attive — va solo aggiornato contenuto privacy
5. **Slug preservation**: confermi che i 71 slug attuali (`/restaurant/<slug>-<hash>`) vanno mantenuti 1:1, o il v4 può passare a `/locale/<slug>` con redirect 301?
6. **Budget API**: ordine di grandezza accettabile per Google Places (€5-20/mese dopo tier free) + Resend (gratis fino a 3k email/mese)?
7. **Timeline go-live v4**: target mese?
8. **TAN Songbird**: tenere per i titoli display di pagine secondarie (Privacy, Area Ristoratori) o rimuovere ovunque per coerenza con Neotaste?
9. **Dominio email**: `info@chiamamibi.com` (esistente) va bene per transazionali o preferisci `bi@` / `ciao@`?
10. **Recensioni storiche**: confermato che **non** vanno cancellate (solo disattivate + nascoste)?

---

*v1.2 · 19 aprile 2026 · Post-audit live. Stack React+Vite+Vercel+Supabase confermato. PIN auth + dashboard ristoratore + admin già in prod. Bi rifa il vestito, disattiva le recensioni e aggiunge orari e email.*
