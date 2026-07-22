-- GAP-12 (DB layer): Row-Level Security as a contained, opt-in backstop.
--
-- IMPORTANT platform notes (learned the hard way — see the PR history):
--   * The app connects as `postgres`, which has BYPASSRLS, so RLS is a NO-OP for
--     all normal app traffic — that's what makes enabling it safe. Enforcement is
--     reached only by SET LOCAL ROLE into a non-bypass role (see src/lib/rls.ts).
--   * On Supabase you CANNOT grant a role membership to `postgres` (it terminates
--     the connection), so a custom `app_tenant` role can't be switched into. We use
--     Supabase's built-in non-bypass role `authenticated`, which `postgres` can
--     already SET ROLE into. On local/CI (plain Postgres) we create it if missing.
--   * The tenant is bound with SET LOCAL + set_config INSIDE a transaction — the
--     only pooler-safe primitive (a session SET would leak across reused pooled
--     connections).
--
-- Bonus security effect: `anon`/`authenticated` already had blanket grants on every
-- public table (Supabase default) with NO row security, i.e. the tables were open
-- to the auto REST API. This adds a fail-closed policy, so those roles now see
-- nothing unless app.property_id is bound — closing that surface.
--
-- REVERSIBLE — rollback:
--   DO $$ DECLARE t text; BEGIN
--     FOR t IN SELECT table_name FROM information_schema.columns
--              WHERE table_schema='public' AND column_name='property_id' LOOP
--       EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
--       EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
--     END LOOP; END $$;

-- Fail fast instead of hanging if a table lock can't be had (a stuck DDL migration
-- is worse than a failed one — it holds locks and blocks traffic).
SET LOCAL lock_timeout = '5s';

-- Supabase ships `authenticated`; local/CI Postgres does not, so create it there.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOBYPASSRLS;
  END IF;
END $$;

-- Per tenant table (every table with a property_id): make sure the enforcement
-- role can reach it, enable RLS, and bind visibility/writes to the transaction-
-- local property. The policy applies to all non-bypass roles (PUBLIC); `postgres`
-- bypasses it, so the app is unaffected.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'property_id'
    ORDER BY table_name
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I '
      'USING (property_id = current_setting(''app.property_id'', true)) '
      'WITH CHECK (property_id = current_setting(''app.property_id'', true))',
      t);
  END LOOP;
END $$;
