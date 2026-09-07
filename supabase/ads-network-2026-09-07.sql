-- Circuito banner multi-posizione
-- Data: 2026-09-07
--
-- Estende `sponsored_placements` (creata in pr17-home-redesign-2026-04-24.sql)
-- da "un banner in home" a "N posizioni × N clienti con rotazione pesata".
--
-- Cosa cambia:
--   slot        → in quale posizione del sito esce l'annuncio. Le posizioni
--                 sono definite nel codice (src/lib/adSlots.js): una posizione
--                 esiste solo dove il componente è montato, quindi tenerne
--                 l'elenco in DB permetterebbe di creare slot fantasma.
--                 Niente CHECK sul valore per lo stesso motivo: aggiungere una
--                 posizione non deve richiedere una migrazione.
--   weight      → peso nell'estrazione casuale dentro lo slot. Due campagne
--                 con peso 5 e 5 escono al 50% ciascuna; 8 e 2 fanno 80/20.
--   link_type   → 'internal' porta alla scheda ristorante sul sito,
--                 'external' al link del cliente.
--   client_name → chi paga, per ritrovare la campagna in admin.
--   notes       → promemoria interni (contratto, referente, scadenze).
--
-- Le righe esistenti finiscono tutte in 'home_hero' con peso 1: la home
-- continua a mostrare quello che mostra oggi.
--
-- Idempotente: eseguibile più volte senza side-effect.

-- =============================================================================
-- 1) Nuove colonne
-- =============================================================================
ALTER TABLE sponsored_placements
  ADD COLUMN IF NOT EXISTS slot        text  NOT NULL DEFAULT 'home_hero',
  ADD COLUMN IF NOT EXISTS weight      int2  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS link_type   text  NOT NULL DEFAULT 'internal',
  ADD COLUMN IF NOT EXISTS client_name text,
  ADD COLUMN IF NOT EXISTS notes       text;

COMMENT ON COLUMN sponsored_placements.slot IS
  'Posizione nel sito. Valori validi definiti in src/lib/adSlots.js (home_hero, home_feed, list_inline).';
COMMENT ON COLUMN sponsored_placements.weight IS
  'Peso nella rotazione casuale dentro lo slot (1-10). Percentuale = weight / somma dei pesi attivi nello slot.';
COMMENT ON COLUMN sponsored_placements.link_type IS
  'internal = scheda ristorante sul sito; external = cta_url del cliente.';

-- =============================================================================
-- 2) Backfill: i brand esistenti hanno già un link esterno, allineiamo il tipo
-- =============================================================================
UPDATE sponsored_placements
   SET link_type = 'external'
 WHERE variant = 'brand'
   AND cta_url IS NOT NULL
   AND link_type <> 'external';

-- =============================================================================
-- 3) Vincoli
-- =============================================================================
-- Nota: nessun vincolo "brand ⇒ external", perché romperebbe eventuali righe
-- brand già in tabella senza cta_url. La regola è applicata dal form admin, e
-- il frontend non renderizza un annuncio senza destinazione valida.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sp_link_type_valid') THEN
    ALTER TABLE sponsored_placements
      ADD CONSTRAINT sp_link_type_valid CHECK (link_type IN ('internal', 'external'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sp_external_needs_url') THEN
    ALTER TABLE sponsored_placements
      ADD CONSTRAINT sp_external_needs_url CHECK (link_type <> 'external' OR cta_url IS NOT NULL);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sp_weight_range') THEN
    ALTER TABLE sponsored_placements
      ADD CONSTRAINT sp_weight_range CHECK (weight BETWEEN 1 AND 10);
  END IF;
END $$;

-- =============================================================================
-- 4) Indice per la query di rotazione (tutti gli slot in un colpo solo)
-- =============================================================================
DROP INDEX IF EXISTS idx_sponsored_placements_active;

CREATE INDEX IF NOT EXISTS idx_sponsored_placements_slot_active
  ON sponsored_placements(slot, start_at, end_at, weight DESC)
  WHERE active = true;

COMMENT ON TABLE sponsored_placements IS
  'Campagne pubblicitarie. Ogni riga è un cliente in una posizione (slot); dentro una posizione la scelta è casuale pesata a ogni caricamento pagina. Label "Annuncio" sempre visibile lato UI.';
