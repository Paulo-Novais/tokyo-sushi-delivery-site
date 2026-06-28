# ADR-005 - Estrategia de Isolamento de Dados

Status: proposto

Data: 2026-06-25

## Contexto

Em uma plataforma multi-restaurante, o maior risco tecnico e permitir que um restaurante acesse dados de outro. Esse risco aparece em APIs, stores, sessoes, relatorios, caches, integracoes e permissao.

## Decisao

Todo acesso a dado operacional futuro deve exigir `TenantContext` interno contendo:

- `organizationId`
- `restaurantId`
- `legacyRestaurantKey`
- `actorUserId` quando admin
- `membershipId` quando admin
- `source` do contexto: dominio, sessao, master ou default fallback

Stores operacionais nao devem aceitar leitura/escrita sem contexto quando o modo tenant estiver ativo.

## Consequencias Positivas

- Reduz vazamento por esquecimento de filtro.
- Centraliza autorizacao e auditoria.
- Facilita testes automatizados de isolamento.
- Permite relatorios por restaurante e por organizacao.

## Consequencias Negativas

- Exige refatoracao de todas as chamadas a stores.
- Exige cuidado com jobs, webhooks e integracoes externas.
- Exige estrategia de cache por escopo.

## Areas Obrigatorias

- Pedidos.
- Clientes/CRM.
- Catalogo.
- Delivery.
- Financeiro.
- Estoque.
- Avaliacoes.
- Relatorios.
- Feature flags.
- Branding.
- Integracoes externas.

## Principio de Seguranca

Falha de resolucao de contexto deve negar acesso, exceto no modo default-only explicitamente habilitado para compatibilidade.
