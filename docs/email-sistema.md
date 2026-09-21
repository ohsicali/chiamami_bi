# Il sistema delle email

**Ultimo aggiornamento:** 21 settembre 2026 (revisione v11)
**Codice:** `api/_email/` (tema, blocchi, guscio, contenuto, invio) · `api/_email/templates.js` (le email)
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

Una sola testata per tutte, una sola tavolozza, un solo piè di pagina, un solo
divisore.

```
┌─ crema #F5F0E4 ───────────────────────────┐
│ ┌─ bianco, angoli 16 ───────────────────┐ │
│ │ LA GUIDA DI BI               TORINO   │ │  testata, 44px, una riga
│ │ ───────────────────────────────────── │ │  l'unico divisore
│ │ ┌───────────────────────────────────┐ │ │
│ │ │        foto grande, 16:9          │ │ │  mosaico 1+3
│ │ ├─────────┬─────────┬───────────────┤ │ │  (nuovo in guida,
│ │ │  92px   │  92px   │  92px    +3   │ │ │   convenzioni)
│ │ └─────────┴─────────┴───────────────┘ │ │
│ │ NUOVO IN GUIDA           (occhiello)  │ │
│ │ El Bonito Torino              (27px)  │ │  titolo
│ │ Spagnolo · €€ · Piazza Madama (oro)   │ │  meta
│ │ Due frasi di Bi, e in coda — Bi       │ │  la firma sta nella frase
│ │ ( Guarda la scheda → )    (corallo)   │ │  un solo bottone
│ └───────────────────────────────────────┘ │
│   Il sito · Bi Club · Instagram           │  piè di pagina, ~96px,
│   Ci sono stato, ho pagato il conto…      │  fuori dalla card,
│   Perché ricevi · Scegli cosa ricevere    │  niente secondo logo
│   ChiamamiBi · Torino · info@ · © 2026    │
└───────────────────────────────────────────┘
```

**Le scelte che fanno la differenza fra "guida" e "volantino":**

- **Una email = una cosa da guardare, una da capire, una da toccare.** Tutto
  quello che non è la foto, il nome, il motivo e il bottone è stato tolto o
  ridotto a una riga. Da ~2.900px a ~1.250, e con più foto, non meno.
- **Un logo solo, e non è un'immagine.** La testata è testo: chi tiene le foto
  spente (in Gmail è la maggioranza) prima vedeva un riquadro vuoto al posto
  del marchio. Il secondo logo, quello del piè di pagina, non c'è più — al suo
  posto c'è il claim, che è quello che il logo avrebbe voluto dire.
- **Il colore dice il tipo di sconto, e non è decorazione.** Corallo pieno
  `#E8453C` **solo per i drop** (scadono, i posti finiscono): card con la foto
  dentro, badge a cavallo del bordo, pillola "scade tra…", barra dei posti.
  Crema `#FAF7F2` con il filetto d'oro `#8E6B3E` **per le convenzioni** (non
  scadono): niente barra, niente countdown, niente conteggio — al loro posto il
  chip mint "✓ sempre valido". Vestire da drop uno sconto permanente brucia
  l'urgenza anche sui drop veri: dopo due email chi legge impara che la fretta
  è finta. **Il bottone resta corallo in tutti e due**: il corallo è il colore
  dell'azione, cambia il blocco dello sconto, non la chiamata.
- **La voce di Bi passa da tre blocchi a una riga.** Prima: citazione
  incorniciata col filetto, più firma su tre righe, più riquadro. Adesso il
  testo è semplicemente il testo dell'email, e `— Bi` sta in coda all'ultimo
  paragrafo — che è dove finisce naturalmente chi scrive di suo pugno.
- **Un solo divisore**, quello sotto la testata. Lo stacco lo fa lo spazio.
- **Gerarchia:** logo 12/800 · occhiello 10/800/.15em · titolo 27-30/800 ·
  meta 13/600 oro · testo 14/1.6 · bottone 15/700 · piè di pagina 10.5-12px.
  Nessuno spazio oltre i 24px dentro il corpo.
- **Niente Caveat**, come sul sito: il corsivo scritto a mano resta ai tip
  dentro la scheda. La firma `— Bi` è Poppins 700 in oro.

