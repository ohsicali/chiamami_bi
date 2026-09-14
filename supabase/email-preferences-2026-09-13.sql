-- ===========================================================================
--  Preferenze email per utente + disiscrizione a un clic
--  Eseguire una volta sola sul progetto Supabase.
-- ===========================================================================
--
--  Perché serve: le email di annuncio (nuovo sconto, nuovo locale) vanno a
--  tutti gli utenti registrati. Mandare promozioni senza una via d'uscita a
--  un clic è fuori legge in UE, e i client di posta lo leggono come segnale
--  di spam: basta qualche segnalazione e finisce in spam anche la ricevuta
--  dello sconto, che invece serve davvero.
--
--  Il token è quello che rende la disiscrizione possibile SENZA far
--  accedere: chi apre la posta dal telefono della fidanzata non deve
--  ricordarsi la password per smettere di ricevere email.
-- ---------------------------------------------------------------------------

create table if not exists public.email_preferences (
  -- Punta a public.profiles, non a auth.users: PostgREST espone solo lo
  -- schema public, quindi l'embed `profiles!inner(...)` in recipientsFor()
  -- (api/_email/send.js) trova una relazione solo così. Vedi
  -- supabase/fix-email-preferences-fk-2026-09-14.sql per la cronaca del bug.
  user_id          uuid primary key references public.profiles(id) on delete cascade,
  -- Tre interruttori, uno per tipo di email. Le ricevute (hai preso lo
  -- sconto, l'hai usato) non hanno interruttore: rispondono a un gesto
  -- della persona e senza di loro resterebbe senza il suo codice.
  new_discounts    boolean not null default true,
  new_places       boolean not null default true,
  my_discounts     boolean not null default true,
  unsubscribe_token uuid not null default gen_random_uuid(),
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

create unique index if not exists email_preferences_token_idx
  on public.email_preferences (unsubscribe_token);

alter table public.email_preferences enable row level security;

-- L'utente vede e cambia solo le proprie preferenze.
drop policy if exists "Owner reads own email preferences" on public.email_preferences;
create policy "Owner reads own email preferences"
  on public.email_preferences for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Owner upserts own email preferences" on public.email_preferences;
create policy "Owner upserts own email preferences"
  on public.email_preferences for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "Owner updates own email preferences" on public.email_preferences;
create policy "Owner updates own email preferences"
  on public.email_preferences for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
--  Riga automatica alla registrazione
-- ---------------------------------------------------------------------------
--  Senza, un utente nuovo non ha riga e la query dei destinatari dovrebbe
--  fare una left join trattando "manca la riga" come "vuole tutto". Meglio
--  che la riga esista sempre: la regola sta in un posto solo.

create or replace function public.handle_new_user_email_prefs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.email_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_email_prefs on auth.users;
create trigger on_auth_user_created_email_prefs
  after insert on auth.users
  for each row execute function public.handle_new_user_email_prefs();

-- Riempi le righe per chi è già registrato.
insert into public.email_preferences (user_id)
select id from auth.users
on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
--  Lettura e scrittura col token, senza accedere
-- ---------------------------------------------------------------------------
--  `security definer` perché chi arriva dal link nell'email è anonimo: la
--  RLS qui sopra lo bloccherebbe. Il token fa da chiave — è un uuid v4, non
--  indovinabile — e le funzioni restituiscono e toccano SOLO la riga di
--  quel token, mai l'email o altri dati della persona.

create or replace function public.get_email_prefs_by_token(p_token uuid)
returns table (new_discounts boolean, new_places boolean, my_discounts boolean)
language sql
security definer
set search_path = public
as $$
  select p.new_discounts, p.new_places, p.my_discounts
  from public.email_preferences p
  where p.unsubscribe_token = p_token
  limit 1;
$$;

create or replace function public.set_email_prefs_by_token(
  p_token uuid,
  p_new_discounts boolean,
  p_new_places boolean,
  p_my_discounts boolean
)
returns table (new_discounts boolean, new_places boolean, my_discounts boolean)
language sql
security definer
set search_path = public
as $$
  update public.email_preferences p
     set new_discounts = coalesce(p_new_discounts, p.new_discounts),
         new_places    = coalesce(p_new_places,    p.new_places),
         my_discounts  = coalesce(p_my_discounts,  p.my_discounts),
         updated_at    = now()
   where p.unsubscribe_token = p_token
  returning p.new_discounts, p.new_places, p.my_discounts;
$$;

grant execute on function public.get_email_prefs_by_token(uuid) to anon, authenticated;
grant execute on function public.set_email_prefs_by_token(uuid, boolean, boolean, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------------
--  Log delle email transazionali
-- ---------------------------------------------------------------------------
--  Serve a non mandare due volte la stessa ricevuta: l'utente che apre due
--  volte la pagina dello sconto non deve ricevere due email col codice.

create table if not exists public.email_sent_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete cascade,
  kind       text not null,          -- 'discount-claimed' | 'discount-used' | 'welcome'
  ref_id     uuid,                   -- lo sconto, il riscatto, ecc.
  to_email   text,
  ok         boolean not null default true,
  error      text,
  sent_at    timestamptz not null default now()
);

create unique index if not exists email_sent_log_once_idx
  on public.email_sent_log (kind, ref_id)
  where ref_id is not null and ok;

create index if not exists email_sent_log_user_idx
  on public.email_sent_log (user_id, sent_at desc);

alter table public.email_sent_log enable row level security;
-- Ci scrive solo il server con la service role key (che salta la RLS):
-- nessuna policy per anon/authenticated è voluta.

-- ---------------------------------------------------------------------------
--  Indice mancante segnalato dall'advisor, già che ci siamo
-- ---------------------------------------------------------------------------
create index if not exists sponsored_placements_discount_id_idx
  on public.sponsored_placements (discount_id);
