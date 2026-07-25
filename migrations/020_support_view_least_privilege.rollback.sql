-- INOVAS Food — SYSTEM × RESTAURANT security boundary
-- Rollback for database-enforced read-only Support VIEW policies.
-- Apply only to the isolated Preview database branch.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

DROP POLICY IF EXISTS inovas_admin_users_select ON admin_users;
CREATE POLICY inovas_admin_users_select ON admin_users
FOR SELECT USING (
  (
    current_setting('app.audience', true) = 'system'
    AND restaurant_key = ''
  )
  OR (
    current_setting('app.audience', true) IN ('restaurant', 'provisioning')
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND restaurant_key <> ''
  )
  OR (
    current_setting('app.audience', true) = 'support'
    AND current_setting('app.support_mode', true) = 'ADMIN'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND restaurant_key <> ''
  )
);

DROP POLICY IF EXISTS inovas_membership_select ON restaurant_memberships;
DROP POLICY IF EXISTS inovas_membership_insert ON restaurant_memberships;
DROP POLICY IF EXISTS inovas_membership_update ON restaurant_memberships;
DROP POLICY IF EXISTS inovas_membership_delete ON restaurant_memberships;
CREATE POLICY inovas_membership_access ON restaurant_memberships
FOR ALL
USING (
  current_setting('app.audience', true) = 'system'
  OR (
    tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND (
      identity_id = current_setting('app.identity_id', true)
      OR current_setting('app.audience', true) IN ('restaurant', 'support')
    )
  )
)
WITH CHECK (
  current_setting('app.audience', true) = 'system'
  OR (
    tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
  )
);

DROP POLICY IF EXISTS inovas_restaurant_binding_select ON restaurant_role_bindings;
DROP POLICY IF EXISTS inovas_restaurant_binding_insert ON restaurant_role_bindings;
DROP POLICY IF EXISTS inovas_restaurant_binding_update ON restaurant_role_bindings;
DROP POLICY IF EXISTS inovas_restaurant_binding_delete ON restaurant_role_bindings;
CREATE POLICY inovas_restaurant_binding_access ON restaurant_role_bindings
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM restaurant_memberships AS membership
    WHERE membership.id = membership_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM restaurant_memberships AS membership
    WHERE membership.id = membership_id
  )
);

DROP POLICY IF EXISTS inovas_auth_session_access ON auth_sessions;
CREATE POLICY inovas_auth_session_access ON auth_sessions
FOR ALL
USING (
  identity_id = current_setting('app.identity_id', true)
  OR (
    current_setting('app.audience', true) = 'system'
    AND audience = 'system'
  )
  OR (
    current_setting('app.audience', true) IN ('restaurant', 'support')
    AND audience = 'restaurant'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
  )
)
WITH CHECK (
  identity_id = current_setting('app.identity_id', true)
  OR (
    current_setting('app.audience', true) = 'system'
    AND audience = 'system'
  )
  OR (
    current_setting('app.audience', true) IN ('restaurant', 'support')
    AND audience = 'restaurant'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
  )
);

DROP POLICY IF EXISTS inovas_user_audit_select ON user_audit_events;
DROP POLICY IF EXISTS inovas_user_audit_insert ON user_audit_events;
CREATE POLICY inovas_user_audit_access ON user_audit_events
FOR ALL
USING (
  current_setting('app.audience', true) = 'system'
  OR (
    tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND current_setting('app.audience', true) IN ('restaurant', 'support')
  )
)
WITH CHECK (
  current_setting('app.audience', true) = 'system'
  OR (
    tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND current_setting('app.audience', true) IN ('restaurant', 'support')
  )
);

COMMIT;
