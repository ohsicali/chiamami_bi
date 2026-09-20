-- Fix per gli avvisi performance di Supabase (auth_rls_initplan +
-- multiple_permissive_policies), applicato in produzione il 20/09/2026.
-- Vedi docs/v4-status.md, sezione "20/09 — performance RLS".
--
-- Nessuna modifica di logica di accesso: solo (1) auth.uid() incapsulato in
-- (select auth.uid()) cosi' viene valutato una volta per query invece che una
-- volta per riga, e (2) rimozione/accorpamento di policy permissive duplicate
-- la cui condizione era gia' un sottoinsieme (o l'unione esplicita) di
-- un'altra policy sulla stessa tabella/azione.

-- ai_conversations
drop policy if exists "conv_owner_delete" on public.ai_conversations;
create policy "conv_owner_delete" on public.ai_conversations
  for delete to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "conv_owner_insert" on public.ai_conversations;
create policy "conv_owner_insert" on public.ai_conversations
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "conv_owner_select" on public.ai_conversations;
create policy "conv_owner_select" on public.ai_conversations
  for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "conv_owner_update" on public.ai_conversations;
create policy "conv_owner_update" on public.ai_conversations
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ai_messages (proprietario derivato da ai_conversations.user_id)
drop policy if exists "msg_owner_delete" on public.ai_messages;
create policy "msg_owner_delete" on public.ai_messages
  for delete to authenticated
  using ((select auth.uid()) = (select ai_conversations.user_id from ai_conversations where ai_conversations.id = ai_messages.conversation_id));

drop policy if exists "msg_owner_insert" on public.ai_messages;
create policy "msg_owner_insert" on public.ai_messages
  for insert to authenticated
  with check ((select auth.uid()) = (select ai_conversations.user_id from ai_conversations where ai_conversations.id = ai_messages.conversation_id));

drop policy if exists "msg_owner_select" on public.ai_messages;
create policy "msg_owner_select" on public.ai_messages
  for select to authenticated
  using ((select auth.uid()) = (select ai_conversations.user_id from ai_conversations where ai_conversations.id = ai_messages.conversation_id));

-- ai_user_preferences
drop policy if exists "ai_prefs_delete_own" on public.ai_user_preferences;
create policy "ai_prefs_delete_own" on public.ai_user_preferences
  for delete to public
  using ((select auth.uid()) = user_id);

drop policy if exists "ai_prefs_insert_own" on public.ai_user_preferences;
create policy "ai_prefs_insert_own" on public.ai_user_preferences
  for insert to public
  with check ((select auth.uid()) = user_id);

drop policy if exists "ai_prefs_select_own" on public.ai_user_preferences;
create policy "ai_prefs_select_own" on public.ai_user_preferences
  for select to public
  using ((select auth.uid()) = user_id);

drop policy if exists "ai_prefs_update_own" on public.ai_user_preferences;
create policy "ai_prefs_update_own" on public.ai_user_preferences
  for update to public
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- saved_lists
drop policy if exists "Owner manages own lists" on public.saved_lists;
create policy "Owner manages own lists" on public.saved_lists
  for all to public
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- saved_list_items
drop policy if exists "Owner manages own list items" on public.saved_list_items;
create policy "Owner manages own list items" on public.saved_list_items
  for all to public
  using (exists (select 1 from saved_lists l where l.id = saved_list_items.list_id and l.user_id = (select auth.uid())))
  with check (exists (select 1 from saved_lists l where l.id = saved_list_items.list_id and l.user_id = (select auth.uid())));

-- restaurant_suggestions: le due policy INSERT si sovrapponevano (stesso
-- ruolo, stessa azione). Accorpate in una sola con l'unione esatta delle due
-- condizioni originali (admin OR proprietario OR anonimo-con-email) — stesso
-- accesso effettivo, una sola valutazione invece di due.
drop policy if exists "Insert suggestions" on public.restaurant_suggestions;
drop policy if exists "Users or anon can insert suggestions" on public.restaurant_suggestions;
create policy "Insert suggestions" on public.restaurant_suggestions
  for insert to public
  with check (
    is_admin()
    or (select auth.uid()) = user_id
    or (user_id is null and email is not null)
  );

-- saved_restaurants: "Users manage own saves" permetteva solo il proprietario,
-- un sottoinsieme stretto di quello che le quattro policy sotto (Delete/Insert/
-- Read/Update own saves) gia' permettono (proprietario OR admin). Rimossa:
-- zero perdita di accesso, tolta solo la valutazione duplicata.
drop policy if exists "Users manage own saves" on public.saved_restaurants;

-- sponsored_placements: "Admins read all placements" (is_admin() su SELECT)
-- era un sottoinsieme stretto di "Admins write placements" (ALL, is_admin(),
-- che copre gia' il SELECT). Rimossa, stesso motivo.
drop policy if exists "Admins read all placements" on public.sponsored_placements;

-- Foreign key senza indice segnalata dall'advisor performance.
create index if not exists idx_email_notifications_log_sent_by on public.email_notifications_log (sent_by);
