-- GAP-12 (DB layer): Row-Level Security as a CONTAINED, opt-in backstop.
--
-- Why it's shaped this way (see the recon in the PR): the app connects as
-- `postgres`, which has BYPASSRLS, so ordinary RLS policies are a total no-op for
-- normal traffic — a guarantee that this change cannot disturb the running app.
-- Real enforcement is reached ONLY by switching into a dedicated non-bypass role
-- (`app_tenant`) via `SET LOCAL ROLE` inside a transaction — the sole pooler-safe
-- way to bind a tenant to a query, since a session-level SET would leak across the
-- transaction pooler's reused connections. See src/lib/rls.ts (withRlsTenant).
--
-- Effect: no change for the pooled/extension-scoped app or unscopedPrisma; but a
-- raw query run through withRlsTenant() is DB-contained to one property even with
-- no WHERE clause (proven by tests/rls-leak.test.ts).
--
-- REVERSIBLE. To roll back:
--   DO $$ DECLARE t text; BEGIN
--     FOR t IN SELECT table_name FROM information_schema.columns
--              WHERE table_schema='public' AND column_name='property_id' LOOP
--       EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
--       EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', t);
--     END LOOP; END $$;
--   -- then: DROP OWNED BY app_tenant;  DROP ROLE app_tenant;

-- 1. The non-bypass role the app switches into for enforced isolation.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_tenant') THEN
    CREATE ROLE app_tenant NOLOGIN NOBYPASSRLS;
  END IF;
END $$;

-- The connecting role (postgres in prod) must be a member to SET ROLE into it.
GRANT app_tenant TO CURRENT_USER;
GRANT USAGE ON SCHEMA public TO app_tenant;

-- 2. Per tenant table (every table with a property_id): grant DML, enable RLS, and
--    add a policy that binds visibility/writes to the transaction-local property.
DO $$
DECLARE t text;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'property_id'
    ORDER BY table_name
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO app_tenant', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', t);
    -- USING governs read/update/delete visibility; WITH CHECK governs inserts/updates.
    -- When the GUC is unset, current_setting returns NULL → predicate is false → the
    -- role sees nothing (fail closed). withRlsTenant always sets it.
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I '
      'USING (property_id = current_setting(''app.property_id'', true)) '
      'WITH CHECK (property_id = current_setting(''app.property_id'', true))',
      t);
  END LOOP;
END $$;
