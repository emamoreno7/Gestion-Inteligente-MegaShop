-- =====================================================
-- MEGA SHOP RIVADAVIA - REGISTRO DE ACTIVIDAD DE USUARIOS
-- =====================================================
-- Registrar ingresos (logins) y modificaciones realizadas
-- por los usuarios: edición de precios, cobros, stock, etc.
-- =====================================================

create table if not exists public.user_activity_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  location_id uuid,
  action text not null,
  description text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists user_activity_logs_created_at_idx
  on public.user_activity_logs (created_at desc);

create index if not exists user_activity_logs_user_id_idx
  on public.user_activity_logs (user_id);

create index if not exists user_activity_logs_action_idx
  on public.user_activity_logs (action);

alter table public.user_activity_logs enable row level security;

drop policy if exists "authenticated access to activity logs" on public.user_activity_logs;
create policy "authenticated access to activity logs"
  on public.user_activity_logs
  for all to authenticated
  using (true)
  with check (true);