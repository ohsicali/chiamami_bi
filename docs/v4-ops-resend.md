# Setup Resend — guida per Augusto

**Obiettivo:** configurare Resend (servizio di invio email transazionali) con il dominio `chiamamibi.com` verificato, così Bi può mandare email che **arrivano davvero** (non finiscono in spam) e **appaiono come mittente "Bi"**, non come una macchina anonima.

**Tempo stimato:** 20-30 minuti (il grosso è aspettare che il DNS si propaghi).
**Costo:** piano gratuito = **3.000 email/mese** + 1 dominio verificato. Copre la newsletter iniziale e tutte le transazionali.

---

## Cosa consegni al dev alla fine

1. **Dominio verificato** in Resend (`chiamamibi.com`) — si vede dal flag verde nella dashboard
2. **API key** (stringa tipo `re_...`) con permessi di invio
3. Conferma che il **test email** è arrivato alla tua casella non in spam

Quando hai questi tre, mandi tutto al dev.

---

## Step 1 — Crea account Resend

1. Vai su [resend.com](https://resend.com/) → **"Sign up"**
2. Registrati con **`info@chiamamibi.com`** (importante: usa l'email del dominio che vuoi verificare)
3. Conferma l'indirizzo dalla mail di verifica Resend
4. Al primo login ti chiede "Workspace name" → inserisci **`ChiamamiBi`**

**Check:** sei dentro la dashboard di Resend, URL tipo `resend.com/home`.

---

## Step 2 — Aggiungi il dominio

1. Dalla dashboard, menu laterale → **"Domains"**
2. Clicca **"Add Domain"**
3. Dominio: **`chiamamibi.com`** (senza `www`, senza `https://`)
4. Region: **`Europe (eu-west-1)`** — importante per GDPR, tiene i log in UE
5. Clicca **"Add"**

Resend ti mostra una lista di **record DNS da aggiungere** sul tuo provider (Aruba, Register, Cloudflare, dove hai registrato il dominio). Tieni la pagina aperta.

---

## Step 3 — Aggiungi i record DNS sul tuo provider

Vai sul pannello di controllo del **registrar di `chiamamibi.com`** (dove paghi il rinnovo del dominio). I casi più comuni in Italia sono Aruba, Register.it, GoDaddy, Cloudflare.

Resend ti chiede di creare **3-4 record**:

| Tipo | Nome/Host | Valore | Scopo |
|---|---|---|---|
| `MX` | `send` | `feedback-smtp.eu-west-1.amazonses.com` (priorità 10) | Ricevere bounces |
| `TXT` | `send` | `v=spf1 include:amazonses.com ~all` | SPF (autorizza invio) |
| `TXT` | `resend._domainkey` | `p=MIGfMA0GCSq...` (lunga stringa, copia TUTTO da Resend) | DKIM (firma crittografica) |
| `TXT` | `_dmarc` | `v=DMARC1; p=none;` | DMARC (policy anti-phishing) |

**Attenzione ai dettagli del provider:**

- Se il provider richiede il nome completo, usa `send.chiamamibi.com` invece di `send`
- Se richiede il nome completo, usa `resend._domainkey.chiamamibi.com` invece di `resend._domainkey`
- Per il DKIM (record lungo), **copia esattamente la stringa da Resend** — un carattere di troppo e non funziona
- Priorità MX: se il provider chiede un numero, è **10**

### Mini-guida per Aruba (il più comune in IT)

1. Login su [admin.aruba.it](https://admin.aruba.it/)
2. Scegli il dominio `chiamamibi.com`
3. **"Gestione DNS"** → **"Modifica DNS"** (se ti chiede di passare ai DNS Aruba, conferma)
4. Aggiungi i 4 record uno a uno (Aruba accetta il nome "breve" tipo `send`, aggiunge il dominio da sé)
5. Salva — Aruba dice "i cambiamenti si propagano in 2-24 ore"

### Mini-guida per Cloudflare

1. Login su [dash.cloudflare.com](https://dash.cloudflare.com/)
2. Scegli `chiamamibi.com` → **"DNS"** → **"Records"**
3. Aggiungi i 4 record (Cloudflare vuole il nome breve tipo `send`)
4. **Importante:** per i record TXT metti il **proxy su "DNS only"** (nuvoletta grigia, non arancione)
5. Salva — propagazione quasi immediata

---

## Step 4 — Verifica il dominio su Resend

1. Torna su Resend → **Domains** → clicca su `chiamamibi.com`
2. Clicca **"Verify DNS Records"** in alto a destra
3. Se hai messo i record corretti, dopo 5-30 minuti tutti i check diventano verdi ✅
4. Se qualcuno resta rosso dopo 30 minuti:
   - Usa [mxtoolbox.com](https://mxtoolbox.com/) per verificare cosa risponde il tuo DNS
   - Cerca il record che manca (es. "TXT lookup `resend._domainkey.chiamamibi.com`")
   - Se non lo trova, torna al provider e controlla che sia salvato bene

**Check:** sulla pagina del dominio in Resend vedi **"Verified"** in verde, tutti i record con flag verde.

---

## Step 5 — Genera l'API key

1. Menu laterale Resend → **"API Keys"**
2. Clicca **"Create API Key"**
3. Nome: **`ChiamamiBi Production`**
4. Permission: **`Sending access`** (solo invio, non lettura)
5. Domain: **`chiamamibi.com`** (limita la key a questo dominio)
6. Clicca **"Add"**
7. **Copia subito la chiave** (inizia con `re_...`). Resend la mostra UNA volta sola.
   - Se la chiudi senza copiare, elimina e rigenera

**Salva la chiave in un posto sicuro** (1Password, Apple Keychain, Notes con password) — il dev la userà e la metterà nelle variabili di ambiente di Vercel, ma tu devi poterla recuperare se serve.

---

## Step 6 — Manda un'email di test

Questo serve a verificare che il sistema funziona davvero, prima di dare la chiave al dev.

1. Nella dashboard Resend → menu **"Emails"** → **"Send Test Email"**
2. Compila:
   - **From:** `Bi <ciao@chiamamibi.com>` (il nome dopo l'email è il display name)
   - **To:** la tua email personale (non info@chiamamibi.com, voglio vedere che arriva a un dominio diverso)
   - **Subject:** `Test Bi`
   - **Body:** `Ciao, questo è un test. — Bi`
3. Clicca **"Send"**
4. Apri la tua email personale e verifica:
   - ✅ L'email è arrivata nella Posta in arrivo (NON in spam/promozioni)
   - ✅ Il mittente appare come `Bi` (display name, non email anonima)
   - ✅ Non ci sono warning "mittente non verificato" in Gmail

Se è in spam: ✋ **NON procedere**, scrivi a Bi che il DKIM/SPF non è a posto e serve debugging.

**Check:** email arrivata in inbox con mittente `Bi`.

---

## Step 7 — Manda la chiave al dev

```
Ciao,

Resend pronto.

Workspace: ChiamamiBi (region eu-west-1)
Dominio verificato: chiamamibi.com
API key: re_...[resto della chiave]
From consigliato: Bi <ciao@chiamamibi.com>
Reply-to consigliato: info@chiamamibi.com

Test email mandato e arrivato non in spam.

Se serve altro (seconda key per staging, altro dominio, cambio reply-to), dimmi.

A presto,
Augusto
```

---

## Checklist finale

- [ ] Account Resend creato con `info@chiamamibi.com`
- [ ] Dominio `chiamamibi.com` aggiunto, region EU
- [ ] 4 record DNS aggiunti sul provider (MX `send`, SPF, DKIM, DMARC)
- [ ] Dominio verificato (flag verde)
- [ ] API key `ChiamamiBi Production` creata con Sending access
- [ ] Chiave copiata e salvata in password manager
- [ ] Test email mandato a email personale → arrivato NON in spam
- [ ] Chiave + info mandata al dev

---

## Se qualcosa va storto

| Problema | Soluzione |
|---|---|
| DNS non verifica dopo 1h | Usa mxtoolbox.com per controllare ogni record uno a uno. Spesso è un typo nel TXT DKIM |
| Email di test arriva in spam | SPF/DKIM non sono ancora propagati — aspetta altre 2h e riprova. Se dopo 24h ancora in spam, probabile DMARC policy troppo stretta |
| "Domain already in use" quando aggiungi | Qualcuno ha già un workspace Resend con quel dominio. Contatta support@resend.com |
| Email rifiutata da Gmail con "550 5.7.26" | Manca il record DMARC o è malformato |
| Non ricordi se hai `ciao@` attivo come casella | Non serve che esista davvero — Resend lo usa solo come mittente. Ma usa un alias reale (`info@`, `ciao@`) gestito sulla mail Aruba/Google Workspace se vuoi ricevere risposte |

---

## Bonus: aliases utili sul dominio

Quando hai Resend attivo, conviene avere questi indirizzi **reali** sul dominio `chiamamibi.com` (configurati via mail hosting, non Resend):

- **`info@chiamamibi.com`** — già esiste, rimane il contatto umano principale
- **`ciao@chiamamibi.com`** — alias di `info@`, diventa il mittente "friendly" di Bi
- **`no-reply@chiamamibi.com`** — opzionale, solo se vuoi distinguere transazionali da marketing

Se il tuo provider di posta è Aruba, li configuri nel pannello Mail. Se hai Google Workspace, in Admin → Gruppi o alias utente.

---

*v1.0 · 19 aprile 2026 · Guida operativa per Augusto. Output: dominio verificato + API key Resend pronta per il dev.*
