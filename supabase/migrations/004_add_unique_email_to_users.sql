-- ─────────────────────────────────────────────
-- 4. MIGRATION: Add UNIQUE constraint to users.email (Mejora 1)
-- ─────────────────────────────────────────────
ALTER TABLE users ADD CONSTRAINT users_email_key UNIQUE (email);
