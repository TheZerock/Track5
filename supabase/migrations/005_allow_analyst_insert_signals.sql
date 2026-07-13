-- ============================================================
-- Market Intelligence AI — Migración 005: 
-- Permisos de Inserción para Señales y Auditoría
-- ============================================================

-- Permitir que Analistas y Supervisores inserten señales (para análisis LLM en frontend/Edge Functions)
create policy "signals_insert_analyst_supervisor"
  on signals for insert
  with check (
    exists (
      select 1 from users u join roles r on u.role_id = r.id
      where u.id = auth.uid() and r.name in ('Analista', 'Supervisor')
    )
  );

-- Permitir que Analistas, Supervisores y Administradores inserten en audit_logs 
-- (necesario ya que el cliente web ejecutará las llamadas mock a la IA en esta demo)
create policy "audit_logs_insert_frontend"
  on audit_logs for insert
  with check (
    exists (
      select 1 from users u join roles r on u.role_id = r.id
      where u.id = auth.uid() and r.name in ('Analista', 'Supervisor', 'Administrador')
    )
  );
