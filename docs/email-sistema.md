# Il sistema delle email

**Ultimo aggiornamento:** 15 settembre 2026
**Codice:** `api/_email/` (tema, blocchi, guscio, invio) · `api/_email/templates.js` (le email)
**Anteprima:** `node scripts/email-preview.mjs` → apri `docs/email-preview/index.html`
**Prova vera:** pannello admin → Impostazioni → *Anteprima email* → "Provala"

Questo file dice **com'è fatta** un'email di Bi e **cosa tiene fuori dallo spam**.
Per sapere *cosa parte quando*, vedi `docs/EMAIL-FLOWS.md`.

---

## 1. Da dove nasce questa revisione

Una segnalazione del 15/09, con tre screenshot di un drop arrivato in posta:

> «Le mail che mi sono arrivate da chiamami Bi sono bruttissime, lavorerei sul
> design che deve sembrare premium, sui contenuti e sull'oggetto anche delle
> mail, in più la foto copre troppo spazio all'interno della mail […] In più
> non devono finire in spam mentre ora mi sono finite in spam»

Cosa c'era davvero, verificato nel codice:

| Problema | Causa |
|---|---|
| La foto occupava due schermate | `heroPhoto` stampava la foto con le sue proporzioni native — un fotogramma verticale di un video, bande nere comprese |
| La foto era anche sgranata | si partiva da `thumb_url`, che è il ritaglio da 400px delle card, mostrato dentro una colonna da 600 |
| Sembrava un volantino | il blocco dell'offerta era un rettangolo corallo pieno a tutta larghezza con dentro il numero in bianco |
| Tre mittenti diversi | cinque email su nove avevano l'HTML scritto a mano dentro l'endpoint: tre testate, due piè di pagina, due coralli diversi (`#E8453C` e `#FF5757` nell'email del codice di recupero) |
| Poco testo, tanta immagine | il rapporto testo/immagine è uno dei primi numeri che guarda un filtro |
| Oggetti tutti uguali | `Drop: −30% da Pan y Pata` — prefisso fisso, e il segno meno in apertura |
| Niente indirizzo, niente motivo | il piè di pagina non diceva chi manda né perché quel messaggio è arrivato |
| La disiscrizione a un clic non disiscriveva | vedi §4, è la più grave |

---

## 2. Com'è fatta un'email adesso

Una sola testata per tutte, una sola tavolozza, un solo piè di pagina.

```
┌─ crema #F3EDE4 ───────────────────────────┐
│ ┌─ bianco, angoli 24 ───────────────────┐ │
│ │        LA GUIDA DI BI   (logo PNG)    │ │  testata
│ │            T O R I N O   (oro)        │ │
│ │ ───────────────────────────────────── │ │
│ │ [ fascia foto 600×250, ritagliata ]   │ │  solo negli annunci
│ │ DROP · TORINO            (occhiello)  │ │
│ │ Ho acceso un drop da Pan y Pata.      │ │  titolo
│ │ Una riga che spiega.                  │ │  apertura
│ │ ┌─ inchiostro, filo d'oro ─────────┐  │ │
│ │ │ drop live · restano 3g 2h        │  │ │  la card dell'offerta
│ │ │ −30%                             │  │ │
│ │ │ da Pan y Pata          (oro)     │  │ │
│ │ └──────────────────────────────────┘  │ │
│ │ ( Prendilo adesso )      (corallo)    │ │  un solo bottone
│ │ ▌ Quello che Bi dice del posto        │ │  il filo d'oro a lato
│ │ ① ② ③ Come funziona                   │ │
│ │ — Bi                                  │ │
│ ├─ crema #F7F2E9 ───────────────────────┤ │
│ │ logo · tagline · link · perché ricevi │ │  piè di pagina
│ │ questa email · indirizzo · © anno     │ │
│ └───────────────────────────────────────┘ │
└───────────────────────────────────────────┘
```

**Le scelte che fanno la differenza fra "guida" e "volantino":**

- **Il corallo è un accento, non un fondo.** Occhiello, bottone, poco altro. I
  blocchi grandi stanno sull'inchiostro `#22181C` con il filo d'oro `#D9B476`.
  Il corallo pieno a tutta larghezza è il colore dei volantini del supermercato.
- **L'oro esisteva già** nei token del sito (`--color-oro`) e nelle email non
  c'era mai arrivato. È quello che fa sembrare un messaggio stampato invece che
  generato.
- **La foto è una fascia, non una parete** (§3).
- **C'è del testo vero.** Negli annunci di sconto adesso entra `our_review` del
  locale: la riga in cui Bi dice perché quel posto merita. Serve a chi legge e
  serve al filtro, che il rapporto fra immagini e parole lo misura.
- **Un solo bottone primario** per email.
- **Gerarchia larga:** occhiello 11px spaziato, titolo 31px, apertura 17.5px,
  corpo 16px. I salti piccoli sono quelli che fanno "fatto in fretta".

I mattoni stanno in `api/_email/blocks.js`, uno per funzione: `eyebrow`, `h1`,
`lede`, `quote`, `offerCard`, `codeBlock`, `steps`, `checklist`, `note`,
`dataTable`, `heroPhoto`, `signature`. Un'email nuova si scrive mettendoli in
fila, non scrivendo HTML.

---

## 3. La foto

Il ritaglio non si può fare nel client di posta: `object-fit` in Outlook non
esiste, e mettere un'altezza fissa senza ritagliare schiaccia la foto. Quindi
lo fa il server, con il proxy che c'era già:

```
/api/img?url=<foto>&w=1200&h=500&fit=cover&fm=jpg
```

- `fit=cover` con `position: 'attention'` — sharp tiene la parte con più
  contenuto invece del centro geometrico. Provato: su un fotogramma verticale
  1080×1920 con bande nere sopra e sotto, restituisce 1200×500 di sola foto.
- `w`/`h` al doppio delle dimensioni finali (600×250), per gli schermi a
  doppia densità.
- `fm=jpg` perché il WebP che il proxy servirebbe di sua iniziativa, in Outlook
  2016 e in qualche webmail, resta un riquadro vuoto.
- La sorgente è `photo_url` (piena) e non più `thumb_url` (400px).

Risultato: la fascia si prende ~250px su un telefono invece di due schermate,
e il messaggio comincia sopra la piega.

---

## 4. Perché finivano in spam, e cosa è cambiato

**L'autenticazione era ed è a posto** — verificato via DNS il 15/09:

| Record | Valore | Esito |
|---|---|---|
| SPF `chiamamibi.com` | `v=spf1 include:_spf.google.com include:_spf.resend.com ~all` | ok |
| SPF `send.chiamamibi.com` | `v=spf1 include:amazonses.com ~all` | ok (è il dominio di ritorno di Resend) |
| DKIM `resend._domainkey` | chiave presente | ok |
| DMARC `_dmarc` | `v=DMARC1; p=none; rua=mailto:info@chiamamibi.com` | ok, ma vedi §5 |
| MX `send.chiamamibi.com` | `feedback-smtp.eu-west-1.amazonses.com` | ok |

Quindi non era SPF/DKIM. Era il resto.

**Risolto nel codice:**

1. **La disiscrizione a un clic non disiscriveva.** `List-Unsubscribe` puntava
   a `/preferenze-email?t=…`, che è una pagina React. La RFC 8058 dice che il
   client di posta ci fa una **POST** e si aspetta che il server faccia il
   lavoro: alla POST quella pagina rispondeva 200 con dentro l'HTML del sito.
   Gmail registrava "disiscritto", la persona continuava a ricevere le email e
   al giro dopo premeva *segnala come spam* — il colpo peggiore che un dominio
   possa prendere. Adesso l'intestazione punta a
   `/api/send-email?unsub=<token>`, che spegne davvero i tre interruttori; il
   link visibile nel piè di pagina resta quello bello.
2. **Il benvenuto partiva senza `List-Unsubscribe`.** Era l'unica email di
   annuncio senza via d'uscita.
3. **Tre email partivano senza versione a solo testo** (conferma suggerimento,
   notifica interna, candidatura). Un messaggio solo-HTML è penalizzato di suo.
   Adesso la rete di sicurezza sta in `sendEmail`: nessun messaggio parte senza
   testo, e il testo porta la stessa coda dell'HTML (chi manda, perché, come
   smettere).
