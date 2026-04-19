# Chiamami Bi — email manifesto

**Come Bi scrive nelle email.** Da usare come base per tutte le transazionali e la newsletter. Il dev parte da qui e adatta il resto mantenendo questo tono.

---

## Chi scrive

**Bi** è un personaggio, non una macchina. Racconta dove mangiare a Torino in prima persona. Nel live la voce è già presente su `/verify` ("quando ti abbiamo inserito nella Guida di Bi", "un cliente mostra il telefono?"). Le email continuano quella conversazione, senza interromperla con un tono aziendale.

Operativamente: Augusto gestisce il brand, Bi è come firma il prodotto. Nelle email firma sempre **Bi**, mai "ChiamamiBi", mai "Il team". Il contatto umano (`info@chiamamibi.com`) è gestito da Augusto ma presentato come "rispondiamo qui".

---

## Regole tonali

**Fai**
- **Prima persona singolare** ("ti racconto", "ci vado", "ti mando")
- **Saluto informale** ("Ciao {nome}") — mai "Gentile", mai "Egregio"
- **Frasi corte** — max 2 righe ciascuna, un'idea per paragrafo
- **Verbo concreto** ("Accedi", "Apri", "Leggi", "Vai")
- **Italiano parlato** — usi "eh", "ok", "sai", virgole a fiato
- **Dettaglio pratico** prima di quello emotivo — prima cosa fai, poi perché
- **Chiusura semplice** — "A presto, Bi" / "Ci vediamo, Bi"

**Non fare**
- ❌ "Gentile utente / cliente / ristoratore"
- ❌ "Cordiali saluti", "Distinti saluti", "In fede"
- ❌ "Il nostro team", "La nostra piattaforma", "Il servizio"
- ❌ Maiuscolette formali in mezzo alla frase ("La informiamo che...")
- ❌ Emoji a raffica — al massimo una, e solo se davvero aggiunge
- ❌ CTA multiple — un bottone primario per email
- ❌ Disclaimer legale infilato nel corpo ("Il presente messaggio...") — vive solo nel footer
- ❌ "Risponderemo entro X giorni lavorativi" — troppo corporate

---

## Struttura standard

```
Subject: [verbo o fatto concreto, max 50 caratteri]
Preheader: [completa il subject, 40-70 caratteri]

Ciao {nome},

[Apertura — 1 riga: cosa è successo / perché ti scrivo]

[Corpo — 2-4 righe: la cosa che devi sapere o fare]

[CTA — un solo bottone corallo]

[Chiusura — 1 riga opzionale: cortesia o next step]

A presto,
Bi

---
[Footer legale minimo: chi siamo + unsubscribe + link privacy]
```

---

## Email di riferimento (plug-and-play)

### 1. Benvenuto ristoratore + PIN

**Quando:** Augusto aggiunge un locale dal pannello Admin e genera il PIN.
**Destinatario:** email ristoratore (raccolta durante onboarding offline).
**Tipo:** transazionale critica — deve arrivare al 100%.

```
Subject:    Sei nella Guida di Bi
Preheader:  Ecco il PIN per la tua Area Ristoratori

Ciao {nome_locale},

Ce l'abbiamo fatta: {nome_locale} è ufficialmente nella Guida di Bi.
Sei una delle tappe che consiglio a chi mi chiede dove mangiare a Torino.

Il tuo PIN è:

    {PIN_6_CIFRE}

Lo usi per entrare nell'Area Ristoratori su chiamamibi.com/verify.
Lì vedi chi ha salvato il tuo locale, chi ha generato uno sconto, chi l'ha
usato. Quando un cliente ti mostra il QR, apri "Verifica QR" e scansioni.
Il dispositivo viene ricordato — il PIN lo reinserisci solo se cambi device.

    [ Apri l'Area Ristoratori ]

Se ti serve una mano: info@chiamamibi.com o Instagram @chiamamibi.

A presto,
Bi

---
ChiamamiBi · Torino · info@chiamamibi.com
Questa email è stata inviata perché sei nella Guida di Bi come partner.
Privacy: chiamamibi.com/privacy
```

---

### 2. Conferma suggerimento utente

**Quando:** un utente compila il form "Suggerisci un locale".
**Destinatario:** email utente.
**Tipo:** transazionale soft — se salta non è drammatico, ma serve per chiudere il loop.

```
Subject:    Ho ricevuto il tuo suggerimento
Preheader:  Ci passo e ti faccio sapere

Ciao {nome_utente},

Grazie per avermi suggerito {nome_locale}. Ci vado al più presto —
se merita, finisce nella Guida.

Ogni segnalazione la leggo io, anche quelle che non passano il mio filtro.
Se ti va di suggerirne altri, sai dove trovarmi.

    [ Torna alla Guida ]

A presto,
Bi

---
ChiamamiBi · Torino · info@chiamamibi.com
Privacy: chiamamibi.com/privacy
```

---

### 3. Notifica Augusto (interna) — nuovo suggerimento

