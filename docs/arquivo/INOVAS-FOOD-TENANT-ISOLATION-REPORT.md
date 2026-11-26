# INOVAS Food - Tenant Isolation Report

Data: 2026-06-28

## Objetivo

Executar a Etapa 2 da migracao SaaS com foco em seguranca de dados: todos os stores operacionais agora exigem `tenantContext` explicito para ler, criar, atualizar ou excluir dados. O modo `INOVAS_TENANT_MODE=default_only` permanece compativel com Tokyo Sushi/default e multi-restaurante real nao foi ativado.

## Stores Operacionais Mapeados

| Dominio | Store | Risco antes da Etapa 2 | Resultado |
| --- | --- | --- | --- |
| Pedidos | `lib/order-store.cjs` | Consultas globais por pedidos, cliente, status, auditoria, agendados, metricas e financeiro | Todas as operacoes exigem tenant e filtram por `restaurantKey`/`restaurant_key` |
| Clientes/CRM | `lib/customer-crm-store.cjs` | CRM agregava pedidos e perfis sem escopo de tenant | Listagem e perfil filtram tenant; perfis gravam `restaurantKey` |
| Catalogo/produtos | `lib/catalog-store.cjs` | Catalogo operacional, overrides e promocoes globais | Estado, overrides, promocoes, CRUD e catalogo publico recebem tenant |
| Estoque | `lib/inventory-store.cjs` | Estado de estoque unico | Default preservado; tenants nao-default ficam em escopo separado |
| Financeiro | `lib/finance-store.cjs` e financeiro de pedidos | Fechamentos e snapshots sem isolamento | Fechamentos e snapshot financeiro exigem tenant |
| Avaliacoes/reviews | `lib/review-store.cjs` | Reviews publicas/admin globais | CRUD e snapshots filtram tenant; `restaurantKey` preservado em updates |
| Entregas | `lib/delivery-settings-store.cjs` | Configuracao unica | Default preservado; tenants nao-default usam escopo proprio |
| Configuracoes operacionais | `lib/restaurant-settings-store.cjs` | Configuracao unica | Default preservado; tenants nao-default usam escopo proprio e retornam `restaurantKey` correto |

## Funcoes que Ainda Nao Recebiam TenantContext

Foram atualizadas as entradas operacionais dos stores:

- Pedidos: `createOrder`, `getAdminOrderList`, `getAdminOrderDetails`, `updateAdminOrderStatus`, `getCustomerActiveOrder`, `getAdminAuditLog`, `getAdminMetrics`, `getAdminFinance`, `getAdminScheduledOrders`.
- Clientes: `getAdminCustomers`, `saveAdminCustomerProfile`.
- Catalogo: `getAdminCatalog`, `getPublicCatalogState`, `getCatalogValidationContext`, `saveCatalogSection`, `deleteCatalogSection`, `saveCatalogItem`, `deleteCatalogItem`, `updateCatalogItem`, `getAdminPromotions`, `savePromotion`, `togglePromotionEnabled`, `deletePromotion`.
- Estoque: `getAdminInventory`, `saveInventoryItem`, `adjustInventoryStock`.
- Financeiro: `getFinanceClosing`, `saveFinanceClosing`.
- Reviews: `getPublicReviewsSnapshot`, `createPublicReview`, `getAdminReviews`, `updateReviewVisibility`, `deleteReview`.
- Entrega: `getAdminDeliverySettings`, `getPublicDeliverySettings`, `updateDeliverySettings`.
- Restaurante/configuracoes: `getAdminRestaurantSettings`, `getPublicRestaurantSettings`, `updateRestaurantSettings`.

## Riscos de Vazamento Identificados

- Pedido de um restaurante poderia aparecer em listagens, detalhes, auditoria, agendados, metricas ou financeiro de outro restaurante.
- `publicId`/`orderId` podia abrir ou atualizar pedido sem escopo de tenant.
- Mesmo telefone/customerKey poderia colidir entre restaurantes em deduplicacao, CRM e pedido ativo.
- Reviews podiam ser listadas, escondidas ou excluidas fora do tenant correto.
- Configuracoes de entrega/restaurante e estoque usavam estado operacional unico.
- Catalogo, overrides e promocoes nao tinham filtro logico de tenant.

## Plano de Refatoracao Executado

