-- INOVAS Food — SYSTEM × RESTAURANT security boundary
-- Public routing projection and internal provisioning audience.
-- Apply only to the isolated Preview database branch.

BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '120s';

CREATE TABLE IF NOT EXISTS public_restaurant_routes (
  restaurant_key TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  restaurant_id TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  restaurant_name TEXT NOT NULL,
  domain_host TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  public_url TEXT NOT NULL DEFAULT '',
  dns_integrated BOOLEAN NOT NULL DEFAULT FALSE,
  ssl_integrated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS public_restaurant_routes_domain_host_idx
ON public_restaurant_routes (domain_host)
WHERE domain_host <> '';

WITH restaurant_projection AS (
  SELECT
    COALESCE(
      NULLIF(restaurant_json->>'restaurantKey', ''),
      NULLIF(restaurant_json->>'key', ''),
      NULLIF(restaurant_json->>'slug', '')
    ) AS restaurant_key,
    COALESCE(
      NULLIF(restaurant_json->>'tenantId', ''),
      NULLIF(restaurant_json->>'tenant_id', ''),
      NULLIF(scope_match.tenant_id, ''),
      CASE
        WHEN COALESCE(
          restaurant_json->>'restaurantKey',
          restaurant_json->>'key',
          restaurant_json->>'slug'
        ) = 'default'
          THEN 'tenant_default'
        ELSE 'tenant_' || REPLACE(
          LOWER(
            REGEXP_REPLACE(
              COALESCE(
                restaurant_json->>'restaurantKey',
                restaurant_json->>'key',
                restaurant_json->>'slug'
              ),
              '[^a-zA-Z0-9_-]+',
              '-',
              'g'
            )
          ),
          '-',
          '_'
        )
      END
    ) AS tenant_id,
    COALESCE(
      NULLIF(restaurant_json->>'restaurantId', ''),
      NULLIF(restaurant_json->>'restaurant_id', ''),
      NULLIF(scope_match.restaurant_id, ''),
      CASE
        WHEN COALESCE(
          restaurant_json->>'restaurantKey',
          restaurant_json->>'key',
          restaurant_json->>'slug'
        ) = 'default'
          THEN 'restaurant_default'
        ELSE 'restaurant_' || REPLACE(
          LOWER(
            REGEXP_REPLACE(
              COALESCE(
                restaurant_json->>'restaurantKey',
                restaurant_json->>'key',
                restaurant_json->>'slug'
              ),
              '[^a-zA-Z0-9_-]+',
              '-',
              'g'
            )
          ),
          '-',
          '_'
        )
      END
    ) AS restaurant_id,
    LOWER(
      REGEXP_REPLACE(
        COALESCE(
          NULLIF(restaurant_json->>'slug', ''),
          NULLIF(restaurant_json->>'restaurantKey', ''),
          NULLIF(restaurant_json->>'key', '')
        ),
        '[^a-zA-Z0-9-]+',
        '-',
        'g'
      )
    ) AS slug,
    COALESCE(
      NULLIF(restaurant_json->>'name', ''),
      NULLIF(restaurant_json->>'restaurantName', ''),
      NULLIF(restaurant_json->>'restaurantKey', '')
    ) AS restaurant_name,
    COALESCE(
      NULLIF(domain_json->>'customDomain', ''),
      NULLIF(domain_json->>'primaryDomain', ''),
      NULLIF(domain_json->>'domain', ''),
      ''
    ) AS domain_host,
    UPPER(COALESCE(NULLIF(restaurant_json->>'status', ''), 'ACTIVE')) AS status,
    COALESCE(
      NULLIF(restaurant_json->'onboarding'->'menuAddress'->>'publicUrl', ''),
      '/r/' || LOWER(
        REGEXP_REPLACE(
          COALESCE(
            NULLIF(restaurant_json->>'slug', ''),
            NULLIF(restaurant_json->>'restaurantKey', ''),
            NULLIF(restaurant_json->>'key', '')
          ),
          '[^a-zA-Z0-9-]+',
          '-',
          'g'
        )
      )
    ) AS public_url,
    COALESCE((domain_json->>'dnsIntegrated')::boolean, FALSE) AS dns_integrated,
    COALESCE((domain_json->>'sslIntegrated')::boolean, FALSE) AS ssl_integrated
  FROM master_platform_state
  CROSS JOIN LATERAL jsonb_array_elements(
    COALESCE(state_json->'restaurants', '[]'::jsonb)
  ) AS restaurant_json
  LEFT JOIN LATERAL (
    SELECT domain_entry AS domain_json
    FROM jsonb_array_elements(
      COALESCE(state_json->'domains', '[]'::jsonb)
    ) AS domain_entry
    WHERE domain_entry->>'restaurantKey' = COALESCE(
      restaurant_json->>'restaurantKey',
      restaurant_json->>'key',
      restaurant_json->>'slug'
    )
      AND COALESCE((domain_entry->>'isSimulation')::boolean, FALSE) = FALSE
    ORDER BY
      CASE WHEN NULLIF(domain_entry->>'customDomain', '') IS NULL THEN 1 ELSE 0 END,
      domain_entry->>'domain'
    LIMIT 1
  ) AS domain_match ON TRUE
  LEFT JOIN LATERAL (
    SELECT
      admin_user.tenant_id,
      admin_user.restaurant_id
    FROM admin_users AS admin_user
    WHERE admin_user.restaurant_key = COALESCE(
      restaurant_json->>'restaurantKey',
      restaurant_json->>'key',
      restaurant_json->>'slug'
    )
      AND admin_user.tenant_id <> ''
      AND admin_user.restaurant_id <> ''
    ORDER BY admin_user.created_at
    LIMIT 1
  ) AS scope_match ON TRUE
)
INSERT INTO public_restaurant_routes (
  restaurant_key,
  tenant_id,
  restaurant_id,
  slug,
  restaurant_name,
  domain_host,
  status,
  public_url,
  dns_integrated,
  ssl_integrated,
  created_at,
  updated_at
)
SELECT
  restaurant_key,
  tenant_id,
  restaurant_id,
  slug,
  restaurant_name,
  LOWER(REGEXP_REPLACE(domain_host, '^https?://|/.*$', '', 'g')),
  status,
  public_url,
  dns_integrated,
  ssl_integrated,
  NOW(),
  NOW()
FROM restaurant_projection
WHERE restaurant_key IS NOT NULL
  AND tenant_id IS NOT NULL
  AND restaurant_id IS NOT NULL
  AND slug IS NOT NULL
  AND restaurant_name IS NOT NULL
ON CONFLICT (restaurant_key)
DO UPDATE SET
  tenant_id = EXCLUDED.tenant_id,
  restaurant_id = EXCLUDED.restaurant_id,
  slug = EXCLUDED.slug,
  restaurant_name = EXCLUDED.restaurant_name,
  domain_host = EXCLUDED.domain_host,
  status = EXCLUDED.status,
  public_url = EXCLUDED.public_url,
  dns_integrated = EXCLUDED.dns_integrated,
  ssl_integrated = EXCLUDED.ssl_integrated,
  updated_at = NOW();

-- An isolated Preview branch can legitimately have operational users before
-- the System state snapshot is created. Keep public routing functional without
-- exposing the private master JSON by deriving the minimum route projection
-- from those already-scoped Restaurant principals.
WITH admin_route_projection AS (
  SELECT DISTINCT ON (restaurant_key)
    restaurant_key,
    tenant_id,
    restaurant_id,
    CASE
      WHEN restaurant_key = 'default' THEN 'tokyo-sushi'
      ELSE LOWER(REGEXP_REPLACE(restaurant_key, '[^a-zA-Z0-9-]+', '-', 'g'))
    END AS slug,
    CASE
      WHEN restaurant_key = 'default' THEN 'Tokyo Sushi Delivery'
      ELSE restaurant_key
    END AS restaurant_name
  FROM admin_users
  WHERE restaurant_key <> ''
    AND tenant_id <> ''
    AND restaurant_id <> ''
  ORDER BY restaurant_key, created_at
)
INSERT INTO public_restaurant_routes (
  restaurant_key,
  tenant_id,
  restaurant_id,
  slug,
  restaurant_name,
  domain_host,
  status,
  public_url,
  dns_integrated,
  ssl_integrated,
  created_at,
  updated_at
)
SELECT
  restaurant_key,
  tenant_id,
  restaurant_id,
  slug,
  restaurant_name,
  '',
  'ACTIVE',
  '/r/' || slug,
  FALSE,
  FALSE,
  NOW(),
  NOW()
FROM admin_route_projection
ON CONFLICT (restaurant_key)
DO NOTHING;

ALTER TABLE public_restaurant_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_restaurant_routes FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS inovas_public_routes_system_write ON public_restaurant_routes;
DROP POLICY IF EXISTS inovas_public_routes_read ON public_restaurant_routes;

CREATE POLICY inovas_public_routes_system_write ON public_restaurant_routes
FOR ALL
USING (current_setting('app.audience', true) = 'system')
WITH CHECK (current_setting('app.audience', true) = 'system');

CREATE POLICY inovas_public_routes_read ON public_restaurant_routes
FOR SELECT
USING (
  current_setting('app.audience', true) IN (
    'public',
    'restaurant',
    'support',
    'system'
  )
);

DO $provisioning_rls$
DECLARE
  table_name TEXT;
  public_select_tables CONSTANT TEXT[] := ARRAY[
    'catalog_item_overrides',
    'catalog_promotions',
    'catalog_runtime_state',
    'restaurant_settings'
  ];
  public_insert_tables CONSTANT TEXT[] := ARRAY[
    'customers',
    'customer_reviews',
    'orders',
    'order_items',
    'order_status_events'
  ];
  operational_tables CONSTANT TEXT[] := ARRAY[
    'catalog_item_overrides',
    'catalog_promotions',
    'catalog_runtime_state',
    'customer_crm_profiles',
    'customer_reviews',
    'customers',
    'delivery_settings',
    'finance_closings',
    'inventory_runtime_state',
    'order_items',
    'order_status_events',
    'orders',
    'restaurant_settings'
  ];
BEGIN
  FOREACH table_name IN ARRAY operational_tables LOOP
    IF to_regclass('public.' || table_name) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS inovas_tenant_select ON %I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS inovas_tenant_insert ON %I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS inovas_tenant_update ON %I', table_name);
    EXECUTE format('DROP POLICY IF EXISTS inovas_tenant_delete ON %I', table_name);

    EXECUTE format(
      'CREATE POLICY inovas_tenant_select ON %I FOR SELECT USING (
        tenant_id = current_setting(''app.tenant_id'', true)
        AND restaurant_id = current_setting(''app.restaurant_id'', true)
        AND (
          current_setting(''app.audience'', true) IN (
            ''restaurant'', ''support'', ''provisioning''
          )
          OR (
            current_setting(''app.audience'', true) = ''public''
            AND %L = ANY (%L::text[])
          )
        )
      )',
      table_name,
      table_name,
      public_select_tables
    );

    EXECUTE format(
      'CREATE POLICY inovas_tenant_insert ON %I FOR INSERT WITH CHECK (
        tenant_id = current_setting(''app.tenant_id'', true)
        AND restaurant_id = current_setting(''app.restaurant_id'', true)
        AND (
          current_setting(''app.audience'', true) IN (
            ''restaurant'', ''provisioning''
          )
          OR (
            current_setting(''app.audience'', true) = ''support''
            AND current_setting(''app.support_mode'', true) = ''ADMIN''
          )
          OR (
            current_setting(''app.audience'', true) = ''public''
            AND %L = ANY (%L::text[])
          )
        )
      )',
      table_name,
      table_name,
      public_insert_tables
    );

    EXECUTE format(
      'CREATE POLICY inovas_tenant_update ON %I FOR UPDATE USING (
        tenant_id = current_setting(''app.tenant_id'', true)
        AND restaurant_id = current_setting(''app.restaurant_id'', true)
        AND (
          current_setting(''app.audience'', true) IN (
            ''restaurant'', ''provisioning''
          )
          OR (
            current_setting(''app.audience'', true) = ''support''
            AND current_setting(''app.support_mode'', true) = ''ADMIN''
          )
        )
      ) WITH CHECK (
        tenant_id = current_setting(''app.tenant_id'', true)
        AND restaurant_id = current_setting(''app.restaurant_id'', true)
      )',
      table_name
    );

    EXECUTE format(
      'CREATE POLICY inovas_tenant_delete ON %I FOR DELETE USING (
        tenant_id = current_setting(''app.tenant_id'', true)
        AND restaurant_id = current_setting(''app.restaurant_id'', true)
        AND (
          current_setting(''app.audience'', true) = ''restaurant''
          OR (
            current_setting(''app.audience'', true) = ''support''
            AND current_setting(''app.support_mode'', true) = ''ADMIN''
          )
        )
      )',
      table_name
    );
  END LOOP;
