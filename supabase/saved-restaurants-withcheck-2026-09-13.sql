-- saved_restaurants — la policy del proprietario, chiusa anche in scrittura.
--
-- "Users manage own saves" è `FOR ALL` ma non aveva `WITH CHECK`: `USING` da
-- solo decide quali righe si possono toccare, non che aspetto possono avere
-- dopo. Senza, un UPDATE su una riga propria poteva riscriverne lo `user_id`
-- e spostare il salvataggio nel profilo di qualcun altro.
--
-- Finché le uniche colonne erano i due riferimenti la cosa non serviva a
-- niente, perché non c'era motivo di fare UPDATE su questa tabella. Resta
-- comunque il modo giusto di scrivere la policy, e costa zero.
--
-- Eseguito sul progetto Chiamami_bi il 2026-09-13.

DROP POLICY IF EXISTS "Users manage own saves" ON saved_restaurants;
CREATE POLICY "Users manage own saves" ON saved_restaurants
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Nota storica, perché il registro delle migrazioni ne porta il segno.
--
-- Lo stesso giorno era stata aggiunta una colonna `note` su questa tabella,
-- per le note personali sui salvati. La funzione è stata poi scartata prima
-- di arrivare in produzione, e la colonna è stata tolta: era vuota, zero
-- righe. Se un giorno le note tornassero, la colonna si riaggiunge con
--
--   ALTER TABLE saved_restaurants ADD COLUMN note text;
--
-- e un CHECK sulla lunghezza (allora era 600 caratteri).
-- ---------------------------------------------------------------------------

ALTER TABLE saved_restaurants DROP CONSTRAINT IF EXISTS saved_restaurants_note_len;
ALTER TABLE saved_restaurants DROP COLUMN IF EXISTS note;
