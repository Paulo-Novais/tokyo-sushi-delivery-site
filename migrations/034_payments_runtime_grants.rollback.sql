-- Volta da 034: retira as permissões das tabelas novas (as tabelas ficam).
BEGIN;

DO $$
DECLARE
  runtime_role record;
BEGIN
  FOR runtime_role IN
    SELECT DISTINCT grantee
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name IN ('cash_register_operations', 'restaurant_presence', 'restaurant_ledger_entries',
                         'restaurant_payouts', 'online_payments', 'restaurant_payment_accounts')
      AND grantee NOT IN (current_user, 'PUBLIC')
  LOOP
    EXECUTE format(
      'REVOKE ALL ON cash_register_operations, restaurant_presence, restaurant_ledger_entries, restaurant_payouts, online_payments, restaurant_payment_accounts FROM %I',
      runtime_role.grantee
    );
  END LOOP;
END $$;

COMMIT;
