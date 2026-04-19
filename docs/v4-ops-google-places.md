# Setup Google Places API — guida per Augusto

**Obiettivo:** ottenere una chiave API Google che permetta al dev di leggere gli **orari di apertura** dei ristoranti direttamente dal database di Google e mostrarli sulla scheda locale della Guida.

**Tempo stimato:** 30-45 minuti (primo account Google Cloud) · 15 minuti (se già usi GCP).
**Costo:** primi 10.000 chiamate Places API (New) / mese = **gratis**. Sotto quella soglia non paghi nulla; per sicurezza imposti un budget alert a 5€.

---

## Cosa consegni al dev alla fine

1. Una **chiave API** (stringa tipo `AIzaSy...`, ~40 caratteri)
2. Conferma che la chiave è **ristretta** ai domini `chiamamibi.com` + `localhost`
3. Conferma che il **billing** è attivo (serve anche per il piano free) con un budget alert impostato

Quando hai questi tre, mandi tutto a Bi via messaggio e il dev può integrare.

---

## Step 1 — Crea un progetto Google Cloud

1. Vai su [console.cloud.google.com](https://console.cloud.google.com/)
2. Fai login con un account Google **che vuoi usare per la fatturazione** (meglio `info@chiamamibi.com` se esiste, altrimenti il tuo personale Augusto — poi puoi aggiungere altri editor)
3. In alto a sinistra, clicca sul dropdown dei progetti (dice "Seleziona un progetto" o mostra un progetto già esistente)
4. Clicca **"Nuovo progetto"**
5. Nome progetto: **`chiamamibi`** (tutto minuscolo, senza spazi)
6. Organizzazione: lascia "Nessuna organizzazione" se non hai Workspace aziendale
7. Clicca **"Crea"**
8. Aspetta 10-20 secondi che il progetto venga creato, poi selezionalo dal dropdown

**Check:** in alto vedi `chiamamibi` come progetto attivo.

---

## Step 2 — Attiva il billing

Le API di Google Maps richiedono un billing account attivo **anche se stai nel piano gratuito**. Non preoccuparti: con le soglie gratuite e il budget alert che mettiamo al punto 6 non spendi nulla.

1. Dal menu laterale (☰ in alto a sinistra) → **"Fatturazione"**
2. Se è la prima volta vedi "Collega un account di fatturazione" → clicca
3. Se non hai un account: **"Crea account di fatturazione"**
   - Nome: `ChiamamiBi Billing`
   - Paese: Italia
   - Tipo account: Individuale (o Business se hai P.IVA)
   - Inserisci carta di credito/debito
4. Collega l'account di fatturazione al progetto `chiamamibi`

**Check:** in "Fatturazione" vedi `chiamamibi` con stato "Account di fatturazione attivo".

---

## Step 3 — Abilita le API che servono

Il dev deve poter chiamare due API:
- **Places API (New)** — legge orari, telefono, foto dal database Google
- **Geocoding API** — se serve a convertire un indirizzo in lat/lng (backup)

1. Menu laterale → **"API e servizi"** → **"Libreria"**
2. Nella barra di ricerca digita **`Places API (New)`**
   - Clicca sul risultato "Places API (New)"
   - Clicca **"ABILITA"**
   - Aspetta il caricamento
3. Torna a "Libreria" (breadcrumb in alto)
4. Cerca **`Geocoding API`**
   - Clicca sul risultato
   - Clicca **"ABILITA"**

**Check:** vai in "API e servizi" → "API abilitate e servizi" e vedi entrambe nella lista.

> **Nota:** se vedi anche "Places API" (senza "New") **non abilitarla** — è la vecchia versione. Usiamo solo quella New perché ha prezzi migliori e più campi dati.

---

## Step 4 — Genera la chiave API

1. Menu laterale → **"API e servizi"** → **"Credenziali"**
2. Clicca **"+ CREA CREDENZIALI"** in alto → **"Chiave API"**
3. Si apre un popup con la chiave appena creata (es. `AIzaSyB...`)
4. **NON chiudere subito.** Clicca **"Modifica chiave API"** nel popup (o la matita accanto alla chiave nella lista)

> **Importante:** se chiudi per errore, la chiave resta nella lista "Chiavi API" — la puoi trovare e modificare lì.

---

## Step 5 — Restringi la chiave (sicurezza)

Se non restringi la chiave, chiunque la copi può usarla e accumulare costi sul tuo account. Quindi:

### 5a. Restrizione applicazione

1. Nella pagina di modifica chiave, sezione **"Restrizioni applicazione"**
2. Seleziona **"Siti web"** (HTTP referrers)
3. Nella lista "Riferimenti siti web" aggiungi (uno per riga):
   ```
   https://chiamamibi.com/*
   https://www.chiamamibi.com/*
   https://*.vercel.app/*
   http://localhost:*
   http://localhost/*
   ```
   - I primi due coprono la produzione
   - `*.vercel.app` serve per le preview del dev
   - `localhost` serve per sviluppo locale

### 5b. Restrizione API

1. Sezione **"Restrizioni API"**
2. Seleziona **"Limita la chiave"**
3. Nel menu a tendina spunta solo:
   - ✅ **Places API (New)**
   - ✅ **Geocoding API**
4. Salva

### 5c. Rinomina la chiave

In alto nella pagina, dove c'è scritto "API Key 1" o simile, rinomina in:
**`ChiamamiBi Production Key`**

Clicca **"Salva"** in fondo.

**Check:** nella lista Credenziali vedi `ChiamamiBi Production Key` con le due API elencate e le restrizioni siti web attive.

---

## Step 6 — Imposta un budget alert (sicurezza #2)

Anche se siamo nel free tier, vuoi sapere subito se qualcosa schizza (bug, abuse, ecc.).

1. Menu laterale → **"Fatturazione"** → **"Budget e avvisi"**
2. Clicca **"CREA BUDGET"**
3. Nome: **`ChiamamiBi Budget Alert`**
4. Ambito: **Progetti → chiamamibi**
5. Importo budget: **5 EUR** (fisso, mensile)
6. Soglie avvisi: lascia quelle di default (50%, 90%, 100%)
7. Email destinatari: il tuo + `info@chiamamibi.com`
8. Salva

**Check:** ti arriva una mail "Budget creato con successo".

> Se un giorno arriva un alert "hai superato il 50%", vuol dire che qualcosa è fuori scala — scrivi al dev, non ignorare.

---

## Step 7 — Copia la chiave e mandala al dev

1. Torna in **"Credenziali"**
2. Clicca l'icona "mostra" (occhio) accanto a `ChiamamiBi Production Key`
3. Copia la stringa completa (inizia con `AIzaSy...`)
4. Inviala al dev con questo messaggio:

```
Ciao,

Chiave Google Places API pronta.

Progetto GCP: chiamamibi
Chiave: AIzaSy...[resto della chiave]
API abilitate: Places API (New) + Geocoding API
Restrizioni referrer attive su: chiamamibi.com, www.chiamamibi.com,
  *.vercel.app, localhost
Budget alert: 5 EUR/mese (a info@chiamamibi.com e me)

Se serve altro, dimmi.

A presto,
Augusto
```

---

## Checklist finale

Prima di considerare il task chiuso:

- [ ] Progetto `chiamamibi` esiste in Google Cloud
- [ ] Billing attivo sul progetto
- [ ] Places API (New) abilitata
- [ ] Geocoding API abilitata
- [ ] Chiave `ChiamamiBi Production Key` creata
- [ ] Chiave ristretta ai 5 referrer (chiamamibi.com, www, *.vercel.app, localhost)
- [ ] Chiave ristretta a Places API (New) + Geocoding API
- [ ] Budget alert 5 EUR/mese creato
- [ ] Chiave copiata e mandata al dev

---

## Se qualcosa va storto

| Problema | Soluzione |
|---|---|
| "Questa API richiede la fatturazione" | Torna a Step 2, collega billing al progetto |
| Il dev dice "REQUEST_DENIED" | Di solito manca una API abilitata o il referrer è sbagliato — manda screenshot della pagina Credenziali |
| Budget alert arriva subito | Probabile chiamata a vuoto / bug del dev, non ignorare |
| Hai perso la chiave | Vai in Credenziali, rigenera con "REGENERATE KEY" — invalida la vecchia e comunica la nuova al dev |

---

*v1.0 · 19 aprile 2026 · Guida operativa per Augusto. Output: 1 chiave API ristretta + billing attivo.*
