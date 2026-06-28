# INovas Food - Tenant Context Implementation Report

Data: 2026-06-28

## Objetivo

Iniciar a Fase 3 da migracao SaaS com `TenantContext` interno em modo `default_only`, preservando Tokyo Sushi como restaurante operacional atual.

Esta etapa nao ativa multi-restaurante real, nao cria `restaurant_id`, nao altera dominio, cookies, prefixos de pedido, layout, dados reais ou contratos publicos existentes.

## Arquitetura atual mapeada

- Site publico: HTML estatico, `script.js`, `styles.css`, APIs publicas de catalogo, entrega, configuracoes, pedidos, cliente e avaliacoes.
- Gestor: `admin/index.html`, `admin/admin.js`, `admin/admin.css`, API consolidada em `lib/admin-api.cjs`.
- Painel Master: `admin/master.html`, `admin/master.js`, `lib/master-platform-store.cjs`.
- Persistencia: Neon quando `DATABASE_URL` existe; arquivos `.data` em desenvolvimento; modo disabled em producao sem banco.
- Autenticacao: `lib/admin-auth.cjs`, `lib/customer-auth.cjs`.
- Permissoes: `lib/user-permissions.cjs` com RBAC por modulo/acao.
- Planos e feature flags: `lib/master-platform-store.cjs`.
- Stores operacionais: pedidos, catalogo, delivery, settings, financeiro, estoque, CRM e reviews.

## Problemas encontrados

- Os stores operacionais ainda sao `default/global` na pratica.
- APIs publicas ainda nao tinham contrato comum de tenant por request.
- API admin validava sessao, permissao e plano, mas ainda nao anexava contexto de restaurante ao payload.
- O catalogo legado ainda extrai dados de `script.js`, o que acopla dado operacional ao bundle publico.
- O modo multi-restaurante real continua bloqueado corretamente por falta de escopo fisico nas tabelas.

## Gargalos

- `script.js` e `admin/admin.js` seguem grandes e concentrando muitas responsabilidades.
- Dashboard, financeiro e relatorios ainda dependem de agregacoes globais.
- Catalogo, estoque e financeiro ainda usam estruturas globais/JSON que precisam escopo por restaurante antes de vender multi-restaurante.
- O Master ainda persiste muita configuracao em JSON unico.

## Duplicacoes e codigo morto

- Existem validacoes e docs antigas que ainda citam Tokyo/TKY por compatibilidade.
- Ha varias rotas legadas reescritas para wrappers consolidados em `vercel.json`.
- Nao removi nada nesta etapa porque a worktree ja continha mudancas amplas e a regra do projeto exige preservar compatibilidade.

## Implementacao feita

- Criado `lib/tenant-context.cjs`.
- Adicionado `INOVAS_TENANT_MODE=default_only` em `.env.example`.
- APIs publicas agora resolvem contexto por host:
  - `/api/catalog`
  - `/api/reviews` via catalog public view
  - `/api/delivery-settings`
  - `/api/restaurant-settings`
  - `/api/orders/create`
  - `/api/customer/*`
  - `/api/auth/send-whatsapp-code`
- API admin agora anexa `tenantContext` ao payload do admin e valida compatibilidade entre sessao e restaurante resolvido.
- Criado `scripts/validate-tenant-context-local.mjs`.
- Adicionado script `validate:tenant-context-local` no `package.json`.

## Contrato atual do TenantContext

Campos principais:

- `tenantMode`
- `host`
- `organizationId`
- `organizationKey`
- `restaurantId`
- `restaurantKey`
- `legacyRestaurantKey`
- `restaurantName`
- `matchedDomain`
- `resolutionMode`
- `multiRestaurantActive`
- `fallbackRestaurantKey`

No modo atual, todos os hosts continuam resolvendo para:

- `tenantMode = default_only`
- `restaurantKey = default`
- `legacyRestaurantKey = default`
- `multiRestaurantActive = false`

## Validacoes executadas

- `node --check lib/tenant-context.cjs`
- `node --check lib/admin-api.cjs`
- `node --check lib/customer-api.cjs`
- `node --check scripts/validate-tenant-context-local.mjs`
- `node --check api/orders/create.js`
- `node --check api/catalog.js`
- `node --check api/delivery-settings.js`
- `node --check api/restaurant-settings.js`
- `node --check api/auth/send-whatsapp-code.js`
- `npm.cmd run validate:tenant-context-local`
- `npm.cmd run validate:domains-local`
- `npm.cmd run validate:plans-contracts-local`
- `npm.cmd run validate:permissions-local`
- `npm.cmd run validate:platform-integration-local`

## Resultado

A etapa foi concluida em modo compatibilidade. A plataforma agora possui um ponto unico para resolver tenant por request e expor esse contexto para APIs publicas/admin, sem ativar multi-restaurante real.

## Proxima etapa recomendada

Refatorar stores operacionais para aceitar `tenantContext` explicitamente e, em seguida, adicionar testes anti-vazamento entre dois restaurantes simulados antes de qualquer schema real multi-tenant.