END
$provisioning_rls$;

DROP POLICY IF EXISTS inovas_admin_users_select ON admin_users;
DROP POLICY IF EXISTS inovas_admin_users_insert ON admin_users;
DROP POLICY IF EXISTS inovas_admin_users_update ON admin_users;
DROP POLICY IF EXISTS inovas_admin_users_delete ON admin_users;

CREATE POLICY inovas_admin_users_select ON admin_users
FOR SELECT USING (
  (
    current_setting('app.audience', true) = 'system'
    AND (
      restaurant_key = ''
      OR user_type IN (
        'MASTER', 'SOCIO', 'DESENVOLVEDOR', 'SUPORTE', 'VENDEDOR', 'COMERCIAL',
        'FINANCEIRO_INOVAS', 'IMPLANTACAO', 'CUSTOMER_SUCCESS', 'AUDITOR'
      )
    )
  )
  OR
  (
    current_setting('app.audience', true) IN (
      'restaurant', 'provisioning'
    )
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND restaurant_key <> ''
  )
  OR
  (
    current_setting('app.audience', true) = 'support'
    AND current_setting('app.support_mode', true) = 'ADMIN'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND restaurant_key <> ''
  )
);

CREATE POLICY inovas_admin_users_insert ON admin_users
FOR INSERT WITH CHECK (
  (
    current_setting('app.audience', true) = 'system'
    AND restaurant_key = ''
  )
  OR
  (
    current_setting('app.audience', true) IN (
      'restaurant', 'provisioning'
    )
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND restaurant_key <> ''
  )
  OR
  (
    current_setting('app.audience', true) = 'support'
    AND current_setting('app.support_mode', true) = 'ADMIN'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND restaurant_key <> ''
  )
);

