-- INOVAS Food — SYSTEM × RESTAURANT security boundary
-- Scoped identity administration for Restaurant memberships.
-- Apply only to the isolated Preview database branch.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE identities FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS inovas_identity_access ON identities;
DROP POLICY IF EXISTS inovas_identity_select ON identities;
DROP POLICY IF EXISTS inovas_identity_insert ON identities;
DROP POLICY IF EXISTS inovas_identity_update ON identities;
DROP POLICY IF EXISTS inovas_identity_delete ON identities;

CREATE POLICY inovas_identity_select ON identities
FOR SELECT
USING (
  current_setting('app.audience', true) = 'system'
  OR id = current_setting('app.identity_id', true)
  OR EXISTS (
    SELECT 1
    FROM restaurant_memberships AS membership
    WHERE membership.identity_id = identities.id
      AND membership.tenant_id = current_setting('app.tenant_id', true)
      AND membership.restaurant_id = current_setting('app.restaurant_id', true)
      AND current_setting('app.audience', true) IN (
        'restaurant', 'support', 'provisioning'
      )
  )
);

CREATE POLICY inovas_identity_insert ON identities
FOR INSERT
WITH CHECK (
  current_setting('app.audience', true) = 'system'
  OR (
    current_setting('app.tenant_id', true) NOT IN ('', '__none__')
    AND current_setting('app.restaurant_id', true) NOT IN ('', '__none__')
    AND (
      current_setting('app.audience', true) IN ('restaurant', 'provisioning')
      OR (
        current_setting('app.audience', true) = 'support'
        AND current_setting('app.support_mode', true) = 'ADMIN'
      )
    )
  )
);

CREATE POLICY inovas_identity_update ON identities
FOR UPDATE
USING (
  current_setting('app.audience', true) = 'system'
  OR id = current_setting('app.identity_id', true)
  OR EXISTS (
    SELECT 1
    FROM restaurant_memberships AS membership
    WHERE membership.identity_id = identities.id
      AND membership.tenant_id = current_setting('app.tenant_id', true)
      AND membership.restaurant_id = current_setting('app.restaurant_id', true)
      AND (
        current_setting('app.audience', true) IN (
          'restaurant', 'provisioning'
        )
        OR (
          current_setting('app.audience', true) = 'support'
          AND current_setting('app.support_mode', true) = 'ADMIN'
        )
      )
  )
)
WITH CHECK (
  current_setting('app.audience', true) = 'system'
  OR id = current_setting('app.identity_id', true)
  OR EXISTS (
    SELECT 1
    FROM restaurant_memberships AS membership
    WHERE membership.identity_id = identities.id
      AND membership.tenant_id = current_setting('app.tenant_id', true)
      AND membership.restaurant_id = current_setting('app.restaurant_id', true)
      AND (
        current_setting('app.audience', true) IN (
          'restaurant', 'provisioning'
        )
        OR (
          current_setting('app.audience', true) = 'support'
          AND current_setting('app.support_mode', true) = 'ADMIN'
        )
      )
  )
);

CREATE POLICY inovas_identity_delete ON identities
FOR DELETE
USING (current_setting('app.audience', true) = 'system');

COMMIT;
