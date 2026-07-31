-- INOVAS Food - Production upgrade preflight (READ ONLY)
-- This file contains SELECT statements only. It does not expose row values,
-- credentials, tenant identifiers, restaurant identifiers, logins, or e-mails.
-- Run with the administrative connection only for catalog visibility.

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '120s';
SET LOCAL lock_timeout = '5s';

-- Connection and role posture. Branch/project identifiers are fingerprinted by
-- the external runner and intentionally are not selected here.
SELECT
  current_database() AS database_name,
  current_user AS database_user,
  role_record.rolsuper,
  role_record.rolinherit,
  role_record.rolcreaterole,
  role_record.rolcreatedb,
  role_record.rolreplication,
  role_record.rolbypassrls
FROM pg_roles AS role_record
WHERE role_record.rolname = current_user;

-- Public catalog inventory.
SELECT
  COUNT(*) FILTER (WHERE class_record.relkind IN ('r', 'p'))::integer AS tables,
  COUNT(*) FILTER (WHERE class_record.relkind = 'S')::integer AS sequences,
  COUNT(*) FILTER (WHERE class_record.relkind = 'v')::integer AS views,
  COUNT(*) FILTER (WHERE class_record.relkind = 'm')::integer AS materialized_views,
  COUNT(*) FILTER (
    WHERE class_record.relkind IN ('r', 'p')
      AND class_record.relrowsecurity
  )::integer AS tables_with_rls,
  COUNT(*) FILTER (
    WHERE class_record.relkind IN ('r', 'p')
      AND class_record.relforcerowsecurity
  )::integer AS tables_with_forced_rls
FROM pg_class AS class_record
INNER JOIN pg_namespace AS namespace_record
  ON namespace_record.oid = class_record.relnamespace
WHERE namespace_record.nspname = 'public';

SELECT COUNT(*)::integer AS policies
FROM pg_policies
WHERE schemaname = 'public';

SELECT extname, extversion
FROM pg_extension
ORDER BY extname;

SELECT
  COUNT(*)::integer AS public_functions,
  COUNT(*) FILTER (WHERE function_record.prosecdef)::integer
    AS security_definer_functions
FROM pg_proc AS function_record
INNER JOIN pg_namespace AS namespace_record
  ON namespace_record.oid = function_record.pronamespace
WHERE namespace_record.nspname = 'public';

SELECT COUNT(*)::integer AS public_triggers
FROM information_schema.triggers
WHERE trigger_schema = 'public';

-- Presence of the real executable chain and its prerequisite state.
SELECT
  to_regclass('public.orders') IS NOT NULL AS orders_exists,
  to_regclass('public.identities') IS NOT NULL AS identities_exists,
  to_regclass('public.permission_definitions') IS NOT NULL
    AS permission_definitions_exists,
  to_regclass('public.role_definitions') IS NOT NULL
    AS role_definitions_exists,
  to_regclass('public.role_permission_bindings') IS NOT NULL
    AS role_permission_bindings_exists,
  to_regclass('public.public_restaurant_routes') IS NOT NULL
    AS public_restaurant_routes_exists,
  to_regclass('public.cash_register_sessions') IS NOT NULL
    AS cash_register_sessions_exists,
  EXISTS (
    SELECT 1
    FROM pg_tables
    WHERE schemaname = 'public'
      AND (
        tablename ILIKE '%migration%'
        OR tablename IN (
          'schema_migrations',
          '_prisma_migrations',
          'knex_migrations'
        )
      )
  ) AS migration_ledger_exists;

-- Counts only; no operational row is returned.
SELECT 'admin_users' AS table_name, COUNT(*)::bigint AS row_count FROM admin_users
UNION ALL SELECT 'catalog_item_overrides', COUNT(*) FROM catalog_item_overrides
UNION ALL SELECT 'catalog_promotions', COUNT(*) FROM catalog_promotions
UNION ALL SELECT 'catalog_runtime_state', COUNT(*) FROM catalog_runtime_state
UNION ALL SELECT 'customer_crm_profiles', COUNT(*) FROM customer_crm_profiles
UNION ALL SELECT 'customer_reviews', COUNT(*) FROM customer_reviews
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'delivery_settings', COUNT(*) FROM delivery_settings
UNION ALL SELECT 'finance_closings', COUNT(*) FROM finance_closings
UNION ALL SELECT 'inventory_runtime_state', COUNT(*) FROM inventory_runtime_state
UNION ALL SELECT 'master_platform_state', COUNT(*) FROM master_platform_state
UNION ALL SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL SELECT 'order_status_events', COUNT(*) FROM order_status_events
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'restaurant_settings', COUNT(*) FROM restaurant_settings
ORDER BY table_name;

