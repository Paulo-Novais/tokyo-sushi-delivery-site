# 013 - Preparar Persistencia Fisica por Tenant

Status: documentacao futura, nao executavel automaticamente.

Objetivo: adicionar `tenant_id`, `restaurant_id` e indices compostos aos dados operacionais, mantendo todos os dados atuais associados ao tenant default (`tenant_default` / `restaurant_default` / `default`) e sem ativar multi-restaurante real.

## Entidades Cobertas

- `orders`, `order_items`, `order_status_events`, `customers`
- `customer_crm_profiles`
- `catalog_item_overrides`, `catalog_promotions`, `catalog_runtime_state`
- `inventory_runtime_state`
- `finance_closings`
- `customer_reviews`
- `delivery_settings`
- `restaurant_settings`
- auditoria operacional embarcada em `order_status_events`

Usuarios, sessoes administrativas e plataforma master permanecem no contrato atual de acesso/admin e nao entram no cutover operacional desta migration.

## UP Seguro

```sql
BEGIN;

ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default';
ALTER TABLE customers ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default';

ALTER TABLE orders ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default';

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default';
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default';

ALTER TABLE order_status_events ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE order_status_events ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default';
ALTER TABLE order_status_events ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default';

ALTER TABLE customer_crm_profiles ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE customer_crm_profiles ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default';
ALTER TABLE customer_crm_profiles ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default';

ALTER TABLE customer_reviews ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE customer_reviews ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default';
ALTER TABLE customer_reviews ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default';

ALTER TABLE finance_closings ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE finance_closings ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default';
ALTER TABLE finance_closings ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default';

ALTER TABLE inventory_runtime_state ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE inventory_runtime_state ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default';
ALTER TABLE inventory_runtime_state ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default';

ALTER TABLE delivery_settings ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE delivery_settings ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default';
ALTER TABLE delivery_settings ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default';

ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE restaurant_settings ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default';

ALTER TABLE catalog_item_overrides ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE catalog_item_overrides ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default';
ALTER TABLE catalog_item_overrides ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default';

ALTER TABLE catalog_promotions ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE catalog_promotions ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default';
ALTER TABLE catalog_promotions ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default';

ALTER TABLE catalog_runtime_state ADD COLUMN IF NOT EXISTS tenant_id TEXT NOT NULL DEFAULT 'tenant_default';
ALTER TABLE catalog_runtime_state ADD COLUMN IF NOT EXISTS restaurant_id TEXT NOT NULL DEFAULT 'restaurant_default';
ALTER TABLE catalog_runtime_state ADD COLUMN IF NOT EXISTS restaurant_key TEXT NOT NULL DEFAULT 'default';

UPDATE customers SET tenant_id = 'tenant_default', restaurant_id = 'restaurant_default', restaurant_key = COALESCE(NULLIF(restaurant_key, ''), 'default');
UPDATE orders SET tenant_id = 'tenant_default', restaurant_id = 'restaurant_default', restaurant_key = COALESCE(NULLIF(restaurant_key, ''), 'default');
UPDATE order_items SET tenant_id = 'tenant_default', restaurant_id = 'restaurant_default', restaurant_key = COALESCE(NULLIF(restaurant_key, ''), 'default');
UPDATE order_status_events SET tenant_id = 'tenant_default', restaurant_id = 'restaurant_default', restaurant_key = COALESCE(NULLIF(restaurant_key, ''), 'default');
UPDATE customer_crm_profiles SET tenant_id = 'tenant_default', restaurant_id = 'restaurant_default', restaurant_key = COALESCE(NULLIF(restaurant_key, ''), 'default');
UPDATE customer_reviews SET tenant_id = 'tenant_default', restaurant_id = 'restaurant_default', restaurant_key = COALESCE(NULLIF(restaurant_key, ''), 'default');
UPDATE finance_closings SET tenant_id = 'tenant_default', restaurant_id = 'restaurant_default', restaurant_key = COALESCE(NULLIF(restaurant_key, ''), 'default');
UPDATE inventory_runtime_state SET tenant_id = 'tenant_default', restaurant_id = 'restaurant_default', restaurant_key = COALESCE(NULLIF(restaurant_key, ''), 'default');
UPDATE delivery_settings SET tenant_id = 'tenant_default', restaurant_id = 'restaurant_default', restaurant_key = COALESCE(NULLIF(restaurant_key, ''), 'default');
UPDATE restaurant_settings SET tenant_id = 'tenant_default', restaurant_id = 'restaurant_default', restaurant_key = COALESCE(NULLIF(restaurant_key, ''), 'default');
UPDATE catalog_item_overrides SET tenant_id = 'tenant_default', restaurant_id = 'restaurant_default', restaurant_key = COALESCE(NULLIF(restaurant_key, ''), 'default');
UPDATE catalog_promotions SET tenant_id = 'tenant_default', restaurant_id = 'restaurant_default', restaurant_key = COALESCE(NULLIF(restaurant_key, ''), 'default');
UPDATE catalog_runtime_state SET tenant_id = 'tenant_default', restaurant_id = 'restaurant_default', restaurant_key = COALESCE(NULLIF(restaurant_key, ''), 'default');

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_customer_key_key;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_public_id_key;
ALTER TABLE customer_crm_profiles DROP CONSTRAINT IF EXISTS customer_crm_profiles_pkey;
ALTER TABLE finance_closings DROP CONSTRAINT IF EXISTS finance_closings_pkey;
ALTER TABLE inventory_runtime_state DROP CONSTRAINT IF EXISTS inventory_runtime_state_pkey;
ALTER TABLE delivery_settings DROP CONSTRAINT IF EXISTS delivery_settings_pkey;
ALTER TABLE restaurant_settings DROP CONSTRAINT IF EXISTS restaurant_settings_pkey;
ALTER TABLE catalog_item_overrides DROP CONSTRAINT IF EXISTS catalog_item_overrides_pkey;
ALTER TABLE catalog_promotions DROP CONSTRAINT IF EXISTS catalog_promotions_pkey;
ALTER TABLE catalog_runtime_state DROP CONSTRAINT IF EXISTS catalog_runtime_state_pkey;

CREATE UNIQUE INDEX IF NOT EXISTS customers_tenant_restaurant_customer_key_uidx ON customers (tenant_id, restaurant_id, customer_key);
CREATE UNIQUE INDEX IF NOT EXISTS orders_tenant_restaurant_public_id_uidx ON orders (tenant_id, restaurant_id, public_id);
CREATE INDEX IF NOT EXISTS orders_tenant_restaurant_status_created_idx ON orders (tenant_id, restaurant_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_tenant_restaurant_customer_created_idx ON orders (tenant_id, restaurant_id, customer_key, created_at DESC);
CREATE INDEX IF NOT EXISTS order_items_tenant_restaurant_order_idx ON order_items (tenant_id, restaurant_id, order_id, sort_order);
CREATE INDEX IF NOT EXISTS order_status_events_tenant_restaurant_order_idx ON order_status_events (tenant_id, restaurant_id, order_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS customer_crm_profiles_tenant_restaurant_customer_uidx ON customer_crm_profiles (tenant_id, restaurant_id, customer_key);
CREATE INDEX IF NOT EXISTS customer_reviews_tenant_restaurant_created_idx ON customer_reviews (tenant_id, restaurant_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS finance_closings_tenant_restaurant_period_uidx ON finance_closings (tenant_id, restaurant_id, period_key);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_runtime_state_tenant_restaurant_state_uidx ON inventory_runtime_state (tenant_id, restaurant_id, state_key);
CREATE UNIQUE INDEX IF NOT EXISTS delivery_settings_tenant_restaurant_key_uidx ON delivery_settings (tenant_id, restaurant_id, settings_key);
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_settings_tenant_restaurant_key_uidx ON restaurant_settings (tenant_id, restaurant_id, restaurant_key);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_item_overrides_tenant_restaurant_item_uidx ON catalog_item_overrides (tenant_id, restaurant_id, item_id);
CREATE UNIQUE INDEX IF NOT EXISTS catalog_promotions_tenant_restaurant_id_uidx ON catalog_promotions (tenant_id, restaurant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS catalog_runtime_state_tenant_restaurant_state_uidx ON catalog_runtime_state (tenant_id, restaurant_id, state_key);

COMMIT;
```