**Quando:** nuovo record in `suggestions` table.
**Destinatario:** `info@chiamamibi.com` (interno).
**Tipo:** interna operativa — tono più pratico, meno voce.

```
Subject:    [Bi] Nuovo suggerimento: {nome_locale}
Preheader:  Da {nome_utente} — {zona}

Nuovo suggerimento da rivedere in admin:

  Locale       {nome_locale}
  Zona         {zona}
  Categoria    {categoria}
  Suggerito da {nome_utente} · {email_utente}

  Nota:
  {nota}

  → Apri in admin: {url_admin}

---
Notifica automatica · chiamamibi.com/admin
```

---

### 4. Newsletter — prima uscita (bozza tonale)

**Quando:** utente ha confermato double opt-in.
**Destinatario:** iscritti newsletter.
**Tipo:** marketing — cadenza da decidere (mensile suggerita).

```
Subject:    Due posti nuovi in Guida (+ un drop)
Preheader:  Il consiglio del mese da Bi

Ciao,

Questo mese in Guida sono entrati due posti che mi hanno convinto subito:

• {locale_1} — {zona_1}
  {una_riga_perché}

• {locale_2} — {zona_2}
  {una_riga_perché}

E per questa settimana ho acceso uno sconto su {locale_drop}:
{testo_drop_breve}.

    [ Apri la Guida ]

Ci vediamo a Torino,
Bi

---
ChiamamiBi · Torino · info@chiamamibi.com
Non vuoi più ricevere queste email? Disiscriviti qui: {unsubscribe_url}
Privacy: chiamamibi.com/privacy
```

---

## Template HTML minimale (per il dev)

Tutti i template ereditano questo layout. Design: wordmark corallo in alto, body bianco, corpo in Satoshi, CTA corallo.

```html
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{subject}}</title>
</head>
<body style="margin:0;padding:0;background:#FAF7F2;font-family:-apple-system,'Satoshi',Helvetica,sans-serif;color:#22181C;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:0 auto;padding:32px 24px;">
    <tr>
      <td style="padding-bottom:24px;">
        <!-- Wordmark: per email preferire PNG invece di font custom (Alfa Slab One ha fallback limitato su client email) -->
        <img src="https://chiamamibi.com/assets/wordmark-corallo.png" alt="CHIAMAMI BI" width="180" height="auto" style="display:block;">
      </td>
    </tr>
    <tr>
      <td style="font-size:16px;line-height:1.55;">
        {{body_html}}
      </td>
    </tr>
    <tr>
      <td style="padding-top:32px;">
        <a href="{{cta_url}}" style="display:inline-block;background:#E8453C;color:#fff;text-decoration:none;padding:14px 28px;border-radius:999px;font-weight:700;">{{cta_label}}</a>
      </td>
    </tr>
    <tr>
      <td style="padding-top:40px;font-size:13px;color:#8E6B3E;line-height:1.5;border-top:1px solid #EAE3D7;padding-top:16px;margin-top:40px;">
        ChiamamiBi · Torino · <a href="mailto:info@chiamamibi.com" style="color:#8E6B3E;">info@chiamamibi.com</a><br>
        <a href="https://chiamamibi.com/privacy" style="color:#8E6B3E;">Privacy</a>{{#unsubscribe}} · <a href="{{unsubscribe_url}}" style="color:#8E6B3E;">Disiscriviti</a>{{/unsubscribe}}
      </td>
    </tr>
  </table>
</body>
</html>
```

**Note per il dev:**
- Font custom (Alfa Slab One, Satoshi) non renderizzano affidabilmente in Gmail/Outlook → usare **font-stack sicuro** + wordmark come PNG per il brand
- Larghezza max **560px** (standard mobile-first)
- Colori da v4 tokens: `--corallo:#E8453C` per CTA, `--ink:#22181C` per testo, `--page:#FAF7F2` per bg, `--oro-deep:#8E6B3E` per footer
- CTA pill corallo arrotondato (`border-radius:999px`) per coerenza con mockup v4
- Dark mode: aggiungere `@media (prefers-color-scheme: dark)` overrides (opzionale v1)

---

## Checklist per ogni nuova email che il dev produce

Prima di inviare in prod:

- [ ] Subject < 50 caratteri, nessun tutto-maiuscolo
- [ ] Preheader completa il subject, non ripete
- [ ] Saluto: "Ciao {nome}"
- [ ] Prima persona singolare consistente
- [ ] Un solo CTA primario (corallo)
- [ ] Chiusura "A presto, Bi" o "Ci vediamo, Bi"
- [ ] Footer con link privacy + unsubscribe (se applicabile)
- [ ] Testato su Gmail + Apple Mail + Outlook (Litmus/Emailonacid opzionale)
- [ ] Unsubscribe funziona davvero (Resend gestisce nativo)
- [ ] Dark mode non rompe il layout

---

*v1.0 · 19 aprile 2026 · Bi non parla come un brand, parla come uno che sa dove mangiare.*