-- Scope completeness. A blank scope is expected only for a System admin row.
SELECT
  'admin_users' AS table_name,
  COUNT(*)::bigint AS total,
  COUNT(*) FILTER (
    WHERE tenant_id IS NULL OR restaurant_id IS NULL OR restaurant_key IS NULL
  )::bigint AS null_scope,
  COUNT(*) FILTER (
    WHERE BTRIM(COALESCE(tenant_id, '')) = ''
      OR BTRIM(COALESCE(restaurant_id, '')) = ''
      OR BTRIM(COALESCE(restaurant_key, '')) = ''
  )::bigint AS blank_scope,
  COUNT(DISTINCT (tenant_id, restaurant_id, restaurant_key))::bigint
    AS distinct_scopes
FROM admin_users
UNION ALL
SELECT 'catalog_item_overrides', COUNT(*),
  COUNT(*) FILTER (WHERE tenant_id IS NULL OR restaurant_id IS NULL OR restaurant_key IS NULL),
  COUNT(*) FILTER (WHERE BTRIM(COALESCE(tenant_id, '')) = '' OR BTRIM(COALESCE(restaurant_id, '')) = '' OR BTRIM(COALESCE(restaurant_key, '')) = ''),
  COUNT(DISTINCT (tenant_id, restaurant_id, restaurant_key))
FROM catalog_item_overrides
UNION ALL
SELECT 'catalog_promotions', COUNT(*),
  COUNT(*) FILTER (WHERE tenant_id IS NULL OR restaurant_id IS NULL OR restaurant_key IS NULL),
  COUNT(*) FILTER (WHERE BTRIM(COALESCE(tenant_id, '')) = '' OR BTRIM(COALESCE(restaurant_id, '')) = '' OR BTRIM(COALESCE(restaurant_key, '')) = ''),
  COUNT(DISTINCT (tenant_id, restaurant_id, restaurant_key))
FROM catalog_promotions
UNION ALL
SELECT 'catalog_runtime_state', COUNT(*),
  COUNT(*) FILTER (WHERE tenant_id IS NULL OR restaurant_id IS NULL OR restaurant_key IS NULL),
  COUNT(*) FILTER (WHERE BTRIM(COALESCE(tenant_id, '')) = '' OR BTRIM(COALESCE(restaurant_id, '')) = '' OR BTRIM(COALESCE(restaurant_key, '')) = ''),
  COUNT(DISTINCT (tenant_id, restaurant_id, restaurant_key))
FROM catalog_runtime_state
UNION ALL
SELECT 'customer_crm_profiles', COUNT(*),
  COUNT(*) FILTER (WHERE tenant_id IS NULL OR restaurant_id IS NULL OR restaurant_key IS NULL),
  COUNT(*) FILTER (WHERE BTRIM(COALESCE(tenant_id, '')) = '' OR BTRIM(COALESCE(restaurant_id, '')) = '' OR BTRIM(COALESCE(restaurant_key, '')) = ''),
  COUNT(DISTINCT (tenant_id, restaurant_id, restaurant_key))
FROM customer_crm_profiles
UNION ALL
SELECT 'customer_reviews', COUNT(*),
  COUNT(*) FILTER (WHERE tenant_id IS NULL OR restaurant_id IS NULL OR restaurant_key IS NULL),
  COUNT(*) FILTER (WHERE BTRIM(COALESCE(tenant_id, '')) = '' OR BTRIM(COALESCE(restaurant_id, '')) = '' OR BTRIM(COALESCE(restaurant_key, '')) = ''),
  COUNT(DISTINCT (tenant_id, restaurant_id, restaurant_key))
