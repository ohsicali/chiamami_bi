# ADR 001 — Track A (compliance) first, reskin last

**Status:** Accepted  
**Date:** 19 Apr 2026  
**Branch:** `v4/track-a-disable-reviews-compliance`

## Contesto

v4 è un upgrade su sito **già live** (71 ristoranti, 4 utenti, PIN auth in prod). Tre tracce in scope:
- **A** — compliance (disattivazione recensioni/foto utenti + Privacy update)
- **B** — reskin visuale v4
- **C** — feature nuove (orari Google Places + email Resend)

## Decisioni

### D1. Ordine: A → C1 → C2 → B → C3 → QA
**Motivazione:**
- A è P0 legale (Privacy cita "recensioni, foto caricate" mentre il feature è ancora attivo → non-compliance ora). Deve chiudere per prima.
- C (feature) prima di B (reskin): feature producono dati reali per UI finale; disegnare componenti senza dato è cieco.
- B (reskin) tocca tutto il frontend → blast radius massimo → per ultimo, quando A+C hanno stabilizzato contratti dati.
- C3 (newsletter) P2 → ultimo.

### D2. Admin reskin fuori scope primo rollout
**Motivazione:** 0 utenti pubblici, UI complessa. Eccezione: rimozione TAN Songbird dal logo admin per coerenza non-negoziabile #6.

### D3. Segnalazioni NON costruita ora (solo rimozione voce)
**Motivazione:** YAGNI. Senza dati reali dai 4 utenti, la feature è speculativa. Google Places orari automatici sono già un safety net. Ricostruire in futuro se serve.

### D4. Base branch = produzione (`claude/chiamamibi-app-xf7qn`)
**Motivazione:** evita drift tra docs e codice feature. `docs/v4-handoff` mergia separatamente (PR #63).

### D5. `place_id` via script ibrido + admin review
**Motivazione:** batch puro rischia match sbagliati sistematici. Manuale puro è 2.5h spese male. Script genera candidato + confidence; admin in-page approva/correggi/skip. 71 locali × 20 sec = 25 min review.

### D6. Resend config assunta valida (il primo task è canary)
**Motivazione:** `api/welcome-email.js` usa già `RESEND_API_KEY` + dominio `chiamamibi.com`. Se il live funziona, è configurato. Track C2a (adattamento welcome) verifica tutto in uno.

## Non-negoziabili (contratto)

1. Zero recensioni / stelline / rating / foto utenti (mai nel codice nuovo)
2. PIN-only auth ristoratore — non toccare flow esistente
3. Voce Bi 1a persona singolare
4. "Secondo Bi" = nome blocco editoriale (Caveat)
5. Caveat SOLO editoriale Bi
6. Niente TAN Songbird
7. Non cancellare dati storici (disabilitare scrittura, preservare SELECT per integrity)
8. Mobile-first

## Cosa NON faccio senza approvazione esplicita

- Merge su produzione
- Esecuzione SQL su Supabase prod
- Modifica Privacy/Termini/Cookies/Chi-è-Bi (ti faccio vedere il diff prima)
- `npm install` di nuove dipendenze
- Cancellazione dati storici

## Rollback plan

| Fase | Rollback |
|---|---|
| A1 (RLS disable) | Re-grant via controbackscript SQL (allegato in stessa PR) |
| A2/A3 (UI removal) | Git revert PR |
| A4 (Privacy) | Git revert file + nuovo deploy |
| C1 (Places) | Feature flag off → fallback "Chiama il locale" |
| C2 (Email) | Env var off → chiamate fetch falliscono gracefully, flusso prosegue |
| B (Reskin) | Git revert PR singolo componente |

Vercel instant rollback sempre disponibile via dashboard.

## Struttura PR

Un PR per task logico. Naming: `v4/track-[a|b|c]-<nome>`. Tutte draft finché Augusto non approva merge.

## Review checklist (ogni PR)

- [ ] Zero riferimenti a "recensioni" / rating / stars nel codice nuovo
- [ ] Zero TAN Songbird
- [ ] Caveat solo in blocchi editoriali Bi
- [ ] Voce Bi 1a persona nei copy user-facing
- [ ] Mobile first: test responsive ≤375px
- [ ] Dati storici preservati (no DROP TABLE, no DELETE)
- [ ] Env vars non nel repo
- [ ] Fail gracefully su API esterne giù