- `lib/tenant-context.cjs`: adicionado guard operacional (`getOperationalTenant`) e helpers `matchesTenantKey`, `withTenantKey`.
- `lib/order-store.cjs`: criado escopo por tenant em file store e SQL; schema recebeu `restaurant_key`; todos os exports operacionais exigem options com `tenantContext`.
- `lib/customer-crm-store.cjs`: pedidos/perfis filtrados por tenant; schema SQL recebeu `restaurant_key`.
- `lib/catalog-store.cjs`: estado runtime, overrides, promocoes e CRUD passaram a receber tenant; file store separa tenants nao-default.
- `lib/inventory-store.cjs`: estado default preservado e tenants nao-default isolados; SQL com `restaurant_key`.
- `lib/finance-store.cjs`: fechamento de caixa exige tenant; file store e SQL filtram tenant.
- `lib/review-store.cjs`: reviews gravam e preservam `restaurantKey`; listagem/update/delete filtram tenant.
- `lib/delivery-settings-store.cjs`: configuracoes default continuam legadas; tenants nao-default ficam separados.
- `lib/restaurant-settings-store.cjs`: configuracoes default continuam legadas; tenants nao-default ficam separados e normalizacao preserva `restaurantKey`.
- `lib/admin-api.cjs`, `lib/customer-api.cjs`, `api/catalog.js`, `api/delivery-settings.js`, `api/restaurant-settings.js`: chamadas de API repassam `tenantContext` explicitamente.
- `scripts/validate-business-hours.mjs` e `scripts/validate-site-layouts-local.mjs`: validadores locais usam tenant default explicito.

## Teste Anti-vazamento A/B

Criado `scripts/validate-tenant-isolation-local.mjs` e script NPM `validate:tenant-isolation-local`.

Cobertura do teste:

- Garante falha segura (`tenant_context_required`) quando stores operacionais sao chamados sem tenant.
- Simula `tenant-a` e `tenant-b` em storage local temporario.
- Valida criacao, edicao, listagem e exclusao por tenant para catalogo, estoque, financeiro, reviews e configuracoes.
- Cria pedidos A/B com mesmo telefone/customerKey para provar que deduplicacao e pedido ativo sao isolados.
- Valida que CRM, pedido detalhado, status, listagem, fechamento financeiro e reviews nao cruzam dados.
- Confirma que `default_only` continua carregando o tenant `default`/Tokyo sem ativar multi-restaurante real.
- Confirma que `.data` real nao e tocado.

## Validacoes Executadas

Passaram:

- `node --check` em todos os arquivos `.cjs`, `.js` e `.mjs` tocados.
- `node -e "JSON.parse(...package.json...)"`.
- `npm.cmd run validate:tenant-isolation-local`.
- `npm.cmd run validate:tenant-context-local`.
- `npm.cmd run validate:business-hours`.
- `npm.cmd run validate:domains-local`.
- `npm.cmd run validate:plans-contracts-local`.
- `npm.cmd run validate:permissions-local`.
- `npm.cmd run validate:platform-integration-local`.
- `npm.cmd run validate:admin-local`.
- `npm.cmd run validate:site-layouts-local`.
- `npm.cmd run validate:mobile-public-local`.
- `git diff --check` sem erros de whitespace; apenas avisos esperados de LF/CRLF do Git no Windows.

## Criterio de Aceite

- Nenhum store operacional funciona sem `tenantContext`: validado por teste automatizado.
- Testes A/B provam isolamento logico entre dois tenants: validado por `validate:tenant-isolation-local`.
- `default_only` permanece compativel com Tokyo Sushi/default: validado no teste A/B e nos validadores existentes.
- Rotas publicas/admin continuam funcionando: validado por admin, layout, mobile publico, plataforma e business-hours.
- Consultas operacionais foram escopadas por tenant nos stores do escopo; registros legados sem `restaurantKey` continuam tratados como `default` para compatibilidade.

## Observacao de Produto/Arquitetura

Esta etapa nao ativa multi-restaurante real. Ela introduz o contrato obrigatorio de tenant e isolamento logico local para impedir acesso operacional sem escopo. A etapa futura de multi-restaurante real ainda deve revisar constraints fisicas/indices unicos de banco para chaves compostas por tenant onde aplicavel.