FROM customer_reviews
UNION ALL
SELECT 'customers', COUNT(*),
  COUNT(*) FILTER (WHERE tenant_id IS NULL OR restaurant_id IS NULL OR restaurant_key IS NULL),
  COUNT(*) FILTER (WHERE BTRIM(COALESCE(tenant_id, '')) = '' OR BTRIM(COALESCE(restaurant_id, '')) = '' OR BTRIM(COALESCE(restaurant_key, '')) = ''),
  COUNT(DISTINCT (tenant_id, restaurant_id, restaurant_key))
FROM customers
UNION ALL
SELECT 'delivery_settings', COUNT(*),
  COUNT(*) FILTER (WHERE tenant_id IS NULL OR restaurant_id IS NULL OR restaurant_key IS NULL),
  COUNT(*) FILTER (WHERE BTRIM(COALESCE(tenant_id, '')) = '' OR BTRIM(COALESCE(restaurant_id, '')) = '' OR BTRIM(COALESCE(restaurant_key, '')) = ''),
  COUNT(DISTINCT (tenant_id, restaurant_id, restaurant_key))
FROM delivery_settings
UNION ALL
SELECT 'finance_closings', COUNT(*),
  COUNT(*) FILTER (WHERE tenant_id IS NULL OR restaurant_id IS NULL OR restaurant_key IS NULL),
  COUNT(*) FILTER (WHERE BTRIM(COALESCE(tenant_id, '')) = '' OR BTRIM(COALESCE(restaurant_id, '')) = '' OR BTRIM(COALESCE(restaurant_key, '')) = ''),
  COUNT(DISTINCT (tenant_id, restaurant_id, restaurant_key))
FROM finance_closings
UNION ALL
SELECT 'inventory_runtime_state', COUNT(*),
  COUNT(*) FILTER (WHERE tenant_id IS NULL OR restaurant_id IS NULL OR restaurant_key IS NULL),
  COUNT(*) FILTER (WHERE BTRIM(COALESCE(tenant_id, '')) = '' OR BTRIM(COALESCE(restaurant_id, '')) = '' OR BTRIM(COALESCE(restaurant_key, '')) = ''),
  COUNT(DISTINCT (tenant_id, restaurant_id, restaurant_key))
FROM inventory_runtime_state
UNION ALL
SELECT 'order_items', COUNT(*),
  COUNT(*) FILTER (WHERE tenant_id IS NULL OR restaurant_id IS NULL OR restaurant_key IS NULL),
  COUNT(*) FILTER (WHERE BTRIM(COALESCE(tenant_id, '')) = '' OR BTRIM(COALESCE(restaurant_id, '')) = '' OR BTRIM(COALESCE(restaurant_key, '')) = ''),
  COUNT(DISTINCT (tenant_id, restaurant_id, restaurant_key))
FROM order_items
UNION ALL
SELECT 'order_status_events', COUNT(*),
  COUNT(*) FILTER (WHERE tenant_id IS NULL OR restaurant_id IS NULL OR restaurant_key IS NULL),
  COUNT(*) FILTER (WHERE BTRIM(COALESCE(tenant_id, '')) = '' OR BTRIM(COALESCE(restaurant_id, '')) = '' OR BTRIM(COALESCE(restaurant_key, '')) = ''),
  COUNT(DISTINCT (tenant_id, restaurant_id, restaurant_key))
FROM order_status_events
UNION ALL
SELECT 'orders', COUNT(*),
  COUNT(*) FILTER (WHERE tenant_id IS NULL OR restaurant_id IS NULL OR restaurant_key IS NULL),
  COUNT(*) FILTER (WHERE BTRIM(COALESCE(tenant_id, '')) = '' OR BTRIM(COALESCE(restaurant_id, '')) = '' OR BTRIM(COALESCE(restaurant_key, '')) = ''),
  COUNT(DISTINCT (tenant_id, restaurant_id, restaurant_key))
