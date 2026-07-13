-- ============================================================
-- Market Intelligence AI — Migración 002: Señales, Briefings,
-- Watchlists, Alertas y Auditoría
-- Secciones SRS: 16.5–16.10, 22.1–22.2
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. TABLA: signals  (SRS §16.5)
-- impact exacto: Positivo / Negativo / Neutral / Incierto
-- status exacto: Pendiente / Revisada / Escalada / Descartada
-- ─────────────────────────────────────────────
create table if not exists signals (
  id                    uuid primary key default uuid_generate_v4(),
  news_id               uuid not null references news(id) on delete cascade,
  asset_id              uuid not null references assets(id) on delete cascade,
  impact                text not null
    check (impact in ('Positivo','Negativo','Neutral','Incierto')),
  confidence            integer not null
    check (confidence >= 0 and confidence <= 100),
  explanation           text not null,
  risks                 text,
  suggested_research    text,
  historical_comparison jsonb,
  status                text not null default 'Pendiente'
    check (status in ('Pendiente','Revisada','Escalada','Descartada')),
  reviewed_by           uuid references users(id),
  review_comment        text,
  created_at            timestamptz default now()
);

-- ─────────────────────────────────────────────
-- 2. TABLA: watchlists  (SRS §16.7)
-- (movida antes de briefings: briefings referencia watchlists(id))
-- ─────────────────────────────────────────────
create table if not exists watchlists (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references users(id) on delete cascade,
  name       text not null,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- 3. TABLA: briefings  (SRS §16.6)
-- status exacto: Borrador / En revisión / Aprobado / Escalado
-- ─────────────────────────────────────────────
create table if not exists briefings (
  id           uuid primary key default uuid_generate_v4(),
  title        text not null,
  watchlist_id uuid references watchlists(id),       -- nullable
  asset_id     uuid references assets(id),            -- nullable
  status       text not null default 'Borrador'
    check (status in ('Borrador','En revisión','Aprobado','Escalado')),
  created_by   uuid not null references users(id),
  approved_by  uuid references users(id),             -- nullable
  created_at   timestamptz default now()
);

-- ─────────────────────────────────────────────
-- 4. TABLA: watchlist_assets  (SRS §16.8)
-- ─────────────────────────────────────────────
create table if not exists watchlist_assets (
  id           uuid primary key default uuid_generate_v4(),
  watchlist_id uuid not null references watchlists(id) on delete cascade,
  asset_id     uuid not null references assets(id) on delete cascade,
  unique (watchlist_id, asset_id)   -- índice único compuesto (SRS §16.11)
);

-- ─────────────────────────────────────────────
-- 5. TABLA: alerts  (SRS §16.9)
-- ─────────────────────────────────────────────
create table if not exists alerts (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references users(id) on delete cascade,
  asset_id   uuid not null references assets(id) on delete cascade,
  condition  text not null,
  is_active  boolean not null default true,
  created_at timestamptz default now()
);

-- ─────────────────────────────────────────────
-- 6. TABLA: audit_logs  (SRS §16.10)
-- Inmutable: sin UPDATE ni DELETE para ningún rol
-- ─────────────────────────────────────────────
create table if not exists audit_logs (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid references users(id),   -- nullable: puede ser agente IA
  action         text not null,               -- ej. "signal.status_change"
  entity         text not null,               -- ej. "signals"
  entity_id      uuid not null,
  previous_state jsonb,
  new_state      jsonb,
  created_at     timestamptz default now()
);

-- ─────────────────────────────────────────────
-- 7. TABLA: briefing_signals  (relación señales-briefing)
-- No definida explícitamente en sección 16 pero necesaria para RF-009/RF-010
-- ─────────────────────────────────────────────
create table if not exists briefing_signals (
  id          uuid primary key default uuid_generate_v4(),
  briefing_id uuid not null references briefings(id) on delete cascade,
  signal_id   uuid not null references signals(id) on delete cascade,
  unique (briefing_id, signal_id)
);

-- ─────────────────────────────────────────────
-- 8. ÍNDICES recomendados (SRS §16.11)
-- ─────────────────────────────────────────────
create index if not exists idx_signals_asset_id    on signals(asset_id);
create index if not exists idx_signals_news_id     on signals(news_id);
create index if not exists idx_signals_status      on signals(status);
create index if not exists idx_signals_created_at  on signals(created_at);
create index if not exists idx_alerts_user_asset   on alerts(user_id, asset_id);
create index if not exists idx_audit_entity        on audit_logs(entity, entity_id);
create index if not exists idx_audit_created_at    on audit_logs(created_at);

-- ─────────────────────────────────────────────
-- 9. ROW LEVEL SECURITY (SRS §22.1–22.2, RNF-004)
-- ─────────────────────────────────────────────

-- SIGNALS
alter table signals enable row level security;

create policy "signals_select_authenticated"
  on signals for select
  using (auth.role() = 'authenticated');

-- Inserción solo desde Edge Functions (Agente 2) o Administrador
create policy "signals_insert_service_or_admin"
  on signals for insert
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1 from users u join roles r on u.role_id = r.id
      where u.id = auth.uid() and r.name = 'Administrador'
    )
  );

