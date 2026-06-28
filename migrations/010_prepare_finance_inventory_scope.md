# 010 - Prepare Finance And Inventory Scope

Status: futuro, nao executavel.

## Objetivo

Preparar financeiro e estoque para restaurante/unidade.

## Dependencias

- `002_create_restaurants`.
- Modelo futuro de caixa/PDV definido antes de normalizacao profunda.

## Tabelas Impactadas Futuramente

- `finance_closings`
- `inventory_runtime_state`

## Mudancas Futuras Planejadas

- Escopar fechamentos por restaurante.
- Revisar `period_key` para evitar colisao.
- Escopar estoque por restaurante.
- Planejar tabelas futuras de itens, locais e movimentos.

## Validacoes Futuras

- Fechamento atual do default permanece igual.
- Estoque do default permanece igual.
- Restaurante A nao ve saldo/fechamento de B.

## Rollback Futuro

- Manter leitura do estado runtime/periodo legado enquanto novas estruturas sao ignoradas.
