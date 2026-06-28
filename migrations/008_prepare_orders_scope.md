# 008 - Prepare Orders Scope

Status: futuro, nao executavel.

## Objetivo

Preparar pedidos, itens e eventos para escopo por restaurante.

## Dependencias

- `002_create_restaurants`.
- ADR-003 e ADR-004 aprovados.
- Plano de backfill do restaurante default.

## Tabelas Impactadas Futuramente

- `orders`
- `order_items`
- `order_status_events`
- `customers`

## Mudancas Futuras Planejadas

- Adicionar escopo futuro em `orders`.
- Denormalizar escopo em `order_items` e `order_status_events` para performance e seguranca.
- Revisar unicidade de `public_id`, `customer_key` e `request_signature`.
- Criar indices por restaurante/status/data.

## Validacoes Futuras

- Pedido Tokyo existente continua visivel no gestor.
- Criacao de pedido default continua gerando o mesmo tipo de resposta.
- Restaurante A nao lista, altera ou audita pedidos de B.

## Rollback Futuro

- Dual-read com preferencia legada ate cutover ser confirmado.
- Flag para desativar filtros por escopo apenas em staging/rollback controlado.