-- Cambio de estado: Analista / Supervisor / Administrador (SRS §22.1 + §22.2)
create policy "signals_update_review_roles"
  on signals for update
  using (
    exists (
      select 1 from users u join roles r on u.role_id = r.id
      where u.id = auth.uid()
        and r.name in ('Administrador','Analista','Supervisor')
    )
  );

-- BRIEFINGS
alter table briefings enable row level security;

create policy "briefings_select_authenticated"
  on briefings for select
  using (auth.role() = 'authenticated');

create policy "briefings_insert_authorized"
  on briefings for insert
  with check (
    exists (
      select 1 from users u join roles r on u.role_id = r.id
      where u.id = auth.uid()
        and r.name in ('Administrador','Analista','Supervisor')
    )
  );

-- Aprobación solo Supervisor / Administrador (SRS §22.1)
create policy "briefings_update_supervisor_admin"
  on briefings for update
  using (
    exists (
      select 1 from users u join roles r on u.role_id = r.id
      where u.id = auth.uid()
        and r.name in ('Administrador','Supervisor')
    )
  );

-- WATCHLISTS — solo propietario (SRS §22.2 ejemplo)
alter table watchlists enable row level security;

create policy "watchlists_owner_only"
  on watchlists for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- WATCHLIST_ASSETS — acceso via JOIN a watchlist propietario
alter table watchlist_assets enable row level security;

create policy "watchlist_assets_owner"
  on watchlist_assets for all
  using (
    exists (
      select 1 from watchlists w
      where w.id = watchlist_id and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from watchlists w
      where w.id = watchlist_id and w.user_id = auth.uid()
    )
  );

-- ALERTS — propietario puede hacer todo; Invitado no puede (RN-05)
alter table alerts enable row level security;

create policy "alerts_owner_not_guest"
  on alerts for all
  using (
    auth.uid() = user_id
    and exists (
      select 1 from users u join roles r on u.role_id = r.id
      where u.id = auth.uid() and r.name != 'Invitado'
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from users u join roles r on u.role_id = r.id
      where u.id = auth.uid() and r.name != 'Invitado'
    )
  );

-- AUDIT_LOGS — solo SELECT para Administrador y Supervisor (SRS §22.1–22.2)
-- ANALISTA solo ve los suyos; no hay UPDATE/DELETE para nadie
alter table audit_logs enable row level security;

create policy "audit_logs_select_admin_supervisor"
  on audit_logs for select
  using (
    exists (
      select 1 from users u join roles r on u.role_id = r.id
      where u.id = auth.uid()
        and r.name in ('Administrador','Supervisor')
    )
  );

create policy "audit_logs_select_analyst_own"
  on audit_logs for select
  using (
    auth.uid() = user_id
    and exists (
      select 1 from users u join roles r on u.role_id = r.id
      where u.id = auth.uid() and r.name = 'Analista'
    )
  );

-- Solo service_role puede insertar en audit_logs
create policy "audit_logs_insert_service"
  on audit_logs for insert
  with check (auth.role() = 'service_role');

-- BRIEFING_SIGNALS
alter table briefing_signals enable row level security;

create policy "briefing_signals_select_authenticated"
  on briefing_signals for select
  using (auth.role() = 'authenticated');

create policy "briefing_signals_insert_authorized"
  on briefing_signals for insert
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1 from users u join roles r on u.role_id = r.id
      where u.id = auth.uid()
        and r.name in ('Administrador','Analista','Supervisor')
    )
  );
