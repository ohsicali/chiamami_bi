-- ========================================================================
-- /verify — backfill PIN dai restaurant_partners esistenti
-- ========================================================================
-- Copia il PIN dei partner attivi in restaurants.verify_pin per i
-- ristoranti che non ne hanno già uno. Dopo questa migrazione, i PIN
-- già distribuiti ai ristoratori continuano a funzionare sulla nuova
-- pagina /verify.
--
-- Se più partner attivi per lo stesso ristorante hanno PIN diversi
-- viene scelto il più recente (created_at DESC).
-- ========================================================================

UPDATE restaurants r
SET verify_pin = sub.pin_code
FROM (
  SELECT DISTINCT ON (p.restaurant_id)
    p.restaurant_id,
    p.pin_code
  FROM restaurant_partners p
  WHERE p.is_active = true
    AND p.pin_code ~ '^[0-9]{6}$'
  ORDER BY p.restaurant_id, p.created_at DESC
) AS sub
WHERE sub.restaurant_id = r.id
  AND r.verify_pin IS NULL;

-- Verifica: conta quanti PIN sono stati copiati
SELECT COUNT(*) AS restaurants_with_verify_pin
FROM restaurants
WHERE verify_pin IS NOT NULL;

-- Segnala eventuali duplicati (due ristoranti con lo stesso PIN)
-- Se questa query restituisce righe, la login su /verify darà un errore
-- e va risolta manualmente cambiando uno dei PIN.
SELECT verify_pin, array_agg(id) AS restaurant_ids, array_agg(name) AS names
FROM restaurants
WHERE verify_pin IS NOT NULL
GROUP BY verify_pin
HAVING COUNT(*) > 1;