FROM orders
UNION ALL
SELECT 'restaurant_settings', COUNT(*),
  COUNT(*) FILTER (WHERE tenant_id IS NULL OR restaurant_id IS NULL OR restaurant_key IS NULL),
  COUNT(*) FILTER (WHERE BTRIM(COALESCE(tenant_id, '')) = '' OR BTRIM(COALESCE(restaurant_id, '')) = '' OR BTRIM(COALESCE(restaurant_key, '')) = ''),
  COUNT(DISTINCT (tenant_id, restaurant_id, restaurant_key))
FROM restaurant_settings
ORDER BY table_name;

-- Identity/membership backfill collision and CHECK-constraint preflight.
WITH normalized_admin AS (
  SELECT
    LOWER(COALESCE(NULLIF(email, ''), login)) AS identity_email,
    LOWER(login) AS identity_login,
    LOWER(email) AS lower_email,
    tenant_id,
    restaurant_id,
    restaurant_key,
    status,
    user_type,
    (
      user_type IN (
        'MASTER', 'SOCIO', 'DESENVOLVEDOR', 'SUPORTE', 'VENDEDOR',
        'COMERCIAL', 'FINANCEIRO_INOVAS', 'IMPLANTACAO',
        'CUSTOMER_SUCCESS', 'AUDITOR'
      )
      OR restaurant_key = ''
    ) AS is_system
  FROM admin_users
),
identity_email_duplicates AS (
  SELECT identity_email FROM normalized_admin GROUP BY 1 HAVING COUNT(*) > 1
),
identity_login_duplicates AS (
  SELECT identity_login FROM normalized_admin GROUP BY 1 HAVING COUNT(*) > 1
),
lower_email_duplicates AS (
  SELECT lower_email
  FROM normalized_admin
  WHERE lower_email <> ''
  GROUP BY 1
  HAVING COUNT(*) > 1
),
system_principal_duplicates AS (
  SELECT identity_email
  FROM normalized_admin
  WHERE is_system
  GROUP BY 1
  HAVING COUNT(*) > 1
),
membership_duplicates AS (
  SELECT identity_email, tenant_id, restaurant_id
  FROM normalized_admin
  WHERE NOT is_system
  GROUP BY 1, 2, 3
  HAVING COUNT(*) > 1
)
SELECT
  COUNT(*)::integer AS total_admin_users,
  COUNT(*) FILTER (
    WHERE identity_email IS NULL OR identity_login IS NULL
  )::integer AS null_identity_seed,
  (SELECT COUNT(*)::integer FROM identity_email_duplicates)
    AS identity_email_duplicate_groups,
  (SELECT COUNT(*)::integer FROM identity_login_duplicates)
    AS identity_login_duplicate_groups,
  (SELECT COUNT(*)::integer FROM lower_email_duplicates)
    AS lower_email_duplicate_groups,
  (SELECT COUNT(*)::integer FROM system_principal_duplicates)
    AS system_principal_duplicate_groups,
  (SELECT COUNT(*)::integer FROM membership_duplicates)
    AS membership_duplicate_groups,
  COUNT(*) FILTER (WHERE is_system)::integer AS system_rows,
  COUNT(*) FILTER (WHERE NOT is_system)::integer AS restaurant_rows,
  COUNT(*) FILTER (
    WHERE is_system AND status NOT IN ('ACTIVE', 'PENDING', 'BLOCKED')
  )::integer AS system_status_rejected,
  COUNT(*) FILTER (
    WHERE NOT is_system
      AND status NOT IN ('ACTIVE', 'PENDING', 'BLOCKED', 'DISABLED')
  )::integer AS membership_status_rejected,
  COUNT(*) FILTER (
    WHERE is_system
      AND user_type NOT IN (
        'MASTER', 'SOCIO', 'DESENVOLVEDOR', 'SUPORTE', 'COMERCIAL',
        'FINANCEIRO_INOVAS', 'IMPLANTACAO', 'CUSTOMER_SUCCESS', 'AUDITOR'
      )
  )::integer AS system_role_definition_missing,
  COUNT(*) FILTER (
    WHERE NOT is_system
      AND user_type NOT IN (
        'OWNER', 'ADMIN', 'MANAGER', 'CASHIER', 'SERVICE', 'KITCHEN',
        'INVENTORY', 'FINANCE', 'DELIVERY', 'READ_ONLY', 'CUSTOM'
      )
  )::integer AS restaurant_role_definition_missing,
  COUNT(*) FILTER (
    WHERE NOT is_system
      AND (
        BTRIM(COALESCE(tenant_id, '')) = ''
        OR BTRIM(COALESCE(restaurant_id, '')) = ''
        OR BTRIM(COALESCE(restaurant_key, '')) = ''
      )
  )::integer AS membership_scope_incomplete
