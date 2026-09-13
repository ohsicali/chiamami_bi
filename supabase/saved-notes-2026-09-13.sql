-- BLOCCO 6 bis — Le note personali sui salvati.
--
-- La nota sta su `saved_restaurants` e NON su `saved_list_items`: un locale
-- è una cosa sola, e chi ci scrive sopra "il tavolo in fondo, quello vicino
-- alla finestra" non intende scriverlo una volta per ogni lista in cui il
-- locale capita. Sulle righe di lista la stessa nota comparirebbe più volte
-- e si potrebbe correggere in un posto solo: sarebbe la persona a dover
-- ricordare in quale.
--
-- La conseguenza voluta è che la nota sopravvive alle liste: si cancella una
-- lista e la nota resta, perché appartiene al salvataggio. Sparisce solo
-- quando si toglie il cuore, ed è l'unico momento in cui è giusto.

ALTER TABLE saved_restaurants
  ADD COLUMN IF NOT EXISTS note text;

-- Un limite serve, se no una nota incollata da chissà dove gonfia ogni
-- lettura dei salvati. 600 caratteri sono un pensiero, non un tema.
ALTER TABLE saved_restaurants
  DROP CONSTRAINT IF EXISTS saved_restaurants_note_len;
ALTER TABLE saved_restaurants
  ADD CONSTRAINT saved_restaurants_note_len CHECK (note IS NULL OR char_length(note) <= 600);

-- La policy "Users manage own saves" è FOR ALL ma non aveva WITH CHECK: così
-- com'era, un UPDATE su una riga propria poteva riscriverne lo `user_id` e
-- regalarla a un altro profilo. Finché le colonne erano solo i due
-- riferimenti la cosa non serviva a niente; con una colonna di testo
-- scrivibile conviene chiuderla prima che serva a qualcosa.
DROP POLICY IF EXISTS "Users manage own saves" ON saved_restaurants;
CREATE POLICY "Users manage own saves" ON saved_restaurants
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- NOTA per chi legge fra sei mesi: la policy "Admin read all saves" resta
-- com'è, quindi l'amministratore vede anche le note. Non la restringiamo a
-- colonne perché i GRANT per colonna su questo progetto hanno già rotto il
-- sito una volta (vedi hotfix-rollback-column-grants-2026-04.sql): il
-- frontend fa `select('*')` e Postgres lo fa fallire se manca una colonna
-- sola. Se un giorno la privacy della nota diventa un requisito, la strada
-- è una vista senza la colonna, non un GRANT parziale.
