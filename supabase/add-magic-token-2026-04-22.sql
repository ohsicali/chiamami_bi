-- PR12c · Magic-link token for partner email CTA auto-verify
-- Adds columns + RPC to restaurants for one-shot auto-login from email link.

alter table public.restaurants
  add column if not exists magic_token text,
  add column if not exists magic_token_expires_at timestamptz;

create index if not exists idx_restaurants_magic_token
  on public.restaurants (magic_token)
  where magic_token is not null;

-- Returns restaurant_id + partner_email if (token, pin) match and not expired.
-- Atomic: clears the token on match so it's one-shot.
create or replace function public.verify_magic_token(p_token text, p_pin text)
returns table (restaurant_id uuid, partner_email text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.restaurants r
  set
    magic_token = null,
    magic_token_expires_at = null
  where
    r.magic_token = p_token
    and r.verify_pin = p_pin
    and r.magic_token_expires_at > now()
  returning r.id, r.partner_email;
end;
$$;

grant execute on function public.verify_magic_token(text, text) to anon, authenticated;
