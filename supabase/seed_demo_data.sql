-- ============================================================
-- DEPRECATED as a standalone farm/user seeder.
--
-- Demo livestock data is now seeded from the Super Admin UI:
--   Farms → Seed demo / Clear demo / Reset farm
--
-- Backed by RPCs in migration 008, with the Boer goat herd in 012_demo_goat_seed.sql:
--   seed_farm_demo_data(company_id)
--   clear_farm_demo_data(company_id)
--   reset_farm_data(company_id)
--
-- Optional: call from SQL Editor as superadmin session isn't available
-- in the SQL editor the same way — prefer the UI, or run as:
--
--   select public.seed_farm_demo_data('YOUR-COMPANY-UUID');
--
-- Note: RPCs check auth.uid() role = superadmin, so SQL Editor
-- (which often runs as postgres/service role) may need:
--
--   set local role authenticated;
--   select set_config('request.jwt.claim.sub', 'SUPERADMIN-USER-UUID', true);
--
-- Easiest path: use Super Admin → Farms buttons in the app.
-- ============================================================

select
  'Use Super Admin → Farms → Seed demo / Clear demo / Reset farm' as how_to_seed;