FROM normalized_admin;

-- Existing relational and tenant consistency.
SELECT
  (SELECT COUNT(*) FROM order_items AS item
    LEFT JOIN orders AS order_record ON order_record.id = item.order_id
    WHERE order_record.id IS NULL)::integer AS order_item_orphans,
  (SELECT COUNT(*) FROM order_items AS item
    INNER JOIN orders AS order_record ON order_record.id = item.order_id
    WHERE (item.tenant_id, item.restaurant_id, item.restaurant_key)
      IS DISTINCT FROM
      (order_record.tenant_id, order_record.restaurant_id,
        order_record.restaurant_key))::integer AS order_item_scope_mismatches,
  (SELECT COUNT(*) FROM order_status_events AS event_record
    LEFT JOIN orders AS order_record ON order_record.id = event_record.order_id
    WHERE order_record.id IS NULL)::integer AS order_event_orphans,
  (SELECT COUNT(*) FROM order_status_events AS event_record
    INNER JOIN orders AS order_record ON order_record.id = event_record.order_id
    WHERE (event_record.tenant_id, event_record.restaurant_id,
      event_record.restaurant_key)
      IS DISTINCT FROM
      (order_record.tenant_id, order_record.restaurant_id,
        order_record.restaurant_key))::integer AS order_event_scope_mismatches,
  (SELECT COUNT(*) FROM orders AS order_record
    LEFT JOIN customers AS customer ON customer.id = order_record.customer_id
    WHERE order_record.customer_id IS NOT NULL
      AND customer.id IS NULL)::integer AS order_customer_orphans,
  (SELECT COUNT(*) FROM orders AS order_record
    INNER JOIN customers AS customer ON customer.id = order_record.customer_id
    WHERE (order_record.tenant_id, order_record.restaurant_id,
      order_record.restaurant_key)
      IS DISTINCT FROM
      (customer.tenant_id, customer.restaurant_id,
        customer.restaurant_key))::integer AS order_customer_scope_mismatches,
  (SELECT COUNT(*) FROM customer_crm_profiles AS profile
    LEFT JOIN customers AS customer
      ON customer.customer_key = profile.customer_key
      AND customer.tenant_id = profile.tenant_id
      AND customer.restaurant_id = profile.restaurant_id
    WHERE customer.id IS NULL)::integer AS crm_customer_key_orphans,
  (SELECT COUNT(*) FROM customer_reviews AS review
    LEFT JOIN customers AS customer
      ON customer.customer_key = review.customer_key
      AND customer.tenant_id = review.tenant_id
      AND customer.restaurant_id = review.restaurant_id
    WHERE NULLIF(review.customer_key, '') IS NOT NULL
      AND customer.id IS NULL)::integer AS review_customer_key_orphans;

