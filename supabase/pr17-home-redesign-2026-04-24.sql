-- PR17 · Home redesign contestuale + Chiedi a Bi AI
-- Data: 2026-04-24
--
-- Tabelle:
--  1) sponsored_placements — annunci sponsorizzati per banner home (3 variant)
--  2) ai_conversations     — storia chat "Chiedi a Bi" per utente auth
--  3) ai_messages          — singoli messaggi (user/assistant/tool) in conversazione
--
-- Idempotente: puoi eseguire più volte senza side-effect.

-- =============================================================================
-- 1) sponsored_placements
-- =============================================================================
CREATE TABLE IF NOT EXISTS sponsored_placements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  variant         text NOT NULL CHECK (variant IN ('restaurant_discount', 'restaurant_plain', 'brand')),
  restaurant_id   uuid REFERENCES restaurants(id) ON DELETE CASCADE,
  brand_name      text,                   -- usato per variant='brand'
  brand_subtitle  text,                   -- sottotitolo card brand
  discount_id     uuid REFERENCES discounts(id) ON DELETE SET NULL,
  headline        text,                   -- override del titolo autogenerato
  subtitle        text,                   -- sottotitolo / meta line
  cta_label       text,                   -- override CTA primario
  cta_url         text,                   -- per variant='brand' link esterno
  cover_image_url text,                   -- foto hero (restaurant variants)
  logo_image_url  text,                   -- logo 72x72 (brand variant)
  priority        int2 NOT NULL DEFAULT 0,
  start_at        timestamptz NOT NULL DEFAULT now(),
  end_at          timestamptz NOT NULL,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- Vincoli coerenza variant
  CONSTRAINT sp_variant_coherence CHECK (
    (variant = 'restaurant_discount' AND restaurant_id IS NOT NULL AND discount_id IS NOT NULL) OR
    (variant = 'restaurant_plain'    AND restaurant_id IS NOT NULL AND discount_id IS NULL) OR
    (variant = 'brand'               AND brand_name IS NOT NULL)
  ),
  CONSTRAINT sp_period_valid CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_sponsored_placements_active
  ON sponsored_placements(active, start_at, end_at, priority DESC)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_sponsored_placements_restaurant
  ON sponsored_placements(restaurant_id) WHERE restaurant_id IS NOT NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_sponsored_placements_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sponsored_placements_updated_at ON sponsored_placements;
CREATE TRIGGER trg_sponsored_placements_updated_at
  BEFORE UPDATE ON sponsored_placements
  FOR EACH ROW EXECUTE FUNCTION set_sponsored_placements_updated_at();

ALTER TABLE sponsored_placements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone reads active placements" ON sponsored_placements;
CREATE POLICY "Anyone reads active placements" ON sponsored_placements
  FOR SELECT USING (
    active = true
    AND start_at <= now()
    AND end_at > now()
  );

DROP POLICY IF EXISTS "Admins read all placements" ON sponsored_placements;
CREATE POLICY "Admins read all placements" ON sponsored_placements
  FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admins write placements" ON sponsored_placements;
CREATE POLICY "Admins write placements" ON sponsored_placements
  FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

COMMENT ON TABLE sponsored_placements IS
  'Annunci sponsorizzati in home (3 variant: restaurant_discount, restaurant_plain, brand). Label "Annuncio" sempre visibile lato UI.';

-- =============================================================================
-- 2) ai_conversations
-- =============================================================================
CREATE TABLE IF NOT EXISTS ai_conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title      text,  -- opzionale, autogenerato dal primo prompt (es. primi 60 char)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user
  ON ai_conversations(user_id, updated_at DESC);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv_owner_select" ON ai_conversations;
CREATE POLICY "conv_owner_select" ON ai_conversations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "conv_owner_insert" ON ai_conversations;
CREATE POLICY "conv_owner_insert" ON ai_conversations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "conv_owner_update" ON ai_conversations;
CREATE POLICY "conv_owner_update" ON ai_conversations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "conv_owner_delete" ON ai_conversations;
CREATE POLICY "conv_owner_delete" ON ai_conversations
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE ai_conversations IS
  'Storia chat "Chiedi a Bi" per utente autenticato. Guest = effimero (non salvato).';

-- =============================================================================
-- 3) ai_messages
-- =============================================================================
CREATE TABLE IF NOT EXISTS ai_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content         jsonb NOT NULL,   -- testo, tool_use, tool_result
  metadata        jsonb,            -- es. model, input_tokens, output_tokens, tool_name
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_conv
  ON ai_messages(conversation_id, created_at);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "msg_owner_select" ON ai_messages;
CREATE POLICY "msg_owner_select" ON ai_messages
  FOR SELECT TO authenticated
  USING (
    auth.uid() = (SELECT user_id FROM ai_conversations WHERE id = conversation_id)
  );

DROP POLICY IF EXISTS "msg_owner_insert" ON ai_messages;
CREATE POLICY "msg_owner_insert" ON ai_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM ai_conversations WHERE id = conversation_id)
  );

DROP POLICY IF EXISTS "msg_owner_delete" ON ai_messages;
CREATE POLICY "msg_owner_delete" ON ai_messages
  FOR DELETE TO authenticated
  USING (
    auth.uid() = (SELECT user_id FROM ai_conversations WHERE id = conversation_id)
  );

COMMENT ON TABLE ai_messages IS
  'Singoli messaggi in una conversazione "Chiedi a Bi". Role: user|assistant|tool.';

-- =============================================================================
-- Done
-- =============================================================================
-- Verifica rapida:
--   SELECT COUNT(*) FROM sponsored_placements;
--   SELECT COUNT(*) FROM ai_conversations;
--   SELECT COUNT(*) FROM ai_messages;
