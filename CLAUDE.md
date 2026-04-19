# ChiamamiBi — Progetto Recap

## ⚠️ LEGGI PRIMA: stato v4 corrente
**Prima di iniziare qualsiasi lavoro sui v4 track leggi `docs/v4-status.md`** —
contiene lo stato esatto di PR, SQL eseguiti, env vars, e prossimi step.
Aggiornalo quando completi un passaggio.

## Cos'è
App web per scoprire ristoranti a Torino (e altre città italiane). Mappa interattiva, schede ristorante, recensioni utenti, sconti con QR code, pannello admin completo.
**Sito live**: chiamamibi.com | **Deploy**: Vercel | **DB**: Supabase

## Stack
- React 19 + Vite 8 + React Router 7
- Tailwind CSS 4 + Framer Motion
- Supabase (PostgreSQL, Auth, Storage, RLS)
- Mapbox GL (mappa), Recharts (grafici admin)
- i18next (5 lingue: it, en, fr, es, de)
- QR code per sconti, push notifications, service worker

## Struttura principale
```
src/
  pages/public/    → HomePage (mappa), RestaurantPage, ListView, DealsPage, LoginPage, ProfilePage, ecc.
  pages/admin/     → AdminDashboard, RestaurantForm, DiscountManager, ecc.
  components/      → Restaurant/, Discount/, Map/, Layout/, UI/, SEO/, Newsletter/
  lib/hooks/       → useAuth, useRestaurants, useDiscounts, useSavedRestaurants, ecc.
  lib/supabase.js  → Client Supabase
  lib/i18n.js      → Config i18next
api/
  resolve-maps.js  → Serverless function Vercel per risolvere link Google Maps
supabase/
  ESEGUI-TUTTO.sql → Schema DB completo (tutte le tabelle + RLS policies)
```

## BACKUP STABILE — NON TOCCARE SENZA MOTIVO
- **Tag**: `backup-working-2026-03-24`
- **Commit**: `9f3c9f6`
- **Ripristino**: `git checkout backup-working-2026-03-24 -- <file>`

### File critici che funzionano — testati e verificati:
1. **`api/resolve-maps.js`** — Risolve link Google Maps e compila automaticamente il form ristorante
   - Funziona con: `maps.app.goo.gl`, `share.google`, `goo.gl`, link completi `/place/...`
   - Link CID (`?cid=`) dall'app Maps iPhone: vengono risolti tramite redirect chain (CID → ?q=NomePosto)
   - Strategie ricerca in ordine: `/place/Name/` URL → `?q=` parametro URL → titolo pagina HTML
   - `followRedirects()`: usa mobile User-Agent (necessario per redirect HTTP 302 da goo.gl)
   - Consent cookies inviati SOLO a domini `google.com/maps` (non a goo.gl, rompe i redirect)
   - `isGenericQuery()` filtra: nomi città, CAP, query generiche Google
   - `extractFromHtml()`: estrae nome da title/og:title/og:description della pagina

2. **`src/pages/admin/RestaurantForm.jsx`** — Form creazione/modifica ristorante
   - Autofill da Google Maps con bottone "Compila automaticamente"
   - Rileva link CID e mostra messaggio utente appropriato
   - Gestisce: nome, indirizzo, coordinate, telefono, sito web, foto, categorie, sconti

3. **`supabase/ESEGUI-TUTTO.sql`** — Schema DB completo
   - Tabelle: profiles, restaurants, restaurant_photos, categories, discounts, discount_redemptions, restaurant_partners, user_reviews, user_review_photos, saved_restaurants, translations, newsletter_subscribers, partner_applications, push_subscriptions
   - `is_admin()` function con SECURITY DEFINER (evita ricorsione RLS su profiles)
   - Trigger `handle_new_user()` per creare profilo automatico alla registrazione

4. **`supabase/fix-profiles-recursion.sql`** — Fix per errore "infinite recursion in policy for profiles"

5. **`vercel.json`** — Config Vercel con `maxDuration: 30` per resolve-maps

## Problemi risolti (per riferimento futuro)
- **goo.gl non risolveva**: serviva mobile User-Agent per redirect HTTP 302
- **Consent cookies rompevano goo.gl**: inviarli solo a google.com/maps
- **CID URL (dall'app Maps iPhone)**: non risolvibili direttamente, ma il redirect chain li porta a `?q=NomePosto` che funziona
- **searchQuery era CAP invece di nome locale**: riordinato strategie, `?q=` ora ha priorità su titolo HTML
- **Profiles 500 (ricorsione RLS)**: rimossa policy "Admin read all profiles" ricorsiva, `is_admin()` con SECURITY DEFINER
- **Colonne mancanti DB**: `recommended_for`, `tiktok_url`, `instagram_reel` aggiunte con ALTER TABLE
- **Google CAPTCHA/sorry page**: rilevata e gestita con messaggio errore

## Connettori disponibili — USALI SE ATTIVI
- **GitHub** — PR, issues, merge (funziona via `gh` CLI, testato e operativo)
- **Supabase** — se il connettore è attivo, esegui query SQL direttamente. Se non funziona, fornisci SQL all'utente da eseguire nel dashboard Supabase. CLI disponibile (`npx supabase`) ma richiede login/token.
- **Vercel** — se il connettore è attivo, controlla deploy e log. CLI disponibile (`npx vercel`) ma richiede login. Se non funziona, i deploy avvengono automaticamente al push su GitHub.
- **Web** — ricerche web quando serve
- **NOTA**: nella sessione del 24/03/2026 le CLI Supabase e Vercel non erano autenticate. Verificare all'inizio di ogni sessione se i connettori funzionano.

## Credenziali e config
- API key Google Places: env var `VITE_GOOGLE_PLACES_KEY`
- Supabase: env vars `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`
- Admin email: `ale.cali@icloud.com`
- Region Vercel: default (non forzare US, causa CAPTCHA Google)