4. **Il piè di pagina non diceva chi manda né perché.** Adesso ogni email porta
   una riga "Ricevi questa email perché…" diversa per tipo, l'indirizzo postale
   (`EMAIL_POSTAL_ADDRESS`) e il recapito.
5. **`X-Entity-Ref-ID` diverso per messaggio.** Senza, Gmail impila venti
   annunci con lo stesso oggetto in un'unica conversazione.
6. **Mezzo secondo fra un blocco di cento e l'altro**, invece di sparare tutto
   nello stesso istante.
7. **Gli oggetti non hanno più il prefisso fisso** né il segno meno in apertura.
   Un prefisso uguale su ogni messaggio è la firma delle email automatiche.

| Prima | Adesso |
|---|---|
| `Drop: −30% da Pan y Pata` | `Pan y Pata: 30% in meno, finché dura` |
| `Nuovo sconto: −30% da Pan y Pata` | `Pan y Pata: 30% in meno, da oggi nel Club` |
| `Un posto nuovo: Bomaki Murazzi` | `In guida da oggi: Bomaki Murazzi` |
| `Il tuo sconto da Bar Stampa` | `Il tuo codice per Bar Stampa` |
| `Ciao, sono Bi — il tuo accesso a ChiamamiBi` | `Bar Stampa è nella Guida di Bi: ecco il tuo PIN` |
| `481902 — Codice di recupero ChiamamiBi` | `481902 è il tuo codice ChiamamiBi` |

