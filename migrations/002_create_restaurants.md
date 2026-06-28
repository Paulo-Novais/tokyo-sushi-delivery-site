# 002 - Create Restaurants

Status: futuro, nao executavel.

## Objetivo

Criar a entidade operacional restaurante, vinculada a organizacao.

## Dependencias

- `001_create_organizations`.
- ADR-002 aprovado para compatibilidade com `restaurant_key`.

## Mudancas Futuras Planejadas

- Criar tabela futura `restaurants`.
- Criar restaurante default para Tokyo Sushi.
- Gravar `legacy_restaurant_key = "default"`.
- Manter `restaurant_key = "default"` funcionando na V1/V2.

## Campos Conceituais

- `id`
- `organization_id`
- `public_key`
- `legacy_restaurant_key`
- `name`
- `slug`
- `status`
- `timezone`
- `created_at`
- `updated_at`

## Validacoes Futuras

- `legacy_restaurant_key = "default"` resolve para o restaurante Tokyo Sushi.
- Nenhum endpoint exige `restaurant_id` externo.
- Nenhum dado operacional e alterado nesta etapa.

## Rollback Futuro

- Remover restaurante default se ainda nao houver dominios, memberships ou dados vinculados.
