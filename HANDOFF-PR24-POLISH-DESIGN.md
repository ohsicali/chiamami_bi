# HANDOFF PR24 — Polish design + redesign mirati (giugno 2026)

> Entry point per Claude Code. Deriva dall'audit del sito live del 9-10 giu 2026 (desktop + mobile + admin).
> Repo: `ohsicali/chiamami_bi` · branch base: `main` · stack: React+Vite, Supabase, Mapbox, Vercel (Hobby, cap 12 funzioni /api).
> Mockup di riferimento nel workspace: `preview-redesign-v5.html`, `home-mobile-drop-applicato.html`, `chiedi-a-bi-risposta-proposta.html`.

## Regola d'oro per questo PR
NON toccare: Home (drop hero, momenti/orologio, Chiedi a Bi sidebar), pagina Chiedi a Bi (landing/input), verify PIN, Partner, tab bar glass mobile, mappa Esplora con pin emoji. Tokens v4 invariati: `--ink:#22181c`, `--corallo:#e8453c`, `--page:#faf7f2`, `--cream:#f5f0e4`, `--oro-deep:#8e6b3e`. Font Poppins. Caveat SOLO in tip e firma "— Bi".

Lavorare in 3 commit/sotto-branch nell'ordine: **(A) Dati & immagini → (B) Bug minori → (C) Redesign**. A sblocca tutto il resto.

---

## BLOCCO A — Dati & immagini (priorità massima, sblocca tutto)

### A1 · Immagini (bug B1)
**Sintomo:** gallery scheda grigia, /salvati 3 card su 6 senza foto, drop card Bi Club e convenzioni senza foto, ristoranti vicini grigi. Alcune caricano dopo 5-10s, altre mai.
**Da fare:**
1. Servire thumbnail ottimizzate da Supabase Storage usando il render transform: `…/storage/v1/render/image/public/<bucket>/<path>?width=400&quality=75&resize=cover`. Creare un helper `optimizedImg(path, w)` e usarlo in TUTTE le card (Esplora, Salvati, Home, vicini, Bi Club). Per l'hero scheda usare `width=1200`.
2. Aggiungere uno skeleton shimmer (`<div class="img-skeleton">`) finché `onLoad` non scatta.
3. Fallback: se l'immagine manca o `onError`, mostrare l'emoji della categoria su gradiente caldo (NON grigio piatto). Mappa categoria→emoji già usata altrove (🍣 sushi, 🍕 pizza, ☕ caffè, 🍨 gelateria, ecc.).
4. Audit URL morti: query Supabase per individuare i record con `photo_url` che ritorna 404 e loggarli (non bloccante per il PR, ma segnalare in console.warn).

### A2 · Indirizzi formattati (bug B3)
**Sintomo:** "Via Alfonso Bonafous 7, 10123 Torino Turin, Italy" ovunque.
**Da fare:** helper `formatAddress(rawGoogleAddress, neighborhood)` → output `Via Bonafous 7 · Vanchiglia`. Regole: prendere via+civico, rimuovere CAP, rimuovere "Turin"/"Italy" ridondanti, appendere il quartiere se disponibile (vedi A4). Il CAP/indirizzo completo resta SOLO nel link "Indicazioni". Applicare in card Esplora, Salvati, scheda, vicini.

### A3 · Badge città fuori Torino (bug B2 — NON rimuovere i locali)
**Decisione confermata dal cliente:** i locali fuori Torino RESTANO in guida.
**Da fare:**
1. Header Esplora: da "72 locali a Torino" → "72 locali · la guida di Bi" (o nome città selezionata se filtrata).
2. Sulle card mostrare un badge `📍 Milano` SOLO quando `restaurant.city !== cittaSelezionata`. Niente badge per i locali della città attiva.
3. Ordinamento lista: prima la città attiva, poi gli altri.
4. Serve un campo `city` affidabile sul record (derivarlo da Google Places component `locality` se assente, non dalla stringa raw).

### A4 · Quartiere (alimenta A2 e Chiedi a Bi)
Salvare `neighborhood` dal componente Google Places (`sublocality`/`neighborhood`) in fase di sync. Necessario perché Chiedi a Bi possa matchare "Vanchiglia" (vedi blocco C-Chiedi).

---

## BLOCCO B — Bug minori

