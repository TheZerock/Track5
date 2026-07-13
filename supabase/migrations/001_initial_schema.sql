-- ============================================================
-- Market Intelligence AI — Migración 001: Esquema inicial
-- Secciones SRS: 15, 16.1–16.4, 22.1–22.2
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. EXTENSIONES
-- ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─────────────────────────────────────────────
-- 2. TABLA: roles  (SRS §16.2)
-- Valores exactos: Administrador / Analista / Supervisor / Invitado
-- ─────────────────────────────────────────────
create table if not exists roles (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique
    check (name in ('Administrador','Analista','Supervisor','Invitado')),
  description text
);

-- ─────────────────────────────────────────────
-- 3. TABLA: users  (SRS §16.1)
-- ─────────────────────────────────────────────
create table if not exists users (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  role_id     uuid references roles(id),
  created_at  timestamptz default now()
);

-- ─────────────────────────────────────────────
-- 4. TABLA: assets  (SRS §16.4)
-- type exacto: Acción / Cripto / ETF / Bono / Commodity / Divisa / Otro
-- ─────────────────────────────────────────────
create table if not exists assets (
  id      uuid primary key default uuid_generate_v4(),
  symbol  text not null unique,
  name    text not null,
  type    text not null
    check (type in ('Acción','Cripto','ETF','Bono','Commodity','Divisa','Otro')),
  sector  text
);

-- ─────────────────────────────────────────────
-- 5. TABLA: news  (SRS §16.3)
-- ─────────────────────────────────────────────
create table if not exists news (
  id           uuid primary key default uuid_generate_v4(),
  title        text not null,
  content      text not null,
  source       text not null,
  published_at timestamptz not null,
  sector       text,
  is_test_data boolean not null default false,
  created_at   timestamptz default now()
);

-- ─────────────────────────────────────────────
-- 6. ÍNDICES recomendados (SRS §16.11)
-- ─────────────────────────────────────────────
create index if not exists idx_news_published_at  on news(published_at);
create index if not exists idx_news_sector         on news(sector);
create index if not exists idx_news_source         on news(source);
create unique index if not exists idx_assets_symbol on assets(symbol);

-- ─────────────────────────────────────────────
-- 7. ROW LEVEL SECURITY (SRS §22.1–22.2, RNF-004)
-- ─────────────────────────────────────────────

-- ROLES — solo lectura para todos los autenticados
alter table roles enable row level security;

create policy "roles_select_authenticated"
  on roles for select
  using (auth.role() = 'authenticated');

-- USERS — cada usuario ve su fila; Administrador ve todas
alter table users enable row level security;

create policy "users_select_own"
  on users for select
  using (auth.uid() = id);

create policy "users_select_admin"
  on users for select
  using (
    exists (
      select 1 from users u
      join roles r on u.role_id = r.id
      where u.id = auth.uid() and r.name = 'Administrador'
    )
  );

create policy "users_insert_own"
  on users for insert
  with check (auth.uid() = id);

create policy "users_update_admin"
  on users for update
  using (
    exists (
      select 1 from users u
      join roles r on u.role_id = r.id
      where u.id = auth.uid() and r.name = 'Administrador'
    )
  );

-- NEWS — lectura para cualquier usuario autenticado (SRS §22.2 ejemplo)
alter table news enable row level security;

create policy "news_select_all_authenticated"
  on news for select
  using (auth.role() = 'authenticated');

-- Inserción solo desde Edge Functions (service_role) o Administrador
create policy "news_insert_service_or_admin"
  on news for insert
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1 from users u
      join roles r on u.role_id = r.id
      where u.id = auth.uid() and r.name = 'Administrador'
    )
  );

-- ASSETS — lectura para todos los autenticados; escritura solo Administrador o service_role
alter table assets enable row level security;

create policy "assets_select_all_authenticated"
  on assets for select
  using (auth.role() = 'authenticated');

create policy "assets_insert_service_or_admin"
  on assets for insert
  with check (
    auth.role() = 'service_role'
    or exists (
      select 1 from users u
      join roles r on u.role_id = r.id
      where u.id = auth.uid() and r.name = 'Administrador'
    )
  );

-- ─────────────────────────────────────────────
-- 8. TRIGGER: auto-crear fila en users al registrarse
-- ─────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  default_role_id uuid;
begin
  -- Asignar rol Invitado por defecto
  select id into default_role_id from roles where name = 'Invitado' limit 1;

  insert into users (id, email, full_name, role_id)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    default_role_id
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
