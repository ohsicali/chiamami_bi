-- Migration: newsletter_subscribers — subscribed flag, opted_out_at, user_id
-- Idempotente: può girare più volte senza errori.

alter table newsletter_subscribers
  add column if not exists subscribed boolean not null default true,
  add column if not exists opted_out_at timestamptz,
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_newsletter_subscribers_user_id
  on newsletter_subscribers(user_id);

create index if not exists idx_newsletter_subscribers_subscribed
  on newsletter_subscribers(subscribed) where subscribed = true;

-- Backfill: tutti i record esistenti sono iscritti (il vecchio schema non aveva opted-out)
update newsletter_subscribers
  set subscribed = true
  where subscribed is null;