- **B4 · Orari 7× "Chiuso":** se TUTTI i 7 giorni sono "Chiuso", non renderizzare il muro: mostrare "Orari non disponibili · chiama" e loggare il record per re-sync Places. Rivedere anche il caso Bomaki (sync rotto su quel record).
- **B5 · Copy [DEMO]:** rimuovere "[DEMO] Sconto del 20%…" dalla scheda Bomaki (ripulire copy o spegnere lo sconto demo nel DB).
- **B6 · Doppio banner sconto scheda:** vedi redesign scheda (C1). Desktop = solo banner inline; mobile = solo sticky bar. Mai entrambi.
- **B7 · Contenuto sotto tab bar (mobile):** aggiungere `padding-bottom: calc(96px + env(safe-area-inset-bottom))` ai container scrollabili delle pagine con tab bar (Bi Club in primis).
- **B8 · Riga "€" orfana:** nel banner sponsor Home, render condizionale del campo prezzo (non mostrare la riga se vuoto).
- **B9 · CTA drop mobile:** risolta dalla Variante B (vedi C2).
- **B10 · About desktop:** `max-width: 720px` sulla colonna; ridurre i delay dei fade-in (o limitarli all'above-the-fold).
- **B-Chiedi · Risposta troncata:** la risposta di Bi si tronca a metà frase ("…esplorare altro tipo di cucina a"). Alzare `max_tokens` lato edge function di Chiedi a Bi e/o gestire il completamento.
- **B-Admin · Flash di zeri (B7 admin):** la dashboard mostra 0/0/0 per 1-2s prima dei dati reali → skeleton bar al posto degli zeri finché la query non risponde.

---

## BLOCCO C — Redesign

### C1 · Scheda ristorante (desktop + mobile) — la più importante
Riferimento: `preview-redesign-v5.html` sezione 🍣 Scheda.

**Desktop:**
- Hero: sostituire il carosello con un **mosaico 1+4** (1 foto grande a sinistra grid-row span 2, 4 piccole; ultima con overlay "+N foto"). Click → lightbox/carosello.
- Layout 2 colonne `1fr 330px`. Colonna principale: nome → indirizzo formattato → tag → **banner sconto inline (above the fold, subito sotto i tag)** → "Secondo Bi" → firma "— Bi" (Caveat) → tip caramello.
- Sidebar sticky: card "● Aperto ora · chiude alle 00:00" con orari collassabili (toggle "Tutti gli orari ▾") → card azioni (Indicazioni primary / Chiama / Sito) → mini-card "Ciao, sono Bi".
- Vicini: spostarli in fondo, **riga full-width 4 card** con foto+categoria (no sidebar).
- **Rimuovere la sticky bar sconto su desktop** (resta solo l'inline). Fix B6.

**Mobile:** (rif. `preview-redesign-v5.html` sezione 📱 + `home-mobile-drop-applicato.html`)
- Gallery swipe con contatore "1/4", fallback emoji, e **badge "−20% attivo" sulla foto**.
- Indirizzo formattato.
- Riga "● Aperto ora" espandibile (no muro 7× Chiuso).
- **Solo la sticky bar sconto** (in fondo, sempre visibile allo scroll). Il banner inline NON appare su mobile. Fix B6.

### C2 · Banner drop Home mobile → **VARIANTE B (accesa)**
Riferimento: `home-mobile-drop-applicato.html` colonna centrale.

Sostituire l'attuale card drop mobile con la **Variante B**:
- Foto del locale grande in alto (height ~128-150px, fallback emoji su gradiente).
- Badge `−2%` (la percentuale) sovrapposto in basso a destra sulla foto, pill verde menta `#aef3c2` su testo ink.
- Body: pill `● DROP LIVE · SCADE IN 20G 16H` → **nome locale** (h3, Poppins 800) → **vantaggio in Poppins bold bianco 13px** (es. "Gelato a 2€") con sotto-riga indirizzo piccola al 85% opacità. **NIENTE Caveat qui.**
- Progress bar (rimasti/totali) + meta "1 preso / **19 rimasti**".
- CTA: pill larga `🔓 Sblocca sconto` (ink) + ghost `Scopri`. **Eliminare il cerchio nero** con testo su 3 righe (fix B9).
- Gerarchia: foto → nome → vantaggio → % come badge. Funziona anche con percentuali piccole.

Nota: è lo stesso pattern visivo del drop hero di Bi Club (C3) — fattorizzare in un componente unico `<DropHero variant="mobile|desktop">` se possibile.

### C3 · Bi Club desktop — drop hero adattivo
Riferimento: `preview-redesign-v5.html` sezione 🏷️ Bi Club (incluso il caso "più drop").

- **1 drop attivo:** drop hero orizzontale full-width `1.15fr 1fr` (testo+countdown+progress a sinistra, foto a destra con badge %). Stesso pattern dell'hero Home.
- **Più drop attivi:** l'hero mostra solo il **drop in evidenza** (quello che scade prima, o flag `featured` settabile da admin), più compatto. Gli altri drop usano la **stessa card delle convenzioni** con bordo corallo + countdown "● LIVE · 12g 8h" + "9/30 presi". Aggiungere uno slot "Prossimo drop · 🔔 Avvisami" se previsto.
- Convenzioni: griglia **3 colonne uniforme** (oggi è 2col con 3 elementi = riga spezzata), percentuale ancorata alla foto, fallback emoji.
- **Mobile Bi Club:** layout invariato; con più drop → carosello swipe. Applicare fix B7 (padding-bottom).

### C4 · Card Esplora
Riferimento: `preview-redesign-v5.html` sezione 🗺️ Esplora.
- Foto da 1:1 → **4:3** (più densità, +1 card per viewport).
- Overlay "● Aperto" in alto a sinistra (solo se davvero aperto, dopo fix B4).
- Sconto come **pill corallo accanto al nome** (non nascosto sull'angolo foto).
- Indirizzo formattato + badge città (A2/A3).
- Fallback emoji (A1).

### C5 · Chiedi a Bi — stato risposta
Riferimento: `chiedi-a-bi-risposta-proposta.html`.
**Dipende da A1+A2+A4+B4** (senza dati puliti Bi continua a "non trovare" locali che ha). Confermato nel test live: Bi ha negato di avere giapponesi a Vanchiglia mentre Bomaki (sushi, Vanchiglia) è nel suo DB — escluso dal filtro "aperto" per gli orari rotti e dal match zona per l'indirizzo raw.
**Da fare:**
1. **Card locali dentro la risposta:** quando Bi cita dei locali, renderizzare card cliccabili (foto/emoji, nome, categoria·prezzo·zona, "perché" di Bi in verde, freccia → scheda). L'LLM deve restituire structured output con gli `id` dei locali citati, non solo testo.
2. **Quick-reply chips** sotto la risposta per le domande binarie di Bi ("Allarga la zona", "Solo con sconto", "Cosa ordino da X?"). Su mobile evitano la tastiera.
3. **Stato aperto** sulla card (post B4).
4. Fix risposta troncata (B-Chiedi) e micro-copy attesa: "ti rispondo in qualche secondo" + typing indicator ("sto sfogliando la guida…") al posto del fisso "3 secondi".

### C6 · Admin micro-fix
- **A1 fasce — RESTANO emoji** (decisione cliente: più compatte, più rapide). Unico ritocco: fasce spente a opacità ~15-20% così lo stato attivo si legge. NON sostituire con chip testuali.
- Colonna thumbnail vuota: mostrare thumbnail vera (riusa helper A1) o rimuovere la colonna.
- Flash zeri: vedi B-Admin.
- Colonna Zona con città fuori Torino: va bene così in admin, non toccare.

---

## Ordine di merge consigliato
1. **A** (dati+immagini) — un commit, cambia la percezione dell'intero sito e sblocca C5.
2. **B** (bug minori) — un commit.
3. **C1** scheda → **C2** banner drop mobile (variante B) → **C3** Bi Club → **C4** Esplora → **C5** Chiedi a Bi → **C6** admin. Ogni voce può essere un commit separato.

## Note repo (da memoria sessioni precedenti)
- Vercel Hobby: cap 12 funzioni in /api. Se C5 richiede nuovi endpoint, consolidare nel router esistente (es. `send-email.js` pattern) per non sforare → sintomo sforo = deploy ERROR post-build senza log.
- Email flows: doc canonico `docs/EMAIL-FLOWS.md` (non impattato da questo PR, ma non rompere i trigger esistenti).
- HomeFeedV4, glass-pill-v4 (MobileTabBar) sono i componenti v4 live di riferimento per stile.

## Definition of done
- [ ] Nessuna immagine grigia: tutte hanno thumbnail ottimizzata, skeleton o fallback emoji.
- [ ] Nessun indirizzo con "Turin, Italy"; badge città su locali fuori Torino.
- [ ] Scheda: mosaico foto, colonna piena, un solo banner sconto per viewport, vicini full-width.
- [ ] Home mobile: banner drop in Variante B, niente cerchio nero, vantaggio in Poppins bold.
- [ ] Bi Club desktop: drop hero adattivo (1 vs N drop), convenzioni 3col.
- [ ] Esplora: card 4:3, stato aperto reale, sconto pill.
- [ ] Chiedi a Bi: card locali + chips nella risposta, niente troncamento.
- [ ] Admin: fasce restano emoji (spente più trasparenti), niente flash zeri.
- [ ] Verificato su mobile reale (390px) e desktop.