I mattoni stanno in `api/_email/blocks.js`, uno per funzione: `eyebrow`, `h1`,
`metaLine`, `lede`, `p`, `photoMosaic`, `dropCard`, `conventionOffer`,
`button`, `microNote`, `textLink`, `checkRows`, `offerCard`, `codeBlock`,
`steps`, `note`, `dataTable`. Il guscio — testata, card, piè di pagina — sta in
`render.js` (`emailHeader`, `emailFooter`, `renderEmail`). Un'email nuova si
scrive mettendo i blocchi in fila, non scrivendo HTML.

---

## 3. Le foto

### Il mosaico 1+3

Va su **"nuovo in guida"** e sulle **convenzioni**: una foto grande 16:9 e
sotto fino a tre quadrate, staccate da tre pixel di bianco. È l'eco del
mosaico della scheda sul sito, e in un'email che presenta un locale le foto
*sono* il contenuto — è l'unico punto in cui questa revisione rimette dentro
altezza di proposito.

**Non** va sul drop: lì la foto sta dentro la card corallo con il badge a
cavallo del bordo, e un mosaico spaccherebbe il componente. Le email senza
locale (benvenuto, segnalazione, ristoratore) non hanno foto affatto.

Tre regole tecniche che non si saltano, in `photoMosaic`:

1. `font-size:0; line-height:0` su **ogni** cella che contiene un'immagine.
   Senza, i client aggiungono qualche pixel sotto ogni foto (l'immagine è un
   elemento di riga e si porta dietro lo spazio del rigo) e le tessere si
   sfalsano.
2. I distacchi sono `border` bianchi da 3px **sulle celle** — non padding, non
   spacer gif: il padding dentro una cella con un'immagine al 100% in Outlook
   allarga la tabella invece di stringere la foto.
3. `border-collapse:collapse` sulle due tabelle, o i bordi si sommano al
   `cellspacing` e i distacchi diventano sei pixel.

**I quattro fallback**, tutti obbligatori e tutti coperti da
`tests/emails.test.mjs`:

| Foto | Cosa esce |
|---|---|
| 0 | una fascia sola a gradiente caldo con l'emoji della categoria — **mai un rettangolo grigio** |
| 1 | solo la grande, la riga sotto non si renderizza |
| 2 | la grande e una fascia 2:1 sotto |
| 3 | la grande e due tessere al 50% |
| 4 o più | mosaico pieno, con `+N` sull'ultima (`N = totale − 4`; se `N ≤ 0` il badge non si mette) |

> L'handoff v11 scriveva "2 foto → grande + due tessere al 50%", che sono tre
> immagini con due foto. La scala qui sopra è quella coerente, e rispetta la
> regola che conta: mai una tessera vuota, mai un buco.

Il badge `+N` e il badge `−30%` del drop usano `position:absolute`, che il
motore di Word non sa posizionare: stanno dentro un `<!--[if !mso]>` così in
Outlook non cadono in mezzo alla pagina. Il badge del drop ha anche una
versione `<!--[if mso]>` dentro la riga della pill, a destra; il `+N` no,
perché lì la foto pulita è già il caso buono.

### Il ritaglio

Il ritaglio non si può fare nel client di posta: `object-fit` in Outlook non
esiste, e mettere un'altezza fissa senza ritagliare schiaccia la foto. Quindi
lo fa il server, con il proxy che c'era già:

```
/api/img?url=<foto>&w=1200&h=676&fit=cover&fm=jpg&q=78
```

- `fit=cover` con `position: 'attention'` — sharp tiene la parte con più
  contenuto invece del centro geometrico. Provato: su un fotogramma verticale
  1080×1920 con bande nere sopra e sotto, restituisce sola foto.
- Le misure sono al doppio di quelle finali, per gli schermi a doppia densità:
  la grande `1200×676` (16:9 di 600), le tessere `420×420`.
- `q=78` sul mosaico. Gmail tronca il messaggio quando HTML più immagini
  superano una soglia, e la prima cosa che sparisce è il piè di pagina — cioè
  il link per disiscriversi, che non è facoltativo. Le quattro foto insieme
  devono stare sotto i ~400KB.
- `fm=jpg` perché il WebP che il proxy servirebbe di sua iniziativa, in Outlook
  2016 e in qualche webmail, resta un riquadro vuoto.
- La sorgente è `photo_url` (piena) e non `thumb_url` (400px).
- **`alt` sempre valorizzato**: molti client bloccano le foto di default, e al
  loro posto restava un buco bianco.

