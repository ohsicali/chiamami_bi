# v4 — Stato Track

Ultima modifica: 2026-04-19

File di memoria per Claude: leggi questo a inizio sessione per sapere
dove siamo. Aggiorna a ogni step importante.

## Stato corrente

| Track | PR | Stato | Note |
|-------|----|----|----|
| A — Disable user reviews | #64 | ✅ Merged (02a1f99) | SQL eseguito, code live |
| C1 — Google Places hours | #65 | ✅ Merged (bf538f8) | Env + SQL + backfill fatti in sessioni precedenti |
| C2 — Email notifications | #66 | 🟡 Rebased, ready to merge | Env + SQL + test consegna email fatti |
| B — Reskin | — | ⏳ Not started | Next |
| C3 — (TBD) | — | ⏳ Not started | |

## Env vars Vercel — già configurate

- `RESEND_API_KEY` ✓ (funzionante dopo rigenerazione 2026-04-19)
- `RESEND_FROM` = `ChiamamiBi <noreply@chiamamibi.com>` ✓
- `GOOGLE_PLACES_KEY` ✓ (server-only, no VITE_ prefix)
- `SUPABASE_SERVICE_ROLE_KEY` ✓ (All environments)
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` ✓
- `VITE_GOOGLE_PLACES_KEY` — separato per client (se usato)

## SQL migrations eseguite

- `supabase/disable-user-reviews-2026-04-19.sql` ✓ (Track A)
- `supabase/add-google-places-fields-2026-04-19.sql` ✓ (Track C1)
- `supabase/add-email-notifications-log-2026-04-19.sql` ✓ (Track C2)

## Resend

- Dominio `chiamamibi.com` verificato (DKIM + SPF)
- Test delivery OK: ristorante, sconto, drop (iPhone Mail)

## Note importanti

- **Base branch**: tutti i v4 track → `claude/chiamamibi-app-xf7qn` (non `main`)
- **Design email C2**: rimandato a Track B (reskin) — per ora template funzionale OK
- **Backfill Places**: cleanup post-finish rimuovere `api/admin-backfill-places.js`,
  `src/pages/admin/BackfillPlaces.jsx`, rotta in `App.jsx`

## Prossimi step

1. Merge PR #66 (C2) dopo CI verde post-rebase
2. Iniziare Track B (reskin) — vedere `docs/v4-sitemap-reskin.md`,
   `docs/v4-email-manifesto.md`, `docs/mockups/`
3. Definire scope Track C3
