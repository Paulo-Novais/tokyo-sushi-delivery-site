# 007 - Prepare Catalog Scope

Status: futuro, nao executavel.

## Objetivo

Preparar catalogo e promocoes para escopo por restaurante.

## Dependencias

- `002_create_restaurants`.
- Separacao planejada do catalogo base de `script.js`.

## Tabelas Impactadas Futuramente

- `catalog_item_overrides`
- `catalog_promotions`
- `catalog_runtime_state`

## Mudancas Futuras Planejadas

- Adicionar escopo futuro por restaurante em migration real posterior.
- Transformar chaves globais em chaves compostas por restaurante.
- Criar indices por `restaurant_id`, status e atualizacao.

## Validacoes Futuras

- Catalogo default permanece igual.
- Promocoes default permanecem iguais.
- Restaurante A nao consegue ler override/promocao do restaurante B.

## Rollback Futuro

- Manter leitura por dados legados globais enquanto novas colunas/tabelas ficam ignoradas.
