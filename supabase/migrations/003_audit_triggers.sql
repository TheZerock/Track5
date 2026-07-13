-- ============================================================
-- Market Intelligence AI — Migración 003: Triggers de auditoría
-- Registra automáticamente en audit_logs las acciones RF-017 /
-- SRS §23 que hasta ahora dependían de un service_role manual.
-- ============================================================

-- WATCHLISTS: watchlist.create
create or replace function public.log_watchlist_create()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_logs (user_id, action, entity, entity_id, previous_state, new_state)
  values (auth.uid(), 'watchlist.create', 'watchlists', new.id, null, jsonb_build_object('name', new.name));
  return new;
end;
$$;

create or replace trigger trg_watchlist_create
  after insert on watchlists
  for each row execute procedure public.log_watchlist_create();

-- ALERTS: alert.create
create or replace function public.log_alert_create()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into audit_logs (user_id, action, entity, entity_id, previous_state, new_state)
  values (
    auth.uid(), 'alert.create', 'alerts', new.id, null,
    jsonb_build_object('asset_id', new.asset_id, 'condition', new.condition, 'is_active', new.is_active)
  );
  return new;
end;
$$;

create or replace trigger trg_alert_create
  after insert on alerts
  for each row execute procedure public.log_alert_create();

-- SIGNALS: signal.status_change (solo cuando el status realmente cambia)
create or replace function public.log_signal_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into audit_logs (user_id, action, entity, entity_id, previous_state, new_state)
    values (
      auth.uid(), 'signal.status_change', 'signals', new.id,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status, 'review_comment', new.review_comment)
    );
  end if;
  return new;
end;
$$;

create or replace trigger trg_signal_status_change
  after update on signals
  for each row execute procedure public.log_signal_status_change();

-- BRIEFINGS: briefing.approve / briefing.status_change (solo cuando cambia)
create or replace function public.log_briefing_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into audit_logs (user_id, action, entity, entity_id, previous_state, new_state)
    values (
      auth.uid(),
      case when new.status = 'Aprobado' then 'briefing.approve' else 'briefing.status_change' end,
      'briefings', new.id,
      jsonb_build_object('status', old.status),
      jsonb_build_object('status', new.status)
    );
  end if;
  return new;
end;
$$;

create or replace trigger trg_briefing_status_change
  after update on briefings
  for each row execute procedure public.log_briefing_status_change();