---

## 5. Cosa resta da fare, e lo fa Augusto

Il codice non può toccare né il DNS né il pannello di Resend. In ordine di
quanto pesano:

### a) Il tracciamento dei clic su Resend — **verificato, è già spento**

Nell'interfaccia attuale di Resend (Domains → `chiamamibi.com` → tab
*Configuration*) il tracciamento non è un interruttore già acceso: è la
sezione **"Enable tracking metrics"**, che spiega che per tracciare clic e
aperture serve prima configurare un **sottodominio di tracciamento** dedicato
(bottone "Configure"). Finché quel sottodominio non viene creato, i link
nell'email restano quelli veri — nessun riscritto con un dominio Resend.

Verificato il 15/09: nessun sottodominio di tracciamento è configurato su
`chiamamibi.com`, quindi **il tracciamento clic è già disattivato** e non
c'è niente da spegnere. L'unica cosa da *non* fare è cliccare "Configure" e
attivarlo — un link riscritto con un indirizzo diverso da quello vero è, per
un filtro, la definizione di phishing, e su un dominio giovane pesa
moltissimo.

### b) Iscrivere il dominio a Google Postmaster Tools

<https://postmaster.google.com> → aggiungi `chiamamibi.com` → verifica con un
record TXT. Da lì si vede la percentuale di segnalazioni spam e la reputazione
del dominio secondo Gmail. Dieci minuti, gratis, ed è l'unico modo di sapere se
quello che facciamo funziona invece di indovinare.

### c) Le due variabili su Vercel

| Variabile | Valore consigliato | Perché |
|---|---|---|
| `RESEND_FROM` | `Bi di ChiamamiBi <ciao@chiamamibi.com>` | in elenco "Bi" da solo non dice da dove arriva il messaggio, e chi non ricorda di essersi iscritto segnala come spam. La variabile su Vercel vince sul valore nel codice |
| `EMAIL_POSTAL_ADDRESS` | la via e il numero civico veri | senza, in fondo compare "ChiamamiBi · Torino, Italia", che è meglio di niente ma non quanto un indirizzo vero |

### d) La foto profilo di `ciao@chiamamibi.com`

Gli MX del dominio sono di Google Workspace: se `ciao@` è un utente o un alias
con una foto profilo, **Gmail mostra quell'immagine tonda accanto al mittente**
invece dell'iniziale grigia. È la cosa che costa meno e si nota di più.
(BIMI — il logo certificato — richiede DMARC in applicazione e un certificato
VMC da ~1000€/anno: non vale la pena adesso.)

### e) DMARC, fra due settimane

Adesso è `p=none`, cioè "guarda e riferisci". Quando i rapporti `rua` sono
puliti, passare a:

```
v=DMARC1; p=quarantine; rua=mailto:info@chiamamibi.com; adkim=r; aspf=r
```