## Validacao Antes do Cutover

```sql
SELECT 'orders_sem_tenant' AS check_name, COUNT(*) FROM orders WHERE tenant_id = '' OR restaurant_id = ''
UNION ALL SELECT 'customers_sem_tenant', COUNT(*) FROM customers WHERE tenant_id = '' OR restaurant_id = ''
UNION ALL SELECT 'reviews_sem_tenant', COUNT(*) FROM customer_reviews WHERE tenant_id = '' OR restaurant_id = ''
UNION ALL SELECT 'finance_sem_tenant', COUNT(*) FROM finance_closings WHERE tenant_id = '' OR restaurant_id = ''
UNION ALL SELECT 'catalog_promotions_sem_tenant', COUNT(*) FROM catalog_promotions WHERE tenant_id = '' OR restaurant_id = '';
```

Todos os contadores precisam retornar zero antes de qualquer ativacao multi-restaurante.

## DOWN Reversivel

Rollback seguro para antes do cutover real. Executar somente apos backup e confirmacao de que nao existem registros de tenants diferentes do default.

```sql
BEGIN;

DROP INDEX IF EXISTS customers_tenant_restaurant_customer_key_uidx;
DROP INDEX IF EXISTS orders_tenant_restaurant_public_id_uidx;
DROP INDEX IF EXISTS orders_tenant_restaurant_status_created_idx;
DROP INDEX IF EXISTS orders_tenant_restaurant_customer_created_idx;
DROP INDEX IF EXISTS order_items_tenant_restaurant_order_idx;
DROP INDEX IF EXISTS order_status_events_tenant_restaurant_order_idx;
DROP INDEX IF EXISTS customer_crm_profiles_tenant_restaurant_customer_uidx;
DROP INDEX IF EXISTS customer_reviews_tenant_restaurant_created_idx;
DROP INDEX IF EXISTS finance_closings_tenant_restaurant_period_uidx;
DROP INDEX IF EXISTS inventory_runtime_state_tenant_restaurant_state_uidx;
DROP INDEX IF EXISTS delivery_settings_tenant_restaurant_key_uidx;
DROP INDEX IF EXISTS restaurant_settings_tenant_restaurant_key_uidx;
DROP INDEX IF EXISTS catalog_item_overrides_tenant_restaurant_item_uidx;
DROP INDEX IF EXISTS catalog_promotions_tenant_restaurant_id_uidx;
DROP INDEX IF EXISTS catalog_runtime_state_tenant_restaurant_state_uidx;

ALTER TABLE customers ADD CONSTRAINT customers_customer_key_key UNIQUE (customer_key);
ALTER TABLE orders ADD CONSTRAINT orders_public_id_key UNIQUE (public_id);

ALTER TABLE customers DROP COLUMN IF EXISTS tenant_id, DROP COLUMN IF EXISTS restaurant_id;
ALTER TABLE orders DROP COLUMN IF EXISTS tenant_id, DROP COLUMN IF EXISTS restaurant_id;
ALTER TABLE order_items DROP COLUMN IF EXISTS tenant_id, DROP COLUMN IF EXISTS restaurant_id;
ALTER TABLE order_status_events DROP COLUMN IF EXISTS tenant_id, DROP COLUMN IF EXISTS restaurant_id;
ALTER TABLE customer_crm_profiles DROP COLUMN IF EXISTS tenant_id, DROP COLUMN IF EXISTS restaurant_id, DROP COLUMN IF EXISTS restaurant_key;
ALTER TABLE customer_reviews DROP COLUMN IF EXISTS tenant_id, DROP COLUMN IF EXISTS restaurant_id;
ALTER TABLE finance_closings DROP COLUMN IF EXISTS tenant_id, DROP COLUMN IF EXISTS restaurant_id;
ALTER TABLE inventory_runtime_state DROP COLUMN IF EXISTS tenant_id, DROP COLUMN IF EXISTS restaurant_id;
ALTER TABLE delivery_settings DROP COLUMN IF EXISTS tenant_id, DROP COLUMN IF EXISTS restaurant_id;
ALTER TABLE restaurant_settings DROP COLUMN IF EXISTS tenant_id, DROP COLUMN IF EXISTS restaurant_id;
ALTER TABLE catalog_item_overrides DROP COLUMN IF EXISTS tenant_id, DROP COLUMN IF EXISTS restaurant_id;
ALTER TABLE catalog_promotions DROP COLUMN IF EXISTS tenant_id, DROP COLUMN IF EXISTS restaurant_id;
ALTER TABLE catalog_runtime_state DROP COLUMN IF EXISTS tenant_id, DROP COLUMN IF EXISTS restaurant_id;

COMMIT;
```

## Observacoes

- Esta migration nao muda `INOVAS_TENANT_MODE`.
- Dados existentes sao preservados e associados ao tenant default.
- Chaves historicamente globais passam a ser unicas por `(tenant_id, restaurant_id, identificador)`.
- O cutover multi-restaurante real continua proibido ate validacao A/B, backup, staging e plano de rollback.