CREATE POLICY inovas_admin_users_update ON admin_users
FOR UPDATE USING (
  (
    current_setting('app.audience', true) = 'system'
    AND restaurant_key = ''
  )
  OR
  (
    current_setting('app.audience', true) IN (
      'restaurant', 'provisioning'
    )
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND restaurant_key <> ''
  )
  OR
  (
    current_setting('app.audience', true) = 'support'
    AND current_setting('app.support_mode', true) = 'ADMIN'
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND restaurant_key <> ''
  )
) WITH CHECK (
  (
    current_setting('app.audience', true) = 'system'
    AND restaurant_key = ''
  )
  OR
  (
    current_setting('app.audience', true) IN (
      'restaurant', 'provisioning', 'support'
    )
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND restaurant_key <> ''
  )
);

CREATE POLICY inovas_admin_users_delete ON admin_users
FOR DELETE USING (
  (
    current_setting('app.audience', true) = 'system'
    AND restaurant_key = ''
  )
  OR
  (
    current_setting('app.audience', true) IN ('restaurant', 'support')
    AND tenant_id = current_setting('app.tenant_id', true)
    AND restaurant_id = current_setting('app.restaurant_id', true)
    AND restaurant_key <> ''
    AND (
      current_setting('app.audience', true) = 'restaurant'
      OR current_setting('app.support_mode', true) = 'ADMIN'
    )
  )
);

COMMIT;
