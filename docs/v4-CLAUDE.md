# Chiamami Bi — regole permanenti per Claude Code

> Questo file è il contratto: leggilo all'inizio di ogni sessione. Tutto il resto è documentazione di supporto in `docs/`.

## Cos'è questo progetto

**chiamami.bi** è una guida curata ai ristoranti di Torino. Prodotto live in produzione. React + Vite + Vercel + Supabase + Mapbox. 71 ristoranti in DB, ~4 utenti (early phase).

## Non-negoziabili (mai violarli)

1. **Niente recensioni utente, niente stelline, nessun rating medio.** Il valore della Guida è la curatela di Bi. Zero rating da nessuna parte (homepage, scheda, admin, dashboard ristoratore).
2. **PIN-only auth ristoratore** (`/verify`). 6 cifre, cookie `verify_device_token`. NO email+password, NO Supabase Auth classico per ristoratori.
3. **Voce di Bi in prima persona singolare.** UI copy, email, blocchi editoriali. Mai "noi" / "il team" / "Gentile" / "Cordiali saluti".
4. **"Secondo Bi"** = nome del blocco editoriale sulla scheda locale (font Caveat).
5. **Font Caveat SOLO** in editoriale Bi. Mai in nav, bottoni, form, admin.
6. **Niente TAN Songbird.** Nomi locali in Poppins bold.
7. **Non cancellare dati storici** (recensioni vecchie, utenti). Solo disabilitare scrittura/lettura.
8. **Mobile-first.** Desktop è rifinitura.
9. **Nessun secret nel repo.** Tutto via env vars Vercel.

## Design tokens v4

```css
--ink: #22181C;        /* testo */
--corallo: #E8453C;    /* CTA, wordmark, accenti */
--page: #FAF7F2;       /* background */
--cream: #F5F0E4;      /* card */
--oro-deep: #8E6B3E;   /* footer, dettagli */
```

Font: Alfa Slab One (wordmark) · Caveat (editoriale Bi) · Poppins (body + nomi locali).

## Stack e vincoli tecnici

- Supabase project: `urcwnontifybzugmmiov`
- Mapbox GL per mappe
- Resend per email (dominio `chiamamibi.com` verified EU-west-1)
- Google Places API (New) per orari — chiave frontend referrer-restricted
- PIN-auth: flow custom, cookie `verify_device_token`, non Supabase Auth

Non introdurre librerie nuove senza chiedere a Augusto.

## Come lavori

- Proponi un plan prima di toccare codice (PLAN mode quando possibile)
- Un PR per task logico, branch `v4/track-[a|b|c]-[nome]`
- Chiedi conferma a Augusto prima di: Privacy Policy, DB schema, deploy prod
- Fail gracefully su API esterne (Places / Resend giù → sito non si rompe)

## Dove trovi il contesto completo

- `docs/v4-dev-brief.md` — scope v4 completo, tre tracce, env vars, priorità
- `docs/v4-pre-handoff.md` — gap analysis, rischi, legacy da gestire
- `docs/v4-email-manifesto.md` — voce Bi per email + 4 template
- `docs/v4-*.html` — mockup high-fidelity (reference visuale, non codice 1:1)

## Punti di contatto

Augusto — owner prodotto. Email: `info@chiamamibi.com`. Decide su scope, privacy, deploy.
