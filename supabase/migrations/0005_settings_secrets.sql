-- DVA Dashboard — Settings UI secrets storage
--
-- Adds GHL token + AI API key columns to ghl_settings so admins can
-- configure them from the Settings page instead of editing .env.
--
-- These columns are NEVER returned to the browser in plaintext — the
-- v_settings_status view only exposes last-4 + boolean "configured" flags.
-- The /api/settings/save route uses the service-role client to write them,
-- and RLS (set in 0002_rls.sql) already restricts writes to admin role only.
--
-- PRODUCTION NOTE: wrap the *_token / *_api_key columns with Supabase Vault
-- or pgsodium symmetric encryption for production. For a single-tenant
-- internal tool this is acceptable as-is because RLS + service-role is the
-- only access path.

alter table public.ghl_settings
  add column if not exists ghl_pit_token     text,
  add column if not exists openai_api_key    text,
  add column if not exists anthropic_api_key text;

create or replace view public.v_settings_status as
select
  id,
  location_id,
  case when ghl_pit_token     is null or ghl_pit_token     = '' then false else true end as ghl_configured,
  case when openai_api_key    is null or openai_api_key    = '' then false else true end as openai_configured,
  case when anthropic_api_key is null or anthropic_api_key = '' then false else true end as anthropic_configured,
  right(coalesce(ghl_pit_token,     ''), 4) as ghl_last4,
  right(coalesce(openai_api_key,    ''), 4) as openai_last4,
  right(coalesce(anthropic_api_key, ''), 4) as anthropic_last4,
  last_full_sync,
  updated_at
from public.ghl_settings;

grant select on public.v_settings_status to authenticated;
