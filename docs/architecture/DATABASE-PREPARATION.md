# INOVAS FOOD - Preparacao de Banco para V2.0

Status: preparacao documental.
Escopo: plano de banco, sem executar migration, sem alterar schema, API, deploy, commit ou tag.

## 1. Situacao Atual

O projeto possui duas formas de persistencia:

- Local JSON em `.data/**` para ambiente local/teste.
- Neon/Postgres via `@neondatabase/serverless` quando configurado.

Stores ja possuem preparacao parcial para tenant:

- `catalog-store.cjs`
- `customer-crm-store.cjs`
- `inventory-store.cjs`
- `finance-store.cjs`
- `review-store.cjs`
- `delivery-settings-store.cjs`
- `restaurant-settings-store.cjs`
- `order-store.cjs`
- `master-platform-store.cjs`
- `user-permissions.cjs`

A migration `013_prepare_physical_tenant_persistence.md` ja documenta `tenant_id`, `restaurant_id`, `restaurant_key` em entidades operacionais.

## 2. Modelo Alvo

Chaves principais recomendadas:

- Plataforma: `organization_id`.
- Restaurante: `tenant_id + restaurant_id`.
- Compatibilidade: `restaurant_key`.
- Publico: `restaurant_slug` e `restaurant_domain`.
- Comercial: `seller_id`.

Regra:

- Dado operacional sempre pertence a um restaurante.
- Dado de plataforma pode nao possuir restaurante.
- Usuario do sistema nao possui `restaurant_key`.
- Usuario de restaurante possui `tenant_id`, `restaurant_id`, `restaurant_key`.

## 3. Tabelas de Plataforma

### organizations

Campos recomendados:

- `id`
- `organization_key`
- `name`
- `status`
- `created_at`
- `updated_at`
- `deleted_at`

### restaurants

Campos recomendados:

- `id`
- `tenant_id`
- `restaurant_id`
- `restaurant_key`
- `restaurant_slug`
- `restaurant_domain`
- `organization_id`
- `name`
- `trade_name`
- `status`
- `plan_key`
- `seller_id`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`
- `deleted_at`

### restaurant_domains

Campos recomendados:

- `id`
- `tenant_id`
- `restaurant_id`
- `domain`
- `is_primary`
- `status`
- `verified_at`
- `created_by`
- `updated_by`
- `deleted_at`

### plans, contracts, subscriptions

Campos recomendados:

- `id`
- `restaurant_id`
- `plan_key`
- `status`
- `starts_at`
- `ends_at`
- `billing_status`
- `seller_id`
- `created_by`
- `updated_by`
- `deleted_at`

## 4. Usuarios

### system_users

Campos recomendados:

- `id`
- `login`
- `email`
- `name`
- `phone`
- `password_hash`
- `user_type`
- `status`
- `permissions`
- `created_by`
- `updated_by`
- `deleted_at`
- `last_access_at`

Regra: sem `restaurant_key`.

### restaurant_users

Campos recomendados:

- `id`
- `tenant_id`
- `restaurant_id`
- `restaurant_key`
- `login`
- `email`
- `name`
- `phone`
- `password_hash`
- `user_type`
- `status`
- `permissions`
- `created_by`
- `updated_by`
- `deleted_at`
- `last_access_at`

Regra: `restaurant_id` obrigatorio.

## 5. Dados Operacionais

Tabelas que devem possuir `tenant_id`, `restaurant_id`, `restaurant_key`:

- `orders`
- `order_items`
- `order_status_events`
- `customers`
- `customer_crm_profiles`
- `customer_reviews`
- `catalog_item_overrides`
- `catalog_promotions`
- `catalog_runtime_state`
- `delivery_settings`
- `restaurant_settings`
- `inventory_runtime_state`
- `finance_closings`
- `scheduled_orders`
- `audit_logs`

Campos comuns recomendados:

- `tenant_id`
- `restaurant_id`
- `restaurant_key`
- `created_by`
- `updated_by`
- `created_at`
- `updated_at`
- `deleted_at`

## 6. Auditoria

Criar tabela futura `audit_logs` com:

- `id`
- `tenant_id`
- `restaurant_id`
- `restaurant_key`
- `actor_user_id`
- `actor_user_type`
- `actor_scope`
- `event_type`
- `entity_type`
- `entity_id`
- `request_id`
- `ip_hash`
- `user_agent`
- `before_json`
- `after_json`
- `created_at`

Para eventos de plataforma, `restaurant_id` pode ser vazio, mas `actor_scope` deve ser obrigatorio.

## 7. Indices Recomendados

Operacional:

- `(tenant_id, restaurant_id, created_at DESC)`
- `(tenant_id, restaurant_id, status, created_at DESC)`
- `(tenant_id, restaurant_id, customer_key)`
- `(tenant_id, restaurant_id, public_id)`
- `(tenant_id, restaurant_id, period_key)`
- `(tenant_id, restaurant_id, state_key)`

Plataforma:

- `restaurants(restaurant_key)`
- `restaurants(restaurant_slug)`
- `restaurants(seller_id)`
- `restaurant_domains(domain)`
- `system_users(login)`
- `restaurant_users(tenant_id, restaurant_id, login)`

## 8. Soft Delete

Recomendacao:

- Usar `deleted_at` em usuarios, restaurantes, contratos, configuracoes e cadastros sensiveis.
- Evitar apagar fisicamente dados operacionais com impacto financeiro/auditoria.
- Excluir fisicamente apenas artefatos temporarios sem valor fiscal/operacional.

## 9. Backfill e Cutover

Passos:

1. Backup.
2. Criar colunas nullable ou com default seguro.
3. Backfill do `default` atual.
4. Criar indices compostos.
5. Validar registros sem tenant.
6. Ativar escrita com tenant obrigatorio.
7. Ativar leitura strict em staging.
8. Ativar producao com rollback preparado.

## 10. Problemas, Prioridade e Risco

| Problema | Prioridade | Impacto | Risco |
| --- | --- | --- | --- |
| Chaves globais antigas | Alta | Colisao entre restaurantes | Alto |
| `restaurant_key` como isolador unico | Alta | Menos robusto que id fisico | Medio/Alto |
| Auditoria distribuida | Media | Dificulta investigacao | Medio |
| Soft delete ausente em algumas entidades | Media | Perda de historico | Medio |
| Local JSON divergente do Postgres | Media | Teste passa e prod falha | Medio |

## 11. Recomendacao Final

O banco deve evoluir para isolamento por `tenant_id + restaurant_id`, com `restaurant_key` apenas como compatibilidade. A migration 013 e uma boa base, mas V2.0 precisa completar usuarios, auditoria, seller links, soft delete e indices antes de ativar multi-restaurante real.
