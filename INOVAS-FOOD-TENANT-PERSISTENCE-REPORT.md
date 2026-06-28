# INovas Food - Tenant Persistence Report

Data: 2026-06-28

## Objetivo

Preparar a persistencia fisica por tenant sem ativar multi-restaurante real. O modo padrao continua `INOVAS_TENANT_MODE=default_only`, preservando Tokyo Sushi/default.

## Entidades Persistidas

| Area | Arquivo/store | Persistencia | Escopo fisico |
| --- | --- | --- | --- |
| Pedidos | `lib/order-store.cjs` | `orders.json` / Neon | `tenantId`, `restaurantId`, `restaurantKey` em pedidos, clientes, itens e auditoria |
| Clientes/CRM | `lib/customer-crm-store.cjs` | `customer-crm.json` / Neon | `tenantId`, `restaurantId`, `restaurantKey` por perfil |
| Catalogo/produtos | `lib/catalog-store.cjs` | `catalog-overrides.json` / Neon | tenant fisico em estrutura, promocoes, overrides e runtime state |
| Estoque | `lib/inventory-store.cjs` | `inventory-store.json` / Neon | tenant fisico no documento/linha de runtime state |
| Financeiro | `lib/finance-store.cjs` | `finance-closings.json` / Neon | tenant fisico por fechamento |
| Reviews | `lib/review-store.cjs` | `reviews.json` / Neon | tenant fisico por avaliacao |
| Entregas | `lib/delivery-settings-store.cjs` | `delivery-settings.json` / Neon | tenant fisico por configuracao |
| Configuracoes | `lib/restaurant-settings-store.cjs` | `restaurant-settings.json` / Neon | tenant fisico por configuracao |
| Auditoria | `lib/order-store.cjs` | audit trail / `order_status_events` | tenant fisico por evento |

Usuarios/sessoes permanecem no contrato administrativo atual e nao ativam multi-restaurante real nesta etapa.

## Mudancas Implementadas

- `TenantContext` passou a fornecer `tenantId` e `restaurantId` deterministas para default e tenants locais.
- Stores operacionais passaram a gravar e filtrar por `tenant_id`, `restaurant_id` e `restaurant_key`.
- Unicidades historicamente globais foram preparadas como compostas por tenant nos schemas Neon dos stores.
- Dados locais em `.data` mantem compatibilidade com registros antigos via fallback seguro para default.
- `validate:tenant-isolation-local` agora tambem inspeciona persistencia fisica temporaria.
- Criado `validate:tenant-persistence-local` com colisao controlada de IDs/chaves entre tenant A e B.
- Criada migration documental `migrations/013_prepare_physical_tenant_persistence.md`.

## Riscos de Migracao

- Constraints globais antigas podem bloquear IDs iguais entre tenants se uma base Neon nao receber a migration completa.
- Backfill deve rodar antes de qualquer tentativa de criar tenant real.
- Relatorios e dashboard precisam manter filtros fisicos junto de `restaurant_key`; isso foi coberto nos stores e validadores locais.
- O cutover real continua proibido ate staging, backup e rollback ensaiados.

## Evidencias

Comandos executados:

- `node --check` nos stores operacionais e scripts tocados.
- `npm.cmd run validate:tenant-context-local`
- `npm.cmd run validate:tenant-isolation-local`
- `npm.cmd run validate:tenant-persistence-local`
- `npm.cmd run validate:permissions-local`
- `npm.cmd run validate:plans-contracts-local`
- `npm.cmd run validate:admin-local`
- `npm.cmd run validate:platform-integration-local`

Resultado: todos passaram.

## Status

Etapa 3 concluida em nivel local/codigo: isolamento logico e fisico validado em `default_only`, sem alteracao visual e sem ativar multi-restaurante real.