Non farlo prima di aver guardato i rapporti: dal dominio manda anche Google
Workspace, e se qualche strumento spedisce non allineato si mette in
quarantena posta vera.

### f) Le prime email dopo il cambio

Il dominio è giovane e si è appena preso delle segnalazioni. Per due settimane:

- chiedere a chi ha ricevuto in spam di **spostare il messaggio in Posta in
  arrivo** e di aggiungere `ciao@chiamamibi.com` ai contatti — vale più di
  qualsiasi cosa si possa scrivere nel codice;
- non mandare un annuncio a tutta la lista in un colpo il primo giorno;
- non mandare due annunci nello stesso giorno.

### g) Più avanti, se il volume cresce

Separare gli annunci dal resto su un sottodominio (`news.chiamamibi.com` in
Resend, con i suoi record). Così una campagna andata male non si porta dietro
la reputazione di `ciao@`, che manda anche i codici di accesso. Oggi, con
questi numeri, non serve.

---

## 6. Le regole per chi aggiunge un'email

1. Si scrive in `api/_email/templates.js`, con i blocchi. Mai HTML a mano
   dentro un endpoint: è così che sono nate tre testate diverse.
2. Si spedisce con `sendEmail` o `buildMessage` di `_email/send.js`. Mai una
   `fetch` a Resend per conto proprio.
3. Serve la versione a solo testo, scritta a mano.
4. Serve la riga del motivo (`reason`).
5. Se è un annuncio — cioè non risponde a un gesto della persona — serve
   `unsubscribeUrl` e serve che chi spedisce passi `listUnsubscribeHeaders`.
   Le ricevute no: lì il link toglierebbe a qualcuno il proprio codice sconto.
6. L'oggetto: sotto i 50 caratteri, con dentro la cosa concreta (il nome del
   locale), senza prefissi fissi, senza cominciare con un numero o un segno.
7. Si aggiunge a `scripts/email-preview.mjs` e al pannello in
   `src/components/admin/EmailPreviewTool.jsx`, così si può guardare.
8. `npm test` — le prove in `tests/emails.test.mjs` controllano che il motivo
   ci sia, che l'oggetto non cominci male, che non ci siano `rgba()` (Outlook
   le butta) e che gli apostrofi di un nome non spacchino l'HTML.

---

## 7. Le dodici email

| # | Quando | A chi | Oggetto | Disiscrizione |
|---|---|---|---|---|
| 1 | Registrazione completata | utente | `{Nome}, da adesso sei nel Bi Club` | sì |
| 2 | Drop pubblicato | lista sconti | `{Locale}: {valore} in meno, finché dura` | sì |
| 3 | Sconto non-drop pubblicato | lista sconti | `{Locale}: {valore} in meno, da oggi nel Club` | sì |
| 4 | Locale nuovo pubblicato | lista locali | `In guida da oggi: {Locale}` | sì |
| 5 | Sconto preso | chi l'ha preso | `Il tuo codice per {Locale}` | no (ricevuta) |
| 6 | QR scansionato | chi l'ha usato | `Sconto usato da {Locale}` | no (ricevuta) |
| 7 | Locale aggiunto in admin | ristoratore | `{Locale} è nella Guida di Bi: ecco il tuo PIN` | no (accesso) |
| 8 | Form "suggerisci un locale" | chi segnala | `Ho preso nota di {Locale}` | mailto |
| 9 | Form `/partner` | candidato | `Ho ricevuto la candidatura di {Locale}` | mailto |
| 10 | Cambio email / password | utente | `{codice} è il tuo codice ChiamamiBi` | no (sicurezza) |
| 11 | Form "suggerisci un locale" | `info@` | `[Bi] Nuovo suggerimento: {Locale}` | interna |
| 12 | Form `/partner` | `info@` | `[Bi] Nuova candidatura: {Locale}` | interna |

Più le due che manda Supabase (conferma registrazione, cambio indirizzo):
vivono nel suo pannello ma sono generate dagli stessi blocchi con
`node supabase/email-templates/build.mjs`, e vanno **reincollate nel dashboard
Supabase** quando si rigenerano.

---

*Il file delle email era fatto bene in fondo (`_email/` esisteva già, con i
suoi commenti); quello che mancava era che ci passassero tutte.*