-- Route projection shape and collision preflight. This returns counts only.
WITH state_rows AS (
  SELECT state_json FROM master_platform_state
),
restaurants AS (
  SELECT entry
  FROM state_rows
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(state_json->'restaurants') = 'array'
        THEN state_json->'restaurants'
      ELSE '[]'::jsonb
    END
  ) AS entry
),
domains AS (
  SELECT entry
  FROM state_rows
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(state_json->'domains') = 'array'
        THEN state_json->'domains'
      ELSE '[]'::jsonb
    END
  ) AS entry
),
route_projection AS (
  SELECT
    COALESCE(
      NULLIF(entry->>'restaurantKey', ''),
      NULLIF(entry->>'key', ''),
      NULLIF(entry->>'slug', '')
    ) AS restaurant_key,
    LOWER(REGEXP_REPLACE(
      COALESCE(
        NULLIF(entry->>'slug', ''),
        NULLIF(entry->>'restaurantKey', ''),
        NULLIF(entry->>'key', '')
      ),
      '[^a-zA-Z0-9-]+', '-', 'g'
    )) AS slug,
    COALESCE(
      NULLIF(entry->>'name', ''),
      NULLIF(entry->>'restaurantName', ''),
      NULLIF(entry->>'restaurantKey', '')
    ) AS restaurant_name
  FROM restaurants
),
restaurant_key_duplicates AS (
  SELECT restaurant_key
  FROM route_projection
  WHERE restaurant_key IS NOT NULL
  GROUP BY 1 HAVING COUNT(*) > 1
),
slug_duplicates AS (
  SELECT slug
  FROM route_projection
  WHERE slug IS NOT NULL
  GROUP BY 1 HAVING COUNT(*) > 1
),
domain_hosts AS (
  SELECT LOWER(REGEXP_REPLACE(
    COALESCE(
      NULLIF(entry->>'customDomain', ''),
      NULLIF(entry->>'primaryDomain', ''),
      NULLIF(entry->>'domain', '')
    ),
    '^https?://|/.*$', '', 'g'
  )) AS host
  FROM domains
),
domain_host_duplicates AS (
  SELECT host FROM domain_hosts WHERE host <> '' GROUP BY 1 HAVING COUNT(*) > 1
)
SELECT
  (SELECT COUNT(*)::integer FROM state_rows) AS state_rows,
  (SELECT COUNT(*)::integer FROM state_rows
    WHERE state_json IS NULL OR jsonb_typeof(state_json) <> 'object')
    AS invalid_state_objects,
  (SELECT COUNT(*)::integer FROM state_rows
    WHERE state_json ? 'restaurants'
      AND jsonb_typeof(state_json->'restaurants') <> 'array')
    AS restaurants_not_array,
  (SELECT COUNT(*)::integer FROM state_rows
    WHERE state_json ? 'domains'
      AND jsonb_typeof(state_json->'domains') <> 'array')
    AS domains_not_array,
  (SELECT COUNT(*)::integer FROM restaurants) AS restaurant_entries,
  (SELECT COUNT(*)::integer FROM route_projection
    WHERE restaurant_key IS NULL OR slug IS NULL OR restaurant_name IS NULL)
    AS route_required_field_missing,
  (SELECT COUNT(*)::integer FROM restaurant_key_duplicates)
    AS restaurant_key_duplicate_groups,
  (SELECT COUNT(*)::integer FROM slug_duplicates)
    AS slug_duplicate_groups,
  (SELECT COUNT(*)::integer FROM domain_host_duplicates)
    AS domain_host_duplicate_groups,
  (SELECT COUNT(*)::integer FROM domains
    WHERE EXISTS (
      SELECT 1
      FROM (VALUES
        (entry->>'dnsIntegrated'),
        (entry->>'sslIntegrated'),
        (entry->>'isSimulation')
      ) AS boolean_value(value)
      WHERE value IS NOT NULL
        AND LOWER(value) NOT IN (
          'true', 'false', 't', 'f', 'yes', 'no', 'y', 'n',
          '1', '0', 'on', 'off'
        )
    )) AS invalid_boolean_domain_entries;

-- Size/volume only, to estimate DDL and index lock duration.
SELECT
  class_record.relname AS table_name,
  pg_total_relation_size(class_record.oid)::bigint AS total_bytes,
  COALESCE(stats_record.n_live_tup, 0)::bigint AS estimated_rows,
  COALESCE(stats_record.n_dead_tup, 0)::bigint AS dead_rows
FROM pg_class AS class_record
INNER JOIN pg_namespace AS namespace_record
  ON namespace_record.oid = class_record.relnamespace
LEFT JOIN pg_stat_user_tables AS stats_record
  ON stats_record.relid = class_record.oid
WHERE namespace_record.nspname = 'public'
  AND class_record.relkind IN ('r', 'p')
ORDER BY pg_total_relation_size(class_record.oid) DESC;

COMMIT;
