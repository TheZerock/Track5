-- ============================================================
-- Market Intelligence AI — Migración 006: Centro de notificaciones
-- Tabla `notifications` + triggers que insertan una notificación
-- automáticamente cuando:
--   1) se crea una señal nueva en un activo que está en alguna
--      watchlist de un usuario (se notifica al dueño de la watchlist),
--   2) se crea un briefing nuevo (se notifica a Supervisores y
--      Administradores, que son quienes deben revisarlo/aprobarlo),
--   3) se crea una señal cuyo activo/condición coincide con una
--      alerta activa configurada por un usuario.
-- Reemplaza el cálculo client-side (localStorage) por persistencia
-- real en base de datos.
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. TABLA
-- ─────────────────────────────────────────────
create table if not exists notifications (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references users(id) on delete cascade,
  type        text not null check (type in ('signal', 'briefing', 'alert', 'escalation')),
  title       text not null,
  link        text not null,
  entity      text not null,
  entity_id   uuid not null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_user_created
  on notifications(user_id, created_at desc);

create index if not exists idx_notifications_user_unread
  on notifications(user_id, is_read);

alter table notifications enable row level security;

-- Cada usuario solo ve sus propias notificaciones
create policy "notifications_select_own"
  on notifications for select
  using (auth.uid() = user_id);

-- Cada usuario solo puede marcar como leídas las suyas
create policy "notifications_update_own"
  on notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- No hay policy de insert/delete para usuarios autenticados:
-- las notificaciones solo se crean vía los triggers (security definer)
-- de abajo, nunca directamente desde el frontend.

-- ─────────────────────────────────────────────
-- 2. TRIGGER: nueva señal → dueños de watchlists con ese activo
-- ─────────────────────────────────────────────
create or replace function public.notify_watchlist_owners_on_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  asset_symbol text;
begin
  select symbol into asset_symbol from assets where id = new.asset_id;

  insert into notifications (user_id, type, title, link, entity, entity_id)
  select distinct w.user_id, 'signal', 'Nueva señal ' || new.impact || ' detectada en ' ||
    coalesce(asset_symbol, 'un activo') || ' de tu watchlist', '/senales', 'signals', new.id
  from watchlists w
  join watchlist_assets wa on wa.watchlist_id = w.id
  where wa.asset_id = new.asset_id;

  return new;
end;
$$;

create or replace trigger trg_notify_signal_created
  after insert on signals
  for each row execute procedure public.notify_watchlist_owners_on_signal();

-- ─────────────────────────────────────────────
-- 3. TRIGGER: nuevo briefing → Supervisores y Administradores
-- ─────────────────────────────────────────────
create or replace function public.notify_reviewers_on_briefing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (user_id, type, title, link, entity, entity_id)
  select u.id, 'briefing', 'Nuevo briefing "' || new.title || '" creado', '/briefings', 'briefings', new.id
  from users u
  join roles r on u.role_id = r.id
  where r.name in ('Supervisor', 'Administrador');

  return new;
end;
$$;

create or replace trigger trg_notify_briefing_created
  after insert on briefings
  for each row execute procedure public.notify_reviewers_on_briefing();

-- ─────────────────────────────────────────────
-- 4. TRIGGER: nueva señal → alertas activas que coinciden
--    (mismas condiciones que ofrece el formulario de Alertas)
-- ─────────────────────────────────────────────
create or replace function public.notify_alert_owners_on_signal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  asset_symbol text;
begin
  select symbol into asset_symbol from assets where id = new.asset_id;

  insert into notifications (user_id, type, title, link, entity, entity_id)
  select a.user_id, 'alert',
    coalesce(asset_symbol, 'Tu activo') || ' cumplió tu alerta: "' || a.condition || '"',
    '/alertas', 'alerts', a.id
  from alerts a
  where a.asset_id = new.asset_id
    and a.is_active = true
    and (
      a.condition = 'Nueva señal generada'
      or (a.condition = 'Impacto positivo detectado' and new.impact = 'Positivo')
      or (a.condition = 'Impacto negativo detectado' and new.impact = 'Negativo')
      or (a.condition = 'Confianza mayor a 70%' and new.confidence > 70)
      or (a.condition = 'Confianza mayor a 85%' and new.confidence > 85)
      or (a.condition = 'Señal escalada' and new.status = 'Escalada')
    );

  return new;
end;
$$;

create or replace trigger trg_notify_alert_on_signal
  after insert on signals
  for each row execute procedure public.notify_alert_owners_on_signal();