---

## 3-bis. Il contenuto: le regole in `api/_email/content.js`

Quattro cose che in posta si vedevano più di tutto il resto, e che non erano
un problema di disegno ma di formattazioni fatte al volo dentro i template.

- **`clipSentences`** — il testo di Bi si taglia **su una frase intera**, mai a
  metà parola. Massimo due frasi e ~180 caratteri; se la seconda sfora si tiene
  solo la prima. Prima in posta si leggeva «…paella (sempre di pesce, carne,
  verdu…»: tagliare a caso non fa sembrare il testo lungo, fa sembrare il
  prodotto rotto.
- **`priceSymbols`** — la fascia di prezzo esce in `€`/`€€`/`€€€`, non come
  numero grezzo. Prima: «Spagnolo · **2** · Torino».
- **`formatAddress`** — riusato dal sito, non riscritto: via e civico oppure
  piazza, niente CAP, niente "Torino TO, Italy".
- **`countdownWords`** — «3 giorni», «domani», «poche ore» invece di «3g 2h»,
  che è una sigla da cruscotto. In un'email si legge una volta sola e di fretta.
- **`perkBeyondValue`** — lo sconto detto una volta sola. Sul database metà
  dei titoli **sono** la percentuale e basta («30% di sconto»), e in un'email
  dove il numero è già il pezzo più grande ripeterlo sotto il badge lo
  diluisce. La riga del vantaggio resta solo quando dice qualcosa in più
  («10% sulle bevande Matcha», «1€ di sconto sui tramezzini»).

**Il preheader** è obbligatorio in ogni template: è la riga che decide se
aprono, e prima era sprecata sul logo («LA GUIDA DI BI BY CHIAMAMI BI»). Sta
in due `<div>` nascosti subito dopo `<body>` — il testo nel primo, quaranta
caratteri invisibili nel secondo, così il client non pesca anche la testata.

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
   le butta) e che gli apostrofi di un nome non spacchino l'HTML. Dopo la v11
   controllano anche che il marchio compaia una volta sola, che il divisore
   sia uno, che il testo di Bi non si tagli a metà parola, che il prezzo esca
   in €, che ogni immagine abbia un `alt` e che il mosaico gestisca tutti e
   quattro i casi di fallback.
9. Se il locale c'entra, passa le foto (`photos` + `photoCount`) e non una
   sola `photoUrl`, e passa `address`/`neighborhood`/`priceRange` grezzi: la
   formattazione la fa `content.js`, non il chiamante.
10. Se tocchi `render.js` o `blocks.js`, rilancia
    `node supabase/email-templates/build.mjs` — i due template di Supabase
    sono generati da lì, e `tests/supabase-templates.test.mjs` diventa rosso
    se restano indietro.

---

## 7. Le dodici email

| # | Quando | A chi | Oggetto | Disiscrizione |
|---|---|---|---|---|
| 1 | Registrazione completata | utente | `{Nome}, da adesso sei nel Bi Club` | sì |
| 2 | Drop pubblicato | lista sconti | `Ho acceso un drop da {Locale}` | sì |
| 3 | Convenzione pubblicata | lista sconti | `Da oggi hai il {valore} da {Locale}` | sì |
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

---

## 8. Cosa resta fuori dalla revisione v11

I quattro template rifatti sono **nuovo in guida**, **drop**, **convenzione** e
**benvenuto Bi Club**. Gli altri otto hanno preso il guscio nuovo (testata,
piè di pagina, scala tipografica, gronda da 20px) perché il guscio è condiviso,
ma il **blocco centrale è ancora quello di settembre**: la card dell'offerta
sull'inchiostro, il riquadro del codice, i passi numerati.

Da allineare subito dopo, cambiando solo il blocco centrale:

- **codice sconto preso** → blocco corallo o crema secondo il tipo di sconto,
  con il codice grande al posto della barra;
- **drop in scadenza** → card corallo, pill "scade domani", barra quasi piena;
- **segnalazione ricevuta** e **candidatura** → solo testo, niente foto;
- **email al ristoratore** → testata identica, corpo più asciutto e niente
  claim di Bi in fondo, che è voce rivolta agli utenti.

---

*Il file delle email era fatto bene in fondo (`_email/` esisteva già, con i
suoi commenti); quello che mancava era che ci passassero tutte.*
