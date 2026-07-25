-- INOVAS Food — SYSTEM × RESTAURANT security boundary
-- Rollback for migration 016 on the isolated Preview branch only.

BEGIN;

DROP TABLE IF EXISTS public_restaurant_routes;

-- Restore the complete 015 policies by reapplying migration 015 after this
-- rollback if the Preview branch must return to its prior policy definition.

COMMIT;
