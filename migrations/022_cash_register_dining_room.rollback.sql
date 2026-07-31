-- Rollback for 022_cash_register_dining_room.sql.
-- This removes only the new Caixa / Salão structures.

BEGIN;

DELETE FROM role_permission_bindings
WHERE permission_key LIKE 'tenant.cash_register.%';

DELETE FROM permission_overrides
WHERE permission_key LIKE 'tenant.cash_register.%';

DELETE FROM permission_definitions
WHERE key LIKE 'tenant.cash_register.%';

DROP TABLE IF EXISTS cash_register_audit_events;
DROP TABLE IF EXISTS cash_register_movements;
DROP TABLE IF EXISTS cash_payments;
DROP TABLE IF EXISTS cash_payment_sets;
DROP TABLE IF EXISTS dining_order_batches;
DROP TABLE IF EXISTS dining_tab_items;
DROP TABLE IF EXISTS dining_tabs;
DROP TABLE IF EXISTS cash_register_sessions;
DROP TABLE IF EXISTS dining_tables;

COMMIT;
