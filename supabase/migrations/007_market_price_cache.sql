-- ============================================================
-- Market Intelligence AI — Migración 007: Caché persistente de precios
-- Reemplaza el caché en memoria de la Edge Function fetch-market-prices
-- (que se perdía en cada cold start) por una tabla real. También
-- funciona como caché compartido entre todos los usuarios, no uno
-- por instancia de la función.
--
-- Solo la Edge Function (con SUPABASE_SERVICE_ROLE_KEY, que ignora
-- RLS) lee/escribe esta tabla — no hay policies para anon/authenticated
-- a propósito, el frontend nunca la consulta directamente.
-- ============================================================

create table if not exists market_price_cache (
  symbol         text primary key,
  asset_id       uuid references assets(id) on delete cascade,
  price          numeric not null,
  change_pct     numeric not null default 0,
  sparkline_data jsonb not null default '[]'::jsonb,
  is_test_data   boolean not null default false,
  source         text not null,
  updated_at     timestamptz not null default now()
);

alter table market_price_cache enable row level security;
-- Sin policies: solo accesible vía service_role (Edge Function), que bypassa RLS.
